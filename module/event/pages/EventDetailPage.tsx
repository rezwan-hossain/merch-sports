// module/event/pages/EventDetailPage.tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import type { EventData } from "@/types/event";
import EventInfoCard from "../components/EventInfoCard";
import ShareButtons from "../components/ShareButtons";
import { formatEventTime, formatEventTimeUTC } from "@/utils/date";
import { ViewContentTracker } from "@/components/tracking/ViewContentTracker";
import RichDescription from "../components/RichDescription";
import EventHero from "../components/EventHero";

// Dynamic imports for non-critical components
const TicketSelector = dynamic(() => import("../components/TicketSelector"), {
  loading: () => <TicketSelectorSkeleton />,
});

const CountdownTimer = dynamic(() => import("../components/CountdownTimer"), {
  loading: () => <div className="h-24 bg-gray-100 animate-pulse rounded-xl" />,
});

// const EventDescription = dynamic(
//   () => import("../components/EventDescription"),
//   {
//     loading: () => (
//       <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
//     ),
//   },
// );

type EventDetailPageProps = {
  event: EventData;
  searchParams?: { view?: string };
};

type ViewMode = "styled" | "unstyled";

// Pre-compute formatted values on server
function formatEventDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// function formatEventTime(time: string | Date): string {
//   return new Date(time).toLocaleTimeString("en-US", {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

const EventDetailPage = ({ event, searchParams }: EventDetailPageProps) => {
  const view: ViewMode =
    (searchParams?.view as ViewMode) === "styled" ? "styled" : "unstyled";
  const isUnstyled = view === "unstyled";

  const isCompleted = event.status === "COMPLETED";

  // Pre-compute on server
  const formattedDate = formatEventDate(event.date);
  // const formattedTime = formatEventTime(event.time);
  const formattedTime = formatEventTimeUTC(event.time);

  // If user selects different package, that is fine
  // InitiateCheckout will fire with exact package on checkout page
  const firstPackage = event.packages?.[0];

  return (
    <div className="min-h-screen bg-background">
      {/* ✅ Fires ViewContent on page load */}

      {firstPackage && (
        <ViewContentTracker
          product={{
            id: String(firstPackage.id),
            name: event.name,
            price: Number(firstPackage.price),
            packageName: firstPackage.name,
            distance: firstPackage.distance,
          }}
        />
      )}

      <EventHero event={event} />

      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 ${
          isCompleted ? "grayscale opacity-60" : ""
        }`}
      >

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:gap-12">
          {/* Left column */}
          <div>

            <section className="mt-6 lg:mt-10">
              <div className="flex items-center justify-end mb-4">
                <Link
                  href={`?view=${isUnstyled ? "styled" : "unstyled"}`}
                  className="text-sm font-medium underline underline-offset-4"
                  prefetch={false}
                >
                  Switch to {isUnstyled ? "styled" : "unstyled"}
                </Link>
              </div>

              <h2 className="font-display text-3xl lg:text-4xl tracking-wide mb-6">
                EVENT DETAILS
              </h2>

              {isUnstyled ? (
                <div
                  className="prose mt-14 prose-slate [&>h2]:mt-12 [&>h2]:flex [&>h2]:items-center [&>h2]:font-mono [&>h2]:text-sm/7 [&>h2]:font-medium [&>h2]:text-slate-900 [&>h2]:before:mr-3 [&>h2]:before:h-3 [&>h2]:before:w-1.5 [&>h2]:before:rounded-r-full [&>h2]:before:bg-cyan-200 [&>h2:nth-of-type(3n)]:before:bg-violet-200 [&>h2:nth-of-type(3n+2)]:before:bg-indigo-200 [&>ul]:mt-6 [&>ul]:list-['\2013\20'] [&>ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              ) : (
                // <Suspense fallback={<DescriptionSkeleton />}>
                //   <EventDescription description={event.description} />
                // </Suspense>
                <RichDescription html={event.description} />
              )}
            </section>
          </div>

          {/* Right column - Sticky sidebar */}
          <aside className="lg:sticky lg:top-20 h-fit space-y-8 mt-10">
            <Suspense
              fallback={
                <div className="h-24 bg-gray-100 animate-pulse rounded-xl" />
              }
            >
              <CountdownTimer targetDate={new Date(event.date)} />
            </Suspense>

            <EventInfoCard
              status={event.status}
              date={formattedDate}
              time={formattedTime}
              address={event.address}
              eventType={event.eventType}
              organizer={event.organizer}
            />

            <Suspense fallback={<TicketSelectorSkeleton />}>
              <TicketSelector
                packages={event.packages}
                eventSlug={event.slug}
                eventId={event.id}
                registrationStatus={event.registrationStatus}
              />
            </Suspense>

            {event.status !== "COMPLETED" && event.status !== "CANCELLED" && (
              <ShareButtons
                slug={event.slug}
                eventName={event.name}
                place="event"
                siteUrl={process.env.NEXT_PUBLIC_SITE_URL}
                subtitle="Running with friends? Send them this race."
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

// Extracted components for better code splitting
const EventTypeBadge = ({ eventType }: { eventType: string }) => (
  <span
    className={`absolute top-4 right-4 px-4 py-1.5 text-xs font-semibold rounded-full ${
      eventType === "VIRTUAL"
        ? "bg-purple-500 text-white"
        : "bg-neon-lime text-white"
    }`}
  >
    {eventType === "LIVE" ? "UPCOMING" : eventType}
  </span>
);

// Skeleton components
const TicketSelectorSkeleton = () => (
  <div className="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
    <div className="space-y-3">
      <div className="h-12 bg-gray-200 rounded" />
      <div className="h-12 bg-gray-200 rounded" />
      <div className="h-12 bg-gray-200 rounded" />
    </div>
    <div className="h-12 bg-gray-200 rounded mt-4" />
  </div>
);

const DescriptionSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-full" />
    <div className="h-4 bg-gray-200 rounded w-5/6" />
    <div className="h-4 bg-gray-200 rounded w-4/6" />
    <div className="h-4 bg-gray-200 rounded w-full" />
  </div>
);

export default EventDetailPage;
