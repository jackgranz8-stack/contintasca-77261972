import type { AppState, Housing } from "./types";
import { monthKey, monthLabel, shiftMonth } from "./format";

/**
 * ANALISI DELLE SPESE: CONFRONTO CON LA MEDIA ITALIANA E PIANO PER IL BUDGET
 *
 * Risponde a "su cosa spendo più della media italiana?" e "su cosa devo
 * risparmiare per restare nel budget?". Tutti i numeri li calcola questo
 * file; all'AI vanno poi solo questi totali, per scrivere i consigli.
 *
 * RIFERIMENTO: Istat, "Le spese per i consumi delle famiglie – Anno 2025"
 * (pubblicato l'8 ottobre 2026), Prospetti A e B. Spesa media mensile per
 * famiglia, in euro. Da aggiornare ogni ottobre, quando esce il nuovo anno.
 *
 * COME SI ADATTA AL PROFILO
 * - Persone in famiglia: la media nazionale (2.782 €) è di una famiglia
 *   "media"; Istat dà anche il totale per numero di componenti (1 persona
 *   2.070 €, 2 persone 2.896 €…). Ogni voce viene riproporzionata con quel
 *   rapporto. È una stima: con più persone pesa di più il cibo e meno la
 *   casa, e la proporzione semplice non lo coglie del tutto.
 * - Dove si vive: si usa la media della RIPARTIZIONE (Nord-ovest, Nord-est,
 *   Centro, Sud, Isole) e non della singola regione, perché per alcune
 *   regioni il campione Istat è piccolo e la stima ballerina (l'Umbria 2025
 *   ha un errore del 12%). Nord-est 3.087 € contro Sud 2.215 €: fa molta
 *   differenza.
 * - Abitazione: per la categoria Casa il riferimento è l'affitto medio della
 *   propria area (Nord 463-477 €, Centro 456 €, Sud e Isole circa 370 €) o la
 *   rata media del mutuo (565 €), moltiplicati per la quota che si paga se la
 *   casa è divisa, più la spesa media per mobili e articoli per la casa.
 * - Reddito (facoltativo): permette di dire quanto si risparmia ogni mese.
 * - Gli "affitti figurativi" (611 €: quanto pagherebbe d'affitto chi vive in
 *   casa propria) Istat li conta come spesa, ma nessuno li paga davvero:
 *   qui sono esclusi.
 *
 * Le categorie dell'app le sceglie l'utente: il confronto si fa solo per
 * quelle il cui nome fa capire a quale voce Istat corrispondono. Le altre
 * ("Altro") si mostrano senza confronto.
 */

export const FONTE_ISTAT =
  "Istat, Spese per consumi delle famiglie, anno 2025 (media mensile per famiglia)";

const ISTAT_TOTALE = 2782.36;
const ISTAT_AFFITTI_FIGURATIVI = 611.44;
const ISTAT_RISTRUTTURAZIONI = 37.19;
const ISTAT_AFFITTO_MEDIO = 438; // famiglie in affitto
const ISTAT_QUOTA_AFFITTO = 0.181; // famiglie in affitto sul totale
const ISTAT_RATA_MUTUO = 565; // famiglie con mutuo (non è spesa per consumi)

type Area = "nordOvest" | "nordEst" | "centro" | "sud" | "isole";

/** Spesa media mensile per ripartizione geografica (Prospetto B). */
const ISTAT_PER_AREA: Record<Area, number> = {
  nordOvest: 2974.07,
  nordEst: 3086.67,
  centro: 3052.18,
  sud: 2215.48,
  isole: 2338.13,
};

/** Affitto medio mensile di chi è in affitto, per ripartizione (pag. 8 del report). */
const AFFITTO_PER_AREA: Record<Area, number> = {
  nordOvest: 477,
  nordEst: 463,
  centro: 456,
  sud: 369,
  isole: 371,
};

const AREA_DI: Record<string, Area> = {
  Piemonte: "nordOvest",
  "Valle d'Aosta": "nordOvest",
  Liguria: "nordOvest",
  Lombardia: "nordOvest",
  "Trentino-Alto Adige": "nordEst",
  Veneto: "nordEst",
  "Friuli-Venezia Giulia": "nordEst",
  "Emilia-Romagna": "nordEst",
  Toscana: "centro",
  Umbria: "centro",
  Marche: "centro",
  Lazio: "centro",
  Abruzzo: "sud",
  Molise: "sud",
  Campania: "sud",
  Puglia: "sud",
  Basilicata: "sud",
  Calabria: "sud",
  Sicilia: "isole",
  Sardegna: "isole",
};

