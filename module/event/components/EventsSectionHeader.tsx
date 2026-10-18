// module/event/components/EventsSectionHeader.tsx
/**
 * Big two-line title ("UPCOMING / EVENTS") with a short intro and the count on
 * the right. Shared by the events page and the homepage.
 */
export default function EventsSectionHeader({
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
            <p
              className={`${intro ? "mt-3" : ""} text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400`}
            >
              {count} {count === 1 ? "event" : "events"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
