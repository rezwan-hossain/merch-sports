// app/checkout/page.tsx
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import CheckoutPage from "@/module/checkout/pages/CheckoutPage";
import { redirect } from "next/navigation";
import { getCheckoutData } from "../actions/checkout";
import { InitiateCheckoutTracker } from "@/components/tracking/InitiateCheckoutTracker";
import { isSslCommerzEnabled } from "@/lib/payment/sslcommerz/config";

type SearchParams = Promise<{
  package?: string;
  event?: string;
  qty?: string;
}>;

async function CheckoutContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // if (!user) redirect("/login");

  const params = await searchParams;
  const packageId = params.package ? Number(params.package) : null;
  const quantity = params.qty ? Number(params.qty) : 1;

  if (!packageId) redirect("/events");

  const { package: pkg, error } = await getCheckoutData(packageId);

  if (!pkg || error) redirect("/events");

  const safePkg = JSON.parse(JSON.stringify(pkg));

  const checkoutItem = {
    packageId: safePkg.id,
    eventId: safePkg.event.id,
    eventName: safePkg.event.name,
    packageName: safePkg.name,
    distance: safePkg.distance,
    price: Number(safePkg.price),
    qty: quantity,
  };

  return (
    <>
      {/* ✅ Fires InitiateCheckout tracker on page load */}
      <InitiateCheckoutTracker
        product={{
          id: String(pkg.id),
          name: pkg.event.name,
          price: Number(pkg.price),
          packageName: pkg.name,
          distance: pkg.distance,
        }}
      />
      <CheckoutPage
        item={checkoutItem}
        userEmail={user?.email ?? ""}
        userName={user?.user_metadata?.full_name ?? ""}
        eventType={pkg.event.eventType}
        sslcommerzEnabled={isSslCommerzEnabled()}
      />
    </>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      }
    >
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}
