import Image from "next/image";
import { Facebook } from "lucide-react";
import type { TeamMember } from "@/types/team";

export const ambassador: TeamMember[] = [
  {
    id: "1",
    name: "Syed Abid Hussain Sami",
    role: "Cricketer, Cricket Analyst,Commentator",
    // bio: "Passionate about building scalable web applications with Next.js, NestJS, and modern cloud infrastructure.",
    image:
      "https://assets.merchcommunication.com/ambassador/ambassador-sami.jpeg",
    sortOrder: 1,
    category: "ADMIN",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    linkedinUrl: "https://linkedin.com/in/rezwan",
    githubUrl: "https://github.com/rezwan",
    twitterUrl: "https://twitter.com/rezwan",

    socials: {
      facebook: "https://www.facebook.com/syed.a.sami.77",
    },
  },

  {
    id: "2",
    name: "Salma Khatun",
    role: "Former Captain bangladesh national women’s cricket team",
    // bio: "Designing clean and modern user experiences focused on accessibility, usability, and conversion.",
    image:
      "https://assets.merchcommunication.com/ambassador/ambassador-salma.jpeg",
    sortOrder: 2,
    category: "ADVISOR",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    linkedinUrl: "https://linkedin.com/in/sarahjohnson",
    instagramUrl: "https://instagram.com/sarahdesigns",
    facebookUrl: "https://facebook.com/sarahjohnson",

    socials: {
      facebook: "https://www.facebook.com/share/1E4LHwfnwT/",
    },
  },

  {
    id: "3",
    name: "Fahim Rahman",
    role: "Famous Sports Journalist",
    // bio: "Focused on API architecture, database optimization, and secure backend systems.",
    image:
      "https://assets.merchcommunication.com/ambassador/ambassador-fahim.jpeg",
    sortOrder: 3,
    category: "ORGANIZER",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    githubUrl: "https://github.com/michaelchen",
    linkedinUrl: "https://linkedin.com/in/michaelchen",

    socials: {
      facebook: "https://www.facebook.com/share/1Bmd573nNn/",
    },
  },

  {
    id: "4",
    name: "Fahad Hossain",
    role: "Teacher , Fahad's Tutorial",
    // bio: "Helping brands grow through data-driven digital marketing and strategic storytelling.",
    image:
      "https://assets.merchcommunication.com/ambassador/ambassador-fahad.jpeg",
    sortOrder: 4,
    category: "ADMIN",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    twitterUrl: "https://twitter.com/emilydavis",
    instagramUrl: "https://instagram.com/emilydavis",

    socials: {
      facebook: "https://www.facebook.com/share/1LEKiQt5v1/",
    },
  },

  {
    id: "5",
    name: "RJ Auhona",
    role: "Famous Television Anchor, Radio Jockey",
    // bio: "Automating deployments, scaling infrastructure, and improving CI/CD pipelines.",
    image:
      "https://assets.merchcommunication.com/ambassador/ambassador-auhona.jpeg",
    sortOrder: 5,
    category: "ADVISOR",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    linkedinUrl: "https://linkedin.com/in/davidwilson",
    githubUrl: "https://github.com/davidwilson",

    socials: {
      facebook: "https://www.facebook.com/share/#/",
    },
  },

  {
    id: "6",
    name: "Mohammad Mohasin",
    role: "Captain Bangladesh Wheelchair Cricket Team",
    // bio: "Leading agile teams and delivering high-quality digital products on time.",
    image:
      "https://assets.merchcommunication.com/ambassador/ambassador-mohasin.jpeg",
    sortOrder: 6,
    category: "ORGANIZER",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    linkedinUrl: "https://linkedin.com/in/sophiamartinez",
    facebookUrl: "https://facebook.com/sophiamartinez",

    socials: {
      facebook: "https://www.facebook.com/share/#/",
    },
  },
];

/** A real profile link (a few entries still hold a "share/#" placeholder). */
const profileUrl = (url?: string) => (url && !url.includes("/#") ? url : null);

function AmbassadorCard({ member }: { member: TeamMember }) {
  const fb = profileUrl(member.socials?.facebook);
  return (
    <li className="group min-w-0 text-center">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[200px] overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
        <Image
          src={member.image ?? ""}
          alt={member.name}
          fill
          sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Lime wash + Facebook button on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d2b22]/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {fb && (
          <a
            href={fb}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on Facebook`}
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-neon-lime text-[#0d2b22] opacity-0 shadow-md transition duration-300 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Facebook size={15} aria-hidden />
          </a>
        )}
      </div>
      <h3 className="mt-3 text-sm sm:text-[15px] font-semibold leading-snug text-gray-900" style={{ fontFamily: "var(--font-body)" }}>
        {member.name}
      </h3>
      <p className="mt-1 text-[11px] sm:text-xs leading-snug text-gray-500 line-clamp-2">{member.role}</p>
    </li>
  );
}

export default function Ambassador() {
  return (
    <section id="ambassadors" aria-labelledby="ambassadors-title" className="px-4 md:px-8 py-20 md:py-24">
      <div className="max-w-7xl mx-auto">
        {/* Header (same style as the other homepage sections) */}
        <div className="mb-10 md:mb-14 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2
            id="ambassadors-title"
            className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.9] tracking-tight text-[#0d2b22]"
          >
            Faces of
            <br />
            <span className="text-neon-lime">Odommo 2026</span>
          </h2>
          <p className="max-w-sm pb-1 text-sm md:text-base leading-relaxed text-gray-600 md:text-right">
            Athletes, journalists and personalities running with us for Odommo Bangladesh 2026.
          </p>
        </div>

        {/* 2 per row on phones, 3 on tablets, all 6 in one row on desktop */}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
          {ambassador.map((member) => (
            <AmbassadorCard key={member.id} member={member} />
          ))}
        </ul>
      </div>
    </section>
  );
}
