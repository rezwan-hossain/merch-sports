import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { Suspense } from "react";
import { TrackingScripts } from "@/components/tracking/TrackingScripts";
import { PageViewTracker } from "@/components/tracking/PageViewTracker";
import { SITE } from "@/lib/seo";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

const anton = Anton({
  weight: "400",
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"], // ✅ Add fallback
  adjustFontFallback: true, // ✅ Reduce layout shift
});

const inter = Inter({
  weight: ["400", "500", "600"],
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"], // ✅ Add fallback
  adjustFontFallback: true, // ✅ Reduce layout shift
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),

  // Pages set their own title; it becomes "<title> | Merch Sports".
  title: {
    default: "Merch Sports — Running events in Bangladesh",
    template: "%s | Merch Sports",
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "Merch Sports",
    "marathon Bangladesh",
    "half marathon Dhaka",
    "running events Bangladesh",
    "virtual run",
    "fun run",
    "race registration",
  ],
  referrer: "origin-when-cross-origin",
  category: "sports",

  // Defaults for link previews (Facebook, WhatsApp, LinkedIn, X…). The image
  // comes from app/opengraph-image.tsx; event pages use their own.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_US",
    url: "/",
    title: "Merch Sports — Running events in Bangladesh",
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Merch Sports — Running events in Bangladesh",
    description: SITE.description,
  },
  robots: { index: true, follow: true },

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon0.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },

  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Preconnect to Google Fonts BEFORE fonts load */}
        {/* <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        /> */}
      </head>
      <body className={`${anton.variable} ${inter.variable} antialiased`}>
        <Suspense fallback={null}>
          <TrackingScripts />
        </Suspense>
        {/* usePathname() is dynamic under cacheComponents → needs Suspense */}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>

        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
