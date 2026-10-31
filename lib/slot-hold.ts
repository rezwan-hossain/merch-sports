// lib/slot-hold.ts
//
// Slot holds for online checkout.
//
// Invariant maintained everywhere: Package.usedSlots === sum of `qty` over the
// package's orders whose status is NOT "CANCELLED". Every transition below keeps
// that true by pairing a *conditional* order update (WHERE status = <expected>)
// with the matching slot change inside one transaction. The conditional update
// row-locks the order, so two writers racing on the same order (sweep vs.
// payment callback vs. admin) can never both apply their slot change.
//
// Order.holdExpiresAt:
//   non-null → the system owns this hold: it expires, and a system-released
//              order (CANCELLED + non-null) can be reclaimed on payment retry.
//   null     → never auto-released: manual orders, anything an admin set by
//              hand, and orders parked for manual payment review.
//
// ⚠️ Deliberately NOT a "use server" file — these take trusted ids and must
// only be called from server code, never exposed as public actions.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { audit, SYSTEM } from "@/lib/audit";

export const SLOT_HOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const SLOT_HOLD_HOURS = SLOT_HOLD_MS / (60 * 60 * 1000);

export function newHoldExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SLOT_HOLD_MS);
}

type Tx = Prisma.TransactionClient;

/**
 * Atomically take `qty` slots on a package, only if they are free.
 * Returns false (and changes nothing) when the package is full.
 */
export async function claimSlots(
  tx: Tx,
  packageId: number,
  qty: number,
): Promise<boolean> {
  const pkg = await tx.package.findUnique({
    where: { id: packageId },
    select: { availableSlots: true },
  });
  if (!pkg) return false;

  const claimed = await tx.package.updateMany({
    where: { id: packageId, usedSlots: { lte: pkg.availableSlots - qty } },
    data: { usedSlots: { increment: qty } },
  });
  return claimed.count === 1;
}

/**
 * Release one PENDING online order's slot right now (payment cancelled or
 * declined). No-op if the order is no longer PENDING. Keeps holdExpiresAt
 * non-null so the order stays reclaimable from the retry page.
 * Returns the event slug when a slot was released (for cache revalidation).
 */
export async function releaseHold(orderId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { packageId: true, qty: true, event: { select: { slug: true } } },
    });
    if (!order) return null;

    const released = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING", source: "ONLINE" },
      data: {
        status: "CANCELLED",
        // Stamp it so it reads as a system release (reclaimable), even if it
        // had no hold before (e.g. created before holds existed).
        holdExpiresAt: new Date(),
      },
    });
    if (released.count === 0) return null;

    await tx.package.update({
      where: { id: order.packageId },
      data: { usedSlots: { decrement: order.qty } },
    });
    await tx.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "FAILED" },
    });

    return order.event.slug;
  });
}

export type GatewayCheck = (spOrderId: string) => Promise<"PAID" | "NOT_PAID">;

/**
 * Release every online order whose hold has expired without payment.
 *
 * Orders that reached the payment gateway (payment.paymentId set) may have
 * been paid even though no callback arrived (customer closed the tab on the
 * gateway's success screen, network drop). Those are only released after
 * `verifyGatewayPayment` confirms with the gateway that nothing was paid:
 *   - no verifier given (checkout's quick sweep) → skipped, left to the timer
 *   - verifier throws (gateway down)             → skipped, retried next run
 *   - gateway says PAID                          → NOT released; parked for
 *     manual review (holdExpiresAt = null) and returned in `parked`
 *
 * Pass `packageId` to limit the sweep to one package.
 */
