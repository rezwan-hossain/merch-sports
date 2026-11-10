// module/legal/components/LegalDocument.tsx
//
// Shared layout for Terms & Conditions, Privacy Policy and Return & Refund
// Policy: policy tabs, "last updated", a summary box, a table of contents
// (sticky on desktop, collapsible on phones), numbered sections and a contact
// card. Each page only supplies its text.
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ChevronDown, FileText, Mail, Phone, ReceiptText, ShieldCheck } from "lucide-react";
import { HeroText } from "@/components/ui/HeroText";
import { ADDRESS, BUSINESS_NAME, EMAIL, PHONE, TRADE_LICENSE } from "@/lib/business-info";

export type LegalSection = {
  /** e.g. "5. Refund & Cancellation Policy" — the leading number is optional. */
  title: string;
  icon?: LucideIcon;
  /**
   * Plain text. Lines starting with "•" become bullets, "-" sub-bullets,
   * blank lines separate paragraphs. (The format the policies were written in.)
   */
  content?: string;
  intro?: string;
  points?: string[];
  outro?: string;
};

export type LegalPolicy = "terms" | "privacy" | "refund";

const POLICIES: { id: LegalPolicy; label: string; short: string; href: string; icon: LucideIcon }[] = [
  { id: "terms", label: "Terms & Conditions", short: "Terms", href: "/terms-and-conditions", icon: FileText },
  { id: "privacy", label: "Privacy Policy", short: "Privacy", href: "/privacy-policy", icon: ShieldCheck },
  { id: "refund", label: "Return & Refund Policy", short: "Refund", href: "/refund-policy", icon: ReceiptText },
];

type Props = {
  policy: LegalPolicy;
  /** Big page heading (hero). */
  heroTitle: string;
  title: string;
  lastUpdated: string;
  /** Short "in short" box at the top. */
  summary: React.ReactNode;
  sections: LegalSection[];
  /** Optional closing box after the sections (e.g. "Agreement"). */
  closing?: React.ReactNode;
};

// "5. Refund & Cancellation" → "Refund & Cancellation" (the number is drawn separately)
const stripNumber = (title: string) => title.replace(/^\s*\d+\.\s*/, "");

// globals.css gives every h1–h6 the condensed display font (Anton). That's
// right for the big hero, but hard to read for document headings, so these
// use the body font. (Inline style: a Tailwind class can't beat that rule.)
const readableHeading = { fontFamily: "var(--font-body)" };
const sectionId = (i: number) => `section-${i + 1}`;

export function LegalDocument({ policy, heroTitle, title, lastUpdated, summary, sections, closing }: Props) {
  return (
    <div className="min-h-screen bg-background font-body">
      <div className="mt-42">
        <HeroText title={heroTitle} />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {/* ── Switch between the three policies ───────────────────── */}
        <nav aria-label="Policies" className="mb-8 flex justify-center">
          <div className="grid w-full max-w-md grid-cols-3 gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm sm:flex sm:w-auto sm:max-w-none">
            {POLICIES.map((p) => {
              const active = p.id === policy;
              const Icon = p.icon;
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                    active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="sm:hidden">{p.short}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12">
          {/* ── Table of contents ─────────────────────────────────── */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            {/* Phones: collapsible */}
            <details className="group rounded-xl border border-gray-200 bg-white lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900">
                On this page
                <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <TableOfContents sections={sections} />
            </details>
            {/* Desktop: always visible */}
            <div className="hidden lg:block">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">On this page</p>
              <TableOfContents sections={sections} />
            </div>
          </aside>

          {/* ── The document ──────────────────────────────────────── */}
          <article className="min-w-0">
            <header className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl" style={readableHeading}>
                {title}
              </h2>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500">
                <CalendarDays className="h-4 w-4" aria-hidden />
                Last updated {lastUpdated}
              </p>
            </header>

            <div className="mb-8 rounded-2xl border border-neon-lime/40 bg-neon-lime/10 p-4 text-sm leading-relaxed text-gray-800 sm:p-5 sm:text-[15px]">
              {summary}
            </div>

            <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
              {sections.map((section, i) => (
                <section key={section.title} id={sectionId(i)} className="scroll-mt-32 p-5 sm:p-7">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-neon-lime sm:h-9 sm:w-9">
                      {i + 1}
                    </span>
                    <h3
                      className="flex min-w-0 items-center gap-2 text-base font-semibold text-gray-900 sm:text-lg"
                      style={readableHeading}
                    >
                      {section.icon && <section.icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />}
                      {stripNumber(section.title)}
                    </h3>
                  </div>
                  {/* Phones: full width. Larger: lined up under the title. */}
                  <div className="mt-3 sm:pl-[52px]">
                    <SectionBody section={section} />
                  </div>
                </section>
              ))}
            </div>

            {closing && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 sm:p-5">
                {closing}
              </div>
            )}

            {/* ── Questions? ─────────────────────────────────────── */}
            <div className="mt-6 rounded-2xl bg-gray-900 p-5 text-white sm:p-7">
              <p className="text-lg font-bold">Questions about this policy?</p>
              <p className="mt-1 text-sm text-white/70">We&apos;re happy to help — reach us any time.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full bg-neon-lime px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  {EMAIL}
                </a>
                <a
                  href={`tel:${PHONE}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {PHONE}
                </a>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/50">
                {BUSINESS_NAME} · {ADDRESS} · Trade License {TRADE_LICENSE}
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function TableOfContents({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="space-y-0.5 px-2 pb-3 lg:px-0 lg:pb-0">
      {sections.map((section, i) => (
        <li key={section.title}>
          <a
            href={`#${sectionId(i)}`}
            className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-snug text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <span className="w-5 shrink-0 tabular-nums text-gray-400">{i + 1}.</span>
            <span>{stripNumber(section.title)}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function SectionBody({ section }: { section: LegalSection }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-600 sm:text-[15px]">
      {section.content && <PlainText text={section.content} />}
      {section.intro && <p>{section.intro}</p>}
      {section.points && <BulletList items={section.points.map((text) => ({ text, sub: [] }))} />}
      {section.outro && <p>{section.outro}</p>}
    </div>
  );
}

type Bullet = { text: string; sub: string[] };

function BulletList({ items }: { items: Bullet[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="relative pl-5">
          <span className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-neon-lime" aria-hidden />
          {item.text}
          {item.sub.length > 0 && (
            <ul className="mt-1.5 space-y-1 border-l border-gray-200 pl-4">
              {item.sub.map((s, j) => (
                <li key={j}>{s}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Turns the policies' plain-text format into paragraphs and real lists. */
function PlainText({ text }: { text: string }) {
  type Block = { kind: "p"; text: string } | { kind: "ul"; items: Bullet[] };
  const blocks: Block[] = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const last = blocks[blocks.length - 1];
    if (line.startsWith("•")) {
      const bullet = { text: line.replace(/^•\s*/, ""), sub: [] };
      if (last?.kind === "ul") last.items.push(bullet);
      else blocks.push({ kind: "ul", items: [bullet] });
    } else if (line.startsWith("-") && last?.kind === "ul") {
      last.items[last.items.length - 1].sub.push(line.replace(/^-\s*/, ""));
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }

  return (
    <>
      {blocks.map((block, i) =>
        block.kind === "p" ? <p key={i}>{block.text}</p> : <BulletList key={i} items={block.items} />,
      )}
    </>
  );
}
