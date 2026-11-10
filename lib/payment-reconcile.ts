// lib/payment-reconcile.ts
//
// Makes payment confirmation independent of the browser redirect.
//
// The ShurjoPay callback only runs when the customer's browser is redirected
// back to us. If that never happens (wrong callback URL, closed tab, dropped
// connection) or ShurjoPay can't be reached at that moment, the money is taken
// but the order stays PENDING. The reconciler asks ShurjoPay directly and
// confirms paid orders itself — same checks, same race-safe confirmPaidOrder,
// same email/SMS as the callback. Only ever called with trusted order ids.
//
// ⚠️ Not a "use server" file — called only from trusted server code.

import { prisma } from "@/lib/prisma";
import type { ChildLogger } from "@/lib/logger";
import { verifyPayment } from "@/lib/payment-verify";
import { confirmPaidOrder } from "@/lib/slot-hold";
import { runPostPaymentSteps } from "@/lib/order-confirmation";
import { audit, SYSTEM, type AuditActor } from "@/lib/audit";
import { SSLCOMMERZ } from "@/lib/payment/sslcommerz/config";
import { confirmSslCommerzPayment } from "@/lib/payment/sslcommerz/confirm-payment";

export type ReconcileResult =
  | "CONFIRMED" // was paid; now confirmed and runner notified
  | "ALREADY_PAID" // already recorded as paid — nothing to do
  | "NOT_PAID" // ShurjoPay: cancelled/declined, or no successful payment
  | "NO_SESSION" // never reached ShurjoPay
  | "NEEDS_REVIEW" // paid, but amount/order didn't match — left for an admin
  | "PAID_NO_SLOT" // paid, but the order has no slot anymore — refund case
  | "GATEWAY_ERROR"; // couldn't get an answer — try again later

const fmt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v);
};

/** Check one order with ShurjoPay and confirm it if it was paid. */
export async function reconcileOrder(
  orderId: string,
  opts: { log: ChildLogger; actor?: AuditActor },
): Promise<ReconcileResult> {
  const actor = opts.actor ?? SYSTEM.reconciler;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      eventId: true,
      payment: {
        select: { id: true, status: true, amount: true, paymentId: true, paymentGateway: true },
      },
    },
  });
  const payment = order?.payment;
  if (!order || !payment?.paymentId) return "NO_SESSION";
  if (payment.status === "PAID" && order.status === "CONFIRMED") return "ALREADY_PAID";

  // SSLCommerz sessions are checked with SSLCommerz. Everything else (including
  // every payment made before SSLCommerz existed) goes the ShurjoPay way below.
  if (payment.paymentGateway === SSLCOMMERZ) {
    const { result } = await confirmSslCommerzPayment(payment.paymentId, {
      log: opts.log,
      ...(opts.actor && { actor: opts.actor }),
    });
    return result;
  }

  const spOrderId = payment.paymentId;
  const result = await verifyPayment(spOrderId, { attempts: 1, timeoutMs: 15_000 });
  if (result.state === "UNSURE") {
    if (result.reason === "error") {
      opts.log.warn({ orderId, spOrderId }, "reconcile:gateway_error");
      return "GATEWAY_ERROR";
    }
    return "NOT_PAID"; // empty / unknown code: no successful payment (yet)
  }
  if (result.state === "NOT_PAID") return "NOT_PAID";

  const paid = result.item;

  // Same safety checks as the callback: never confirm a payment that doesn't
  // match what we charged.
  const paidAmount = Number(paid.amount);
  const amountShort = Number.isFinite(paidAmount) && paidAmount < payment.amount;
  const wrongOrder = !!paid.value1 && paid.value1 !== orderId;
  if (amountShort || wrongOrder) {
    const already = await prisma.auditLog.findFirst({
      where: { entityId: orderId, action: "payment.amount_mismatch" },
      select: { id: true },
    });
    if (!already) {
      await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { holdExpiresAt: null }, // keep the slot while an admin checks
      });
      await audit({
        actor,
        action: "payment.amount_mismatch",
        entityType: "payment",
        entityId: orderId,
        eventId: order.eventId,
        summary: `NEEDS REVIEW: ${spOrderId} paid ৳${fmt(paid.amount)} but the order is ৳${fmt(payment.amount)}${wrongOrder ? ` (ShurjoPay order ${paid.value1})` : ""}. Not confirmed.`,
        changes: { amount: [payment.amount, paidAmount] },
      });
    }
    opts.log.error({ orderId, spOrderId, paidAmount }, "reconcile:needs_review");
    return "NEEDS_REVIEW";
  }

  const transactionId = paid.order_id || spOrderId;
  const outcome = await confirmPaidOrder({
    paymentId: payment.id,
    orderId,
    paymentData: {
      transactionId,
      paymentMethod: paid.method || "shurjopay",
      paymentGateway: "shurjopay",
      paymentId: spOrderId,
    },
  });

  if (outcome === "ALREADY_PAID") return "ALREADY_PAID";

  if (outcome === "PAID_BUT_SOLD_OUT" || outcome === "PAID_BUT_CANCELLED") {
    await audit({
      actor,
      action: "payment.paid_no_slot",
      entityType: "payment",
      entityId: orderId,
      eventId: order.eventId,
      summary: `REFUND NEEDED: ${spOrderId} paid ৳${fmt(paid.amount)} but the order has no slot (${outcome === "PAID_BUT_SOLD_OUT" ? "hold expired and package sold out" : "order cancelled by an admin"})`,
    });
    opts.log.error({ orderId, spOrderId, outcome }, "reconcile:REFUND_REQUIRED");
    return "PAID_NO_SLOT";
  }

  // CONFIRMED — this call won the race, so it sends the notifications.
  await runPostPaymentSteps({
    orderId,
    transactionId,
    paymentMethod: paid.method || undefined,
    log: opts.log,
  });
  await audit({
    actor,
    action: "payment.reconciled",
    entityType: "payment",
    entityId: orderId,
    eventId: order.eventId,
    summary: `Payment ${spOrderId} confirmed by checking ShurjoPay directly (callback didn't confirm it) · ৳${fmt(paid.amount)}${paid.method ? ` via ${paid.method}` : ""}`,
    changes: { status: [payment.status, "PAID"], order: [order.status, "CONFIRMED"] },
  });
  opts.log.info({ orderId, spOrderId }, "reconcile:confirmed");
  return "CONFIRMED";
}

