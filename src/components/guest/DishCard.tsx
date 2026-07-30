import { Flame, Clock, Star, Leaf, Beef } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BADGE_META, type EnrichedDish } from "@/lib/guest-catalog";

export const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function SpiceMeter({ level }: { level: number }) {
  if (level === 0) return <span className="text-xs text-muted-foreground">Mild</span>;
  return (
    <span className="flex items-center gap-0.5" aria-label={`Spice level ${level} of 3`}>
      {[1, 2, 3].map((i) => (
        <Flame key={i} className={`h-3.5 w-3.5 ${i <= level ? "text-orange-400" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

export function DietDot({ diet }: { diet: EnrichedDish["diet"] }) {
  const veg = diet === "veg";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
        veg ? "border-emerald-400/40 text-emerald-300" : "border-rose-400/40 text-rose-300"
      }`}
    >
      {veg ? <Leaf className="h-3 w-3" /> : <Beef className="h-3 w-3" />}
      {veg ? "Veg" : "Non-veg"}
    </span>
  );
}

export function DishBadges({ dish }: { dish: EnrichedDish }) {
  if (dish.badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {dish.badges.map((b) => (
        <span key={b} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_META[b].className}`}>
          {BADGE_META[b].label}
        </span>
      ))}
    </div>
  );
}

export function DishCard({ dish, onOpen }: { dish: EnrichedDish; onOpen: (d: EnrichedDish) => void }) {
  return (
    <article className="hover-lift group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/50 backdrop-blur transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={() => onOpen(dish)}
        className="relative block aspect-[16/10] w-full overflow-hidden text-left"
        aria-label={`View details for ${dish.name}`}
      >
        <img
          src={dish.image}
          alt={dish.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent p-3">
          <DishBadges dish={dish} />
          {!dish.is_available && <Badge variant="destructive" className="shrink-0 text-[10px]">86'd</Badge>}
        </div>
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold">{dish.name}</h3>
          <span className="shrink-0 text-base font-bold text-primary">{money(dish.price_cents)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {dish.description ?? "Chef's selection from tonight's pass."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <DietDot diet={dish.diet} />
          <SpiceMeter level={dish.spice} />
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{dish.prep_minutes ?? 10} min</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{dish.rating}</span>
          <span>{dish.calories} kcal</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(dish)}
          className="press mt-4 w-full rounded-xl border border-primary/40 bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          View details
        </button>
      </div>
    </article>
  );
}
