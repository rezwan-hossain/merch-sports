// module/home/components/HeroShowcase.tsx
//
// Homepage hero: a large rounded photo card (status, title, buttons)
// with an info bar overlapping its bottom edge (countdown · date · venue ·
// distance). Content comes from Manage Homepage (hero) plus the event the hero
// links to. Server component; only the day countdown runs in the browser.
import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowUpRight, Calendar, MapPin, Route, Timer } from "lucide-react";
import type { HeroSectionData } from "@/types/homepage";
import type { EventData } from "@/types/event";
import HeroCountdownDays from "./HeroCountdownDays";
import { distancesLabel } from "@/module/event/components/EventHero";

const ACCENT = "#c8102e"; // Bangladesh-flag red, as in the design
const LIME = "var(--color-neon-lime)"; // site lime green: the countdown

const FALLBACK_IMAGE =
  "https://i.ibb.co.com/60qs3s0k/gemini-3-1-flash-image-preview-nano-banana-2-a-make-this-image-in-t.png";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** "/events/<slug>" from the hero link, whether it's a path or a full URL. */
export function eventSlugFromLink(
  link: string | null | undefined,
): string | null {
  const m = /\/events\/([^/?#]+)/.exec(link ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}

type Status = {
  key: "open" | "soon" | "soldOut" | "closed";
  label: string;
  cta: string;
};

function statusOf(event: EventData | null): Status {
  const onSale = (event?.packages ?? []).filter((p) => p.isActive !== false);
  if (
    event?.registrationStatus === "COMING_SOON" ||
    (event && onSale.length === 0)
  )
    return { key: "soon", label: "Coming soon", cta: "Coming soon" };
  if (
    event?.registrationStatus === "SOLD_OUT" ||
    (onSale.length > 0 &&
      onSale.every((p) => p.availableSlots - p.usedSlots <= 0))
  )
    return { key: "soldOut", label: "Sold out", cta: "Sold out" };
  if (event?.registrationStatus === "CLOSED")
    return {
      key: "closed",
      label: "Registration closed",
      cta: "Registration closed",
    };
  return { key: "open", label: "Registration open", cta: "Register now" };
}

type Cell = {
  key: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean;
  }>;
  value: React.ReactNode;
  countdown?: boolean;
  wide?: boolean; // full width on phones/tablets
};

function InfoCell({ cell }: { cell: Cell }) {
  const Icon = cell.icon;
  const box = `min-w-0 bg-white px-4 py-3 sm:px-5 sm:py-4 lg:border-l lg:border-gray-200 lg:first:border-l-0 ${
    cell.wide ? "sm:col-span-2 lg:col-span-1" : ""
  }`;

  // Countdown: pulsing dot + "68 DAYS" on one line, centred in its cell.
  // (The "Countdown" label stays for screen readers only.)
  if (cell.countdown) {
    return (
      <div
        className={`${box} flex items-center`}
        style={{
          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${LIME} 14%, transparent), transparent 70%)`,
        }}
      >
        <dt className="sr-only">{cell.label}</dt>
        <dd className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: LIME }}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: LIME }}
            />
          </span>
          {cell.value}
        </dd>
      </div>
    );
  }

  return (
    <div className={box}>
      <dt className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
        <Icon size={13} className="text-gray-400" aria-hidden />
        {cell.label}
      </dt>
      <dd className="mt-1.5 text-sm sm:text-[15px] font-semibold leading-snug text-gray-900 line-clamp-2">
        {cell.value}
      </dd>
    </div>
  );
}

export default function HeroShowcase({
  hero,
  event,
}: {
  hero: HeroSectionData | null;
  event: EventData | null;
}) {
  const desktopSrc = hero?.desktopImage || FALLBACK_IMAGE;
  const mobileSrc = hero?.mobileImage || desktopSrc;
  const title = hero?.title || event?.name || "Run Beyond";
  const eventPath = event
    ? `/events/${event.slug}`
    : eventSlugFromLink(hero?.slug)
      ? `/events/${eventSlugFromLink(hero?.slug)}`
      : "/events";
  const target = hero?.eventDate ?? event?.date ?? null;
  const status = statusOf(event);
  const showButton = hero?.showSlugButton ?? true;
  // Past dates are handled in the browser (HeroCountdownDays): reading the
  // clock here would break the cached/prerendered homepage.
  const showCountdown = (hero?.showCountdown ?? true) && !!target;

  // One image per device, fetched first (it's the page's LCP element).
  const {
    props: { srcSet: desktopSet },
  } = getImageProps({
    src: desktopSrc,
    alt: "",
    width: 1920,
    height: 1080,
    quality: 75,
    sizes: "100vw",
  });
  const {
    props: { srcSet: mobileSet, ...imgProps },
  } = getImageProps({
    src: mobileSrc,
    alt: "",
    width: 900,
    height: 1200,
    quality: 75,
    sizes: "100vw",
  });

  // Info bar cells (only the ones we have data for).
  const cells: Cell[] = [];
  if (showCountdown)
    cells.push({
      key: "countdown",
      label: "Countdown",
      icon: Timer,
      countdown: true,
      wide: true,
      value: (
        <HeroCountdownDays
          target={new Date(target!).toISOString()}
          accent={LIME}
        />
      ),
    });
  if (target || event)
    cells.push({
      key: "date",
      label: "Date",
      icon: Calendar,
      value: event
        ? dateFmt.format(new Date(event.date))
        : dateFmt.format(new Date(target!)),
    });
  if (event?.address)
    cells.push({
      key: "venue",
      label: "Venue",
      icon: MapPin,
      value:
        event.eventType === "VIRTUAL"
          ? `Virtual · ${event.address}`
          : event.address,
    });
  const distance = event ? distancesLabel(event) : null;
  if (distance)
    cells.push({
      key: "distance",
      label: "Distance",
      icon: Route,
      value: distance,
    });

  // Phones: one column. Tablets: 2 columns, countdown on its own row, and an
  // odd last cell spans the row. Large screens: everything in one row.
  const afterCountdown = cells.filter((c) => !c.countdown);
  if (afterCountdown.length % 2 === 1)
    afterCountdown[afterCountdown.length - 1].wide = true;
  const cols = [
    "",
    "lg:grid-cols-1",
    "lg:grid-cols-2",
    "lg:grid-cols-3",
    "lg:grid-cols-4",
  ][cells.length];

  return (
    <section className="pb-6 md:px-5 md:pt-28">
      {/* Phones: the photo fills the first screen edge to edge (under the
          transparent header); the info bar sits below it. md+: rounded card. */}
      <div className="mx-auto max-w-[1600px]">
        {/* ─── Photo card ─── */}
        <div className="relative isolate overflow-hidden bg-[#0d2b22] h-svh min-h-[560px] md:h-[660px] md:min-h-0 md:rounded-[28px] lg:h-[min(86vh,840px)] lg:min-h-[620px]">
          <picture>
            <source
              media="(min-width: 768px)"
              srcSet={desktopSet}
              sizes="100vw"
            />
            <img
              {...imgProps}
              srcSet={mobileSet}
              alt=""
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          </picture>

          {/* Fades so white text stays readable on any photo */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10 md:bg-gradient-to-r md:from-black/75 md:via-black/35 md:to-transparent"
          />

          {/* Text + buttons */}
          <div className="absolute inset-x-0 bottom-0 px-5 pb-12 sm:px-10 md:inset-y-0 md:flex md:flex-col md:justify-center md:pb-20 lg:px-14">
            <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ACCENT }}
                aria-hidden
              />
              {status.label}
            </p>
            <h1 className="max-w-3xl text-[clamp(1.65rem,5.2vw,4.8rem)] uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.25)]">
              {title}
            </h1>

            {showButton && (
              <div className="mt-7">
                <Link
                  href={eventPath}
                  className="group inline-flex items-center gap-2 rounded-full bg-neon-lime px-3 py-2 text-xs font-semibold text-[#0d2b22] shadow-lg transition hover:brightness-105 active:scale-[0.98] sm:text-base"
                >
                  View details
                  <ArrowUpRight
                    size={16}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ─── Info bar, overlapping the card's bottom edge ─── */}
        {cells.length > 0 && (
          <div className="relative z-10 mx-4 mt-4 sm:mx-10 md:-mt-10 lg:mx-20">
            <dl
              // Phones/tablets: gap-px over grey = hairline dividers in any layout.
              // Large screens use borders: the site-wide 90% zoom rounds 1px gaps away.
              className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-px lg:gap-0 overflow-hidden rounded-2xl bg-gray-200 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/5`}
            >
              {cells.map((c) => (
                <InfoCell key={c.key} cell={c} />
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
