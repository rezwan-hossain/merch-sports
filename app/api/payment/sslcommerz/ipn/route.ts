// ④ IPN Listener — "Validate Payment with IPN" in SSLCommerz's docs
// (https://developer.sslcommerz.com/doc/v4/ · our overview: README.md / flow.png).
//
// IPN = Instant Payment Notification. SSLCommerz's SERVER calls this directly
// (no browser), so a payment is settled even if the customer closed the tab.
//
// What SSLCommerz's docs ask for, and where we do it:
//   1. Grab the POST                          → readCallback(): tran_id + val_id
//   2. Make sure the data wasn't tampered with → we never trust the posted
//      status/amount; step 3 asks SSLCommerz itself. (Their own PHP library
//      defines a verify_sign hash check but never calls it — it relies on the
//      Validation API too.)
//   3. Validation API with val_id              → confirmPayment() → ⑤ validatePayment()
//   4. Check status VALID/VALIDATED, amount, currency, our transaction
//                                              → confirm-payment.ts (findProblem)
//   5. "Check for the status — VALID, FAILED, CANCEL — to update your order"
//      → paid: order confirmed (step 3–4)
//      → failed / cancelled / expired: the runner's slot is freed (below)
//   6. Answer anything — SSLCommerz only needs a reply.

import { NextResponse, type NextRequest } from "next/server";
import {
  callbackLogger,
  confirmPayment,
  readCallback,
  releaseSlotIfEnded,
} from "@/lib/payment/sslcommerz/callback-helpers";

export async function POST(request: NextRequest) {
  const log = await callbackLogger("ipn");
  try {
    // 1. ④ IPN Message
    const { tranId, valId } = await readCallback(request);
    if (!tranId) return NextResponse.json({ ok: false }, { status: 400 });

    // 2–4. ⑤ Request for Validation → confirm the order if it really was paid
    const { result, orderId } = await confirmPayment(tranId, valId, log);
    log.info({ tranId, orderId, result }, "payment:checked");

    // 5. Not paid: if SSLCommerz says this attempt ended (failed, cancelled,
    //    expired), free the slot now instead of holding it for 24 hours.
    if (result === "NOT_PAID") {
      await releaseSlotIfEnded(tranId, log);
    }

    // 6. SSLCommerz only needs a reply
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error({ err }, "payment:ipn_error");
    return NextResponse.json({ ok: false }, { status: 500 });
  } finally {
    await log.flush();
  }
}
