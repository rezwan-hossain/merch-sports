// module/profile/components/admin/analytics/GatewayCard.tsx
"use client";

import type { GatewayRow } from "@/types/analytics";
import { Card, SERIES_1, num, taka } from "./charts";

const TRACK = "#eef0f3";

// Success rate colour: green when most attempts succeed, amber when many fail.
function rateClass(rate: number) {
  if (rate >= 0.6) return "bg-green-50 text-green-700";
  if (rate >= 0.4) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

/** Which payment gateway runners paid through (admin → Analytics). */
export function GatewayCard({ rows }: { rows: GatewayRow[] }) {
  const totalPaid = rows.reduce((s, r) => s + r.paidOrders, 0);
  const max = Math.max(1, ...rows.map((r) => r.paidOrders));

  return (
    <Card title="Payment gateways" subtitle="Paid orders by gateway · success = paid ÷ finished attempts">
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-400">No payments yet</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const share = totalPaid > 0 ? row.paidOrders / totalPaid : 0;
            return (
              <div key={row.label}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm font-semibold text-gray-900">{row.label}</span>
                  <span className="flex items-baseline gap-3 text-xs tabular-nums">
                    <span className="font-semibold text-gray-900">
                      {num(row.paidOrders)} paid
                      <span className="ml-1 font-normal text-gray-400">{Math.round(share * 100)}%</span>
                    </span>
                    <span className="text-gray-500">{taka(row.revenue)}</span>
                    {row.successRate !== null ? (
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${rateClass(row.successRate)}`}
                        title={`${num(row.paidOrders)} paid of ${num(row.attempts)} finished attempts`}
                      >
                        {Math.round(row.successRate * 100)}% success
                      </span>
                    ) : row.attempts > 0 ? (
                      // Too few attempts for a meaningful rate yet.
                      <span className="text-gray-400">
                        {num(row.attempts)} attempt{row.attempts === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: TRACK }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(row.paidOrders / max) * 100}%`, background: SERIES_1 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
