import { HeroText } from "@/components/ui/HeroText";
import EventImageCard from "../components/EventImageCard";
import { EventData } from "@/types/event";

type EventsPageProps = {
  upcomingEvents: EventData[];
  previousEvents: EventData[];
  error?: string;
};

const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5";

const EventsPage = ({ upcomingEvents, previousEvents }: EventsPageProps) => {
  return (
    <div className="min-h-screen bg-background  px-4 md:px-8 py-4 md:py-8">
      <div className="mt-42 ">
        <HeroText title="Events" />
      </div>
      <div className="max-w-7xl mx-auto mt-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold uppercase leading-tighter text-gray-900 ">
            upcomming <br />
            <span className="text-neon-lime">events</span>
          </h2>
        </div>

        {upcomingEvents.length > 0 ? (
          <div className={GRID}>
            {upcomingEvents.map((event, index) => (
              // The first row is on screen at load: fetch those images first.
              <EventImageCard key={event.id} event={event} priority={index < 3} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">New events are coming soon.</p>
        )}
      </div>

      {previousEvents?.length ? (
        <div className="max-w-7xl mx-auto mt-20">
          <div className="text-center mb-16">
            <div className="text-lg uppercase tracking-widest text-gray-500">
              our
            </div>

            <h2 className="text-4xl md:text-6xl font-bold uppercase leading-tighter text-gray-900 ">
              previous <br />
              <span className="text-neon-lime">events</span>
            </h2>
          </div>

          <div className={GRID}>
            {previousEvents.map((event) => (
              <EventImageCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EventsPage;
