import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { db } from "@/integrations/external/client";
import { loadRemoteState, persistDiff, wipeRemote } from "./remote";
import {
  initialState,
  type AppState,
  type Category,
  type Recurring,
  type Transaction,
} from "./types";
import { currentMonth, monthKey, uid } from "./format";

type Account = { id: string; email: string | null } | null;

type Ctx = {
  state: AppState;
  loaded: boolean;
  account: Account;
  syncing: boolean;
  signOut: () => Promise<void>;
  update: (fn: (s: AppState) => AppState) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (c: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;
  addRecurring: (r: Omit<Recurring, "id">) => void;
  updateRecurring: (id: string, patch: Partial<Recurring>) => void;
  deleteRecurring: (id: string) => void;
  dismissTip: (id: string) => void;
  reset: () => void;
};

const AppContext = createContext<Ctx | null>(null);

/** Genera le transazioni delle spese ricorrenti attive già scadute nel mese corrente. */
function runRecurring(s: AppState): { next: AppState; created: number } {
  const now = new Date();
  const mk = currentMonth();
  const day = now.getDate();
  let created = 0;
  const transazioni = [...s.transazioni];
  const ricorrenti = s.ricorrenti.map((r) => {
    if (!r.attiva || r.giorno > day || r.ultimaGenerazione === mk) return r;
    if (!s.categorie.some((c) => c.id === r.categoria)) return r;
    transazioni.push({
      id: uid(),
      importo: r.importo,
      categoria: r.categoria,
      data: `${mk}-${String(r.giorno).padStart(2, "0")}`,
      nota: r.nome,
      ricorrenteId: r.id,
    });
    created++;
    return { ...r, ultimaGenerazione: mk };
  });
  return { next: { ...s, transazioni, ricorrenti }, created };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => initialState());
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<Account>(null);
  const [syncing, setSyncing] = useState(false);
  const accountRef = useRef<Account>(null);
  const baseline = useRef<AppState | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const loadFor = useCallback(async (userId: string) => {
    setSyncing(true);
    try {
      const remote = await loadRemoteState(userId);
      const { next, created } = runRecurring(remote);
      baseline.current = remote;
      setState(next);
      setLoaded(true);
      if (created > 0) {
        setTimeout(
          () =>
            toast.success(
              created === 1
                ? "1 spesa ricorrente registrata"
                : `${created} spese ricorrenti registrate`,
            ),
          400,
        );
      }
    } catch {
      baseline.current = null;
      setState(initialState());
      setLoaded(true);
      toast.error("Non riesco a leggere i tuoi dati, riprova più tardi");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void db.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (user) {
        const acc = { id: user.id, email: user.email ?? null };
        accountRef.current = acc;
        setAccount(acc);
        void loadFor(user.id);
      } else {
        baseline.current = null;
        setState(initialState());
        setLoaded(true);
      }
    });

    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const user = session?.user;
      if (user) {
        if (accountRef.current?.id === user.id) return;
        const acc = { id: user.id, email: user.email ?? null };
        accountRef.current = acc;
        setAccount(acc);
        setLoaded(false);
        void loadFor(user.id);
      } else {
        accountRef.current = null;
        baseline.current = null;
        setAccount(null);
        setState(initialState());
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadFor]);

  // Ogni modifica dello stato viene sincronizzata come differenza sulle tabelle.
  useEffect(() => {
    const acc = accountRef.current;
    const prev = baseline.current;
    if (!loaded || !acc || !prev || prev === state) return;
    baseline.current = state;
    setSyncing(true);
    queue.current = queue.current
      .then(() => persistDiff(prev, state, acc.id))
      .catch(() => {
        toast.error("Salvataggio non riuscito, controlla la connessione");
      })
      .finally(() => setSyncing(false));
  }, [state, loaded]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const signOut = useCallback(async () => {
    await db.auth.signOut();
    accountRef.current = null;
    baseline.current = null;
    setAccount(null);
    setState(initialState());
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      loaded,
      account,
      syncing,
      signOut,
      update,
      addTransaction: (t) =>
        update((s) => ({ ...s, transazioni: [...s.transazioni, { ...t, id: uid() }] })),
      updateTransaction: (id, patch) =>
        update((s) => ({
          ...s,
          transazioni: s.transazioni.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTransaction: (id) =>
        update((s) => ({ ...s, transazioni: s.transazioni.filter((t) => t.id !== id) })),
      addCategory: (c) => {
        const cat: Category = { ...c, id: uid() };
        update((s) => ({ ...s, categorie: [...s.categorie, cat] }));
        return cat;
      },
      updateCategory: (id, patch) =>
        update((s) => ({
          ...s,
          categorie: s.categorie.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCategory: (id) => {
        const used =
          state.transazioni.some((t) => t.categoria === id) ||
          state.ricorrenti.some((r) => r.categoria === id);
        if (used) return false;
        update((s) => ({ ...s, categorie: s.categorie.filter((c) => c.id !== id) }));
        return true;
      },
      addRecurring: (r) =>
        update((s) => ({ ...s, ricorrenti: [...s.ricorrenti, { ...r, id: uid() }] })),
      updateRecurring: (id, patch) =>
        update((s) => ({
          ...s,
          ricorrenti: s.ricorrenti.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      deleteRecurring: (id) =>
        update((s) => ({ ...s, ricorrenti: s.ricorrenti.filter((r) => r.id !== id) })),
      dismissTip: (id) =>
        update((s) => ({ ...s, consigliIgnorati: [...s.consigliIgnorati, id] })),
      reset: () => {
        const acc = accountRef.current;
        if (acc) {
          setSyncing(true);
          queue.current = queue.current
            .then(() => wipeRemote(acc.id))
            .catch(() => {
              toast.error("Reimpostazione non riuscita");
            })
            .finally(() => setSyncing(false));
        }
        baseline.current = initialState();
        setState(initialState());
      },
    }),
    [state, loaded, account, syncing, signOut, update],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve essere usato dentro AppProvider");
  return ctx;
}

/* ---------- selettori ---------- */

export function txInMonth(txs: Transaction[], mk: string | "all") {
  if (mk === "all") return txs;
  return txs.filter((t) => monthKey(t.data) === mk);
}

export function sum(txs: Transaction[]) {
  return txs.reduce((a, t) => a + t.importo, 0);
}

export function totalsByCategory(txs: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of txs) map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.importo);
  return map;
}
