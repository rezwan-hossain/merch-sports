// module/checkout/components/CouponInput.tsx
"use client";

import { useState } from "react";
import { validateCoupon } from "@/app/actions/coupon";
import { AppliedCoupon } from "@/types/checkout";
import { Loader2, Tag, X, Check } from "lucide-react";

type CouponInputProps = {
  eventId: string;
  packageId: number;
  orderAmount: number;
  appliedCoupon: AppliedCoupon | null;
  onApply: (coupon: AppliedCoupon, finalPrice: number) => void;
  onRemove: () => void;
};

export function CouponInput({
  eventId,
  orderAmount,
  appliedCoupon,
  packageId,
  onApply,
  onRemove,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleApply = async () => {
    if (!code.trim()) {
      setError("Please enter a coupon code");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await validateCoupon(
        code,
        eventId,
        packageId,
        orderAmount,
      );

      if (!result.valid || !result.coupon) {
        setError(result.error || "Invalid coupon");
        setLoading(false);
        return;
      }

      onApply(
        {
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue,
          discountAmount: result.discountAmount!,
        },
        result.finalPrice!,
      );

      setSuccess(`Coupon applied! You save ৳${result.discountAmount}`);
      setCode("");
    } catch {
      setError("Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onRemove();
    setSuccess("");
    setError("");
  };

  // ── Applied state ──
  if (appliedCoupon) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-3 sm:p-4">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Tag className="h-4 w-4 text-green-600 shrink-0" />
            <span className="font-medium text-green-800 text-sm sm:text-base">
              {appliedCoupon.code}
            </span>
            <span className="text-xs sm:text-sm text-green-600">
              {appliedCoupon.discountType === "PERCENTAGE"
                ? `${appliedCoupon.discountValue}% off`
                : `৳${appliedCoupon.discountValue} off`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove coupon"
            className="text-green-600 hover:text-green-800 p-1 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs sm:text-sm text-green-600 mt-1">
          You save ৳{appliedCoupon.discountAmount}
        </p>
      </div>
    );
  }

  // ── Input state ──
  return (
    <div className="space-y-2">
      <label htmlFor="coupon-code" className="text-sm font-medium text-gray-700">
        Have a coupon code?{" "}
        <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="coupon-code"
          type="text"
          enterKeyHint="done"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
          placeholder="Enter coupon code"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neutral-900 focus:border-transparent uppercase text-sm sm:text-base w-full"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Still composing a word (Bangla / phone keyboards) — not a submit.
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            // Empty box: do nothing. On phones the keyboard's Next/↵ lands
            // here after the last form field; an error then made the coupon
            // look required. Same rule as the disabled Apply button.
            if (code.trim()) handleApply();
          }}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && <p className="text-xs sm:text-sm text-red-600">{error}</p>}
      {/* Typed but not applied — otherwise it's silently ignored at payment */}
      {code.trim() && !error && !loading && (
        <p className="text-xs text-gray-500">Tap Apply to use this code.</p>
      )}
      {success && (
        <p className="text-xs sm:text-sm text-green-600 flex items-center gap-1">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </p>
      )}
    </div>
  );
}
