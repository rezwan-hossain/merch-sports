// module/home/components/Sponsors.tsx
//
// "Proud partners": the homepage heading style, then two rows of logo tiles
// scrolling in opposite directions. Logos sit in grey until hovered; the
// scroll pauses on hover and is turned off for people who prefer less motion.
import Image from "next/image";

const sponsors = [
  { name: "RiseX Limited", logo: "https://res.cloudinary.com/ddea6u6xh/image/upload/v1777657921/thumb_65a43e21ef5f4170526262_p5fqqm.png" },
  { name: "T-Sports", logo: "https://res.cloudinary.com/ddea6u6xh/image/upload/v1777657921/1775322618367-cwcidx_b0ypvj.png" },
  { name: "GTV", logo: "https://assets.merchcommunication.com/logo/GTV.png" },
  { name: "Akij Bicycle", logo: "https://assets.merchcommunication.com/logo/akij-bycyle.png" },
  { name: "Babuland", logo: "https://assets.merchcommunication.com/logo/babuland.jpg" },
  { name: "DEKKO Foods", logo: "https://assets.merchcommunication.com/logo/dekko-foods.jpg" },
  { name: "Fresh Cola", logo: "https://assets.merchcommunication.com/logo/fresh-cola.jpg" },
  { name: "Maggi", logo: "https://assets.merchcommunication.com/logo/maggi.jpg" },
  { name: "Mans World", logo: "https://assets.merchcommunication.com/logo/mens-world.jpg" },
  { name: "T-Sports", logo: "https://assets.merchcommunication.com/logo/t-sports.jpg" },
  { name: "Pizza Hut", logo: "https://assets.merchcommunication.com/logo/pizza-hut.jpg" },
  { name: "ICE Today", logo: "https://assets.merchcommunication.com/logo/ice-today.jpg" },
  { name: "Business Times", logo: "https://assets.merchcommunication.com/logo/business-times.jpg" },
  { name: "Clove Chocolate", logo: "https://assets.merchcommunication.com/logo/clove-chocolate.jpg" },
];

type Sponsor = (typeof sponsors)[number];

function LogoTile({ sponsor }: { sponsor: Sponsor }) {
  return (
    // pr instead of flex gap: the loop then moves by exactly one copy (-50%), no jump.
    <li className="shrink-0 pr-3 sm:pr-4">
      <div className="group/logo flex h-20 w-40 items-center justify-center rounded-2xl bg-white px-5 ring-1 ring-gray-200 transition hover:ring-gray-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] sm:h-24 sm:w-48">
        <Image
          src={sponsor.logo}
          alt={sponsor.name}
          width={200}
          height={100}
          className="h-10 w-auto max-w-full object-contain opacity-70 grayscale transition duration-300 group-hover/logo:opacity-100 group-hover/logo:grayscale-0 sm:h-12"
        />
      </div>
    </li>
  );
}

function MarqueeRow({ items, reverse = false }: { items: Sponsor[]; reverse?: boolean }) {
  return (
    <div className="group relative overflow-hidden">
      {/* Fade both edges into the page background */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-24" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-24" />

      <div
        className="flex w-max animate-sponsor-scroll group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {/* Two identical copies make a seamless loop; screen readers get one. */}
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex" aria-hidden={copy === 1 || undefined}>
            {items.map((s, i) => (
              <LogoTile key={`${s.name}-${i}`} sponsor={s} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export default function Sponsors() {
  const half = Math.ceil(sponsors.length / 2);
  return (
    <section id="sponsors" aria-labelledby="sponsors-title" className="py-20 md:py-24">
      {/* Header (same style as the other homepage sections) */}
      <div className="mx-auto mb-10 md:mb-14 flex max-w-7xl flex-wrap items-end justify-between gap-x-10 gap-y-4 px-4 md:px-8">
        <h2
          id="sponsors-title"
          className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.9] tracking-tight text-[#0d2b22]"
        >
          Proud
          <br />
          <span className="text-neon-lime">partners</span>
        </h2>
        <div className="max-w-sm pb-1 md:text-right">
          <p className="text-sm md:text-base leading-relaxed text-gray-600">
            The brands that power our races and keep Bangladesh running.
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
            {sponsors.length} partners
          </p>
        </div>
      </div>

      {/* Full-width logo rows */}
      <div className="space-y-3 sm:space-y-4">
        <MarqueeRow items={sponsors.slice(0, half)} />
        <MarqueeRow items={sponsors.slice(half)} reverse />
      </div>
    </section>
  );
}
