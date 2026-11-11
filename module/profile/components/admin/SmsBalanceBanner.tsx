// module/profile/components/admin/SmsBalanceBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { MessageSquareWarning, MessageSquare } from "lucide-react";
import { getSmsBalanceStatus, type SmsBalanceStatus } from "@/app/actions/sms-settings";

const taka = (n: number) =>
  `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * SMS credit warning. Confirmation SMS silently stop when the SMS account runs
 * out of balance (gateway code 1007), so admins see it here first.
 *
 * - default: only shows when something is wrong (low, empty, or can't check)
 * - `alwaysShow`: also shows a small "balance OK" line (SMS settings panel)
 */
export function SmsBalanceBanner({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const [status, setStatus] = useState<SmsBalanceStatus | null>(null);

  useEffect(() => {
    void getSmsBalanceStatus().then(setStatus);
  }, []);

  if (!status) return null;

  // Couldn't read the balance (wrong key, provider down…)
  if (status.error) {
    return (
      <Banner tone="red" title="Can't check the SMS balance" icon={MessageSquareWarning}>
        {status.error}. Confirmation SMS may be failing too — run{" "}
        <code className="rounded bg-white/70 px-1">npm run check:services</code> on the server.
      </Banner>
    );
  }

  const balance = status.balance ?? 0;

  if (balance <= 0) {
    return (
      <Banner tone="red" title="SMS balance is empty — confirmation SMS are not being sent" icon={MessageSquareWarning}>
        Top up your SMS account now. Emails and payments still work; only the SMS fail.
      </Banner>
    );
  }

  if (status.low) {
    return (
      <Banner tone="amber" title={`SMS balance is low: ${taka(balance)} left`} icon={MessageSquareWarning}>
        Top up soon — when it runs out, runners stop getting their confirmation SMS. (Warning
        shows below {taka(status.threshold)}.)
      </Banner>
    );
  }

  if (!alwaysShow) return null;

  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      SMS balance {taka(balance)}
    </p>
  );
}

function Banner({
  tone,
  title,
  icon: Icon,
  children,
}: {
  tone: "red" | "amber";
  title: string;
  icon: typeof MessageSquare;
  children: React.ReactNode;
}) {
  const styles =
    tone === "red"
      ? { box: "border-red-300 bg-red-50", icon: "bg-red-100 text-red-600", title: "text-red-900", text: "text-red-800/90" }
      : { box: "border-amber-300 bg-amber-50", icon: "bg-amber-100 text-amber-700", title: "text-amber-900", text: "text-amber-800/90" };

  return (
    <div role="alert" className={`mb-4 flex gap-3 rounded-xl border p-4 ${styles.box}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${styles.title}`}>{title}</p>
        <p className={`mt-0.5 text-xs leading-relaxed ${styles.text}`}>{children}</p>
      </div>
    </div>
  );
}
