// ─────────────────────────────────────────────────────────────
// Your checkout actions file (the one you pasted first).
//
// Changes:
//   1. createGuestUser → getOrCreateGuestUser. One User row per email.
//      An existing row (guest OR real account) is reused, so the order lands
//      in that person's history and appears the moment they log in.
//   2. The duplicated guest coupon branch is gone — ~90 lines removed.
//      See the note above the coupon block before you accept this.
//   3. A logged-in user with no Prisma row now self-heals via syncUser
//      instead of dead-ending on "User not found".
//   4. Several log.flush() placement fixes.
// ─────────────────────────────────────────────────────────────

"use server";

import { syncUser } from "@/lib/auth/syncUser"; // ← NEW
import { Prisma } from "@/lib/generated/prisma"; // ← NEW: for the P2002 race check
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRequestId } from "@/utils/requestUtils";
import { audit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { SOURCE_COOKIE, decodeSourceCookie } from "@/lib/traffic-source";
import { VIRTUAL_TSHIRT, validateRegistration } from "@/lib/registration-validation";
import {
  claimSlots,
  newHoldExpiry,
  releaseExpiredHolds,
} from "@/lib/slot-hold";

// ─── GET CHECKOUT DATA ─────────────────────────────────────
// UNCHANGED.
export async function getCheckoutData(packageId: number) {
  const requestId = await getRequestId();
  const start = Date.now();

  const log = logger.child({
    requestId,
    action: "getCheckoutData",
    packageId,
  });

  log.info("action:start");

  try {
    const dbStart = Date.now();

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        event: { include: { organizer: true } },
      },
    });

    const dbDuration = Date.now() - dbStart;

    if (!pkg) {
      log.warn(
        {
          db: {
            model: "Package",
            operation: "findUnique",
            durationMs: dbDuration,
          },
        },
        "db:not_found",
      );
      log.info({ durationMs: Date.now() - start }, "action:success");
      return { package: null, error: "Package not found" };
    }

    log.info(
      {
        db: {
          model: "Package",
          operation: "findUnique",
          durationMs: dbDuration,
        },
        eventId: pkg.eventId,
      },
      "db:success",
    );

    log.info({ durationMs: Date.now() - start, found: true }, "action:success");
    return { package: JSON.parse(JSON.stringify(pkg)) };
  } catch (error) {
    log.error({ err: error, durationMs: Date.now() - start }, "action:error");

    console.error("Failed to fetch checkout data:", error);
    return { package: null, error: "Failed to fetch checkout data" };
  } finally {
    await log.flush();
  }
}

