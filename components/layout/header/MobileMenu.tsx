// components/header/MobileMenu.tsx
"use client";

import { useCallback } from "react";
import { ArrowUpRight, LayoutDashboard, User, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isActivePath } from "./DesktopNav";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/hooks/useAuth";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: readonly { label: string; href: string }[];
  user: AuthUser;
  loading: boolean;
  onLogout: () => void;
}

export default function MobileMenu({
  isOpen,
  onClose,
  navItems,
  user,
  loading,
  onLogout,
}: MobileMenuProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onLogout();
    onClose();
    router.push("/");
    router.refresh();
  }, [router, onLogout, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-[min(340px,88vw)] overflow-y-auto bg-[#0d2b22] text-white animate-slide-in">
        <div className="flex min-h-full flex-col px-6 pt-24 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Menu</p>
          <nav className="flex-1">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                    className={`flex items-center justify-between border-b border-white/10 py-4 text-3xl uppercase leading-none tracking-tight transition-colors ${
                      isActivePath(pathname, item.href) ? "text-neon-lime" : "text-white hover:text-neon-lime"
                    }`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {item.label}
                    {isActivePath(pathname, item.href) ? (
                      <span className="h-2 w-2 rounded-full bg-neon-lime" aria-hidden />
                    ) : (
                      <ArrowUpRight size={20} className="text-white/40" aria-hidden />
                    )}
                  </Link>
                </li>
              ))}
              {user && (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      onClick={onClose}
                      className="flex items-center justify-between border-b border-white/10 py-3.5 text-base font-semibold text-white/80 hover:text-neon-lime"
                    >
                      Dashboard
                      <LayoutDashboard size={20} />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/profile"
                      onClick={onClose}
                      className="flex items-center justify-between border-b border-white/10 py-3.5 text-base font-semibold text-white/80 hover:text-neon-lime"
                    >
                      Profile
                      <User size={20} />
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>

          <div className="mt-8 space-y-3">
            {loading ? (
              <div className="h-14 w-full rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              <>
                <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neon-lime text-[#0d2b22]">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-white/50">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/events"
                onClick={onClose}
                className="flex items-center justify-between gap-3 rounded-full bg-neon-lime py-2 pl-6 pr-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#0d2b22] hover:brightness-105"
              >
                Buy ticket
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d2b22] text-neon-lime">
                  <ArrowUpRight size={16} aria-hidden />
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
