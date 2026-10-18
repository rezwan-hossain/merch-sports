// module/event/components/StickyTicketBar.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type Props = {
  eventName: string;
  /** Cheapest package that still has slots. */
  fromPrice: number;
  /** id of the ticket card to scroll to. */
  targetId: string;
};

// Phones only: a "Get ticket" bar fixed to the bottom of the event page. It
// scrolls to the ticket card and hides itself while that card is on screen.
export default function StickyTicketBar({ eventName, fromPrice, targetId }: Props) {
  const [ticketsVisible, setTicketsVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setTicketsVisible(entry.isIntersecting), {
      rootMargin: "0px 0px -15% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  const jump = () => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
        ticketsVisible ? "translate-y-full" : "translate-y-0"
      }`}
      aria-hidden={ticketsVisible}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0">
          <p className="hidden sm:block truncate text-sm font-semibold text-gray-900">{eventName}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">From</span>
            <span className="font-[family-name:var(--font-heading)] text-xl leading-none text-gray-900">
              ৳{fromPrice.toLocaleString("en-IN")}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={jump}
          tabIndex={ticketsVisible ? -1 : 0}
          className="shrink-0 cursor-pointer rounded-full bg-neutral-900 py-1.5 pl-4 pr-1.5 flex items-center gap-2.5 font-body text-sm font-semibold tracking-wide text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          GET TICKET
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FDFD96]">
            <ArrowRight size={14} className="text-black" aria-hidden />
          </span>
        </button>
      </div>
    </div>
  );
}
