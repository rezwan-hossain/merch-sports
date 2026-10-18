import { getActiveHero } from "@/app/actions/homepage";
import { getEventBySlug } from "@/app/actions/event";
// Previous hero (full-screen image + countdown), kept for reference:
// import HeroSection from "../components/HeroSection";
import HeroShowcase, { eventSlugFromLink } from "../components/HeroShowcase";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import StatsCounter from "../components/StatsCounter";
import CourseHighlights from "../components/CourseHighlights";
import Ambassador from "../components/Ambassador";
// Server component (reads the FAQ from the database), so imported directly.
import FAQ from "../components/FAQ";

// ✅ Lazy load everything below the fold
const UpcomingEvents = dynamic(() => import("../components/UpcomingEvent"), {
  loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
});

const EventSchedule = dynamic(() => import("../components/EventSchedule"), {
  loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
});

const CTASection = dynamic(() => import("../components/CTASection"));
const Categories = dynamic(() => import("../components/Category"));
const Testimonials = dynamic(() => import("../components/Testimonials"));
const Sponsors = dynamic(() => import("../components/Sponsors"));
const RegisterCTA = dynamic(() => import("../components/RegisterCTA"));

export default async function Homepage() {
  const { hero } = await getActiveHero();
  // The event the hero links to: venue, start time, classes, registration status.
  const heroEventSlug = eventSlugFromLink(hero?.slug);
  const heroEvent = heroEventSlug ? (await getEventBySlug(heroEventSlug)).event : null;

  return (
    <main role="main" aria-label="Homepage">
      {/* ✅ Only hero loads immediately */}
      <section aria-label="Hero">
        {/* <HeroSection hero={hero} /> */}
        <HeroShowcase hero={hero} event={heroEvent ?? null} />
      </section>

      {/* ✅ Everything else loads after hero is visible */}
      <Suspense fallback={<div className="h-96" />}>
        <section aria-label="UpComing Event">
          <UpcomingEvents />
        </section>
      </Suspense>

      <Suspense fallback={<div className="h-96" />}>
        <section aria-label="Event Schedule">
          <EventSchedule />
        </section>
      </Suspense>

      <Suspense fallback={<div className="h-96" />}>
        <section aria-label="Event Schedule">
          <Ambassador />
        </section>
      </Suspense>

      <StatsCounter />

      <CTASection />
      <Categories />
      <Testimonials />
      <Sponsors />
      <Suspense fallback={null}>
        <FAQ />
      </Suspense>
      <RegisterCTA />
    </main>
  );
}
