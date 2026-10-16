// module/event/components/EventImageCard.tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { EventData } from "@/types/event";
import { formatEventTimeUTC } from "@/utils/date";

// Day and month in Dhaka time, so "16 DEC" matches the event page.
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "Asia/Dhaka" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Dhaka" });

/** Cheapest package that is still on sale; falls back to the stored minimum. */
function fromPrice(event: EventData): number | null {
  const prices = (event.packages ?? []).filter((p) => p.isActive !== false).map((p) => p.price);
  if (prices.length > 0) return Math.min(...prices);
  return event.minPackagePrice ?? null;
}

function cta(status: EventData["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "Register";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "View details";
  }
}

export default function EventImageCard({ event, priority = false }: { event: EventData; priority?: boolean }) {
  const date = new Date(event.date);
  const price = fromPrice(event);
  const isPast = event.status === "COMPLETED" || event.status === "CANCELLED";

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
        className={`object-cover transition-transform duration-500 group-hover:scale-105 ${isPast ? "grayscale" : ""}`}
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

      {/* Category */}
      <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-900">
        {event.eventType === "VIRTUAL" ? "Virtual run" : "Running"}
      </span>

      {/* Date: outlined day, month below */}
      <div className="absolute right-4 top-3 text-right leading-none text-white">
        <span className="block font-[family-name:var(--font-heading)] text-6xl tracking-normal text-transparent [-webkit-text-stroke:1.5px_white]">
          {dayFmt.format(date)}
        </span>
        {/* -mr cancels the gap letter-spacing leaves after the last letter,
            so the month's right edge lines up with the number's. */}
        <span className="mt-1 block mr-[-0.1em] text-xs font-bold uppercase tracking-widest">{monthFmt.format(date)}</span>
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

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/20 pt-4">
          <span className="font-[family-name:var(--font-heading)] text-3xl tracking-wide">
            {price === null ? "TBA" : price === 0 ? "Free" : `৳${price.toLocaleString("en-IN")}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors group-hover:bg-neon-lime group-hover:text-white">
            {cta(event.status)}
            {!isPast && <ArrowRight size={14} aria-hidden />}
          </span>
        </div>
      </div>
    </Link>
  );
}
