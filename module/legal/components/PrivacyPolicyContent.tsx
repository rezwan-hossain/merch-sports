// module/legal/components/PrivacyPolicyContent.tsx
import {
  Shield,
  Database,
  Cookie,
  Lock,
  Share2,
  UserCheck,
  RefreshCw,
  Mail,
} from "lucide-react";
import { LegalDocument, type LegalSection } from "./LegalDocument";
import { BUSINESS_NAME } from "@/lib/business-info";

const sections: LegalSection[] = [
  {
    icon: Database,
    title: "1. Information We Collect",
    content: `
      We collect information to provide better services to our marathon participants. The types of information we collect include:
      
      • Personal Information: Name, email address, phone number, date of birth, gender, and emergency contact details provided during registration.
      • Health Information: Blood group, medical conditions, and physical fitness information relevant to marathon participation.
      • Payment Information: Transaction details processed through our secure payment gateways (ShurjoPay and SSLCommerz — bKash, Nagad, Rocket, cards and internet banking).
      • Event Data: Race times, participation history, and performance statistics.
      • Usage Data: Information about how you interact with our website, including IP address, browser type, and pages visited.
    `,
  },
  {
    icon: Shield,
    title: "2. How We Use Your Information",
    content: `
      We use the collected information for the following purposes:
      
      • Event Management: Processing registrations, assigning BIB numbers, and managing race logistics.
      • Communication: Sending event updates, race instructions, and important announcements via email or SMS.
      • Safety & Medical: Providing medical support during events and contacting emergency contacts if necessary.
      • Timing & Results: Recording and publishing race times and results.
      • Improvement: Analyzing usage patterns to improve our website and event experience.
      • Marketing: Sending information about future events and promotions (with your consent).
    `,
  },
  {
    icon: Cookie,
    title: "3. Cookies & Tracking",
    content: `
      We use cookies and similar tracking technologies to enhance your experience:
      
      • Essential Cookies: Required for website functionality, authentication, and security.
      • Analytics Cookies: Help us understand how visitors interact with our website using services like Google Analytics.
      • Preference Cookies: Remember your settings and preferences for future visits.
      
      You can control cookie settings through your browser. However, disabling certain cookies may affect website functionality.
    `,
  },
  {
    icon: Lock,
    title: "4. Data Security",
    content: `
      We take the security of your data seriously and implement appropriate measures:
      
      • Encryption: All sensitive data is encrypted during transmission using SSL/TLS protocols.
      • Secure Storage: Personal information is stored on secure servers with restricted access.
      • Payment Security: We do not store complete payment card details. All transactions are processed through PCI-compliant payment gateways.
      • Access Control: Only authorized personnel have access to personal data on a need-to-know basis.
      • Regular Audits: We conduct periodic security assessments to identify and address vulnerabilities.
    `,
  },
  {
    icon: Share2,
    title: "5. Third-Party Services",
    content: `
      We may share your information with trusted third parties for event operations:
      
      • Payment Processors: ShurjoPay and SSLCommerz for secure payment processing (bKash, Nagad, Rocket, cards and internet banking).
      • Timing Companies: Official timing partners for accurate race time recording.
      • Medical Services: Emergency medical teams for participant safety during events.
      • Analytics Providers: Google Analytics for website performance analysis.
      • Email Services: For sending event communications and updates.
      
      We ensure all third parties adhere to appropriate data protection standards and only use your data for specified purposes.
    `,
  },
  {
    icon: UserCheck,
    title: "6. Your Rights",
    content: `
      You have the following rights regarding your personal data:
      
      • Access: Request a copy of the personal information we hold about you.
      • Correction: Request corrections to any inaccurate or incomplete information.
      • Deletion: Request deletion of your personal data, subject to legal retention requirements.
      • Opt-Out: Unsubscribe from marketing communications at any time.
      • Data Portability: Request your data in a portable format.
      • Withdraw Consent: Withdraw previously given consent for data processing.
      
      To exercise these rights, please contact us using the information provided below.
    `,
  },
  {
    icon: RefreshCw,
    title: "7. Changes to This Policy",
    content: `
      We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements:
      
      • Notification: Significant changes will be communicated via email or website announcement.
      • Effective Date: The "Last Updated" date at the top indicates when the policy was last revised.
      • Continued Use: Your continued use of our services after changes constitutes acceptance of the updated policy.
      
      We encourage you to review this policy regularly to stay informed about how we protect your information.
    `,
  },
  {
    icon: Mail,
    title: "8. Contact Us",
    content: `
      If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
      
      Email: info@merchcommunication.com
      Phone: +880 186-2221943
      Address: House-32,Road-08,Block-H,Mirpur-2
      
      
    `,
  },
];

export default function PrivacyPolicyContent() {
  return (
    <LegalDocument
      policy="privacy"
      heroTitle="Privacy Policy"
      title="Privacy Policy"
      lastUpdated="November 10, 2026"
      summary={
        <>
          <strong>Our Commitment:</strong> At {BUSINESS_NAME}, we are committed to protecting your
          privacy and ensuring the security of your personal information. This Privacy Policy
          explains how we collect, use, store, and protect your data when you use our services and
          participate in our events.
        </>
      }
      sections={sections}
      closing={
        <>
          <strong>Your Consent:</strong> By using our website and registering for our marathon
          events, you consent to the collection and use of your information as described in this
          Privacy Policy. If you do not agree with this policy, please do not use our services.
        </>
      }
    />
  );
}
