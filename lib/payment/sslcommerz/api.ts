// lib/payment/sslcommerz/api.ts
//
// Every call we make to SSLCommerz. The numbers ①–⑥ follow SSLCommerz's own
// integration diagram (flow.png next to this file, explained in README.md):
//
//   ①② startPayment()      Requests for Session → Return Session ID
//   ⑤  validatePayment()   Request for Validation (Validation API, by val_id)
//      getTransaction()    Look a payment up by our tran_id — used when there's
//                          no val_id (reconciler, "confirming…" page) and as a
//                          fallback when validation doesn't confirm
//
// Same endpoints as the official SDK (npm "sslcommerz-lts": init(), validate(),
// transactionQueryByTransactionId()). We call them with fetch ourselves
// because the SDK hides network errors.
//
// Docs: https://developer.sslcommerz.com/doc/v4/

import crypto from "node:crypto";
import { getSslCommerzConfig } from "./config";

// ─── Transaction ids ───────────────────────────────────────────────────────

/** A new, unique id for one payment attempt, e.g. "SSLMHSX2K1A9F3C2E1B". */
export function newTranId(): string {
  const time = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `SSL${time}${random}`.toUpperCase(); // SSLCommerz allows up to 30 chars
}

/** True if the text looks like one of our tran ids (used to reject junk input). */
export function isTranId(text: string): boolean {
  return /^SSL[A-Z0-9]{8,27}$/.test(text);
}

// ─── ①② Start a payment ────────────────────────────────────────────────────

type StartPaymentInput = {
  tranId: string;
  orderId: string;
  amount: number;
  siteUrl: string;
  productName: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

type StartPaymentResult =
  | { ok: true; paymentPageUrl: string; sessionKey: string }
  | { ok: false; error: string; couldNotConnect: boolean };

/**
 * ① Requests for Session → ② Return Session ID.
 * Ask SSLCommerz to open a payment session. Its answer holds the session id
 * (`sessionkey`) and the payment page (`GatewayPageURL`) that the customer is
 * sent to in step ③.
 */
export async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  const { storeId, storePassword, apiUrl } = getSslCommerzConfig();
  const callbackUrl = `${input.siteUrl}/api/payment/sslcommerz`;

  const form = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    tran_id: input.tranId,
    total_amount: input.amount.toFixed(2),
    currency: "BDT",
    // ⑥ where SSLCommerz sends the customer back to:
    success_url: `${callbackUrl}/success`,
    fail_url: `${callbackUrl}/fail`,
    cancel_url: `${callbackUrl}/cancel`,
    // ④ where SSLCommerz's server sends the IPN message:
    ipn_url: `${callbackUrl}/ipn`,
    // Our order id travels with the payment and comes back in getTransaction().
    value_a: input.orderId,
    product_name: input.productName.slice(0, 255) || "Event registration",
    product_category: "Event registration",
    product_profile: "non-physical-goods",
    num_of_item: String(input.quantity),
    shipping_method: "NO",
    cus_name: input.customerName.slice(0, 50) || "Runner",
    cus_email: input.customerEmail || "no-email@example.com",
    cus_phone: input.customerPhone,
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
  });

  // ① Requests for Session
  let reply: { status?: string; sessionkey?: string; GatewayPageURL?: string; failedreason?: string };
  try {
    const res = await fetch(`${apiUrl}/gwprocess/v4/api.php`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    reply = await res.json();
  } catch (err) {
    return { ok: false, error: String(err), couldNotConnect: true };
  }

  // ② Return Session ID
  if (reply.status === "SUCCESS" && reply.GatewayPageURL) {
    return { ok: true, paymentPageUrl: reply.GatewayPageURL, sessionKey: reply.sessionkey ?? "" };
  }
  return { ok: false, error: reply.failedreason || "No payment page returned", couldNotConnect: false };
}

// ─── ⑤ Check a payment ─────────────────────────────────────────────────────

/** One payment attempt as SSLCommerz reports it (only the fields we use). */
export type SslCommerzTransaction = {
  tran_id: string;
  val_id: string;
  status: string; // VALID, VALIDATED, PROCESSING, PENDING, FAILED, CANCELLED, EXPIRED, UNATTEMPTED
  amount: string;
  currency: string;
  value_a?: string; // our order id
  bank_tran_id?: string;
  card_type?: string; // e.g. "BKASH-BKash"
  risk_level?: string; // "1" = SSLCommerz thinks it's risky
  risk_title?: string;
};

