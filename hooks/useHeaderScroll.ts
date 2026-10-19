// hooks/useHeaderScroll.ts
"use client";

import { useEffect, useRef, useState } from "react";

// Tuned so the header never flickers:
const SHOW_ALWAYS_ABOVE = 100; // near the top the header is always visible
const DIRECTION_THRESHOLD = 12; // ignore jitter smaller than this (momentum / bounce)
const SCROLLED_ON = 64; // switch to the solid header after this…
const SCROLLED_OFF = 16; // …and back only when almost at the top (hysteresis)

/**
 * `scrolled`: the page has moved down (solid header background).
 * `visible`: hide the header while scrolling down, show it when scrolling up.
 */
export function useHeaderScroll(mobileOpen: boolean) {
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (mobileOpen) return; // menu open: keep the header as it is

    const update = () => {
      ticking.current = false;
      // iOS "bounce" can report negative values at the top — treat as 0.
      const y = Math.max(0, window.scrollY);

      setScrolled((was) => (was ? y > SCROLLED_OFF : y > SCROLLED_ON));

      if (y < SHOW_ALWAYS_ABOVE) {
        setVisible(true);
        lastY.current = y;
        return;
      }
      const delta = y - lastY.current;
      if (Math.abs(delta) < DIRECTION_THRESHOLD) return; // too small: ignore, keep baseline
      setVisible(delta < 0); // up = show, down = hide
      lastY.current = y;
    };

    const onScroll = () => {
      if (ticking.current) return; // at most one update per frame
      ticking.current = true;
      requestAnimationFrame(update);
    };

    lastY.current = Math.max(0, window.scrollY);
    update(); // correct state on mount / after the menu closes
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileOpen]);

  return { scrolled, visible };
}
