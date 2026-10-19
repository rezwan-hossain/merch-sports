"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Ticket } from "lucide-react";
import type { EventPackage } from "@/types/event";
import { REGISTRATION_BLOCKED_MESSAGE } from "@/lib/registration-status";

type TicketSelectorProps = {
  packages: EventPackage[];
  eventSlug: string;
  eventId: string;
  /** Admin-set (lib/registration-status). Anything but OPEN blocks buying. */
  registrationStatus?: string;
};

const LOW_STOCK = 20; // show "Only N left" at or below this
const slotsOf = (p: EventPackage) => p.availableSlots - p.usedSlots;
const taka = (n: number) => `৳${n.toLocaleString("en-IN")}`;

/** Card shell + "TICKET" heading, shared by every state. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-5 border-b border-border pb-3 sm:pb-4">
        <Ticket size={20} className="text-event-gold" aria-hidden />
        <h3 className="font-display text-2xl sm:text-3xl tracking-wide">TICKET</h3>
      </div>
      {children}
    </div>
  );
}

const TicketSelector = ({ packages, eventId, registrationStatus = "OPEN" }: TicketSelectorProps) => {
  const router = useRouter();
  // Start on the first package that can still be bought.
  const [selectedId, setSelectedId] = useState<number | undefined>(
    () => (packages.find((p) => slotsOf(p) > 0) ?? packages[0])?.id,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Registration not open (coming soon / sold out / closed): say why,
  // instead of a button that would only fail at checkout.
  if (registrationStatus !== "OPEN" && registrationStatus in REGISTRATION_BLOCKED_MESSAGE) {
    const blocked = registrationStatus as keyof typeof REGISTRATION_BLOCKED_MESSAGE;
    return (
      <Shell>
        <div className="rounded-xl bg-gray-50 px-4 py-6 text-center ring-1 ring-gray-200">
          <p className="mb-1 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {blocked === "COMING_SOON" ? "Coming soon" : blocked === "SOLD_OUT" ? "Sold out" : "Registration closed"}
          </p>
          <p className="text-sm text-gray-900">{REGISTRATION_BLOCKED_MESSAGE[blocked]}</p>
        </div>
        <button
          type="button"
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-full bg-gray-200 py-3.5 font-body text-sm font-semibold tracking-wide text-gray-500"
        >
          {blocked === "COMING_SOON" ? "OPENS SOON" : blocked === "SOLD_OUT" ? "SOLD OUT" : "CLOSED"}
        </button>
      </Shell>
    );
  }

  if (packages.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">No packages available for this event yet.</p>
      </Shell>
    );
  }

  const selected = packages.find((p) => p.id === selectedId) ?? packages[0];
  const soldOut = slotsOf(selected) <= 0;
  const allSoldOut = packages.every((p) => slotsOf(p) <= 0);

  const handleGetTicket = () => {
    if (soldOut) return;
    setIsLoading(true);
    const params = new URLSearchParams({ package: String(selected.id), event: eventId, qty: "1" });
    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <Shell>
      {/* Package choice: one selectable card per package */}
      <fieldset>
        <legend className="mb-2.5 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Choose your distance
        </legend>
        <div className="space-y-2">
          {packages.map((pkg) => {
            const left = slotsOf(pkg);
            const out = left <= 0;
            const isSelected = pkg.id === selected.id;
            return (
              <label
                key={pkg.id}
                className={`relative flex items-center gap-3 rounded-xl p-3 ring-1 transition ${
                  out
                    ? "cursor-not-allowed bg-gray-50 opacity-55 ring-gray-200"
                    : isSelected
                      ? "cursor-pointer bg-neon-lime/10 ring-2 ring-neon-lime"
                      : "cursor-pointer bg-white ring-gray-200 hover:ring-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="ticket-package"
                  value={pkg.id}
                  checked={isSelected}
                  disabled={out}
                  onChange={() => setSelectedId(pkg.id)}
                  className="peer sr-only"
                />
                <span
                  className={`flex h-11 w-14 shrink-0 items-center justify-center rounded-lg px-1 text-center font-[family-name:var(--font-heading)] text-[15px] leading-none tracking-wide ${
                    isSelected ? "bg-neon-lime text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {pkg.distance}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{pkg.name}</span>
                  <span
                    className={`block text-[11px] font-medium ${
                      out ? "text-red-500" : left <= LOW_STOCK ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {out ? "Sold out" : left <= LOW_STOCK ? `Only ${left} left` : "Available"}
                  </span>
                </span>
                <span className="shrink-0 font-[family-name:var(--font-heading)] text-xl tracking-wide text-gray-900">{taka(pkg.price)}</span>
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 transition ${
                    isSelected ? "bg-neon-lime text-white ring-neon-lime" : "ring-gray-300"
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </span>
                {/* Keyboard focus ring for the hidden radio */}
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-gray-900" />
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Total */}
      <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-neon-lime px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/80">Total</p>
          <p className="truncate text-xs text-white/90">
            {selected.name} · {selected.distance}
          </p>
        </div>
        <p className="shrink-0 font-[family-name:var(--font-heading)] text-3xl sm:text-4xl leading-none tracking-wide text-white">{taka(selected.price)}</p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleGetTicket}
        disabled={soldOut || isLoading}
        aria-busy={isLoading}
        className={`mt-4 flex w-full items-center justify-center gap-2 sm:gap-3 rounded-full py-3 sm:py-3.5 font-body text-sm font-semibold tracking-wide transition ${
          soldOut
            ? "cursor-not-allowed bg-gray-200 text-gray-500"
            : isLoading
              ? "cursor-wait bg-neutral-700 text-white"
              : "cursor-pointer bg-neutral-900 text-white hover:opacity-90 active:scale-[0.98]"
        }`}
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            Processing…
          </>
        ) : soldOut ? (
          allSoldOut ? "SOLD OUT" : "PICK ANOTHER DISTANCE"
        ) : (
          <>
            GET TICKET
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FDFD96] sm:h-8 sm:w-8">
              <ArrowRight size={14} className="text-black" aria-hidden />
            </span>
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[10px] sm:text-xs text-muted-foreground">1 ticket per transaction · secure checkout</p>
    </Shell>
  );
};

export default TicketSelector;
