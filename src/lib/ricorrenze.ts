import type { Recurring } from "./types";

/**
 * QUANDO CADE UNA SPESA RICORRENTE
 *
 * Unico punto in tutta l'app che risponde a questa domanda. Lo usano sia la
 * generazione automatica delle spese passate (store.tsx) sia la proiezione
 * delle spese previste (previsioni.ts): tenendolo in un posto solo, non
 * possono dare risposte diverse fra loro — che è esattamente il tipo di
 * incoerenza difficile da scovare.
 *
 * Due cadenze possibili:
 * - MESI: cade il giorno indicato (1-28), ogni "intervallo" mesi, contati a
 *   partire dal mese di inizio. Il giorno è limitato a 28 di proposito: così
 *   la spesa cade in ogni mese, febbraio compreso, senza casi particolari da
 *   gestire.
 * - SETTIMANE: cade ogni "intervallo" settimane a partire dalla data di
 *   inizio, quindi sempre nello stesso giorno della settimana.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function giornoDopo(iso: string): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + 1);
  return toISO(d);
}

export function ultimoGiornoDelMese(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  // Giorno 0 del mese successivo = ultimo giorno di questo mese.
  return toISO(new Date(y ?? 1970, m ?? 1, 0));
}

/** Valori di sicurezza: una ricorrenza mal configurata non deve poter creare migliaia di spese. */
const MAX_OCCORRENZE = 60;

/**
 * Tutte le date in cui la ricorrenza cade nell'intervallo [da, a], estremi
 * inclusi. Rispetta la data di fine, se impostata.
 */
export function occorrenzeTra(r: Recurring, da: string, a: string): string[] {
  if (da > a) return [];
  const intervallo = Math.max(1, Math.round(r.intervallo || 1));
  const limite = r.fine && r.fine < a ? r.fine : a;
  if (da > limite) return [];

  const out: string[] = [];
  const inizio = fromISO(r.inizio);

  if (r.cadenza === "settimane") {
    const passo = intervallo * 7;
    // Si parte dalla prima occorrenza non anteriore a "da", calcolata
    // direttamente invece di scorrere una per una dall'inizio della serie:
    // una ricorrenza settimanale iniziata anni fa avrebbe centinaia di passi.
    const giorniDaInizio = Math.round(
      (fromISO(da).getTime() - inizio.getTime()) / (24 * 60 * 60 * 1000),
    );
    const saltiIniziali = giorniDaInizio > 0 ? Math.ceil(giorniDaInizio / passo) : 0;
    for (let k = saltiIniziali; out.length < MAX_OCCORRENZE; k++) {
      const d = new Date(inizio);
      d.setDate(d.getDate() + k * passo);
      const iso = toISO(d);
      if (iso > limite) break;
      if (iso >= da) out.push(iso);
    }
    return out;
  }

  // Cadenza mensile: si scorrono i mesi validi (mese di inizio + multipli
  // dell'intervallo) e in ognuno si prende il giorno indicato.
  const giorno = Math.min(28, Math.max(1, r.giorno || 1));
  const meseInizio = inizio.getFullYear() * 12 + inizio.getMonth();
  const daD = fromISO(da);
  const meseDa = daD.getFullYear() * 12 + daD.getMonth();
  const diff = meseDa - meseInizio;
  const saltiIniziali = diff > 0 ? Math.floor(diff / intervallo) : 0;

  for (let k = saltiIniziali; out.length < MAX_OCCORRENZE; k++) {
    const mesi = meseInizio + k * intervallo;
    const d = new Date(Math.floor(mesi / 12), mesi % 12, giorno);
    const iso = toISO(d);
    if (iso > limite) break;
    if (iso >= da) out.push(iso);
    // Sicurezza: se per qualche motivo non si avanza mai oltre "da", si esce.
    if (k - saltiIniziali > MAX_OCCORRENZE * 2) break;
  }
  return out;
}

/** La prima data in cui la ricorrenza cade dopo il giorno indicato (esclusa). */
export function prossimaOccorrenza(r: Recurring, dopo: string): string | null {
  // Un anno avanti basta: oltre, per gli scopi dell'app, non serve guardare.
  const d = fromISO(dopo);
  d.setFullYear(d.getFullYear() + 1);
  const occ = occorrenzeTra(r, giornoDopo(dopo), toISO(d));
  return occ[0] ?? null;
}

/** Etichetta breve della cadenza, es. "Ogni mese", "Ogni 3 settimane". */
export function etichettaCadenza(r: Recurring): string {
  const n = Math.max(1, Math.round(r.intervallo || 1));
  if (r.cadenza === "settimane") return n === 1 ? "Ogni settimana" : `Ogni ${n} settimane`;
  return n === 1 ? "Ogni mese" : `Ogni ${n} mesi`;
}
