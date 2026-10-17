// app/actions/admin.ts
"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { audit, diff } from "@/lib/audit";
import { isRegistrationStatus } from "@/lib/registration-status";

const EVENT_AUDIT_FIELDS = [
  "name",
  "slug",
  "date",
  "time",
  "address",
  "eventType",
  "shortDesc",
  "bannerImage",
  "thumbImage",
  "minPackagePrice",
  "organizerId",
  "status",
  "registrationStatus",
] as const;

// ─── Auth helper ────────────────────────────────────

// ─── Get All Events (Admin) ─────────────────────────
export async function getAdminEvents() {
  const { error, dbUser } = await requireAdmin();
  if (error) return { events: [], error };

  try {
    const events = await prisma.event.findMany({
      include: {
        organizer: { select: { id: true, name: true } },
        packages: {
          orderBy: { price: "asc" },
        },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { events: JSON.parse(JSON.stringify(events)) };
  } catch (err: any) {
    console.error("Admin events error:", err?.message);
    return { events: [], error: "Failed to fetch events" };
  }
}

// ─── Get Single Event (Admin) ───────────────────────
export async function getAdminEvent(eventId: string) {
  const { error } = await requireAdmin();
  if (error) return { event: null, error };

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: true,
        packages: { orderBy: { price: "asc" } },
        _count: { select: { orders: true } },
      },
    });

    if (!event) return { event: null, error: "Event not found" };

    return { event: JSON.parse(JSON.stringify(event)) };
  } catch (err: any) {
    return { event: null, error: "Failed to fetch event" };
  }
}

// ─── Get All Organizers ─────────────────────────────
export async function getOrganizers() {
  const { error } = await requireAdmin();
  if (error) return { organizers: [], error };

  try {
    const organizers = await prisma.organizer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return { organizers: JSON.parse(JSON.stringify(organizers)) };
  } catch (err: any) {
    return { organizers: [], error: "Failed to fetch organizers" };
  }
}

// ─── Create Event ───────────────────────────────────
export async function createEvent(formData: {
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
  registrationStatus?: string;
}) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };
  const registrationStatus = formData.registrationStatus ?? "OPEN";
  if (!isRegistrationStatus(registrationStatus)) {
    return { success: false, error: "Invalid registration status" };
  }

  try {
    // Check slug uniqueness
    const existing = await prisma.event.findUnique({
      where: { slug: formData.slug },
    });

    if (existing) {
      return {
        success: false,
        error: "An event with this slug already exists",
      };
    }

    const event = await prisma.event.create({
      data: {
        name: formData.name,
        slug: formData.slug,
        date: new Date(formData.date),
        time: new Date(`${formData.date}T${formData.time}:00Z`),
        address: formData.address,
        eventType: formData.eventType as "LIVE" | "VIRTUAL",
        description: formData.description,
        shortDesc: formData.shortDesc || null,
        bannerImage: formData.bannerImage,
        thumbImage: formData.thumbImage || null,
        minPackagePrice: formData.minPackagePrice
          ? parseFloat(formData.minPackagePrice)
          : null,
        organizerId: parseInt(formData.organizerId),
        status: formData.status as any,
        registrationStatus,
      },
    });

    await audit({
      action: "event.created",
      entityType: "event",
      entityId: event.id,
      eventId: event.id,
      summary: `Created event "${event.name}" (${event.slug})`,
    });

    return { success: true, error: "", eventId: String(event.id) };
  } catch (err: any) {
    console.error("Create event error:", err?.message);
    return { success: false, error: "Failed to create event" };
  }
}

