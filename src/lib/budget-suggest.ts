import type { Category, Housing } from "./types";

type Draft = Category & { attiva: boolean };

/** Pesi per categoria in base alle risposte del profilo (abitazione, auto, persone). */
export function suggestBudgets(
  cats: Draft[],
  totale: number,
  abitazione: Housing,
  auto: boolean,
  persone: number,
): Draft[] {
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