/**
 * Check recent online orders that reached ShurjoPay but aren't confirmed.
 *
 * - `minAgeMs`: leave fresh sessions alone so the normal callback goes first.
 * - `lookbackDays`: only recent orders are handled automatically; anything
 *   older is left for an admin, so deploying this never messages old orders.
 */
export async function reconcilePendingPayments(opts: {
  log: ChildLogger;
  lookbackDays?: number;
  minAgeMs?: number;
  limit?: number;
}): Promise<Record<ReconcileResult, number>> {
  const now = Date.now();
  const lookbackDays = opts.lookbackDays ?? 3;
  const minAgeMs = opts.minAgeMs ?? 3 * 60 * 1000;

  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING",
      source: "ONLINE",
      isArchived: false,
      createdAt: { gte: new Date(now - lookbackDays * 24 * 60 * 60 * 1000) },
      payment: {
        is: {
          paymentId: { not: null },
          status: { not: "PAID" },
          // The payment row is touched when a ShurjoPay session starts.
          updatedAt: { lte: new Date(now - minAgeMs) },
        },
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });

  const counts = {
    CONFIRMED: 0,
    ALREADY_PAID: 0,
    NOT_PAID: 0,
    NO_SESSION: 0,
    NEEDS_REVIEW: 0,
    PAID_NO_SLOT: 0,
    GATEWAY_ERROR: 0,
  } satisfies Record<ReconcileResult, number>;

  for (const { id } of candidates) {
    // Orders an admin is reviewing for a mismatch are left alone.
    const flagged = await prisma.auditLog.findFirst({
      where: { entityId: id, action: "payment.amount_mismatch" },
      select: { id: true },
    });
    if (flagged) continue;

    try {
      counts[await reconcileOrder(id, { log: opts.log })]++;
    } catch (err) {
      counts.GATEWAY_ERROR++;
      opts.log.error({ err, orderId: id }, "reconcile:order_failed");
    }
  }
  return counts;
}
