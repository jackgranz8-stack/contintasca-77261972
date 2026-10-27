import { describe, expect, it } from "vitest";
import { calcolaRiepilogo, datiPerAI, normalizzaConsigli, variazione } from "./riepilogo";
import { initialState, type AppState } from "./types";

const OGGI = "2026-10-26";
const stato: AppState = {
  ...initialState(),
  categorie: [
    { id: "cibo", nome: "Cibo", icona: "x", colore: "#000", budget: 300 },
    { id: "auto", nome: "Auto", icona: "x", colore: "#000", budget: 0 },
  ],
  transazioni: [
    { id: "1", nota: "Spesa", categoria: "cibo", importo: 360, data: "2026-09-10" },
    { id: "2", nota: "Benzina", categoria: "auto", importo: 50, data: "2026-09-12" },
    { id: "3", nota: "Spesa", categoria: "cibo", importo: 300, data: "2026-08-10" },
    { id: "4", nota: "Spesa", categoria: "cibo", importo: 280, data: "2026-07-10" },
    { id: "5", nota: "Futura", categoria: "cibo", importo: 999, data: "2026-11-01" },
  ],
};

describe("calcolaRiepilogo", () => {
  const r = calcolaRiepilogo(stato, "2026-09", OGGI);
  it("totali, medie e categorie del mese", () => {
    expect(r.totale).toBe(410);
    expect(r.numeroSpese).toBe(2);
    expect(r.mediaPrecedente).toBe(290);
    expect(r.categorie.map((c) => [c.nome, c.speso, c.media])).toEqual([
      ["Cibo", 360, 290],
      ["Auto", 50, null],
    ]);
  });

  it("all'AI vanno solo totali, senza descrizioni né date", () => {
    const d = JSON.stringify(datiPerAI(r, stato.profilo));
    expect(d).not.toContain("Spesa");
    expect(d).not.toContain("Benzina");
    expect(d).not.toContain("2026-09-10");
    expect(datiPerAI(r, stato.profilo).categorie[0]).toMatchObject({
      nome: "Cibo",
      variazione_percento: 24,
      oltre_budget: 60,
    });
  });
});

describe("variazione e consigli", () => {
  it("variazione percentuale", () => {
    expect(variazione(120, 100)).toBe(20);
    expect(variazione(50, null)).toBeNull();
  });

  it("tiene al massimo 3 consigli validi", () => {
    const c = normalizzaConsigli({
      consigli: [
        { titolo: "A", testo: "a" },
        { titolo: "", testo: "b" },
        { titolo: "C", testo: 3 },
        { titolo: "D", testo: "d" },
        { titolo: "E", testo: "e" },
        { titolo: "F", testo: "f" },
      ],
    });
    expect(c.map((x) => x.titolo)).toEqual(["A", "D", "E"]);
    expect(normalizzaConsigli("boh")).toEqual([]);
  });
});
