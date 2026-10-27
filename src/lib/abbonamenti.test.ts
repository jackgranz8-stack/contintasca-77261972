import { describe, expect, it } from "vitest";
import { trovaAbbonamenti } from "./abbonamenti";
import { initialState, type AppState, type Transaction } from "./types";

const OGGI = "2026-10-26";
let n = 0;
const tx = (nota: string, importo: number, data: string, categoria = "svago"): Transaction => ({
  id: `t${++n}`,
  nota,
  importo,
  data,
  categoria,
});

function stato(transazioni: Transaction[], extra: Partial<AppState> = {}): AppState {
  return {
    ...initialState(),
    categorie: [
      { id: "svago", nome: "Svago", icona: "x", colore: "#000", budget: 0 },
      { id: "cibo", nome: "Cibo", icona: "x", colore: "#000", budget: 0 },
    ],
    transazioni,
    ...extra,
  };
}

const netflix = [
  tx("Netflix", 12.99, "2026-07-15"),
  tx("Netflix", 12.99, "2026-08-15"),
  tx("netflix", 13.99, "2026-09-16"), // aumento di prezzo e minuscolo
  tx("Netflix", 13.99, "2026-10-15"),
];

describe("trovaAbbonamenti", () => {
  it("trova un abbonamento anche se il prezzo cambia un po'", () => {
    const [a] = trovaAbbonamenti(stato(netflix), OGGI);
    expect(a).toMatchObject({ nome: "Netflix", importo: 13.99, giorno: 15, mesi: 4 });
    expect(a?.ultimaData).toBe("2026-10-15");
  });

  it("ignora le spese che tornano più volte al mese", () => {
    const spesa = ["07", "08", "09", "10"].flatMap((m) => [
      tx("Spesa Esselunga", 60, `2026-${m}-03`, "cibo"),
      tx("Spesa Esselunga", 40, `2026-${m}-12`, "cibo"),
    ]);
    expect(trovaAbbonamenti(stato(spesa), OGGI)).toEqual([]);
  });

  it("ignora importi o giorni troppo diversi", () => {
    const variabile = [
      tx("Luce", 40, "2026-08-05"),
      tx("Luce", 90, "2026-09-05"),
      tx("Luce", 60, "2026-10-05"),
    ];
    const sparsi = [
      tx("Cinema", 9, "2026-08-02"),
      tx("Cinema", 9, "2026-09-20"),
      tx("Cinema", 9, "2026-10-11"),
    ];
    expect(trovaAbbonamenti(stato([...variabile, ...sparsi]), OGGI)).toEqual([]);
  });

  it("ignora le spese che tornano solo ogni tanto", () => {
    const saltuario = [
      tx("Parrucchiere", 25, "2026-05-10"),
      tx("Parrucchiere", 25, "2026-07-10"),
      tx("Parrucchiere", 25, "2026-10-10"),
    ];
    expect(trovaAbbonamenti(stato(saltuario), OGGI)).toEqual([]);
  });

  it("ignora gli abbonamenti disdetti e quelli già ricorrenti", () => {
    const vecchio = [
      tx("Palestra", 30, "2026-05-01"),
      tx("Palestra", 30, "2026-06-01"),
      tx("Palestra", 30, "2026-07-01"),
    ];
    expect(trovaAbbonamenti(stato(vecchio), OGGI)).toEqual([]);
    const ricorrente = {
      id: "r1",
      nome: "Netflix",
      categoria: "svago",
      importo: 13.99,
      giorno: 15,
      attiva: true,
      cadenza: "mesi" as const,
      intervallo: 1,
      inizio: "2026-01-15",
    };
    expect(trovaAbbonamenti(stato(netflix, { ricorrenti: [ricorrente] }), OGGI)).toEqual([]);
  });

  it("non conta le spese generate da una ricorrente", () => {
    const generate = netflix.map((t) => ({ ...t, ricorrenteId: "r9" }));
    expect(trovaAbbonamenti(stato(generate), OGGI)).toEqual([]);
  });
});
