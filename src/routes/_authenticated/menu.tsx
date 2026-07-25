import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, ChefHat, Plus, Pencil, Trash2, Search, FolderPlus } from "lucide-react";

type Category = { id: string; name: string; sort_order: number; restaurant_id: string };
type Item = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  prep_minutes: number;
};

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menu Manager — Occupancy" },
      { name: "description", content: "Create, edit, and 86 menu items across categories in real time." },
      { property: "og:title", content: "Menu Manager — Occupancy" },
      { property: "og:description", content: "Full menu CRUD wired to the live floor." },
    ],
  }),
  component: MenuManager,
});

function MenuManager() {
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [catDialog, setCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const load = async () => {
    const { data: rest } = await supabase.from("restaurants").select("id").limit(1).maybeSingle();
    const rid = rest?.id ?? null;
    setRestaurantId(rid);
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from("menu_categories").select("*").order("sort_order"),
      supabase.from("menu_items").select("*").order("name"),
    ]);
    setCats((c as Category[]) ?? []);
    setItems((i as Item[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("menu-manager")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeCat !== "all" && i.category_id !== activeCat) return false;
      if (q && !`${i.name} ${i.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCat, q]);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Uncategorized";

  const toggleAvail = async (it: Item) => {
    const prev = it.is_available;
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, is_available: !prev } : x)));
    const { error } = await supabase.from("menu_items").update({ is_available: !prev }).eq("id", it.id);
    if (error) {
      setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, is_available: prev } : x)));
      toast.error(error.message);
    } else {
      toast.success(!prev ? `${it.name} back on menu` : `86'd ${it.name}`);
    }
  };

  const removeItem = async (it: Item) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else toast.success(`Deleted ${it.name}`);
  };

  const saveItem = async (draft: Partial<Item> & { name: string; price_cents: number; prep_minutes: number }): Promise<void> => {
    if (!restaurantId) return;
    if (editing) {
      const { error } = await supabase
        .from("menu_items")
        .update({
          name: draft.name,
          description: draft.description ?? null,
          price_cents: draft.price_cents,
          prep_minutes: draft.prep_minutes,
          category_id: draft.category_id ?? null,
          is_available: draft.is_available ?? true,
        })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Item updated");
      setEditing(null);
    } else {
      const { error } = await supabase.from("menu_items").insert({
        restaurant_id: restaurantId,
        name: draft.name,
        description: draft.description ?? null,
        price_cents: draft.price_cents,
        prep_minutes: draft.prep_minutes,
        category_id: draft.category_id ?? null,
        is_available: draft.is_available ?? true,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Item added");
      setCreating(false);
    }
  };

  const addCategory = async () => {
    if (!restaurantId || !newCatName.trim()) return;
    const { error } = await supabase.from("menu_categories").insert({
      restaurant_id: restaurantId,
      name: newCatName.trim(),
      sort_order: cats.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Category added");
    setNewCatName("");
    setCatDialog(false);
  };

  const deleteCategory = async (c: Category) => {
    const { error } = await supabase.from("menu_categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else toast.success(`Removed ${c.name}`);
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.category_id ?? "none", (m.get(it.category_id ?? "none") ?? 0) + 1);
    return m;
  }, [items]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Dashboard</Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <ChefHat className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">Menu Manager</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{items.length} items · {cats.length} categories</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={catDialog} onOpenChange={setCatDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><FolderPlus className="mr-1.5 h-4 w-4" /> Category</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Desserts" />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCatDialog(false)}>Cancel</Button>
                  <Button onClick={addCategory}>Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New item
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCat("all")}
              className={`rounded-full border px-3 py-1 text-xs transition ${activeCat === "all" ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
            >
              All · {items.length}
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`group flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${activeCat === c.id ? "border-primary/60 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
              >
                {c.name} · {counts.get(c.id) ?? 0}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <span
                      role="button"
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete category "{c.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Items in this category will become Uncategorized. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteCategory(c)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-40 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="grid place-items-center py-20 text-center">
            <div className="space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
                <ChefHat className="h-5 w-5" />
              </div>
              <div className="text-sm text-muted-foreground">No items match. Try clearing filters or add a new one.</div>
              <Button onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" /> New item</Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it) => (
              <Card key={it.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold">{it.name}</div>
                      {!it.is_available && <Badge variant="destructive" className="text-[10px]">86'd</Badge>}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{catName(it.category_id)} · {it.prep_minutes}m prep</div>
                  </div>
                  <div className="text-right text-sm font-semibold text-primary">
                    ${(it.price_cents / 100).toFixed(2)}
                  </div>
                </div>
                {it.description && <p className="line-clamp-2 text-xs text-muted-foreground">{it.description}</p>}
                <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={it.is_available} onCheckedChange={() => toggleAvail(it)} />
                    {it.is_available ? "Available" : "86'd"}
                  </label>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{it.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes it from the menu everywhere immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeItem(it)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <ItemDialog
        open={creating || !!editing}
        item={editing}
        cats={cats}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={saveItem}
      />
    </div>
  );
}

function ItemDialog({
  open,
  item,
  cats,
  onClose,
  onSave,
}: {
  open: boolean;
  item: Item | null;
  cats: Category[];
  onClose: () => void;
  onSave: (draft: Partial<Item> & { name: string; price_cents: number; prep_minutes: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.00");
  const [prep, setPrep] = useState(10);
  const [categoryId, setCategoryId] = useState<string>("none");
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setDescription(item?.description ?? "");
      setPrice(((item?.price_cents ?? 0) / 100).toFixed(2));
      setPrep(item?.prep_minutes ?? 10);
      setCategoryId(item?.category_id ?? "none");
      setAvailable(item?.is_available ?? true);
    }
  }, [open, item]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    const cents = Math.round(parseFloat(price || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0) return toast.error("Invalid price");
    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      price_cents: cents,
      prep_minutes: Math.max(1, Math.min(120, prep | 0)),
      category_id: categoryId === "none" ? null : categoryId,
      is_available: available,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New menu item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Truffle Risotto" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Short guest-facing description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Price (USD)</Label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prep (minutes)</Label>
              <Input type="number" min={1} max={120} value={prep} onChange={(e) => setPrep(parseInt(e.target.value || "0", 10))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={available} onCheckedChange={setAvailable} />
            Available on the live menu
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : item ? "Save" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
