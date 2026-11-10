// module/profile/components/admin/AdminDashboardPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getAnalytics } from "@/app/actions/analytics";
import { AdminReturningRunnersPanel } from "./AdminReturningRunnersPanel";
import { PaceCard } from "./analytics/PaceCard";
import { TrafficCard } from "./analytics/TrafficCard";
import { GatewayCard } from "./analytics/GatewayCard";
import type { AnalyticsData, AnalyticsRange } from "@/types/analytics";
import { RefreshCw } from "lucide-react";
import {
  BarList,
  Card,
  ColumnChart,
  CouponTable,
  PackageTable,
  SERIES_1,
  StatTile,
  num,
  taka,
} from "./analytics/charts";

type Props = {
  events: { id: string; name: string }[];
};

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[88px] bg-white border border-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-white border border-gray-200 rounded-xl" />
      <div className="h-64 bg-white border border-gray-200 rounded-xl" />
    </div>
  );
}

export function AdminDashboardPanel({ events }: Props) {
  const [eventId, setEventId] = useState<string>("all");
  const [range, setRange] = useState<AnalyticsRange>("30");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State is only set when the request returns; handlers flip `loading` first.
  const load = useCallback(
    (ev: string, r: AnalyticsRange) =>
      getAnalytics(ev, r).then((res) => {
        setData(res.data);
        setError(res.error ?? "");
        setLoading(false);
      }),
    [],
  );

  useEffect(() => {
    void load("all", "30");
  }, [load]);

  const change = (ev: string, r: AnalyticsRange) => {
    setEventId(ev);
    setRange(r);
    setLoading(true);
    void load(ev, r);
  };

  const k = data?.kpis;
  const rangeText =
    range === "all" ? "all time" : `last ${range} days`;

  return (
    <div className="space-y-4">
      {/* Header + filters (one row) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Registrations, revenue and runners · {rangeText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="dash-event" className="sr-only">Event</label>
          <select
            id="dash-event"
            value={eventId}
            onChange={(e) => change(e.target.value, range)}
            className="h-9 max-w-[14rem] px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="all">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => change(eventId, r.value)}
                aria-pressed={range === r.value}
                className={`px-2.5 h-8 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  range === r.value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => change(eventId, range)}
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {!data || !k ? (
        loading ? <DashboardSkeleton /> : null
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="Revenue"
              value={taka(k.revenue)}
              note={`${num(k.paidOrders)} paid order${k.paidOrders === 1 ? "" : "s"} · avg ${taka(k.avgOrderValue)}`}
            />
            <StatTile
              label="Paid runners"
              value={num(k.paidRunners)}
              note={`${num(k.pendingOrders)} unpaid · ${num(k.cancelledOrders)} cancelled`}
            />
            <StatTile
              label="Checkout conversion"
              value={k.conversionRate === null ? "—" : `${Math.round(k.conversionRate * 100)}%`}
              note="Online orders that got paid"
            />
            <StatTile
              label="Discounts given"
              value={taka(k.discounts)}
              note={k.refunded > 0 ? `${taka(k.refunded)} refunded` : "Coupons on paid orders"}
            />
          </div>

          {/* Trends — separate charts, never two scales on one axis */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card
              title="Paid registrations"
              subtitle={`Runners per ${data.bucket} by order date (Dhaka time)`}
            >
              <ColumnChart
                points={data.series.map((p) => ({ date: p.date, value: p.registrations }))}
                format={num}
                unitLabel="paid registrations"
                bucket={data.bucket}
                color={SERIES_1}
              />
            </Card>
            <Card title="Revenue" subtitle={`Paid amount per ${data.bucket} by order date`}>
              <ColumnChart
                points={data.series.map((p) => ({ date: p.date, value: p.revenue }))}
                format={taka}
                unitLabel="revenue"
                bucket={data.bucket}
                color={SERIES_1}
              />
            </Card>
          </div>

          {/* This event vs last event */}
          <PaceCard key={eventId} eventId={eventId} />

          {/* Built-in page-view counter + visit → paid funnel */}
          <TrafficCard eventId={eventId} range={range} />

          {/* Packages */}
          <Card title="Packages" subtitle="All-time capacity, sales and sell-out forecast">
            <PackageTable rows={data.packages} showEvent={eventId === "all"} />
          </Card>

          {/* Runners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="T-shirt sizes" subtitle="Paid runners · for the print order">
              <BarList items={data.breakdowns.tshirt} />
            </Card>
            <Card title="Age groups" subtitle="From date of birth">
              <BarList items={data.breakdowns.ageGroups} />
            </Card>
            <Card title="Gender">
              <BarList items={data.breakdowns.gender} />
            </Card>
            <Card title="Blood group" subtitle="For the medical team">
              <BarList items={data.breakdowns.bloodGroup} />
            </Card>
            <Card title="Top communities" subtitle="Running clubs and groups">
              <BarList items={data.breakdowns.communities} empty="No community names given" />
            </Card>
            <Card title="Age category">
              <BarList items={data.breakdowns.ageCategory} />
            </Card>
          </div>

          {/* Money */}
          <GatewayCard rows={data.gateways} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="How they paid" subtitle="Paid orders · grouped by method">
              <BarList items={data.breakdowns.paymentMethods} empty="No paid orders yet" />
            </Card>
            <Card title="Registration source" subtitle="Paid runners">
              <BarList items={data.breakdowns.source} />
            </Card>
          </div>
          <Card title="Coupons" subtitle="Paid orders that used a coupon">
            <CouponTable rows={data.coupons} />
          </Card>

          {/* Follows the event filter at the top; always all-time. */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <AdminReturningRunnersPanel events={events} eventId={eventId} embedded />
          </section>

          <p className="text-[11px] text-gray-400">
            Updated{" "}
            {new Date(data.generatedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Dhaka",
            })}{" "}
            (Dhaka). Revenue counts PAID payments only; refunded money is excluded.
          </p>
        </div>
      )}
    </div>
  );
}
