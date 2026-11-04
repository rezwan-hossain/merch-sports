// module/checkout/components/CheckoutAlert.tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "gateway" | "registered" | "form" | "generic";

// The server sends plain messages; pick a friendlier presentation from them.
function classify(message: string): Kind {
  const m = message.toLowerCase();
  if (m.includes("already registered")) return "registered";
  if (
    m.includes("gateway unavailable") ||
    m.includes("temporarily unavailable") ||
    m.includes("payment url") ||
    m.includes("couldn't check your")
  )
    return "gateway";
  if (m.includes("required fields")) return "form";
  return "generic";
}

const STYLES: Record<
  Kind,
  { box: string; iconWrap: string; icon: typeof AlertCircle; title: string }
> = {
  gateway: {
    box: "border-amber-200 bg-amber-50",
    iconWrap: "bg-amber-100 text-amber-700",
    icon: CreditCard,
    title: "Online payment is temporarily unavailable",
  },
  registered: {
    box: "border-emerald-200 bg-emerald-50",
    iconWrap: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
    title: "You're already registered",
  },
  form: {
    box: "border-red-200 bg-red-50",
    iconWrap: "bg-red-100 text-red-600",
    icon: AlertCircle,
    title: "Some details need attention",
  },
  generic: {
    box: "border-red-200 bg-red-50",
    iconWrap: "bg-red-100 text-red-600",
    icon: AlertCircle,
    title: "We couldn't complete your order",
  },
};

type Props = {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
  retrying: boolean;
};

export function CheckoutAlert({
  message,
  onRetry,
  onDismiss,
  retrying,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const kind = classify(message);
  const style = STYLES[kind];
  const Icon = style.icon;

  // The pay button sits at the bottom of the page and this alert at the top —
  // bring it into view so the runner actually sees what happened. Form errors
  // already focus the broken field, so leave scrolling to that.
  useEffect(() => {
    if (kind !== "form") {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [message, kind]);

  const body =
    kind === "gateway"
      ? "We couldn't connect to ShurjoPay just now. Your details are saved — please try again in a few minutes."
      : kind === "registered"
        ? "This email already has a confirmed registration for this event. Your confirmation was sent by email, and you can see it in your dashboard."
        : kind === "form"
          ? "Please check the highlighted fields and try again."
          : message;

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      className={cn(
        "relative mb-4 sm:mb-6 flex gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 animate-fade-in",
        style.box,
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full",
          style.iconWrap,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>

      <div className="min-w-0 flex-1 pr-6">
        <p className="text-sm sm:text-base font-semibold text-gray-900">
          {style.title}
        </p>
        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-gray-700">
          {body}
        </p>

        {/* Retry only helps for temporary failures, not e.g. "sold out". */}
        {(kind === "gateway" ||
          (kind === "generic" && /try again/i.test(message))) && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-gray-900 px-4 text-xs sm:text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RotateCw className="h-4 w-4" aria-hidden />
            )}
            {retrying ? "Trying again…" : "Try again"}
          </button>
        )}

        {kind === "registered" && (
          <Link
            href="/dashboard"
            className="mt-3 inline-flex h-9 items-center rounded-full bg-gray-900 px-4 text-xs sm:text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Go to my dashboard
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1 text-gray-500 transition hover:bg-black/5 hover:text-gray-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
