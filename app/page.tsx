import type { Metadata } from "next";
import Homepage from "@/module/home/pages/Homepage";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      {/* Who we are, for search engines (brand panel, logo, contact) */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <Homepage />
    </>
  );
}
