import type { AppState, Transaction } from "./types";
import { currentMonth, monthKey, todayISO } from "./format";

/**
 * SPESE PREVISTE
 *
 * "Previsto" = soldi che stanno per uscire ma non sono ancora usciti. Viene da
 * due fonti diverse, che qui vengono unite in un unico elenco perché
 * all'utente interessa il quadro completo di quello che lo aspetta:
 *
 * 1. MANUALI — transazioni inserite con una data successiva a oggi (es. un
 *    viaggio già programmato). Esistono già in state.transazioni, semplicemente
 *    non sono ancora "realizzate".
 *
 * 2. RICORRENTI — spese fisse attive il cui giorno del mese non è ancora
 *    arrivato. ATTENZIONE: queste NON esistono da nessuna parte nei dati prima
 *    di scattare (runRecurring in store.tsx crea la transazione vera solo il
 *    giorno stesso), quindi vanno calcolate al volo. Non sono transazioni
 *    salvate: sono una proiezione.
 *
 * Le ricorrenti vengono proiettate SOLO sul mese in corso, di proposito:
 * spingersi sui mesi futuri aggiungerebbe incertezza (l'importo può cambiare,
 * la ricorrente può essere disattivata) senza dare molto in più.
 *
 * REGOLA DI FONDO: il "previsto" non entra MAI nei totali dello speso reale.
 * "Speso in Settembre" deve restare la risposta a "quanti soldi sono usciti
 * davvero", altrimenti perde il suo significato. Il previsto vive accanto,
 * mai dentro.
 */

export type Previsione = {
  /** Chiave per le liste. Per le ricorrenti è sintetica: non è una transazione salvata. */
  id: string;
  importo: number;
  categoria: string;
  data: string; // YYYY-MM-DD
  nota: string;
  fonte: "manuale" | "ricorrente";
  /** Presente solo per fonte "ricorrente": serve ad aprire la ricorrenza giusta. */
  ricorrenteId?: string;
};

/** Transazioni già realizzate: data di oggi o passata. Sono lo "speso vero". */
export function txRealizzate(txs: Transaction[], oggi = todayISO()) {
  return txs.filter((t) => t.data <= oggi);
}

/** Transazioni inserite a mano con data futura. */
export function txFuture(txs: Transaction[], oggi = todayISO()) {
  return txs.filter((t) => t.data > oggi);
}

/**
 * Ricorrenti attive che scatteranno più avanti in questo mese.
 *
 * Una ricorrente è "in attesa" se: è attiva, la sua categoria esiste ancora,
 * il suo giorno non è ancora arrivato, e non è già stata generata per questo
 * mese. L'ultimo controllo evita il doppio conteggio nel caso limite in cui
 * l'utente sposti il giorno più in avanti DOPO che la spesa del mese è già
 * stata registrata: in quel caso la transazione vera esiste già, e contarla
 * anche come previsto la conterebbe due volte.
 */
export function ricorrentiInAttesa(state: AppState, oggi = todayISO()): Previsione[] {
  const mk = currentMonth();
  const giornoOggi = Number(oggi.slice(8, 10));
  return state.ricorrenti
    .filter(
      (r) =>
        r.attiva &&
        state.categorie.some((c) => c.id === r.categoria) &&
        r.giorno > giornoOggi &&
        r.ultimaGenerazione !== mk,
    )
    .map((r) => ({
      id: `ric:${r.id}`,
      importo: r.importo,
      categoria: r.categoria,
      data: `${mk}-${String(r.giorno).padStart(2, "0")}`,
      nota: r.nome,
      fonte: "ricorrente" as const,
      ricorrenteId: r.id,
    }));
}

/**
 * Tutte le spese previste di un dato mese, dalle due fonti unite.
 * Ordinate per data crescente: le più imminenti per prime.
 */
export function previsteDelMese(state: AppState, mk: string, oggi = todayISO()): Previsione[] {
  const manuali: Previsione[] = txFuture(state.transazioni, oggi)
    .filter((t) => monthKey(t.data) === mk)
    .map((t) => ({
      id: t.id,
      importo: t.importo,
      categoria: t.categoria,
      data: t.data,
      nota: t.nota,
      fonte: "manuale" as const,
    }));

  // Le ricorrenti si proiettano solo sul mese in corso (vedi nota in cima).
  const ricorrenti = mk === currentMonth() ? ricorrentiInAttesa(state, oggi) : [];

  return [...manuali, ...ricorrenti].sort((a, b) => (a.data < b.data ? -1 : 1));
}

/**
 * Tutte le spese previste d'ora in avanti, senza limite di mese: serve alla
 * sezione "Prossime spese" dello Storico, che guarda al futuro e quindi non
 * deve dipendere dai filtri per mese (pensati per il passato).
 */
export function prossimePreviste(state: AppState, oggi = todayISO()): Previsione[] {
  const manuali: Previsione[] = txFuture(state.transazioni, oggi).map((t) => ({
    id: t.id,
    importo: t.importo,
    categoria: t.categoria,
    data: t.data,
    nota: t.nota,
    fonte: "manuale" as const,
  }));
  return [...manuali, ...ricorrentiInAttesa(state, oggi)].sort((a, b) =>
    a.data < b.data ? -1 : 1,
  );
}

export function sommaPreviste(list: Previsione[]) {
  return list.reduce((a, p) => a + p.importo, 0);
}

export function previsteByCategoria(list: Previsione[]) {
  const map = new Map<string, number>();
  for (const p of list) map.set(p.categoria, (map.get(p.categoria) ?? 0) + p.importo);
  return map;
}