export async function releaseExpiredHolds(
  options: {
    packageId?: number;
    limit?: number;
    verifyGatewayPayment?: GatewayCheck;
  } = {},
): Promise<{ slugs: string[]; parked: string[] }> {
  const now = new Date();

  const expired = await prisma.order.findMany({
    where: {
      status: "PENDING",
      source: "ONLINE",
      holdExpiresAt: { lt: now },
      ...(options.packageId !== undefined && { packageId: options.packageId }),
    },
    select: { id: true, payment: { select: { paymentId: true } } },
    take: options.limit ?? 200,
    orderBy: { holdExpiresAt: "asc" },
  });

  const slugs = new Set<string>();
  const parked: string[] = [];

  for (const { id, payment } of expired) {
    const spOrderId = payment?.paymentId;
    if (spOrderId) {
      if (!options.verifyGatewayPayment) continue;

      let result: "PAID" | "NOT_PAID";
      try {
        result = await options.verifyGatewayPayment(spOrderId);
      } catch {
        continue; // can't tell — never release on uncertainty
      }

      if (result === "PAID") {
        const held = await prisma.order.updateMany({
          where: { id, status: "PENDING" },
          data: { holdExpiresAt: null },
        });
        if (held.count === 1) {
          parked.push(id);
          await audit({
            actor: SYSTEM.sweep,
            action: "payment.paid_no_callback",
            entityType: "payment",
            entityId: id,
            summary: `NEEDS CONFIRMING: ShurjoPay reports ${spOrderId} as paid but no callback arrived; slot kept`,
          });
        }
        continue;
      }
    }

    const slug = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          packageId: true,
          qty: true,
          eventId: true,
          event: { select: { slug: true } },
        },
      });
      if (!order) return null;

      // Re-check every condition inside the conditional update: the payment
      // callback or an admin may have moved this order since the findMany.
      const released = await tx.order.updateMany({
        where: {
          id,
          status: "PENDING",
          source: "ONLINE",
          holdExpiresAt: { lt: now },
          // Never release an order whose payment already went through.
          NOT: { payment: { is: { status: "PAID" } } },
        },
        data: { status: "CANCELLED" }, // keep holdExpiresAt → reclaimable
      });
      if (released.count === 0) return null;

      await tx.package.update({
        where: { id: order.packageId },
        data: { usedSlots: { decrement: order.qty } },
      });
      await tx.payment.updateMany({
        where: { orderId: id, status: "PENDING" },
        data: { status: "FAILED" },
      });

      return { slug: order.event.slug, eventId: order.eventId, qty: order.qty };
    });

    if (slug) {
      slugs.add(slug.slug);
      await audit({
        actor: SYSTEM.sweep,
        action: "order.hold_expired",
        entityType: "order",
        entityId: id,
        eventId: slug.eventId,
        summary: `Unpaid for over ${SLOT_HOLD_HOURS} hour${SLOT_HOLD_HOURS === 1 ? "" : "s"}: order cancelled, ${slug.qty} slot${slug.qty === 1 ? "" : "s"} released`,
      });
    }
  }

  return { slugs: [...slugs], parked };
}

/**
 * Bring a system-released order back to PENDING with a fresh hold, if its
 * slots are still free. Used when the customer retries payment.
 */
export async function reclaimReleasedOrder(
  orderId: string,
): Promise<"RECLAIMED" | "NO_SLOTS" | "NOT_RECLAIMABLE"> {
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { packageId: true, qty: true },
      });
      if (!order) return "NOT_RECLAIMABLE";

      const reopened = await tx.order.updateMany({
        where: {
          id: orderId,
          status: "CANCELLED",
          source: "ONLINE",
          holdExpiresAt: { not: null }, // system-released, not admin-cancelled
        },
        data: { status: "PENDING", holdExpiresAt: newHoldExpiry() },
      });
      if (reopened.count === 0) return "NOT_RECLAIMABLE";

      if (!(await claimSlots(tx, order.packageId, order.qty))) {
        throw new Error("NO_SLOTS"); // roll back the reopen
      }

      await tx.payment.updateMany({
        where: { orderId, status: "FAILED" },
        data: { status: "PENDING" },
      });

      return "RECLAIMED";
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_SLOTS") return "NO_SLOTS";
    throw err;
  }
}

export type ConfirmPaidOutcome =
  | "CONFIRMED" // order confirmed, go on to coupon + notifications
  | "ALREADY_PAID" // another callback already handled it — do nothing
  | "PAID_BUT_SOLD_OUT" // hold was released and the package filled up → refund
  | "PAID_BUT_CANCELLED"; // an admin cancelled the order → refund

/**
 * Mark a verified-successful payment PAID and confirm its order.
 *
 * Every step is conditional, so concurrent callbacks for the same payment
 * (redirect + IPN, a refresh) can't both pass: only the call that actually
 * flips the payment to PAID gets "CONFIRMED" and should send notifications.
 */
export async function confirmPaidOrder(args: {
  paymentId: string;
  orderId: string;
  paymentData: Omit<Prisma.PaymentUpdateManyMutationInput, "status">;
}): Promise<ConfirmPaidOutcome> {
  const { paymentId, orderId, paymentData } = args;

  return prisma.$transaction(async (tx) => {
    const paid = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "PAID" } },
      data: { ...paymentData, status: "PAID" },
    });
    if (paid.count === 0) return "ALREADY_PAID";

    // Normal case: the order is still holding its slot.
    const confirmed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CONFIRMED", holdExpiresAt: null },
    });
    if (confirmed.count === 1) return "CONFIRMED";

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, holdExpiresAt: true, packageId: true, qty: true },
    });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "CONFIRMED") return "CONFIRMED";

    // CANCELLED by an admin (holdExpiresAt null) is final.
    if (order.holdExpiresAt === null) return "PAID_BUT_CANCELLED";

    // Released by the system (expired / earlier decline) but the customer paid
    // anyway: take the slot back if it is still free.
    if (!(await claimSlots(tx, order.packageId, order.qty))) {
      return "PAID_BUT_SOLD_OUT";
    }
    const reopened = await tx.order.updateMany({
      where: { id: orderId, status: "CANCELLED" },
      data: { status: "CONFIRMED", holdExpiresAt: null },
    });
    if (reopened.count === 0) throw new Error("ORDER_STATE_CHANGED");
    return "CONFIRMED";
  });
}
