// module/payment/components/RetryPaymentClient.tsx
"use client";

import { useState } from "react";
import { initiateShurjoPayPayment } from "@/app/actions/payment";
import { initiateSslCommerzPayment } from "@/app/actions/payment-sslcommerz";

type RetryPaymentClientProps = {
  orderId: string;
  eventName: string;
  packageName: string;
  distance: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  gateway: "shurjopay" | "sslcommerz";
};

const RetryPaymentClient = ({
  orderId,
  eventName,
  packageName,
  distance,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  gateway,
}: RetryPaymentClientProps) => {
  const gatewayName = gateway === "sslcommerz" ? "SSLCommerz" : "ShurjoPay";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRetry = async () => {
    setError("");
    setLoading(true);

    const safeArgs = JSON.parse(
      JSON.stringify({
        orderId,
        customerName,
        customerEmail,
        customerPhone,
      }),
    );

    const result =
      gateway === "sslcommerz"
        ? await initiateSslCommerzPayment(safeArgs)
        : await initiateShurjoPayPayment(safeArgs);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="mt-32 max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Retry Payment
        </h1>

        <div className="space-y-3 bg-gray-50 rounded-lg p-5 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Event</span>
            <span className="font-medium text-gray-900">{eventName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Package</span>
            <span className="font-medium text-gray-900">
              {packageName} ({distance})
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
            <span className="font-bold text-gray-900">Amount</span>
            <span className="font-bold text-gray-900">৳{amount}</span>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleRetry}
          disabled={loading}
          className="w-full py-3 bg-neutral-900 text-white rounded-full font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? `Redirecting to ${gatewayName}...`
            : `Pay ৳${amount} with ${gatewayName}`}
        </button>
      </div>
    </div>
  );
};

export default RetryPaymentClient;
