// module/checkout/components/OrderSummary.tsx
"use client";

import { CheckoutItem, AppliedCoupon } from "@/types/checkout";
import { CouponInput } from "./CouponInput";
import Link from "next/link";
import { Loader2, Check, CreditCard } from "lucide-react";

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

type PaymentMethodOption = {
  id: string;
  label: string;
  /** Logo in /public; a card icon is shown when there isn't one. */
  image: string | null;
  description: string;
};

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "shurjopay",
    label: "SurjoPay",
    image: "/icons/shurjopay.png",
    description:
      "Pay securely via ShurjoPay. Supports bKash, Nagad, Rocket, Visa, Mastercard, and more. You will be redirected to complete your payment.",
  },
  {
    id: "sslcommerz",
    label: "SSLCommerz",
    image: "/icons/sslcommerz.png",
    description:
      "Pay securely via SSLCommerz. Supports bKash, Nagad, Rocket, Visa, Mastercard, AMEX, and internet banking. You will be redirected to complete your payment.",
  },
];

const GATEWAY_LABEL: Record<string, string> = {
  shurjopay: "ShurjoPay",
  sslcommerz: "SSLCommerz",
};

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
  const availableMethods = paymentMethods.filter(
    (m) => m.id !== "sslcommerz" || sslcommerzEnabled,
  );
  const subtotal = item.price * item.qty;
  const discount = appliedCoupon?.discountAmount || 0;
  const hasDiscount = discount > 0;

  const isButtonDisabled = loading || !isFormValid;

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
      <div className="mb-6 sm:mb-8">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3 mt-2 sm:mt-3">
          Payment Method
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {availableMethods.map((method) => {
            const isSelected = paymentMethod === method.id;

            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onPaymentMethodChange(method.id)}
                className={`w-full text-left rounded-lg sm:rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-neon-lime bg-neon-lime/5 shadow-sm shadow-neon-lime/20"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {/* Main row: radio indicator + image + label */}
                <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3.5">
                  {/* Custom radio indicator */}
                  <div
                    className={`flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                      isSelected
                        ? "border-neon-lime bg-neon-lime"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {isSelected && (
                      <Check
                        className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-black"
                        strokeWidth={3}
                      />
                    )}
                  </div>

                  {/* Payment logo */}
                  <div className="flex h-8 w-12 sm:h-10 sm:w-14 shrink-0 items-center justify-center rounded-md bg-gray-50 p-1">
                    {method.image ? (
                      <img
                        src={method.image}
                        alt={method.label}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <CreditCard className="h-5 w-5 text-gray-500" aria-hidden />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-xs sm:text-sm font-medium ${
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {method.label}
                  </span>
                </div>

                {/* Expandable description */}
                {isSelected && method.description && (
                  <div className="px-2.5 sm:px-3.5 pb-2.5 sm:pb-3.5 pt-0">
                    <div className="rounded-lg bg-gray-100 px-3 sm:px-4 py-2 sm:py-3 text-xs leading-relaxed text-gray-500">
                      {method.description}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Privacy Notice */}
      <p className="mb-6 sm:mb-8 text-xs leading-relaxed text-muted-foreground">
        Your personal data will be used to process your order. By clicking below
        you agree to our{" "}
        <Link
          href="/privacy-policy"
          className="underline text-foreground hover:text-primary"
        >
          privacy policy
        </Link>
        .
      </p>

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
        ) : GATEWAY_LABEL[paymentMethod] ? (
          `Pay ৳${finalPrice.toLocaleString()} with ${GATEWAY_LABEL[paymentMethod]}`
        ) : (
          `Place Order – ৳${finalPrice.toLocaleString()}`
        )}
      </button>
    </div>
  );
};
