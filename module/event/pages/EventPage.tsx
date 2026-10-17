import { HeroText } from "@/components/ui/HeroText";
import EventImageCard from "../components/EventImageCard";
import { EventData } from "@/types/event";

type EventsPageProps = {
  upcomingEvents: EventData[];
  previousEvents: EventData[];
  error?: string;
};

const GRID =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mt-4 md:mt-6 lg:mt-8";

/** Big two-line section title ("UPCOMING / EVENTS") with a count on the right. */
function SectionHeader({
  first,
  count,
  id,
}: {
  first: string;
  count: number;
  id: string;
}) {
  return (
    <div className="mb-10 md:mb-16 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <h2
        id={id}
        className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.88] tracking-tight text-[#0d2b22]"
      >
        {first}
        <br />
        <span className="text-neon-lime">Events</span>
      </h2>
      {count > 0 && (
        <p className="pb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          {count} {count === 1 ? "event" : "events"}
        </p>
      )}
    </div>
  );
}

const EventsPage = ({ upcomingEvents, previousEvents }: EventsPageProps) => {
  return (
    <div className="min-h-screen bg-background px-4 md:px-8 py-4 md:py-8">
      <div className="mt-42">
        <HeroText title="Events" />
      </div>

      {/* Upcoming */}
      <section
        aria-labelledby="upcoming-events"
        className="max-w-7xl mx-auto mt-12"
      >
        <SectionHeader
          id="upcoming-events"
          first="Upcoming"
          count={upcomingEvents.length}
        />

        {upcomingEvents.length > 0 ? (
          <div className={GRID}>
            {upcomingEvents.map((event, index) => (
              // The first row is on screen at load: fetch those images first.
              <EventImageCard
                key={event.id}
                event={event}
                priority={index < 3}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
            <p className="font-semibold text-gray-900">
              New events are coming soon.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Check back shortly, or follow us for announcements.
            </p>
          </div>
        )}
      </section>

      {/* Previous: only when there are some */}
      {previousEvents.length > 0 && (
        <section
          aria-labelledby="previous-events"
          className="max-w-7xl mx-auto mt-20 md:mt-28"
        >
          <SectionHeader
            id="previous-events"
            first="Previous"
            count={previousEvents.length}
          />
          <div className={GRID}>
            {previousEvents.map((event) => (
              <EventImageCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default EventsPage;
