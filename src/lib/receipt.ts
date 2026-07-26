import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCents } from "./money";

type Restaurant = {
  name: string;
  address?: string | null;
  phone?: string | null;
  currency?: string | null;
};

type Item = { name_snapshot: string; quantity: number; unit_price_cents: number };
type Payment = { method: string; amount_cents: number; tip_cents: number; txn_ref: string | null; created_at: string };

type Order = {
  id: string;
  invoice_no: string | null;
  guest_name: string | null;
  created_at: string;
  closed_at: string | null;
  subtotal_cents: number;
  discount_cents: number;
  service_charge_cents: number;
  tax_cents: number;
  tip_cents: number;
  total_cents: number;
  coupon_code: string | null;
  notes: string | null;
  status: string;
};

export function generateReceiptPDF(opts: {
  restaurant: Restaurant;
  order: Order;
  items: Item[];
  payments: Payment[];
  tableLabel?: string;
}) {
  const { restaurant, order, items, payments, tableLabel } = opts;
  const currency = restaurant.currency || "USD";
  const doc = new jsPDF({ unit: "pt", format: "a5" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(restaurant.name, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 56;
  if (restaurant.address) { doc.text(restaurant.address, 40, y); y += 12; }
  if (restaurant.phone) { doc.text(restaurant.phone, 40, y); y += 12; }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 40, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 20;
  doc.text(`No: ${order.invoice_no ?? "(draft)"}`, 40, y);
  doc.text(`Date: ${new Date(order.closed_at ?? order.created_at).toLocaleString()}`, 40, y + 12);
  if (tableLabel) doc.text(`Table: ${tableLabel}`, 40, y + 24);
  doc.text(`Guest: ${order.guest_name ?? "Guest"}`, 40, y + 36);

  autoTable(doc, {
    startY: y + 52,
    head: [["Item", "Qty", "Price", "Total"]],
    body: items.map((it) => [
      it.name_snapshot,
      String(it.quantity),
      formatCents(it.unit_price_cents, currency),
      formatCents(it.unit_price_cents * it.quantity, currency),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  // @ts-expect-error autoTable augments doc at runtime
  const afterY: number = doc.lastAutoTable?.finalY ?? y + 60;
  const rightX = 260;
  let ty = afterY + 20;
  const row = (label: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, rightX, ty);
    doc.text(val, 360, ty, { align: "right" });
    ty += 14;
  };
  row("Subtotal", formatCents(order.subtotal_cents, currency));
  if (order.discount_cents) row(`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, "-" + formatCents(order.discount_cents, currency));
  if (order.service_charge_cents) row("Service", formatCents(order.service_charge_cents, currency));
  if (order.tax_cents) row("Tax", formatCents(order.tax_cents, currency));
  if (order.tip_cents) row("Tip", formatCents(order.tip_cents, currency));
  row("TOTAL", formatCents(order.total_cents, currency), true);

  if (payments.length) {
    ty += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Payments", 40, ty);
    doc.setFont("helvetica", "normal");
    ty += 12;
    payments.forEach((p) => {
      doc.text(`${p.method.toUpperCase()}${p.txn_ref ? ` · ${p.txn_ref}` : ""}`, 40, ty);
      doc.text(formatCents(p.amount_cents + p.tip_cents, currency), 200, ty, { align: "right" });
      ty += 12;
    });
  }

  if (order.notes) {
    ty += 8;
    doc.setFont("helvetica", "italic");
    doc.text(`Note: ${order.notes}`, 40, ty, { maxWidth: 320 });
  }

  ty += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Thank you for dining with us.", 40, ty);

  return doc;
}
