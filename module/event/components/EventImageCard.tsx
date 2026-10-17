// module/event/components/EventImageCard.tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { EventData } from "@/types/event";
import { formatEventTimeUTC } from "@/utils/date";

// Day and month in Dhaka time, so "16 DEC" matches the event page.
const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  timeZone: "Asia/Dhaka",
});
const monthFmt = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "Asia/Dhaka",
});

/** Cheapest package that is still on sale; falls back to the stored minimum. */
function fromPrice(event: EventData): number | null {
  const prices = (event.packages ?? [])
    .filter((p) => p.isActive !== false)
    .map((p) => p.price);
  if (prices.length > 0) return Math.min(...prices);
  return event.minPackagePrice ?? null;
}

type Availability = "open" | "soldOut" | "comingSoon" | "closed" | "past";

/**
 * What a visitor can do right now:
 *  - past: completed or cancelled
 *  - comingSoon: listed, but nothing on sale yet (no active package, or INACTIVE)
 *  - soldOut: on sale, but every package is full
 *  - open: at least one package has a free slot
 */
function availabilityOf(event: EventData): Availability {
  if (event.status === "COMPLETED" || event.status === "CANCELLED") return "past";
  // The admin's Registration setting comes first (lib/registration-status).
  if (event.registrationStatus === "COMING_SOON") return "comingSoon";
  if (event.registrationStatus === "SOLD_OUT") return "soldOut";
  if (event.registrationStatus === "CLOSED") return "closed";
  const onSale = (event.packages ?? []).filter((p) => p.isActive !== false);
  if (event.status === "INACTIVE" || onSale.length === 0) return "comingSoon";
  if (onSale.every((p) => p.availableSlots - p.usedSlots <= 0)) return "soldOut";
  return "open";
}

function cta(event: EventData, availability: Availability): string {
  switch (availability) {
    case "open":
      return "Register";
    case "soldOut":
      return "Sold out";
    case "comingSoon":
      return "Coming soon";
    case "closed":
      return "Closed";
    default:
      return event.status === "CANCELLED" ? "Cancelled" : "Completed";
  }
}

export default function EventImageCard({
  event,
  priority = false,
}: {
  event: EventData;
  priority?: boolean;
}) {
  const date = new Date(event.date);
  const price = fromPrice(event);
  const availability = availabilityOf(event);
  const isPast = availability === "past";
  const soldOut = availability === "soldOut";
  const comingSoon = availability === "comingSoon";
  const closed = availability === "closed";

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative block h-[400px] sm:h-[440px] overflow-hidden rounded-2xl bg-[#0d2b22] focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime focus-visible:ring-offset-2"
      aria-label={`${event.name}, ${dayFmt.format(date)} ${monthFmt.format(date)}`}
    >
      {/* Photo */}
      <Image
        src={event.thumbImage || event.bannerImage}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className={`object-cover transition-transform duration-500 group-hover:scale-105 ${isPast ? "grayscale" : soldOut ? "brightness-75" : ""}`}
      />

      {/* Dark green fade for the text at the bottom */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#0d2b22] via-[#0d2b22]/70 via-35% to-transparent to-65%"
      />

      {/* Soft shade behind the date, for light photos */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent"
      />

      {/* Category + availability */}
      <div className="absolute left-4 top-4 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-900">
          {event.eventType === "VIRTUAL" ? "Virtual run" : "Running"}
        </span>
        {soldOut && (
          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Sold out
          </span>
        )}
        {closed && (
          <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm">
            Registration closed
          </span>
        )}
        {comingSoon && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-lime opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-lime" />
            </span>
            Coming soon
          </span>
        )}
      </div>

      {/* Date: outlined day, month below */}
      <div className="absolute right-4 top-3 text-right leading-none text-white">
        <span className="block font-[family-name:var(--font-heading)] text-6xl tracking-normal text-transparent [-webkit-text-stroke:1.5px_white]">
          {dayFmt.format(date)}
        </span>
        {/* -mr cancels the gap letter-spacing leaves after the last letter,
            so the month's right edge lines up with the number's. */}
        <span className="mt-1 block mr-[-0.1em] text-xs font-bold uppercase tracking-widest">
          {monthFmt.format(date)}
        </span>
      </div>

      {/* Details */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 text-white">
        {/* Inline font: the site's global h3 rule (unlayered CSS) beats utility classes. */}
        <h3
          className="text-xl sm:text-2xl font-bold leading-tight line-clamp-2"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {event.name}
        </h3>
        <p className="mt-1.5 text-xs sm:text-sm text-white/80 line-clamp-1">
          {formatEventTimeUTC(event.time)} · {event.address}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/20 pt-4">
          <div className="leading-none">
            {price !== null && price > 0 && (
              <span className="mb-1 block text-[8px] font-semibold uppercase tracking-widest text-white/70">
                Starting from
              </span>
            )}
            <span
              className={`font-[family-name:var(--font-heading)] text-3xl tracking-wide ${
                soldOut ? "text-white/45 line-through decoration-2" : ""
              }`}
            >
              {price === null
                ? "TBA"
                : price === 0
                  ? "Free"
                  : `৳${price.toLocaleString("en-IN")}`}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              soldOut || closed || isPast
                ? "bg-white/15 text-white/80 ring-1 ring-white/25 backdrop-blur-sm"
                : availability === "open"
                  ? "bg-white text-gray-900 group-hover:bg-neon-lime group-hover:text-white"
                  : "bg-white text-gray-900"
            }`}
          >
            {cta(event, availability)}
            {(availability === "open" || comingSoon) && <ArrowRight size={14} aria-hidden />}
          </span>
        </div>
      </div>
    </Link>
  );
}
