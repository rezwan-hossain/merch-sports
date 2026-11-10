// lib/payment/shurjopay/index.ts
//
// The one ShurjoPay client for the whole app.
//
//   Starting a payment (checkout, app/actions/payment.ts):
//     getShurjoPayToken → createShurjoPayPayment
//
//   Checking a payment (callback, reconciler, hold sweep — via lib/payment-verify.ts):
//     verifyShurjoPayPayment, SP_CODE, getPaymentStatusMessage
//
// ─── Payment request flow (end to end) ─────────────────────────────────────
//
//  1. CREATE ORDER — placeOrder (app/actions/checkout.ts)
//     Order PENDING + Registration + Payment PENDING, and the package slot is
//     claimed with a 24h hold (Order.holdExpiresAt, lib/slot-hold.ts).
//
//  2. START PAYMENT — initiateShurjoPayPayment (app/actions/payment.ts)
//     a. Payment config sane? (lib/payment-config.ts) — else refuse + audit.
//     b. Order already has a ShurjoPay session (Payment.paymentId)? Ask
//        ShurjoPay first (reconcileOrder) — if that one was paid, confirm it
//        instead of charging twice.
//     c. Refresh the 24h hold (or reclaim a system-released order's slot).
//     d. getShurjoPayToken   POST {API}/api/get_token   {username, password}
//        → no token: "Payment gateway unavailable" + audit payment.gateway_error
//     e. createShurjoPayPayment POST {API}/api/secret-pay  (Bearer token)
//        order_id/value1 = our Order.id, return_url = cancel_url = SHURJOPAY_CALLBACK_URL
//        → no checkout_url: "Failed to initiate payment" + audit
//     f. Save sp_order_id in Payment.paymentId, send the browser to checkout_url.
//
//  3. CUSTOMER PAYS on ShurjoPay's page (bKash, Nagad, card, …).
//
//  4. CALLBACK — GET/POST /api/payment/shurjopay/callback?order_id=<sp_order_id>
//     (app/api/payment/shurjopay/callback/route.ts). The query string is never
//     trusted: it asks ShurjoPay via verifyShurjoPayPayment (lib/payment-verify.ts,
//     retried), then by sp_code:
//       1000 success → amount/order match? → confirmPaidOrder (race-safe)
//                      → coupon usage + email + SMS → /payment/success
//                      mismatch → audit, slot kept → admin reviews
//                      paid but no slot → audit "REFUND NEEDED"
//       1001 declined / 1002 cancelled → Payment FAILED, releaseHold → /payment/failed
//       other code / ShurjoPay unreachable → stays PENDING → /payment/processing
//     A callback for an older session (customer retried) never fails/releases
//     the newer one.
//
//  5. SAFETY NETS when the callback is lost (tab closed, network drop):
//     - /payment/processing polls getPaymentProgress (app/actions/payment-status.ts),
//       which asks ShurjoPay at most every 15s.
//     - Reconciler, every 5 min (instrumentation.ts → lib/payment-reconcile.ts):
//       PENDING online orders from the last 3 days → ask ShurjoPay → confirm paid.
//     - Hold sweep, hourly (instrumentation.ts → releaseExpiredHolds): holds past
//       24h are cancelled ONLY after ShurjoPay confirms no payment; paid ones are
//       parked for an admin (Payment issues panel).
//
// ───────────────────────────────────────────────────────────────────────────
//
// The two sides deliberately handle a refused login differently:
//   - checkout's getShurjoPayToken RETURNS ShurjoPay's reply even without a
//     token, so payment.ts can show "Payment gateway unavailable" and record
//     the sp_code (lib/payment-gateway-alert.ts);
//   - verification THROWS when there's no token, so callers treat the answer
//     as "unsure, try again later" and never as "not paid".
// Keep it that way — merging the two token functions would break one side.

import axios, { AxiosError } from "axios";

const BASE_URL = process.env.SHURJOPAY_API_URL!;
const USERNAME = process.env.SHURJOPAY_USERNAME!;
const PASSWORD = process.env.SHURJOPAY_PASSWORD!;
const CALLBACK_URL = process.env.SHURJOPAY_CALLBACK_URL!;
const SHURJOPAY_PREFIX = process.env.SHURJOPAY_PREFIX;

// ─── Types ──────────────────────────────────────────
export interface ShurjoPayTokenResponse {
  token: string;
  store_id: number;
  execute_url: string;
  token_type: string;
  sp_code: string | number;
  message: string;
}

export interface ShurjoPayPaymentResponse {
  checkout_url: string;
  amount: number;
  currency: string;
  sp_order_id: string;
  customer_order_id: string;
  sp_code: string | number;
  message: string;
  transactionStatus: string;
}

export interface ShurjoPayVerificationItem {
  id: number;
  order_id: string; // shurjoPay payment id
  currency: string;
  amount: number;
  payable_amount: number;
  discount_amount: number;
  disc_percent: number;
  received_amount: number;
  usd_amt: number;
  usd_rate: number;
  method: string; // payment method (bKash, cards, etc.)
  sp_code: number; // 1000 = success, 1001 = declined, 1002 = cancelled
  sp_message: string;
  name: string;
  email: string;
  address: string;
  city: string;
  value1: string;
  value2: string;
  value3: string;
  value4: string;
  // Not in the official docs, but sometimes returned.
  bank_status?: string;
  transaction_status?: string;
  bank_trx_id?: string;
  invoice_no?: string;
  customer_order_id?: string;
  date_time?: string;
}

