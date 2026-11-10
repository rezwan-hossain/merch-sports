// module/profile/components/admin/GatewayAlertBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { CreditCard, Phone, Wrench } from "lucide-react";
import { getGatewayAlert } from "@/app/actions/payment-issues";
import type { GatewayAlert } from "@/lib/payment-gateway-alert";

const dhaka = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });

// Shown only while online payments are failing to start. Disappears by itself
// once a ShurjoPay session starts successfully again.
export function GatewayAlertBanner() {
  const [alert, setAlert] = useState<GatewayAlert | null>(null);

  useEffect(() => {
    void getGatewayAlert().then(setAlert);
  }, []);

  if (!alert) return null;

  const ContactIcon = alert.contact === "Developer" ? Wrench : Phone;

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4"
    >
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
          <CreditCard className="h-4 w-4 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-900">
            {alert.gateway} payments are failing — runners can&apos;t pay with it
          </p>
          <p className="mt-0.5 text-xs text-red-800/80">
            Last failure {dhaka(alert.at)}
            {alert.spCode !== null && <> · {alert.gateway} code {alert.spCode}</>}
          </p>

          <p className="mt-2 text-sm text-red-900">{alert.meaning}.</p>

          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-white/70 p-3 sm:flex-row sm:items-start">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
              <ContactIcon className="h-3.5 w-3.5" />
              Contact: {alert.contact}
            </span>
            <p className="text-xs leading-relaxed text-gray-700">{alert.fix}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
