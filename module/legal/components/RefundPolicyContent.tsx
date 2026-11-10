// module/legal/components/RefundPolicyContent.tsx
//
// Return & Refund Policy. Written to match:
//  - our Terms & Conditions (section 5 "Refund & Cancellation Policy") — keep them in sync;
//  - SSLCommerz's merchant website rules: a standard refund timeline
//    (7–10 working days), delivery time, and the business's registered
//    address + trade license number.
import Link from "next/link";
import { LegalDocument, type LegalSection } from "./LegalDocument";

const LAST_UPDATED = "November 10, 2026";
const REFUND_TIMELINE = "7–10 working days";

const sections: LegalSection[] = [
  {
    title: "1. About this policy",
    intro: `This policy explains when you can get a refund for a race registration bought on our website, how to ask for one, and how long it takes. It applies to every payment made online through our payment partners (ShurjoPay and SSLCommerz) — bKash, Nagad, Rocket, cards and internet banking.`,
  },
  {
    title: "2. When you will get a refund",
    points: [
      "The event is cancelled by the organizers — you get a refund of the registration fee you paid.",
      "The event is cancelled for reasons beyond our control (natural disaster, government order, public-safety emergency or similar) — you get a partial refund or a credit for a future event, at the organizers' discretion.",
      "You were charged twice for the same registration — the extra payment is refunded in full.",
      "Your payment went through but your registration could not be confirmed (for example, the package sold out while your payment was processing) — the full amount is refunded.",
      "You were charged more than the price shown at checkout — the difference is refunded.",
    ],
  },
  {
    title: "3. When we cannot give a refund",
    intro: "Registrations are final once confirmed. We cannot refund:",
    points: [
      "A change of mind, or if you can no longer attend.",
      "Not showing up on race day, or not finishing the race.",
      "Changes to the event date, time, route or format (you will be notified by email and/or SMS). Only a complete cancellation is refunded.",
      "Disqualification, including registering with false or misleading information.",
      "Race-kit items such as the T-shirt size you chose, or items not collected during the kit-collection period.",
    ],
  },
  {
    title: "4. Transfer instead of refund",
    intro:
      "If you can't attend, you may be able to transfer your registration to another runner up to 7 days before the event, subject to an administrative fee. Contact us to arrange a transfer.",
  },
  {
    title: "5. How to request a refund",
    intro: "Email or call us with:",
    points: [
      "Your order ID (in your confirmation email/SMS and your dashboard)",
      "The full name and phone number used for registration",
      "The payment method and transaction ID (from your bKash/Nagad/bank message or card statement)",
      "The reason for the refund",
    ],
    outro:
      "If an event is cancelled by the organizers, you don't need to apply — we will contact every registered runner by email and/or SMS.",
  },
  {
    title: "6. Refund timeline",
    points: [
      `Approved refunds are processed within ${REFUND_TIMELINE} from the date the refund is approved.`,
      "The money goes back to the same account you paid with (the same bKash/Nagad/Rocket number, card or bank account). We do not refund in cash.",
      "After we send it, your bank or mobile wallet may take a few extra days to show it in your account.",
      "We will tell you by email or SMS when your refund has been sent.",
    ],
  },
  {
    title: "7. Delivery of your registration",
    points: [
      "Registration is a service, not a shipped product. Your confirmation is sent by email and SMS right after your payment succeeds — usually within a few minutes.",
      "Your registration also appears in your dashboard on this website.",
      "Race kits (BIB and T-shirt) are collected in person at the kit-collection venue and dates announced for each event. Kits are not delivered by courier.",
    ],
  },
];

export default function RefundPolicyContent() {
  return (
    <LegalDocument
      policy="refund"
      heroTitle="Refund Policy"
      title="Return & Refund Policy"
      lastUpdated={LAST_UPDATED}
      summary={
        <>
          <strong>In short:</strong> registrations are non-refundable once confirmed, except when
          the event is cancelled or there is a payment error on our side. Approved refunds are
          returned to your original payment method within <strong>{REFUND_TIMELINE}</strong>.
        </>
      }
      sections={sections}
      closing={
        <>
          This policy is part of our{" "}
          <Link href="/terms-and-conditions" className="font-medium text-gray-900 underline underline-offset-2">
            Terms &amp; Conditions
          </Link>
          . See also our{" "}
          <Link href="/privacy-policy" className="font-medium text-gray-900 underline underline-offset-2">
            Privacy Policy
          </Link>
          . Our contact details, registered address and trade license number are below.
        </>
      }
    />
  );
}
