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
 * "Caffè". Si cerca per inizio della descrizione, come chiede l'uso normale:
 * si digita l'inizio di quello che si ha in mente.
 */

/** Minuscolo, senza accenti e senza spazi ai bordi: la forma usata per i confronti. */
function normalizza(testo: string): string {
  return testo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Voce = { testo: string; usi: number; ultima: string };

/**
 * Le descrizioni già usate che iniziano per quanto digitato, dalla più
 * frequente alla meno frequente. A parità di usi viene prima la più recente:
 * fra due spese usate due volte ciascuna, quella di ieri è più probabile di
 * quella dell'anno scorso.
 */
export function suggerimentiDescrizione(
  transazioni: Transaction[],
  digitato: string,
  limite = 5,
): string[] {
  const prefisso = normalizza(digitato);
  if (!prefisso) return [];

  const voci = new Map<string, Voce>();
  for (const t of transazioni) {
    const testo = (t.nota ?? "").trim();
    if (!testo) continue;
    const chiave = normalizza(testo);
    if (!chiave.startsWith(prefisso)) continue;
    // Quello che si sta già scrivendo non è un suggerimento utile.
    if (chiave === prefisso) continue;

    const esistente = voci.get(chiave);
    if (!esistente) {
      voci.set(chiave, { testo, usi: 1, ultima: t.data });
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

  return [...voci.values()]
    .sort(
      (a, b) => b.usi - a.usi || (a.ultima < b.ultima ? 1 : -1) || a.testo.localeCompare(b.testo),
    )
    .slice(0, Math.max(0, limite))
    .map((v) => v.testo);
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
