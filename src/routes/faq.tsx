import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, MessageCircle } from "lucide-react";

import { GuestHeader } from "@/components/guest/GuestHeader";
import { GuestFooter } from "@/components/guest/GuestFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQS } from "@/lib/guest-catalog";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Reservations, QR ordering & payments | Occupancy" },
      { name: "description", content: "Answers about reserving a table, how QR ordering works, cancelling bookings, payments, allergies and guest accounts." },
      { property: "og:title", content: "Frequently asked questions — Occupancy" },
      { property: "og:description", content: "Everything guests ask about reservations, QR ordering and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} aria-hidden="true" />
      <GuestHeader />

      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="text-center">
          <Badge variant="secondary" className="mb-3">
            <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Help centre
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Everything guests ask about booking, ordering and paying at Occupancy.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`} className="border-white/10">
              <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-12 rounded-2xl border border-white/10 bg-surface/40 p-8 text-center backdrop-blur">
          <MessageCircle className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Still have a question?</h2>
          <p className="mt-1 text-sm text-muted-foreground">The team answers within a few minutes during service hours.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="press"><Link to="/contact">Contact us</Link></Button>
            <Button asChild variant="outline" className="press"><Link to="/book">Reserve a table</Link></Button>
          </div>
        </div>
      </main>

      <GuestFooter />
    </div>
  );
}
