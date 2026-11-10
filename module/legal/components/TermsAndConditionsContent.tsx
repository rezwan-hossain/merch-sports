// module/legal/components/TermsAndConditionsContent.tsx
import { LegalDocument, type LegalSection } from "./LegalDocument";
const sections: LegalSection[] = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By purchasing a ticket and participating in our marathon event, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not register or participate in the event.",
  },
  {
    title: "2. Event Registration & Ticket Purchase",
    content: `
      • Registration is complete only after successful payment confirmation.
      • Each ticket is valid for one participant only and is non-transferable unless explicitly permitted by the organizers.
      • You must provide accurate personal information during registration, including your full name, contact details, date of birth, emergency contact, and medical information.
      • False or misleading information may result in disqualification without refund.
    `,
  },
  {
    title: "3. Eligibility Requirements",
    content: `
      • You must be in good physical health and capable of completing the registered distance.
      • We strongly recommend consulting a physician before participating, especially if you have any pre-existing medical conditions.
      • The organizers reserve the right to request medical clearance certificates.
    `,
  },
  {
    title: "4. Payment & Pricing",
    content: `
      • All prices are displayed in Bangladeshi Taka (৳) and include applicable taxes.
      • Payment must be made through our approved payment gateways (ShurjoPay or SSLCommerz — bKash, Nagad, Rocket, cards or internet banking).
      • Tickets are confirmed only after successful payment processing.
      • Price changes may occur without prior notice for future events.
    `,
  },
  {
    title: "5. Refund & Cancellation Policy",
    content: `
      • All ticket purchases are final and non-refundable unless the event is cancelled by the organizers.
      • If the event is cancelled due to circumstances beyond our control (force majeure), participants may receive a partial refund or credit for future events at the organizers' discretion.
      • No refunds will be issued for no-shows or failure to complete the race.
      • Transfer of registration to another participant may be permitted up to 7 days before the event, subject to an administrative fee.
      • Full details, including how to request a refund and the refund timeline, are in our Return & Refund Policy (/refund-policy).
    `,
  },
  {
    title: "6. Event Day Requirements",
    content: `
      • You must collect your race kit (BIB number, timing chip, t-shirt) at the designated location and time announced by the organizers.
      • Valid government-issued photo ID matching your registration details is required for kit collection.
      • Participants must wear the official BIB number visibly on their chest during the race.
      • The timing chip must be worn as instructed; failure to do so may result in no official time being recorded.
    `,
  },
  {
    title: "7. Race Rules & Conduct",
    content: `
      • All participants must follow the designated race route and instructions from race officials and marshals.
      • Use of any motorized vehicles, bicycles, skates, or other wheeled equipment is strictly prohibited.
      • Participants must not accept assistance from non-participants during the race.
      • Unsportsmanlike conduct, including but not limited to cheating, aggressive behavior, or disrespect towards officials, volunteers, or other participants, will result in immediate disqualification.
      • Headphones and earbuds are discouraged for safety reasons but are permitted at the participant's own risk.
    `,
  },
  {
    title: "8. Health & Safety",
    content: `
      • Participants take part in the marathon at their own risk.
      • Medical support will be available along the course and at the finish line.
      • If you feel unwell at any point during the race, you must stop and seek medical assistance immediately.
      • The organizers reserve the right to remove any participant from the race for medical or safety reasons.
      • Participants must disclose any medical conditions during registration.
    `,
  },
  {
    title: "9. Liability Waiver",
    content: `
      • By registering, you acknowledge that participating in a marathon involves inherent risks, including but not limited to physical injury, illness, or in extreme cases, death.
      • You agree to release and hold harmless the organizers, sponsors, volunteers, and affiliated parties from any claims, damages, or liabilities arising from your participation.
      • This waiver extends to personal property loss or damage during the event.
    `,
  },
  {
    title: "10. Media & Photography",
    content: `
      • Official event photographs and videos may be published on our website, social media, and marketing materials.
      • If you do not wish to be photographed, please notify the organizers before the event.
    `,
  },
  {
    title: "11. Personal Data & Privacy",
    content: `
      • Your personal information will be collected, stored, and processed in accordance with our Privacy Policy.
      • We may share your data with timing companies, medical services, and sponsors as necessary for event operations.
      • Your contact information may be used to send event-related communications and future event promotions.
    `,
  },
  {
    title: "12. Event Modifications",
    content: `
      • The organizers reserve the right to modify the event date, time, route, or format due to weather conditions, safety concerns, or other unforeseen circumstances.
      • In case of significant changes, registered participants will be notified via email and/or SMS.
      • No refunds will be issued for event modifications unless the event is completely cancelled.
    `,
  },
  {
    title: "13. Disqualification",
    content: `
      • The organizers reserve the right to disqualify any participant who:
        - Fails to follow the official race route
        - Receives unauthorized assistance
        - Exhibits unsportsmanlike conduct
        - Provides false information during registration
        - Violates any of these Terms and Conditions
      • Disqualified participants will not receive official results or awards.
    `,
  },
  {
    title: "14. Awards & Prizes",
    content: `
      • Awards and prizes will be distributed to winners as announced for each race category.
      • Winners must be present at the award ceremony to claim prizes, unless otherwise arranged with the organizers.
      • Prize decisions made by the organizers are final and binding.
      • Unclaimed prizes may be forfeited after 30 days from the event date.
    `,
  },
  {
    title: "15. T-Shirt & Merchandise",
    content: `
      • T-shirt sizes selected during registration are final and cannot be exchanged.
      • T-shirts and other merchandise included in the registration package must be collected during the designated kit collection period.
      • Uncollected items will not be shipped or held beyond the event day.
    `,
  },
  {
    title: "16. Force Majeure",
    content:
      "The organizers shall not be liable for any failure or delay in performing their obligations due to circumstances beyond their reasonable control, including but not limited to natural disasters, pandemics, government actions, civil unrest, or severe weather conditions.",
  },
  {
    title: "17. Governing Law",
    content:
      "These Terms and Conditions shall be governed by and construed in accordance with the laws of Bangladesh. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Bangladesh.",
  },
  {
    title: "18. Contact Information",
    content: `
      For any questions or concerns regarding these Terms and Conditions, please contact us at:
      
      Email: info@merchcommunication.com
      Phone: +8801862221943
      Address: House-32,Road-08,Block-H,Mirpur-2
    `,
  },
];

export default function TermsAndConditionsContent() {
  return (
    <LegalDocument
      policy="terms"
      heroTitle="Terms & Conditions"
      title="Terms and Conditions"
      lastUpdated="November 10, 2026"
      summary={
        <>
          <strong>Important:</strong> Please read these Terms and Conditions carefully before
          purchasing your marathon ticket. By completing your registration and payment, you
          acknowledge that you have read, understood, and agree to be bound by these terms.
        </>
      }
      sections={sections}
      closing={
        <>
          <strong>Agreement:</strong> By ticking the agreement checkbox during checkout, you
          confirm that you have read, understood, and accept these Terms and Conditions, our
          Privacy Policy and our Return &amp; Refund Policy. You also acknowledge that you are
          voluntarily participating in the marathon event at your own risk.
        </>
      }
    />
  );
}
