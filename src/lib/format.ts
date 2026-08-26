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

// Colore delle barre spesa/budget: verde fisso fino al 50% del budget, poi
// gradiente continuo verde → giallo ocra (75%) → rosso (100%) nella metà
// restante. Colori OKLCH fissi, apposta SLEGATI dalle variabili del tema
// (--accent-lime/--warn/--danger sono usate anche altrove nell'interfaccia
// per scopi diversi, e in tema chiaro alcune erano state scurite per motivi
// di contrasto testo — riusarle qui produceva un giallo che virava al
// marrone in tema chiaro). Così restano identiche in tema scuro e chiaro, e
// l'interpolazione continua fa sì che anche una differenza piccola di
// percentuale (es. 5%) dia una tonalità leggermente diversa, invece dei tre
// "scalini" della versione precedente.
type OklchStop = { l: number; c: number; h: number };
const BUDGET_GREEN: OklchStop = { l: 0.74, c: 0.17, h: 148 };
const BUDGET_OCHER: OklchStop = { l: 0.79, c: 0.16, h: 85 };
const BUDGET_RED: OklchStop = { l: 0.62, c: 0.2, h: 25 };

function lerpStop(a: OklchStop, b: OklchStop, t: number): OklchStop {
  return {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

const toOklch = (s: OklchStop) => `oklch(${s.l.toFixed(3)} ${s.c.toFixed(3)} ${s.h.toFixed(1)})`;

export function barTone(percent: number) {
  if (percent <= 50) return toOklch(BUDGET_GREEN);
  if (percent > 100) return toOklch(BUDGET_RED);
  const p = Math.min(100, percent);
  const stop =
    p <= 75
      ? lerpStop(BUDGET_GREEN, BUDGET_OCHER, (p - 50) / 25)
      : lerpStop(BUDGET_OCHER, BUDGET_RED, (p - 75) / 25);
  return toOklch(stop);
}
