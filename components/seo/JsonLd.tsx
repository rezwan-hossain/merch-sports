// components/seo/JsonLd.tsx
//
// Renders schema.org data for search engines. `<` is escaped so text from the
// database (event names, descriptions) can never close the script tag early.
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
