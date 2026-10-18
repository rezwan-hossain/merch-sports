import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getUpcomingEvents } from "@/app/actions/event";
import EventImageCard from "@/module/event/components/EventImageCard";
import EventsSectionHeader from "@/module/event/components/EventsSectionHeader";

// Homepage "Upcoming events": same heading and cards as the events page.
const SHOWN = 6; // up to two rows on desktop

export default async function UpcomingEvents() {
  const { events } = await getUpcomingEvents(SHOWN);

  if (events.length === 0) return null;

  return (
    <section aria-labelledby="home-upcoming-events" className="px-4 md:px-8 py-20 md:py-24">
      <div className="max-w-7xl mx-auto">
        <EventsSectionHeader id="home-upcoming-events" first="Upcoming" count={events.length} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {events.map((event) => (
            <EventImageCard key={event.id} event={event} />
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Link
            href="/events"
            className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-[#0d2b22] hover:text-neon-lime transition-colors"
          >
            View all events
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
