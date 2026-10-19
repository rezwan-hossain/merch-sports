// module/home/components/StatsCounter.tsx
//
// "Event at a glance": four stat cards with numbers that count up when the
// section scrolls into view. Same style as the rest of the homepage: big
// left-aligned heading with a lime line, rounded cards, one dark-green card.
"use client";

import { useEffect, useRef, useState } from "react";
import { HeartHandshake, Route, Trophy, Users } from "lucide-react";

type Stat = {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  featured?: boolean;
};

const stats: Stat[] = [
  { value: 3500, label: "Total participants", suffix: "+", icon: Users },
  { value: 21.1, label: "Kilometers", suffix: " km", icon: Route },
  { value: 200, label: "Volunteers", suffix: "+", icon: HeartHandshake, featured: true },
  { value: 100000, label: "Prize pool", prefix: "৳", suffix: "+", icon: Trophy },
];

const format = (n: number, decimals: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Counts up from 0 once it scrolls into view (instant for reduced motion). */
function Counter({ end, prefix = "", suffix = "", duration = 1800 }: { end: number; prefix?: string; suffix?: string; duration?: number }) {
  const decimals = end % 1 === 0 ? 0 : 1;
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setValue(end);
          return;
        }
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          setValue(end * (1 - Math.pow(1 - t, 4))); // ease-out
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [end, duration]);

  return (
    // The final value is announced; the animation is visual only.
    <span ref={ref} aria-label={`${prefix}${format(end, decimals)}${suffix}`}>
      <span aria-hidden className="tabular-nums">
        {prefix}
        {format(decimals ? Math.round(value * 10) / 10 : Math.floor(value), decimals)}
        {suffix}
      </span>
    </span>
  );
}

export default function StatsCounter() {
  return (
    <section id="stats" aria-labelledby="stats-title" className="px-4 md:px-8 py-20 md:py-24">
      <div className="max-w-7xl mx-auto">
        {/* Header (same style as "Upcoming events") */}
        <div className="mb-10 md:mb-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 id="stats-title" className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.9] tracking-tight text-[#0d2b22]">
            At a
            <br />
            <span className="text-neon-lime">glance</span>
          </h2>
          <p className="max-w-sm pb-1 text-sm md:text-base leading-relaxed text-gray-600 md:text-right">
            The numbers behind the race: runners, distance, the crew that makes it happen, and what&apos;s up for grabs.
          </p>
        </div>

        {/* Cards: 2 per row on phones/tablets, 4 on desktop */}
        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {stats.map(({ icon: Icon, label, value, prefix, suffix, featured }) => (
            <div
              key={label}
              className={`flex min-w-0 flex-col justify-between rounded-2xl p-5 sm:p-7 min-h-[170px] sm:min-h-[210px] transition-transform duration-300 hover:-translate-y-1 ${
                featured ? "bg-[#0d2b22] text-white" : "bg-white text-[#0d2b22] ring-1 ring-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${
                  featured ? "bg-neon-lime text-[#0d2b22]" : "bg-neon-lime/15 text-[#0d2b22]"
                }`}
              >
                <Icon size={22} aria-hidden />
              </span>
              <div className="mt-6 min-w-0">
                <dd className="font-[family-name:var(--font-heading)] text-[2rem] leading-none tracking-wide sm:text-5xl">
                  <Counter end={value} prefix={prefix} suffix={suffix} />
                </dd>
                <dt
                  className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-xs sm:tracking-[0.16em] ${
                    featured ? "text-neon-lime" : "text-gray-500"
                  }`}
                >
                  {label}
                </dt>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
