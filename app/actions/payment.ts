"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getShurjoPayToken, createShurjoPayPayment } from "@/lib/payment/shurjopay";
import { getClientIp } from "@/lib/get-client-ip";
import { logger } from "@/lib/logger";
import { getRequestId } from "@/utils/requestUtils";
import { newHoldExpiry, reclaimReleasedOrder } from "@/lib/slot-hold";
import { checkPaymentConfig } from "@/lib/payment-config";
import { reconcileOrder } from "@/lib/payment-reconcile";
import { reportGatewayFailure } from "@/lib/payment-gateway-alert";
import { isAxiosError } from "axios";

export async function initiateShurjoPayPayment({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
}: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}) {
  // Auth check
  // const supabase = await createClient();
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();

  // if (!user) {
  //   return { success: false, error: "You must be logged in", checkoutUrl: "" };
  // }

  const requestId = await getRequestId();
  const start = Date.now();

  const log = logger.child({
    requestId,
    action: "initiateShurjoPayPayment",
    orderId,
  });

  log.info("action:start");

  try {
    // Refuse to take money we could never confirm (live ShurjoPay sending
    // customers back to localhost) — how paid orders end up stuck as pending.
    const config = checkPaymentConfig();
    if (config.block) {
      log.error({ configProblem: config.block }, "payment:config_invalid — refusing to start payment");
      await reportGatewayFailure({ stage: "config", message: config.block, orderId });
      return {
        success: false,
        error: "Online payment is temporarily unavailable. Please try again later.",
        checkoutUrl: "",
      };
    }

    // ✅ Get client IP at the start
    const clientIp = await getClientIp();
    console.log("🌐 Client IP:", clientIp);
    log.info({ clientIp }, "client_ip:resolved");

    // Get order with payment
    const dbStart = Date.now();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        package: true,
        event: true,
      },
    });

    const dbDuration = Date.now() - dbStart;

    if (!order) {
      log.warn(
        {
          db: {
            model: "Order",
            operation: "findUnique",
            durationMs: dbDuration,
          },
        },
        "db:not_found",
      );

      return { success: false, error: "Order not found", checkoutUrl: "" };
    }

    log.info(
      {
        db: { model: "Order", operation: "findUnique", durationMs: dbDuration },
      },
      "db:success",
    );

    if (!order.payment) {
      log.error({ orderId }, "payment:record_missing");
      return {
        success: false,
        error: "Payment record not found",
        checkoutUrl: "",
      };
    }

    if (order.payment.status === "PAID") {
      log.warn(
        { paymentId: order.payment.id },
        "payment:already_paid — duplicate initiation attempt",
      );

      return {
        success: false,
        error: "Order is already paid",
        checkoutUrl: "",
      };
    }

    // Step 0a: Never charge twice. If an earlier ShurjoPay session for this
    // order was actually paid (its callback lost), confirm that one instead of
    // opening a new payment.
    if (order.payment.paymentId) {
      const previous = await reconcileOrder(order.id, { log });
      log.info({ previous }, "payment:previous_session_checked");

      if (previous === "CONFIRMED" || previous === "ALREADY_PAID") {
        return {
          success: true,
          error: "",
          checkoutUrl: `/payment/success?orderId=${order.id}`,
        };
      }
      if (previous === "PAID_NO_SLOT" || previous === "NEEDS_REVIEW") {
        return {
          success: false,
          error:
            "We already received a payment for this order and are checking it. Please don't pay again — contact support with your order ID.",
          checkoutUrl: "",
        };
      }
      if (previous === "GATEWAY_ERROR") {
        return {
          success: false,
          error:
            "We couldn't check your previous payment attempt just now. Please try again in a minute so you aren't charged twice.",
          checkoutUrl: "",
        };
      }
      // NOT_PAID / NO_SESSION → safe to start a new payment.
    }

    // Step 0: Make sure this order holds its slot for the whole payment.
    //   PENDING   → refresh the hold so it can't expire mid-payment.
    //   CANCELLED → if the system released it (expired / declined), take the
    //               slot back if one is still free; admin cancels are final.
    // Both writes are conditional on the status, so a concurrent sweep can't
    // slip between the check and the update.
    const refreshed = await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING", source: "ONLINE" },
      data: { holdExpiresAt: newHoldExpiry() },
    });

    if (refreshed.count === 0) {
      const current = await prisma.order.findUnique({
        where: { id: order.id },
        select: { status: true, source: true },
      });

      if (current?.status === "CANCELLED") {
        const reclaim = await reclaimReleasedOrder(order.id);
        log.info({ reclaim }, "slots:reclaim_attempt");

        if (reclaim === "NO_SLOTS") {
          return {
            success: false,
            error:
              "Sorry, your reservation expired and this package is now sold out.",
            checkoutUrl: "",
          };
        }
        if (reclaim === "NOT_RECLAIMABLE") {
          return {
            success: false,
            error: "This order was cancelled. Please place a new order.",
            checkoutUrl: "",
          };
        }
      } else if (current?.status === "CONFIRMED") {
        return {
          success: false,
          error: "Order is already paid",
          checkoutUrl: "",
        };
      }
      // PENDING manual orders fall through unchanged (no hold to refresh).
    }

    // Step 1: ① Request Token → ② Return Token   (lib/payment/shurjopay)
    log.info(
      { externalApi: { service: "shurjopay", operation: "getToken" } },
      "external_api:start",
    );

    const tokenStart = Date.now();

    console.log("🔑 Getting ShurjoPay token...");
    const tokenData = await getShurjoPayToken();

    const tokenDuration = Date.now() - tokenStart;

    if (!tokenData.token) {
      log.error(
        {
          externalApi: {
            service: "shurjopay",
            operation: "getToken",
            durationMs: tokenDuration,
          },
        },
        "external_api:failure — empty token",
      );
      await reportGatewayFailure({
        stage: "login",
        spCode: tokenData.sp_code,
        message: tokenData.message,
        orderId: order.id,
        eventId: order.eventId,
      });

      return {
        success: false,
        error: "Payment gateway unavailable. Please try again.",
        checkoutUrl: "",
      };
    }

    log.info(
      {
        externalApi: {
          service: "shurjopay",
          operation: "getToken",
          durationMs: tokenDuration,
        },
      },
      "external_api:success",
    );

    // Step 2: ③ Create Payment → ④ Return checkout_url   (lib/payment/shurjopay)

    log.info(
      {
        externalApi: { service: "shurjopay", operation: "createPayment" },
        amount: order.payment.amount,
      },
      "external_api:start",
    );

    const paymentStart = Date.now();

    console.log("💳 Creating ShurjoPay payment...");
    const paymentResponse = await createShurjoPayPayment({
      token: tokenData.token,
      storeId: tokenData.store_id,
      orderId: order.id,
      amount: order.payment.amount,
      customerName,
      customerEmail,
      customerPhone,
      clientIp,
    });

    const paymentDuration = Date.now() - paymentStart;

    if (!paymentResponse.checkout_url) {
      log.error(
        {
          externalApi: {
            service: "shurjopay",
            operation: "createPayment",
            durationMs: paymentDuration,
          },
          spOrderId: paymentResponse.sp_order_id,
        },
        "external_api:failure — no checkout_url",
      );
      await reportGatewayFailure({
        stage: "create_payment",
        spCode: paymentResponse.sp_code,
        message: paymentResponse.message,
        orderId: order.id,
        eventId: order.eventId,
      });

      return {
        success: false,
        error: "Failed to initiate payment. Please try again.",
        checkoutUrl: "",
      };
    }

    log.info(
      {
        externalApi: {
          service: "shurjopay",
          operation: "createPayment",
          durationMs: paymentDuration,
        },
        spOrderId: paymentResponse.sp_order_id,
      },
      "external_api:success",
    );

    // Step 3: Update payment record with ShurjoPay order ID
    // (the callback ⑥ and verification ⑦ find the order by this sp_order_id)
    const updateStart = Date.now();

    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        paymentId: String(paymentResponse.sp_order_id),
        paymentMethod: "shurjopay",
        paymentGateway: "shurjopay",
      },
    });

    console.log("✅ ShurjoPay payment created, redirecting to checkout...");
    log.info(
      {
        db: {
          model: "Payment",
          operation: "update",
          durationMs: Date.now() - updateStart,
        },
        spOrderId: paymentResponse.sp_order_id,
      },
      "db:success",
    );

    log.info(
      {
        spOrderId: paymentResponse.sp_order_id,
        durationMs: Date.now() - start,
      },
      "action:success",
    );
    // Return checkout URL — the checkout page does ⑤ (redirects the customer there)
    return {
      success: true,
      error: "",
      checkoutUrl: String(paymentResponse.checkout_url),
    };
  } catch (error: any) {
    log.error({ err: error, durationMs: Date.now() - start }, "action:error");
    console.error("❌ ShurjoPay error:", error?.message);
    // Only gateway HTTP failures — database or our own bugs aren't ShurjoPay's.
    if (isAxiosError(error)) {
      const body = error.response?.data as { sp_code?: string; message?: string } | undefined;
      await reportGatewayFailure({
        stage: !error.response
          ? "unreachable"
          : error.config?.url?.includes("get_token")
            ? "login"
            : "create_payment",
        spCode: body?.sp_code ?? null,
        message:
          body?.message ??
          (error.response ? `HTTP ${error.response.status}` : error.code ?? error.message),
        orderId,
      });
    }
    return {
      success: false,
      error: "Failed to initiate payment. Please try again.",
      checkoutUrl: "",
    };
  } finally {
    await log.flush();
  }
}
