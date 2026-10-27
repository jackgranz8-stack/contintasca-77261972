import type { Category } from "./types";
import { categoriePerAI, chiamaAI } from "./ai";

/**
 * CATEGORIA SUGGERITA DALL'AI
 *
 * Ultimo tentativo, dopo lo storico: si chiede all'AI solo quando la
 * descrizione non è mai stata usata (per quelle già usate decide
 * categoriaPerDescrizione, che è istantanea e conosce le TUE abitudini).
 * All'AI va solo la descrizione e i nomi delle categorie.
 *
 * Le risposte restano in memoria sul telefono: la stessa descrizione non
 * viene chiesta due volte. Si tengono le ultime MAX_MEMORIA.
 */

const CHIAVE = "categorie-ai";
const MAX_MEMORIA = 300;

function normalizza(t: string) {
  return t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function leggiMemoria(): Record<string, string> {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(CHIAVE) : null;
    const o: unknown = v ? JSON.parse(v) : {};
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function salvaMemoria(chiave: string, categoria: string) {
  try {
    const m = leggiMemoria();
    delete m[chiave];
    m[chiave] = categoria;
    const voci = Object.entries(m).slice(-MAX_MEMORIA);
    localStorage.setItem(CHIAVE, JSON.stringify(Object.fromEntries(voci)));
  } catch {
    // Memoria piena o non disponibile: si richiederà la prossima volta.
  }
}

/** La categoria proposta dall'AI per una descrizione nuova, o null. Non lancia mai errori. */
export async function categoriaDaAI(
  descrizione: string,
  categorie: Category[],
): Promise<string | null> {
  const chiave = normalizza(descrizione);
  if (chiave.length < 3 || categorie.length === 0) return null;
  const valide = new Set(categorie.map((c) => c.id));

  const ricordata = leggiMemoria()[chiave];
  if (ricordata && valide.has(ricordata)) return ricordata;

  const esito = await chiamaAI("categoria", {
    descrizione: descrizione.trim().slice(0, 80),
    categorie: categoriePerAI(categorie),
  });
  if (!esito.ok) return null;
  const id = (esito.dati as { categoria?: unknown } | null)?.categoria;
  if (typeof id !== "string" || !valide.has(id)) return null;
  salvaMemoria(chiave, id);
  return id;
}
