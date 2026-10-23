// app/opengraph-image.tsx
//
// The link-preview image for the site (Facebook, WhatsApp, LinkedIn, X…).
// Event pages have their own: app/events/[slug]/opengraph-image.tsx.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/og-fonts";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "Merch Sports — Running events in Bangladesh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#0d2b22";
const LIME = "#99cd43";

export default async function OGImage() {
  const [logo, heading, body] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "MerchSports-small.png")).then(
      (b) => `data:image/png;base64,${b.toString("base64")}`,
    ),
    loadGoogleFont("Anton", 400).catch(() => null),
    loadGoogleFont("Inter", 600).catch(() => null),
  ]);
  const fonts = [
    ...(heading ? [{ name: "Anton", data: heading, weight: 400 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "Inter", data: body, weight: 600 as const, style: "normal" as const }] : []),
  ];
  const domain = new URL(SITE.url).host.replace(/^www\./, "");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: GREEN,
        position: "relative",
        fontFamily: "Inter",
        color: "white",
      }}
    >
      {/* Lime glow + faint outlined word */}
      <div
        style={{
          position: "absolute",
          right: -160,
          top: -160,
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: "radial-gradient(circle, rgba(153,205,67,0.35) 0%, rgba(153,205,67,0) 70%)",
          display: "flex",
        }}
      />

      {/* Top: logo + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img src={logo} width={88} height={88} alt="" style={{ borderRadius: 9999 }} />
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>
          Merch Sports
        </div>
      </div>

      {/* Middle: the line */}
      <div style={{ display: "flex", flexDirection: "column", fontFamily: "Anton", lineHeight: 0.92 }}>
        <div style={{ display: "flex", fontSize: 150, letterSpacing: -1, textTransform: "uppercase" }}>Run beyond</div>
        <div style={{ display: "flex", fontSize: 150, letterSpacing: -1, textTransform: "uppercase", color: LIME }}>
          your limits
        </div>
      </div>

      {/* Bottom: what we do + domain */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: "rgba(255,255,255,0.8)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: LIME, display: "flex" }} />
          Road races & virtual runs across Bangladesh
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.5)" }}>{domain}</div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
