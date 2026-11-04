// app/actions/payment-issues.ts
"use server";

// "Payments needing attention" — the cases the automatic payment handling
// deliberately leaves to a person. Built live from orders, payments and the
// audit log (no extra tables); what an admin does is recorded in the audit log
// as "payment_review.*", which is also what removes an item from the list.
//
// Every export is a public endpoint, so every one starts with requireAdmin().

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { getRequestId } from "@/utils/requestUtils";
import { audit, type AuditActor } from "@/lib/audit";
import { verifyPayment } from "@/lib/payment-verify";
import { reconcileOrder } from "@/lib/payment-reconcile";
import { claimSlots, confirmPaidOrder, releaseHold } from "@/lib/slot-hold";
import { runPostPaymentSteps } from "@/lib/order-confirmation";
import { revalidateTag } from "next/cache";
import { getActiveGatewayAlert, type GatewayAlert } from "@/lib/payment-gateway-alert";
import type {
  GatewayCheck,
  IssueAction,
  PaymentIssue,
  PaymentIssueKind,
} from "@/types/payment-issues";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Which actions make sense for which kind. Enforced here; the UI only hides buttons.
const ALLOWED: Record<PaymentIssueKind, IssueAction[]> = {
  REFUND_NO_SLOT: ["REFUNDED", "REINSTATE", "DISMISS"],
  DUPLICATE: ["REFUNDED", "DISMISS"],
  AMOUNT_MISMATCH: ["CONFIRM_ANYWAY", "RELEASE", "DISMISS"],
  STUCK_PENDING: ["CONFIRM", "RELEASE", "DISMISS"],
};

const fmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v);
};

// ─── Gateway outage ───────────────────────────────────
// "Runners can't pay right now" — the latest unresolved ShurjoPay failure.
export async function getGatewayAlert(): Promise<GatewayAlert | null> {
  const { error } = await requireAdmin();
  if (error) return null;
  try {
    return await getActiveGatewayAlert();
  } catch (err) {
    logger.error({ err }, "gatewayAlert:load_failed");
    return null;
  }
}