// ─── Update Event ───────────────────────────────────
export async function updateEvent(
  eventId: string,
  formData: {
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
    registrationStatus?: string;
  },
) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };
  // Not sent = keep the current value (never silently reopen registration).
  const registrationStatus = formData.registrationStatus;
  if (registrationStatus !== undefined && !isRegistrationStatus(registrationStatus)) {
    return { success: false, error: "Invalid registration status" };
  }

  try {
    // 1. Fetch current event before updating to know if the slug changed
    const currentEvent = await prisma.event.findUnique({
      where: { id: eventId },
    });

    // Check slug uniqueness (exclude current event)
    const existing = await prisma.event.findFirst({
      where: { slug: formData.slug, NOT: { id: eventId } },
    });

    if (existing) {
      return { success: false, error: "Slug already in use by another event" };
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        name: formData.name,
        slug: formData.slug,
        date: new Date(formData.date),
        time: new Date(`${formData.date}T${formData.time}:00Z`),
        address: formData.address,
        eventType: formData.eventType as "LIVE" | "VIRTUAL",
        description: formData.description,
        shortDesc: formData.shortDesc || null,
        bannerImage: formData.bannerImage,
        thumbImage: formData.thumbImage || null,
        minPackagePrice: formData.minPackagePrice
          ? parseFloat(formData.minPackagePrice)
          : null,
        organizerId: parseInt(formData.organizerId),
        status: formData.status as any,
        ...(registrationStatus ? { registrationStatus } : {}),
      },
    });

    const changes = diff(currentEvent, updated, [...EVENT_AUDIT_FIELDS]);
    if (currentEvent && currentEvent.description !== updated.description) {
      changes.description = ["(previous text)", "(rich text edited)"];
    }
    if (Object.keys(changes).length > 0) {
      await audit({
        action: "event.updated",
        entityType: "event",
        entityId: eventId,
        eventId,
        summary: `Updated event "${updated.name}": ${Object.keys(changes).join(", ")}`,
        changes,
      });
    }

    // Purge the cache for the NEW slug (Updates the Detail Page & Metadata)
    revalidateTag(`event-${formData.slug}`, "max");

    // If the admin changed the slug, purge the OLD slug's cache too!
    if (currentEvent && currentEvent.slug !== formData.slug) {
      revalidateTag(`event-${currentEvent.slug}`, "max");
    }

    // Purge global lists so the new details (name/date/image) update on the Homepage
    revalidateTag("events", "max");
    revalidateTag("upcoming-events", "max");

    return { success: true, error: "" };
  } catch (err: any) {
    console.error("Update event error:", err?.message);
    return { success: false, error: "Failed to update event" };
  }
}

// ─── Toggle Event Active ────────────────────────────
export async function toggleEventActive(eventId: string, isActive: boolean) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const ev = await prisma.event.update({
      where: { id: eventId },
      data: { isActive },
    });

    await audit({
      action: isActive ? "event.activated" : "event.deactivated",
      entityType: "event",
      entityId: eventId,
      eventId,
      summary: `${isActive ? "Activated" : "Deactivated"} event "${ev.name}"`,
      changes: { isActive: [!isActive, isActive] },
    });

    return { success: true, error: "" };
  } catch (err: any) {
    return { success: false, error: "Failed to update event" };
  }
}

// ─── Delete Event ───────────────────────────────────
export async function deleteEvent(eventId: string) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const ev = await prisma.event.update({
      where: { id: eventId },
      data: { isArchived: true, isActive: false },
    });

    await audit({
      action: "event.deleted",
      entityType: "event",
      entityId: eventId,
      eventId,
      summary: `Deleted (archived) event "${ev.name}"`,
    });

    return { success: true, error: "" };
  } catch (err: any) {
    return { success: false, error: "Failed to delete event" };
  }
}

// ─── Add Package to Event ───────────────────────────
export async function addPackage(
  eventId: string,
  formData: {
    name: string;
    distance: string;
    price: string;
    availableSlots: string;
  },
) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const pkg = await prisma.package.create({
      data: {
        name: formData.name,
        distance: formData.distance,
        price: parseInt(formData.price),
        availableSlots: parseInt(formData.availableSlots),
        eventId,
      },
    });

    await audit({
      action: "package.created",
      entityType: "package",
      entityId: pkg.id,
      eventId,
      summary: `Added package "${pkg.name}" (${pkg.distance}) · ৳${pkg.price} · ${pkg.availableSlots} slots`,
    });

    return { success: true, error: "" };
  } catch (err: any) {
    return { success: false, error: "Failed to add package" };
  }
}

