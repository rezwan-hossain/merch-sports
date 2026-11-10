// ⑥ Redirect Customer to Merchant Page — after the customer pressed "Cancel"
// on the payment page. (SSLCommerz's diagram: README.md / flow.png)

import type { NextRequest } from "next/server";
import {
  callbackLogger,
  confirmPayment,
  pageForResult,
  readCallback,
  redirectTo,
  releaseSlotIfEnded,
} from "@/lib/payment/sslcommerz/callback-helpers";

export async function POST(request: NextRequest) {
  const log = await callbackLogger("cancel");
  try {
    const { tranId, valId } = await readCallback(request);
    if (!tranId) return redirectTo(request, "/payment/failed?reason=missing_order");

    // ⑤ Check anyway — if it was actually paid, confirm it instead.
    const { result, orderId } = await confirmPayment(tranId, valId, log);
    const page = pageForResult(result, orderId);
    if (page) return redirectTo(request, page);
    if (!orderId) return redirectTo(request, "/payment/failed?reason=payment_not_found");

    // Not paid: free the runner's slot (only if SSLCommerz confirms it ended).
    await releaseSlotIfEnded(tranId, "cancel", log);

    // ⑥ → our "payment cancelled" page (with a "Try again" button)
    return redirectTo(request, `/payment/failed?orderId=${orderId}&reason=cancelled`);
  } catch (err) {
    log.error({ err }, "payment:callback_error");
    return redirectTo(request, "/payment/failed?reason=server_error");
  } finally {
    await log.flush();
  }
}

export function GET(request: NextRequest) {
  return redirectTo(request, "/payment/failed?reason=missing_order");
}
