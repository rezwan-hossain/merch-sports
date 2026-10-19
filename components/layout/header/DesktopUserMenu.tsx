// components/header/DesktopUserMenu.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, LayoutDashboard, User, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/hooks/useAuth";

interface DesktopUserMenuProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function DesktopUserMenu({
  user,
  onLogout,
}: DesktopUserMenuProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserMenuOpen(false);
    onLogout();
    router.push("/");
    router.refresh();
  }, [router, onLogout]);

  if (!user) return null;

  return (
    <div className="relative" ref={userMenuRef}>
      <button
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="flex items-center gap-2.5 rounded-full bg-[#0d2b22] py-1.5 pl-1.5 pr-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition hover:opacity-90"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neon-lime text-[#0d2b22]">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <span className="max-w-[100px] truncate">{user.name}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
        />
      </button>

      {userMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 animate-dropdown">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900 truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LayoutDashboard className="w-4 h-4 text-gray-400" />
              Dashboard
            </Link>
            <Link
              href="/profile"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <User className="w-4 h-4 text-gray-400" />
              Profile
            </Link>
          </div>
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
