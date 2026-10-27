import { spostaGiorni } from "./format";

/**
 * SPESA SCRITTA A PAROLE
 *
 * "pizza 18 ieri" → importo 18, descrizione "Pizza", data di ieri.
 *
 * Prima ci prova il telefono, da solo: è istantaneo, gratis e funziona anche
 * senza rete. Copre la forma che si usa quasi sempre: una cosa, un importo,
 * al massimo un giorno. Solo se la frase è più complicata ("2 caffè da 1,20
 * stamattina", due numeri, nessun numero) si chiede all'AI (modalità
 * "spesa"), che risponde nello stesso formato e passa dagli stessi
 * controlli (normalizzaSpesaAI).
 */

export type SpesaLetta = {
  importo: number;
  descrizione: string;
  /** YYYY-MM-DD */
  data: string;
  /** Solo dall'AI: id di una categoria esistente, se ne ha riconosciuta una. */
  categoria: string | null;
};

const GIORNI = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];

/** Parole che non fanno parte della descrizione: "ho speso 18 euro per la pizza". */
const RIEMPITIVI = new Set([
  "ho",
  "speso",
  "pagato",
  "comprato",
  "preso",
  "euro",
  "eur",
  "€",
  "per",
  "di",
  "da",
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "una",
  "uno",
  "al",
  "allo",
  "alla",
  "ai",
  "agli",
  "alle",
  "del",
  "della",
  "a",
  "e",
  "in",
]);

function senzaAccenti(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Il giorno della settimana più recente (oggi compreso) con quel nome. */
function ultimoGiorno(oggi: string, indice: number): string {
  const d = new Date(oggi + "T00:00:00");
  const diff = (d.getDay() - indice + 7) % 7;
  return spostaGiorni(oggi, -diff);
}

/**
 * Legge la frase da solo. Restituisce null se non è sicuro: niente importo,
 * più di un numero, o niente descrizione. In quel caso decide l'AI.
 */
export function leggiSpesaLocale(frase: string, oggi: string): SpesaLetta | null {
  let testo = ` ${senzaAccenti(frase.trim())} `;
  if (testo.trim().length === 0) return null;
  let data = oggi;

  // Prima le espressioni di tempo, così i loro numeri ("3 giorni fa") non
  // vengono scambiati per l'importo.
  const giorniFa = testo.match(/\s(\d{1,2})\s+giorn[oi]\s+fa\s/);
  if (giorniFa) {
    data = spostaGiorni(oggi, -Number(giorniFa[1]));
    testo = testo.replace(giorniFa[0], " ");
  } else if (/\s(l['’]?altro\s*ieri|altroieri)\s/.test(testo)) {
    data = spostaGiorni(oggi, -2);
    testo = testo.replace(/\s(l['’]?altro\s*ieri|altroieri)\s/, " ");
  } else if (/\sieri(\s+sera|\s+mattina)?\s/.test(testo)) {
    data = spostaGiorni(oggi, -1);
    testo = testo.replace(/\sieri(\s+sera|\s+mattina)?\s/, " ");
  } else if (/\s(oggi|stamattina|stasera|stamani)\s/.test(testo)) {
    testo = testo.replace(/\s(oggi|stamattina|stasera|stamani)\s/, " ");
  } else {
    // Solo i nomi interi: le abbreviazioni ("mar", "lun") si confondono con
    // parole normali.
    const giorno = GIORNI.findIndex((g) => new RegExp(`\\s${g}\\s`).test(testo));
    if (giorno >= 0) {
      data = ultimoGiorno(oggi, giorno);
      testo = testo.replace(new RegExp(`\\s${GIORNI[giorno] ?? ""}\\s`), " ");
    }
  }

  // Importo: un solo numero, con virgola o punto, con o senza "€".
  const numeri = [...testo.matchAll(/(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)?/g)];
  if (numeri.length !== 1) return null;
  const trovato = numeri[0]!;
  const importo = Number((trovato[1] ?? "").replace(",", "."));
  if (!Number.isFinite(importo) || importo <= 0) return null;
  testo = testo.replace(trovato[0], " ");

  // Quello che resta è la descrizione, ripulita dai riempitivi ai bordi.
  const parole = testo.split(/\s+/).filter(Boolean);
  while (parole.length > 0 && RIEMPITIVI.has(parole[0]!)) parole.shift();
  while (parole.length > 0 && RIEMPITIVI.has(parole[parole.length - 1]!)) parole.pop();
  if (parole.length === 0) return null;

  // La descrizione si riprende dalla frase originale, così restano gli
  // accenti ("caffè", non "caffe"). Se non la si ritrova si usa quella pulita.
  const pulita = parole.join(" ");
  const originale = frase.trim();
  const inizio = senzaAccenti(originale).indexOf(pulita);
  const descrizione = inizio >= 0 ? originale.slice(inizio, inizio + pulita.length) : pulita;

  return {
    importo: Math.round(importo * 100) / 100,
    descrizione: descrizione.charAt(0).toUpperCase() + descrizione.slice(1),
    data,
    categoria: null,
  };
}

/** Ripulisce la risposta dell'AI: tutto ciò che non torna viene scartato. */
export function normalizzaSpesaAI(
  grezza: unknown,
  oggi: string,
  categorieEsistenti: string[],
): SpesaLetta | null {
  if (!grezza || typeof grezza !== "object") return null;
  const g = grezza as {
    importo?: unknown;
    descrizione?: unknown;
    data?: unknown;
    categoria?: unknown;
  };
  const importo = typeof g.importo === "number" ? g.importo : Number(g.importo);
  if (!Number.isFinite(importo) || importo <= 0 || importo > 1_000_000) return null;
  const descrizione = typeof g.descrizione === "string" ? g.descrizione.trim().slice(0, 80) : "";
  // Una data fuori da un anno indietro / un anno avanti è quasi certamente
  // un errore di lettura: meglio oggi, che l'utente vede e corregge.
  const minima = spostaGiorni(oggi, -366);
  const massima = spostaGiorni(oggi, 366);
  const data =
    typeof g.data === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(g.data) &&
    g.data >= minima &&
    g.data <= massima
      ? g.data
      : oggi;
  const categoria =
    typeof g.categoria === "string" && categorieEsistenti.includes(g.categoria)
      ? g.categoria
      : null;
  return {
    importo: Math.round(importo * 100) / 100,
    descrizione: descrizione ? descrizione.charAt(0).toUpperCase() + descrizione.slice(1) : "",
    data,
    categoria,
  };
}
