import type { Transaction } from "./types";

/**
 * SUGGERIMENTI SULLE DESCRIZIONI GIÀ USATE
 *
 * Le stesse spese tornano ogni mese con lo stesso nome: "Spesa Esselunga",
 * "Benzina", "Abbonamento palestra". Riscriverle per intero ogni volta è
 * lavoro inutile, e basta una lettera diversa ("spesa esselunga" contro
 * "Spesa Esselunga") perché poi la ricerca nello storico non le trovi tutte
 * insieme. Proponendo quelle già inserite, le descrizioni restano coerenti
 * da sole.
 *
 * Il confronto ignora maiuscole e accenti: chi scrive "cafe" trova anche
 * "Caffè".
 *
 * SI CERCA PER "CONTIENE", NON SOLO PER INIZIO
 * Prima valeva solo l'inizio della descrizione: chi scriveva "esselunga"
 * non trovava "Spesa Esselunga". Ora basta che il testo compaia in un
 * punto qualsiasi. Perché la lista resti comunque prevedibile, l'ordine
 * premia DOVE il testo compare:
 *   1. all'inizio della descrizione   ("spe" → "Spesa Esselunga")
 *   2. all'inizio di una parola        ("esse" → "Spesa Esselunga")
 *   3. in mezzo a una parola           ("spe" → "Ospedale")
 * e dentro ciascun gruppo, come prima, dalla più usata alla meno usata e a
 * parità di usi dalla più recente.
 */

