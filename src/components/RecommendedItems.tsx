import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Plus, Sparkles, Clock } from "lucide-react";

export type Recommendation = {
  menu_item_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  prep_minutes: number;
  category_id: string | null;
  dietary_tags: string[] | null;
  score: number;
  reasons: string[] | null;
};

type Props = {
  qrToken: string;
  cartItemIds: string[];
  dietary: string[];
  favorites: Set<string>;
  onAdd: (rec: Recommendation) => void;
  onToggleFavorite: (id: string) => void;
  variant?: "grid" | "row";
  title?: string;
  limit?: number;
};

export function RecommendedItems({
  qrToken,
  cartItemIds,
  dietary,
  favorites,
  onAdd,
  onToggleFavorite,
  variant = "grid",
  title = "Recommended for you",
  limit = 6,
}: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_recommendations" as never, {
        p_qr_token: qrToken,
        p_cart_item_ids: cartItemIds,
        p_dietary: dietary,
        p_limit: limit,
      } as never);
      if (!cancelled) {
        setRecs((data as unknown as Recommendation[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qrToken, cartItemIds.join(","), dietary.join(","), limit]);

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-card/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {title}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (recs.length === 0) return null;

  const containerClass =
    variant === "row"
      ? "flex snap-x gap-3 overflow-x-auto pb-2"
      : "grid gap-3 sm:grid-cols-2";

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-card/40 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {title}
        </div>
        <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
          personalized
        </Badge>
      </div>
      <div className={containerClass}>
        {recs.map((r) => (
          <Card
            key={r.menu_item_id}
            className={`relative border-white/10 bg-card/80 p-3 transition hover:border-primary/40 ${
              variant === "row" ? "min-w-[240px] snap-start" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                {r.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {r.description}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {(r.reasons ?? []).slice(0, 2).map((reason) => (
                    <Badge
                      key={reason}
                      variant="outline"
                      className="h-4 border-primary/30 bg-primary/10 px-1.5 text-[9px] text-primary"
                    >
                      {reason}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    ${(r.price_cents / 100).toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {r.prep_minutes}m
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  aria-label="Favorite"
                  onClick={() => onToggleFavorite(r.menu_item_id)}
                  className={`grid h-7 w-7 place-items-center rounded-full border transition ${
                    favorites.has(r.menu_item_id)
                      ? "border-red-500/40 bg-red-500/15 text-red-300"
                      : "border-white/10 text-muted-foreground hover:border-white/30"
                  }`}
                >
                  <Heart
                    className="h-3.5 w-3.5"
                    fill={favorites.has(r.menu_item_id) ? "currentColor" : "none"}
                  />
                </button>
                <Button size="sm" onClick={() => onAdd(r)} className="h-7 px-2">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
