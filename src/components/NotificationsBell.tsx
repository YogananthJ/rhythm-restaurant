import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, X, AlertTriangle, ChefHat, Receipt, CalendarClock, Sparkles } from "lucide-react";
import { toast } from "sonner";

type N = {
  id: string;
  restaurant_id: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  body: string | null;
  link: string | null;
  group_key: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const categoryIcon = (c: string) => {
  switch (c) {
    case "order": return <Receipt className="h-3.5 w-3.5" />;
    case "kitchen": return <ChefHat className="h-3.5 w-3.5" />;
    case "reservation": return <CalendarClock className="h-3.5 w-3.5" />;
    case "incident": return <AlertTriangle className="h-3.5 w-3.5" />;
    default: return <Sparkles className="h-3.5 w-3.5" />;
  }
};

const priorityTone = (p: N["priority"]) => {
  switch (p) {
    case "urgent": return "bg-red-500/15 text-red-300 border-red-500/30";
    case "high": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "low": return "bg-white/5 text-muted-foreground border-white/10";
    default: return "bg-primary/10 text-primary border-primary/30";
  }
};

export function NotificationsBell({ restaurantId }: { restaurantId: string | null }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("notifications" as never)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as unknown as N[]) ?? []);
  };

  useEffect(() => {
    if (!restaurantId) return;
    void load();
    const ch = supabase
      .channel(`notifications-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as N;
            setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 50));
            if (n.priority === "urgent" || n.priority === "high") {
              toast(n.title, { description: n.body ?? undefined });
            }
          } else {
            void load();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const unread = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  const grouped = useMemo(() => {
    const buckets: Record<string, N[]> = { urgent: [], high: [], normal: [], low: [] };
    for (const n of items) buckets[n.priority]?.push(n);
    return buckets;
  }, [items]);

  const markRead = async (id: string) => {
    await supabase.rpc("notify_mark_read" as never, { p_id: id } as never);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };
  const dismiss = async (id: string) => {
    await supabase.rpc("notify_dismiss" as never, { p_id: id } as never);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };
  const markAll = async () => {
    if (!restaurantId) return;
    await supabase.rpc("notify_mark_all_read" as never, { p_restaurant_id: restaurantId } as never);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const onClick = async (n: N) => {
    await markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate({ to: n.link } as never);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 border-white/10 bg-card/95 p-0 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-[11px] text-muted-foreground">
              {items.length} active · {unread} unread
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all
          </Button>
        </div>
        <ScrollArea className="max-h-[70vh]">
          {items.length === 0 ? (
            <div className="grid place-items-center px-6 py-12 text-center text-xs text-muted-foreground">
              <Bell className="mb-2 h-6 w-6 opacity-40" />
              You're all caught up.
            </div>
          ) : (
            (["urgent", "high", "normal", "low"] as const).map((p) =>
              grouped[p].length ? (
                <div key={p}>
                  <div className="sticky top-0 z-[1] border-b border-white/5 bg-card/95 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {p} · {grouped[p].length}
                  </div>
                  {grouped[p].map((n) => (
                    <div
                      key={n.id}
                      className={`group flex cursor-pointer gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/5 ${
                        !n.read_at ? "bg-primary/5" : ""
                      }`}
                      onClick={() => onClick(n)}
                    >
                      <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${priorityTone(n.priority)}`}>
                        {categoryIcon(n.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                              <div className="truncate text-sm font-medium">{n.title}</div>
                            </div>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Badge variant="outline" className="h-4 border-white/10 px-1.5 text-[9px]">
                                {n.category}
                              </Badge>
                              <span>{timeAgo(n.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            {!n.read_at && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void markRead(n.id);
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                void dismiss(n.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null,
            )
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
