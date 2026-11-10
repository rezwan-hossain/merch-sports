// app/actions/analytics.ts
"use server";

// Admin dashboard analytics. Read-only. Everything is computed from existing
// order / payment / registration data — no tracking tables needed.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { BLOOD_GROUPS } from "@/lib/registration-options";
import { tshirtSizes } from "@/module/checkout/data/tshirtSizes";
import type {
  AnalyticsData,
  AnalyticsRange,
  CountItem,
  CouponRow,
  DailyPoint,
  GatewayRow,
  PackageRow,
} from "@/types/analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Payment gateways & methods (for the "Payments" cards) ──
// Not exported: every export of a "use server" file is a public endpoint.

const GATEWAY_LABELS: Record<string, string> = {
  shurjopay: "ShurjoPay",
  sslcommerz: "SSLCommerz",
};
const gatewayLabel = (gateway: string | null | undefined) =>
  (gateway && GATEWAY_LABELS[gateway]) || "Unknown";

/** Display order for the grouped methods (anything else sorts after). */
const METHOD_GROUPS = ["bKash", "Nagad", "Rocket", "Card", "Net banking", "Other wallet", "Manual (admin)", "Not recorded"];

/**
 * Group a gateway's raw method name. ShurjoPay sends e.g. "bKash",
 * "South East Visa", "IBBL iBanking"; SSLCommerz sends e.g. "BKASH-BKash",
 * "VISA-Dutch Bangla", "DBBLMOBILEB-Dbbl Mobile Banking" (= Rocket).
 */
function paymentMethodGroup(raw: string | null | undefined): string {
  const m = (raw ?? "").toLowerCase();
  if (!m || m === "shurjopay" || m === "sslcommerz") return "Not recorded";
  if (m.includes("bkash")) return "bKash";
  if (m.includes("nagad")) return "Nagad";
  if (m.includes("rocket") || m.includes("dbblmobile")) return "Rocket";
  if (/visa|master|amex|american express|unionpay|diners|card/.test(m)) return "Card";
  // SSLCommerz names internet banking "<BANK>IB-…" (CITYTOUCHIB-, IBBLIB-…)
  if (/ibank|i-bank|internet bank|net bank|^[a-z]+ib-/.test(m)) return "Net banking";
  return "Other wallet"; // NexusPay, OK Wallet, Pathao Pay, TAP, upay…
}
const HOLD_GRACE_MS = 60 * 60 * 1000; // unpaid orders younger than this are still in checkout
const ORDER_CAP = 50_000;

