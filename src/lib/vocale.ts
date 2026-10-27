import type { AppState, Category, Transaction } from "./types";
import { contieneTesto } from "./descrizioni";
import {
  intervalloDi,
  normalizzaInterpretazione,
  normalizzaPeriodo,
  radice,
  type Interpretazione,
  type Periodo,
  type Risposta,
} from "./domande";
import { eur, monthKey, monthLabel, spostaGiorni } from "./format";
import { normalizzaSpesaAI, type SpesaLetta } from "./spesaAParole";
import { previsteDelMese, sommaPreviste, txRealizzate } from "./previsioni";

/**
 * ASSISTENTE VOCALE (Siri, tramite Comandi Rapidi)
 *
 * Qui c'è la logica, senza rete né database, così si può provare con i test.
 * La Edge Function "assistente-vocale" la usa così com'è (il file della
 * funzione viene generato unendo questi moduli, vedi LEGGIMI).
 *
 * Un comando detto a voce diventa una di queste azioni:
 * - aggiungi:  "pizza 18 ieri", "aggiungi 2 caffè da 1,20"
 * - domanda:   "quanto ho speso in benzina questo mese?"
 * - elimina:   "elimina l'ultima spesa", "cancella la pizza di ieri"
 * - modifica:  "la pizza di ieri era 20 euro", "cambia la benzina in Auto"
 * - consiglio: "come posso risparmiare?"
 *
 * Eliminare e modificare chiedono SEMPRE conferma ("Elimino “Pizza” da 18 €
 * di ieri?"): un errore di dettatura non deve far sparire una spesa.
 */

export type Riferimento = {
  /** "l'ultima spesa": la più recente inserita. */
  ultima: boolean;
  testo: string | null;
  importo: number | null;
  periodo: Periodo | null;
};

export type Modifiche = {
  importo?: number;
  descrizione?: string;
  data?: string;
  categoria?: string;
};

export type Comando =
  | { azione: "aggiungi"; spesa: SpesaLetta }
  | { azione: "domanda"; interpretazione: Interpretazione }
  | { azione: "elimina"; riferimento: Riferimento }
  | { azione: "modifica"; riferimento: Riferimento; modifiche: Modifiche }
  | { azione: "consiglio" }
  | { azione: "non_capito"; messaggio: string };

const NON_CAPITO =
  "Non ho capito. Puoi dire per esempio: “pizza 18 ieri”, “quanto ho speso questo mese?” oppure “elimina l'ultima spesa”.";

/* ---------- Riconoscere il comando ---------- */

/**
 * Parole che indicano qualcosa di diverso dall'aggiungere una spesa. Se non
 * ce n'è nessuna, la frase si prova a leggere da soli (come "A parole"),
 * senza chiamare l'AI: più veloce e senza consumare quota.
 */
const PAROLE_NON_AGGIUNTA =
  /\b(elimina|eliminare|cancella|cancellare|togli|rimuovi|modifica|cambia|correggi|sposta|era|erano|quanto|quanti|quante|quando|qual|quale|quali|cosa|come|perche|dove|consiglio|consigli|risparmi\w*|budget)\b|\?/;

