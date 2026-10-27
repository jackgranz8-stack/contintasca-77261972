import { describe, expect, it } from "vitest";
import { leggiSpesaLocale, normalizzaSpesaAI } from "./spesaAParole";

const OGGI = "2026-10-26"; // lunedì

describe("leggiSpesaLocale", () => {
  it("la forma classica: cosa, quanto, quando", () => {
    expect(leggiSpesaLocale("pizza 18 ieri", OGGI)).toEqual({
      importo: 18,
      descrizione: "Pizza",
      data: "2026-10-25",
      categoria: null,
    });
  });

  it("virgola, euro e parole di contorno", () => {
    const s = leggiSpesaLocale("ho speso 12,50 € per la cena da Mario", OGGI);
    expect(s?.importo).toBe(12.5);
    expect(s?.descrizione).toBe("Cena da Mario");
    expect(s?.data).toBe(OGGI);
  });

  it("tiene gli accenti della descrizione", () => {
    expect(leggiSpesaLocale("caffè 1,20", OGGI)?.descrizione).toBe("Caffè");
  });

  it("giorni della settimana e giorni fa", () => {
    expect(leggiSpesaLocale("benzina 50 sabato", OGGI)?.data).toBe("2026-10-24");
    expect(leggiSpesaLocale("benzina 50 3 giorni fa", OGGI)).toMatchObject({
      importo: 50,
      data: "2026-10-23",
    });
    expect(leggiSpesaLocale("cinema 9 l’altro ieri", OGGI)?.data).toBe("2026-10-24");
  });

  it("lascia decidere all'AI quando non è sicuro", () => {
    expect(leggiSpesaLocale("2 caffè da 1,20", OGGI)).toBeNull(); // due numeri
    expect(leggiSpesaLocale("pizza ieri", OGGI)).toBeNull(); // niente importo
    expect(leggiSpesaLocale("18 euro", OGGI)).toBeNull(); // niente descrizione
  });
});

describe("normalizzaSpesaAI", () => {
  const cat = ["cibo", "auto"];
  it("accetta una risposta corretta", () => {
    expect(
      normalizzaSpesaAI(
        { importo: 2.4, descrizione: "caffè", data: "2026-10-26", categoria: "cibo" },
        OGGI,
        cat,
      ),
    ).toEqual({ importo: 2.4, descrizione: "Caffè", data: "2026-10-26", categoria: "cibo" });
  });

  it("scarta importi impossibili e corregge il resto", () => {
    expect(normalizzaSpesaAI({ importo: null }, OGGI, cat)).toBeNull();
    expect(normalizzaSpesaAI({ importo: -5 }, OGGI, cat)).toBeNull();
    const s = normalizzaSpesaAI(
      { importo: "10", descrizione: "x", data: "1999-01-01", categoria: "inventata" },
      OGGI,
      cat,
    );
    expect(s).toMatchObject({ importo: 10, data: OGGI, categoria: null });
  });
});