export const SP_CODE = {
  SUCCESS: 1000,
  DECLINED_BY_BANK: 1001,
  CANCELLED_BY_CUSTOMER: 1002,
} as const;

// ═══ Starting a payment (checkout) ══════════════════

// ─── Get Token ──────────────────────────────────────
// Returns ShurjoPay's reply as-is, even when it has no token (see top).
export async function getShurjoPayToken(): Promise<ShurjoPayTokenResponse> {
  const { data } = await axios.post(
    `${BASE_URL}/api/get_token`,
    {
      username: USERNAME,
      password: PASSWORD,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  console.log("🔑 ShurjoPay token response:", {
    token: data.token ? "✅ received" : "❌ missing",
    store_id: data.store_id,
    message: data.message,
  });

  return data as ShurjoPayTokenResponse;
}

// ─── Create Payment ─────────────────────────────────
export async function createShurjoPayPayment({
  token,
  storeId,
  orderId,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
  customerCity,
  clientIp,
}: {
  token: string;
  storeId: number;
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
  customerCity?: string;
  clientIp?: string;
}): Promise<ShurjoPayPaymentResponse> {
  const payload = {
    prefix: SHURJOPAY_PREFIX || "RRN",
    token,
    store_id: storeId,
    return_url: CALLBACK_URL,
    cancel_url: CALLBACK_URL,
    amount: amount,
    order_id: orderId,
    currency: "BDT",
    customer_name: customerName,
    customer_address: customerAddress || "Dhaka",
    customer_city: customerCity || "Dhaka",
    customer_phone: customerPhone,
    customer_email: customerEmail,
    client_ip: clientIp || "127.0.0.1",
    discount_amount: 0,
    disc_percent: 0,
    value1: orderId,
    value2: "",
    value3: "",
    value4: "",
  };

  console.log("💳 ShurjoPay create payment payload:", {
    amount,
    orderId,
    customerName,
    customerPhone,
  });

  const { data } = await axios.post(`${BASE_URL}/api/secret-pay`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  console.log("💳 ShurjoPay create payment response:", {
    checkout_url: data.checkout_url ? "✅ received" : "❌ missing",
    sp_order_id: data.sp_order_id,
    message: data.message,
  });

  return data as ShurjoPayPaymentResponse;
}

// ═══ Checking a payment (callback / reconciler / sweep) ═══

// Throws when ShurjoPay gives no token (see top).
async function getVerificationToken(): Promise<ShurjoPayTokenResponse> {
  console.log("🔑 Token request to:", `${BASE_URL}/api/get_token`);
  console.log("🔑 Environment:", process.env.NODE_ENV);

  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/get_token`,
      {
        username: USERNAME,
        password: PASSWORD,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 50000,
      },
    );

    console.log("🔑 ShurjoPay token response:", {
      token: data.token ? "✅ received" : "❌ missing",
      store_id: data.store_id,
      sp_code: data.sp_code,
      message: data.message,
    });

    if (!data.token) {
      throw new Error(`Token not received: ${data.message || "Unknown error"}`);
    }

    return data as ShurjoPayTokenResponse;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error("🔑 Token request failed:", {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(
        `ShurjoPay token error: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
      );
    }
    throw error;
  }
}

// ─── Verify Payment ─────────────────────────────────
export async function verifyShurjoPayPayment(
  spOrderId: string,
): Promise<ShurjoPayVerificationItem[]> {
  console.log("🔍 Verifying payment for order:", spOrderId);

  const tokenData = await getVerificationToken();

  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/verification`,
      { order_id: spOrderId },
      {
        headers: {
          Authorization: `Bearer ${tokenData.token}`,
          "Content-Type": "application/json",
        },
        timeout: 50000,
      },
    );

    console.log(
      "✅ ShurjoPay RAW verify response:",
      JSON.stringify(data, null, 2),
    );

    // ShurjoPay has answered in several shapes; normalise to an array.
    let verificationData: ShurjoPayVerificationItem[];

    if (Array.isArray(data)) {
      verificationData = data;
    } else if (data && Array.isArray(data.data)) {
      verificationData = data.data;
    } else if (data && typeof data === "object" && data.order_id) {
      verificationData = [data];
    } else {
      console.error("❌ Unexpected verification response structure:", data);
      verificationData = [];
    }

    console.log("✅ Parsed verification data:", {
      count: verificationData.length,
      firstItem: verificationData[0]
        ? {
            sp_code: verificationData[0].sp_code,
            sp_code_type: typeof verificationData[0].sp_code,
            sp_message: verificationData[0].sp_message,
            method: verificationData[0].method,
            amount: verificationData[0].amount,
            received_amount: verificationData[0].received_amount,
          }
        : null,
    });

    return verificationData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error("🔍 Verification failed:", {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(
        `ShurjoPay verification error: ${axiosError.response?.status}`,
      );
    }
    throw error;
  }
}

// ─── Human-readable status ──────────────────────────
export function getPaymentStatusMessage(
  paymentInfo: ShurjoPayVerificationItem,
): string {
  const spCode = Number(paymentInfo.sp_code);

  switch (spCode) {
    case 1000:
      return "Payment successful";
    case 1001:
      return "Transaction declined by bank";
    case 1002:
      return "Transaction cancelled by customer";
    default:
      return paymentInfo.sp_message || `Unknown status (code: ${spCode})`;
  }
}