const NOME_AREA: Record<Area, string> = {
  nordOvest: "Nord-ovest",
  nordEst: "Nord-est",
  centro: "Centro",
  sud: "Sud",
  isole: "Isole",
};

/** La ripartizione Istat di una regione, o null se la regione non è indicata. */
export function areaDi(regione: string): Area | null {
  return AREA_DI[regione] ?? null;
}

/** Spesa media mensile per numero di componenti (Prospetto B). */
const ISTAT_PER_COMPONENTI: Record<number, number> = {
  1: 2070.43,
  2: 2895.94,
  3: 3306.02,
  4: 3582.58,
  5: 3578.53,
};

type VoceIstat = {
  chiave: string;
  nome: string;
  mensile: number;
  /** Parole del NOME della categoria che la collegano a questa voce. */
  parole: string[];
  /** Si può ridurre nel giro di un mese? (affitto e bollette no) */
  riducibile: boolean;
  /** Quanto, al minimo, ha senso proporre di tagliare (quota della spesa). */
  quotaTaglio: number;
};

/*
 * L'ordine conta: vince la prima voce che corrisponde. "Spese mediche" deve
 * finire in Salute prima che "spes…" la porti altrove.
 */
const VOCI: VoceIstat[] = [
  {
    chiave: "salute",
    nome: "Salute",
    mensile: 113.18,
    parole: ["medic", "salute", "farmac", "sanit", "dentist"],
    riducibile: false,
    quotaTaglio: 0,
  },
  {
    chiave: "ristorazione",
    nome: "Ristoranti e bar",
    mensile: 163.67,
    parole: ["ristor", "bar", "uscit", "pizzer", "aperitiv", "fuori"],
    riducibile: true,
    quotaTaglio: 0.25,
  },
  {
    chiave: "alimentari",
    nome: "Alimentari",
    mensile: 552.06,
    parole: ["cibo", "spesa", "aliment", "supermerc", "mangiar", "cucina"],
    riducibile: true,
    quotaTaglio: 0.1,
  },
  {
    chiave: "trasporti",
    nome: "Trasporti",
    mensile: 294.06,
    parole: ["auto", "macchin", "trasport", "carbur", "benzin", "moto", "mezzi", "viaggi lavoro"],
    riducibile: true,
    quotaTaglio: 0.1,
  },
  {
    chiave: "utenze",
    // Abitazione al netto di affitti figurativi, ristrutturazioni e affitti
    // veri (in media su tutte le famiglie): acqua, luce, gas, condominio,
    // piccola manutenzione. È una stima ricavata dai dati Istat.
    nome: "Bollette e spese della casa",
    mensile:
      1000.8 -
      ISTAT_AFFITTI_FIGURATIVI -
      ISTAT_RISTRUTTURAZIONI -
      ISTAT_AFFITTO_MEDIO * ISTAT_QUOTA_AFFITTO,
    parole: ["bollett", "utenz", "luce", "gas", "acqua", "energia", "condomin"],
    riducibile: false,
    quotaTaglio: 0,
  },
  {
    chiave: "comunicazione",
    nome: "Telefono e internet",
    mensile: 70.82,
    parole: ["telefon", "internet", "cellular", "abbonament"],
    riducibile: true,
    quotaTaglio: 0.15,
  },
  {
    chiave: "ricreazione",
    nome: "Svago, sport e cultura",
    mensile: 105.31,
    parole: ["svago", "tempo libero", "divertim", "hobby", "sport", "palestr", "cultur", "viagg"],
    riducibile: true,
    quotaTaglio: 0.25,
  },
  {
    chiave: "abbigliamento",
    nome: "Abbigliamento",
    mensile: 105.4,
    parole: ["abbigl", "vestit", "scarpe", "moda"],
    riducibile: true,
    quotaTaglio: 0.25,
  },
  {
    chiave: "cura",
    nome: "Cura della persona",
    mensile: 131.89,
    parole: ["cura", "bellezz", "parrucch", "igiene", "estetist"],
    riducibile: true,
    quotaTaglio: 0.2,
  },
  {
    chiave: "assicurazioni",
    nome: "Assicurazioni e banca",
    mensile: 71.52,
    parole: ["assicur", "banca", "conto"],
    riducibile: false,
    quotaTaglio: 0,
  },
  {
    chiave: "istruzione",
    nome: "Istruzione",
    mensile: 16.99,
    parole: ["scuol", "istruz", "univers", "corso"],
    riducibile: false,
    quotaTaglio: 0,
  },
  {
    chiave: "tabacchi",
    nome: "Alcolici e tabacchi",
    mensile: 42.27,
    parole: ["tabacc", "sigar", "alcol", "vino", "birra"],
    riducibile: true,
    quotaTaglio: 0.3,
  },
  {
    chiave: "casa",
    nome: "Casa",
    mensile: 114.39, // mobili, articoli e servizi per la casa; + affitto/mutuo dal profilo
    parole: ["casa", "affitt", "mutuo", "arred"],
    riducibile: false,
    quotaTaglio: 0,
  },
];

