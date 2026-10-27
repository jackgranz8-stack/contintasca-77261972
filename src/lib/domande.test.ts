import { describe, expect, it } from "vitest";
import { intervalloDi, normalizzaInterpretazione, radice, rispondi } from "./domande";
import type { Category, Transaction } from "./types";

const OGGI = "2026-10-26";
const CAT: Category[] = [
  { id: "cibo", nome: "Cibo", icona: "x", colore: "#000", budget: 0 },
  { id: "auto", nome: "Auto", icona: "x", colore: "#000", budget: 0 },
];
let n = 0;
const tx = (nota: string, categoria: string, importo: number, data: string): Transaction => ({
  id: `t${++n}`,
  nota,
  categoria,
  importo,
  data,
});
const DATI = [
  tx("Benzina", "auto", 50, "2026-10-05"),
  tx("Benzina", "auto", 45.5, "2026-09-12"),
  tx("Pizze asporto", "cibo", 18, "2026-10-10"),
  tx("Pizzeria", "cibo", 30, "2026-09-20"),
  tx("Spesa Esselunga", "cibo", 80, "2026-10-02"),
  tx("Benzina", "auto", 60, "2025-12-01"),
  tx("Benzina futura", "auto", 999, "2026-11-30"),
];
const ids = CAT.map((c) => c.id);
const chiedi = (g: unknown) => rispondi(normalizzaInterpretazione(g, ids), DATI, CAT, OGGI);

describe("normalizzaInterpretazione", () => {
  it("scarta tutto ciò che non torna", () => {
    const i = normalizzaInterpretazione(
      { tipo: "boh", periodo: { tipo: "mese", valore: "2026-13" }, categorie: ["cibo", "x", 3] },
      ids,
    );
    expect(i.tipo).toBe("non_capito");
    expect(i.periodo).toEqual({ tipo: "tutto" });
    expect(i.categorie).toEqual(["cibo"]);
  });

  it("un confronto senza secondo periodo diventa un totale", () => {
    expect(normalizzaInterpretazione({ tipo: "confronto" }, ids).tipo).toBe("totale");
  });

  it("limita i numeri a valori sensati", () => {
    const i = normalizzaInterpretazione(
      { tipo: "piu_care", limite: 500, periodo: { tipo: "ultimi_giorni", n: -4 } },
      ids,
    );
    expect(i.limite).toBe(10);
    expect(i.periodo).toEqual({ tipo: "ultimi_giorni", n: 1 });
  });

  it("non si rompe con input assurdi", () => {
    expect(normalizzaInterpretazione(null, ids).tipo).toBe("non_capito");
    expect(normalizzaInterpretazione("ciao", ids).tipo).toBe("non_capito");
  });
});

describe("intervalloDi", () => {
  it("risolve i periodi relativi rispetto a oggi", () => {
    expect(intervalloDi({ tipo: "mese_scorso" }, OGGI)).toEqual({
      da: "2026-09-01",
      a: "2026-09-30",
    });
    expect(intervalloDi({ tipo: "ultimi_mesi", n: 3 }, OGGI)).toEqual({
      da: "2026-08-01",
      a: OGGI,
    });
    expect(intervalloDi({ tipo: "ultimi_giorni", n: 7 }, OGGI)).toEqual({
      da: "2026-10-20",
      a: OGGI,
    });
    expect(intervalloDi({ tipo: "mese", valore: "2024-02" }, OGGI)).toEqual({
      da: "2024-02-01",
      a: "2024-02-29",
    });
    expect(intervalloDi({ tipo: "tutto" }, OGGI)).toBeNull();
  });
});

describe("radice", () => {
  it("toglie la vocale finale solo alle parole lunghe", () => {
    expect(radice("pizza")).toBe("pizz");
    expect(radice("bar")).toBe("bar");
  });
});

describe("rispondi", () => {
  it("totale per descrizione nell'anno, senza le spese future", () => {
    const r = chiedi({ tipo: "totale", periodo: { tipo: "anno_corrente" }, testo: "benzina" });
    expect(r.valore).toBe(eurTest(95.5));
    expect(r.frase).toContain("2 spese");
  });

  it("trova anche le forme diverse della parola", () => {
    const r = chiedi({ tipo: "totale", periodo: { tipo: "tutto" }, testo: "pizza" });
    expect(r.valore).toBe(eurTest(48));
  });

  it("per categoria, dalla più alta", () => {
    const r = chiedi({ tipo: "per_categoria", periodo: { tipo: "mese_corrente" } });
    expect(r.righe?.map((x) => x.etichetta)).toEqual(["Cibo", "Auto"]);
  });

  it("confronto fra due mesi", () => {
    const r = chiedi({
      tipo: "confronto",
      periodo: { tipo: "mese_corrente" },
      confronto: { tipo: "mese_scorso" },
      categorie: ["auto"],
    });
    expect(r.righe?.map((x) => x.valore)).toEqual([eurTest(50), eurTest(45.5)]);
    expect(r.valore?.startsWith("+")).toBe(true);
  });

  it("media mensile sui mesi del periodo", () => {
    const r = chiedi({
      tipo: "media_mensile",
      periodo: { tipo: "ultimi_mesi", n: 2 },
      testo: "benzina",
    });
    expect(r.valore).toBe(eurTest(47.75));
  });

  it("ultima volta", () => {
    const r = chiedi({ tipo: "ultima", periodo: { tipo: "tutto" }, testo: "benzina" });
    expect(r.valore).toBe("5 ott 2026");
  });

  it("nessuna spesa trovata", () => {
    const r = chiedi({ tipo: "totale", periodo: { tipo: "tutto" }, testo: "palestra" });
    expect(r.valore).toBeUndefined();
    expect(r.frase).toContain("Nessuna spesa");
  });

  it("domanda non capita: usa il messaggio dell'AI se c'è", () => {
    expect(chiedi({ tipo: "non_capito", messaggio: "Chiedimi delle spese" }).frase).toBe(
      "Chiedimi delle spese",
    );
  });
});

function eurTest(v: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: v % 1 === 0 ? 0 : 2,
  }).format(v);
}
