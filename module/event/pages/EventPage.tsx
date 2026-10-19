import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarClock, ChevronRight } from "lucide-react";
import EventImageCard from "../components/EventImageCard";
import EventsSectionHeader from "../components/EventsSectionHeader";
import { EventData } from "@/types/event";

type EventsPageProps = {
  upcomingEvents: EventData[];
  previousEvents: EventData[];
  error?: string;
};

const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5";

const EventsPage = ({ upcomingEvents, previousEvents }: EventsPageProps) => {
  return (
    <div className="min-h-screen bg-background px-4 md:px-8 pt-28 md:pt-36 pb-20 md:pb-28">
      {/* ─── Upcoming: its heading is the page title ─── */}
      <section aria-labelledby="upcoming-events" className="max-w-7xl mx-auto">
        {/* Breadcrumb (same as the event details page) */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="inline-flex items-center gap-1.5 transition-colors hover:text-gray-900">
            <ArrowLeft size={16} aria-hidden /> Home
          </Link>
          <ChevronRight size={14} className="text-gray-400" aria-hidden />
          <span className="font-medium text-gray-900" aria-current="page">
            Events
          </span>
        </nav>

        <EventsSectionHeader
          as="h1"
          id="upcoming-events"
          first="Upcoming"
          count={upcomingEvents.length}
          intro="Grab your spot before it fills up."
        />

        {upcomingEvents.length > 0 ? (
          <div className={GRID}>
            {upcomingEvents.map((event, index) => (
              // The first row is on screen at load: fetch those images first.
              <EventImageCard key={event.id} event={event} priority={index < 3} />
            ))}
          </div>
        ) : (
          // Nothing scheduled: a friendly panel instead of an empty grid.
          <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0d2b22] px-6 py-14 text-center text-white sm:px-10 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-neon-lime/15 blur-3xl" />
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neon-lime/15 text-neon-lime">
              <CalendarClock size={26} aria-hidden />
            </span>
            <p
              className="mt-5 text-4xl uppercase leading-none tracking-tight sm:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              New races <span className="text-neon-lime">coming soon</span>
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm sm:text-base text-white/70">
              We&apos;re lining up the next start line. Follow us so you don&apos;t miss registration.
            </p>
            <a
              href="https://www.facebook.com/profile.php?id=61566321857186"
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-7 inline-flex items-center gap-2 rounded-full bg-neon-lime py-1.5 pl-5 pr-1.5 text-sm font-semibold text-[#0d2b22] transition hover:brightness-105"
            >
              Follow on Facebook
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d2b22] text-neon-lime">
                <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </span>
            </a>
          </div>
        )}
      </section>

      {/* ─── Previous (only when there are some) ─── */}
      {previousEvents.length > 0 && (
        <section
          aria-labelledby="previous-events"
          className="max-w-7xl mx-auto mt-20 md:mt-28 border-t border-gray-200 pt-6 md:pt-8"
        >
          <EventsSectionHeader
            id="previous-events"
            first="Previous"
            count={previousEvents.length}
            intro="Races we've run together. Thank you to every runner, volunteer and supporter."
          />
          <div className={GRID}>
            {previousEvents.map((event) => (
              <EventImageCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Help strip ─── */}
      <aside className="max-w-7xl mx-auto mt-16 md:mt-20 flex flex-col items-start justify-between gap-4 rounded-2xl bg-white p-6 ring-1 ring-gray-200 sm:flex-row sm:items-center sm:p-7">
        <div>
          <p className="font-semibold text-gray-900">Questions before you register?</p>
          <p className="mt-1 text-sm text-gray-600">Distances, kits, payment or race day — we&apos;re happy to help.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/#faq"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#0d2b22] ring-1 ring-gray-300 transition hover:bg-gray-50"
          >
            Read the FAQ
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-full bg-[#0d2b22] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Contact us
          </Link>
        </div>
      </aside>
    </div>
  );
};

export default EventsPage;
