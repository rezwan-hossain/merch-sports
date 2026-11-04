// app/actions/audit-log.ts
"use server";

// Read side of the audit trail (lib/audit.ts writes it). Admin only.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Prisma } from "@/lib/generated/prisma";
import type {
  AuditCategory,
  AuditEntry,
  AuditFilters,
  AuditSubject,
} from "@/types/audit";

const PAGE_SIZES = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;

// Entries whose entityId is an order id (payments and registrations are logged
// against their order), so we can show who the runner is.
const ORDER_ENTITY_TYPES = ["order", "payment", "registration"];

// Entries a human has to act on (refunds, confirmations, reviews).
const ATTENTION_ACTIONS = [
  "payment.duplicate",
  "payment.paid_no_slot",
  "payment.amount_mismatch",
  "payment.unknown_status",
  "payment.paid_no_callback",
  "payment.gateway_error",
];

const CATEGORY_WHERE: Record<AuditCategory, Prisma.AuditLogWhereInput> = {
  all: {},
  attention: { action: { in: ATTENTION_ACTIONS } },
  orders: { entityType: { in: ["order", "registration"] } },
  payments: { entityType: "payment" },
  events: { entityType: { in: ["event", "package", "organizer"] } },
  coupons: { entityType: "coupon" },
  content: { entityType: { in: ["hero", "gallery", "team", "faq"] } },
  messages: { action: { startsWith: "notification." } },
};

export async function getAuditLogs(
  filters: AuditFilters,
  requestedPage = 1,
  requestedPageSize = DEFAULT_PAGE_SIZE,
): Promise<{
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
}> {
  const pageSize = PAGE_SIZES.includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  const empty = { entries: [], total: 0, page: 1, pageSize };

  const { error } = await requireAdmin();
  if (error) return { ...empty, error };

  try {
    const where = await buildWhere(filters);

    // Clamp to the last page, so a filter that shrinks the result set (or a
    // stale page number) still returns rows instead of an empty page.
    const total = await prisma.auditLog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageNumber = Math.min(
      Math.max(1, Math.floor(Number(requestedPage)) || 1),
      totalPages,
    );

    const page = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pageNumber - 1) * pageSize,
      take: pageSize,
    });

    const subjects = await loadSubjects(page);

    return {
      entries: page.map((r) => toEntry(r, subjects)),
      total,
      page: pageNumber,
      pageSize,
      error: null,
    };
  } catch (err) {
    console.error("getAuditLogs error:", err);
    return { ...empty, error: "Failed to load the audit log" };
  }
}

// ─── Shared by the list and the CSV export ────────────
type Row = Awaited<ReturnType<typeof prisma.auditLog.findMany>>[number];

async function buildWhere(filters: AuditFilters): Promise<Prisma.AuditLogWhereInput> {
  const term = filters.search.trim();

  // Searching a runner's name/phone/email should also find their payment
  // entries, whose summaries don't contain the name.
  const matchingOrderIds = term
    ? (
        await prisma.order.findMany({
          where: {
            OR: [
              { registration: { is: { fullName: { contains: term, mode: "insensitive" } } } },
              { registration: { is: { email: { contains: term, mode: "insensitive" } } } },
              { registration: { is: { phone: { contains: term.replace(/[\s-]/g, "") } } } },
              { user: { email: { contains: term, mode: "insensitive" } } },
            ],
          },
          select: { id: true },
          take: 500,
        })
      ).map((o) => o.id)
    : [];

  return {
    ...CATEGORY_WHERE[filters.category],
    ...(filters.eventId !== "all" && { eventId: filters.eventId }),
    ...(term && {
      OR: [
        { summary: { contains: term, mode: "insensitive" } },
        { actorLabel: { contains: term, mode: "insensitive" } },
        { entityId: { startsWith: term.toLowerCase() } },
        { action: { contains: term, mode: "insensitive" } },
        ...(matchingOrderIds.length > 0
          ? [
              {
                entityType: { in: ORDER_ENTITY_TYPES },
                entityId: { in: matchingOrderIds },
              },
            ]
          : []),
      ],
    }),
  };

}

async function loadSubjects(rows: Row[]): Promise<Map<string, AuditSubject>> {
  // Who is behind each order/payment entry — one query for the whole page.
  const orderIds = [
    ...new Set(
      rows
        .filter((r) => ORDER_ENTITY_TYPES.includes(r.entityType))
        .map((r) => r.entityId),
    ),
  ];
  const subjects = new Map<string, AuditSubject>();
  if (orderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        status: true,
        registration: { select: { fullName: true, email: true, phone: true } },
        user: { select: { email: true, phone: true, firstName: true, lastName: true } },
        package: { select: { name: true } },
        event: { select: { name: true } },
        payment: { select: { status: true } },
      },
    });
    for (const o of orders) {
      subjects.set(o.id, {
        orderId: o.id,
        name:
          o.registration?.fullName ||
          [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") ||
          "Unknown",
        email: o.registration?.email || o.user.email || null,
        phone: o.registration?.phone || o.user.phone || null,
        packageName: o.package.name,
        eventName: o.event.name,
        orderStatus: o.status,
        paymentStatus: o.payment?.status ?? null,
      });
    }
  }

  return subjects;
}

function toEntry(r: Row, subjects: Map<string, AuditSubject>): AuditEntry {
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actorId: r.actorId,
    actorLabel: r.actorLabel,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    eventId: r.eventId,
    summary: r.summary,
    changes: (r.changes as AuditEntry["changes"]) ?? null,
    requestId: r.requestId,
    subject: ORDER_ENTITY_TYPES.includes(r.entityType)
      ? (subjects.get(r.entityId) ?? null)
      : null,
  };
}

// ─── CSV export: every entry matching the filters ─────
const EXPORT_CAP = 20_000;

export async function exportAuditLogs(filters: AuditFilters): Promise<{
  entries: AuditEntry[];
  total: number;
  truncated: boolean;
  error: string | null;
}> {
  const { error } = await requireAdmin();
  if (error) return { entries: [], total: 0, truncated: false, error };
  try {
    const where = await buildWhere(filters);
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: EXPORT_CAP,
      }),
    ]);
    const subjects = await loadSubjects(rows);
    return {
      entries: rows.map((r) => toEntry(r, subjects)),
      total,
      truncated: total > rows.length,
      error: null,
    };
  } catch (err) {
    console.error("exportAuditLogs error:", err);
    return { entries: [], total: 0, truncated: false, error: "Failed to export the audit log" };
  }
}
