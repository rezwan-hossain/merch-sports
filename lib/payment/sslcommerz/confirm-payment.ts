// lib/payment/sslcommerz/confirm-payment.ts
//
// "Was this SSLCommerz payment paid? If yes, confirm the order."
// This is step ⑤ of SSLCommerz's diagram (Request for Validation) plus what we
// do with the answer. See README.md / flow.png.
//
// Every SSLCommerz path ends up here: the success page callback, the IPN, the
// 5-minute reconciler and the "confirming your payment…" page. It is safe to
// call many times for the same payment — only the first call confirms the
// order and sends the email/SMS; the rest get "ALREADY_PAID".

import { prisma } from "@/lib/prisma";
import type { ChildLogger } from "@/lib/logger";
import { confirmPaidOrder } from "@/lib/slot-hold";
import { runPostPaymentSteps } from "@/lib/order-confirmation";
import { audit, type AuditActor } from "@/lib/audit";
import type { ReconcileResult } from "@/lib/payment-reconcile";
import { SSLCOMMERZ } from "./config";
import { findProblem, getTransaction, validatePayment, type TransactionCheck } from "./api";

export const SSLCOMMERZ_SYSTEM: AuditActor = { id: null, label: "System · SSLCommerz" };

type Options = {
  log: ChildLogger;
  /** The val_id SSLCommerz posted with the IPN / success redirect, if any. */
  valId?: string | null;
  /** Who to show in the audit log (default: System · SSLCommerz). */
  actor?: AuditActor;
  /**
   * How to send the confirmation email/SMS:
   *  - "now" (default): wait for it to finish
   *  - a function: hand it the job to run later (callbacks pass Next's
   *    `after`, so the customer isn't kept waiting on the redirect)
   */
  sendConfirmation?: "now" | ((job: () => Promise<void>) => void);
};

