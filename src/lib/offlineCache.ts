import type { AppState } from "./types";

/**
 * Copia locale dei dati dell'account, sul telefono, per poter aprire l'app
 * anche a rete assente e continuare a lavorare da dove si era rimasti.
 *
 * "baseline" = l'ultimo stato confermato come salvato per davvero sul
 * database (quello con cui confrontare le modifiche future).
 * "state"    = lo stato che si vede in quel momento, che può contenere
 * modifiche fatte offline non ancora sincronizzate.
 *
 * Quando i due coincidono, non c'è nulla in sospeso. Quando sono diversi,
 * significa che l'app è stata chiusa mentre una modifica era ancora in
 * coda: al prossimo avvio, chi legge questa cache (vedi store.tsx) lo nota
 * e la rimette in coda per la sincronizzazione automatica.
 *
 * Non è un dato sensibile diverso da quello già presente sul dispositivo
 * tramite l'app stessa: resta comunque sul telefono della persona, non va
 * da nessuna parte.
 */

const PREFIX = "cit:cache:";

type Cached = { baseline: AppState; state: AppState; savedAt: string };

export function saveOfflineCache(userId: string, baseline: AppState, state: AppState) {
  if (typeof localStorage === "undefined") return;
  try {
    const payload: Cached = { baseline, state, savedAt: new Date().toISOString() };
    localStorage.setItem(PREFIX + userId, JSON.stringify(payload));
  } catch {
    // Memoria piena o non disponibile (es. navigazione privata): l'app
    // continua a funzionare normalmente finché c'è rete, semplicemente
    // senza questa rete di sicurezza.
  }
}

export function loadOfflineCache(userId: string): { baseline: AppState; state: AppState } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Cached> | null;
    if (!parsed || !parsed.baseline || !parsed.state) return null;
    return { baseline: parsed.baseline, state: parsed.state };
  } catch {
    return null;
  }
}

export function clearOfflineCache(userId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + userId);
  } catch {
    // ignora: se non si riesce a rimuoverla non è un problema bloccante.
  }
}
