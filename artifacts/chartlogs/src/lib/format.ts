export function formatMoney(amount: number | null | undefined, currency: string = "USD"): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    signDisplay: "always",
  }).format(amount);
}

export function formatPips(pips: number | null | undefined): string {
  if (pips == null) return "0.0";
  return `${pips > 0 ? "+" : ""}${pips.toFixed(1)}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function cnClass(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