// ─── Update Package ─────────────────────────────────
export async function updatePackage(
  packageId: number,
  formData: {
    name: string;
    distance: string;
    price: string;
    availableSlots: string;
  },
) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const before = await prisma.package.findUnique({ where: { id: packageId } });
    const pkg = await prisma.package.update({
      where: { id: packageId },
      data: {
        name: formData.name,
        distance: formData.distance,
        price: parseInt(formData.price),
        availableSlots: parseInt(formData.availableSlots),
      },
    });

    const changes = diff(before, pkg, ["name", "distance", "price", "availableSlots"]);
    if (Object.keys(changes).length > 0) {
      await audit({
        action: "package.updated",
        entityType: "package",
        entityId: packageId,
        eventId: pkg.eventId,
        summary: `Updated package "${pkg.name}": ${Object.keys(changes).join(", ")}`,
        changes,
      });
    }

    return { success: true, error: "" };
  } catch (err: any) {
    return { success: false, error: "Failed to update package" };
  }
}

// ─── Delete Package ─────────────────────────────────
export async function deletePackage(packageId: number) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const pkg = await prisma.package.update({
      where: { id: packageId },
      data: { isActive: false, isArchived: true },
    });

    await audit({
      action: "package.deleted",
      entityType: "package",
      entityId: packageId,
      eventId: pkg.eventId,
      summary: `Deleted (archived) package "${pkg.name}"`,
    });

    return { success: true, error: "" };
  } catch (err: any) {
    return { success: false, error: "Failed to delete package" };
  }
}

// ─── Create Organizer ───────────────────────────────
export async function createOrganizer(formData: {
  name: string;
  email: string;
  phone: string;
  logo: string;
}) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const organizer = await prisma.organizer.create({
      data: {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        logo: formData.logo || null,
      },
    });

    await audit({
      action: "organizer.created",
      entityType: "organizer",
      entityId: organizer.id,
      summary: `Created organizer "${organizer.name}"`,
    });

    return { success: true, error: "", organizerId: organizer.id };
  } catch (err: any) {
    return { success: false, error: "Failed to create organizer" };
  }
}

