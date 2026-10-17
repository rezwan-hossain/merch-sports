// lib/registration-status.ts
//
// Event.registrationStatus: whether people can register right now, set by an
// admin in the event form. Shared by the admin form, the event cards, the event
// page and the checkout guard, so they always agree. Plain data — safe to import
// in browser components.

export const REGISTRATION_STATUSES = ["OPEN", "COMING_SOON", "SOLD_OUT", "CLOSED"] as const;
export type RegistrationStatusValue = (typeof REGISTRATION_STATUSES)[number];

export const isRegistrationStatus = (v: unknown): v is RegistrationStatusValue =>
  typeof v === "string" && (REGISTRATION_STATUSES as readonly string[]).includes(v);

/** Admin form: label + what it does. */
export const REGISTRATION_STATUS_OPTIONS: Record<RegistrationStatusValue, { label: string; help: string }> = {
  OPEN: { label: "Open", help: "People can register. Shows “Sold out” automatically when every package is full." },
  COMING_SOON: { label: "Coming soon", help: "Listed on the site, but registration hasn't opened yet." },
  SOLD_OUT: { label: "Sold out", help: "Stop sales now, even if slots are left." },
  CLOSED: { label: "Closed", help: "Registration is over (e.g. the deadline passed)." },
};

/** What visitors see when they can't register (event page + checkout error). */
export const REGISTRATION_BLOCKED_MESSAGE: Record<Exclude<RegistrationStatusValue, "OPEN">, string> = {
  COMING_SOON: "Registration opens soon. Check back shortly!",
  SOLD_OUT: "This event is sold out.",
  CLOSED: "Registration for this event is closed.",
};
