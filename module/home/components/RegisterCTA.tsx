// module/home/components/RegisterCTA.tsx
//
// Closing call-to-action, in the site's newer style: a rounded dark-green
// card (like the hero and event cards), condensed heading with a lime line,
// pill buttons, and a stats panel.
import { ArrowUpRight, MapPin, Trophy, Users } from "lucide-react";
import Link from "next/link";

const STATS = [
  { icon: Users, value: "5,000+", label: "Members" },
  { icon: Trophy, value: "120+", label: "Events" },
  { icon: MapPin, value: "15+", label: "Cities" },
] as const;

const RegisterCTA = () => {
  return (
    <section aria-labelledby="register-cta" className="px-3 sm:px-5 py-16 md:py-24">
      <div className="relative isolate mx-auto max-w-[1600px] overflow-hidden rounded-[28px] bg-[#0d2b22] px-6 py-12 sm:px-10 sm:py-14 lg:px-16 lg:py-20">
        {/* Decor: lime glows + a big outlined word, kept faint */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-neon-lime/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-72 w-72 rounded-full bg-neon-lime/10 blur-3xl" />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-8 right-4 -z-10 select-none font-[family-name:var(--font-heading)] text-[9rem] leading-none text-transparent opacity-[0.08] [-webkit-text-stroke:2px_white] sm:text-[13rem] lg:text-[18rem]"
        >
          RUN
        </span>

        <div className="grid items-center gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          {/* Text + buttons */}
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
              <span className="h-2 w-2 rounded-full bg-neon-lime" aria-hidden />
              Limited slots available
            </p>
            <h2
              id="register-cta"
              className="text-5xl sm:text-6xl lg:text-7xl uppercase leading-[0.9] tracking-tight text-white"
            >
              Your finish line
              <br />
              <span className="text-neon-lime">starts here</span>
            </h2>
            <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/75">
              Don&apos;t wait. Spots are limited. Secure your place in the most epic running event of the year.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-neon-lime px-7 py-3.5 text-sm font-semibold text-[#0d2b22] shadow-lg transition hover:brightness-105 active:scale-[0.98] sm:text-base"
              >
                Register now
                <ArrowUpRight
                  size={16}
                  className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10 active:scale-[0.98] sm:text-base"
              >
                View events
              </Link>
            </div>
          </div>

          {/* Stats */}
          <dl className="grid grid-cols-3 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm lg:grid-cols-1">
            {STATS.map(({ icon: Icon, value, label }, i) => (
              <div
                key={label}
                className={`flex flex-col items-start gap-2 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:gap-5 lg:px-7 lg:py-6 ${
                  i > 0 ? "border-l border-white/10 lg:border-l-0 lg:border-t" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neon-lime/15 text-neon-lime sm:h-10 sm:w-10">
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <dd className="font-[family-name:var(--font-heading)] text-2xl leading-none tracking-wide text-white sm:text-3xl lg:text-4xl">
                    {value}
                  </dd>
                  <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-[11px]">
                    {label}
                  </dt>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default RegisterCTA;
