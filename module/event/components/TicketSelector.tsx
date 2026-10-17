"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { EventPackage } from "@/types/event";
import { REGISTRATION_BLOCKED_MESSAGE } from "@/lib/registration-status";

type TicketSelectorProps = {
  packages: EventPackage[];
  eventSlug: string;
  eventId: string;
  /** Admin-set (lib/registration-status). Anything but OPEN blocks buying. */
  registrationStatus?: string;
};

const TicketSelector = ({
  packages,
  eventSlug,
  eventId,
  registrationStatus = "OPEN",
}: TicketSelectorProps) => {
  const router = useRouter();

  const [selectedPackage, setSelectedPackage] = useState(packages[0]);
  const [isLoading, setIsLoading] = useState(false);

  const slotsLeft = selectedPackage.availableSlots - selectedPackage.usedSlots;

  const handleGetTicket = async () => {
    setIsLoading(true);

    try {
      // const supabase = createClient();
      // const {
      //   data: { user },
      // } = await supabase.auth.getUser();

      // if (!user) {
      //   const cartUrl = `/cart?package=${selectedPackage.id}&qty=1&event=${eventSlug}`;
      //   router.push(`/login?redirect=${encodeURIComponent(cartUrl)}`);
      //   return;
      // }

      // router.push(
      //   `/cart?package=${selectedPackage.id}&qty=1&event=${eventSlug}`,
      // );

      const params = new URLSearchParams({
        package: String(selectedPackage.id),
        event: eventId,
        qty: "1", // Fixed quantity
      });

      router.push(`/checkout?${params.toString()}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Registration not open (coming soon / sold out / closed): say why,
  // instead of a button that would only fail at checkout.
  if (registrationStatus !== "OPEN" && registrationStatus in REGISTRATION_BLOCKED_MESSAGE) {
    const blocked = registrationStatus as keyof typeof REGISTRATION_BLOCKED_MESSAGE;
    return (
      <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-3 sm:pb-4">
          <Ticket size={20} className="text-event-gold" />
          <h3 className="font-display text-2xl sm:text-3xl tracking-wide">
            TICKET
          </h3>
        </div>
        <div className="rounded-lg bg-gray-100 px-4 py-5 text-center">
          <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-1">
            {blocked === "COMING_SOON" ? "Coming soon" : blocked === "SOLD_OUT" ? "Sold out" : "Registration closed"}
          </p>
          <p className="text-sm text-gray-900">{REGISTRATION_BLOCKED_MESSAGE[blocked]}</p>
        </div>
        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-full py-3 sm:py-4 font-body font-semibold text-sm tracking-wide bg-gray-300 text-gray-500 cursor-not-allowed"
        >
          {blocked === "COMING_SOON" ? "OPENS SOON" : blocked === "SOLD_OUT" ? "SOLD OUT" : "CLOSED"}
        </button>
      </div>
    );
  }

  // No packages available
  if (packages.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-3 sm:pb-4">
          <Ticket size={20} className="text-event-gold" />
          <h3 className="font-display text-2xl sm:text-3xl tracking-wide">
            TICKET
          </h3>
        </div>
        <p className="text-muted-foreground text-sm">
          No packages available for this event.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 sm:mb-5 border-b border-border pb-3 sm:pb-4">
        <Ticket size={20} className="text-event-gold" />
        <h3 className="font-display text-2xl sm:text-3xl tracking-wide">
          TICKET
        </h3>
      </div>

      {/* Package Dropdown */}
      <div className="border border-border rounded-lg mb-4 relative">
        <select
          className="w-full bg-gray-100 p-3 sm:p-4 pr-10 text-gray-900 font-body text-sm rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-neon-lime/50"
          value={selectedPackage.id}
          onChange={(e) => {
            const pkg = packages.find((p) => p.id === Number(e.target.value))!;
            setSelectedPackage(pkg);
          }}
        >
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name} ({pkg.distance}) - ৳{pkg.price}
            </option>
          ))}
        </select>

        <ChevronDown
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          size={18}
        />
      </div>

      {/* Slots Left Info */}
      {/* <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{slotsLeft} slots remaining</span>
          <span>{selectedPackage.availableSlots} total</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              slotsLeft < 20
                ? "bg-red-500"
                : slotsLeft < 50
                  ? "bg-yellow-500"
                  : "bg-neon-lime"
            }`}
            style={{
              width: `${
                (selectedPackage.usedSlots / selectedPackage.availableSlots) *
                100
              }%`,
            }}
          />
        </div>
        {slotsLeft < 20 && slotsLeft > 0 && (
          <p className="text-xs text-red-500 mt-1.5 font-medium">
            ⚠️ Almost sold out!
          </p>
        )}
        {slotsLeft === 0 && (
          <p className="text-xs text-red-500 mt-1.5 font-medium">❌ Sold out</p>
        )}
      </div> */}

      {/* Price Display */}
      <div className="bg-neon-lime rounded-lg px-4 py-4 sm:px-6 sm:py-5 mb-4">
        <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-white/80 mb-1 text-center">
          TICKET PRICE
        </p>
        <p className="font-display text-3xl sm:text-4xl text-white text-center">
          ৳{selectedPackage.price}
        </p>
      </div>

      {/* CTA Button */}
      <button
        onClick={handleGetTicket}
        disabled={slotsLeft === 0 || isLoading}
        className={`cursor-pointer w-full rounded-full py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-3 font-body font-semibold text-sm tracking-wide transition ${
          slotsLeft === 0
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : isLoading
              ? "bg-neutral-700 text-white cursor-wait"
              : "bg-neutral-900 text-white hover:opacity-90 active:scale-[0.98]"
        }`}
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </>
        ) : slotsLeft === 0 ? (
          "SOLD OUT"
        ) : (
          <>
            GET TICKET
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FDFD96] flex items-center justify-center">
              <ArrowRight size={14} className="text-black" />
            </span>
          </>
        )}
      </button>

      {/* Single ticket notice */}
      <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
        1 ticket per transaction
      </p>
    </div>
  );
};

export default TicketSelector;
