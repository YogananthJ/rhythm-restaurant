import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Clock, Send, Navigation } from "lucide-react";

import { GuestHeader } from "@/components/guest/GuestHeader";
import { GuestFooter } from "@/components/guest/GuestFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { SuccessScreen } from "@/components/SuccessScreen";
import { CONTACT } from "@/lib/guest-catalog";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & directions — Occupancy Demo Kitchen" },
      { name: "description", content: "Find us, call us or email us. Address, phone, opening hours, directions and social links for Occupancy Demo Kitchen." },
      { property: "og:title", content: "Contact — Occupancy Demo Kitchen" },
      { property: "og:description", content: "Address, phone, email, opening hours and directions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      toast.error("Please add your name and a message");
      return;
    }
    setSent(true);
    toast.success("Message sent — we'll reply shortly");
  }

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} aria-hidden="true" />
      <GuestHeader />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-3">Contact</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Come say hello</h1>
          <p className="mt-2 text-muted-foreground">
            Walk-ins welcome, reservations recommended. For large parties or press, drop us a line.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="border-white/10 bg-card/60 p-6 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Visit us</h2>
              <ul className="mt-4 space-y-4 text-sm">
                <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{CONTACT.address}</span></li>
                <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><a className="hover:text-primary" href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}>{CONTACT.phone}</a></li>
                <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><a className="hover:text-primary" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm" className="press"><Link to="/book">Reserve a table</Link></Button>
                <Button asChild size="sm" variant="outline" className="press">
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(CONTACT.address)}`} target="_blank" rel="noreferrer">
                    <Navigation className="mr-1.5 h-4 w-4" /> Get directions
                  </a>
                </Button>
              </div>
            </Card>

            <Card className="border-white/10 bg-card/60 p-6 backdrop-blur">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" /> Opening hours
              </h2>
              <ul className="mt-4 space-y-2 text-sm">
                {CONTACT.hours.map((h) => (
                  <li key={h.day} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                    <span className="min-w-0 truncate text-muted-foreground">{h.day}</span>
                    <span className="shrink-0 font-medium">{h.time}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface/40">
              <div className="grid-pattern flex h-56 items-center justify-center">
                <div className="rounded-xl border border-white/10 bg-background/70 px-4 py-3 text-center backdrop-blur">
                  <MapPin className="mx-auto h-5 w-5 text-primary" />
                  <div className="mt-1 text-sm font-medium">Map preview</div>
                  <div className="text-xs text-muted-foreground">{CONTACT.address}</div>
                </div>
              </div>
            </div>
          </div>

          <Card className="h-fit border-white/10 bg-card/60 p-6 backdrop-blur sm:p-8">
            {sent ? (
              <SuccessScreen
                title="Message sent"
                message="Thanks for reaching out — the team replies within a few minutes during service hours."
                details={[{ label: "From", value: form.name }]}
              >
                <Button variant="outline" onClick={() => { setSent(false); setForm({ name: "", email: "", message: "" }); }}>
                  Send another
                </Button>
                <Button asChild><Link to="/our-menu">Browse the menu</Link></Button>
              </SuccessScreen>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="text-lg font-semibold">Send us a message</h2>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="c-name">Your name</label>
                  <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="c-email">Email</label>
                  <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="c-msg">Message</label>
                  <Textarea id="c-msg" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={800} required />
                </div>
                <Button type="submit" className="press w-full" size="lg">
                  <Send className="mr-1.5 h-4 w-4" /> Send message
                </Button>
                <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                  {CONTACT.socials.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="hover:text-foreground">{s.label}</a>
                  ))}
                </div>
              </form>
            )}
          </Card>
        </div>
      </main>

      <GuestFooter />
    </div>
  );
}
