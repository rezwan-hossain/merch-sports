// app/robots.ts → /robots.txt
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal / transactional pages have nothing to show in search.
      disallow: ["/api/", "/profile", "/dashboard", "/cart", "/checkout", "/payment/", "/order-confirmation", "/auth/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
