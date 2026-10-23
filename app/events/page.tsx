import type { Metadata } from "next";
import EventPage from "@/module/event/pages/EventPage";
import { getAllEvents } from "../actions/event";
import { getUpcomingEvents, getPreviousEvents } from "../actions/event";

export const metadata: Metadata = {
  title: "Upcoming running events",
  description:
    "half marathons, fun runs and virtual runs across Bangladesh. See dates, distances and prices, and register online with Merch Sports.",
  alternates: { canonical: "/events" },
  openGraph: {
    url: "/events",
    title: "Upcoming running events | Merch Sports",
  },
};

export default async function page() {
  // const { events, error } = await getAllEvents();
  const [
    { events: upcomingEvents = [], error: upcomingError },
    { events: previousEvents = [], error: previousError },
  ] = await Promise.all([getUpcomingEvents(6), getPreviousEvents(6)]);

  // return <EventPage events={events} error={error} />;
  return (
    <EventPage
      upcomingEvents={upcomingEvents}
      previousEvents={previousEvents}
      error={upcomingError || previousError}
    />
  );
}
