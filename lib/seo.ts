// lib/seo.ts
//
// Everything search engines and social apps read about the site:
//   - SITE: the business facts (one place, so metadata and JSON-LD agree)
//   - organizationJsonLd / websiteJsonLd: shown on the homepage
//   - eventJsonLd: one per event page → Google event rich results
//   - breadcrumbJsonLd: the "Home › Events › …" trail in search results
//
// JSON-LD is schema.org data in a <script type="application/ld+json"> tag
// (rendered by components/seo/JsonLd.tsx). Plain functions, no database.

import type { EventData } from "@/types/event";

export const SITE = {
  name: "Merch Sports",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://www.merchcommunication.com").replace(/\/$/, ""),
  description:
    "Merch Sports organises road races and virtual runs across Bangladesh — from family fun runs to the half marathon. Find an event, pick your distance and register online.",
  logo: "/MerchSports-small.png",
  email: "info@merchcommunication.com",
  phone: "+8801862221943",
  address: {
    streetAddress: "House 32, Road 08, Block H, Mirpur 2",
    addressLocality: "Dhaka",
    addressCountry: "BD",
  },
  // Only real profiles (search engines use these to link the brand).
  sameAs: ["https://www.facebook.com/profile.php?id=61566321857186"],
} as const;

export const absoluteUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${SITE.url}${path.startsWith("/") ? "" : "/"}${path}`;

type JsonLdObject = Record<string, unknown>;

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl(SITE.logo),
    description: SITE.description,
    email: SITE.email,
    telephone: SITE.phone,
    address: { "@type": "PostalAddress", ...SITE.address },
    sameAs: SITE.sameAs,
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    publisher: { "@id": `${SITE.url}/#organization` },
    inLanguage: ["en", "bn"],
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Start time as ISO 8601 in Dhaka time, e.g. "2026-12-25T05:00:00+06:00".
 * Event dates are stored as UTC midnight of the calendar day and times as
 * UTC wall-clock (see formatEventTimeUTC), so both are read in UTC.
 */
export function eventStartIso(event: Pick<EventData, "date" | "time">): string {
  const day = new Date(event.date).toISOString().slice(0, 10);
  const time = new Date(event.time).toISOString().slice(11, 19);
  return `${day}T${time}+06:00`;
}

/** Plain text from the admin's rich-text description (for search snippets). */
export function plainText(html: string, max = 300): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function eventDescription(event: Pick<EventData, "shortDesc" | "description" | "name">): string {
  return event.shortDesc?.trim() || plainText(event.description || "", 200) || event.name;
}

/** schema.org SportsEvent for one event page. */
export function eventJsonLd(event: EventData): JsonLdObject {
  const url = absoluteUrl(`/events/${event.slug}`);
  const isVirtual = event.eventType === "VIRTUAL";
  const cancelled = event.status === "CANCELLED";
  const canRegister = event.status === "ACTIVE" && (event.registrationStatus ?? "OPEN") === "OPEN";

  const place = {
    "@type": "Place",
    name: event.address,
    address: { "@type": "PostalAddress", streetAddress: event.address, addressCountry: "BD" },
  };

  const offers = (event.packages ?? [])
    .filter((p) => p.isActive !== false)
    .map((p) => ({
      "@type": "Offer",
      name: `${p.name} (${p.distance})`,
      price: p.price,
      priceCurrency: "BDT",
      url,
      availability:
        canRegister && p.availableSlots - p.usedSlots > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    }));

  const images = [event.bannerImage, event.thumbImage].filter(Boolean).map((src) => absoluteUrl(src as string));

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `${url}#event`,
    name: event.name,
    description: eventDescription(event),
    url,
    image: images,
    startDate: eventStartIso(event),
    eventStatus: cancelled ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: isVirtual
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location: isVirtual ? { "@type": "VirtualLocation", url } : place,
    organizer: {
      "@type": "Organization",
      name: event.organizer?.name || SITE.name,
      url: SITE.url,
    },
    ...(offers.length > 0 && { offers }),
    sport: "Running",
  };
}
