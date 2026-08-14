import { db } from "@/integrations/external/client";
import { initialState, type AppState, type Category, type Housing, type Recurring, type Transaction } from "./types";

/* ---------- mapping riga DB <-> modello app ---------- */

type CategoryRow = {
  id: string;
  name: string | null;
  icon: string | null;
  color: string | null;
  budget: number | string | null;
};

type TransactionRow = {
  id: string;
  category_id: string | null;
  amount: number | string | null;
  date: string;
  note: string | null;
  recurring_id: string | null;
};

type RecurringRow = {
  id: string;
  category_id: string | null;
  name: string | null;
  amount: number | string | null;
  day: number | null;
  active: boolean | null;
  last_generated_month: string | null;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
  setup_complete: boolean | null;
  housing: string | null;
  has_car: string | null;
  household_size: number | null;
  created_at: string | null;
};

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    nome: r.name ?? "Senza nome",
    icona: r.icon ?? "wallet",
    colore: r.color ?? "#8CE562",
    budget: num(r.budget),
  };
}

function toTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    importo: num(r.amount),
    categoria: r.category_id ?? "",
    data: (r.date ?? "").slice(0, 10),
    nota: r.note ?? "",
    ricorrenteId: r.recurring_id ?? null,
  };
}

function toRecurring(r: RecurringRow): Recurring {
  return {
    id: r.id,
    nome: r.name ?? "Spesa",
    categoria: r.category_id ?? "",
    importo: num(r.amount),
    giorno: r.day ?? 1,
    attiva: r.active ?? true,
    ...(r.last_generated_month ? { ultimaGenerazione: r.last_generated_month } : {}),
  };
}

const categoryPayload = (c: Category, userId: string) => ({
  id: c.id,
  user_id: userId,
  name: c.nome,
  icon: c.icona,
  color: c.colore,
  budget: c.budget,
});

const transactionPayload = (t: Transaction, userId: string) => ({
  id: t.id,
  user_id: userId,
  category_id: t.categoria || null,
  amount: t.importo,
  date: t.data,
  note: t.nota ?? "",
  recurring_id: t.ricorrenteId ?? null,
});

const recurringPayload = (r: Recurring, userId: string) => ({
  id: r.id,
  user_id: userId,
  category_id: r.categoria || null,
  name: r.nome,
  amount: r.importo,
  day: r.giorno,
  active: r.attiva,
  last_generated_month: r.ultimaGenerazione ?? null,
});

/* ---------- lettura ---------- */

export async function loadRemoteState(userId: string): Promise<AppState> {
  const [profileRes, catRes, txRes, recRes, tipRes] = await Promise.all([
    db.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("categories").select("*").eq("user_id", userId),
    db.from("transactions").select("*").eq("user_id", userId),
    db.from("recurring").select("*").eq("user_id", userId),
    db.from("dismissed_insights").select("key").eq("user_id", userId),
  ]);

  const firstError =
    profileRes.error ?? catRes.error ?? txRes.error ?? recRes.error ?? tipRes.error;
  if (firstError) throw firstError;

  const profile = profileRes.data as ProfileRow | null;
  const categorie = ((catRes.data ?? []) as CategoryRow[])
    .map(toCategory)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const transazioni = ((txRes.data ?? []) as TransactionRow[]).map(toTransaction);
  const ricorrenti = ((recRes.data ?? []) as RecurringRow[]).map(toRecurring);
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
      db.from("categories").delete().in("id", catsDelete).then(({ error }) => fail(error)),
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
      db.from("dismissed_insights").delete().in("key", tipRemove).then(({ error }) => fail(error)),
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
