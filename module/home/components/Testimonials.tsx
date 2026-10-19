// module/home/components/Testimonials.tsx
//
// Runner stories, in the site's newer style: big left-aligned heading with a
// lime line, and quote cards (the first one dark green, like the CTA cards).
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Nipu Sen",
    role: "Ultra runner",
    avatar: "NS",
    text: "Running is my freedom, my discipline, and my purpose. What began as passion has grown into a relentless pursuit of ultra-distance endurance—where limits are tested and the mind is transformed.",
  },
  {
    name: "Sadia Akhter",
    role: "42K finisher · 2024 edition",
    avatar: "SA",
    text: "The organization was world-class. From bib collection to the finish line, everything ran like clockwork. The Hatirjheel stretch at sunrise is something I'll never forget. An experience of a lifetime.",
  },
  {
    name: "Mahmud Hossain",
    role: "5K family runner · 2024 edition",
    avatar: "MH",
    text: "Brought my whole family for the 5K! My kids absolutely loved it. The atmosphere was electric and the post-race festival was incredible. This is our annual tradition now — see you in 2025!",
  },
];

export default function Testimonials() {
  return (
    <section aria-labelledby="testimonials-title" id="testimonials" className="px-4 md:px-8 py-20 md:py-24">
      <div className="max-w-7xl mx-auto">
        {/* Header (same style as "Upcoming events") */}
        <div className="mb-10 md:mb-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2
            id="testimonials-title"
            className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.9] tracking-tight text-[#0d2b22]"
          >
            What they
            <br />
            <span className="text-neon-lime">say</span>
          </h2>
          <p className="max-w-sm pb-1 text-sm md:text-base leading-relaxed text-gray-600 md:text-right">
            Stories from the runners, families and finishers who&apos;ve joined us on the road.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {testimonials.map((t, i) => {
            const featured = i === 0;
            return (
              <figure
                key={t.name}
                className={`flex flex-col rounded-2xl p-6 sm:p-8 transition-transform duration-300 hover:-translate-y-1 ${
                  featured
                    ? "bg-[#0d2b22] text-white md:col-span-2 lg:col-span-1"
                    : "bg-white ring-1 ring-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                }`}
              >
                {/* Quote mark, in its own row above the text */}
                <Quote
                  aria-hidden
                  className={"mb-4 h-9 w-9 text-neon-lime"}
                  strokeWidth={1.75}
                />

                <blockquote
                  className={`flex-1 text-base sm:text-[17px] leading-relaxed ${
                    featured ? "text-white/85" : "text-gray-700"
                  }`}
                >
                  &ldquo;{t.text}&rdquo;
                </blockquote>

                <figcaption
                  className={`mt-8 flex items-center gap-3.5 border-t pt-5 ${
                    featured ? "border-white/10" : "border-gray-100"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-heading)] text-lg tracking-wide ${
                      featured ? "bg-neon-lime text-[#0d2b22]" : "bg-neon-lime/15 text-[#0d2b22]"
                    }`}
                    aria-hidden
                  >
                    {t.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-semibold ${featured ? "text-white" : "text-gray-900"}`}>{t.name}</span>
                    <span
                      className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        featured ? "text-neon-lime" : "text-gray-500"
                      }`}
                    >
                      {t.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
