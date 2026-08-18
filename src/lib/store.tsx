import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  loadError: boolean;
  retryLoad: () => void;
  account: Account;
  syncing: boolean;
  offlinePending: boolean;
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
  const [loadError, setLoadError] = useState(false);
  const [account, setAccount] = useState<Account>(null);
  const [syncing, setSyncing] = useState(false);
  const [offlinePending, setOfflinePending] = useState(false);
  const accountRef = useRef<Account>(null);
  // baseline = ultimo stato confermato come salvato con successo sul database.
  const baseline = useRef<AppState | null>(null);
  // pending = stato più recente non ancora confermato, presente solo mentre si è offline.
  const pending = useRef<AppState | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const loadFor = useCallback(async (userId: string) => {
    setSyncing(true);
    try {
      const remote = await loadRemoteState(userId);
      const { next, created } = runRecurring(remote);
      baseline.current = remote;
      setState(next);
      setLoaded(true);
      setLoadError(false);
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
      // Non tocchiamo lo stato locale né lo confermiamo come "vuoto": potrebbe
      // essere solo un problema di rete temporaneo, non un account senza dati.
      // baseline resta null, quindi nessuna sincronizzazione può scattare finché
      // non riusciamo a leggere davvero cosa c'è sul database.
      setLoaded(true);
      setLoadError(true);
    } finally {
      setSyncing(false);
    }
  }, []);

  const retryLoad = useCallback(() => {
    const acc = accountRef.current;
    if (acc) void loadFor(acc.id);
  }, [loadFor]);

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
        setLoadError(false);
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
        pending.current = null;
        setOfflinePending(false);
        setAccount(null);
        setState(initialState());
        setLoaded(true);
        setLoadError(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadFor]);

  // Ogni modifica dello stato viene sincronizzata come differenza sulle tabelle.
  // - Se il server rifiuta davvero la scrittura, si torna all'ultimo stato salvato:
  //   non deve mai sembrare salvato in locale qualcosa che sul database non c'è.
  // - Se invece manca solo la connessione, la modifica resta in locale in coda
  //   e riparte da sola non appena la rete torna disponibile (vedi effect sotto).
  useEffect(() => {
    const acc = accountRef.current;
    const prev = baseline.current;
    if (!loaded || !acc || !prev || prev === state) return;
    const attempted = state;
    setSyncing(true);
    queue.current = queue.current
      .then(() => persistDiff(prev, attempted, acc.id))
      .then(() => {
        baseline.current = attempted;
        pending.current = null;
        setOfflinePending(false);
      })
      .catch(() => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          pending.current = attempted;
          setOfflinePending(true);
        } else {
          setState(prev);
          toast.error("Connessione assente: la modifica non è stata salvata, riprova");
        }
      })
      .finally(() => setSyncing(false));
  }, [state, loaded]);

  // Non appena la connessione torna disponibile, riprova a salvare la modifica in coda.
  useEffect(() => {
    function retry() {
      const acc = accountRef.current;
      const prev = baseline.current;
      const attempted = pending.current;
      if (!acc || !prev || !attempted) return;
      setSyncing(true);
      queue.current = queue.current
        .then(() => persistDiff(prev, attempted, acc.id))
        .then(() => {
          baseline.current = attempted;
          pending.current = null;
          setOfflinePending(false);
          toast.success("Connessione tornata: modifiche sincronizzate");
        })
        .catch(() => {
          toast.error("Ancora offline: riproverò più tardi");
        })
        .finally(() => setSyncing(false));
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const signOut = useCallback(async () => {
    await db.auth.signOut();
    accountRef.current = null;
    baseline.current = null;
    pending.current = null;
    setOfflinePending(false);
    setAccount(null);
    setState(initialState());
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      loaded,
      loadError,
      retryLoad,
      account,
      syncing,
      offlinePending,
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
      dismissTip: (id) => update((s) => ({ ...s, consigliIgnorati: [...s.consigliIgnorati, id] })),
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
        pending.current = null;
        setOfflinePending(false);
        setState(initialState());
      },
    }),
    [state, loaded, loadError, retryLoad, account, syncing, offlinePending, signOut, update],
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
