// app/sitemap.ts → /sitemap.xml
// Public pages plus every event that isn't archived. Cached; refreshed when
// events change (same "events" tag the event pages use).
import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/seo";

async function publicEvents() {
  "use cache";
  cacheLife("hours");
  cacheTag("events");
  return prisma.event.findMany({
    where: { isArchived: false, isActive: true },
    select: { slug: true, updatedAt: true, status: true },
    orderBy: { date: "desc" },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await publicEvents().catch(() => []);
  const pages: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/gallery`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/teams`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE.url}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE.url}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/privacy-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...pages,
    ...events.map((e) => ({
      url: `${SITE.url}/events/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency: "weekly" as const,
      priority: e.status === "ACTIVE" ? 0.8 : 0.5,
    })),
  ];
}