// ─── List ─────────────────────────────────────────────
export async function getPaymentIssues(): Promise<{
  issues: PaymentIssue[];
  error: string | null;
}> {
  const { error } = await requireAdmin();
  if (error) return { issues: [], error };

  try {
    const now = Date.now();
    type Raw = { kind: PaymentIssueKind; orderId: string; flaggedAt: Date; detail: string };
    const raw: Raw[] = [];

    // 1. Paid, but the order holds no slot.
    const refunds = await prisma.order.findMany({
      where: { status: "CANCELLED", isArchived: false, payment: { is: { status: "PAID" } } },
      select: { id: true, payment: { select: { updatedAt: true } } },
      take: 500,
    });
    for (const o of refunds) {
      raw.push({
        kind: "REFUND_NO_SLOT",
        orderId: o.id,
        flaggedAt: o.payment!.updatedAt,
        detail: "Payment received, but the order has no slot (hold expired and the package filled up, or an admin cancelled it). Refund the runner, or reinstate the order if a slot is free.",
      });
    }

    // 2 + 3. Flagged by the payment flow in the audit log.
    const flags = await prisma.auditLog.findMany({
      where: { action: { in: ["payment.duplicate", "payment.amount_mismatch"] } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const mismatchOrders = new Set<string>();
    const seen = new Set<string>();
    for (const f of flags) {
      const kind: PaymentIssueKind =
        f.action === "payment.duplicate" ? "DUPLICATE" : "AMOUNT_MISMATCH";
      if (kind === "AMOUNT_MISMATCH") mismatchOrders.add(f.entityId);
      const key = `${kind}:${f.entityId}`;
      if (seen.has(key)) continue; // latest flag per order is enough
      seen.add(key);
      raw.push({ kind, orderId: f.entityId, flaggedAt: f.createdAt, detail: f.summary });
    }

    // 4. Reached ShurjoPay, still pending, and outside automatic handling:
    //    hold cleared (parked), hold long expired, or older than the
    //    reconciler's 3-day window. Normal abandoned checkouts are excluded —
    //    those are handled (and released) automatically.
    const stuck = await prisma.order.findMany({
      where: {
        status: "PENDING",
        source: "ONLINE",
        isArchived: false,
        payment: { is: { paymentId: { not: null } } },
        OR: [
          { holdExpiresAt: null },
          { holdExpiresAt: { lt: new Date(now - 2 * HOUR) } },
          { createdAt: { lt: new Date(now - 3 * DAY) } },
        ],
      },
      select: { id: true, holdExpiresAt: true, payment: { select: { updatedAt: true } } },
      take: 500,
    });
    for (const o of stuck) {
      if (mismatchOrders.has(o.id)) continue; // shown as a mismatch instead
      raw.push({
        kind: "STUCK_PENDING",
        orderId: o.id,
        flaggedAt: o.payment!.updatedAt,
        detail:
          "Reached ShurjoPay but never confirmed, and it's outside automatic checking. Check with ShurjoPay: confirm it if paid, release the slot if not.",
      });
    }

    if (raw.length === 0) return { issues: [], error: null };

    // Hide items an admin already handled after they were flagged.
    const orderIds = [...new Set(raw.map((r) => r.orderId))];
    const markers = await prisma.auditLog.findMany({
      where: { entityId: { in: orderIds }, action: { startsWith: "payment_review." } },
      select: { entityId: true, createdAt: true },
    });
    const handledAt = new Map<string, number>();
    for (const m of markers) {
      handledAt.set(m.entityId, Math.max(handledAt.get(m.entityId) ?? 0, m.createdAt.getTime()));
    }
    const open = raw.filter((r) => (handledAt.get(r.orderId) ?? 0) < r.flaggedAt.getTime());

    const orders = await prisma.order.findMany({
      where: { id: { in: open.map((r) => r.orderId) } },
      select: {
        id: true,
        status: true,
        total: true,
        event: { select: { id: true, name: true } },
        package: { select: { name: true } },
        payment: { select: { status: true, amount: true, paymentId: true } },
        registration: { select: { fullName: true, email: true, phone: true } },
        user: { select: { email: true, phone: true, firstName: true, lastName: true } },
      },
    });
    const byId = new Map(orders.map((o) => [o.id, o]));

    const issues: PaymentIssue[] = open
      .filter((r) => byId.has(r.orderId))
      .filter((r) => {
        // A mismatch is only open while the order is still pending.
        const o = byId.get(r.orderId)!;
        return r.kind !== "AMOUNT_MISMATCH" || o.status === "PENDING";
      })
      .map((r) => {
        const o = byId.get(r.orderId)!;
        return {
          key: `${r.kind}:${r.orderId}`,
          kind: r.kind,
          orderId: r.orderId,
          flaggedAt: r.flaggedAt.toISOString(),
          detail: r.detail,
          orderStatus: o.status,
          paymentStatus: o.payment?.status ?? null,
          amount: o.payment?.amount ?? Math.round(o.total),
          spOrderId: o.payment?.paymentId ?? null,
          event: o.event,
          packageName: o.package.name,
          runner: {
            name:
              o.registration?.fullName ||
              [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") ||
              "Unknown",
            email: o.registration?.email || o.user.email || null,
            phone: o.registration?.phone || o.user.phone || null,
          },
        };
      })
      .sort((a, b) => b.flaggedAt.localeCompare(a.flaggedAt));

    return { issues, error: null };
  } catch (err) {
    console.error("getPaymentIssues error:", err);
    return { issues: [], error: "Failed to load payments needing attention" };
  }
}

// ─── Ask ShurjoPay (read-only) ───────────────────────
export async function checkIssueWithShurjoPay(orderId: string): Promise<GatewayCheck> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { paymentId: true, amount: true },
  });
  if (!payment?.paymentId) return { ok: false, error: "This order never reached ShurjoPay." };

  const result = await verifyPayment(payment.paymentId, { attempts: 2, timeoutMs: 15_000 });
  if (result.state === "UNSURE" && !result.item) {
    return {
      ok: false,
      error:
        result.reason === "empty"
          ? "ShurjoPay has no record of this payment."
          : "Couldn't reach ShurjoPay. Try again in a minute.",
    };
  }
  const item = result.item!;
  const amount = Number(item.amount);
  return {
    ok: true,
    paid: result.state === "PAID",
    code: Number.isFinite(Number(item.sp_code)) ? Number(item.sp_code) : null,
    message: item.sp_message || "",
    amount: Number.isFinite(amount) ? amount : null,
    expected: payment.amount,
    method: item.method || null,
  };
}

// ─── Resolve ─────────────────────────────────────────
export async function resolvePaymentIssue(
  kind: PaymentIssueKind,
  orderId: string,
  action: IssueAction,
  note = "",
): Promise<{ success: boolean; error: string | null; message?: string }> {
  const { error, dbUser } = await requireAdmin();
  if (error || !dbUser) return { success: false, error: error ?? "Unauthorized" };
  if (!ALLOWED[kind]?.includes(action)) {
    return { success: false, error: "That action isn't available for this issue." };
  }
  note = note.trim().slice(0, 500);
  if (action === "DISMISS" && note.length < 3) {
    return { success: false, error: "Add a short note saying how it was handled." };
  }

  const actor: AuditActor = { id: dbUser.id, label: dbUser.email };
  const log = logger.child({
    requestId: await getRequestId(),
    action: "resolvePaymentIssue",
    orderId,
    kind,
    resolution: action,
    adminId: dbUser.id,
  });
  log.info("action:start");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      eventId: true,
      packageId: true,
      qty: true,
      source: true,
      payment: { select: { id: true, status: true, amount: true, paymentId: true } },
    },
  });
  if (!order?.payment) return { success: false, error: "Order or payment not found." };

  // Recorded for every resolution; also what takes the item off the list.
  const mark = (what: string, summary: string) =>
    audit({
      actor,
      action: `payment_review.${what}`,
      entityType: "payment",
      entityId: orderId,
      eventId: order.eventId,
      summary: `${summary}${note ? ` — note: ${note}` : ""}`,
    });

  try {
    switch (action) {
      // ── Stuck: check ShurjoPay, confirm + notify if paid ──
      case "CONFIRM": {
        const result = await reconcileOrder(orderId, { log, actor });
        const messages: Record<string, [boolean, string]> = {
          CONFIRMED: [true, "Paid at ShurjoPay — order confirmed, email and SMS sent."],
          ALREADY_PAID: [true, "Already confirmed."],
          NOT_PAID: [false, "ShurjoPay has no successful payment for this order. Use “Release slot” if it's abandoned."],
          NO_SESSION: [false, "This order never reached ShurjoPay."],
          NEEDS_REVIEW: [false, "Paid, but the amount doesn't match — it's now listed as an amount mismatch."],
          PAID_NO_SLOT: [false, "Paid, but no slot is left — it's now listed as a refund."],
          GATEWAY_ERROR: [false, "Couldn't reach ShurjoPay. Try again in a minute."],
        };
        const [ok, message] = messages[result];
        if (!ok) return { success: false, error: message };
        if (result === "ALREADY_PAID") {
          const now = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
          if (now?.status !== "CONFIRMED") {
            return {
              success: false,
              error: "The payment is recorded as paid but the order isn't confirmed. Open the order and use “Confirm & Mark Paid”.",
            };
          }
        }
        await mark("confirmed", `Confirmed after checking ShurjoPay (${result})`);
        return { success: true, error: null, message };
      }

      // ── Mismatch: admin accepts the amount ShurjoPay reports ──
      case "CONFIRM_ANYWAY": {
        if (order.status !== "PENDING") {
          return { success: false, error: `Order is already ${order.status.toLowerCase()}.` };
        }
        if (!order.payment.paymentId) return { success: false, error: "No ShurjoPay payment to confirm." };
        const v = await verifyPayment(order.payment.paymentId, { attempts: 2, timeoutMs: 15_000 });
        if (v.state !== "PAID") {
          return {
            success: false,
            error: v.state === "UNSURE" ? "Couldn't confirm with ShurjoPay right now." : "ShurjoPay says this was not paid.",
          };
        }
        const transactionId = v.item.order_id || order.payment.paymentId;
        const outcome = await confirmPaidOrder({
          paymentId: order.payment.id,
          orderId,
          paymentData: {
            transactionId,
            paymentMethod: v.item.method || "shurjopay",
            paymentGateway: "shurjopay",
            paymentId: order.payment.paymentId,
          },
        });
        if (outcome !== "CONFIRMED" && outcome !== "ALREADY_PAID") {
          return { success: false, error: "Paid, but no slot is left — it's now listed as a refund." };
        }
        if (outcome === "CONFIRMED") {
          await runPostPaymentSteps({ orderId, transactionId, paymentMethod: v.item.method || undefined, log });
        }
        await mark(
          "confirmed_anyway",
          `Confirmed despite amount mismatch: ShurjoPay ৳${fmt(v.item.amount)}, order ৳${fmt(order.payment.amount)}`,
        );
        return { success: true, error: null, message: "Order confirmed. Email and SMS sent." };
      }

      // ── Paid, no slot: give it a free slot ──
      case "REINSTATE": {
        const done = await prisma.$transaction(async (tx) => {
          const reopened = await tx.order.updateMany({
            where: { id: orderId, status: "CANCELLED" },
            data: { status: "CONFIRMED", holdExpiresAt: null },
          });
          if (reopened.count === 0) return "CHANGED" as const;
          if (!(await claimSlots(tx, order.packageId, order.qty))) throw new Error("NO_SLOTS");
          return "OK" as const;
        });
        if (done === "CHANGED") return { success: false, error: "This order just changed — refresh the list." };
        await runPostPaymentSteps({
          orderId,
          transactionId: order.payment.paymentId ?? orderId,
          log,
        });
        await mark("reinstated", "Reinstated a paid order into a free slot; confirmation sent");
        return { success: true, error: null, message: "Order reinstated and confirmed. Email and SMS sent." };
      }

      // ── Refunded in the ShurjoPay panel ──
      case "REFUNDED": {
        if (kind === "REFUND_NO_SLOT") {
          const updated = await prisma.payment.updateMany({
            where: { orderId, status: "PAID", order: { status: "CANCELLED" } },
            data: { status: "REFUNDED" },
          });
          if (updated.count === 0) {
            return { success: false, error: "This payment isn't PAID on a cancelled order anymore — refresh the list." };
          }
          await mark("refunded", `Marked ৳${fmt(order.payment.amount)} as refunded`);
        } else {
          // DUPLICATE: the order keeps its original payment; only the second
          // one (never stored on our side) was refunded.
          await mark("refunded_duplicate", "Marked the duplicate payment as refunded");
        }
        return { success: true, error: null, message: "Marked as refunded." };
      }

      // ── Not paid: cancel and free the slot ──
      case "RELEASE": {
        if (order.status !== "PENDING") {
          return { success: false, error: `Order is already ${order.status.toLowerCase()}.` };
        }
        if (order.source !== "ONLINE") return { success: false, error: "Only online orders can be released here." };
        if (order.payment.paymentId) {
          const v = await verifyPayment(order.payment.paymentId, { attempts: 2, timeoutMs: 15_000 });
          if (v.state === "PAID") {
            return { success: false, error: "ShurjoPay says this WAS paid — confirm it instead of releasing." };
          }
          if (v.state === "UNSURE" && v.reason === "error") {
            return { success: false, error: "Couldn't reach ShurjoPay, so the slot wasn't released. Try again shortly." };
          }
        }
        const slug = await releaseHold(orderId);
        if (!slug) return { success: false, error: "This order just changed — refresh the list." };
        revalidateTag(`event-${slug}`, "max");
        await mark("released", "Not paid at ShurjoPay — order cancelled and slot released");
        return { success: true, error: null, message: "Not paid — order cancelled and slot released." };
      }

      case "DISMISS": {
        await mark("dismissed", "Dismissed");
        return { success: true, error: null, message: "Dismissed." };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message === "NO_SLOTS") {
      return { success: false, error: "No free slot in this package — refund the runner instead." };
    }
    log.error({ err }, "action:error");
    return { success: false, error: "Something went wrong. Nothing was changed." };
  } finally {
    await log.flush();
  }
}
