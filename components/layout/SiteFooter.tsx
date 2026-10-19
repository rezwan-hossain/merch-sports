// components/layout/SiteFooter.tsx
//
// Site footer in the homepage style: dark green, a big condensed sign-off line
// with a lime accent, then brand · explore · help · contact columns and a
// bottom bar. Links only point to pages and sections that exist.
import { ArrowUpRight, Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import CurrentYear from "../ui/CurrentYear";

const EMAIL = "info@merchcommunication.com";
const PHONE = "+8801862221943";
const ADDRESS = "House 32, Road 08, Block H, Mirpur 2, Dhaka";

// Social profiles. Paste a link into `href` to make that icon clickable;
// while it's empty the icon shows but isn't a link (no dead "#" links).
const socials = [
  { icon: Facebook, label: "Facebook", href: "https://www.facebook.com/profile.php?id=61566321857186" },
  { icon: Instagram, label: "Instagram", href: "" }, // TODO: add Instagram link
  { icon: Youtube, label: "YouTube", href: "" }, // TODO: add YouTube link
];

const exploreLinks = [
  { label: "Events", href: "/events" },
  { label: "Distances", href: "/#categories" },
  { label: "Schedule", href: "/#schedule" },
  { label: "Gallery", href: "/gallery" },
  { label: "Team", href: "/teams" },
];

const helpLinks = [
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/contact" },
  { label: "My dashboard", href: "/dashboard" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Privacy Policy", href: "/privacy-policy" },
];

function LinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50" style={{ fontFamily: "var(--font-body)" }}>{title}</h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              prefetch={false}
              className="text-sm text-white/75 transition-colors hover:text-neon-lime"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const SiteFooter = () => {
  return (
    <footer className="bg-[#0d2b22] text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        {/* ─── Sign-off ─── */}
        <div className="flex flex-col gap-6 border-b border-white/10 py-12 sm:py-16 md:flex-row md:items-end md:justify-between">
          <p className="text-5xl sm:text-6xl lg:text-7xl uppercase leading-[0.9] tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Run beyond
            <br />
            <span className="text-neon-lime">your limits</span>
          </p>
          <Link
            href="/events"
            className="group inline-flex w-fit items-center gap-2 rounded-full bg-neon-lime py-1.5 pl-5 pr-1.5 text-sm font-semibold text-[#0d2b22] transition hover:brightness-105 active:scale-[0.98]"
          >
            Find your next race
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d2b22] text-neon-lime">
              <ArrowUpRight
                size={15}
                className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </div>

        {/* ─── Columns ─── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-12 md:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4">
            <Link href="/" className="group relative inline-block h-16 w-16" aria-label="Merch Sports home">
              <span className="absolute inset-0 rounded-full bg-neon-lime opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-60" />
              <Image
                src="/MerchSports-small.png"
                alt="Merch Sports"
                width={64}
                height={64}
                className="relative z-10 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Inspiring runners to push beyond their limits. Join us for an unforgettable marathon experience.
            </p>
            <div className="mt-5 flex gap-2.5">
              {socials.map(({ icon: Icon, label, href }) =>
                href ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Merch Sports on ${label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-white/20 transition hover:bg-neon-lime hover:text-[#0d2b22] hover:ring-neon-lime"
                  >
                    <Icon size={17} aria-hidden />
                  </a>
                ) : (
                  // No link yet: shown, but not clickable.
                  <span
                    key={label}
                    title={`${label} coming soon`}
                    aria-label={`${label} (coming soon)`}
                    className="flex h-10 w-10 cursor-default items-center justify-center rounded-full ring-1 ring-white/20 text-white/70"
                  >
                    <Icon size={17} aria-hidden />
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <LinkColumn title="Explore" links={exploreLinks} />
          </div>
          <div className="md:col-span-2">
            <LinkColumn title="Help" links={helpLinks} />
          </div>

          {/* Contact */}
          <div className="col-span-2 md:col-span-4">
            <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50" style={{ fontFamily: "var(--font-body)" }}>Contact</h4>
            <ul className="space-y-3">
              {[
                { icon: Mail, text: EMAIL, href: `mailto:${EMAIL}` },
                { icon: Phone, text: PHONE, href: `tel:${PHONE}` },
                { icon: MapPin, text: ADDRESS },
              ].map(({ icon: Icon, text, href }) => {
                const body = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition group-hover:bg-neon-lime/15">
                      <Icon size={16} className="text-neon-lime" aria-hidden />
                    </span>
                    <span className="min-w-0 break-words">{text}</span>
                  </>
                );
                return (
                  <li key={text}>
                    {href ? (
                      <a href={href} className="group flex items-center gap-3 text-sm text-white/75 transition-colors hover:text-neon-lime">
                        {body}
                      </a>
                    ) : (
                      <p className="group flex items-center gap-3 text-sm text-white/75">{body}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-white/45">
            © <CurrentYear /> Merch Sports. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-2 text-xs text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-lime" aria-hidden />
            Made for runners in Bangladesh
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
