// module/about/pages/AboutPage.tsx
//
// About Us. Also covers SSLCommerz's merchant website rules: company and
// management details, the registered address (as on the trade license) and
// the trade license / TIN number. Company details come from
// lib/business-info.ts; management from admin → Team (ADMIN group).
import { Suspense } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  CalendarCheck,
  CreditCard,
  FileText,
  Flag,
  Mail,
  ReceiptText,
  ShieldCheck,
  Shirt,
} from "lucide-react";
import { HeroText } from "@/components/ui/HeroText";
import {
  ADDRESS,
  BUSINESS_NAME,
  EMAIL,
  PHONE,
  TIN,
  TRADE_LICENSE,
  WEBSITE,
} from "@/lib/business-info";
import { Management, ManagementSkeleton } from "../components/Management";

// globals.css puts every heading in the condensed display font; card and
// detail headings read better in the body font.
const bodyFont = { fontFamily: "var(--font-body)" };

const WHAT_WE_DO: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Flag,
    title: "We organize races",
    text: "Running events across Bangladesh — from first-timer fun runs to marathon distances — with marked routes and support on race day.",
  },
  {
    icon: CreditCard,
    title: "Easy, secure registration",
    text: "Register online in minutes and pay securely through ShurjoPay or SSLCommerz with bKash, Nagad, Rocket, cards or internet banking.",
  },
  {
    icon: Shirt,
    title: "Race kits & confirmations",
    text: "Your confirmation arrives by email and SMS right after payment, and your BIB and T-shirt are ready at the kit collection before race day.",
  },
];

export default function AboutPage() {
  const details: { label: string; value: string }[] = [
    { label: "Business name", value: BUSINESS_NAME },
    { label: "Registered address", value: ADDRESS },
    { label: "Trade License No.", value: TRADE_LICENSE },
    ...(TIN ? [{ label: "TIN", value: TIN }] : []),
    { label: "Email", value: EMAIL },
    { label: "Phone", value: PHONE },
    { label: "Website", value: WEBSITE },
  ];

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="mt-42">
        <HeroText title="About Us" />
      </div>

      <div className="mx-auto max-w-6xl space-y-16 px-4 pb-20 pt-8 sm:space-y-20 sm:px-6 lg:px-8">
        {/* ── Who we are ───────────────────────────────────────────── */}
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Who we are</p>
            <h2 className="text-4xl leading-[1.05] text-gray-900 sm:text-5xl">
              Inspiring runners to <span className="bg-neon-lime px-1.5">push beyond</span> their limits
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
              {BUSINESS_NAME} is a Bangladeshi running-events company. We organize races for every kind
              of runner and handle everything around them — registration, payments, race kits and
              race-day support — so you can focus on your run.
            </p>
          </div>

          <div className="rounded-3xl bg-gray-900 p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neon-lime">Our promise</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/80 sm:text-base">
              {[
                "Clear prices in Taka, shown before you pay",
                "Secure payments through licensed gateways",
                "Instant confirmation by email and SMS",
                "Real people to help — before, during and after the race",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neon-lime" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── What we do ───────────────────────────────────────────── */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">What we do</p>
          <ul className="grid gap-4 md:grid-cols-3">
            {WHAT_WE_DO.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neon-lime/15">
                  <Icon className="h-5 w-5 text-gray-900" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900" style={bodyFont}>
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Management (SSLCommerz: management details) ──────────── */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Management</p>
          <h2 className="mb-6 text-3xl text-gray-900 sm:text-4xl">The people behind the races</h2>
          <Suspense fallback={<ManagementSkeleton />}>
            <Management />
          </Suspense>
        </section>

        {/* ── Company details (SSLCommerz: company, address, trade license) ── */}
        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Company details</p>
            <h2 className="text-3xl text-gray-900 sm:text-4xl">Registered in Bangladesh</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
              {BUSINESS_NAME} is a registered business in Dhaka. You can reach us by email or phone for
              anything about registrations, payments or refunds.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { href: "/terms-and-conditions", label: "Terms & Conditions", icon: FileText },
                { href: "/privacy-policy", label: "Privacy Policy", icon: ShieldCheck },
                { href: "/refund-policy", label: "Return & Refund Policy", icon: ReceiptText },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {details.map(({ label, value }) => (
              <div key={label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[170px_1fr] sm:gap-4">
                <dt className="text-sm text-gray-500">{label}</dt>
                <dd className="text-sm font-medium text-gray-900 sm:text-[15px]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Call to action ───────────────────────────────────────── */}
        <section className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-neon-lime p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-2xl font-bold text-gray-900 sm:text-3xl" style={bodyFont}>
              Ready for your next race?
            </p>
            <p className="mt-1 text-sm text-gray-800">Find an event and register in a few minutes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Browse events
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-white"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Contact us
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
