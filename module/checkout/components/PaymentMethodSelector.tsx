// module/checkout/components/PaymentMethodSelector.tsx
"use client";

import { Check, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethod = {
  id: "shurjopay" | "sslcommerz";
  name: string;
  logo: string;
  /** One short line under the name — what sets this gateway apart. */
  tagline: string;
  /** What the runner can pay with on that gateway's page. */
  supports: string[];
};

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "shurjopay",
    name: "ShurjoPay",
    logo: "/icons/shurjopay.png",
    tagline: "Mobile banking & cards",
    supports: ["bKash", "Nagad", "Rocket", "Visa", "Mastercard"],
  },
  {
    id: "sslcommerz",
    name: "SSLCommerz",
    logo: "/icons/sslcommerz.png",
    tagline: "Mobile banking, cards & net banking",
    supports: [
      "bKash",
      "Nagad",
      "Rocket",
      "Visa",
      "Mastercard",
      "AMEX",
      "Net banking",
    ],
  },
];

/** "ShurjoPay" / "SSLCommerz" — for the pay button text. */
export function paymentMethodName(id: string): string | null {
  return PAYMENT_METHODS.find((m) => m.id === id)?.name ?? null;
}

type Props = {
  value: string;
  onChange: (id: string) => void;
  /** SSLCommerz is only offered when the server has it switched on. */
  sslcommerzEnabled: boolean;
};

export function PaymentMethodSelector({
  value,
  onChange,
  sslcommerzEnabled,
}: Props) {
  const methods = PAYMENT_METHODS.filter(
    (m) => m.id !== "sslcommerz" || sslcommerzEnabled,
  );

  return (
    <fieldset className="mb-6 min-w-0 sm:mb-8 mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <legend className="text-sm font-semibold text-foreground">
          Payment method
        </legend>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
          <Lock className="h-3 w-3" aria-hidden />
          Secure
        </span>
      </div>

      <div className="space-y-2.5">
        {methods.map((method) => {
          const isSelected = method.id === value;
          return (
            <label
              key={method.id}
              className={cn(
                "block cursor-pointer overflow-hidden rounded-xl border bg-white transition-all duration-200",
                "active:scale-[0.995] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neon-lime/50 has-[:focus-visible]:ring-offset-2",
                isSelected
                  ? "border-neon-lime shadow-[0_0_0_1px_var(--color-neon-lime)]"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
              )}
            >
              {/* Real radio: arrow keys + screen readers work; the circle below is the visual */}
              <input
                type="radio"
                name="payment-method"
                value={method.id}
                checked={isSelected}
                onChange={() => onChange(method.id)}
                className="sr-only"
              />

              {/* ── Row: radio · logo · name ───────────────────────── */}
              <div className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                    isSelected
                      ? "border-neon-lime bg-neon-lime"
                      : "border-gray-300",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3 w-3 text-black transition-transform duration-200",
                      isSelected ? "scale-100" : "scale-0",
                    )}
                    strokeWidth={3}
                  />
                </span>

                <span className="flex h-9 w-16 sm:w-[84px] shrink-0 items-center justify-center rounded-lg bg-gray-50 px-2 ring-1 ring-gray-100">
                  <img
                    src={method.logo}
                    alt=""
                    className="max-h-5 w-full object-contain"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight text-foreground">
                    {method.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                    {method.tagline}
                  </span>
                </span>
              </div>

              {/* ── Details: open only for the selected method ─────── */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  isSelected
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <div className="mx-3 mb-3 border-t border-gray-100 pt-3 sm:mx-3.5 sm:mb-3.5">
                    <ul
                      className="flex flex-wrap gap-1.5"
                      aria-label={`${method.name} accepts`}
                    >
                      {method.supports.map((s) => (
                        <li
                          key={s}
                          className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-gray-500">
                      <ShieldCheck
                        className="mt-px h-3.5 w-3.5 shrink-0 text-green-600"
                        aria-hidden
                      />
                      You&apos;ll pay on {method.name}&apos;s secure page, then
                      come right back here — please keep this tab open.
                    </p>
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
