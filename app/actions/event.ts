// "use server";

import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag } from "next/cache";

export async function getAllEvents() {
  "use cache"; // ✅ Opt into data-level caching
  cacheLife("days"); // ✅ Cache duration
  cacheTag("events"); // ✅ Tag for global invalidation

  try {
    const events = await prisma.event.findMany({
      where: {
        isActive: true,
        isArchived: false,
      },
      include: {
        organizer: true,
        packages: {
          where: { isActive: true },
          orderBy: { price: "asc" },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return { events };
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return { events: [], error: "Failed to fetch events" };
  }
}

export async function getEventBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("events", `event-${slug}`); // ✅ Specific tag for this event

  try {
    // Deactivated / deleted events aren't public: the page shows "not found".
    const event = await prisma.event.findFirst({
      where: { slug, isActive: true, isArchived: false },
      include: {
        organizer: true,
        packages: {
          where: { isActive: true },
          orderBy: { price: "asc" },
        },
      },
    });

    return { event };
  } catch (error) {
    console.error("Failed to fetch event:", error);
    return { event: null, error: "Failed to fetch event" };
  }
}

export async function getUpcomingEvents(limit: number = 3) {
  "use cache";
  cacheLife("days");
  cacheTag("events", "upcoming-events");
  try {
    const events = await prisma.event.findMany({
      where: {
        isActive: true,
        isArchived: false,
        status: "ACTIVE",
        // ✅ Removed date filter — shows all active events
        // date: { gte: new Date() },
      },
      include: {
        organizer: true,
        packages: {
          where: { isActive: true },
          orderBy: { price: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    // return { events: JSON.parse(JSON.stringify(events)) };
    return { events };
  } catch (error) {
    console.error("Failed to fetch upcoming events:", error);
    return { events: [], error: "Failed to fetch upcoming events" };
  }
}

export async function getPreviousEvents(limit: number = 3) {
  "use cache";
  cacheLife("days");
  cacheTag("events", "previous-events");

  try {
    const events = await prisma.event.findMany({
      where: {
        // Deactivated / deleted events stay hidden here too.
        isActive: true,
        isArchived: false,
        status: "COMPLETED",
        // ✅ Only fetch events where the date is in the past
        date: { lt: new Date() },
      },
      include: {
        organizer: true,
        packages: {
          where: { isActive: true },
          orderBy: { price: "asc" },
        },
      },
      // ✅ Sort by date descending (most recently finished events first)
      orderBy: { date: "desc" },
      take: limit,
    });

    return { events };
  } catch (error) {
    console.error("Failed to fetch previous events:", error);
    return { events: [], error: "Failed to fetch previous events" };
  }
}
