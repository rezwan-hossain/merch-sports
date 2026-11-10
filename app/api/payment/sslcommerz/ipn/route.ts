// ④ IPN Listener — "IPN Message" in SSLCommerz's diagram (README.md / flow.png).
//
// IPN = Instant Payment Notification. SSLCommerz's SERVER calls this directly
// (no browser), so a payment is confirmed even if the customer closed the tab
// before coming back.
//
//   ④ SSLCommerz posts tran_id + val_id here
//   ⑤ we send the val_id to the Validation API and confirm the order if paid
//   → answer 200 so SSLCommerz knows we got it

import { NextResponse, type NextRequest } from "next/server";
import { callbackLogger, confirmPayment, readCallback } from "@/lib/payment/sslcommerz/callback-helpers";

export async function POST(request: NextRequest) {
  const log = await callbackLogger("ipn");
  try {
    // ④ IPN Message
    const { tranId, valId } = await readCallback(request);
    if (!tranId) return NextResponse.json({ ok: false }, { status: 400 });

    // ⑤ Request for Validation → confirm the order if SSLCommerz says it's paid
    const { result, orderId } = await confirmPayment(tranId, valId, log);
    log.info({ tranId, orderId, result }, "payment:checked");

    return NextResponse.json({ ok: true }); // SSLCommerz only needs a 200
  } catch (err) {
    log.error({ err }, "payment:ipn_error");
    return NextResponse.json({ ok: false }, { status: 500 });
  } finally {
    await log.flush();
  }
}
