// lib/payment/sslcommerz/callback-helpers.ts
//
// Small helpers shared by the four callback routes in
// app/api/payment/sslcommerz/{success,fail,cancel,ipn}/route.ts —
// steps ④ (IPN) and ⑥ (customer back to us) of SSLCommerz's diagram.

import { NextResponse, after, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logger, type ChildLogger } from "@/lib/logger";
import { getRequestId } from "@/utils/requestUtils";
import { publicOrigin } from "@/lib/payment-config";
import { releaseHold } from "@/lib/slot-hold";
import { audit } from "@/lib/audit";
import { getTransaction, isTranId } from "./api";
import { SSLCOMMERZ_SYSTEM, confirmSslCommerzPayment } from "./confirm-payment";

/** A logger for one callback request. Remember to `await log.flush()`. */
export async function callbackLogger(callback: string): Promise<ChildLogger> {
  return logger.child({ requestId: await getRequestId(), action: `sslcommerz:${callback}` });
}

/**
 * What SSLCommerz posted: our tran_id (null if missing / not one of ours) and
 * the val_id for the Validation API (⑤). Nothing else from the post is used.
 */
export async function readCallback(
  request: NextRequest,
): Promise<{ tranId: string | null; valId: string | null }> {
  try {
    const form = await request.formData(); // SSLCommerz posts a normal HTML form
    const tranId = String(form.get("tran_id") ?? "").trim().toUpperCase();
    const valId = String(form.get("val_id") ?? "").trim();
    return {
      tranId: isTranId(tranId) ? tranId : null,
      valId: /^[A-Za-z0-9]{1,64}$/.test(valId) ? valId : null,
    };
  } catch {
    return { tranId: null, valId: null };
  }
}

/** Send the browser to one of our pages. 303 turns SSLCommerz's POST into a GET. */
export function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(`${publicOrigin(request.url)}${path}`, 303);
}

/**
 * ⑤ Validate with SSLCommerz and confirm the order if it was paid. The
 * email/SMS is sent after the response, so the customer isn't kept waiting.
 */
export function confirmPayment(tranId: string, valId: string | null, log: ChildLogger) {
  return confirmSslCommerzPayment(tranId, {
    log,
    valId,
    sendConfirmation: (job) =>
      after(async () => {
        try {
          await job();
        } catch (err) {
          log.error({ err }, "post_payment:failed");
        } finally {
          await log.flush();
        }
      }),
  });
}

/**
 * Where to send the customer when the payment is settled one way or another.
 * Returns null when it's simply "not paid" — the caller decides what then.
 */
export function pageForResult(result: string, orderId: string | null): string | null {
  if (result === "CONFIRMED" || result === "ALREADY_PAID") return `/payment/success?orderId=${orderId}`;
  if (result === "PAID_NO_SLOT") return `/payment/failed?orderId=${orderId}&reason=paid_no_slot`;
  if (result === "NEEDS_REVIEW") {
    return orderId ? `/payment/failed?orderId=${orderId}&reason=unknown_status` : "/payment/failed?reason=payment_not_found";
  }
  return null;
}

/**
 * The customer cancelled, or the payment failed. Free their slot right away —
 * but only when SSLCommerz itself says the attempt ended, and only for the
 * order's current attempt (a cancel from an older attempt must not touch a
 * newer one the customer may be paying right now).
 */
export async function releaseSlotIfEnded(tranId: string, why: "cancel" | "fail", log: ChildLogger) {
  const check = await getTransaction(tranId);
  if (check.status !== "FAILED") {
    log.info({ status: check.status }, "slot_kept — SSLCommerz doesn't say this attempt ended");
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { paymentId: tranId }, // only the CURRENT attempt has this tran_id
    select: { orderId: true, status: true, order: { select: { eventId: true } } },
  });
  if (!payment || payment.status !== "PENDING") return;

  const eventSlug = await releaseHold(payment.orderId);
  if (!eventSlug) return; // someone else changed the order first

  revalidateTag(`event-${eventSlug}`, "max"); // event page shows the freed slot
  await audit({
    actor: SSLCOMMERZ_SYSTEM,
    action: why === "cancel" ? "payment.cancelled" : "payment.declined",
    entityType: "payment",
    entityId: payment.orderId,
    eventId: payment.order.eventId,
    summary: `SSLCommerz ${tranId} ${check.transaction.status.toLowerCase()}; slot released`,
  });
  log.info({ orderId: payment.orderId }, "slot_released");
}
