import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { getPublicFaqs } from "@/app/actions/faq";

// Questions come from the database (edited under Manage Homepage → FAQ).
// getPublicFaqs is cached and refreshed the moment an admin saves.
//
// Homepage style: big heading with a lime line on the left (sticky on
// desktop), numbered accordion on the right. <details> keeps it working
// without JavaScript and with the keyboard.
export default async function FAQ() {
  const faqs = await getPublicFaqs();
  if (faqs.length === 0) return null; // every question hidden → no section

  return (
    <section id="faq" aria-labelledby="faq-title" className="px-4 md:px-8 py-20 md:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        {/* Heading + help */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2
            id="faq-title"
            className="text-6xl sm:text-7xl md:text-8xl uppercase leading-[0.9] tracking-tight text-[#0d2b22]"
          >
            Got
            <br />
            <span className="text-neon-lime">questions?</span>
          </h2>
          <p className="mt-5 max-w-sm text-sm md:text-base leading-relaxed text-gray-600">
            Everything you need to know about registering, race day and your kit. Can&apos;t find your answer?
          </p>
          <Link
            href="/contact"
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-[#0d2b22] py-1.5 pl-4 pr-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Contact us
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neon-lime text-[#0d2b22]">
              <ArrowUpRight
                size={14}
                className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <details
              key={index}
              name="faq"
              className="group rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow duration-300 hover:ring-gray-300 open:ring-2 open:ring-neon-lime open:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            >
              <summary className="flex cursor-pointer list-none items-start gap-4 rounded-2xl p-5 sm:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="mt-0.5 font-[family-name:var(--font-heading)] text-lg leading-none tracking-wide text-gray-300 transition-colors group-open:text-neon-lime"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-base sm:text-lg font-semibold leading-snug text-gray-900">
                  {faq.question}
                </span>
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition duration-300 group-open:rotate-45 group-open:bg-neon-lime group-open:text-[#0d2b22]"
                >
                  <Plus size={16} />
                </span>
              </summary>

              <div className="grid grid-rows-[0fr] transition-all duration-300 group-open:grid-rows-[1fr]">
                <div className="overflow-hidden">
                  <p className="whitespace-pre-line px-5 pb-6 pl-[3.25rem] text-sm sm:text-base leading-relaxed text-gray-600 sm:px-6 sm:pl-[3.5rem]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
