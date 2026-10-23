// app/events/opengraph-image.tsx
//
// /events sets its own openGraph metadata, which drops the site-wide preview
// image, so it re-uses it here. Event pages have their own ([slug]/).
export { default, alt, size, contentType } from "../opengraph-image";
export const runtime = "nodejs";
