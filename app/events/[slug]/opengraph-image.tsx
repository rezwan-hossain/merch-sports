// app/events/[slug]/opengraph-image.tsx
//
// The link-preview image for one event (Facebook, WhatsApp, LinkedIn, X…):
// the event photo with a dark-green fade, the name, date, place and the
// starting price, in the site's style. Bangla names are drawn with Noto Sans
// Bengali, loaded with just the characters needed.
import { ImageResponse } from "next/og";
import { loadGoogleFont, loadGoogleFontForText } from "@/lib/og-fonts";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "Merch Sports event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#0d2b22";
const LIME = "#99cd43";
const FONT_STACK = "Anton, Inter, Noto Sans Bengali";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export default async function EventOGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      name: true,
      thumbImage: true,
      bannerImage: true,
      date: true,
      address: true,
      eventType: true,
      minPackagePrice: true,
      packages: { where: { isActive: true }, select: { price: true } },
    },
  });

  const name = event?.name ?? "Merch Sports";
  const price = event?.packages.length ? Math.min(...event.packages.map((p) => p.price)) : (event?.minPackagePrice ?? null);
  const priceText = price ? `From ৳${price.toLocaleString("en-IN")}` : "";
  const place = event ? (event.eventType === "VIRTUAL" ? "Virtual run" : event.address) : "";
  const placeText = place.length > 48 ? `${place.slice(0, 47)}…` : place;

  // Fonts: Anton (headings), Inter (details), Noto Sans Bengali for any Bangla
  // characters in the name/price. Missing fonts just fall back.
  const [heading, body, bangla] = await Promise.all([
    loadGoogleFont("Anton", 400).catch(() => null),
    loadGoogleFont("Inter", 600).catch(() => null),
    loadGoogleFontForText("Noto Sans Bengali", 700, `${name}${priceText}৳`),
  ]);
  const fonts = [
    ...(heading ? [{ name: "Anton", data: heading, weight: 400 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "Inter", data: body, weight: 600 as const, style: "normal" as const }] : []),
    ...(bangla ? [{ name: "Noto Sans Bengali", data: bangla, weight: 700 as const, style: "normal" as const }] : []),
  ];

  const image = event?.bannerImage || event?.thumbImage || null;
  const domain = new URL(SITE.url).host.replace(/^www\./, "");
  const titleSize = name.length > 42 ? 64 : name.length > 26 ? 80 : 96;

  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: GREEN, fontFamily: FONT_STACK }}>
      {/* Event photo */}
      {image && (
        <img
          src={image}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
        />
      )}

      {/* Dark-green fade from the left/bottom so the text is always readable */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          background: `linear-gradient(90deg, ${GREEN} 0%, rgba(13,43,34,0.92) 42%, rgba(13,43,34,0.35) 75%, rgba(13,43,34,0.15) 100%)`,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 1200,
          height: 630,
          padding: "56px 64px",
          color: "white",
        }}
      >
        {/* Top: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Inter", fontSize: 24, letterSpacing: 3, color: "rgba(255,255,255,0.85)" }}>
          <div style={{ width: 12, height: 12, borderRadius: 9999, background: LIME, display: "flex" }} />
          MERCH SPORTS
        </div>

        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: titleSize, lineHeight: 1.02, textTransform: "uppercase" }}>
            {name}
          </div>
          <div style={{ width: 110, height: 6, background: LIME, borderRadius: 3, display: "flex" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "Inter", fontSize: 28, color: "rgba(255,255,255,0.88)" }}>
            {event && <div style={{ display: "flex" }}>{dateFmt.format(new Date(event.date))}</div>}
            {placeText && <div style={{ display: "flex", color: "rgba(255,255,255,0.7)" }}>{placeText}</div>}
          </div>
        </div>

        {/* Bottom: price + domain */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {priceText ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 26px",
                borderRadius: 9999,
                background: LIME,
                color: GREEN,
                fontSize: 30,
                fontFamily: "Inter, Noto Sans Bengali",
              }}
            >
              {priceText}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>{domain}</div>
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