// ─── Get Event Orders ───────────────────────────────
export async function getEventOrders(eventId: string) {
  const { error } = await requireAdmin();
  if (error) return { orders: [], error };

  try {
    const orders = await prisma.order.findMany({
      where: {
        eventId,
        isArchived: false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            image: true,
            isGuest: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            distance: true,
            price: true,
          },
        },
        registration: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            gender: true,
            tshirtSize: true,
            ageCategory: true,
            bloodGroup: true,
            communityName: true,
            runnerCategory: true,
            emergencyContactName: true,
            emergencyContactNumber: true,
            bibNumber: true,
            email: true,
            birthDate: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            transactionId: true,
            paymentId: true,
            paymentMethod: true,
            paymentGateway: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { orders: JSON.parse(JSON.stringify(orders)), error: null };
  } catch (err: any) {
    console.error("Get event orders error:", err?.message);
    return { orders: [], error: "Failed to fetch orders" };
  }
}

// ─── Update Order Status old version ────────────────────────────
// export async function updateOrderStatus(
//   orderId: string,
//   orderStatus: string,
//   paymentStatus: string,
// ) {
//   const { error } = await requireAdmin();
//   if (error) return { success: false, error };

//   try {
//     // Update order status
//     const order = await prisma.order.update({
//       where: { id: orderId },
//       data: {
//         status: orderStatus as "PENDING" | "CONFIRMED" | "CANCELLED",
//       },
//       select: {
//         eventId: true,
//         event: { select: { slug: true } },
//         payment: { select: { id: true } },
//         packageId: true,
//         qty: true,
//         status: true,
//       },
//     });

//     // Update payment status if payment exists
//     if (order.payment) {
//       await prisma.payment.update({
//         where: { id: order.payment.id },
//         data: {
//           status: paymentStatus as "PENDING" | "PAID" | "FAILED" | "REFUNDED",
//         },
//       });
//     }

//     // If order is cancelled, free up the used slots
//     if (orderStatus === "CANCELLED") {
//       await prisma.package.update({
//         where: { id: order.packageId },
//         data: {
//           usedSlots: { decrement: order.qty },
//         },
//       });
//     }

//     // If order is confirmed from cancelled, re-occupy slots
//     if (orderStatus === "CONFIRMED") {
//       // Only increment if it was previously not confirmed
//       // This is a safeguard — the UI should prevent double-confirming
//     }

//     revalidatePath("/profile");
//     revalidatePath("/events");
//     revalidatePath(`/events/${order.event.slug}`);

//     return { success: true, error: null };
//   } catch (err: any) {
//     console.error("Update order status error:", err?.message);
//     return { success: false, error: "Failed to update order status" };
//   }
// }

// ─── Update Order Status  new version────────────────────────────
export async function updateOrderStatus(
  orderId: string,
  orderStatus: string,
  paymentStatus: string,
) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    // Everything runs in one transaction so we can never end up with the
    // order updated but the slot count wrong.
    const { slug, before } = await prisma.$transaction(async (tx) => {
      // 1. Read the CURRENT status before we change anything.
      //    This is the key fix — we decide what to do based on the change
      //    (old → new), not just on the new value.
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          packageId: true,
          qty: true,
          eventId: true,
          event: { select: { slug: true } },
          payment: { select: { id: true, status: true } },
          registration: { select: { fullName: true } },
        },
      });
      if (!current) throw new Error("NOT_FOUND");

      // Lock in the transition first, guarded on the status we just read.
      // The conditional update row-locks the order, so a concurrent slot-hold
      // sweep or payment callback can't also move it and double-apply the
      // slot change below. holdExpiresAt is cleared: an admin decision is
      // never auto-released or auto-reclaimed.
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: current.status },
        data: {
          status: orderStatus as "PENDING" | "CONFIRMED" | "CANCELLED",
          holdExpiresAt: null,
        },
      });
      if (moved.count === 0) throw new Error("CONFLICT");

      // "Is this order occupying a slot right now?" — anything that isn't
      // cancelled is holding one.
      const held = current.status !== "CANCELLED";
      const willHold = orderStatus !== "CANCELLED";

      if (held && !willHold) {
        // CONFIRMED/PENDING → CANCELLED : give the slot back
        await tx.package.update({
          where: { id: current.packageId },
          data: { usedSlots: { decrement: current.qty } },
        });
      } else if (!held && willHold) {
        // CANCELLED → CONFIRMED/PENDING : take a slot again, but only if
        // the package hasn't filled up while this order was cancelled.
        const pkg = await tx.package.findUnique({
          where: { id: current.packageId },
          select: { availableSlots: true },
        });

        const claimed = await tx.package.updateMany({
          where: {
            id: current.packageId,
            usedSlots: { lte: pkg!.availableSlots - current.qty },
          },
          data: { usedSlots: { increment: current.qty } },
        });

        // updateMany matched nothing = the guard failed = package is full
        if (claimed.count === 0) throw new Error("NO_SLOTS");
      }
      // held === willHold → nothing changed, leave usedSlots alone.
      // This is what makes saving the same status twice safe.

      // 3. Update the payment, if there is one
      if (current.payment) {
        await tx.payment.update({
          where: { id: current.payment.id },
          data: {
            status: paymentStatus as "PENDING" | "PAID" | "FAILED" | "REFUNDED",
          },
        });
      }

      return { slug: current.event.slug, before: current };
    });

    const changes = diff(
      { status: before.status, paymentStatus: before.payment?.status ?? null },
      { status: orderStatus, paymentStatus: before.payment ? paymentStatus : null },
      ["status", "paymentStatus"],
    );
    if (Object.keys(changes).length > 0) {
      await audit({
        action: "order.status_changed",
        entityType: "order",
        entityId: orderId,
        eventId: before.eventId,
        summary: `Order ${orderId.slice(0, 8).toUpperCase()} (${before.registration?.fullName ?? "no name"}): ${before.status} → ${orderStatus}, payment ${before.payment?.status ?? "—"} → ${paymentStatus}`,
        changes,
      });
    }

    revalidatePath("/profile");
    revalidatePath("/events");
    revalidatePath(`/events/${slug}`);

    return { success: true, error: null };
  } catch (err: any) {
    if (err?.message === "NOT_FOUND")
      return { success: false, error: "Order not found" };
    if (err?.message === "CONFLICT")
      return {
        success: false,
        error: "This order just changed — refresh and try again",
      };
    if (err?.message === "NO_SLOTS")
      return { success: false, error: "No slots left to reinstate this order" };

    console.error("Update order status error:", err?.message);
    return { success: false, error: "Failed to update order status" };
  }
}

// ─── Get Single Order Details ───────────────────────
export async function getOrderDetails(orderId: string) {
  const { error } = await requireAdmin();
  if (error) return { order: null, error };

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            distance: true,
            price: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            date: true,
          },
        },
        registration: true,
        payment: true,
      },
    });

    if (!order) return { order: null, error: "Order not found" };

    return { order: JSON.parse(JSON.stringify(order)), error: null };
  } catch (err: any) {
    console.error("Get order details error:", err?.message);
    return { order: null, error: "Failed to fetch order" };
  }
}

