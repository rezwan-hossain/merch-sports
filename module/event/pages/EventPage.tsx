import { HeroText } from "@/components/ui/HeroText";
import EventImageCard from "../components/EventImageCard";
import { EventData } from "@/types/event";

type EventsPageProps = {
  upcomingEvents: EventData[];
  previousEvents: EventData[];
  error?: string;
};

const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5";

/**
 * Big two-line title ("UPCOMING / EVENTS") with a short intro and the count on
 * the right. The first section's title is the page's h1.
 */
function SectionHeader({
  first,
  count,
  id,
  as: Heading = "h2",
  intro,
}: {
  first: string;
  count: number;
  id: string;
  as?: "h1" | "h2";
  intro?: string;
}) {
  return (
    <div className="mt-10 mb-8 md:mb-12 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div>
        <Heading
          id={id}
          className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.90] tracking-tight text-[#0d2b22]"
        >
          {first}
          <br />
          <span className="text-neon-lime">Events</span>
        </Heading>
      </div>

      {(intro || count > 0) && (
        <div className="max-w-sm pb-1 md:text-right">
          {intro && (
            <p className="text-sm md:text-base leading-relaxed text-gray-600">
              {intro}
            </p>
          )}
          {count > 0 && (
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
              {count} {count === 1 ? "event" : "events"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const EventsPage = ({ upcomingEvents, previousEvents }: EventsPageProps) => {
  return (
    <div className="min-h-screen bg-background px-4 md:px-8 pt-32 md:pt-40 pb-20 md:pb-28">
      {/* Upcoming: the page's main heading */}
      <div className="mt-42">
        <HeroText title="Events" />
      </div>

      <section aria-labelledby="upcoming-events" className="max-w-7xl mx-auto">
        <SectionHeader
          id="upcoming-events"
          first="Upcoming"
          count={upcomingEvents.length}
          intro=" Grab your spot before it fills up."
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
          className="max-w-7xl mx-auto mt-20 md:mt-28 border-t border-gray-200 pt-16 md:pt-20"
        >
          <SectionHeader
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
    </div>
  );
};

export default EventsPage;
