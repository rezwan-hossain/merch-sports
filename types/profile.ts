// types/profile.ts
export type UserProfile = {
  id: string;
  authId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  phone: string | null;
  address: string | null;
  birthDate: string | null;
  gender: string | null;
  image: string | null;
  role: string;
  createdAt: string;
};

export type ProfileFormData = {
  firstName: string;
  lastName: string;
  userName: string;
  phone: string;
  address: string;
  birthDate: string;
  gender: string;
};

export type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type AdminEvent = {
  id: string;
  name: string;
  slug: string;
  date: string;
  time: string;
  address: string;
  eventType: string;
  description: string;
  shortDesc: string | null;
  bannerImage: string;
  thumbImage: string | null;
  minPackagePrice: number | null;
  status: string;
  registrationStatus?: string;
  isActive: boolean;
  organizerId: number;
  organizer: {
    id: number;
    name: string;
  };
  packages: AdminPackage[];
  _count: {
    orders: number;
  };
};

export type AdminPackage = {
  id: number;
  name: string;
  distance: string;
  price: number;
  availableSlots: number;
  usedSlots: number;
  status: string;
  isActive: boolean;
};

export type AdminOrganizer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  logo: string | null;
};

export type EventFormData = {
  name: string;
  slug: string;
  date: string;
  time: string;
  address: string;
  eventType: string;
  description: string;
  shortDesc: string;
  bannerImage: string;
  thumbImage: string;
  minPackagePrice: string;
  organizerId: string;
  status: string;
  registrationStatus: string;
};

export type PackageFormData = {
  name: string;
  distance: string;
  price: string;
  availableSlots: string;
};

// ─── Manual registration ────────────────────────────

export type OrderSource = "ONLINE" | "MANUAL";

/** Live package data for the manual registration form. */
export type ManualPackage = {
  id: number;
  name: string;
  distance: string;
  price: number;
  availableSlots: number;
  usedSlots: number;
  isActive: boolean;
  status: string;
};

/**
 * Payload for createManualRegistration.
 * orderStatus excludes CANCELLED on purpose — see MANUAL_ORDER_STATUSES
 * in lib/registration-options.ts.
 */
export type ManualRegistrationInput = {
  eventId: string;
  packageId: number;
  qty: number;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  birthDate: string;
  ageCategory: string;
  bloodGroup: string;
  tshirtSize: string;
  runnerCategory: string;
  communityName: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  bibNumber: string;
  discount: number;
  orderStatus: "PENDING" | "CONFIRMED";
  adminNote: string;
};

// ─── Orders ─────────────────────────────────────────

export type EventOrder = {
  id: string;
  status: string;
  qty: number;
  createdAt: string;
  source: OrderSource;
  subtotal: number;
  discount: number;
  total: number;
  adminNote: string | null;
  createdById: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    isGuest: boolean;
  };
  package: {
    id: number;
    name: string;
    distance: string;
    price: number;
  };
  registration: {
    id: string;
    fullName: string;
    phone: string;
    gender: string;
    tshirtSize: string;
    ageCategory: string;
    bloodGroup: string;
    communityName: string | null;
    runnerCategory: string;
    emergencyContactName: string | null;
    emergencyContactNumber: string | null;
    bibNumber: string | null;
    email: string | null;
    birthDate: string | null;
  } | null;
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    transactionId: string | null;
    paymentId: string | null;
    paymentMethod: string | null;
    paymentGateway: string | null;
  } | null;
};

/** What the UI holds. Unchanged — the modal turns this into an OrderQuery. */
export type OrderFilterState = {
  search: string;
  paymentStatus: string;
  orderStatus: string;
  source: "all" | OrderSource;
  sortBy: "newest" | "oldest" | "amount_high" | "amount_low";
};

/** What gets sent to the server: the filters plus paging. */
export type OrderQuery = OrderFilterState & {
  page: number; // 1-based
  pageSize: number; // capped at 100 server-side
};

export type OrderStats = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalRevenue: number;
  paidRevenue: number;
};

// ─── Activity ───────────────────────────────────────

export type ActivityItem = {
  id: string;
  type: "registration" | "payment" | "cancellation" | "confirmation";
  message: string;
  description: string;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  meta: {
    packageName: string;
    distance: string;
    amount: number;
    qty: number;
    orderStatus: string;
    paymentStatus: string | null;
    paymentMethod: string | null;
    transactionId: string | null;
    registrationName: string | null;
    tshirtSize: string | null;
    runnerCategory: string | null;
    eventName?: string; // only in global view
    eventSlug?: string; // only in global view
    source?: OrderSource;
  };
  timestamp: string;
};

export type ActivityFilterState = {
  type: "all" | "registration" | "payment" | "cancellation" | "confirmation";
  search: string;
};

export type ActivityStats = {
  total: number;
  registrations: number;
  payments: number;
  cancellations: number;
  confirmations: number;
  todayCount: number;
  weekCount: number;
};

/** Fields an admin can correct on an existing registration. */
export type RegistrationEditInput = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  birthDate: string; // YYYY-MM-DD
  ageCategory: string;
  bloodGroup: string;
  tshirtSize: string;
  runnerCategory: string;
  communityName: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  bibNumber: string;
};
