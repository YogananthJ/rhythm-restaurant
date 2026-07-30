import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Sparkles, Trophy, Clock, ArrowRight } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  prep_minutes: number | null;
  popularity_score: number | null;
  is_available: boolean;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function SkeletonCard() {
  return (
    <div className="skeleton-shine h-44 rounded-2xl border border-white/10 bg-surface/40" aria-hidden="true" />
  );
}

function DishCard({ item, accent, tag }: { item: Item; accent: string; tag: string }) {
  return (
    <article className="hover-lift group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/50 p-5 backdrop-blur transition-colors hover:border-primary/40">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ background: accent }}
      />
      <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider">
        {tag}
      </Badge>
      <h3 className="mt-3 truncate text-lg font-semibold">{item.name}</h3>
      <p className="mt-1 line-clamp-2 min-w-0 text-sm text-muted-foreground">
        {item.description ?? "Chef's selection from tonight's pass."}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xl font-bold text-primary">{money(item.price_cents)}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {item.prep_minutes ?? 10} min
        </span>
      </div>
    </article>
  );
}

export function MenuShowcase() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("menu_items")
      .select("id,name,description,price_cents,prep_minutes,popularity_score,is_available")
      .eq("is_available", true)
      .limit(24)
      .then(({ data }) => {
        if (!cancelled) setItems((data as Item[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { trending, recommended, specials } = useMemo(() => {
    const list = items ?? [];
    const used = new Set<string>();
    const take = (sorted: Item[], n: number) => {
      const out: Item[] = [];
      for (const it of sorted) {
        if (used.has(it.id)) continue;
        used.add(it.id);
        out.push(it);
        if (out.length === n) break;
      }
      return out;
    };
    const byPop = [...list].sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0));
    const byFast = [...list].sort((a, b) => (a.prep_minutes ?? 99) - (b.prep_minutes ?? 99));
    const byValue = [...list].sort((a, b) => a.price_cents - b.price_cents);
    return {
      trending: take(byPop, 3),
      recommended: take(byFast, 3),
      specials: take(byValue, 3),
    };
  }, [items]);

  const groups = [
    {
      id: "trending",
      title: "Trending dishes",
      blurb: "Best sellers ranked live by tonight's order velocity.",
      icon: Flame,
      accent: "oklch(0.72 0.19 40)",
      tag: "Best seller",
      data: trending,
    },
    {
      id: "recommended",
      title: "Recommended for you",
      blurb: "Fast-to-the-pass favourites that pair well with anything.",
      icon: Sparkles,
      accent: "oklch(0.70 0.16 230)",
      tag: "Guest favourite",
      data: recommended,
    },
    {
      id: "specials",
      title: "Today's specials",
      blurb: "Featured plates and promotional pricing from the chef.",
      icon: Trophy,
      accent: "oklch(0.75 0.17 150)",
      tag: "Chef's special",
      data: specials,
    },
  ];

  return (
    <section id="menu" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-24">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-3">On the menu tonight</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What guests are ordering</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Live from the demo kitchen — availability, pricing, and prep times update in real time.
          </p>
        </div>
        <Button asChild variant="outline" className="press shrink-0">
          <Link to="/book">
            Reserve a table <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-12 space-y-14">
        {groups.map((g) => (
          <div key={g.id}>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10"
                style={{ background: `color-mix(in oklab, ${g.accent} 18%, transparent)` }}
              >
                <g.icon className="h-4 w-4 text-foreground" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{g.title}</h3>
                <p className="truncate text-sm text-muted-foreground">{g.blurb}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items === null
                ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
                : g.data.map((item) => (
                    <DishCard key={`${g.id}-${item.id}`} item={item} accent={g.accent} tag={g.tag} />
                  ))}
              {items !== null && g.data.length === 0 && (
                <p className="text-sm text-muted-foreground">Menu is being prepped — check back shortly.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
