import type { AppState } from "./types";
import { monthKey, monthLabel, shiftMonth } from "./format";

/**
 * RIEPILOGO DI UN MESE CHIUSO
 *
 * Tutti i numeri li calcola il telefono. All'AI (modalità "riepilogo") si
 * mandano solo questi TOTALI già pronti, con le differenze già calcolate:
 * nessuna singola spesa, nessuna descrizione, nessuna data. L'AI deve solo
 * scrivere i consigli, non fare conti (li sbaglierebbe).
 */

/** Quanti mesi prima di quello chiuso si usano per la media di confronto. */
const MESI_MEDIA = 3;

export type VoceRiepilogo = {
  id: string;
  nome: string;
  speso: number;
  /** Media dei mesi precedenti CON spese in quella categoria; null se nessuno. */
  media: number | null;
  budget: number;
};

export type Riepilogo = {
  mese: string;
  etichetta: string;
  totale: number;
  numeroSpese: number;
  budgetTotale: number;
  mediaPrecedente: number | null;
  categorie: VoceRiepilogo[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcolaRiepilogo(state: AppState, mese: string, oggi: string): Riepilogo {
  const reali = state.transazioni.filter((t) => t.data <= oggi);
  const delMese = (m: string) => reali.filter((t) => monthKey(t.data) === m);
  const somma = (l: { importo: number }[]) => l.reduce((a, t) => a + t.importo, 0);

  const precedenti = Array.from({ length: MESI_MEDIA }, (_, i) => shiftMonth(mese, -(i + 1)));
  const totaliPrecedenti = precedenti.map((m) => somma(delMese(m))).filter((v) => v > 0);
  const tx = delMese(mese);

  const categorie = state.categorie
    .map((c) => {
      const speso = somma(tx.filter((t) => t.categoria === c.id));
      const prec = precedenti
        .map((m) => somma(delMese(m).filter((t) => t.categoria === c.id)))
        .filter((v) => v > 0);
      return {
        id: c.id,
        nome: c.nome,
        speso: r2(speso),
        media: prec.length ? r2(prec.reduce((a, b) => a + b, 0) / prec.length) : null,
        budget: c.budget,
      };
    })
    .filter((c) => c.speso > 0 || (c.media ?? 0) > 0)
    .sort((a, b) => b.speso - a.speso);

  return {
    mese,
    etichetta: monthLabel(mese),
    totale: r2(somma(tx)),
    numeroSpese: tx.length,
    budgetTotale: state.categorie.reduce((a, c) => a + c.budget, 0),
    mediaPrecedente: totaliPrecedenti.length
      ? r2(totaliPrecedenti.reduce((a, b) => a + b, 0) / totaliPrecedenti.length)
      : null,
    categorie,
  };
}

/** Variazione percentuale arrotondata, o null se non c'è un termine di confronto. */
export function variazione(attuale: number, riferimento: number | null): number | null {
  if (riferimento === null || riferimento <= 0) return null;
  return Math.round(((attuale - riferimento) / riferimento) * 100);
}

/** Quello che parte verso l'AI: totali e differenze già calcolate, niente altro. */
export function datiPerAI(r: Riepilogo, profilo: AppState["profilo"]) {
  return {
    mese: r.etichetta,
    totale: r.totale,
    budget_totale: r.budgetTotale || null,
    percentuale_budget: r.budgetTotale > 0 ? Math.round((r.totale / r.budgetTotale) * 100) : null,
    media_mesi_precedenti: r.mediaPrecedente,
    variazione_su_media_percento: variazione(r.totale, r.mediaPrecedente),
    profilo: { persone: profilo.persone, abitazione: profilo.abitazione, auto: profilo.auto },
    categorie: r.categorie.map((c) => ({
      nome: c.nome,
      speso: c.speso,
      media_mesi_precedenti: c.media,
      variazione_percento: variazione(c.speso, c.media),
      budget: c.budget || null,
      oltre_budget: c.budget > 0 ? r2(Math.max(0, c.speso - c.budget)) : null,
    })),
  };
}

export type Consiglio = { titolo: string; testo: string };

/** Ripulisce i consigli arrivati dall'AI: al massimo 3, testi brevi. */
export function normalizzaConsigli(grezzi: unknown): Consiglio[] {
  const lista = (grezzi as { consigli?: unknown } | null)?.consigli;
  if (!Array.isArray(lista)) return [];
  return lista
    .map((c) => (c && typeof c === "object" ? (c as { titolo?: unknown; testo?: unknown }) : {}))
    .filter((c) => typeof c.titolo === "string" && typeof c.testo === "string")
    .map((c) => ({
      titolo: String(c.titolo).trim().slice(0, 80),
      testo: String(c.testo).trim().slice(0, 400),
    }))
    .filter((c) => c.titolo && c.testo)
    .slice(0, 3);
}