export async function confirmSslCommerzPayment(
  tranId: string,
  { log, valId, actor = SSLCOMMERZ_SYSTEM, sendConfirmation = "now" }: Options,
): Promise<{ result: ReconcileResult; orderId: string | null }> {
  // ── Step 1: ask SSLCommerz (⑤ Request for Validation) ───────────────────
  const check = await askSslCommerz(tranId, valId);

  // ── Step 2: find our order ───────────────────────────────────────────────
  // Normally Payment.paymentId is this tran_id. If the customer started a newer
  // attempt since, fall back to the order id SSLCommerz sends back (value_a).
  const payment = await prisma.payment.findUnique({
    where: { paymentId: tranId },
    select: { orderId: true },
  });
  const orderIdFromSslCommerz = check.status === "UNKNOWN" ? undefined : check.transaction?.value_a;
  const orderId = payment?.orderId ?? orderIdFromSslCommerz ?? null;

  if (check.status === "UNKNOWN") {
    log.warn({ tranId, error: check.error }, "sslcommerz:no_answer");
    return { result: "GATEWAY_ERROR", orderId };
  }
  if (check.status !== "PAID") {
    return { result: "NOT_PAID", orderId };
  }
  if (!orderId) {
    log.error({ tranId }, "sslcommerz:paid_but_order_unknown");
    return { result: "NEEDS_REVIEW", orderId: null };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      eventId: true,
      status: true,
      payment: { select: { id: true, status: true, amount: true, paymentId: true } },
    },
  });
  if (!order?.payment) {
    log.error({ tranId, orderId }, "sslcommerz:paid_but_order_missing");
    return { result: "NEEDS_REVIEW", orderId };
  }

  const paid = check.transaction;
  const amount = Number(paid.amount).toLocaleString("en-IN");

  // ── Step 3: already paid? ────────────────────────────────────────────────
  if (order.payment.status === "PAID") {
    // Paid through a DIFFERENT attempt too → the customer paid twice.
    if (order.payment.paymentId && order.payment.paymentId !== tranId) {
      await auditOnce(orderId, {
        actor,
        action: "payment.duplicate",
        eventId: order.eventId,
        summary: `REFUND NEEDED: second payment ${tranId} (৳${amount}) succeeded on SSLCommerz for an order already paid via ${order.payment.paymentId}`,
      });
      log.error({ tranId, orderId }, "sslcommerz:REFUND_REQUIRED — paid twice");
    }
    return { result: "ALREADY_PAID", orderId };
  }

  // ── Step 4: right amount, right order? ───────────────────────────────────
  const problem = findProblem(paid, { id: orderId, amount: order.payment.amount });
  if (problem) {
    // Don't confirm. Keep the slot (no expiry) so an admin can decide.
    await prisma.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { holdExpiresAt: null },
    });
    await auditOnce(orderId, {
      actor,
      action: "payment.amount_mismatch", // shows in admin → Payment issues
      eventId: order.eventId,
      summary: `NEEDS REVIEW: SSLCommerz ${tranId} — ${problem}. Not confirmed.`,
      changes: { amount: [order.payment.amount, Number(paid.amount)] },
    });
    log.error({ tranId, orderId, problem }, "sslcommerz:needs_review");
    return { result: "NEEDS_REVIEW", orderId };
  }

  // ── Step 5: confirm (race-safe: only one caller can win) ─────────────────
  const transactionId = paid.bank_tran_id || paid.val_id || tranId;
  const paymentMethod = paid.card_type || undefined;
  const outcome = await confirmPaidOrder({
    paymentId: order.payment.id,
    orderId,
    paymentData: {
      transactionId,
      paymentMethod: paymentMethod ?? SSLCOMMERZ,
      paymentGateway: SSLCOMMERZ,
      paymentId: tranId,
    },
  });

  if (outcome === "ALREADY_PAID") {
    return { result: "ALREADY_PAID", orderId }; // another call confirmed it first
  }
  if (outcome === "PAID_BUT_SOLD_OUT" || outcome === "PAID_BUT_CANCELLED") {
    await audit({
      actor,
      action: "payment.paid_no_slot", // shows in admin → Payment issues
      entityType: "payment",
      entityId: orderId,
      eventId: order.eventId,
      summary: `REFUND NEEDED: SSLCommerz ${tranId} paid ৳${amount} but the order has no slot (${outcome === "PAID_BUT_SOLD_OUT" ? "hold expired and package sold out" : "order cancelled by an admin"})`,
    });
    log.error({ tranId, orderId, outcome }, "sslcommerz:REFUND_REQUIRED — no slot");
    return { result: "PAID_NO_SLOT", orderId };
  }

  // ── Step 6: confirmed! Record it and send the email/SMS ──────────────────
  await audit({
    actor,
    action: "payment.confirmed",
    entityType: "payment",
    entityId: orderId,
    eventId: order.eventId,
    summary: `Payment ${tranId} confirmed via SSLCommerz · ৳${amount}${paymentMethod ? ` via ${paymentMethod}` : ""}`,
    changes: { status: [order.payment.status, "PAID"], order: [order.status, "CONFIRMED"] },
  });

  const sendEmailAndSms = () => runPostPaymentSteps({ orderId, transactionId, paymentMethod, log });
  if (sendConfirmation === "now") await sendEmailAndSms();
  else sendConfirmation(sendEmailAndSms);

  log.info({ tranId, orderId }, "sslcommerz:confirmed");
  return { result: "CONFIRMED", orderId };
}

/** Write an audit entry only if this order doesn't already have one with this action. */
async function auditOnce(
  orderId: string,
  entry: Omit<Parameters<typeof audit>[0], "entityType" | "entityId">,
) {
  const exists = await prisma.auditLog.findFirst({
    where: { entityId: orderId, action: entry.action },
    select: { id: true },
  });
  if (!exists) await audit({ ...entry, entityType: "payment", entityId: orderId });
}

/**
 * ⑤ Request for Validation. With a val_id (IPN / success redirect) we use the
 * Validation API, exactly as in SSLCommerz's diagram — but only trust it if it
 * says PAID for THIS tran_id (a val_id is posted to us, so it could be fake or
 * belong to another payment). Otherwise, and when there is no val_id
 * (reconciler, "confirming…" page), we look the payment up by our tran_id.
 */
async function askSslCommerz(tranId: string, valId?: string | null): Promise<TransactionCheck> {
  if (valId) {
    const validated = await validatePayment(valId);
    if (validated.status === "PAID" && validated.transaction.tran_id === tranId) {
      return validated;
    }
  }
  return getTransaction(tranId);
}
