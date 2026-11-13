// lib/payment/gateway-label.ts
//
// Payment.paymentGateway → the name admins see ("shurjopay" → "ShurjoPay").
// No imports, so it's safe in client components too.

const GATEWAY_NAMES: Record<string, string> = {
  shurjopay: "ShurjoPay",
  sslcommerz: "SSLCommerz",
};

/**
 * "ShurjoPay" | "SSLCommerz" | "Manual" — or null when an online order never
 * reached a gateway (the runner left before paying started).
 */
export function gatewayLabel(
  gateway: string | null | undefined,
  source?: "ONLINE" | "MANUAL" | string | null,
): string | null {
  if (source === "MANUAL") return "Manual";
  if (!gateway) return null;
  return GATEWAY_NAMES[gateway.toLowerCase()] ?? gateway;
}
