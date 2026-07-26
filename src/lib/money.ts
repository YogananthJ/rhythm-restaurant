export const formatCents = (c: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((c || 0) / 100);

export const toCents = (n: number | string) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
};
