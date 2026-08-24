import type { Category, Housing, Transaction } from "./types";
import { lastMonths, monthKey } from "./format";

type Draft = Category & { attiva: boolean };

function pesoProfilo(
  cats: Draft[],
  abitazione: Housing,
  auto: boolean,
  persone: number,
): Map<string, number> {
  const attive = cats.filter((c) => c.attiva);
  const casaPeso =
    abitazione === "affitto"
      ? 42
      : abitazione === "mutuo"
        ? 38
        : abitazione === "proprieta"
          ? 18
          : 6;
  const cibo = 22 + Math.max(0, persone - 1) * 6;
  const bollette = (abitazione === "famiglia" ? 4 : 12) + Math.max(0, persone - 1) * 2;
  const pesi = new Map<string, number>();
  for (const c of attive) {
    const n = c.nome.toLowerCase();
    let w = 8;
    if (n.includes("casa") || n.includes("affitto") || n.includes("mutuo")) w = casaPeso;
    else if (n.includes("cibo") || n.includes("spesa") || n.includes("aliment")) w = cibo;
    else if (n.includes("auto") || n.includes("trasport")) w = auto ? 14 : 4;
    else if (n.includes("bollett") || n.includes("utenz")) w = bollette;
    else if (n.includes("medic") || n.includes("salute")) w = 6 + Math.max(0, persone - 1) * 2;
    else if (n.includes("svago") || n.includes("tempo")) w = 10;
    else if (n.includes("altro")) w = 8;
    pesi.set(c.id, w);
  }
  return pesi;
}

/** Pesi per categoria in base alle risposte del profilo (abitazione, auto, persone). */
export function suggestBudgets(
  cats: Draft[],
  totale: number,
  abitazione: Housing,
  auto: boolean,
  persone: number,
): Draft[] {
  const pesi = pesoProfilo(cats, abitazione, auto, persone);
  const somma = [...pesi.values()].reduce((a, b) => a + b, 0) || 1;
  return cats.map((c) =>
    c.attiva
      ? {
          ...c,
          budget: Math.max(5, Math.round((((pesi.get(c.id) ?? 8) / somma) * totale) / 5) * 5),
        }
      : { ...c, budget: 0 },
  );
}

/**
 * Come suggestBudgets, ma tiene conto anche di quanto hai speso davvero negli
 * ultimi 3 mesi: dove c'è storico reale, pesa di più quello; dove manca (o è
 * una categoria nuova), si affida al profilo. Il risultato viene sempre
 * riproporzionato per sommare esattamente al nuovo totale scelto.
 */
export function suggestBudgetsWithHistory(
  cats: Draft[],
  totale: number,
  abitazione: Housing,
  auto: boolean,
  persone: number,
  transazioni: Transaction[],
): Draft[] {
  const attive = cats.filter((c) => c.attiva);
  const pesi = pesoProfilo(cats, abitazione, auto, persone);
  const sommaPesi = [...pesi.values()].reduce((a, b) => a + b, 0) || 1;

  const mesi = lastMonths(3);
  const medioStorico = new Map<string, number>();
  for (const c of attive) {
    const totaleMesi = mesi.reduce(
      (acc, mk) =>
        acc +
        transazioni
          .filter((t) => t.categoria === c.id && monthKey(t.data) === mk)
          .reduce((a, t) => a + t.importo, 0),
      0,
    );
    medioStorico.set(c.id, totaleMesi / mesi.length);
  }

  const grezzo = new Map<string, number>();
  for (const c of attive) {
    const storico = medioStorico.get(c.id) ?? 0;
    const daProfilo = ((pesi.get(c.id) ?? 8) / sommaPesi) * totale;
    // dove c'è spesa reale la peschiamo di più (60/40), altrimenti puro profilo
    grezzo.set(c.id, storico > 0 ? storico * 0.6 + daProfilo * 0.4 : daProfilo);
  }

  const sommaGrezzo = [...grezzo.values()].reduce((a, b) => a + b, 0) || 1;
  const scala = totale / sommaGrezzo;

  return cats.map((c) =>
    c.attiva
      ? { ...c, budget: Math.max(5, Math.round(((grezzo.get(c.id) ?? 0) * scala) / 5) * 5) }
      : { ...c, budget: 0 },
  );
}
