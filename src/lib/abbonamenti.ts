import type { AppState, Transaction } from "./types";
import { monthKey, shiftMonth } from "./format";

/**
 * ABBONAMENTI NON ANCORA RICORRENTI
 *
 * Trova le spese che tornano uguali ogni mese ma sono ancora inserite a mano
 * (Netflix, palestra, telefono), per proporre di renderle ricorrenti.
 *
 * Il controllo di prima chiedeva lo STESSO importo al centesimo, nella stessa
 * categoria, per 3 mesi consecutivi: bastava un aumento di prezzo di 1€ per
 * non vederlo più. Ora si guarda la descrizione e si tollera chi cambia un po':
 *
 * - stessa descrizione (senza maiuscole e accenti), in almeno MIN_MESI mesi
 *   diversi degli ultimi FINESTRA_MESI, l'ultimo dei quali non più vecchio
 *   del mese scorso (un abbonamento disdetto non va proposto);
 * - una volta al mese, non di più: "Spesa Esselunga" torna ogni mese ma
 *   tre volte a settimana, e non è un abbonamento;
 * - importo stabile: ogni volta entro ±TOLLERANZA dalla mediana;
 * - mese dopo mese: al massimo un mese saltato fra il primo e l'ultimo;
 * - più o meno lo stesso giorno del mese (scarto massimo GIORNI_SCARTO).
 *
 * Non si propone se esiste già una ricorrente con lo stesso nome, o nella
 * stessa categoria con un importo simile; e si ignorano le spese generate da
 * una ricorrente.
 */

const FINESTRA_MESI = 6;
const MIN_MESI = 3;
const TOLLERANZA = 0.15;
const GIORNI_SCARTO = 7;

export type Abbonamento = {
  /** Stabile anche se il prezzo cambia: serve a ricordare un "Ignora". */
  chiave: string;
  nome: string;
  categoria: string;
  /** L'importo più recente: è quello che si pagherà il prossimo mese. */
  importo: number;
  /** Giorno del mese dell'ultimo pagamento, limitato a 28 come le ricorrenti. */
  giorno: number;
  mesi: number;
  /** Data dell'ultimo pagamento inserito (YYYY-MM-DD). */
  ultimaData: string;
};

function normalizza(t: string) {
  return t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mediana(valori: number[]) {
  const v = [...valori].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? (v[m] ?? 0) : ((v[m - 1] ?? 0) + (v[m] ?? 0)) / 2;
}

export function trovaAbbonamenti(state: AppState, oggi: string): Abbonamento[] {
  const meseCorrente = monthKey(oggi);
  const primoMese = shiftMonth(meseCorrente, -(FINESTRA_MESI - 1));
  const mesePrecedente = shiftMonth(meseCorrente, -1);
  const categorieValide = new Set(state.categorie.map((c) => c.id));

  const gruppi = new Map<string, Transaction[]>();
  for (const t of state.transazioni) {
    if (t.data > oggi || t.ricorrenteId) continue;
    if (monthKey(t.data) < primoMese) continue;
    const chiave = normalizza(t.nota ?? "");
    if (!chiave) continue;
    const g = gruppi.get(chiave) ?? [];
    g.push(t);
    gruppi.set(chiave, g);
  }

  const trovati: Abbonamento[] = [];
  for (const [chiave, lista] of gruppi) {
    const mesi = new Set(lista.map((t) => monthKey(t.data)));
    if (mesi.size < MIN_MESI) continue;
    if (lista.length > mesi.size) continue; // più di una volta in un mese
    // Ogni mese, non "ogni tanto": fra il primo e l'ultimo mese si tollera al
    // massimo un mese saltato (una spesa dimenticata).
    const ordinati = [...mesi].sort();
    const [ya, ma] = (ordinati[0] ?? "").split("-").map(Number);
    const [yb, mb] = (ordinati[ordinati.length - 1] ?? "").split("-").map(Number);
    const arco = ((yb ?? 0) - (ya ?? 0)) * 12 + ((mb ?? 0) - (ma ?? 0)) + 1;
    if (arco > mesi.size + 1) continue;
    const ultima = lista.reduce((u, t) => (t.data > u.data ? t : u), lista[0]!);
    if (monthKey(ultima.data) < mesePrecedente) continue;
    if (!categorieValide.has(ultima.categoria)) continue;

    const med = mediana(lista.map((t) => t.importo));
    if (med <= 0) continue;
    if (lista.some((t) => Math.abs(t.importo - med) > med * TOLLERANZA)) continue;

    const giorni = lista.map((t) => Number(t.data.slice(8, 10)));
    if (Math.max(...giorni) - Math.min(...giorni) > GIORNI_SCARTO) continue;

    const nome = (ultima.nota ?? "").trim();
    const giaRicorrente = state.ricorrenti.some(
      (r) =>
        normalizza(r.nome) === chiave ||
        (r.categoria === ultima.categoria &&
          Math.abs(r.importo - ultima.importo) <= ultima.importo * TOLLERANZA),
    );
    if (giaRicorrente) continue;

    trovati.push({
      chiave,
      nome: nome.charAt(0).toUpperCase() + nome.slice(1),
      categoria: ultima.categoria,
      importo: ultima.importo,
      giorno: Math.min(28, Math.max(1, Number(ultima.data.slice(8, 10)))),
      mesi: mesi.size,
      ultimaData: ultima.data,
    });
  }
  return trovati.sort((a, b) => b.mesi - a.mesi || b.importo - a.importo);
}
