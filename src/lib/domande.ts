import type { Category, Transaction } from "./types";
import { contieneTesto } from "./descrizioni";
import { eur, formatDay, monthKey, monthLabel, shiftMonth, spostaGiorni } from "./format";
import { txRealizzate } from "./previsioni";

/**
 * DOMANDE LIBERE SULLE SPESE
 *
 * L'AI non vede MAI le spese. Riceve solo la domanda e i nomi delle
 * categorie, e la traduce in una "interpretazione": che cosa contare, in
 * quale periodo, con quali filtri (vedi la Edge Function chiedi-spese).
 * I conti li fa poi questo file, sul telefono, con i dati veri.
 *
 * Tre vantaggi rispetto a mandare le spese al modello:
 * - i numeri sono esatti: un modello linguistico sbaglia le somme;
 * - nessun dato economico esce dall'app;
 * - la richiesta è minuscola e veloce, e consuma poco della quota gratuita.
 *
 * L'interpretazione arriva da fuori, quindi qui non ci si fida: ogni campo
 * viene controllato e ripulito (normalizzaInterpretazione) prima dell'uso.
 */

export type Periodo =
  | { tipo: "tutto" }
  | { tipo: "mese_corrente" }
  | { tipo: "mese_scorso" }
  | { tipo: "anno_corrente" }
  | { tipo: "anno_scorso" }
  | { tipo: "ultimi_giorni"; n: number }
  | { tipo: "ultimi_mesi"; n: number }
  | { tipo: "mese"; valore: string }
  | { tipo: "anno"; valore: string }
  | { tipo: "intervallo"; da: string; a: string };

export const TIPI_DOMANDA = [
  "totale",
  "per_categoria",
  "per_mese",
  "media_mensile",
  "piu_care",
  "frequenti",
  "confronto",
  "ultima",
  "non_capito",
] as const;
export type TipoDomanda = (typeof TIPI_DOMANDA)[number];

export type Interpretazione = {
  tipo: TipoDomanda;
  periodo: Periodo;
  /** Solo per "confronto": il periodo con cui confrontare. */
  confronto: Periodo | null;
  categorie: string[];
  /** Parola da cercare nella descrizione. */
  testo: string | null;
  limite: number;
  /** Solo per "non_capito": cosa dire all'utente. */
  messaggio: string | null;
};

