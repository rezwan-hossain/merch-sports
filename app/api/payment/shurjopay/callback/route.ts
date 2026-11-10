// app/api/payment/shurjopay/callback/route.ts
//
// ⑥ Customer back to us (return_url) → ⑦ Verify Payment → ⑧ Redirect to our page.
// Steps ①–⑧ are listed at the top of lib/payment/shurjopay/index.ts.
// The order_id in the URL is never trusted — ⑦ asks ShurjoPay directly.
import { prisma } from "@/lib/prisma";
import { getPaymentStatusMessage, SP_CODE } from "@/lib/payment/shurjopay";
import { NextRequest, NextResponse, after } from "next/server";

import { verifyPayment } from "@/lib/payment-verify";
import { publicOrigin } from "@/lib/payment-config";
import { runPostPaymentSteps } from "@/lib/order-confirmation";
import { getRequestId } from "@/utils/requestUtils";
import { logger } from "@/lib/logger";
import { audit, SYSTEM } from "@/lib/audit";

// ShurjoPay sends amounts as strings like "1299.0000".
const fmtAmount = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(v);
};
import { confirmPaidOrder, releaseHold } from "@/lib/slot-hold";
import { revalidateTag } from "next/cache";

// ⑥ Customer back to us — ShurjoPay redirects the browser here with ?order_id=<sp_order_id>
export async function GET(request: NextRequest) {
  const requestId = await getRequestId();
  const start = Date.now();

  const { searchParams } = new URL(request.url);

  // ✅ Check multiple possible parameter names
  const spOrderId =
    searchParams.get("order_id") ||
    searchParams.get("sp_order_id") ||
    searchParams.get("orderId");

  // Public site address, not request.url — behind a proxy request.url can be
  // http://localhost:3000, which would strand the customer after paying.
  const origin = publicOrigin(request.url);

  console.log("📥 ShurjoPay callback received:", {
    spOrderId,
    allParams: Object.fromEntries(searchParams.entries()),
  });

  const log = logger.child({
    requestId,
    action: "shurjopay:callback",
    spOrderId,
  });

  log.info(
    {
      params: {
        order_id: searchParams.get("order_id"),
        sp_order_id: searchParams.get("sp_order_id"),
      },
    },
    "payment:callback_received",
  );

  if (!spOrderId) {
    console.error("❌ No order_id in callback");
    log.error("payment:callback — missing order_id param");

    return NextResponse.redirect(
      `${origin}/payment/failed?reason=missing_order`,
    );
  }

  try {
    log.info(
      { externalApi: { service: "shurjopay", operation: "verify" }, spOrderId },
      "external_api:start",
    );
    // ─── ⑦ Verify payment with ShurjoPay ────────────
    console.log("🔍 Verifying payment with ShurjoPay...");

    const verifyStart = Date.now();

    // Retries a failed/empty answer, caps each attempt, and picks the SUCCESS
    // entry when ShurjoPay returns several (see lib/payment-verify.ts).
    const verified = await verifyPayment(spOrderId, {
      attempts: 3,
      timeoutMs: 10_000,
      onRetry: (n, why) =>
        log.warn({ attempt: n, why, spOrderId }, "external_api:verify_retry"),
    });

    log.info(
      {
        externalApi: {
          service: "shurjopay",
          operation: "verify",
          durationMs: Date.now() - verifyStart,
        },
        state: verified.state,
        reason: verified.state === "UNSURE" ? verified.reason : undefined,
      },
      "external_api:verify_done",
    );

    // Couldn't get a definite answer (ShurjoPay down / empty). The customer
    // may well have paid, so never show "failed": keep the order pending with
    // its slot, and let the "confirming" page + background reconciler settle it.
    if (verified.state === "UNSURE" && verified.reason !== "unknown_code") {
      const pendingPayment = await prisma.payment.findFirst({
        where: { paymentId: spOrderId },
        select: { orderId: true },
      });
      log.warn(
        { orderId: pendingPayment?.orderId, reason: verified.reason },
        "payment:unconfirmed — sent to processing page",
      );
      return NextResponse.redirect(
        pendingPayment
          ? `${origin}/payment/processing?orderId=${pendingPayment.orderId}`
          : `${origin}/payment/failed?reason=verification_error`,
      );
    }

    const paymentInfo = verified.item!;

    // ✅ CRITICAL: Log sp_code which is the ONLY reliable field
    console.log("📋 Payment verification result:", {
      sp_code: paymentInfo.sp_code,
      sp_code_type: typeof paymentInfo.sp_code,
      sp_message: paymentInfo.sp_message,
      method: paymentInfo.method,
      amount: paymentInfo.amount,
      received_amount: paymentInfo.received_amount,
      order_id: paymentInfo.order_id,
      value1: paymentInfo.value1,
      status_message: getPaymentStatusMessage(paymentInfo),
    });

    // ─── Find payment in DB ─────────────────────────
    const dbStart = Date.now();

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { paymentId: spOrderId },
          { orderId: paymentInfo.value1 },
          // ✅ Also check customer_order_id if it exists
          ...(paymentInfo.customer_order_id
            ? [{ orderId: paymentInfo.customer_order_id }]
            : []),
        ],
      },
      include: { order: true },
    });

    const dbDuration = Date.now() - dbStart;

    if (!payment) {
      log.error(
        {
          db: {
            model: "Payment",
            operation: "findFirst",
            durationMs: dbDuration,
          },
          spOrderId,
          value1: paymentInfo.value1,
        },
        "db:not_found",
      );
      console.error("❌ Payment not found in DB:", {
        spOrderId,
        value1: paymentInfo.value1,
      });
      return NextResponse.redirect(
        `${origin}/payment/failed?reason=payment_not_found`,
      );
    }

    log.info(
      {
        db: {
          model: "Payment",
          operation: "findFirst",
          durationMs: dbDuration,
        },
        paymentId: payment.id,
        orderId: payment.orderId,
      },
      "db:success",
    );
    console.log("📦 Found payment:", payment.id, "for order:", payment.orderId);

    const spCode = Number(paymentInfo.sp_code);

    // ✅ Idempotency check
    if (payment.status === "PAID") {
      // A *different* gateway session also succeeded for an order that was
      // already paid (e.g. two tabs, or retry while the old tab was open):
      // the customer was charged twice.
      if (
        spCode === SP_CODE.SUCCESS &&
        payment.paymentId &&
        payment.paymentId !== spOrderId
      ) {
        log.error(
          {
            paymentId: payment.id,
            orderId: payment.orderId,
            keptSpOrderId: payment.paymentId,
            duplicateSpOrderId: spOrderId,
            amount: paymentInfo.amount,
          },
          "payment:REFUND_REQUIRED — second successful payment for a paid order",
        );
        await audit({
          actor: SYSTEM.shurjopay,
          action: "payment.duplicate",
          entityType: "payment",
          entityId: payment.orderId,
          eventId: payment.order.eventId,
          summary: `REFUND NEEDED: second payment ${spOrderId} (৳${fmtAmount(paymentInfo.amount)}) succeeded for an order already paid via ${payment.paymentId}`,
        });
      } else {
        log.warn(
          { paymentId: payment.id, orderId: payment.orderId },
          "payment:duplicate_callback — already PAID, redirecting",
        );
      }

      // Paid but the order holds no slot (expired + sold out, or admin
      // cancelled) → refund case, never the success page.
      if (payment.order.status !== "CONFIRMED") {
        return NextResponse.redirect(
          `${origin}/payment/failed?orderId=${payment.orderId}&reason=paid_no_slot`,
        );
      }

      console.log("ℹ️ Payment already PAID, redirecting to success");
      return NextResponse.redirect(
        `${origin}/payment/success?orderId=${payment.orderId}`,
      );
    }

    // A callback from an older gateway session (the customer retried and got a
    // new session) must not fail/release the order while the newer session
    // may still be paid. Success from an old session is still honoured below.
    const isStaleSession =
      !!payment.paymentId && payment.paymentId !== spOrderId;

    // ─── Check payment status using sp_code (per documentation) ───────

    console.log("📊 Payment status check:", {
      sp_code: spCode,
      is_success: spCode === SP_CODE.SUCCESS,
      is_cancelled: spCode === SP_CODE.CANCELLED_BY_CUSTOMER,
      is_declined: spCode === SP_CODE.DECLINED_BY_BANK,
    });

    // ⑧ From here on: act on ⑦'s sp_code, then redirect the customer to our page.
    // ✅ SUCCESS: sp_code === 1000
    if (spCode === SP_CODE.SUCCESS) {
      log.info({ spCode, orderId: payment.orderId }, "payment:success");

      console.log("✅ Payment SUCCESS (sp_code=1000) — updating DB...");

      // Never confirm on a payment that doesn't match what we charged.
      const paidAmount = Number(paymentInfo.amount);
      const amountMismatch =
        Number.isFinite(paidAmount) && paidAmount < payment.amount;
      const orderMismatch =
        !!paymentInfo.value1 && paymentInfo.value1 !== payment.orderId;

      if (!Number.isFinite(paidAmount)) {
        log.warn({ amount: paymentInfo.amount }, "payment:amount_missing");
      }

      if (amountMismatch || orderMismatch) {
        log.error(
          {
            paymentId: payment.id,
            orderId: payment.orderId,
            spOrderId,
            expectedAmount: payment.amount,
            paidAmount: paymentInfo.amount,
            value1: paymentInfo.value1,
          },
          "payment:REVIEW_REQUIRED — amount/order mismatch, not confirming",
        );
        await audit({
          actor: SYSTEM.shurjopay,
          action: "payment.amount_mismatch",
          entityType: "payment",
          entityId: payment.orderId,
          eventId: payment.order.eventId,
          summary: `NEEDS REVIEW: ${spOrderId} reported ৳${fmtAmount(paymentInfo.amount)}, expected ৳${payment.amount}${orderMismatch ? ` (for order ${paymentInfo.value1})` : ""}. Not confirmed.`,
          changes: { amount: [payment.amount, paymentInfo.amount] },
        });
        // Keep the slot held for manual review; payment stays unpaid here.
        await prisma.order.updateMany({
          where: { id: payment.orderId, status: "PENDING" },
          data: { holdExpiresAt: null },
        });
        return NextResponse.redirect(
          `${origin}/payment/failed?orderId=${payment.orderId}&reason=unknown_status`,
        );
      }

      const txStart = Date.now();

      // Every step is conditional, so concurrent callbacks for the same
      // payment (redirect + IPN, refresh) can't both pass: only the one that
      // actually flips the payment to PAID goes on to confirm and notify.
      log.info({ orderId: payment.orderId }, "tx:payment → PAID, order → CONFIRMED");

      const outcome = await confirmPaidOrder({
        paymentId: payment.id,
        orderId: payment.orderId,
        paymentData: {
          // ✅ Use order_id from verification as transaction reference
          transactionId: paymentInfo.order_id || spOrderId,
          paymentMethod: paymentInfo.method || "shurjopay",
          paymentGateway: "shurjopay",
          paymentId: spOrderId,
        },
      });

      log.info(
        {
          orderId: payment.orderId,
          outcome,
          db: { operation: "transaction", durationMs: Date.now() - txStart },
        },
        "db:transaction_success",
      );

      if (outcome === "ALREADY_PAID") {
        log.warn(
          { paymentId: payment.id, orderId: payment.orderId },
          "payment:duplicate_callback — lost the race, skipping notifications",
        );
        return NextResponse.redirect(
          `${origin}/payment/success?orderId=${payment.orderId}`,
        );
      }

      if (outcome === "PAID_BUT_SOLD_OUT" || outcome === "PAID_BUT_CANCELLED") {
        // Money was taken but there is no slot for this order. Needs a
        // manual refund — this log line is the alert.
        log.error(
          {
            paymentId: payment.id,
            orderId: payment.orderId,
            spOrderId,
            amount: paymentInfo.amount,
            outcome,
          },
          "payment:REFUND_REQUIRED — paid for an order with no slot",
        );
        await audit({
          actor: SYSTEM.shurjopay,
          action: "payment.paid_no_slot",
          entityType: "payment",
          entityId: payment.orderId,
          eventId: payment.order.eventId,
          summary: `REFUND NEEDED: ${spOrderId} paid ৳${fmtAmount(paymentInfo.amount)} but the order has no slot (${outcome === "PAID_BUT_SOLD_OUT" ? "hold expired and package sold out" : "order cancelled by an admin"})`,
        });
        return NextResponse.redirect(
          `${origin}/payment/failed?orderId=${payment.orderId}&reason=paid_no_slot`,
        );
      }

      // Coupon usage + email + SMS run after the customer has been redirected
      // (Next's after()), so they aren't kept waiting on the SMS/email APIs.
      const confirmedOrderId = payment.orderId;
      const transactionId = paymentInfo.order_id || spOrderId;
      const paymentMethod = paymentInfo.method || undefined;
      after(async () => {
        try {
          await runPostPaymentSteps({
            orderId: confirmedOrderId,
            transactionId,
            paymentMethod,
            log,
          });
        } finally {
          await log.flush();
        }
      });

      console.log("✅ Order confirmed, redirecting to success");

      await audit({
        actor: SYSTEM.shurjopay,
        action: "payment.confirmed",
        entityType: "payment",
        entityId: payment.orderId,
        eventId: payment.order.eventId,
        summary: `Payment ${spOrderId} confirmed · ৳${fmtAmount(paymentInfo.amount)}${paymentInfo.method ? ` via ${paymentInfo.method}` : ""}`,
        changes: { status: [payment.status, "PAID"], order: [payment.order.status, "CONFIRMED"] },
      });

      log.info(
        { orderId: payment.orderId, durationMs: Date.now() - start },
        "action:success",
      );
      return NextResponse.redirect(
        `${origin}/payment/success?orderId=${payment.orderId}`,
      );
    }

    // ✅ CANCELLED: sp_code === 1002
    if (spCode === SP_CODE.CANCELLED_BY_CUSTOMER) {
      log.warn({ spCode, orderId: payment.orderId }, "payment:cancelled");

      console.log("⚠️ Payment CANCELLED (sp_code=1002)");

      if (isStaleSession) {
        log.warn(
          { orderId: payment.orderId, spOrderId, currentSpOrderId: payment.paymentId },
          "payment:stale_session_callback — ignoring, newer session in progress",
        );
        return NextResponse.redirect(
          `${origin}/payment/failed?orderId=${payment.orderId}&reason=cancelled`,
        );
      }
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          paymentMethod: paymentInfo.method || "shurjopay",
          paymentGateway: "shurjopay",
        },
      });
      log.info({ orderId: payment.orderId }, "db:payment_updated → FAILED");

      await audit({
        actor: SYSTEM.shurjopay,
        action: "payment.cancelled",
        entityType: "payment",
        entityId: payment.orderId,
        eventId: payment.order.eventId,
        summary: `Customer cancelled payment ${spOrderId}; slot released`,
      });

      // Give the slot back now instead of waiting for the hold to expire.
      // The order stays reclaimable if the customer retries.
      try {
        const releasedSlug = await releaseHold(payment.orderId);
        if (releasedSlug) {
          revalidateTag(`event-${releasedSlug}`, "max");
          log.info({ orderId: payment.orderId }, "slots:hold_released");
        }
      } catch (err) {
        log.error({ err, orderId: payment.orderId }, "slots:release_failed");
      }

      return NextResponse.redirect(
        `${origin}/payment/failed?orderId=${payment.orderId}&reason=cancelled`,
      );
    }

    // ✅ DECLINED: sp_code === 1001
    if (spCode === SP_CODE.DECLINED_BY_BANK) {
      log.error(
        { spCode, orderId: payment.orderId },
        "payment:declined — bank declined",
      );

      console.log("❌ Payment DECLINED by bank (sp_code=1001)");

      if (isStaleSession) {
        log.warn(
          { orderId: payment.orderId, spOrderId, currentSpOrderId: payment.paymentId },
          "payment:stale_session_callback — ignoring, newer session in progress",
        );
        return NextResponse.redirect(
          `${origin}/payment/failed?orderId=${payment.orderId}&reason=declined`,
        );
      }
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          paymentMethod: paymentInfo.method || "shurjopay",
          paymentGateway: "shurjopay",
        },
      });

      log.info({ orderId: payment.orderId }, "db:payment_updated → FAILED");

      await audit({
        actor: SYSTEM.shurjopay,
        action: "payment.declined",
        entityType: "payment",
        entityId: payment.orderId,
        eventId: payment.order.eventId,
        summary: `Bank declined payment ${spOrderId}; slot released`,
      });

      // Give the slot back now instead of waiting for the hold to expire.
      // The order stays reclaimable if the customer retries.
      try {
        const releasedSlug = await releaseHold(payment.orderId);
        if (releasedSlug) {
          revalidateTag(`event-${releasedSlug}`, "max");
          log.info({ orderId: payment.orderId }, "slots:hold_released");
        }
      } catch (err) {
        log.error({ err, orderId: payment.orderId }, "slots:release_failed");
      }

      return NextResponse.redirect(
        `${origin}/payment/failed?orderId=${payment.orderId}&reason=declined`,
      );
    }

    // ─── Unknown sp_code ────────────────────────────
    console.error("❓ Unknown sp_code:", {
      sp_code: spCode,
      sp_message: paymentInfo.sp_message,
    });

    log.error(
      { spCode, spMessage: paymentInfo.sp_message, orderId: payment.orderId },
      "payment:unknown_sp_code — keeping PENDING for manual review",
    );

    if (isStaleSession) {
      log.warn(
        { orderId: payment.orderId, spOrderId, currentSpOrderId: payment.paymentId },
        "payment:stale_session_callback — unknown code, not touching newer session",
      );
      return NextResponse.redirect(
        `${origin}/payment/failed?orderId=${payment.orderId}&reason=unknown_status`,
      );
    }

    await audit({
      actor: SYSTEM.shurjopay,
      action: "payment.unknown_status",
      entityType: "payment",
      entityId: payment.orderId,
      eventId: payment.order.eventId,
      summary: `ShurjoPay ${spOrderId} returned status ${spCode} (${paymentInfo.sp_message || "no message"}); order kept pending and re-checked automatically`,
    });

    // Keep as PENDING for manual review
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        paymentId: spOrderId,
      },
    });

    // The order keeps its normal hold; the background reconciler keeps asking
    // ShurjoPay and confirms it the moment the payment shows as successful.

    log.info({ orderId: payment.orderId }, "db:payment_updated → PENDING");

    return NextResponse.redirect(
      `${origin}/payment/processing?orderId=${payment.orderId}`,
    );
  } catch (error: any) {
    console.error("❌ Callback error:", error?.message);

    log.error(
      { err: error, durationMs: Date.now() - start },
      "action:error — unhandled",
    );
    return NextResponse.redirect(
      `${origin}/payment/failed?reason=server_error`,
    );
  } finally {
    await log.flush();
  }
}

// ⑥ as a POST: a form-post redirect (or a notification). ShurjoPay may send the
// id as JSON, as a form, or only in the query string — accept all, then run GET.
export async function POST(request: NextRequest) {
  const requestId = await getRequestId();

  const log = logger.child({
    requestId,
    action: "shurjopay:callback:post",
  });

  let bodyOrderId: string | null = null;
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = await request.json();
      bodyOrderId = body?.order_id || body?.sp_order_id || null;
    } else if (
      type.includes("application/x-www-form-urlencoded") ||
      type.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      const v = form.get("order_id") ?? form.get("sp_order_id");
      bodyOrderId = typeof v === "string" && v ? v : null;
    }
  } catch (err) {
    log.warn({ err }, "payment:post_callback_body_unreadable");
  }

  log.info(
    { hasBodyOrderId: !!bodyOrderId },
    "payment:post_callback_received",
  );
  await log.flush();

  const url = new URL(request.url);
  if (bodyOrderId) url.searchParams.set("order_id", bodyOrderId);
  return GET(new NextRequest(url, { method: "GET", headers: request.headers }));
}
