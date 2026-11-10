// module/about/components/Management.tsx
//
// "Management" on the About page (SSLCommerz asks for company and management
// details). Read live from the Team members in the ADMIN group — edit them in
// admin → Team and this updates too.
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Linkedin } from "lucide-react";
import { getActiveTeamMembers } from "@/app/actions/team";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export async function Management() {
  const { members } = await getActiveTeamMembers();
  const leaders = members.filter((m) => m.category === "ADMIN");

  if (leaders.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Our management team will be listed here soon.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {leaders.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition hover:shadow-md lg:flex-col lg:items-start lg:p-5"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gray-900 lg:h-20 lg:w-20">
              {m.image ? (
                <Image src={m.image} alt={m.name} fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-bold text-neon-lime">
                  {initials(m.name)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold capitalize text-gray-900">{m.name.toLowerCase()}</p>
              {m.role && <p className="mt-0.5 text-sm text-gray-500">{m.role}</p>}
              {m.linkedinUrl && (
                <a
                  href={m.linkedinUrl}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-[#0A66C2]"
                >
                  <Linkedin className="h-3.5 w-3.5" aria-hidden />
                  LinkedIn
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/teams"
        className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 underline-offset-4 hover:underline"
      >
        Meet the whole team
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </>
  );
}

export function ManagementSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200/70 lg:h-44" />
      ))}
    </ul>
  );
}
