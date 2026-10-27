import { db } from "@/integrations/external/client";
import {
  initialState,
  type AppState,
  type Category,
  type Housing,
  type Recurring,
  type Transaction,
} from "./types";
import { currentMonth } from "./format";
import {
  type CategoryRow,
  type ProfileRow,
  type RecurringRow,
  type TransactionRow,
  categoryPayload,
  num,
  recurringPayload,
  toCategory,
  toRecurring,
  toTransaction,
  transactionPayload,
} from "./righeDb";

/* ---------- lettura ---------- */

/** Righe per blocco: Supabase non ne restituisce più di 1000 per richiesta. */
const BLOCCO = 1000;

/**
 * Tutte le righe dell'utente in una tabella, lette a blocchi da 1000.
 *
 * Prima si faceva una sola richiesta, e Supabase si ferma a 1000 righe:
 * superata quella soglia le spese più vecchie sparivano dall'app senza
 * nessun avviso. L'ordine per id serve a non saltare né ripetere righe fra
 * un blocco e l'altro.
 */
async function tutteLeRighe<T>(tabella: string, colonne: string, userId: string): Promise<T[]> {
  const righe: T[] = [];
  for (let da = 0; ; da += BLOCCO) {
    const { data, error } = await db
      .from(tabella)
      .select(colonne)
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(da, da + BLOCCO - 1);
    if (error) throw error;
    const blocco = (data ?? []) as T[];
    righe.push(...blocco);
    if (blocco.length < BLOCCO) return righe;
  }
}

export async function loadRemoteState(userId: string): Promise<AppState> {
  const [profileRes, catRows, txRows, recRows, tipRes] = await Promise.all([
    db.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    tutteLeRighe<CategoryRow>("categories", "*", userId),
    tutteLeRighe<TransactionRow>("transactions", "*", userId),
    tutteLeRighe<RecurringRow>("recurring", "*", userId),
    // Poche righe per utente e senza colonna id certa: basta una richiesta.
    db.from("dismissed_insights").select("key").eq("user_id", userId),
  ]);

  const firstError = profileRes.error ?? tipRes.error;
  if (firstError) throw firstError;

  const profile = profileRes.data as ProfileRow | null;
  const categorie = catRows.map(toCategory).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const transazioni = txRows.map(toTransaction);
  const ricorrenti = recRows.map(toRecurring);
  const consigliIgnorati = ((tipRes.data ?? []) as { key: string }[]).map((r) => r.key);

  const base = initialState();
  return {
    categorie,
    transazioni,
    ricorrenti,
    consigliIgnorati,
    profilo: {
      ...base.profilo,
      nome: profile?.name ?? "",
      onboardingCompletato: profile?.setup_complete ?? false,
      abitazione: (profile?.housing as Housing | null) ?? "affitto",
      auto: (profile?.has_car ?? "si") === "si",
      persone: profile?.household_size ?? 1,
      budgetTotale: categorie.reduce((a, c) => a + c.budget, 0),
      primoUtilizzo: profile?.created_at ?? new Date().toISOString(),
    },
  };
}

/* ---------- scrittura: sincronizza la differenza tra due stati ---------- */

function byId<T extends { id: string }>(arr: T[]) {
  return new Map(arr.map((x) => [x.id, x]));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function persistDiff(prev: AppState, next: AppState, userId: string) {
  const ops: PromiseLike<unknown>[] = [];
  const fail = (e: { message?: string } | null) => {
    if (e) throw e;
  };

  // profilo
  const p = prev.profilo;
  const n = next.profilo;
  if (
    p.nome !== n.nome ||
    p.onboardingCompletato !== n.onboardingCompletato ||
    p.abitazione !== n.abitazione ||
    p.auto !== n.auto ||
    p.persone !== n.persone
  ) {
    ops.push(
      db
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            name: n.nome,
            setup_complete: n.onboardingCompletato,
            housing: n.abitazione,
            has_car: n.auto ? "si" : "no",
            household_size: n.persone,
          },
          { onConflict: "user_id" },
        )
        .then(({ error }) => fail(error)),
    );
  }

  // categorie
  const prevCats = byId(prev.categorie);
  const nextCats = byId(next.categorie);
  const catsUpsert = next.categorie.filter((c) => !same(prevCats.get(c.id), c));
  const catsDelete = prev.categorie.filter((c) => !nextCats.has(c.id)).map((c) => c.id);
  if (catsUpsert.length) {
    ops.push(
      db
        .from("categories")
        .upsert(catsUpsert.map((c) => categoryPayload(c, userId)))
        .then(({ error }) => fail(error)),
    );
  }
  if (catsDelete.length) {
    ops.push(
      db
        .from("categories")
        .delete()
        .in("id", catsDelete)
        .then(({ error }) => fail(error)),
    );
  }

  // ricorrenti (prima delle transazioni per la FK recurring_id)
  const prevRec = byId(prev.ricorrenti);
  const nextRec = byId(next.ricorrenti);
  const recUpsert = next.ricorrenti.filter((r) => !same(prevRec.get(r.id), r));
  const recDelete = prev.ricorrenti.filter((r) => !nextRec.has(r.id)).map((r) => r.id);
  if (recUpsert.length) {
    ops.push(
      db
        .from("recurring")
        .upsert(recUpsert.map((r) => recurringPayload(r, userId)))
        .then(({ error }) => fail(error)),
    );
  }

  // transazioni
  const prevTx = byId(prev.transazioni);
  const nextTx = byId(next.transazioni);
  const txUpsert = next.transazioni.filter((t) => !same(prevTx.get(t.id), t));
  const txDelete = prev.transazioni.filter((t) => !nextTx.has(t.id)).map((t) => t.id);

  // consigli ignorati
  const tipAdd = next.consigliIgnorati.filter((k) => !prev.consigliIgnorati.includes(k));
  const tipRemove = prev.consigliIgnorati.filter((k) => !next.consigliIgnorati.includes(k));
  if (tipAdd.length) {
    ops.push(
      db
        .from("dismissed_insights")
        .insert(tipAdd.map((key) => ({ user_id: userId, key })))
        .then(({ error }) => fail(error)),
    );
  }
  if (tipRemove.length) {
    ops.push(
      db
        .from("dismissed_insights")
        .delete()
        .in("key", tipRemove)
        .then(({ error }) => fail(error)),
    );
  }

  await Promise.all(ops);

  if (txUpsert.length) {
    const { error } = await db
      .from("transactions")
      .upsert(txUpsert.map((t) => transactionPayload(t, userId)));
    fail(error);
  }
  if (txDelete.length) {
    const { error } = await db.from("transactions").delete().in("id", txDelete);
    fail(error);
  }
  if (recDelete.length) {
    const { error } = await db.from("recurring").delete().in("id", recDelete);
    fail(error);
  }
}

/* ---------- reset completo ---------- */

export async function wipeRemote(userId: string) {
  await db.from("transactions").delete().eq("user_id", userId);
  await db.from("recurring").delete().eq("user_id", userId);
  await db.from("categories").delete().eq("user_id", userId);
  await db.from("dismissed_insights").delete().eq("user_id", userId);
  await db.from("profiles").delete().eq("user_id", userId);
}