/** Minuscolo, senza accenti e senza spazi ai bordi: la forma usata per i confronti. */
function normalizza(testo: string): string {
  return testo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Il testo contiene la ricerca? Ignora maiuscole e accenti. Ricerca vuota = sì. */
export function contieneTesto(testo: string | null | undefined, ricerca: string): boolean {
  const q = normalizza(ricerca);
  if (!q) return true;
  return normalizza(testo ?? "").includes(q);
}

const LETTERA_O_CIFRA = /[\p{L}\p{N}]/u;

/** 0 = inizio descrizione, 1 = inizio di una parola, 2 = in mezzo a una parola, -1 = assente. */
function livelloCorrispondenza(chiave: string, q: string): number {
  const i = chiave.indexOf(q);
  if (i < 0) return -1;
  if (i === 0) return 0;
  // Si cerca la prima comparsa a inizio parola, non solo la prima in
  // assoluto: in "Bar sbarra" la "bar" giusta è la prima parola, ma in
  // "Rimborso bar" la prima comparsa utile è quella della seconda parola.
  let da = i;
  while (da >= 0) {
    const prima = chiave[da - 1] ?? "";
    if (!LETTERA_O_CIFRA.test(prima)) return 1;
    da = chiave.indexOf(q, da + 1);
  }
  return 2;
}

/**
 * Dove compare quanto digitato dentro la descrizione, in posizioni del
 * testo ORIGINALE (con maiuscole e accenti). Serve a evidenziare la parte
 * cercata nella tendina: la normalizzazione cambia la lunghezza del testo
 * ("è" diventa "e" + accento staccato), quindi le posizioni vanno
 * ricondotte all'originale carattere per carattere.
 */
export function posizioneCorrispondenza(
  testo: string,
  digitato: string,
): { inizio: number; fine: number } | null {
  const q = normalizza(digitato);
  if (!q) return null;

  let norm = "";
  const origine: number[] = [];
  const lunghezze: number[] = [];
  let pos = 0;
  for (const ch of testo) {
    const n = ch
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    for (const c of n) {
      norm += c;
      for (let k = 0; k < c.length; k++) {
        origine.push(pos);
        lunghezze.push(ch.length);
      }
    }
    pos += ch.length;
  }

  // Stessa preferenza dell'ordinamento: inizio di parola prima di metà parola.
  let i = norm.indexOf(q);
  if (i < 0) return null;
  let scelto = i;
  while (i >= 0) {
    if (i === 0 || !LETTERA_O_CIFRA.test(norm[i - 1] ?? "")) {
      scelto = i;
      break;
    }
    i = norm.indexOf(q, i + 1);
  }
  const ultimo = scelto + q.length - 1;
  return {
    inizio: origine[scelto] ?? 0,
    fine: (origine[ultimo] ?? 0) + (lunghezze[ultimo] ?? 1),
  };
}

type Voce = { testo: string; usi: number; ultima: string; livello: number };

/** Raggruppa le descrizioni uguali (a meno di maiuscole/accenti) contando usi e ultima data. */
function raccogli(transazioni: Transaction[], q: string): Map<string, Voce> {
  const voci = new Map<string, Voce>();
  for (const t of transazioni) {
    const testo = (t.nota ?? "").trim();
    if (!testo) continue;
    const chiave = normalizza(testo);
    const livello = q ? livelloCorrispondenza(chiave, q) : 0;
    if (livello < 0) continue;
    // Quello che si sta già scrivendo non è un suggerimento utile.
    if (q && chiave === q) continue;

    const esistente = voci.get(chiave);
    if (!esistente) {
      voci.set(chiave, { testo, usi: 1, ultima: t.data, livello });
      continue;
    }
    esistente.usi += 1;
    // Fra due scritture diverse della stessa descrizione vince la più
    // recente: è quella che l'utente usa adesso.
    if (t.data > esistente.ultima) {
      esistente.ultima = t.data;
      esistente.testo = testo;
    }
  }
  return voci;
}

function ordina(voci: Map<string, Voce>, limite: number): string[] {
  return [...voci.values()]
    .sort(
      (a, b) =>
        a.livello - b.livello ||
        b.usi - a.usi ||
        (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0) ||
        a.testo.localeCompare(b.testo),
    )
    .slice(0, Math.max(0, limite))
    .map((v) => v.testo);
}

/**
 * Le descrizioni già usate che contengono quanto digitato (vedi l'ordine in
 * testa al file). Senza nulla di digitato non propone niente: nel modulo
 * della nuova spesa una tendina che si apre da sola sul campo vuoto
 * coprirebbe il resto. Per la lista "a campo vuoto" c'è descrizioniFrequenti.
 */
export function suggerimentiDescrizione(
  transazioni: Transaction[],
  digitato: string,
  limite = 5,
): string[] {
  const q = normalizza(digitato);
  if (!q) return [];
  return ordina(raccogli(transazioni, q), limite);
}

/**
 * Le descrizioni più usate, a parità di usi la più recente: è la lista che
 * la ricerca dello storico mostra appena la si apre, prima di scrivere.
 */
export function descrizioniFrequenti(transazioni: Transaction[], limite = 8): string[] {
  return ordina(raccogli(transazioni, ""), limite);
}

/**
 * La categoria usata l'ultima volta con questa descrizione.
 *
 * Serve a precompilare la categoria quando si sceglie (o si riscrive) una
 * descrizione già usata: "Spesa Esselunga" è finita in Cibo le ultime venti
 * volte, non serve richiederlo. Conta la spesa più RECENTE e non la più
 * frequente: se un giorno si sposta "Netflix" da Svago ad Abbonamenti, da
 * quel momento deve proporre Abbonamenti, non restare ancorato al passato.
 *
 * Se la categoria nel frattempo è stata eliminata non viene proposta:
 * selezionarne una che non esiste più lascerebbe la griglia senza nessuna
 * casella accesa.
 */
export function categoriaPerDescrizione(
  transazioni: Transaction[],
  descrizione: string,
  categorieEsistenti: string[],
): string | null {
  const chiave = normalizza(descrizione);
  if (!chiave) return null;
  const valide = new Set(categorieEsistenti);

  let migliore: Transaction | null = null;
  for (const t of transazioni) {
    if (!valide.has(t.categoria)) continue;
    if (normalizza(t.nota ?? "") !== chiave) continue;
    if (!migliore || t.data > migliore.data) migliore = t;
  }
  return migliore ? migliore.categoria : null;
}
