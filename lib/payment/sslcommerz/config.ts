// lib/payment/sslcommerz/config.ts
//
// SSLCommerz settings, read from .env:
//
//   SSLCOMMERZ_ENABLED="true"                         ← off unless exactly "true"
//   SSLCOMMERZ_STORE_ID="..."
//   SSLCOMMERZ_STORE_PASSWORD="..."
//   SSLCOMMERZ_API_URL="https://sandbox.sslcommerz.com"   (live: https://securepay.sslcommerz.com)
//   NEXT_PUBLIC_SITE_URL="https://www.example.com"    ← where customers come back to

/** The value stored in Payment.paymentGateway / paymentMethod for this gateway. */
export const SSLCOMMERZ = "sslcommerz";

export function getSslCommerzConfig() {
  return {
    storeId: process.env.SSLCOMMERZ_STORE_ID ?? "",
    storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD ?? "",
    apiUrl: (process.env.SSLCOMMERZ_API_URL || "https://sandbox.sslcommerz.com").replace(/\/$/, ""),
  };
}

/** SSLCommerz is offered at checkout only when this is true. */
export function isSslCommerzEnabled(): boolean {
  const { storeId, storePassword } = getSslCommerzConfig();
  return process.env.SSLCOMMERZ_ENABLED === "true" && storeId !== "" && storePassword !== "";
}

/**
 * The public site address SSLCommerz sends customers (and the IPN) back to.
 *
 * Returns an error when LIVE SSLCommerz would send customers to an address
 * they can't reach (localhost, http) — the money would be taken but we'd
 * never hear about it. In that case we refuse to start the payment.
 */
export function getSiteUrl(): { siteUrl: string; error: string | null } {
  let site: URL;
  try {
    site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  } catch {
    return { siteUrl: "", error: "NEXT_PUBLIC_SITE_URL is not set to a valid URL." };
  }

  const isLive = !getSslCommerzConfig().apiUrl.includes("sandbox");
  const isPrivate = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|\[::1\])|\.local$/i.test(site.hostname);
  if (isLive && (isPrivate || site.protocol !== "https:")) {
    return {
      siteUrl: site.origin,
      error: `Live SSLCommerz can't send customers back to ${site.origin}. Use the sandbox locally, or set NEXT_PUBLIC_SITE_URL to your https domain.`,
    };
  }
  return { siteUrl: site.origin, error: null };
}
