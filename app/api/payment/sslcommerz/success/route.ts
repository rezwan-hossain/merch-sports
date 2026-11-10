// ⑥ Redirect Customer to Merchant Page — after a successful payment.
// (SSLCommerz's diagram: README.md / flow.png)
//
// SSLCommerz sends the customer's browser here. The IPN (④) usually confirmed
// the order a moment ago; if not (IPN late or blocked), we validate here (⑤)
// ourselves. Either way the customer ends on our confirmation page.

import type { NextRequest } from "next/server";
import {
  callbackLogger,
  confirmPayment,
  pageForResult,
  readCallback,
  redirectTo,
} from "@/lib/payment/sslcommerz/callback-helpers";

export async function POST(request: NextRequest) {
  const log = await callbackLogger("success");
  try {
    const { tranId, valId } = await readCallback(request);
    if (!tranId) return redirectTo(request, "/payment/failed?reason=missing_order");

    // ⑤ Request for Validation (does nothing new if the IPN already confirmed it)
    const { result, orderId } = await confirmPayment(tranId, valId, log);
    log.info({ tranId, orderId, result }, "payment:checked");

    // ⑥ → Merchant Confirmation Page
    const page = pageForResult(result, orderId);
    if (page) return redirectTo(request, page);
    if (!orderId) return redirectTo(request, "/payment/failed?reason=payment_not_found");

    // Not confirmed yet (SSLCommerz still settling, or didn't answer):
    // the processing page keeps checking until it's settled.
    return redirectTo(request, `/payment/processing?orderId=${orderId}`);
  } catch (err) {
    log.error({ err }, "payment:callback_error");
    return redirectTo(request, "/payment/failed?reason=server_error");
  } finally {
    await log.flush();
  }
}

// Opened directly in the browser — nothing to do.
export function GET(request: NextRequest) {
  return redirectTo(request, "/payment/failed?reason=missing_order");
}
