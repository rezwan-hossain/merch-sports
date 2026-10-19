// components/SiteHeader4.tsx (Final optimized version)
"use client";

import { useState, useEffect, lazy, Suspense, memo } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHeaderScroll } from "@/hooks/useHeaderScroll";
import { navItems } from "../navigation";
import Logo from "./Logo";
import DesktopNav from "./DesktopNav";

// Lazy load mobile menu (only when needed)
const MobileMenu = lazy(() => import("./MobileMenu"));

// Memoized mobile toggle button
const MobileToggle = memo(
  ({
    mobileOpen,
    onDark,
    onClick,
  }: {
    mobileOpen: boolean;
    /** Sitting on a dark photo (homepage hero on phones) or the open menu. */
    onDark: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`lg:hidden flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        onDark
          ? "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25"
          : "bg-white text-gray-900 ring-1 ring-gray-200 hover:bg-gray-50"
      }`}
      aria-label={mobileOpen ? "Close menu" : "Open menu"}
      aria-expanded={mobileOpen}
    >
      {mobileOpen ? <X size={22} /> : <Menu size={22} />}
    </button>
  ),
);

MobileToggle.displayName = "MobileToggle";

export default function SiteHeader4() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, setUser } = useAuth();
  const { scrolled, visible } = useHeaderScroll(mobileOpen);
  // On phones the homepage hero photo sits under the transparent header.
  const overHeroPhoto = usePathname() === "/" && !scrolled;

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = () => setUser(null);
  const closeMobileMenu = () => setMobileOpen(false);
  const toggleMobileMenu = () => setMobileOpen((prev) => !prev);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-[transform,background-color,box-shadow] duration-300 ease-out will-change-transform ${
          visible ? "translate-y-0" : "-translate-y-full"
        } ${scrolled && !mobileOpen ? "bg-white/90 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.06)]" : "bg-transparent"}`}
      >
        <div
          // Fixed height: changing it while scrolling made the page jump.
          className="mx-auto max-w-[1400px] flex h-20 md:h-24 items-center justify-between px-6 lg:px-8"
        >
          <Logo scrolled={scrolled} />

          <DesktopNav
            navItems={navItems}
            scrolled={scrolled}
            user={user}
            loading={loading}
            onLogout={handleLogout}
          />

          <MobileToggle
            mobileOpen={mobileOpen}
            onDark={mobileOpen || overHeroPhoto}
            onClick={toggleMobileMenu}
          />
        </div>
      </nav>

      {/* Mobile Menu - Lazy loaded with Suspense */}
      {mobileOpen && (
        <Suspense fallback={null}>
          <MobileMenu
            isOpen={mobileOpen}
            onClose={closeMobileMenu}
            navItems={navItems}
            user={user}
            loading={loading}
            onLogout={handleLogout}
          />
        </Suspense>
      )}
    </>
  );
}