// ─── Duplicate Event ────────────────────────────────
export async function duplicateEvent(eventId: string) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const original = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        packages: { where: { isArchived: false } },
      },
    });

    if (!original) return { success: false, error: "Event not found" };

    let newSlug = `${original.slug}-copy`;
    let counter = 1;
    while (await prisma.event.findUnique({ where: { slug: newSlug } })) {
      newSlug = `${original.slug}-copy-${counter++}`;
    }

    const newEvent = await prisma.event.create({
      data: {
        name: `${original.name} (Copy)`,
        slug: newSlug,
        date: original.date,
        time: original.time,
        address: original.address,
        eventType: original.eventType,
        description: original.description,
        bannerImage: original.bannerImage,
        thumbImage: original.thumbImage,
        minPackagePrice: original.minPackagePrice,
        organizerId: original.organizerId,
        status: "INACTIVE",
        isActive: false,
        packages: {
          create: original.packages.map((pkg) => ({
            name: pkg.name,
            distance: pkg.distance,
            price: pkg.price,
            availableSlots: pkg.availableSlots,
          })),
        },
      },
    });

    await audit({
      action: "event.duplicated",
      entityType: "event",
      entityId: newEvent.id,
      eventId: newEvent.id,
      summary: `Duplicated "${original.name}" as "${newEvent.name}" (${original.packages.length} packages, inactive)`,
      changes: { sourceEventId: [null, original.id] },
    });

    revalidatePath("/profile");
    revalidatePath("/events");

    return { success: true, error: "", eventId: String(newEvent.id) };
  } catch (err: any) {
    console.error("Duplicate event error:", err?.message);
    return { success: false, error: "Failed to duplicate event" };
  }
}

