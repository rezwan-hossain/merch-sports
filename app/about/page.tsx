import type { Metadata } from "next";
import AboutPage from "@/module/about/pages/AboutPage";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Merch Sports organizes running events across Bangladesh. Meet our management team and find our company details.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <AboutPage />;
}