// ─── GET OR CREATE GUEST USER ──────────────────────────────
// ← EDITED: renamed from createGuestUser. It no longer always creates.
//
// One User row per email address, always. Guest vs registered is just the
// isGuest flag on that row, not a separate row. That single rule is what
// makes "show me my guest purchases after I log in" work with zero extra
// code — the orders are already on the right User.id.
//
// The real email now lives on User.email as well as Registration.email.
async function getOrCreateGuestUser(params: {
  email?: string; // ← NEW
  fullName?: string; // ← NEW
  requestId?: string; // ← NEW: reuse the caller's id so logs stay correlated
}) {
  const { email, fullName, requestId: parentRequestId } = params;

  const requestId = parentRequestId ?? (await getRequestId()); // ← EDITED
  const log = logger.child({ requestId, action: "getOrCreateGuestUser" });

  // ← NEW: normalise so "A@Gmail.com " and "a@gmail.com" resolve to one row.
  // syncUser lowercases too — the two must agree or adoption misses.
  const normalizedEmail = email?.trim().toLowerCase() || null;

  // ← NEW: only look up when we actually have an email. Registration.email is
  // nullable in your schema, so an empty checkout email is possible.
  if (normalizedEmail) {
    const lookupStart = Date.now();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    log.info(
      {
        db: {
          model: "User",
          operation: "findUnique",
          durationMs: Date.now() - lookupStart,
        },
        found: !!existing,
      },
      "db:guest_lookup",
    );

    if (existing) {
      // ← NEW: the one case we still refuse. A disabled or archived account
      // shouldn't be quietly resurrected by typing its email into checkout.
      if (!existing.isActive || existing.isArchived) {
        log.warn({ userId: existing.id }, "guest:blocked_disabled_account");
        throw new Error("ACCOUNT_DISABLED");
      }

      // ← EDITED: this is where ACCOUNT_EXISTS used to throw. A real account
      // is now reused exactly like a returning guest is.
      log.info(
        { userId: existing.id, wasGuest: existing.isGuest },
        "guest:reused_existing",
      );
      return existing;
    }
  }

  const guestUuid = crypto.randomUUID();
  const guestAuthId = `guest_${guestUuid}`;

  // ← EDITED: fallback was `${guestAuthId.slice(0, 12)}@guest.com`.
  // .invalid is a reserved TLD — it can never be a deliverable address, and
  // the full uuid means it can never collide with the unique constraint.
  const finalEmail = normalizedEmail ?? `${guestAuthId}@guest.invalid`;

  // ← EDITED: use the real name from the form instead of "guest_a1b2".
  const guestName =
    fullName?.trim().split(/\s+/)[0] || `guest_${guestUuid.slice(0, 4)}`;

  log.info("db:creating guest user");
  const dbStart = Date.now();

  try {
    const user = await prisma.user.create({
      data: {
        authId: guestAuthId,
        email: finalEmail, // ← EDITED: was the fake @guest.com address
        firstName: guestName, // ← EDITED: now from formData.fullName
        isGuest: true,
        role: "USER",
        isActive: true,
        isArchived: false,
      },
    });

    log.info(
      {
        db: {
          model: "User",
          operation: "create",
          durationMs: Date.now() - dbStart,
        },
        guestUserId: user.id,
      },
      "db:success",
    );

    return user;
  } catch (error) {
    // ← NEW: two checkouts with the same email can both pass the findUnique
    // above and then race on create. email is @unique, so the loser gets
    // P2002 — just fetch the winner's row.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      normalizedEmail
    ) {
      const raced = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (raced) {
        log.warn({ userId: raced.id }, "guest:create_race_resolved");
        return raced;
      }
    }
    throw error;
  }
}

const MAX_QTY_PER_ORDER = 10;

