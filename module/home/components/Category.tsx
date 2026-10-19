// module/home/components/Category.tsx
//
// "Choose your distance": one card per race distance, in the homepage style
// (big left-aligned heading with a lime line, rounded cards, one dark-green
// featured card). The distance is the card's hero: a big condensed "15K".
import { ArrowUpRight, Bolt, Gauge, Star, Trophy } from "lucide-react";
import Link from "next/link";

type Category = {
  distance: string; // "15K"
  name: string; // "Endurance run"
  description: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  featured?: boolean;
};

const categories: Category[] = [
  { distance: "1K", name: "Kids run", description: "A lively dash for beginners and families.", icon: Bolt },
  { distance: "7.5K", name: "Fun run", description: "Test your pace on our certified flat course.", icon: Gauge },
  {
    distance: "15K",
    name: "Endurance run",
    description: "The definitive test of strength and endurance.",
    icon: Star,
    featured: true,
  },
  { distance: "21K", name: "Half marathon", description: "The ultimate achievement for elite athletes.", icon: Trophy },
];

// Where "Join" takes people: the events list, where they pick a race.
const JOIN_HREF = "/events";

export default function Categories() {
  return (
    <section id="categories" aria-labelledby="categories-title" className="px-4 md:px-8 py-20 md:py-24">
      <div className="max-w-7xl mx-auto">
        {/* Header (same style as the other homepage sections) */}
        <div className="mb-10 md:mb-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2
            id="categories-title"
            className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.9] tracking-tight text-[#0d2b22]"
          >
            Your
            <br />
            <span className="text-neon-lime">distance</span>
          </h2>
          <p className="max-w-sm pb-1 text-sm md:text-base leading-relaxed text-gray-600 md:text-right">
            From a first family dash to a full half marathon, there&apos;s a start line for every runner.
          </p>
        </div>

        {/* Cards: 1 per row on small phones, 2 on larger phones/tablets, 4 on desktop */}
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {categories.map(({ distance, name, description, icon: Icon, featured }) => (
            <article
              key={distance}
              className={`group flex min-w-0 flex-col rounded-2xl p-5 sm:p-7 transition-transform duration-300 hover:-translate-y-1 ${
                featured
                  ? "bg-[#0d2b22] text-white"
                  : "bg-white text-[#0d2b22] ring-1 ring-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${
                    featured ? "bg-neon-lime text-[#0d2b22]" : "bg-neon-lime/15 text-[#0d2b22]"
                  }`}
                >
                  <Icon size={22} aria-hidden />
                </span>
                {featured && (
                  <span className="rounded-full bg-neon-lime/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neon-lime">
                    Popular
                  </span>
                )}
              </div>

              <h3 className="mt-6">
                <span className="block font-[family-name:var(--font-heading)] text-5xl leading-none tracking-tight sm:text-6xl">
                  {distance}
                </span>
                <span
                  className={`mt-2 block text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-xs ${
                    featured ? "text-neon-lime" : "text-gray-500"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {name}
                </span>
              </h3>
              <p className={`mt-3 flex-1 text-sm leading-relaxed ${featured ? "text-white/75" : "text-gray-600"}`}>
                {description}
              </p>

              <Link
                href={JOIN_HREF}
                className={`mt-6 inline-flex items-center justify-between gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-[13px] font-semibold transition ${
                  featured
                    ? "bg-neon-lime text-[#0d2b22] hover:brightness-105"
                    : "bg-gray-100 text-[#0d2b22] hover:bg-[#0d2b22] hover:text-white"
                }`}
                aria-label={`Join the ${distance} ${name.toLowerCase()}`}
              >
                Join {distance}
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    featured ? "bg-[#0d2b22] text-neon-lime" : "bg-white text-[#0d2b22]"
                  }`}
                >
                  <ArrowUpRight
                    size={14}
                    className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