export async function deleteStorageImage(imageUrl: string) {
  const { error } = await requireAdmin();
  if (error) return { success: false, error };

  try {
    const supabase = await createClient();
    const bucket = "event-images";

    // Extract path from URL
    const bucketPrefix = `/storage/v1/object/public/${bucket}/`;
    const urlObj = new URL(imageUrl);
    const pathIndex = urlObj.pathname.indexOf(bucketPrefix);

    if (pathIndex === -1) {
      return { success: false, error: "Not a Supabase storage URL" };
    }

    const filePath = urlObj.pathname.slice(pathIndex + bucketPrefix.length);

    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (deleteError) throw deleteError;

    await audit({
      action: "image.deleted",
      entityType: "event",
      entityId: filePath,
      summary: `Deleted image from storage: ${filePath}`,
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Delete storage image error:", err?.message);
    return { success: false, error: "Failed to delete image" };
  }
}

// ─── Get Event Activity ─────────────────────────────
export async function getEventActivity(eventId: string) {
  const { error } = await requireAdmin();
  if (error) return { activities: [], error };

  try {
    const orders = await prisma.order.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
        package: {
          select: { name: true, distance: true, price: true },
        },
        registration: {
          select: {
            fullName: true,
            tshirtSize: true,
            runnerCategory: true,
          },
        },
        payment: {
          select: {
            amount: true,
            status: true,
            paymentMethod: true,
            transactionId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const activities: any[] = [];

    for (const order of orders) {
      const userName =
        order.registration?.fullName ||
        [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") ||
        order.user.email.split("@")[0];

      const userInfo = {
        name: userName,
        email: order.user.email,
        image: order.user.image,
      };

      const meta = {
        packageName: order.package.name,
        distance: order.package.distance,
        amount: order.payment?.amount || order.package.price * order.qty,
        qty: order.qty,
        orderStatus: order.status,
        paymentStatus: order.payment?.status || null,
        paymentMethod: order.payment?.paymentMethod || null,
        transactionId: order.payment?.transactionId || null,
        registrationName: order.registration?.fullName || null,
        tshirtSize: order.registration?.tshirtSize || null,
        runnerCategory: order.registration?.runnerCategory || null,
      };

      // 1. Registration activity (order creation)
      activities.push({
        id: `reg-${order.id}`,
        type: "registration",
        message: `${userName} registered for ${order.package.name}`,
        description: `${order.package.distance} package · Qty: ${order.qty}`,
        user: userInfo,
        meta,
        timestamp: order.createdAt,
      });

      // 2. Payment activity
      if (order.payment && order.payment.status === "PAID") {
        activities.push({
          id: `pay-${order.id}`,
          type: "payment",
          message: `Payment received from ${userName}`,
          description: `৳${Number(order.payment.amount).toLocaleString()} via ${
            order.payment.paymentMethod || "Unknown"
          }`,
          user: userInfo,
          meta,
          timestamp: order.payment.updatedAt || order.payment.createdAt,
        });
      }

      // 3. Confirmation activity
      if (order.status === "CONFIRMED") {
        activities.push({
          id: `conf-${order.id}`,
          type: "confirmation",
          message: `${userName}'s order confirmed`,
          description: `${order.package.name} — ${order.package.distance}`,
          user: userInfo,
          meta,
          timestamp: order.updatedAt,
        });
      }

      // 4. Cancellation activity
      if (order.status === "CANCELLED") {
        activities.push({
          id: `cancel-${order.id}`,
          type: "cancellation",
          message: `${userName}'s order was cancelled`,
          description: `${order.package.name} — ৳${(
            order.package.price * order.qty
          ).toLocaleString()}`,
          user: userInfo,
          meta,
          timestamp: order.updatedAt,
        });
      }
    }

    // Sort all activities by timestamp (newest first)
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      activities: JSON.parse(JSON.stringify(activities)),
      error: null,
    };
  } catch (err: any) {
    console.error("Get event activity error:", err?.message);
    return { activities: [], error: "Failed to fetch activity" };
  }
}

// ─── Get Global Activity (All Events) ───────────────
export async function getGlobalActivity() {
  const { error } = await requireAdmin();
  if (error) return { activities: [], error };

  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
        package: {
          select: { name: true, distance: true, price: true },
        },
        event: {
          select: { name: true, slug: true },
        },
        registration: {
          select: {
            fullName: true,
            tshirtSize: true,
            runnerCategory: true,
          },
        },
        payment: {
          select: {
            amount: true,
            status: true,
            paymentMethod: true,
            transactionId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const activities: any[] = [];

    for (const order of orders) {
      const userName =
        order.registration?.fullName ||
        [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") ||
        order.user.email.split("@")[0];

      const userInfo = {
        name: userName,
        email: order.user.email,
        image: order.user.image,
      };

      const meta = {
        packageName: order.package.name,
        distance: order.package.distance,
        amount: order.payment?.amount || order.package.price * order.qty,
        qty: order.qty,
        orderStatus: order.status,
        paymentStatus: order.payment?.status || null,
        paymentMethod: order.payment?.paymentMethod || null,
        transactionId: order.payment?.transactionId || null,
        registrationName: order.registration?.fullName || null,
        tshirtSize: order.registration?.tshirtSize || null,
        runnerCategory: order.registration?.runnerCategory || null,
        eventName: order.event.name,
        eventSlug: order.event.slug,
      };

      activities.push({
        id: `reg-${order.id}`,
        type: "registration",
        message: `${userName} registered for ${order.package.name}`,
        description: `${order.event.name} · ${order.package.distance}`,
        user: userInfo,
        meta,
        timestamp: order.createdAt,
      });

      if (order.payment && order.payment.status === "PAID") {
        activities.push({
          id: `pay-${order.id}`,
          type: "payment",
          message: `Payment received from ${userName}`,
          description: `৳${Number(
            order.payment.amount,
          ).toLocaleString()} · ${order.event.name}`,
          user: userInfo,
          meta,
          timestamp: order.payment.updatedAt || order.payment.createdAt,
        });
      }

      if (order.status === "CANCELLED") {
        activities.push({
          id: `cancel-${order.id}`,
          type: "cancellation",
          message: `${userName}'s order cancelled`,
          description: `${order.event.name} · ${order.package.name}`,
          user: userInfo,
          meta,
          timestamp: order.updatedAt,
        });
      }
    }

    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      activities: JSON.parse(JSON.stringify(activities)),
      error: null,
    };
  } catch (err: any) {
    console.error("Get global activity error:", err?.message);
    return { activities: [], error: "Failed to fetch activity" };
  }
}