// ─── PLACE ORDER ───────────────────────────────────────────
export async function placeOrder(formData: {
  packageId: number;
  eventId: string;
  qty: number;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  birthDate: string;
  ageCategory: string;
  bloodGroup: string;
  tshirtSize: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  communityName?: string;
  runnerCategory: string;
  paymentMethod: string;
  couponCode?: string;
}) {
  const requestId = await getRequestId();
  const start = Date.now();

  const log = logger.child({
    requestId,
    action: "placeOrder",
    packageId: formData.packageId,
    eventId: formData.eventId,
    qty: formData.qty,
    paymentMethod: formData.paymentMethod,
    hasCoupon: !!formData.couponCode,
  });

  log.info("action:start");

  // qty drives both price and slot math — a 0/negative/fractional value would
  // create a free order or hand slots back.
  if (
    !Number.isInteger(formData.qty) ||
    formData.qty < 1 ||
    formData.qty > MAX_QTY_PER_ORDER
  ) {
    log.warn({ qty: formData.qty }, "order:invalid_qty");
    await log.flush();
    return { error: "Invalid ticket quantity" };
  }

  // ─── VALIDATE THE FORM (never trust the browser) ───────
  // Runs before a guest account is created, so bad input never reaches the
  // database. Everything below uses the cleaned values.
  const checked = validateRegistration(formData);
  if (!checked.ok) {
    log.warn({ field: checked.field }, "order:invalid_input");
    await log.flush();
    return { error: checked.error };
  }
  const reg = checked.data;
  formData = {
    ...formData,
    fullName: reg.fullName,
    email: reg.email,
    phone: reg.phone,
    gender: reg.gender,
    ageCategory: reg.ageCategory,
    bloodGroup: reg.bloodGroup,
    tshirtSize: reg.tshirtSize,
    emergencyContactName: reg.emergencyContactName ?? undefined,
    emergencyContactNumber: reg.emergencyContactNumber ?? undefined,
    communityName: reg.communityName ?? undefined,
    runnerCategory: reg.runnerCategory,
    paymentMethod: reg.paymentMethod,
  };

  // ─── RESOLVE USER (logged-in OR guest) ─────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dbUser: { id: string } | null = null;
  let isGuest = false;

  if (user) {
    const dbStart = Date.now();

    dbUser = await prisma.user.findUnique({
      where: { authId: user.id },
    });

    if (!dbUser) {
      // ← EDITED: used to return { error: "User not found" } and dead-end.
      // A logged-in user with no Prisma row is a broken account, not a bad
      // request — self-heal instead of blocking a paying customer.
      log.warn(
        { auth: { reason: "user_not_in_db" } },
        "auth:self_healing_via_sync",
      );

      try {
        dbUser = await syncUser(user);
      } catch (e) {
        log.error({ err: e, auth: { reason: "sync_failed" } }, "auth:failure");
        await log.flush(); // ← NEW: this early return used to skip the flush entirely
        return { error: "Could not load your account. Please try again." };
      }
    }

    log.info(
      {
        userId: dbUser.id,
        auth: { isGuest: false },
        db: {
          model: "User",
          operation: "findUnique",
          durationMs: Date.now() - dbStart,
        },
      },
      "auth:success",
    );
  } else {
    log.info({ auth: { reason: "no_session" } }, "auth:guest_path");

    try {
      dbUser = await getOrCreateGuestUser({
        // ← EDITED: was createGuestUser() with no args
        email: formData.email, // ← NEW
        fullName: formData.fullName, // ← NEW
        requestId, // ← NEW
      });

      // NOTE: isGuest now means "this checkout was unauthenticated".
      // It does NOT mean dbUser is a throwaway row — it may well be a real
      // account that just wasn't logged in.
      isGuest = true;

      log.info(
        { userId: dbUser.id, auth: { isGuest: true } },
        "auth:guest_created",
      );
    } catch (error) {
      // ← EDITED: the ACCOUNT_EXISTS branch is gone. Only disabled accounts
      // stop here now.
      if (error instanceof Error && error.message === "ACCOUNT_DISABLED") {
        log.warn({ auth: { reason: "account_disabled" } }, "auth:failure");
        await log.flush();
        return {
          error: "This account is not available. Please contact support.",
        };
      }

      log.error(
        {
          err: error,
          auth: { reason: "guest_creation_failed" },
          durationMs: Date.now() - start,
        },
        "auth:failure",
      );

      console.error("Failed to create guest user:", error);
      await log.flush(); // ← NEW
      return { error: "Failed to process checkout. Please try again." };
    }
    // ← EDITED: removed `finally { await log.flush(); }`.
    // It fired on the SUCCESS path too, flushing the logger mid-request while
    // the rest of placeOrder still had ~30 lines left to write.
  }

  const userId = dbUser.id;

  // re-bind log with userId so every log below carries it
  const logWithUser = log.child({ userId, isGuest });

  try {
    const pkgStart = Date.now();

    const pkg = await prisma.package.findUnique({
      where: { id: formData.packageId },
      include: { event: { select: { eventType: true } } },
    });
    const pkgDuration = Date.now() - pkgStart;

    if (!pkg) {
      logWithUser.warn(
        {
          db: {
            model: "Package",
            operation: "findUnique",
            durationMs: pkgDuration,
          },
        },
        "db:not_found",
      );
      return { error: "Package not found" };
    }

    logWithUser.info(
      {
        db: {
          model: "Package",
          operation: "findUnique",
          durationMs: pkgDuration,
        },
      },
      "db:success",
    );

    if (pkg.eventId !== formData.eventId || !pkg.isActive) {
      logWithUser.warn(
        { pkgEventId: pkg.eventId, pkgActive: pkg.isActive },
        "order:package_not_available",
      );
      return { error: "This package is not available" };
    }

    // "No T-shirt" is only for virtual events.
    if (reg.tshirtSize === VIRTUAL_TSHIRT && pkg.event.eventType !== "VIRTUAL") {
      logWithUser.warn("order:invalid_input — VIRTUAL t-shirt on a live event");
      return { error: "Select a T-shirt size." };
    }

    // ─── FREE EXPIRED HOLDS ────────────────────────────────
    // Abandoned checkouts on this package past their hold go back to the pool
    // before we check availability.
    try {
      // No gateway check here (keeps checkout fast): orders that reached
      // ShurjoPay are only released by the background sweep after verifying.
      const { slugs: releasedSlugs } = await releaseExpiredHolds({
        packageId: pkg.id,
      });
      if (releasedSlugs.length > 0) {
        logWithUser.info({ releasedSlugs }, "slots:expired_holds_released");
        for (const slug of releasedSlugs) revalidateTag(`event-${slug}`, "max");
      }
    } catch (err) {
      // Non-fatal: the claim below is still authoritative.
      logWithUser.error({ err }, "slots:release_expired_failed");
    }

    // ─── CALCULATE PRICING ─────────────────────────────────
    const subtotal = Number(pkg.price) * formData.qty;
    let discount = 0;
    let couponId: string | null = null;

    // ─── VALIDATE COUPON ───────────────────────────────────
    //
    // ← EDITED: the entire `if (!isGuest) { ... } else { ... }` split is gone,
    // and with it ~90 lines of copy-paste.
    //
    // The guest branch only existed because every guest used to get a fresh
    // User row, which made maxUsesPerUser unenforceable for them. Now that one
    // email maps to one row, coupon.usages is meaningful for guests too, so
    // everyone runs the same validation.
    //
    // ⚠️ This TIGHTENS behaviour: a guest reusing a single-use coupon will now
    // be rejected where before they weren't. That was a revenue hole, but if
    // you'd rather keep it open for now, change the `usages` include below to
    // `usages: isGuest ? { where: { id: "" } } : { where: { userId } }`.
    if (formData.couponCode) {
      const couponCode = formData.couponCode.toUpperCase().trim();

      logWithUser.info({ couponCode }, "coupon:validating");

      const couponStart = Date.now();

      const coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode, // ← EDITED: was recomputing .toUpperCase().trim()
          eventId: formData.eventId,
          isActive: true,
          isArchived: false,
        },
        include: {
          usages: { where: { userId } }, // ← EDITED: now applied to guests too
          packages: { select: { id: true } },
        },
      });

      logWithUser.info(
        {
          db: {
            model: "Coupon",
            operation: "findFirst",
            durationMs: Date.now() - couponStart,
          },
        },
        coupon ? "db:success" : "db:not_found",
      );

      if (!coupon) {
        logWithUser.warn({ couponCode }, "coupon:invalid — not found");
        return { error: "Invalid coupon code" };
      }

      // scope check
      if (coupon.scopeType === "PACKAGE") {
        const applicableIds = coupon.packages.map((p) => p.id);
        if (
          applicableIds.length > 0 &&
          !applicableIds.includes(formData.packageId)
        ) {
          logWithUser.warn(
            { couponCode, couponId: coupon.id },
            "coupon:invalid — not for this package",
          );
          return { error: "This coupon is not valid for this package" };
        }
      }

      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validUntil) {
        logWithUser.warn(
          { couponCode, couponId: coupon.id },
          "coupon:invalid — outside valid time window",
        );
        return { error: "Coupon is not valid at this time" };
      }

      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        logWithUser.warn(
          { couponCode, couponId: coupon.id },
          "coupon:invalid — global usage limit reached",
        );
        return { error: "Coupon usage limit reached" };
      }

      if (coupon.usages.length >= coupon.maxUsesPerUser) {
        logWithUser.warn(
          { couponCode, couponId: coupon.id },
          "coupon:invalid — already used this coupon",
        );
        return { error: "You have already used this coupon" };
      }

      if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
        logWithUser.warn(
          { couponCode, couponId: coupon.id },
          "coupon:invalid — Minimum order amount",
        );
        return { error: `Minimum order amount is ৳${coupon.minOrderAmount}` };
      }

      if (coupon.discountType === "PERCENTAGE") {
        discount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = coupon.discountValue;
      }

      // ← EDITED: clamp moved ABOVE the log. In your original the clamp ran
      // after, so the log recorded the un-clamped discount.
      discount = Math.min(discount, subtotal);
      couponId = coupon.id;

      logWithUser.info(
        { couponCode, couponId: coupon.id, discount, isGuest },
        "coupon:applied",
      );
    }

    const total = subtotal - discount;

    logWithUser.info({ subtotal, discount, total }, "order:pricing_calculated");

    // ─── CREATE ORDER TRANSACTION ──────────────────────────
    logWithUser.info("db:transaction_start");
    const txStart = Date.now();

    // Marketing channel that brought this buyer (30-day cookie, last non-direct).
    const channel = decodeSourceCookie((await cookies()).get(SOURCE_COOKIE)?.value);

    const order = await prisma.$transaction(async (tx) => {
      logWithUser.info("tx:order.create");

      const newOrder = await tx.order.create({
        data: {
          userId, // ← EDITED: was dbUser!.id, now uses the const
          packageId: formData.packageId,
          eventId: formData.eventId,
          qty: formData.qty,
          subtotal,
          discount,
          total,
          status: "PENDING",
          couponId,
          holdExpiresAt: newHoldExpiry(),
          trafficSource: channel?.source ?? null,
          trafficCampaign: channel?.campaign || null,
        },
      });

      logWithUser.info({ orderId: newOrder.id }, "tx:registration.create");

      await tx.registration.create({
        data: {
          eventId: formData.eventId,
          orderId: newOrder.id,
          email: formData.email || null, // real email still stored here too
          fullName: formData.fullName,
          phone: formData.phone.trim(),
          gender: formData.gender,
          birthDate: reg.birthDate,
          ageCategory: formData.ageCategory,
          bloodGroup: formData.bloodGroup,
          tshirtSize: formData.tshirtSize,
          emergencyContactName: formData.emergencyContactName || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          communityName: formData.communityName || null,
          runnerCategory: formData.runnerCategory,
        },
      });

      logWithUser.info({ orderId: newOrder.id }, "tx:payment.create");

      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          amount: Math.round(total),
          currency: "BDT",
          status: "PENDING",
          paymentMethod: formData.paymentMethod,
        },
      });

      // ⚠️ SEE STEP 6 IN THE WRITE-UP.
      // Nothing here writes CouponUsage or increments coupon.usedCount.
      // If that doesn't happen in your payment webhook either, then
      // coupon.usages is always empty, and the maxUsesPerUser check above can
      // never fire — for guests OR logged-in users.

      logWithUser.info(
        { orderId: newOrder.id, qty: formData.qty },
        "tx:package.usedSlots.increment",
      );

      // Atomic claim: two buyers racing for the last slot can't both pass.
      if (!(await claimSlots(tx, formData.packageId, formData.qty))) {
        throw new Error("NO_SLOTS"); // rolls back the whole order
      }

      return newOrder;
    });

    logWithUser.info(
      {
        orderId: order.id,
        total,
        discount,
        db: { operation: "transaction", durationMs: Date.now() - txStart },
      },
      "db:transaction_success",
    );

    await audit({
      actor: {
        id: userId,
        label: `${isGuest ? "Guest · " : ""}${formData.email || "no email"}`,
      },
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      eventId: formData.eventId,
      summary: `${formData.fullName} placed an order · ${pkg.name} ×${formData.qty} · ৳${Math.round(total)}${couponId ? ` (coupon ${formData.couponCode?.toUpperCase().trim()}, −৳${Math.round(discount)})` : ""}`,
    });

    logWithUser.info(
      { orderId: order.id, durationMs: Date.now() - start },
      "action:success",
    );

    return {
      success: true,
      orderId: order.id,
      amount: Math.round(total),
      discount: Math.round(discount),
      isGuest,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "NO_SLOTS") {
      logWithUser.warn({ qty: formData.qty }, "order:slot_limit_exceeded");
      return { error: "Sorry, not enough slots left for this package" };
    }
    logWithUser.error(
      { err: error, durationMs: Date.now() - start },
      "action:error",
    );
    console.error("Failed to place order:", error);
    return { error: "Failed to place order. Please try again." };
  } finally {
    await log.flush();
    await logWithUser.flush();
  }
}