export type TransactionCheck =
  | { status: "PAID"; transaction: SslCommerzTransaction }
  | { status: "FAILED"; transaction: SslCommerzTransaction } // cancelled, declined or expired
  | { status: "NOT_PAID"; transaction: SslCommerzTransaction | null } // not finished, or no record
  | { status: "UNKNOWN"; error: string }; // couldn't get an answer — never act on this

/**
 * ⑤ Request for Validation — the Validation API from SSLCommerz's diagram.
 *
 * SSLCommerz posts a `val_id` with the IPN (④) and the success redirect (⑥).
 * We hand it back to SSLCommerz and get the real payment details. Only "PAID"
 * means anything here: an unknown or fake val_id returns NOT_PAID/UNKNOWN, and
 * the caller then falls back to getTransaction(tranId).
 */
export async function validatePayment(valId: string): Promise<TransactionCheck> {
  const { storeId, storePassword, apiUrl } = getSslCommerzConfig();
  const url = new URL(`${apiUrl}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", storeId);
  url.searchParams.set("store_passwd", storePassword);
  url.searchParams.set("v", "1");
  url.searchParams.set("format", "json");

  let reply: SslCommerzTransaction & { APIConnect?: string };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    reply = await res.json();
  } catch (err) {
    return { status: "UNKNOWN", error: String(err) };
  }

  if (reply.APIConnect !== "DONE") {
    return { status: "UNKNOWN", error: `APIConnect: ${reply.APIConnect ?? "no answer"}` };
  }
  // VALID = paid. VALIDATED = paid, and already validated before (e.g. by the IPN).
  if (reply.status === "VALID" || reply.status === "VALIDATED") {
    return { status: "PAID", transaction: reply };
  }
  return { status: "NOT_PAID", transaction: null }; // e.g. INVALID_TRANSACTION
}

/**
 * Look a payment attempt up by OUR tran_id. Used when there is no val_id
 * (reconciler, hourly sweep, "confirming your payment…" page, admin checks)
 * and as the fallback when validatePayment() doesn't confirm.
 *
 * Like validatePayment(), this asks SSLCommerz directly — we never trust the
 * data SSLCommerz posts to our callback URLs (anyone can post fake data there).
 */
export async function getTransaction(tranId: string): Promise<TransactionCheck> {
  const { storeId, storePassword, apiUrl } = getSslCommerzConfig();
  const url = new URL(`${apiUrl}/validator/api/merchantTransIDvalidationAPI.php`);
  url.searchParams.set("tran_id", tranId);
  url.searchParams.set("store_id", storeId);
  url.searchParams.set("store_passwd", storePassword);
  url.searchParams.set("format", "json");

  let reply: { APIConnect?: string; element?: SslCommerzTransaction[] };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    reply = await res.json();
  } catch (err) {
    return { status: "UNKNOWN", error: String(err) };
  }

  // "DONE" = SSLCommerz answered. Anything else (FAILED = wrong store login,
  // INACTIVE = store disabled) means we don't know.
  if (reply.APIConnect !== "DONE") {
    return { status: "UNKNOWN", error: `APIConnect: ${reply.APIConnect ?? "no answer"}` };
  }

  const attempts = (reply.element ?? []).filter((t) => t.tran_id === tranId);

  const paid = attempts.find((t) => t.status === "VALID" || t.status === "VALIDATED");
  if (paid) return { status: "PAID", transaction: paid };

  const latest = attempts[0] ?? null;
  if (latest && ["FAILED", "CANCELLED", "EXPIRED"].includes(latest.status)) {
    return { status: "FAILED", transaction: latest };
  }
  return { status: "NOT_PAID", transaction: latest };
}

/**
 * Is this paid transaction really for this order and amount? Returns what's
 * wrong in plain words, or null if it's fine to confirm.
 * Same checks as SSLCommerz's own reference code (tran id, amount, currency),
 * plus our order id and their fraud flag.
 */
export function findProblem(
  transaction: SslCommerzTransaction,
  order: { id: string; amount: number },
): string | null {
  if (transaction.currency !== "BDT") return `currency is ${transaction.currency}, expected BDT`;
  if (!(Number(transaction.amount) >= order.amount)) return `paid ৳${transaction.amount}, order is ৳${order.amount}`;
  if (transaction.value_a && transaction.value_a !== order.id) return `payment belongs to order ${transaction.value_a}`;
  if (transaction.risk_level === "1") return `SSLCommerz flagged it as risky (${transaction.risk_title || "risk level 1"})`;
  return null;
}
