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
import { saveOfflineCache, loadOfflineCache, clearOfflineCache } from "./offlineCache";
import {
  initialState,
  type AppState,
  type Category,
  type Recurring,
  type Transaction,
} from "./types";
import { currentMonth, monthKey, shiftMonth, uid } from "./format";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sameState = (a: AppState, b: AppState) => JSON.stringify(a) === JSON.stringify(b);

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
    if (!r.attiva || r.ultimaGenerazione === mk) return r;
    if (!s.categorie.some((c) => c.id === r.categoria)) return r;

    // Se l'app non viene aperta per un po', al riapertura recuperiamo anche i
    // mesi pienamente trascorsi da ultimaGenerazione (non solo quello attuale,
    // come prima), per non perdere silenziosamente le ricorrenti saltate. Un
    // tetto di 12 mesi evita un recupero assurdo in casi limite.
    const mesi: string[] = [];
    let cursore = r.ultimaGenerazione ? shiftMonth(r.ultimaGenerazione, 1) : mk;
    let guardia = 0;
    while (cursore < mk && guardia < 12) {
      mesi.push(cursore);
      cursore = shiftMonth(cursore, 1);
      guardia++;
    }
    if (r.giorno <= day) mesi.push(mk);
    if (mesi.length === 0) return r;

    for (const m of mesi) {
      transazioni.push({
        id: uid(),
        importo: r.importo,
        categoria: r.categoria,
        data: `${m}-${String(r.giorno).padStart(2, "0")}`,
        nota: r.nome,
        ricorrenteId: r.id,
      });
      created++;
    }
    return { ...r, ultimaGenerazione: mesi[mesi.length - 1] ?? mk };
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
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const remote = await loadRemoteState(userId);

        // C'era una modifica fatta offline mai arrivata al server (l'app è
        // stata chiusa del tutto prima che la rete tornasse, e ora si riapre
        // già connessa)? Senza questo controllo verrebbe sovrascritta in
        // silenzio dal solo stato del server, perdendola per sempre.
        const cached = loadOfflineCache(userId);
        const pendingEdits = cached && !sameState(cached.baseline, cached.state);

        if (pendingEdits) {
          baseline.current = remote;
          setState(cached.state);
          setLoaded(true);
          setLoadError(false);
          try {
            // Rete appena verificata funzionante: si prova a sincronizzare
            // subito, invece di aspettare un evento "online" che non
            // arriverà più (la connessione non sta "tornando", c'è già).
            await persistDiff(remote, cached.state, userId);
            baseline.current = cached.state;
            saveOfflineCache(userId, cached.state, cached.state);
            toast.success("Modifiche fatte offline sincronizzate");
          } catch {
            pending.current = cached.state;
            setOfflinePending(true);
            saveOfflineCache(userId, remote, cached.state);
          }
        } else {
          const { next, created } = runRecurring(remote);
          baseline.current = remote;
          setState(next);
          setLoaded(true);
          setLoadError(false);
          // Copia locale aggiornata: è quella che permetterà di aprire
          // l'app anche senza rete la prossima volta.
          saveOfflineCache(userId, remote, next);
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
        break;
      } catch {
        if (attempt < maxAttempts) {
          // Primo tentativo fallito subito dopo l'apertura: spesso è solo la rete
          // non ancora pronta (avvio a freddo). Riprova in silenzio prima di
          // disturbare l'utente con l'errore.
          await sleep(600 * attempt);
          continue;
        }
        // Nessuna rete raggiungibile dopo tre tentativi: invece di bloccarsi
        // sulla schermata di errore, si prova a ripartire dall'ultima copia
        // salvata sul telefono. Se conteneva modifiche non ancora
        // sincronizzate (l'app era stata chiusa offline con qualcosa in
        // sospeso), quelle restano in coda e ripartono da sole non appena
        // torna la rete (vedi l'effetto "online" più sotto).
        const cached = loadOfflineCache(userId);
        if (cached) {
          baseline.current = cached.baseline;
          setState(cached.state);
          setLoaded(true);
          setLoadError(false);
          if (!sameState(cached.baseline, cached.state)) {
            pending.current = cached.state;
            setOfflinePending(true);
          }
        } else {
          // Primo utilizzo mai riuscito su questo telefono: senza una copia
          // precedente non c'è nulla da mostrare, serve davvero la rete.
          setLoaded(true);
          setLoadError(true);
        }
      }
    }
    setSyncing(false);
  }, []);

  const retryLoad = useCallback(() => {
    const acc = accountRef.current;
    if (acc) void loadFor(acc.id);
  }, [loadFor]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // I link nelle email (conferma iscrizione, reset password) possono arrivare
      // con "?code=..." nell'URL (flusso PKCE di Supabase): va scambiato
      // esplicitamente con una sessione vera prima di controllare chi è
      // collegato, altrimenti il link non autentica mai l'utente. Il flusso
      // "implicito" più vecchio (token nell'hash dell'URL) resta gestito da
      // solo dal client Supabase, qui serve occuparsi solo del caso "code".
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        await db.auth.exchangeCodeForSession(code);
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.pathname + url.search);
      }

      const { data } = await db.auth.getSession();
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
    };

    void init();

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
        if (accountRef.current) clearOfflineCache(accountRef.current.id);
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
    // Salvata subito, prima ancora di sapere se il salvataggio su Supabase
    // andrà a buon fine: se l'app viene chiusa (o il telefono va offline)
    // proprio in questo istante, la modifica non si perde comunque.
    saveOfflineCache(acc.id, prev, attempted);
    setSyncing(true);
    queue.current = queue.current
      .then(async () => {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await persistDiff(prev, attempted, acc.id);
            return;
          } catch (err) {
            const stillOnline = typeof navigator === "undefined" || navigator.onLine;
            if (attempt < maxAttempts && stillOnline) {
              // Il browser dice di essere online, ma la richiesta è comunque fallita:
              // spesso è solo un intoppo di rete momentaneo. Riprova in silenzio
              // prima di considerarlo un vero fallimento e annullare la modifica.
              await sleep(500 * attempt);
              continue;
            }
            throw err;
          }
        }
      })
      .then(() => {
        baseline.current = attempted;
        pending.current = null;
        setOfflinePending(false);
        saveOfflineCache(acc.id, attempted, attempted);
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
          saveOfflineCache(acc.id, attempted, attempted);
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
    if (accountRef.current) clearOfflineCache(accountRef.current.id);
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
          clearOfflineCache(acc.id);
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
