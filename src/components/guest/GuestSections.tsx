import { Link } from "@tanstack/react-router";
import { Salad, Soup, Flame, CakeSlice, CupSoda, UtensilsCrossed, ShieldCheck, Timer, Sparkles, HeartHandshake, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GALLERY } from "@/lib/guest-catalog";

const CATEGORY_CARDS = [
  { id: "starters", label: "Starters", icon: Soup, accent: "oklch(0.75 0.17 150)" },
  { id: "mains", label: "Mains", icon: UtensilsCrossed, accent: "oklch(0.70 0.16 230)" },
  { id: "grill", label: "From the grill", icon: Flame, accent: "oklch(0.72 0.19 40)" },
  { id: "sides", label: "Sides", icon: Salad, accent: "oklch(0.78 0.15 130)" },
  { id: "desserts", label: "Desserts", icon: CakeSlice, accent: "oklch(0.75 0.16 340)" },
  { id: "drinks", label: "Drinks", icon: CupSoda, accent: "oklch(0.74 0.14 200)" },
];

export function FeaturedCategories() {
  return (
    <section id="categories" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-20">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-3">Featured categories</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start where you're hungry</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">Six sections, one live kitchen. Every category updates as dishes sell out.</p>
        </div>
        <Button asChild variant="outline" className="press shrink-0">
          <Link to="/our-menu">Full menu <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORY_CARDS.map((c) => (
          <Link
            key={c.id}
            to="/our-menu"
            className="hover-lift group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-surface/50 p-5 text-center backdrop-blur transition-colors hover:border-primary/40"
          >
            <span
              className="pointer-events-none absolute -top-8 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
              style={{ background: c.accent }}
            />
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-background/40">
              <c.icon className="h-5 w-5 text-primary" />
            </span>
            <span className="mt-3 text-sm font-medium">{c.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const REASONS = [
  { icon: Timer, title: "No waiting for a server", body: "Scan, order and pay from your phone. Tickets hit the kitchen display in under a second." },
  { icon: ShieldCheck, title: "Honest availability", body: "If a dish is 86'd it disappears from your menu instantly — no disappointing substitutions." },
  { icon: Sparkles, title: "Recommendations that fit", body: "Pairings based on what's actually cooking tonight, your table size and prep times." },
  { icon: HeartHandshake, title: "Rewards for regulars", body: "Points on every visit, streak bonuses and vouchers you can redeem at the table." },
];

export function WhyChoose() {
  return (
    <section id="why" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-20">
      <div className="max-w-2xl">
        <Badge variant="secondary" className="mb-3">Why choose Occupancy</Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">A better night out, end to end</h2>
        <p className="mt-2 text-muted-foreground">The same live system the kitchen runs on is the one in your hand.</p>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((r) => (
          <article key={r.title} className="hover-lift rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
              <r.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold">{r.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GalleryStrip() {
  return (
    <section id="gallery" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-20">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-3">Restaurant gallery</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Inside the room</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">Interiors, the pass, signature plates and a full house on a Friday night.</p>
        </div>
        <Button asChild variant="outline" className="press shrink-0">
          <Link to="/gallery">Open gallery <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY.slice(0, 6).map((g) => (
          <Link
            key={g.id}
            to="/gallery"
            className="hover-lift group relative block overflow-hidden rounded-2xl border border-white/10"
          >
            <img
              src={g.src}
              alt={g.title}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary">{g.tag}</span>
              <span className="block truncate text-sm font-semibold">{g.title}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
