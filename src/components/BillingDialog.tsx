import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatCents, toCents } from "@/lib/money";
import { generateReceiptPDF } from "@/lib/receipt";
import { Minus, Plus, Trash2, Split, Merge, Printer, Download, CreditCard, Tag, Loader2 } from "lucide-react";

type OrderRow = {
  id: string; restaurant_id: string; table_id: string | null; status: string;
  guest_name: string | null; subtotal_cents: number; discount_cents: number;
  service_charge_cents: number; tax_cents: number; tip_cents: number;
  total_cents: number; coupon_code: string | null; notes: string | null;
  invoice_no: string | null; created_at: string; closed_at: string | null;
};
type ItemRow = { id: string; menu_item_id: string; name_snapshot: string; unit_price_cents: number; quantity: number; notes: string | null; status: string };
type PayRow = { id: string; method: string; amount_cents: number; tip_cents: number; txn_ref: string | null; created_at: string };
type MenuOption = { id: string; name: string; price_cents: number };
type Restaurant = { id: string; name: string; currency: string; tax_pct: number; service_pct: number; address: string | null; phone: string | null };
type TableRow = { id: string; label: string };

const METHODS = ["cash", "card", "upi", "wallet", "bank", "other"] as const;

export function BillingDialog({ orderId, open, onOpenChange, onClosed }: {
  orderId: string | null; open: boolean; onOpenChange: (o: boolean) => void; onClosed?: () => void;
}) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [menu, setMenu] = useState<MenuOption[]>([]);
  const [openOrders, setOpenOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [payMethod, setPayMethod] = useState<string>("card");
  const [payAmount, setPayAmount] = useState("");
  const [payTip, setPayTip] = useState("");
  const [payRef, setPayRef] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [addMenuId, setAddMenuId] = useState<string>("");
  const [addQty, setAddQty] = useState(1);
  const [mergeTarget, setMergeTarget] = useState<string>("");

  const currency = restaurant?.currency ?? "USD";

  const load = useCallback(async () => {
    if (!orderId) return;
    const [o, it, pm] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("payments").select("*").eq("order_id", orderId).order("created_at"),
    ]);
    if (o.data) {
      setOrder(o.data as OrderRow);
      setDiscountInput(((o.data.discount_cents ?? 0) / 100).toFixed(2));
      setTipInput(((o.data.tip_cents ?? 0) / 100).toFixed(2));
      setNotesInput(o.data.notes ?? "");
      const [r, t, m, oo] = await Promise.all([
        supabase.from("restaurants").select("id,name,currency,tax_pct,service_pct,address,phone").eq("id", o.data.restaurant_id).maybeSingle(),
        supabase.from("dining_tables").select("id,label").eq("restaurant_id", o.data.restaurant_id),
        supabase.from("menu_items").select("id,name,price_cents").eq("restaurant_id", o.data.restaurant_id).eq("is_available", true).order("name"),
        supabase.from("orders").select("*").eq("restaurant_id", o.data.restaurant_id).not("status", "in", "(paid,closed,cancelled)").neq("id", orderId),
      ]);
      if (r.data) setRestaurant(r.data as Restaurant);
      setTables((t.data as TableRow[]) ?? []);
      setMenu((m.data as MenuOption[]) ?? []);
      setOpenOrders((oo.data as OrderRow[]) ?? []);
    }
    setItems((it.data as ItemRow[]) ?? []);
    setPayments((pm.data as PayRow[]) ?? []);
  }, [orderId]);

  useEffect(() => { if (open && orderId) load(); }, [open, orderId, load]);

  // Realtime for this order
  useEffect(() => {
    if (!open || !orderId) return;
    const ch = supabase.channel(`bill_${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `order_id=eq.${orderId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, orderId, load]);

  const paidCents = useMemo(() => payments.reduce((s, p) => s + p.amount_cents, 0), [payments]);
  const tipsCents = useMemo(() => payments.reduce((s, p) => s + p.tip_cents, 0), [payments]);
  const dueCents = Math.max((order?.total_cents ?? 0) - paidCents, 0);
  const tableLabel = order?.table_id ? tables.find((t) => t.id === order.table_id)?.label : undefined;

  const call = async <T,>(fn: () => Promise<T>, msg?: string) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); return r; }
    catch (e: unknown) { const m = e instanceof Error ? e.message : String(e); toast.error(m); throw e; }
    finally { setBusy(false); }
  };

  const addItem = async () => {
    if (!orderId || !addMenuId) return;
    await call(async () => {
      const { error } = await supabase.rpc("staff_add_order_item", { p_order_id: orderId, p_menu_item_id: addMenuId, p_quantity: addQty, p_notes: "" });
      if (error) throw new Error(error.message);
      setAddMenuId(""); setAddQty(1);
    }, "Item added");
  };
  const updateQty = async (id: string, qty: number) => {
    if (qty < 1) return;
    await call(async () => {
      const { error } = await supabase.rpc("staff_update_order_item", { p_item_id: id, p_quantity: qty, p_notes: "" });
      if (error) throw new Error(error.message);
    });
  };
  const removeItem = async (id: string) => {
    await call(async () => {
      const { error } = await supabase.rpc("staff_remove_order_item", { p_item_id: id });
      if (error) throw new Error(error.message);
    }, "Item removed");
  };
  const applyCharges = async () => {
    if (!orderId) return;
    await call(async () => {
      const { error } = await supabase.rpc("staff_set_order_charges", {
        p_order_id: orderId, p_discount_cents: toCents(discountInput || "0"),
        p_tip_cents: toCents(tipInput || "0"), p_notes: notesInput,
      });
      if (error) throw new Error(error.message);
    }, "Charges updated");
  };
  const applyCoupon = async () => {
    if (!orderId || !couponInput.trim()) return;
    await call(async () => {
      const { data, error } = await supabase.rpc("staff_apply_coupon", { p_order_id: orderId, p_code: couponInput.trim() });
      if (error) throw new Error(error.message);
      const disc = (data as { discount_cents: number } | null)?.discount_cents ?? 0;
      setDiscountInput((disc / 100).toFixed(2)); setCouponInput("");
    }, "Coupon applied");
  };
  const addPayment = async (amt?: number) => {
    if (!orderId) return;
    const amount = amt ?? toCents(payAmount || "0");
    if (amount <= 0) { toast.error("Enter amount"); return; }
    await call(async () => {
      const { error } = await supabase.rpc("staff_add_payment", {
        p_order_id: orderId, p_method: payMethod, p_amount_cents: amount,
        p_tip_cents: toCents(payTip || "0"), p_txn_ref: payRef,
      });
      if (error) throw new Error(error.message);
      setPayAmount(""); setPayTip(""); setPayRef("");
    }, "Payment recorded");
  };
  const voidPayment = async (id: string) => {
    await call(async () => {
      const { error } = await supabase.rpc("staff_void_payment", { p_payment_id: id });
      if (error) throw new Error(error.message);
    }, "Payment voided");
  };
  const closeAndPrint = async () => {
    if (!orderId || !order) return;
    if (dueCents > 0) { toast.error(`Still due: ${formatCents(dueCents, currency)}`); return; }
    await call(async () => {
      const { data, error } = await supabase.rpc("staff_close_order", { p_order_id: orderId });
      if (error) throw new Error(error.message);
      const inv = (data as { invoice_no: string } | null)?.invoice_no;
      toast.success(`Invoice ${inv ?? ""} issued`);
      await load();
      // print
      setTimeout(() => downloadPDF(true), 100);
      onClosed?.();
    });
  };
  const downloadPDF = (autoprint = false) => {
    if (!order || !restaurant) return;
    const doc = generateReceiptPDF({ restaurant, order, items, payments, tableLabel });
    if (autoprint) doc.autoPrint();
    doc.save(`receipt-${order.invoice_no ?? order.id.slice(0, 8)}.pdf`);
  };
  const splitSelected = async () => {
    if (!orderId || selectedItemIds.size === 0) return;
    await call(async () => {
      const { error } = await supabase.rpc("staff_split_order", { p_order_id: orderId, p_item_ids: Array.from(selectedItemIds) });
      if (error) throw new Error(error.message);
      setSelectedItemIds(new Set());
    }, "Order split");
  };
  const splitEqual = async (ways: number) => {
    if (!order || ways < 2) return;
    const each = Math.floor(dueCents / ways);
    for (let i = 0; i < ways; i++) {
      const amt = i === ways - 1 ? dueCents - each * (ways - 1) : each;
      await addPayment(amt);
    }
  };
  const mergeInto = async () => {
    if (!orderId || !mergeTarget) return;
    await call(async () => {
      const { error } = await supabase.rpc("staff_merge_orders", { p_source_id: orderId, p_target_id: mergeTarget });
      if (error) throw new Error(error.message);
      toast.success("Orders merged");
      onOpenChange(false);
      onClosed?.();
    });
  };

  const toggleSel = (id: string) => setSelectedItemIds((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  if (!open || !orderId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bill · {order?.guest_name ?? "Guest"}{tableLabel && ` · ${tableLabel}`}
            {order?.invoice_no && <Badge variant="secondary">{order.invoice_no}</Badge>}
            {order?.status && <Badge>{order.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {!order ? <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
        <Tabs defaultValue="items">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="charges">Charges</TabsTrigger>
            <TabsTrigger value="pay">Payment</TabsTrigger>
            <TabsTrigger value="ops">Split / Merge</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-3">
            <div className="rounded-lg border border-white/10">
              {items.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No items</div> :
                items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 border-b border-white/5 p-2 last:border-0">
                    <Checkbox checked={selectedItemIds.has(it.id)} onCheckedChange={() => toggleSel(it.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.name_snapshot}</div>
                      <div className="text-xs text-muted-foreground">{formatCents(it.unit_price_cents, currency)} · {it.status}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" disabled={busy || order.status === "paid"} onClick={() => updateQty(it.id, it.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                      <span className="w-6 text-center text-sm">{it.quantity}</span>
                      <Button size="icon" variant="ghost" disabled={busy || order.status === "paid"} onClick={() => updateQty(it.id, it.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="w-20 text-right text-sm">{formatCents(it.unit_price_cents * it.quantity, currency)}</div>
                    <Button size="icon" variant="ghost" disabled={busy || order.status === "paid"} onClick={() => removeItem(it.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                ))}
            </div>
            {order.status !== "paid" && (
              <div className="flex gap-2">
                <Select value={addMenuId} onValueChange={setAddMenuId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add menu item…" /></SelectTrigger>
                  <SelectContent>{menu.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {formatCents(m.price_cents, currency)}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min={1} max={50} value={addQty} onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-20" />
                <Button onClick={addItem} disabled={busy || !addMenuId}><Plus className="mr-1 h-4 w-4" />Add</Button>
              </div>
            )}
            <TotalsPanel order={order} currency={currency} />
          </TabsContent>

          <TabsContent value="charges" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Discount ({currency})</Label><Input type="number" step="0.01" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} /></div>
              <div><Label>Tip ({currency})</Label><Input type="number" step="0.01" value={tipInput} onChange={(e) => setTipInput(e.target.value)} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={notesInput} onChange={(e) => setNotesInput(e.target.value)} rows={2} maxLength={500} /></div>
            <Button onClick={applyCharges} disabled={busy || order.status === "paid"}>Apply</Button>
            <Separator />
            <div>
              <Label>Coupon code</Label>
              <div className="flex gap-2 mt-1">
                <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="WELCOME10" />
                <Button onClick={applyCoupon} disabled={busy || !couponInput.trim() || order.status === "paid"}><Tag className="mr-1 h-4 w-4" />Apply</Button>
              </div>
              {order.coupon_code && <div className="mt-2 text-xs text-emerald-400">Applied: {order.coupon_code}</div>}
            </div>
            <TotalsPanel order={order} currency={currency} />
          </TabsContent>

          <TabsContent value="pay" className="space-y-3">
            <TotalsPanel order={order} currency={currency} paid={paidCents} due={dueCents} />
            {order.status !== "paid" && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  <Input type="number" step="0.01" placeholder="Tip" value={payTip} onChange={(e) => setPayTip(e.target.value)} />
                  <Input placeholder="Ref#" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPayAmount((dueCents / 100).toFixed(2))}>Pay due ({formatCents(dueCents, currency)})</Button>
                  <Button size="sm" variant="outline" onClick={() => splitEqual(2)} disabled={dueCents <= 0}>Split 2-way</Button>
                  <Button size="sm" variant="outline" onClick={() => splitEqual(3)} disabled={dueCents <= 0}>Split 3-way</Button>
                  <Button size="sm" variant="outline" onClick={() => splitEqual(4)} disabled={dueCents <= 0}>Split 4-way</Button>
                  <Button onClick={() => addPayment()} disabled={busy}><CreditCard className="mr-1 h-4 w-4" />Record</Button>
                </div>
              </>
            )}
            {payments.length > 0 && (
              <div className="rounded-lg border border-white/10">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-white/5 p-2 text-sm last:border-0">
                    <div><Badge variant="outline">{p.method.toUpperCase()}</Badge> {p.txn_ref && <span className="ml-2 text-xs text-muted-foreground">{p.txn_ref}</span>}</div>
                    <div className="flex items-center gap-3">
                      <span>{formatCents(p.amount_cents, currency)}{p.tip_cents > 0 && ` + ${formatCents(p.tip_cents, currency)} tip`}</span>
                      {order.status !== "paid" && <Button size="icon" variant="ghost" onClick={() => voidPayment(p.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ops" className="space-y-4">
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 text-sm font-semibold">Split order by item</div>
              <div className="text-xs text-muted-foreground mb-2">Select items in the Items tab, then move them to a new ticket.</div>
              <Button onClick={splitSelected} disabled={busy || selectedItemIds.size === 0 || order.status === "paid"}>
                <Split className="mr-1 h-4 w-4" />Split {selectedItemIds.size} item(s) to new ticket
              </Button>
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 text-sm font-semibold">Merge into another open order</div>
              <div className="flex gap-2">
                <Select value={mergeTarget} onValueChange={setMergeTarget}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose target ticket…" /></SelectTrigger>
                  <SelectContent>{openOrders.map((o) => <SelectItem key={o.id} value={o.id}>{o.guest_name ?? "Guest"} · {formatCents(o.total_cents, currency)}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="destructive" onClick={mergeInto} disabled={busy || !mergeTarget || order.status === "paid"}>
                  <Merge className="mr-1 h-4 w-4" />Merge
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">This ticket will be deleted; its items and payments move to the target.</div>
            </div>
          </TabsContent>
        </Tabs>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadPDF(false)} disabled={!order}><Download className="mr-1 h-4 w-4" />PDF</Button>
          <Button variant="outline" onClick={() => downloadPDF(true)} disabled={!order}><Printer className="mr-1 h-4 w-4" />Print</Button>
          {order && order.status !== "paid" && (
            <Button onClick={closeAndPrint} disabled={busy || dueCents > 0}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Close & issue invoice
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TotalsPanel({ order, currency, paid, due }: { order: OrderRow; currency: string; paid?: number; due?: number }) {
  const R = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold" : ""}`}><span className="text-muted-foreground">{l}</span><span>{v}</span></div>
  );
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-1">
      <R l="Subtotal" v={formatCents(order.subtotal_cents, currency)} />
      {order.discount_cents > 0 && <R l={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`} v={"-" + formatCents(order.discount_cents, currency)} />}
      {order.service_charge_cents > 0 && <R l="Service" v={formatCents(order.service_charge_cents, currency)} />}
      {order.tax_cents > 0 && <R l="Tax" v={formatCents(order.tax_cents, currency)} />}
      {order.tip_cents > 0 && <R l="Tip" v={formatCents(order.tip_cents, currency)} />}
      <Separator className="my-1" />
      <R l="Total" v={formatCents(order.total_cents, currency)} bold />
      {paid !== undefined && <R l="Paid" v={formatCents(paid, currency)} />}
      {due !== undefined && due > 0 && <R l="Due" v={formatCents(due, currency)} bold />}
    </div>
  );
}
