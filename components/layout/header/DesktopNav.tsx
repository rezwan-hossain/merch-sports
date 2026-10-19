// components/header/DesktopNav.tsx
"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import DesktopUserMenu from "./DesktopUserMenu";
import type { AuthUser } from "@/hooks/useAuth";

interface DesktopNavProps {
  navItems: readonly { label: string; href: string }[];
  scrolled: boolean;
  user: AuthUser;
  loading: boolean;
  onLogout: () => void;
}

/** "/" only matches the homepage; other links also match their sub-pages. */
export const isActivePath = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

const DesktopNav = memo(function DesktopNav({ navItems, user, loading, onLogout }: DesktopNavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      <ul className="hidden lg:flex items-center gap-1 rounded-full bg-white/70 p-1 ring-1 ring-gray-200/80 backdrop-blur">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative block rounded-full px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  active ? "bg-[#0d2b22] text-white" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden lg:block">
        {loading ? (
          <div className="h-11 w-40 rounded-full bg-gray-100 animate-pulse" />
        ) : user ? (
          <DesktopUserMenu user={user} onLogout={onLogout} />
        ) : (
          <Link
            href="/events"
            className="group inline-flex items-center gap-2.5 rounded-full bg-neon-lime py-1.5 pl-5 pr-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#0d2b22] shadow-sm transition hover:brightness-105 active:scale-[0.98]"
          >
            Buy ticket
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d2b22] text-neon-lime">
              <ArrowUpRight
                size={15}
                className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        )}
      </div>
    </>
  );
});

export default DesktopNav;
