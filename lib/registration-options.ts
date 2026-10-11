// lib/registration-options.ts
//
// Single source of truth for the registration dropdowns.
// Both the public BillingForm and the admin ManualRegistrationForm read from
// here, so the two forms can't drift apart. Add "Elite" as a runner category
// and it shows up in both places at once.

export const GENDERS = ["Male", "Female", "Other"] as const;

export const AGE_CATEGORIES = ["General", "Veteran (47+)"] as const;

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
] as const;

export const RUNNER_CATEGORIES = ["Amateur"] as const;

/** Payment methods the checkout offers (OrderSummary). */
export const PAYMENT_METHODS = ["shurjopay"] as const;

/** Every status an order can hold — used by filters and updateOrderStatus. */
export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;

/**
 * Statuses an admin may pick when *creating* a manual registration.
 *
 * CANCELLED is deliberately absent. Nobody enters a registration that is
 * already cancelled — they cancel it afterwards, where updateOrderStatus
 * handles the slot release and sets the payment to FAILED, matching what the
 * ShurjoPay callback does on sp_code=1002.
 */
export const MANUAL_ORDER_STATUSES = ["PENDING", "CONFIRMED"] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
export type ManualOrderStatus = (typeof MANUAL_ORDER_STATUSES)[number];

// Bangladeshi mobile: 01XXXXXXXXX / +8801XXXXXXXXX / 8801XXXXXXXXX
export const BD_PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidBDPhone = (value: string) =>
  BD_PHONE_REGEX.test(value.replace(/[\s-]/g, ""));

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());
