export const MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

/** UUID v4: gli id sono chiavi primarie uuid sul database. */
export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** YYYY-MM of a date */
export function monthKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth() {
  return monthKey(new Date());
}

export function monthLabel(key: string, short = false) {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const name = MONTHS[(m ?? 1) - 1] ?? "";
  return short ? name.slice(0, 3) : `${name} ${y}`;
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function lastMonths(n: number, from = currentMonth()) {
  return Array.from({ length: n }, (_, i) => shiftMonth(from, -(n - 1 - i)));
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function eur(n: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${(MONTHS[d.getMonth()] ?? "").slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || uid()
  );
}

export function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(999, (part / total) * 100);
}

export function barTone(percent: number) {
  if (percent < 70) return "var(--accent-lime)";
  if (percent <= 100) return "var(--warn)";
  return "var(--danger)";
}
