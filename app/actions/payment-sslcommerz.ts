"use server";

// "Pay with SSLCommerz" button → this action → SSLCommerz payment page.
// Steps ① ② of SSLCommerz's diagram (Requests for Session → Return Session ID);
// the checkout page then does ③ (redirect to the payment page).
// Same safety steps as initiateShurjoPayPayment (app/actions/payment.ts).
// Overview: lib/payment/sslcommerz/README.md / flow.png
//
// ⚠️ Only export the action itself: every export of a "use server" file is a
// public endpoint anyone can call.

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRequestId } from "@/utils/requestUtils";
import { newHoldExpiry, reclaimReleasedOrder } from "@/lib/slot-hold";
import { reconcileOrder } from "@/lib/payment-reconcile";
import { reportGatewayFailure } from "@/lib/payment-gateway-alert";
import { SSLCOMMERZ, getSiteUrl, isSslCommerzEnabled } from "@/lib/payment/sslcommerz/config";
import { newTranId, startPayment } from "@/lib/payment/sslcommerz/api";

type Result = { success: boolean; error: string; checkoutUrl: string };

export async function initiateSslCommerzPayment(input: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): Promise<Result> {
  const { orderId } = input;
  const failed = (error: string): Result => ({ success: false, error, checkoutUrl: "" });
  const log = logger.child({
    requestId: await getRequestId(),
    action: "initiateSslCommerzPayment",
    orderId,
  });

  try {
    // ── Step 1: is SSLCommerz switched on and set up safely? ─────────────
    if (!isSslCommerzEnabled()) {
      return failed("This payment method isn't available right now. Please choose another one.");
    }
    const { siteUrl, error: siteError } = getSiteUrl();
    if (siteError) {
      log.error({ siteError }, "sslcommerz:bad_config");
      await reportGatewayFailure({ stage: "config", message: siteError, orderId, gateway: "SSLCommerz" });
      return failed("Online payment is temporarily unavailable. Please try again later.");
    }

    // ── Step 2: load the order ────────────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: String(orderId) },
      include: { payment: true, package: true, event: true },
    });
    if (!order?.payment) return failed("Order not found");
    if (order.payment.status === "PAID") return failed("Order is already paid");

    // ── Step 3: never charge twice ────────────────────────────────────────
    // If an earlier attempt (on either gateway) was actually paid, confirm
    // that one instead of opening a new payment.
    if (order.payment.paymentId) {
      const earlier = await reconcileOrder(order.id, { log });
      if (earlier === "CONFIRMED" || earlier === "ALREADY_PAID") {
        return { success: true, error: "", checkoutUrl: `/payment/success?orderId=${order.id}` };
      }
      if (earlier === "PAID_NO_SLOT" || earlier === "NEEDS_REVIEW") {
        return failed(
          "We already received a payment for this order and are checking it. Please don't pay again — contact support with your order ID.",
        );
      }
      if (earlier === "GATEWAY_ERROR") {
        return failed(
          "We couldn't check your previous payment attempt just now. Please try again in a minute so you aren't charged twice.",
        );
      }
      // NOT_PAID / NO_SESSION → safe to start a new payment.
    }

    // ── Step 4: keep the runner's slot while they pay ────────────────────
    const stillPending = await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING", source: "ONLINE" },
      data: { holdExpiresAt: newHoldExpiry() },
    });
    if (stillPending.count === 0) {
      const now = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
      if (now?.status === "CONFIRMED") return failed("Order is already paid");
      if (now?.status === "CANCELLED") {
        // The hold ran out earlier — take the slot back if one is still free.
        const reclaim = await reclaimReleasedOrder(order.id);
        if (reclaim === "NO_SLOTS") return failed("Sorry, your reservation expired and this package is now sold out.");
        if (reclaim === "NOT_RECLAIMABLE") return failed("This order was cancelled. Please place a new order.");
      }
    }

    // ── Step 5: ① Requests for Session → ② Return Session ID ──────────────
    const tranId = newTranId();
    const started = await startPayment({
      tranId,
      orderId: order.id,
      amount: order.payment.amount,
      siteUrl,
      productName: `${order.event.name} — ${order.package.name}`,
      quantity: order.qty,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
    });
    if (!started.ok) {
      log.error({ error: started.error }, "sslcommerz:start_failed");
      await reportGatewayFailure({
        stage: started.couldNotConnect ? "unreachable" : "create_payment",
        message: started.error,
        orderId: order.id,
        eventId: order.eventId,
        gateway: "SSLCommerz",
      });
      return failed("Payment gateway unavailable. Please try again.");
    }

    // ── Step 6: remember this attempt, then hand back the payment page ───
    // The callbacks and the reconciler find the order by this tran_id.
    // (The session id is only logged — handy when talking to SSLCommerz support.)
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { paymentId: tranId, paymentGateway: SSLCOMMERZ, paymentMethod: SSLCOMMERZ },
    });
    log.info({ tranId, sessionKey: started.sessionKey }, "sslcommerz:session_started");
    // The checkout page does ③: window.location.href = checkoutUrl
    return { success: true, error: "", checkoutUrl: started.paymentPageUrl };
  } catch (err) {
    log.error({ err }, "action:error");
    return failed("Failed to initiate payment. Please try again.");
  } finally {
    await log.flush();
  }
}
