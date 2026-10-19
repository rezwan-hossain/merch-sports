// module/home/components/CTASection.tsx
//
// "Join our community" call-to-action, in the site's newer style: rounded
// dark-green card, condensed heading with a lime line, pill button, and a row
// of stat tiles (the first one highlighted in lime).
import { ArrowUpRight, Facebook, Footprints, Trophy, Users } from "lucide-react";

const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61566321857186";

const STATS = [
  { icon: Users, value: "5,000+", label: "Spectators" },
  { icon: Footprints, value: "2,000+", label: "Runners" },
  { icon: Trophy, value: "5+", label: "Events" },
] as const;

const CTASection = () => {
  return (
    <section aria-labelledby="community-cta" className="px-3 sm:px-5 py-16 md:py-24">
      <div className="relative isolate mx-auto max-w-[1600px] overflow-hidden rounded-[28px] bg-[#0d2b22] px-6 py-12 text-white sm:px-10 sm:py-14 lg:px-16 lg:py-20">
        {/* Decor: a lime glow and a faint finish-line checker */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 -z-10 h-80 w-80 rounded-full bg-neon-lime/15 blur-3xl" />
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 -z-10 h-64 w-32 -translate-y-1/2 text-white opacity-[0.05] md:h-80 md:w-40"
          viewBox="0 0 100 200"
          fill="currentColor"
        >
          {Array.from({ length: 10 }).flatMap((_, row) =>
            Array.from({ length: 5 }).map((_, col) =>
              (row + col) % 2 === 0 ? <rect key={`${row}-${col}`} x={col * 20} y={row * 20} width="20" height="20" /> : null,
            ),
          )}
        </svg>

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16 [&>*]:min-w-0">
          {/* Text + button */}
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-lime opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-lime" />
              </span>
              Growing community
            </p>
            <h2 id="community-cta" className="text-5xl sm:text-6xl lg:text-7xl uppercase leading-[0.9] tracking-tight text-white">
              Join our
              <br />
              <span className="text-neon-lime">community</span>
            </h2>
            <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-white/75">
              Connect with fellow runners, share experiences, and stay updated with the latest marathon events across
              Bangladesh.
            </p>

            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-neon-lime px-7 py-3.5 text-sm font-semibold text-[#0d2b22] shadow-lg transition hover:brightness-105 active:scale-[0.98] sm:w-auto sm:text-base"
            >
              <Facebook size={18} aria-hidden />
              Join on Facebook
              <ArrowUpRight
                size={16}
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </a>
          </div>

          {/* Stats: three tiles, the first highlighted */}
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
            {STATS.map(({ icon: Icon, value, label }, i) => {
              const featured = i === 0;
              return (
                <div
                  key={label}
                  className={`flex min-w-0 items-center gap-4 rounded-2xl px-4 py-3.5 sm:flex-col sm:items-start sm:justify-between sm:gap-0 sm:p-5 sm:min-h-[160px] lg:p-6 ${
                    featured ? "bg-neon-lime text-[#0d2b22]" : "bg-white/[0.06] ring-1 ring-white/10"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      featured ? "bg-[#0d2b22]/10" : "bg-neon-lime/15 text-neon-lime"
                    }`}
                  >
                    <Icon size={18} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:mt-4 sm:block">
                    <dd className="order-1 font-[family-name:var(--font-heading)] text-2xl leading-none tracking-wide sm:text-3xl lg:text-4xl">
                      {value}
                    </dd>
                    <dt
                      className={`order-2 truncate text-[11px] font-semibold uppercase tracking-[0.16em] sm:mt-1.5 sm:tracking-[0.12em] lg:tracking-[0.16em] ${
                        featured ? "text-[#0d2b22]/70" : "text-white/55"
                      }`}
                    >
                      {label}
                    </dt>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
