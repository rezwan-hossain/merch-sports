import type { Metadata } from "next";
import RefundPolicyPage from "@/module/legal/pages/RefundPolicyPage";

export const metadata: Metadata = {
  title: "Return & Refund Policy",
  description:
    "When race registrations can be refunded, how to request a refund, and the 7–10 working day refund timeline.",
  alternates: { canonical: "/refund-policy" },
};

export default function page() {
  return <RefundPolicyPage />;
}
