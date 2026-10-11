// lib/registration-validation.ts
//
// Server-side check of the public checkout form (placeOrder). The browser form
// validates too, but anything can be posted to a server action directly, so
// the server is the real gate. The rules match BillingForm's, so nobody who
// uses the site normally is ever rejected here.
//
// ⚠️ Not a "use server" file — called only from trusted server code.

import {
  AGE_CATEGORIES,
  BLOOD_GROUPS,
  GENDERS,
  PAYMENT_METHODS,
  RUNNER_CATEGORIES,
  isValidBDPhone,
  isValidEmail,
} from "@/lib/registration-options";
import { tshirtSizes } from "@/module/checkout/data/tshirtSizes";

/** T-shirt value the checkout sends for virtual events (no shirt). */
export const VIRTUAL_TSHIRT = "VIRTUAL";

// community is free text; real entries reach ~360 characters.
const MAX = { name: 100, email: 254, community: 500 } as const;

export type RegistrationInput = {
  fullName: unknown;
  email: unknown;
  phone: unknown;
  gender: unknown;
  birthDate: unknown;
  ageCategory: unknown;
  bloodGroup: unknown;
  tshirtSize: unknown;
  emergencyContactName?: unknown;
  emergencyContactNumber?: unknown;
  communityName?: unknown;
  runnerCategory: unknown;
  paymentMethod: unknown;
};

export type CleanRegistration = {
  fullName: string;
  email: string; // "" when not given
  phone: string;
  gender: string;
  birthDate: Date;
  ageCategory: string;
  bloodGroup: string;
  tshirtSize: string;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  communityName: string | null;
  runnerCategory: string;
  paymentMethod: string;
};

export type RegistrationCheck =
  | { ok: true; data: CleanRegistration }
  | { ok: false; field: keyof RegistrationInput; error: string };

/** Trimmed single-line text with control characters removed; "" for non-strings. */
const text = (v: unknown) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() : "";

const oneOf = (v: unknown, options: readonly string[]): v is string =>
  typeof v === "string" && options.includes(v);

const TSHIRTS: readonly string[] = [...tshirtSizes.map((s) => s.value), VIRTUAL_TSHIRT];

/** "YYYY-MM-DD" → a real calendar date in the past (and after 1900), else null. */
export function parseBirthDate(v: unknown, now = new Date()): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  // Rejects impossible dates like 2026-02-31 (which Date would roll over).
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  if (d >= now || d.getUTCFullYear() < 1900) return null;
  return d;
}

export function validateRegistration(input: RegistrationInput): RegistrationCheck {
  const fail = (field: keyof RegistrationInput, error: string): RegistrationCheck => ({ ok: false, field, error });

  const fullName = text(input.fullName);
  if (fullName.length < 2) return fail("fullName", "Enter the runner's full name.");
  if (fullName.length > MAX.name) return fail("fullName", `Name must be under ${MAX.name} characters.`);

  // The form requires an email; a missing one is still allowed here because
  // guest checkout has its own no-email path (a placeholder address).
  const email = text(input.email).toLowerCase();
  if (email && (email.length > MAX.email || !isValidEmail(email)))
    return fail("email", "Enter a valid email address.");

  const phone = text(input.phone);
  if (!phone || !isValidBDPhone(phone))
    return fail("phone", "Phone must be a Bangladeshi mobile number, e.g. 01712345678.");

  if (!oneOf(input.gender, GENDERS)) return fail("gender", "Select a gender.");

  const birthDate = parseBirthDate(input.birthDate);
  if (!birthDate) return fail("birthDate", "Date of birth must be a real date in the past.");

  if (!oneOf(input.ageCategory, AGE_CATEGORIES)) return fail("ageCategory", "Select an age category.");
  if (!oneOf(input.bloodGroup, BLOOD_GROUPS)) return fail("bloodGroup", "Select a blood group.");
  if (!oneOf(input.tshirtSize, TSHIRTS)) return fail("tshirtSize", "Select a T-shirt size.");
  if (!oneOf(input.runnerCategory, RUNNER_CATEGORIES)) return fail("runnerCategory", "Select a runner category.");
  if (!oneOf(input.paymentMethod, PAYMENT_METHODS)) return fail("paymentMethod", "Select a payment method.");

  const emergencyContactNumber = text(input.emergencyContactNumber);
  if (emergencyContactNumber && !isValidBDPhone(emergencyContactNumber))
    return fail("emergencyContactNumber", "Emergency number must be a Bangladeshi mobile number.");

  const emergencyContactName = text(input.emergencyContactName);
  if (emergencyContactName.length > MAX.name)
    return fail("emergencyContactName", `Emergency contact name must be under ${MAX.name} characters.`);

  const communityName = text(input.communityName);
  if (communityName.length > MAX.community)
    return fail("communityName", `Community name must be under ${MAX.community} characters.`);

  return {
    ok: true,
    data: {
      fullName,
      email,
      phone,
      gender: input.gender,
      birthDate,
      ageCategory: input.ageCategory,
      bloodGroup: input.bloodGroup,
      tshirtSize: input.tshirtSize,
      emergencyContactName: emergencyContactName || null,
      emergencyContactNumber: emergencyContactNumber || null,
      communityName: communityName || null,
      runnerCategory: input.runnerCategory,
      paymentMethod: input.paymentMethod,
    },
  };
}
