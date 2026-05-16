export const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export const AUD2 = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2,
});

export function money(n: number, decimals = false) {
  if (!isFinite(n)) return "—";
  return (decimals ? AUD2 : AUD).format(n);
}

export function pct(n: number, decimals = 1) {
  if (!isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

export function shortDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}
