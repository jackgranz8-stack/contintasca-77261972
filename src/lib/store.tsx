import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  initialState,
  type AppState,
  type Category,
  type Recurring,
  type Transaction,
} from "./types";
import { currentMonth, monthKey, uid } from "./format";

const KEY = "conti-in-tasca-v1";

type Ctx = {
  state: AppState;
  loaded: boolean;
  update: (fn: (s: AppState) => AppState) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
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

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.profilo) return null;
    return { ...initialState(), ...parsed };
  } catch {
    return null;
  }
}

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
    });
    created++;
    return { ...r, ultimaGenerazione: mk };
  });
  return { next: { ...s, transazioni, ricorrenti }, created };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => initialState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = load();
    if (stored) {
      const { next, created } = runRecurring(stored);
      setState(next);
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
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota */
    }
  }, [state, loaded]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      loaded,
      update,
      addTransaction: (t) =>
        update((s) => ({ ...s, transazioni: [...s.transazioni, { ...t, id: uid() }] })),
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
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* noop */
        }
        setState(initialState());
      },
    }),
    [state, loaded, update],
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
