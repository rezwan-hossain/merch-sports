// module/home/components/HeroCountdownDays.tsx
"use client";

import { useSyncExternalStore } from "react";

// The homepage is cached for days, so the countdown is worked out in the
// browser. The server renders a placeholder; it updates once a minute.
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};

/** Big "68 DAYS", worked out in the browser. */
export default function HeroCountdownDays({ target, accent }: { target: string; accent: string }) {
  // Minutes left (a primitive, so React can compare snapshots cheaply).
  const minutes = useSyncExternalStore(
    subscribe,
    () => Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 60_000)),
    () => null,
  );

  if (minutes === null) {
    return (
      <span aria-hidden className="block">
        <span className="block h-8 w-28 rounded bg-gray-100 animate-pulse" />
      </span>
    );
  }
  if (minutes === 0) {
    return (
      <span className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl tracking-wide" style={{ color: accent }}>
        Race day!
      </span>
    );
  }

  const days = Math.ceil(minutes / 1440);
  return (
    <span
      className="block font-[family-name:var(--font-heading)] text-2xl sm:text-3xl leading-none tracking-wide"
      style={{ color: accent }}
      aria-label={`${days} ${days === 1 ? "day" : "days"} to go`}
    >
      {days} {days === 1 ? "DAY" : "DAYS"}
    </span>
  );
}