export type RigaRisposta = { etichetta: string; valore: string; nota?: string | undefined };
export type Risposta = {
  /** Il numero principale, in grande. Assente quando la risposta è un elenco. */
  valore?: string;
  /** La frase che spiega il numero o introduce l'elenco. */
  frase: string;
  righe?: RigaRisposta[];
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MESE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ANNO = /^\d{4}$/;

function intero(v: unknown, min: number, max: number, predefinito: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return predefinito;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** I campi che possono arrivare dall'AI, tutti ancora da controllare. */
type Grezzo = Partial<
  Record<
    | "tipo"
    | "n"
    | "valore"
    | "da"
    | "a"
    | "periodo"
    | "confronto"
    | "categorie"
    | "testo"
    | "limite"
    | "messaggio",
    unknown
  >
>;

function oggetto(v: unknown): Grezzo {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Grezzo) : {};
}

export function normalizzaPeriodo(v: unknown): Periodo | null {
  const p = oggetto(v);
  switch (p.tipo) {
    case "tutto":
    case "mese_corrente":
    case "mese_scorso":
    case "anno_corrente":
    case "anno_scorso":
      return { tipo: p.tipo };
    case "ultimi_giorni":
      return { tipo: "ultimi_giorni", n: intero(p.n, 1, 3650, 30) };
    case "ultimi_mesi":
      return { tipo: "ultimi_mesi", n: intero(p.n, 1, 120, 3) };
    case "mese":
      return typeof p.valore === "string" && MESE.test(p.valore)
        ? { tipo: "mese", valore: p.valore }
        : null;
    case "anno":
      return typeof p.valore === "string" && ANNO.test(p.valore)
        ? { tipo: "anno", valore: p.valore }
        : null;
    case "intervallo": {
      if (typeof p.da !== "string" || typeof p.a !== "string") return null;
      if (!DATA.test(p.da) || !DATA.test(p.a)) return null;
      const [da, a] = p.da <= p.a ? [p.da, p.a] : [p.a, p.da];
      return { tipo: "intervallo", da, a };
    }
    default:
      return null;
  }
}

/** Ripulisce quanto arriva dall'AI: tutto ciò che non torna viene scartato. */
export function normalizzaInterpretazione(
  grezza: unknown,
  categorieEsistenti: string[],
): Interpretazione {
  const g = oggetto(grezza);
  const tipo = TIPI_DOMANDA.includes(g.tipo as TipoDomanda)
    ? (g.tipo as TipoDomanda)
    : "non_capito";
  const valide = new Set(categorieEsistenti);
  const categorie = Array.isArray(g.categorie)
    ? [...new Set(g.categorie.filter((c): c is string => typeof c === "string" && valide.has(c)))]
    : [];
  const testo = typeof g.testo === "string" && g.testo.trim() ? g.testo.trim().slice(0, 40) : null;
  const messaggio =
    typeof g.messaggio === "string" && g.messaggio.trim() ? g.messaggio.trim().slice(0, 200) : null;
  const confronto = tipo === "confronto" ? normalizzaPeriodo(g.confronto) : null;

  return {
    // Un confronto senza secondo periodo non si può fare: diventa un totale.
    tipo: tipo === "confronto" && !confronto ? "totale" : tipo,
    periodo: normalizzaPeriodo(g.periodo) ?? { tipo: "tutto" },
    confronto,
    categorie,
    testo,
    limite: intero(g.limite, 1, 10, 5),
    messaggio,
  };
}

/* ---------- Periodi ---------- */

function ultimoGiornoMese(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y ?? 2000, m ?? 1, 0);
  return `${mk}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Il periodo come intervallo di date (estremi inclusi). "tutto" = nessun limite. */
export function intervalloDi(p: Periodo, oggi: string): { da: string; a: string } | null {
  const mc = monthKey(oggi);
  const anno = oggi.slice(0, 4);
  switch (p.tipo) {
    case "tutto":
      return null;
    case "mese_corrente":
      return { da: `${mc}-01`, a: ultimoGiornoMese(mc) };
    case "mese_scorso": {
      const ms = shiftMonth(mc, -1);
      return { da: `${ms}-01`, a: ultimoGiornoMese(ms) };
    }
    case "anno_corrente":
      return { da: `${anno}-01-01`, a: `${anno}-12-31` };
    case "anno_scorso": {
      const a = String(Number(anno) - 1);
      return { da: `${a}-01-01`, a: `${a}-12-31` };
    }
    case "ultimi_giorni":
      return { da: spostaGiorni(oggi, -(p.n - 1)), a: oggi };
    case "ultimi_mesi":
      // Mese in corso compreso: "ultimi 3 mesi" a ottobre = agosto, settembre, ottobre.
      return { da: `${shiftMonth(mc, -(p.n - 1))}-01`, a: oggi };
    case "mese":
      return { da: `${p.valore}-01`, a: ultimoGiornoMese(p.valore) };
    case "anno":
      return { da: `${p.valore}-01-01`, a: `${p.valore}-12-31` };
    case "intervallo":
      return { da: p.da, a: p.a };
  }
}

export function etichettaPeriodo(p: Periodo, oggi: string): string {
  switch (p.tipo) {
    case "tutto":
      return "in totale";
    case "mese_corrente":
      return "questo mese";
    case "mese_scorso":
      return `a ${monthLabel(shiftMonth(monthKey(oggi), -1)).toLowerCase()}`;
    case "anno_corrente":
      return "quest'anno";
    case "anno_scorso":
      return "l'anno scorso";
    case "ultimi_giorni":
      return p.n === 1 ? "oggi" : `negli ultimi ${p.n} giorni`;
    case "ultimi_mesi":
      return p.n === 1 ? "questo mese" : `negli ultimi ${p.n} mesi`;
    case "mese":
      return `a ${monthLabel(p.valore).toLowerCase()}`;
    case "anno":
      return `nel ${p.valore}`;
    case "intervallo":
      return `dal ${formatDay(p.da)} al ${formatDay(p.a)}`;
  }
}

/* ---------- Filtri ---------- */

/**
 * La parola cercata, resa un po' più tollerante: "pizza" deve trovare anche
 * "pizze" e "pizzeria". Per le parole di almeno 5 lettere si toglie la
 * vocale finale; quelle corte ("bar") restano intere, altrimenti
 * troverebbero di tutto.
 */
export function radice(parola: string): string {
  const p = parola.trim();
  if (p.length >= 5 && /[aeiouàèéìòù]$/i.test(p)) return p.slice(0, -1);
  return p;
}

function filtra(txs: Transaction[], i: Interpretazione, p: Periodo, oggi: string) {
  const intervallo = intervalloDi(p, oggi);
  const cat = new Set(i.categorie);
  const parola = i.testo ? radice(i.testo) : "";
  return txs.filter(
    (t) =>
      (!intervallo || (t.data >= intervallo.da && t.data <= intervallo.a)) &&
      (cat.size === 0 || cat.has(t.categoria)) &&
      (!parola || contieneTesto(t.nota, parola)),
  );
}

const somma = (txs: Transaction[]) => txs.reduce((s, t) => s + t.importo, 0);
const arrotonda = (n: number) => Math.round(n * 100) / 100;

/** "a settembre 2026" → "settembre 2026", "nel 2025" → "2025": per etichette e confronti. */
function senzaPreposizione(etichetta: string) {
  return etichetta.replace(/^(a|nel) /, "");
}

function quante(n: number) {
  return n === 1 ? "1 spesa" : `${n} spese`;
}

/** "in Cibo", "per «benzina»", "in Cibo per «pizza»": il soggetto della frase. */
function soggetto(i: Interpretazione, categorie: Category[]): string {
  const nomi = i.categorie
    .map((id) => categorie.find((c) => c.id === id)?.nome)
    .filter((n): n is string => !!n);
  const parti: string[] = [];
  if (nomi.length > 0) parti.push(`in ${nomi.join(", ")}`);
  if (i.testo) parti.push(`per “${i.testo}”`);
  return parti.join(" ");
}

function frase(...pezzi: (string | false | null | undefined)[]) {
  const s = pezzi.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- Risposta ---------- */

/**
 * Calcola la risposta sulle spese GIÀ fatte: quelle con data futura sono
 * previste, non spese, e falserebbero i totali (stessa regola dello storico).
 */
/* ---------- Parole che indicano una categoria ---------- */

/**
 * Parole di tutti i giorni che indicano una categoria anche senza nominarla:
 * "quanto ho speso per la macchina?" vuol dire la categoria Auto. La chiave
 * è un pezzo del NOME della categoria (le categorie le sceglie l'utente:
 * "Auto", "Auto e moto", "Trasporti"…), il valore le parole che la indicano.
 */
const SINONIMI: [string[], string[]][] = [
  [
    ["auto", "trasport", "macchin", "veicol"],
    [
      "macchina",
      "auto",
      "automobile",
      "carburante",
      "benzina",
      "gasolio",
      "diesel",
      "pieno",
      "meccanico",
      "autostrada",
      "pedaggio",
      "parcheggio",
      "bollo",
      "moto",
      "scooter",
    ],
  ],
  [
    ["cibo", "spesa", "aliment", "mangiare"],
    [
      "cibo",
      "mangiare",
      "alimentari",
      "supermercato",
      "spesa",
      "cena",
      "pranzo",
      "colazione",
      "ristorante",
      "pizzeria",
    ],
  ],
  [
    ["bollett", "utenz"],
    ["bolletta", "bollette", "luce", "gas", "acqua", "internet", "telefono", "utenze"],
  ],
  [
    ["casa", "affitt", "mutuo"],
    ["casa", "affitto", "mutuo", "condominio"],
  ],
  [
    ["medic", "salute"],
    ["medico", "medici", "dottore", "farmacia", "medicine", "salute", "dentista", "visita"],
  ],
  [
    ["svago", "tempo libero", "divertim"],
    ["svago", "divertimento", "uscite", "cinema", "hobby"],
  ],
];

function semplice(t: string) {
  return t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** La categoria indicata da una parola ("macchina" → Auto), o null. */
export function categoriaDaParola(parola: string, categorie: Category[]): string | null {
  const w = semplice(parola);
  const r = semplice(radice(parola));
  if (r.length < 3) return null;
  // 1. Il nome della categoria stesso ("auto", "bollette" → Bollette).
  for (const c of categorie) {
    const n = semplice(c.nome);
    if (n === w || n.startsWith(r) || (n.length >= 4 && w.startsWith(n))) return c.id;
  }
  // 2. Un sinonimo ("macchina" → la categoria il cui nome contiene "auto").
  for (const [nomi, parole] of SINONIMI) {
    if (!parole.some((p) => p === w || radice(p) === r)) continue;
    const c = categorie.find((x) => nomi.some((k) => semplice(x.nome).includes(k)));
    if (c) return c.id;
  }
  return null;
}

/**
 * Corregge l'interpretazione quando la parola cercata è in realtà una
 * categoria. "Quanto ho speso nella macchina?" può arrivare dall'AI come
 * ricerca della parola "macchina" nelle descrizioni: nessuna spesa si chiama
 * così, e la risposta sarebbe "nessuna spesa". Se la parola non compare in
 * nessuna descrizione ma indica una categoria, si cerca per categoria.
 * Se invece compare ("benzina" usata come descrizione) resta la ricerca per
 * parola, che è più precisa.
 */
export function affinaInterpretazione(
  i: Interpretazione,
  transazioni: Transaction[],
  categorie: Category[],
): Interpretazione {
  if (!i.testo) return i;
  const cat = categoriaDaParola(i.testo, categorie);
  if (!cat) return i;
  const parola = radice(i.testo);
  const usata = transazioni.some((t) => contieneTesto(t.nota, parola));
  if (usata && !i.categorie.includes(cat)) return i;
  return { ...i, testo: null, categorie: [...new Set([...i.categorie, cat])] };
}

export function rispondi(
  interpretazione: Interpretazione,
  transazioni: Transaction[],
  categorie: Category[],
  oggi: string,
): Risposta {
  const i = affinaInterpretazione(interpretazione, transazioni, categorie);
  if (i.tipo === "non_capito") {
    return {
      frase:
        i.messaggio ??
        "Non ho capito la domanda. Prova con qualcosa come “quanto ho speso in benzina quest'anno?”",
    };
  }

  const realizzate = txRealizzate(transazioni, oggi);
  const scelte = filtra(realizzate, i, i.periodo, oggi);
  const chi = soggetto(i, categorie);
  const quando = etichettaPeriodo(i.periodo, oggi);
  // Negli elenchi e nelle medie "in totale" suona male ("le spese più alte
  // in totale"): senza periodo si omette e basta.
  const quandoBreve = i.periodo.tipo === "tutto" ? "" : quando;

  if (scelte.length === 0 && i.tipo !== "confronto") {
    return { frase: frase("Nessuna spesa", chi, quando + ".") };
  }

  switch (i.tipo) {
    case "totale":
      return {
        valore: eur(arrotonda(somma(scelte))),
        frase: frase("Hai speso", chi, quando, `· ${quante(scelte.length)}`),
      };

    case "per_categoria": {
      const tot = somma(scelte);
      const per = new Map<string, number>();
      for (const t of scelte) per.set(t.categoria, (per.get(t.categoria) ?? 0) + t.importo);
      const righe = [...per.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, v]) => ({
          etichetta: categorie.find((c) => c.id === id)?.nome ?? "Categoria eliminata",
          valore: eur(arrotonda(v)),
          nota: tot > 0 ? `${Math.round((v / tot) * 100)}%` : undefined,
        }));
      return {
        valore: eur(arrotonda(tot)),
        frase: frase("Spese", chi, quandoBreve, "per categoria"),
        righe,
      };
    }

    case "per_mese": {
      const per = new Map<string, number>();
      for (const t of scelte) {
        const m = monthKey(t.data);
        per.set(m, (per.get(m) ?? 0) + t.importo);
      }
      const righe = [...per.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 24)
        .map(([m, v]) => ({ etichetta: monthLabel(m), valore: eur(arrotonda(v)) }));
      return {
        valore: eur(arrotonda(somma(scelte))),
        frase: frase("Spese", chi, quandoBreve, "mese per mese"),
        righe,
      };
    }

    case "media_mensile": {
      // Mesi contati dal primo all'ultimo del periodo che contiene spese:
      // con "in totale" non ha senso dividere anche per i mesi in cui l'app
      // non si usava ancora.
      const intervallo = intervalloDi(i.periodo, oggi);
      const primaData = scelte.reduce((m, t) => (t.data < m ? t.data : m), scelte[0]!.data);
      const inizio = monthKey(intervallo ? intervallo.da : primaData);
      const fine = monthKey(intervallo && intervallo.a < oggi ? intervallo.a : oggi);
      const [ya, ma] = inizio.split("-").map(Number);
      const [yb, mb] = fine.split("-").map(Number);
      const mesi = Math.max(1, ((yb ?? 0) - (ya ?? 0)) * 12 + ((mb ?? 0) - (ma ?? 0)) + 1);
      return {
        valore: eur(arrotonda(somma(scelte) / mesi)),
        frase: frase(
          "In media al mese",
          chi,
          quandoBreve,
          `· ${eur(arrotonda(somma(scelte)))} in ${mesi} ${mesi === 1 ? "mese" : "mesi"}`,
        ),
      };
    }

    case "piu_care": {
      const righe = [...scelte]
        .sort((a, b) => b.importo - a.importo)
        .slice(0, i.limite)
        .map((t) => ({
          etichetta: t.nota || categorie.find((c) => c.id === t.categoria)?.nome || "Spesa",
          valore: eur(t.importo),
          nota: formatDay(t.data),
        }));
      return { frase: frase("Le spese più alte", chi, quandoBreve), righe };
    }

    case "frequenti": {
      const per = new Map<string, { testo: string; n: number; tot: number }>();
      for (const t of scelte) {
        const testo = (t.nota ?? "").trim();
        if (!testo) continue;
        const k = testo.toLowerCase();
        const v = per.get(k) ?? { testo, n: 0, tot: 0 };
        v.n += 1;
        v.tot += t.importo;
        per.set(k, v);
      }
      const righe = [...per.values()]
        .sort((a, b) => b.n - a.n || b.tot - a.tot)
        .slice(0, i.limite)
        .map((v) => ({
          etichetta: v.testo,
          valore: eur(arrotonda(v.tot)),
          nota: v.n === 1 ? "1 volta" : `${v.n} volte`,
        }));
      if (righe.length === 0) {
        return { frase: frase("Le spese", chi, quandoBreve, "non hanno descrizione.") };
      }
      return { frase: frase("Le spese più frequenti", chi, quandoBreve), righe };
    }

    case "confronto": {
      const altro = i.confronto ?? { tipo: "tutto" };
      const b = filtra(realizzate, i, altro, oggi);
      const va = arrotonda(somma(scelte));
      const vb = arrotonda(somma(b));
      const diff = arrotonda(va - vb);
      const pctDiff = vb > 0 ? Math.round((diff / vb) * 100) : null;
      const quandoB = etichettaPeriodo(altro, oggi);
      const esito =
        diff === 0
          ? "uguale"
          : `${diff > 0 ? "+" : "−"}${eur(Math.abs(diff))}${pctDiff !== null ? ` (${diff > 0 ? "+" : "−"}${Math.abs(pctDiff)}%)` : ""}`;
      return {
        valore: esito,
        frase: frase(chi || "Spese", quando, "rispetto a", senzaPreposizione(quandoB)),
        righe: [
          {
            etichetta: frase(senzaPreposizione(quando)),
            valore: eur(va),
            nota: quante(scelte.length),
          },
          { etichetta: frase(senzaPreposizione(quandoB)), valore: eur(vb), nota: quante(b.length) },
        ],
      };
    }

    case "ultima": {
      const t = scelte.reduce((m, x) => (x.data > m.data ? x : m), scelte[0]!);
      return {
        valore: formatDay(t.data),
        frase: frase(
          "L'ultima volta",
          chi,
          `· ${t.nota || categorie.find((c) => c.id === t.categoria)?.nome || "spesa"} da ${eur(t.importo)}`,
        ),
      };
    }
  }
}
