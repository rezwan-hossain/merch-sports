// module/event/components/EventHero.tsx
//
// Top of the event page: title, wide banner, and a one-line info strip
// (date · start · distances · from-price · venue).
import Link from "next/link";
import { getImageProps } from "next/image";
import { ArrowLeft, Calendar, ChevronRight, Clock, MapPin, Route, Ticket } from "lucide-react";
import type { EventData } from "@/types/event";
import { formatEventTimeUTC } from "@/utils/date";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/**
 * "42 · 21.1 · 10 · 5 km" from package distances like "21K", "21.1KM", "7.5 km".
 * Falls back to the raw names if a distance isn't a plain number of km.
 */
function distancesLabel(event: EventData): string | null {
  const raw = [
    ...new Set(
      (event.packages ?? []).map((p) => p.distance.trim()).filter(Boolean),
    ),
  ];
  if (raw.length === 0) return null;
  const km = raw.map((d) => {
    const m = /^(\d+(?:\.\d+)?)\s*k(?:m)?$/i.exec(d);
    return m ? Number(m[1]) : null;
  });
  if (km.every((n): n is number => n !== null)) {
    return `${[...new Set(km)].sort((a, b) => b - a).join(" · ")} km`;
  }
  return raw.join(" · ");
}

function fromPrice(event: EventData): number | null {
  const prices = (event.packages ?? [])
    .filter((p) => p.isActive !== false)
    .map((p) => p.price);
  if (prices.length > 0) return Math.min(...prices);
  return event.minPackagePrice ?? null;
}

function InfoCell({
  label,
  icon: Icon,
  children,
  className = "",
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // Phones: a small white tile with an icon (ring, not border, so the
    // desktop dividers are untouched). From md up: exactly the original cell.
    <div
      className={`min-w-0 flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-gray-200
        md:block md:rounded-none md:bg-transparent md:ring-0 md:p-0 md:py-5 ${className}`}
    >
      <span className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neon-lime/15 text-[#0d2b22]">
        <Icon size={15} aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          {label}
        </dt>
        <dd className="mt-0.5 md:mt-1.5 text-[13px] md:text-base font-semibold text-gray-900 leading-snug break-words">
          {children}
        </dd>
      </div>
    </div>
  );
}

export default function EventHero({ event }: { event: EventData }) {
  // One image per device: phones the thumbnail, larger screens the banner.
  // A single <img> = only one download, fetched first (it's the LCP element).
  const common = { alt: event.name, quality: 75 };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: event.bannerImage,
    width: 1600,
    height: 640,
    sizes: "(min-width: 1280px) 1216px, 94vw",
  });
  const {
    props: { srcSet: mobileSrcSet, ...mobileProps },
  } = getImageProps({
    ...common,
    src: event.thumbImage || event.bannerImage,
    width: 800,
    height: 600,
    sizes: "100vw",
  });

  const price = fromPrice(event);
  const distances = distancesLabel(event);

  return (
    <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-36">
      {/* Title */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 text-sm text-gray-500 mb-6 md:mb-8"
      >
        <Link
          href="/events"
          className="inline-flex shrink-0 items-center gap-1.5 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={16} aria-hidden /> All events
        </Link>
        <ChevronRight
          size={14}
          className="shrink-0 text-gray-400"
          aria-hidden
        />
        {/* Inline font: the site's global h1 rule would make it the big condensed face. */}
        <h1
          className="min-w-0 truncate text-sm font-medium text-gray-700"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {event.name}
        </h1>
      </nav>

      {/* Banner */}
      <div className="overflow-hidden rounded-2xl bg-gray-100">
        <picture>
          <source
            media="(min-width: 768px)"
            srcSet={desktopSrcSet}
            sizes="(min-width: 1280px) 1216px, 94vw"
          />
          <img
            {...mobileProps}
            srcSet={mobileSrcSet}
            alt={event.name}
            loading="eager"
            fetchPriority="high"
            className={`block w-full aspect-[4/3] md:aspect-[21/9] object-cover ${
              event.status === "COMPLETED" ? "grayscale" : ""
            }`}
          />
        </picture>
      </div>

      {/* Info strip */}
      <dl className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:gap-0 md:grid-cols-5 md:border-b md:border-gray-200 md:divide-x md:divide-gray-200 [&>div]:md:px-5 [&>div:first-child]:md:pl-0">
        <InfoCell label="Date" icon={Calendar}>{dateFmt.format(new Date(event.date))}</InfoCell>
        <InfoCell label="Start" icon={Clock} className="md:pl-5">
          {formatEventTimeUTC(event.time)}
        </InfoCell>
        <InfoCell label="Distances" icon={Route}>
          {distances ?? "TBA"}
        </InfoCell>
        <InfoCell label="From" icon={Ticket} className="md:pl-5">
          {price === null
            ? "TBA"
            : price === 0
              ? "Free"
              : `৳${price.toLocaleString("en-IN")}`}
        </InfoCell>
        <InfoCell label="Venue" icon={MapPin} className="col-span-2 md:col-span-1 text-sm">
          {event.eventType === "VIRTUAL"
            ? `Virtual · ${event.address}`
            : event.address}
        </InfoCell>
      </dl>
    </header>
  );
}
