// module/checkout/components/OrderSummary.tsx
"use client";

import { CheckoutItem, AppliedCoupon } from "@/types/checkout";
import { CouponInput } from "./CouponInput";
import Link from "next/link";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { PaymentMethodSelector, paymentMethodName } from "./PaymentMethodSelector";

interface OrderSummaryProps {
  item: CheckoutItem;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  onPlaceOrder: () => void;
  loading: boolean;
  isFormValid: boolean; // Added prop

  // Coupon props
  appliedCoupon: AppliedCoupon | null;
  onApplyCoupon: (coupon: AppliedCoupon, finalPrice: number) => void;
  onRemoveCoupon: () => void;
  finalPrice: number;
  sslcommerzEnabled: boolean;
}

export const OrderSummary = ({
  item,
  paymentMethod,
  onPaymentMethodChange,
  onPlaceOrder,
  loading,
  isFormValid,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  finalPrice,
  sslcommerzEnabled,
}: OrderSummaryProps) => {

  const subtotal = item.price * item.qty;
  const discount = appliedCoupon?.discountAmount || 0;
  const hasDiscount = discount > 0;

  // Policy consent (T&C, Privacy, Refund) — unticked by default; the runner
  // must tick it to pay. SSLCommerz requires a blank box linking all three.
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const isButtonDisabled = loading || !isFormValid || !agreedToPrivacy;

  return (
    <div className="rounded-lg border border-gray-200 p-4 sm:p-6 md:p-8 bg-white">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-center justify-between border-b border-gray-200 pb-3 sm:pb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-wider">
          Order summary
        </h2>
      </div>

      {/* Event Name */}
      <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-100">
        <p className="text-xs sm:text-sm font-semibold text-foreground">
          {item.eventName}
        </p>
      </div>

      {/* Package Line */}
      <div className="mb-4 sm:mb-6 flex items-start justify-between border-b border-gray-200 pb-4 sm:pb-6">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {item.packageName} ({item.distance}) × {item.qty}
        </span>
        <span className="whitespace-nowrap text-xs sm:text-sm font-medium text-foreground">
          ৳{subtotal.toLocaleString()}
        </span>
      </div>

      {/* Coupon Section */}
      <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200">
        <CouponInput
          eventId={item.eventId}
          orderAmount={subtotal}
          appliedCoupon={appliedCoupon}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
          packageId={item.packageId}
        />
      </div>

      {/* Price Breakdown */}
      <div className="space-y-2 sm:space-y-3 pb-4 sm:pb-6 border-b border-gray-200">
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium text-foreground">
            ৳{subtotal.toLocaleString()}
          </span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-green-600 font-medium">Discount</span>
            <span className="text-green-600 font-medium">
              −৳{discount.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex justify-between !mt-3 sm:!mt-4 pt-3 sm:pt-4 border-t border-dashed border-gray-300">
          <span className="text-sm sm:text-base font-bold text-foreground">
            Total
          </span>
          <span className="text-xl sm:text-2xl font-bold text-foreground">
            ৳{finalPrice.toLocaleString()}
          </span>
        </div>

        {hasDiscount && (
          <p className="text-xs text-green-600 text-right mt-1">
            You saved ৳{discount.toLocaleString()} 🎉
          </p>
        )}
      </div>

      {/* Payment Methods */}
      <PaymentMethodSelector
        value={paymentMethod}
        onChange={onPaymentMethodChange}
        sslcommerzEnabled={sslcommerzEnabled}
      />

      {/* Policy consent — T&C, Privacy, Refund (unticked by default, required to pay) */}
      <label className="mb-6 sm:mb-8 flex cursor-pointer items-start gap-2.5 rounded-lg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neon-lime/50 has-[:focus-visible]:ring-offset-2">
        <input
          type="checkbox"
          checked={agreedToPrivacy}
          onChange={(e) => setAgreedToPrivacy(e.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            agreedToPrivacy ? "border-neon-lime bg-neon-lime" : "border-gray-300 bg-white"
          }`}
        >
          {agreedToPrivacy && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          I have read and agree to the{" "}
          {/* New tab: following a link must not lose the filled-in form */}
          <Link href="/terms-and-conditions" target="_blank" rel="noopener" className="underline text-foreground hover:text-primary">
            Terms &amp; Conditions
          </Link>
          ,{" "}
          <Link href="/privacy-policy" target="_blank" rel="noopener" className="underline text-foreground hover:text-primary">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/refund-policy" target="_blank" rel="noopener" className="underline text-foreground hover:text-primary">
            Return &amp; Refund Policy
          </Link>
          .
        </span>
      </label>

      {/* Consent hint when unticked */}
      {!agreedToPrivacy && (
        <p className="mb-3 text-xs text-amber-600 text-center">
          Tick the box above to agree to our policies and continue
        </p>
      )}

      {/* Validation hint when form is invalid */}
      {!isFormValid && (
        <p className="mb-3 text-xs text-amber-600 text-center">
          Please fill in all required fields to continue
        </p>
      )}

      {/* Place Order Button */}
      <button
        onClick={onPlaceOrder}
        disabled={isButtonDisabled}
        className={`h-11 sm:h-12 w-full rounded-full font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
          isButtonDisabled
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-neon-lime text-black hover:opacity-90 shadow-lg shadow-neon-lime/30"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            <span className="text-xs sm:text-base">Processing...</span>
          </>
        ) : paymentMethodName(paymentMethod) ? (
          `Pay ৳${finalPrice.toLocaleString()} with ${paymentMethodName(paymentMethod)}`
        ) : (
          `Place Order – ৳${finalPrice.toLocaleString()}`
        )}
      </button>
    </div>
  );
};
