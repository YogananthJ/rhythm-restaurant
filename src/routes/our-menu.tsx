import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, UtensilsCrossed, Flame } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { GuestHeader } from "@/components/guest/GuestHeader";
import { GuestFooter } from "@/components/guest/GuestFooter";
import { DishCard } from "@/components/guest/DishCard";
import { DishDetailDialog } from "@/components/guest/DishDetailDialog";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORIES, enrichDish, type EnrichedDish, type MenuRow } from "@/lib/guest-catalog";

export const Route = createFileRoute("/our-menu")({
  head: () => ({
    meta: [
      { title: "Menu — Occupancy Demo Kitchen" },
      { name: "description", content: "Browse the live menu: search dishes, filter by category, diet and spice, and see ratings, prep times and calories in real time." },
      { property: "og:title", content: "Menu — Occupancy Demo Kitchen" },
      { property: "og:description", content: "Live availability, chef recommendations, trending plates and allergen details for every dish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuPage,
});

type Diet = "all" | "veg" | "non-veg";

function MenuPage() {
  const [rows, setRows] = useState<MenuRow[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [diet, setDiet] = useState<Diet>("all");
  const [maxSpice, setMaxSpice] = useState(3);
  const [active, setActive] = useState<EnrichedDish | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("menu_items")
      .select("id,name,description,price_cents,prep_minutes,popularity_score,is_available")
      .order("popularity_score", { ascending: false })
      .limit(120)
      .then(({ data }) => {
        if (!cancelled) setRows((data as MenuRow[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dishes = useMemo(() => (rows ?? []).map((r, i) => enrichDish(r, i)), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dishes.filter((d) => {
      if (cat !== "all" && d.category !== cat) return false;
      if (diet !== "all" && d.diet !== diet) return false;
      if (d.spice > maxSpice) return false;
      if (needle && !`${d.name} ${d.description ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [dishes, q, cat, diet, maxSpice]);

  const reset = () => {
    setQ("");
    setCat("all");
    setDiet("all");
    setMaxSpice(3);
  };

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} aria-hidden="true" />
      <GuestHeader />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-3">Live menu</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tonight's menu</h1>
          <p className="mt-2 text-muted-foreground">
            Availability, pricing and prep times stream straight from the kitchen. If it's here, it's on.
          </p>
        </div>

        {/* Filters */}
        <div className="sticky top-[57px] z-30 -mx-6 mt-8 border-y border-white/10 bg-background/80 px-6 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search dishes, ingredients…"
                  aria-label="Search the menu"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" className="press shrink-0" onClick={reset}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Reset
              </Button>
            </div>

            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                  {c.label}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 bg-white/10" />
              {(["all", "veg", "non-veg"] as Diet[]).map((d) => (
                <Chip key={d} active={diet === d} onClick={() => setDiet(d)}>
                  {d === "all" ? "Any diet" : d === "veg" ? "Vegetarian" : "Non-veg"}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 bg-white/10" />
              {[0, 1, 2, 3].map((s) => (
                <Chip key={s} active={maxSpice === s} onClick={() => setMaxSpice(s)}>
                  <span className="inline-flex items-center gap-1">
                    {s === 0 ? "Mild only" : <>≤ {s} <Flame className="h-3 w-3 text-orange-400" /></>}
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
          {rows === null ? "Loading menu…" : `${filtered.length} dish${filtered.length === 1 ? "" : "es"}`}
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows === null &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-shine h-80 rounded-2xl border border-white/10 bg-surface/40" aria-hidden="true" />
            ))}
          {rows !== null && filtered.map((d) => <DishCard key={d.id} dish={d} onOpen={setActive} />)}
        </div>

        {rows !== null && filtered.length === 0 && (
          <EmptyState
            className="mt-6"
            icon={UtensilsCrossed}
            title="No dishes match those filters"
            message="Try clearing the spice or diet filters, or search for something else — the kitchen has plenty more."
            action={{ label: "Clear filters", onClick: reset }}
          />
        )}
      </main>

      <DishDetailDialog dish={active} all={dishes} onOpenChange={(o) => !o && setActive(null)} onSelect={setActive} />
      <GuestFooter />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