function semplice(t: string) {
  return t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** La voce Istat che corrisponde al nome di una categoria, o null. */
export function voceIstatPer(nomeCategoria: string): VoceIstat | null {
  const n = semplice(nomeCategoria);
  return VOCI.find((v) => v.parole.some((p) => n.includes(p))) ?? null;
}

/** Quanto la spesa di una famiglia di "persone" componenti differisce dalla media. */
export function fattoreFamiglia(persone: number): number {
  const p = Math.min(5, Math.max(1, Math.round(persone || 1)));
  return (ISTAT_PER_COMPONENTI[p] ?? ISTAT_TOTALE) / ISTAT_TOTALE;
}

/** Quanto si spende nell'area rispetto alla media italiana (1 se non indicata). */
export function fattoreArea(regione: string): number {
  const a = areaDi(regione);
  return a ? ISTAT_PER_AREA[a] / ISTAT_TOTALE : 1;
}

type ProfiloAnalisi = Pick<AppState["profilo"], "persone" | "abitazione" | "regione" | "quotaCasa">;

function riferimentoPer(v: VoceIstat, p: ProfiloAnalisi): number {
  const base = v.mensile * fattoreFamiglia(p.persone) * fattoreArea(p.regione);
  if (v.chiave !== "casa") return base;
  // Affitto e mutuo non dipendono dal numero di persone: si sommano interi,
  // per la quota che si paga davvero se la casa è divisa.
  const area = areaDi(p.regione);
  const affitto = area ? AFFITTO_PER_AREA[area] : ISTAT_AFFITTO_MEDIO;
  const quota = p.quotaCasa > 0 && p.quotaCasa <= 1 ? p.quotaCasa : 1;
  const alloggio =
    p.abitazione === "affitto"
      ? affitto * quota
      : p.abitazione === "mutuo"
        ? ISTAT_RATA_MUTUO * quota
        : 0;
  return base + alloggio;
}

export type VoceAnalisi = {
  id: string;
  nome: string;
  colore: string;
  /** Media mensile dell'utente nel periodo analizzato. */
  tua: number;
  budget: number;
  /** Media italiana per una famiglia come la sua, o null se non confrontabile. */
  riferimento: number | null;
  voceIstat: string | null;
  differenza: number | null;
  differenzaPct: number | null;
  riducibile: boolean;
};

export type TaglioProposto = { id: string; nome: string; taglio: number; nuovoTetto: number };

export type Analisi = {
  /** Mesi usati per le medie, dal più vecchio. */
  mesi: string[];
  etichettaPeriodo: string;
  persone: number;
  abitazione: Housing;
  auto: boolean;
  regione: string;
  /** Nome della ripartizione usata per la media ("Nord-est"), o null. */
  area: string | null;
  quotaCasa: number;
  reddito: number | null;
  /** Reddito meno spesa media mensile; null senza reddito. */
  risparmioMedio: number | null;
  /** Quota del reddito che resta, in percentuale; null senza reddito. */
  tassoRisparmio: number | null;
  totaleTuo: number;
  /** Spesa media italiana per una famiglia come la sua, senza affitti figurativi. */
  totaleRiferimento: number;
  budgetTotale: number;
  /** Media mensile meno budget: positivo = si sfora. */
  scartoBudget: number | null;
  meseCorrente: {
    etichetta: string;
    speso: number;
    giorniRimasti: number;
    /** Stima a fine mese al ritmo attuale. */
    proiezione: number;
    /** Budget ancora disponibile; null senza budget. */
    restante: number | null;
    /** Quanto si può spendere al giorno da qui a fine mese. */
    alGiorno: number | null;
  };
  voci: VoceAnalisi[];
  /** Tagli suggeriti per rientrare nel budget (vuoto se si è già dentro). */
  piano: TaglioProposto[];
  /** I tagli possibili sulle spese variabili non bastano a rientrare. */
  pianoInsufficiente: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Tagli arrotondati a 5 €: "taglia 37,42 €" non è un consiglio, "taglia 35 €" sì. */
const a5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

const MESI_ANALISI = 3;

export function calcolaAnalisi(state: AppState, oggi: string): Analisi {
  const mc = monthKey(oggi);
  const reali = state.transazioni.filter((t) => t.data <= oggi);

  // Ultimi mesi CHIUSI con almeno una spesa; se non ce ne sono, il mese in corso.
  const chiusi = Array.from({ length: MESI_ANALISI }, (_, i) => shiftMonth(mc, -(i + 1)))
    .filter((m) => reali.some((t) => monthKey(t.data) === m))
    .reverse();
  const mesi = chiusi.length > 0 ? chiusi : [mc];
  const nMesi = mesi.length;
  const delPeriodo = reali.filter((t) => mesi.includes(monthKey(t.data)));

  const { persone, abitazione, auto, regione, quotaCasa, reddito } = state.profilo;
  const voci: VoceAnalisi[] = state.categorie
    .map((c) => {
      const tua = r2(
        delPeriodo.filter((t) => t.categoria === c.id).reduce((s, t) => s + t.importo, 0) / nMesi,
      );
      const v = voceIstatPer(c.nome);
      const riferimento = v ? r2(riferimentoPer(v, state.profilo)) : null;
      const differenza = riferimento !== null ? r2(tua - riferimento) : null;
      return {
        id: c.id,
        nome: c.nome,
        colore: c.colore,
        tua,
        budget: c.budget,
        riferimento,
        voceIstat: v?.nome ?? null,
        differenza,
        differenzaPct:
          riferimento && riferimento > 0
            ? Math.round(((tua - riferimento) / riferimento) * 100)
            : null,
        riducibile: v?.riducibile ?? true,
      };
    })
    .filter((v) => v.tua > 0 || v.budget > 0)
    .sort((a, b) => (b.differenza ?? -Infinity) - (a.differenza ?? -Infinity) || b.tua - a.tua);

  const totaleTuo = r2(voci.reduce((s, v) => s + v.tua, 0));
  const budgetTotale = state.categorie.reduce((s, c) => s + c.budget, 0);
  const totaleRiferimento = r2(
    (ISTAT_TOTALE - ISTAT_AFFITTI_FIGURATIVI) * fattoreFamiglia(persone) * fattoreArea(regione),
  );
  const risparmioMedio = reddito ? r2(reddito - totaleTuo) : null;
  const area = areaDi(regione);

  // Mese in corso: quanto resta e a che ritmo si sta andando.
  const [y, m] = mc.split("-").map(Number);
  const giorniMese = new Date(y ?? 2000, m ?? 1, 0).getDate();
  const giorno = Number(oggi.slice(8, 10));
  const spesoMese = r2(
    reali.filter((t) => monthKey(t.data) === mc).reduce((s, t) => s + t.importo, 0),
  );
  const giorniRimasti = giorniMese - giorno + 1;
  const restante = budgetTotale > 0 ? r2(budgetTotale - spesoMese) : null;

  // Piano: se la media mensile supera il budget, dove tagliare.
  const scartoBudget = budgetTotale > 0 ? r2(totaleTuo - budgetTotale) : null;
  const piano: TaglioProposto[] = [];
  let pianoInsufficiente = false;
  if (scartoBudget !== null && scartoBudget > 0) {
    const candidati = voci
      .filter((v) => v.riducibile && v.tua > 0)
      .map((v) => {
        const quota = voceIstatPer(v.nome)?.quotaTaglio ?? 0.15;
        // Si può tagliare almeno l'eccesso sulla media italiana, e comunque
        // una quota ragionevole; mai più di metà di quella spesa.
        const eccesso = Math.max(0, v.differenza ?? 0);
        const potenziale = Math.min(v.tua * 0.5, Math.max(eccesso, v.tua * quota));
        return { v, potenziale };
      })
      .filter((c) => c.potenziale >= 5);
    const totPotenziale = candidati.reduce((s, c) => s + c.potenziale, 0);
    pianoInsufficiente = totPotenziale < scartoBudget;
    for (const { v, potenziale } of candidati) {
      const quotaGap = totPotenziale > 0 ? (scartoBudget * potenziale) / totPotenziale : 0;
      const taglio = a5(Math.min(potenziale, quotaGap));
      piano.push({ id: v.id, nome: v.nome, taglio, nuovoTetto: r2(Math.max(0, v.tua - taglio)) });
    }
    piano.sort((a, b) => b.taglio - a.taglio);
    // Con lo sforamento piccolo l'arrotondamento a 5 € gonfia il totale
    // (tre tagli da 5 € per uno sforamento di 4 €): si tolgono i tagli più
    // piccoli finché i restanti bastano comunque.
    while (piano.length > 1) {
      const totale = piano.reduce((s, p) => s + p.taglio, 0);
      const ultimo = piano[piano.length - 1]!;
      if (totale - ultimo.taglio < scartoBudget) break;
      piano.pop();
    }
  }

  return {
    mesi,
    etichettaPeriodo:
      chiusi.length > 0
        ? nMesi === 1
          ? monthLabel(mesi[0]!)
          : `media di ${monthLabel(mesi[0]!).toLowerCase()} – ${monthLabel(mesi[nMesi - 1]!).toLowerCase()}`
        : `${monthLabel(mc).toLowerCase()} (mese in corso)`,
    persone,
    abitazione,
    auto,
    regione,
    area: area ? NOME_AREA[area] : null,
    quotaCasa,
    reddito,
    risparmioMedio,
    tassoRisparmio:
      reddito && risparmioMedio !== null ? Math.round((risparmioMedio / reddito) * 100) : null,
    totaleTuo,
    totaleRiferimento,
    budgetTotale,
    scartoBudget,
    meseCorrente: {
      etichetta: monthLabel(mc),
      speso: spesoMese,
      giorniRimasti,
      proiezione: r2(giorno > 0 ? (spesoMese / giorno) * giorniMese : spesoMese),
      restante,
      alGiorno:
        restante !== null && giorniRimasti > 0 ? r2(Math.max(0, restante) / giorniRimasti) : null,
    },
    voci,
    piano,
    pianoInsufficiente,
  };
}

const ABITAZIONE: Record<Housing, string> = {
  affitto: "in affitto",
  mutuo: "con mutuo",
  proprieta: "in casa di proprietà",
  famiglia: "in famiglia",
};

/** Solo totali e confronti, già calcolati: è tutto ciò che vede l'AI. */
export function datiAnalisiPerAI(a: Analisi) {
  return {
    periodo: a.etichettaPeriodo,
    profilo: {
      persone_in_famiglia: a.persone,
      abitazione: ABITAZIONE[a.abitazione],
      quota_casa_pagata_percento:
        a.abitazione === "affitto" || a.abitazione === "mutuo"
          ? Math.round(a.quotaCasa * 100)
          : null,
      ha_auto: a.auto,
      area_geografica: a.area ?? "non indicata (media nazionale)",
    },
    reddito_netto_mensile: a.reddito,
    risparmio_medio_mensile: a.risparmioMedio,
    percentuale_reddito_risparmiata: a.tassoRisparmio,
    spesa_media_mensile: a.totaleTuo,
    media_italiana_famiglia_simile: a.totaleRiferimento,
    budget_mensile: a.budgetTotale || null,
    sforamento_medio_sul_budget: a.scartoBudget,
    mese_in_corso: {
      speso_finora: a.meseCorrente.speso,
      proiezione_fine_mese: a.meseCorrente.proiezione,
      budget_restante: a.meseCorrente.restante,
      spendibile_al_giorno: a.meseCorrente.alGiorno,
      giorni_rimasti: a.meseCorrente.giorniRimasti,
    },
    categorie: a.voci.map((v) => ({
      nome: v.nome,
      media_mensile: v.tua,
      budget: v.budget || null,
      media_italiana: v.riferimento,
      voce_istat: v.voceIstat,
      differenza_euro: v.differenza,
      differenza_percento: v.differenzaPct,
      riducibile_a_breve: v.riducibile,
    })),
    tagli_proposti: a.piano.map((p) => ({
      categoria: p.nome,
      taglio_mensile: p.taglio,
      nuovo_tetto: p.nuovoTetto,
    })),
    tagli_non_bastano: a.pianoInsufficiente,
    fonte: FONTE_ISTAT,
  };
}

export type PuntoAnalisi = { titolo: string; testo: string };

/** Ripulisce la risposta dell'AI: una sintesi e al massimo 4 punti. */
export function normalizzaCommento(grezzo: unknown): { sintesi: string; punti: PuntoAnalisi[] } {
  const g = (grezzo && typeof grezzo === "object" ? grezzo : {}) as {
    sintesi?: unknown;
    punti?: unknown;
  };
  const sintesi = typeof g.sintesi === "string" ? g.sintesi.trim().slice(0, 500) : "";
  const punti = Array.isArray(g.punti)
    ? g.punti
        .map((p) =>
          p && typeof p === "object" ? (p as { titolo?: unknown; testo?: unknown }) : {},
        )
        .filter((p) => typeof p.titolo === "string" && typeof p.testo === "string")
        .map((p) => ({
          titolo: String(p.titolo).trim().slice(0, 80),
          testo: String(p.testo).trim().slice(0, 400),
        }))
        .filter((p) => p.titolo && p.testo)
        .slice(0, 4)
    : [];
  return { sintesi, punti };
}

const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(n)
    .replace(/\s/g, " ");

/**
 * L'analisi in 3-4 frasi da leggere ad alta voce (Siri). Senza AI: è più
 * veloce, e a voce servono i numeri chiave, non un discorso.
 */
export function riassuntoParlato(a: Analisi): string {
  const frasi: string[] = [];
  const m = a.meseCorrente;
  if (m.restante !== null) {
    frasi.push(
      m.restante >= 0
        ? `Questo mese hai speso ${euro(m.speso)}: ti restano ${euro(m.restante)} per ${m.giorniRimasti} giorni, circa ${euro(m.alGiorno ?? 0)} al giorno.`
        : `Questo mese hai già superato il budget di ${euro(-m.restante)}.`,
    );
  } else {
    frasi.push(`Questo mese hai speso ${euro(m.speso)}. Non hai ancora impostato un budget.`);
  }
  if (a.risparmioMedio !== null) {
    frasi.push(
      a.risparmioMedio >= 0
        ? `In media metti da parte ${euro(a.risparmioMedio)} al mese, il ${a.tassoRisparmio}% di quello che guadagni.`
        : `In media spendi ${euro(-a.risparmioMedio)} al mese più di quanto guadagni.`,
    );
  }
  const sopra = a.voci.filter((v) => (v.differenza ?? 0) >= 10 && (v.differenzaPct ?? 0) >= 10);
  if (sopra.length > 0) {
    frasi.push(
      `Rispetto alla media italiana per una famiglia come la tua spendi di più in ${sopra
        .slice(0, 3)
        .map((v) => `${v.nome}, più ${euro(v.differenza ?? 0)}`)
        .join("; ")}.`,
    );
  } else {
    frasi.push("Nessuna categoria è sopra la media italiana per una famiglia come la tua.");
  }
  if (a.piano.length > 0) {
    frasi.push(
      `Per restare nel budget riduci ${a.piano
        .slice(0, 3)
        .map((p) => `${p.nome} di ${euro(p.taglio)}`)
        .join(", ")} al mese.`,
    );
    if (a.pianoInsufficiente) {
      frasi.push("Da sole le spese variabili non bastano: rivedi il budget o i costi fissi.");
    }
  } else if (a.scartoBudget !== null) {
    frasi.push("In media resti dentro il budget: la differenza puoi metterla da parte.");
  }
  return frasi.join(" ");
}