// YYYY-MM-DD for an instant, in Bangladesh time.
const dhakaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayKey = (d: Date) => dhakaDay.format(d);
const addDays = (key: string, n: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
// Monday of the week containing `key`.
const weekKey = (key: string) => {
  const dow = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(key, -dow);
};

function tally(
  values: (string | null | undefined)[],
  order?: readonly string[],
): CountItem[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const label = v?.trim() || "Not given";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const items = [...counts].map(([label, value]) => ({ label, value }));
  if (order) {
    const rank = (l: string) => {
      const i = order.indexOf(l);
      return i === -1 ? order.length : i;
    };
    return items.sort((a, b) => rank(a.label) - rank(b.label) || b.value - a.value);
  }
  return items.sort((a, b) => b.value - a.value);
}

export async function getAnalytics(
  eventId: string | "all",
  range: AnalyticsRange,
): Promise<{ data: AnalyticsData | null; error: string | null }> {
  const { error } = await requireAdmin();
  if (error) return { data: null, error };

  try {
    const now = new Date();
    const since =
      range === "all" ? null : new Date(now.getTime() - Number(range) * DAY_MS);
    const eventWhere = eventId === "all" ? {} : { eventId };

    const [orders, packages, recentSales, packageTotals] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...eventWhere,
          isArchived: false,
          ...(since && { createdAt: { gte: since } }),
        },
        take: ORDER_CAP,
        select: {
          status: true,
          source: true,
          qty: true,
          total: true,
          discount: true,
          createdAt: true,
          couponId: true,
          payment: {
            select: { status: true, amount: true, paymentMethod: true, paymentGateway: true },
          },
          registration: {
            select: {
              gender: true,
              tshirtSize: true,
              ageCategory: true,
              bloodGroup: true,
              communityName: true,
              birthDate: true,
            },
          },
        },
      }),
      prisma.package.findMany({
        where: {
          ...eventWhere,
          ...(eventId === "all" && { event: { isArchived: false } }),
        },
        select: {
          id: true,
          name: true,
          distance: true,
          price: true,
          availableSlots: true,
          usedSlots: true,
          event: { select: { name: true } },
        },
        orderBy: [{ eventId: "asc" }, { price: "asc" }],
      }),
      // Pace for the sell-out forecast: confirmed qty per package, last 7 days.
      prisma.order.groupBy({
        by: ["packageId"],
        where: {
          ...eventWhere,
          isArchived: false,
          status: "CONFIRMED",
          createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
        },
        _sum: { qty: true },
      }),
      // Package table is all-time (capacity doesn't care about the range).
      prisma.order.groupBy({
        by: ["packageId", "status"],
        where: { ...eventWhere, isArchived: false },
        _sum: { qty: true, total: true },
      }),
    ]);

    // ─── KPIs ───────────────────────────────────────
    const confirmed = orders.filter((o) => o.status === "CONFIRMED");
    const paid = orders.filter((o) => o.payment?.status === "PAID");
    const revenue = paid.reduce((s, o) => s + (o.payment?.amount ?? 0), 0);

    // Conversion: of online checkouts that have finished (paid, cancelled, or
    // unpaid past the 1-hour hold), how many were paid.
    const online = orders.filter((o) => o.source === "ONLINE");
    const settled = online.filter(
      (o) =>
        o.status !== "PENDING" ||
        now.getTime() - o.createdAt.getTime() > HOLD_GRACE_MS,
    );
    const onlinePaid = settled.filter((o) => o.status === "CONFIRMED").length;

    const kpis: AnalyticsData["kpis"] = {
      revenue,
      paidRunners: confirmed.reduce((s, o) => s + o.qty, 0),
      paidOrders: paid.length,
      avgOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
      conversionRate: settled.length ? onlinePaid / settled.length : null,
      discounts: Math.round(confirmed.reduce((s, o) => s + o.discount, 0)),
      pendingOrders: orders.filter((o) => o.status === "PENDING").length,
      refunded: orders
        .filter((o) => o.payment?.status === "REFUNDED")
        .reduce((s, o) => s + (o.payment?.amount ?? 0), 0),
      cancelledOrders: orders.filter((o) => o.status === "CANCELLED").length,
    };

    // ─── Time series (by order date, Dhaka time) ────
    const firstKey = orders.length
      ? dayKey(
          new Date(
            orders.reduce(
              (min, o) => Math.min(min, o.createdAt.getTime()),
              Infinity,
            ),
          ),
        )
      : dayKey(now);
    const startKey = since ? dayKey(since) : firstKey;
    const todayKey = dayKey(now);
    const spanDays =
      (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) /
        DAY_MS +
      1;
    const bucket: AnalyticsData["bucket"] = spanDays > 92 ? "week" : "day";
    const toBucket = (key: string) => (bucket === "week" ? weekKey(key) : key);

    const points = new Map<string, DailyPoint>();
    for (
      let k = toBucket(startKey);
      k <= todayKey;
      k = addDays(k, bucket === "week" ? 7 : 1)
    ) {
      points.set(k, { date: k, registrations: 0, revenue: 0 });
    }
    for (const o of orders) {
      const p = points.get(toBucket(dayKey(o.createdAt)));
      if (!p) continue;
      if (o.status === "CONFIRMED") p.registrations += o.qty;
      if (o.payment?.status === "PAID") p.revenue += o.payment.amount;
    }
    const series = [...points.values()];

    // ─── Packages ───────────────────────────────────
    const pace = new Map(recentSales.map((r) => [r.packageId, (r._sum.qty ?? 0) / 7]));
    const totals = new Map<number, { sold: number; held: number; revenue: number }>();
    for (const r of packageTotals) {
      const t = totals.get(r.packageId) ?? { sold: 0, held: 0, revenue: 0 };
      if (r.status === "CONFIRMED") {
        t.sold += r._sum.qty ?? 0;
        t.revenue += r._sum.total ?? 0;
      }
      if (r.status === "PENDING") t.held += r._sum.qty ?? 0;
      totals.set(r.packageId, t);
    }
    const packageRows: PackageRow[] = packages.map((p) => {
      const t = totals.get(p.id) ?? { sold: 0, held: 0, revenue: 0 };
      const left = Math.max(0, p.availableSlots - p.usedSlots);
      const rate = pace.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        distance: p.distance,
        eventName: p.event.name,
        price: p.price,
        capacity: p.availableSlots,
        sold: t.sold,
        held: t.held,
        left,
        revenue: Math.round(t.revenue),
        daysToSellOut: rate > 0 && left > 0 ? Math.ceil(left / rate) : null,
      };
    });

    // ─── Coupons ────────────────────────────────────
    const couponIds = [...new Set(confirmed.map((o) => o.couponId).filter(Boolean))] as string[];
    const couponCodes = new Map(
      (
        await prisma.coupon.findMany({
          where: { id: { in: couponIds } },
          select: { id: true, code: true },
        })
      ).map((c) => [c.id, c.code]),
    );
    const couponMap = new Map<string, CouponRow>();
    for (const o of confirmed) {
      if (!o.couponId) continue;
      const code = couponCodes.get(o.couponId) ?? "Deleted coupon";
      const row = couponMap.get(code) ?? { code, uses: 0, discount: 0, revenue: 0 };
      row.uses += 1;
      row.discount += Math.round(o.discount);
      row.revenue += Math.round(o.total);
      couponMap.set(code, row);
    }
    const coupons = [...couponMap.values()].sort((a, b) => b.uses - a.uses);

    // ─── Runner breakdowns (confirmed only) ─────────
    const regs = confirmed.map((o) => o.registration).filter(Boolean) as NonNullable<
      (typeof confirmed)[number]["registration"]
    >[];

    // Community: group case/spacing variants, show the most common spelling.
    const communityGroups = new Map<string, Map<string, number>>();
    for (const r of regs) {
      const raw = r.communityName?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase().replace(/\s+/g, " ");
      const spellings = communityGroups.get(key) ?? new Map<string, number>();
      spellings.set(raw, (spellings.get(raw) ?? 0) + 1);
      communityGroups.set(key, spellings);
    }
    const communities = [...communityGroups.values()]
      .map((spellings) => {
        const [label] = [...spellings].sort((a, b) => b[1] - a[1])[0];
        const value = [...spellings.values()].reduce((s, n) => s + n, 0);
        return { label, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const AGE_BANDS = ["Under 18", "18–29", "30–39", "40–49", "50–59", "60+"];
    const ageBand = (birth: Date) => {
      const age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * DAY_MS));
      if (age < 18) return AGE_BANDS[0];
      if (age < 30) return AGE_BANDS[1];
      if (age < 40) return AGE_BANDS[2];
      if (age < 50) return AGE_BANDS[3];
      if (age < 60) return AGE_BANDS[4];
      return AGE_BANDS[5];
    };

    // How runners paid, grouped (gateways report methods in different formats:
    // "South East Visa", "BKASH-BKash", "IBBL iBanking"…).
    const methodCounts = tally(
      paid.map((o) => (o.source === "MANUAL" ? "Manual (admin)" : paymentMethodGroup(o.payment?.paymentMethod))),
      METHOD_GROUPS,
    );

    // Which gateway they paid through, and how often attempts there succeed.
    const gatewayRows = new Map<string, GatewayRow>();
    const rowFor = (label: string) => {
      let row = gatewayRows.get(label);
      if (!row) {
        row = { label, paidOrders: 0, revenue: 0, attempts: 0, successRate: null };
        gatewayRows.set(label, row);
      }
      return row;
    };
    for (const o of orders) {
      const p = o.payment;
      if (!p) continue;
      const label = o.source === "MANUAL" ? "Manual (admin)" : gatewayLabel(p.paymentGateway);
      if (p.status === "PAID") {
        const row = rowFor(label);
        row.paidOrders += 1;
        row.revenue += p.amount;
      }
      // Online attempts that reached a gateway and ended (paid or failed).
      if (o.source === "ONLINE" && p.paymentGateway && (p.status === "PAID" || p.status === "FAILED")) {
        rowFor(label).attempts += 1;
      }
    }
    // A success rate from a handful of attempts is noise — show it from 10 on.
    const MIN_ATTEMPTS_FOR_RATE = 10;
    const gateways: GatewayRow[] = [...gatewayRows.values()]
      .filter((r) => r.paidOrders > 0 || r.attempts > 0)
      .map((r) => ({
        ...r,
        successRate:
          r.label === "Manual (admin)" || r.attempts < MIN_ATTEMPTS_FOR_RATE
            ? null
            : r.paidOrders / r.attempts,
      }))
      .sort((a, b) => b.paidOrders - a.paidOrders);

    return {
      data: {
        generatedAt: now.toISOString(),
        bucket,
        kpis,
        series,
        packages: packageRows,
        coupons,
        gateways,
        breakdowns: {
          tshirt: tally(
            regs.map((r) => r.tshirtSize),
            tshirtSizes.map((s) => s.value),
          ),
          gender: tally(regs.map((r) => r.gender)),
          ageCategory: tally(regs.map((r) => r.ageCategory)),
          ageGroups: tally(regs.map((r) => ageBand(r.birthDate)), AGE_BANDS),
          bloodGroup: tally(regs.map((r) => r.bloodGroup), BLOOD_GROUPS),
          communities,
          paymentMethods: methodCounts,
          source: tally(
            confirmed.map((o) => (o.source === "MANUAL" ? "Manual (admin)" : "Online")),
          ),
        },
      },
      error: null,
    };
  } catch (err) {
    console.error("getAnalytics error:", err);
    return { data: null, error: "Failed to load analytics" };
  }
}
