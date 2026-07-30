import { Link } from "@tanstack/react-router";
import { Clock, Star, Flame, AlertTriangle, ShoppingBag, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { EnrichedDish } from "@/lib/guest-catalog";
import { DietDot, DishBadges, SpiceMeter, money } from "@/components/guest/DishCard";

export function DishDetailDialog({
  dish,
  all,
  onOpenChange,
  onSelect,
}: {
  dish: EnrichedDish | null;
  all: EnrichedDish[];
  onOpenChange: (open: boolean) => void;
  onSelect: (d: EnrichedDish) => void;
}) {
  if (!dish) return null;

  const similar = all.filter((d) => d.id !== dish.id && d.category === dish.category).slice(0, 3);
  const together = all
    .filter((d) => d.id !== dish.id && d.category !== dish.category)
    .sort((a, b) => (b.popularity_score ?? 0) - (a.popularity_score ?? 0))
    .slice(0, 3);

  return (
    <Dialog open={!!dish} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto border-white/10 bg-card/95 backdrop-blur">
        <div className="-mx-6 -mt-6 mb-4 overflow-hidden">
          <img src={dish.image} alt={dish.name} className="h-52 w-full object-cover sm:h-64" />
        </div>
        <DialogHeader className="text-left">
          <div className="mb-2"><DishBadges dish={dish} /></div>
          <DialogTitle className="text-2xl">{dish.name}</DialogTitle>
          <DialogDescription className="text-sm">
            {dish.description ?? "A signature plate from tonight's pass, prepared to order."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="text-xl font-bold text-primary">{money(dish.price_cents)}</span>
          <DietDot diet={dish.diet} />
          <span className="inline-flex items-center gap-1"><Flame className="h-4 w-4 text-orange-400" /><SpiceMeter level={dish.spice} /></span>
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{dish.prep_minutes ?? 10} min prep</span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {dish.rating} <span className="text-xs">({dish.reviews} reviews)</span>
          </span>
          <span>{dish.calories} kcal</span>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</h4>
            <ul className="mt-2 space-y-1 text-sm">
              {dish.ingredients.map((i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{i}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allergens</h4>
            {dish.allergens.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {dish.allergens.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs text-amber-300">
                    <AlertTriangle className="h-3 w-3" /> {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No common allergens declared.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Tell us about allergies in your order note — the kitchen sees it before prep starts.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="press">
            <Link to="/book">
              <ShoppingBag className="mr-1.5 h-4 w-4" /> Add on your visit
            </Link>
          </Button>
          <Button asChild variant="outline" className="press">
            <Link to="/book"><QrCode className="mr-1.5 h-4 w-4" /> Reserve a table</Link>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ordering opens automatically when you scan the QR code at your table.
        </p>

        {[["Similar dishes", similar], ["Frequently ordered together", together]].map(([title, list]) => {
          const items = list as EnrichedDish[];
          if (!items.length) return null;
          return (
            <div key={title as string} className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title as string}</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {items.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelect(d)}
                    className="hover-lift flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-surface/40 p-2 text-left"
                  >
                    <img src={d.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.name}</span>
                      <span className="block text-xs text-primary">{money(d.price_cents)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
