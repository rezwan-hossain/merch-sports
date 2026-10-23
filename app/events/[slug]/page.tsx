// app/events/[slug]/page.tsx
import type { Metadata } from "next";
import { getEventBySlug } from "@/app/actions/event";
import EventDetailPage from "@/module/event/pages/EventDetailPage";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import EventDetailSkeleton from "@/module/event/components/EventDetailSkeleton";
import JsonLd from "@/components/seo/JsonLd";
import { SITE, breadcrumbJsonLd, eventDescription, eventJsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
};

// ── Dynamic Metadata ─────────────────────────
// The preview image comes from ./opengraph-image.tsx (Next adds it for us).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await getEventBySlug(slug);

  if (!event) {
    return { title: "Event not found", robots: { index: false } };
  }

  const date = new Date(event.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
  const description = `${eventDescription(event)} · ${date} · ${event.address}`.slice(0, 300);
  const path = `/events/${slug}`;

  return {
    title: event.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_US",
      url: path,
      title: event.name,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description,
    },
  };
}

// ── Page Component ───────────────────────────
export default async function Page({ params, searchParams }: Props) {
  // Move data fetching into a suspended component
  return (
    <Suspense fallback={<EventDetailSkeleton />}>
      <EventPageContent paramsPromise={params} searchParams={searchParams} />
    </Suspense>
  );
}

// This component handles the data fetching and will be suspended
async function EventPageContent({
  paramsPromise,
  searchParams,
}: {
  paramsPromise: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await paramsPromise;
  const { event, error } = await getEventBySlug(slug);
  const resolvedSearchParams = await searchParams;

  if (!event || error) {
    notFound();
  }

  return (
    <>
      {/* Structured data: Google event rich results + breadcrumb trail */}
      <JsonLd
        data={[
          eventJsonLd(event),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
            { name: event.name, path: `/events/${event.slug}` },
          ]),
        ]}
      />
      <EventDetailPage event={event} searchParams={resolvedSearchParams} />
    </>
  );
}
