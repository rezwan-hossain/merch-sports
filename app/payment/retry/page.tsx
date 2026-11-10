// app/payment/retry/page.tsx
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import RetryPaymentClient from "@/module/payment/components/RetryPaymentClient";
import { redirect } from "next/navigation";
import { SSLCOMMERZ, isSslCommerzEnabled } from "@/lib/payment/sslcommerz/config";

type SearchParams = Promise<{ orderId?: string }>;

export default async function RetryPaymentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const orderId = params.orderId;

  if (!orderId) redirect("/events");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      package: true,
      registration: true,
      payment: true,
    },
  });

  if (!order || !order.registration) redirect("/events");

  // Already paid
  if (order.payment?.status === "PAID") {
    // Paid but the order lost its slot (expired hold / admin cancel) → refund
    // case, not a success.
    if (order.status !== "CONFIRMED") {
      redirect(`/payment/failed?orderId=${orderId}&reason=paid_no_slot`);
    }
    redirect(`/payment/success?orderId=${orderId}`);
  }

  // Reset failed payment for retry
  // (A released/CANCELLED order keeps FAILED here — reclaimReleasedOrder
  // flips it back to PENDING only if it actually gets its slot back.)
  // The previous ShurjoPay session id (paymentId) is kept on purpose:
  // initiateShurjoPayPayment checks it with ShurjoPay first, so a runner whose
  // earlier payment went through (callback lost) is confirmed, not charged twice.
  if (order.payment?.status === "FAILED" && order.status === "PENDING") {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { status: "PENDING" },
    });
  }

  // Build plain props
  const props = JSON.parse(
    JSON.stringify({
      orderId: order.id,
      eventName: order.event.name,
      packageName: order.package.name,
      distance: order.package.distance,
      amount: order.payment?.amount ?? Number(order.package.price),
      customerName: order.registration.fullName,
      customerEmail: user.email ?? "",
      customerPhone: order.registration.phone,
      // Retry on the gateway the runner chose, while it's still switched on.
      gateway:
        order.payment?.paymentGateway === SSLCOMMERZ && isSslCommerzEnabled()
          ? SSLCOMMERZ
          : "shurjopay",
    }),
  );

  return <RetryPaymentClient {...props} />;
}