function senzaAccenti(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function serveAI(testo: string): boolean {
  return PAROLE_NON_AGGIUNTA.test(senzaAccenti(testo));
}

/** Toglie "aggiungi", "segna una spesa di"… dall'inizio: resta la spesa. */
export function pulisciComando(testo: string): string {
  return testo
    .trim()
    .replace(
      /^(aggiungi|aggiungere|segna|segnami|registra|inserisci|metti)(\s+una)?(\s+spesa\s+(di|da|per))?\s+/i,
      "",
    )
    .trim();
}

function oggetto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizzaRiferimento(v: unknown): Riferimento {
  const r = oggetto(v);
  const importo = typeof r["importo"] === "number" ? r["importo"] : Number(r["importo"]);
  return {
    ultima: r["ultima"] === true,
    testo:
      typeof r["testo"] === "string" && r["testo"].trim() ? r["testo"].trim().slice(0, 40) : null,
    importo: Number.isFinite(importo) && importo > 0 ? Math.round(importo * 100) / 100 : null,
    periodo: r["periodo"] ? normalizzaPeriodo(r["periodo"]) : null,
  };
}

function normalizzaModifiche(v: unknown, oggi: string, categorie: string[]): Modifiche {
  const m = oggetto(v);
  const out: Modifiche = {};
  const importo = typeof m["importo"] === "number" ? m["importo"] : Number(m["importo"]);
  if (m["importo"] != null && Number.isFinite(importo) && importo > 0 && importo < 1_000_000) {
    out.importo = Math.round(importo * 100) / 100;
  }
  if (typeof m["descrizione"] === "string" && m["descrizione"].trim()) {
    const d = m["descrizione"].trim().slice(0, 80);
    out.descrizione = d.charAt(0).toUpperCase() + d.slice(1);
  }
  if (
    typeof m["data"] === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(m["data"]) &&
    m["data"] >= spostaGiorni(oggi, -366) &&
    m["data"] <= spostaGiorni(oggi, 366)
  ) {
    out.data = m["data"];
  }
  if (typeof m["categoria"] === "string" && categorie.includes(m["categoria"])) {
    out.categoria = m["categoria"];
  }
  return out;
}

/** Ripulisce il comando arrivato dall'AI: ciò che non torna diventa "non capito". */
export function normalizzaComando(grezzo: unknown, oggi: string, categorie: string[]): Comando {
  const g = oggetto(grezzo);
  const messaggio =
    typeof g["messaggio"] === "string" && g["messaggio"].trim()
      ? g["messaggio"].trim().slice(0, 200)
      : NON_CAPITO;
  switch (g["azione"]) {
    case "aggiungi": {
      const spesa = normalizzaSpesaAI(g["spesa"], oggi, categorie);
      return spesa
        ? { azione: "aggiungi", spesa }
        : {
            azione: "non_capito",
            messaggio: "Non ho capito l'importo. Riprova con qualcosa come “pizza 18 ieri”.",
          };
    }
    case "domanda":
      return {
        azione: "domanda",
        interpretazione: normalizzaInterpretazione(g["domanda"], categorie),
      };
    case "elimina":
      return { azione: "elimina", riferimento: normalizzaRiferimento(g["riferimento"]) };
    case "modifica": {
      const modifiche = normalizzaModifiche(g["modifiche"], oggi, categorie);
      if (Object.keys(modifiche).length === 0) {
        return {
          azione: "non_capito",
          messaggio: "Non ho capito cosa cambiare. Prova con “la pizza di ieri era 20 euro”.",
        };
      }
      return {
        azione: "modifica",
        riferimento: normalizzaRiferimento(g["riferimento"]),
        modifiche,
      };
    }
    case "consiglio":
      return { azione: "consiglio" };
    default:
      return { azione: "non_capito", messaggio };
  }
}

/* ---------- Trovare la spesa da eliminare o modificare ---------- */

/**
 * Le spese che corrispondono al riferimento, dalla più probabile.
 *
 * "transazioni" arriva già ordinato dalla più recente INSERITA (quando il
 * database lo sa): per "l'ultima spesa" vale quell'ordine, perché chi dice
 * "elimina l'ultima" subito dopo averla dettata intende quella appena
 * aggiunta, anche se aveva la data di ieri. Negli altri casi vince la data.
 */
export function trovaSpese(
  transazioni: Transaction[],
  rif: Riferimento,
  oggi: string,
  ordinateDaInserimento: boolean,
): Transaction[] {
  const parola = rif.testo ? radice(rif.testo) : "";
  const intervallo = rif.periodo ? intervalloDi(rif.periodo, oggi) : null;
  const trovate = transazioni.filter(
    (t) =>
      (!parola || contieneTesto(t.nota, parola)) &&
      (rif.importo === null || Math.abs(t.importo - rif.importo) < 0.005) &&
      (!intervallo || (t.data >= intervallo.da && t.data <= intervallo.a)),
  );
  const perData = !(rif.ultima && ordinateDaInserimento && !parola && !intervallo);
  const ordinate = perData
    ? [...trovate].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
    : trovate;
  return ordinate.slice(0, 5);
}

export function applicaModifiche(t: Transaction, m: Modifiche): Transaction {
  return {
    ...t,
    ...(m.importo !== undefined ? { importo: m.importo } : {}),
    ...(m.descrizione !== undefined ? { nota: m.descrizione } : {}),
    ...(m.data !== undefined ? { data: m.data } : {}),
    ...(m.categoria !== undefined ? { categoria: m.categoria } : {}),
  };
}

/* ---------- Frasi da pronunciare ---------- */

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "oggi", "ieri", "domani", "il 23 ottobre", "l'8 ottobre" (anno solo se diverso). */
export function dataParlata(iso: string, oggi: string): string {
  if (iso === oggi) return "oggi";
  if (iso === spostaGiorni(oggi, -1)) return "ieri";
  if (iso === spostaGiorni(oggi, 1)) return "domani";
  const [a, m, g] = iso.split("-").map(Number);
  const anno = a !== Number(oggi.slice(0, 4)) ? ` ${a}` : "";
  // "l'1", "l'8", "l'11": i numeri che si leggono con la vocale iniziale.
  const articolo = g === 1 || g === 8 || g === 11 ? "l'" : "il ";
  return `${articolo}${g} ${MESI[(m ?? 1) - 1] ?? ""}${anno}`;
}

function nomeCategoria(id: string, categorie: Category[]) {
  return categorie.find((c) => c.id === id)?.nome ?? "";
}

/** "“Pizza” da 18 € di ieri, in Cibo" */
export function descriviSpesa(t: Transaction, categorie: Category[], oggi: string): string {
  const nome = t.nota?.trim() || nomeCategoria(t.categoria, categorie) || "spesa";
  const quando = dataParlata(t.data, oggi);
  const di = quando.startsWith("il ")
    ? `del ${quando.slice(3)}`
    : quando.startsWith("l'")
      ? `dell'${quando.slice(2)}`
      : `di ${quando}`;
  const cat = nomeCategoria(t.categoria, categorie);
  return `“${nome}” da ${eur(t.importo)} ${di}${cat ? `, in ${cat}` : ""}`;
}

export function fraseAggiunta(t: Transaction, categorie: Category[], oggi: string): string {
  const nome = t.nota?.trim() || "Spesa";
  const cat = nomeCategoria(t.categoria, categorie);
  return `Aggiunta: ${nome}, ${eur(t.importo)}, ${dataParlata(t.data, oggi)}${cat ? `, in ${cat}` : ""}.`;
}

export function fraseConfermaElimina(
  candidate: Transaction[],
  categorie: Category[],
  oggi: string,
): string {
  const prima = candidate[0];
  if (!prima) return "Non ho trovato nessuna spesa così.";
  const d = descriviSpesa(prima, categorie, oggi);
  return candidate.length > 1
    ? `Ne ho trovate ${candidate.length}: la più recente è ${d}. Elimino questa?`
    : `Elimino ${d}?`;
}

export function fraseConfermaModifica(
  t: Transaction,
  m: Modifiche,
  categorie: Category[],
  oggi: string,
): string {
  const cambi: string[] = [];
  if (m.importo !== undefined) cambi.push(`importo da ${eur(t.importo)} a ${eur(m.importo)}`);
  if (m.descrizione !== undefined) cambi.push(`descrizione in “${m.descrizione}”`);
  if (m.data !== undefined) cambi.push(`data a ${dataParlata(m.data, oggi)}`);
  if (m.categoria !== undefined)
    cambi.push(`categoria in ${nomeCategoria(m.categoria, categorie)}`);
  return `Modifico ${descriviSpesa(t, categorie, oggi)}: ${cambi.join(", ")}. Confermi?`;
}

/** La risposta a una domanda, in una forma adatta a essere letta ad alta voce. */
export function rispostaParlata(r: Risposta): string {
  const parti: string[] = [];
  if (r.valore) parti.push(`${r.valore}.`);
  parti.push(r.frase.replace(/ · /g, ", ") + ".");
  if (r.righe?.length) {
    parti.push(
      r.righe
        .slice(0, 4)
        .map((x) => `${x.etichetta} ${x.valore}`)
        .join(", ") + ".",
    );
  }
  return parti.join(" ").replace(/\.\./g, ".");
}

/* ---------- Widget ---------- */

export type DatiWidget = {
  mese: string;
  speso: number;
  budget: number;
  restante: number | null;
  percentuale: number | null;
  previsto: number;
};

export function datiWidget(state: AppState, oggi: string): DatiWidget {
  const mk = monthKey(oggi);
  const speso = txRealizzate(
    state.transazioni.filter((t) => monthKey(t.data) === mk),
    oggi,
  ).reduce((s, t) => s + t.importo, 0);
  const budget = state.categorie.reduce((s, c) => s + c.budget, 0);
  const previsto = sommaPreviste(previsteDelMese(state, mk, oggi));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    mese: monthLabel(mk),
    speso: r2(speso),
    budget: r2(budget),
    restante: budget > 0 ? r2(budget - speso) : null,
    percentuale: budget > 0 ? Math.round((speso / budget) * 100) : null,
    previsto: r2(previsto),
  };
}
