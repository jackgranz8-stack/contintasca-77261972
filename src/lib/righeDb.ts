import { type Category, type Recurring, type Transaction } from "./types";
import { currentMonth } from "./format";

/**
 * Conversione fra le righe del database (colonne in inglese) e il modello
 * dell'app. Sta in un file a sé, senza dipendenze dal client Supabase del
 * browser, perché la usa anche la Edge Function "assistente-vocale".
 */

/* ---------- mapping riga DB <-> modello app ---------- */

export type CategoryRow = {
  id: string;
  name: string | null;
  icon: string | null;
  color: string | null;
  budget: number | string | null;
};

export type TransactionRow = {
  id: string;
  category_id: string | null;
  amount: number | string | null;
  date: string;
  note: string | null;
  recurring_id: string | null;
};

export type RecurringRow = {
  id: string;
  category_id: string | null;
  name: string | null;
  amount: number | string | null;
  day: number | null;
  active: boolean | null;
  last_generated_month: string | null;
  // Colonne aggiunte con le cadenze personalizzate. Lette in modo tollerante
  // (vedi toRecurring): se il database non fosse ancora aggiornato, la
  // ricorrenza si comporta come una mensile classica invece di rompersi.
  cadence?: string | null;
  interval_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  last_generated_date?: string | null;
};

export type ProfileRow = {
  user_id: string;
  name: string | null;
  setup_complete: boolean | null;
  housing: string | null;
  has_car: string | null;
  household_size: number | null;
  created_at: string | null;
};

export const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    nome: r.name ?? "Senza nome",
    icona: r.icon ?? "wallet",
    colore: r.color ?? "#8CE562",
    budget: num(r.budget),
  };
}

export function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    importo: num(r.amount),
    categoria: r.category_id ?? "",
    data: (r.date ?? "").slice(0, 10),
    nota: r.note ?? "",
    ricorrenteId: r.recurring_id ?? null,
  };
}

export function toRecurring(r: RecurringRow): Recurring {
  const giorno = Math.min(28, Math.max(1, r.day ?? 1));
  return {
    id: r.id,
    nome: r.name ?? "Spesa",
    categoria: r.category_id ?? "",
    importo: num(r.amount),
    giorno,
    attiva: r.active ?? true,
    // Valori di ripiego pensati per le ricorrenze create prima delle cadenze
    // personalizzate: erano tutte "ogni mese al giorno indicato", quindi si
    // comportano esattamente come prima.
    cadenza: r.cadence === "settimane" ? "settimane" : "mesi",
    intervallo: Math.max(1, r.interval_count ?? 1),
    inizio: r.start_date ?? `${currentMonth()}-${String(giorno).padStart(2, "0")}`,
    fine: r.end_date ?? null,
    ...(r.last_generated_date ? { ultimaData: r.last_generated_date } : {}),
    ...(r.last_generated_month ? { ultimaGenerazione: r.last_generated_month } : {}),
  };
}

export const categoryPayload = (c: Category, userId: string) => ({
  id: c.id,
  user_id: userId,
  name: c.nome,
  icon: c.icona,
  color: c.colore,
  budget: c.budget,
});

export const transactionPayload = (t: Transaction, userId: string) => ({
  id: t.id,
  user_id: userId,
  category_id: t.categoria || null,
  amount: t.importo,
  date: t.data,
  note: t.nota ?? "",
  recurring_id: t.ricorrenteId ?? null,
});

export const recurringPayload = (r: Recurring, userId: string) => ({
  id: r.id,
  user_id: userId,
  category_id: r.categoria || null,
  name: r.nome,
  amount: r.importo,
  day: r.giorno,
  active: r.attiva,
  cadence: r.cadenza,
  interval_count: r.intervallo,
  start_date: r.inizio,
  end_date: r.fine ?? null,
  last_generated_date: r.ultimaData ?? null,
  // Tenuto aggiornato al mese dell'ultima occorrenza per non lasciare la
  // colonna vecchia in uno stato incoerente con la nuova.
  last_generated_month: r.ultimaData ? r.ultimaData.slice(0, 7) : (r.ultimaGenerazione ?? null),
});
