import { describe, expect, it } from "vitest";
import { occorrenzeTra, prossimaOccorrenza, etichettaCadenza } from "./ricorrenze";
import type { Recurring } from "./types";

/**
 * Questa è la logica più delicata dell'app: sbagliarla significa registrare
 * spese che non esistono, oppure non registrarne di reali. Ed è anche il tipo
 * di errore che non si nota subito, perché si manifesta settimane dopo, in un
 * mese particolare.
 *
 * Sono funzioni pure (stessi dati in ingresso, sempre lo stesso risultato),
 * quindi si possono verificare senza database né browser.
 */

const base: Recurring = {
  id: "r1",
  nome: "Affitto",
  categoria: "casa",
  importo: 250,
  giorno: 14,
  attiva: true,
  cadenza: "mesi",
  intervallo: 1,
  inizio: "2026-06-14",
  fine: null,
};

describe("cadenza mensile", () => {
  it("cade ogni mese al giorno indicato", () => {
    expect(occorrenzeTra(base, "2026-06-01", "2026-09-02")).toEqual([
      "2026-06-14",
      "2026-07-14",
      "2026-08-14",
    ]);
  });

  it("non anticipa un'occorrenza non ancora arrivata", () => {
    expect(occorrenzeTra(base, "2026-09-01", "2026-09-13")).toEqual([]);
  });

  it("con intervallo 2 salta i mesi intermedi", () => {
    const r = { ...base, intervallo: 2, giorno: 5, inizio: "2026-05-05" };
    expect(occorrenzeTra(r, "2026-05-01", "2026-12-31")).toEqual([
      "2026-05-05",
      "2026-07-05",
      "2026-09-05",
      "2026-11-05",
    ]);
  });

  it("conta l'intervallo dalla data di inizio, non dall'inizio dell'anno", () => {
    const r = { ...base, intervallo: 3, giorno: 10, inizio: "2026-02-10" };
    const occ = occorrenzeTra(r, "2026-01-01", "2026-12-31");
    expect(occ).toEqual(["2026-02-10", "2026-05-10", "2026-08-10", "2026-11-10"]);
  });

  it("cade anche a febbraio: il giorno è limitato a 28", () => {
    const r = { ...base, giorno: 28, inizio: "2027-01-28" };
    expect(occorrenzeTra(r, "2027-02-01", "2027-02-28")).toEqual(["2027-02-28"]);
  });

  it("non parte prima della data di inizio", () => {
    expect(occorrenzeTra(base, "2026-01-01", "2026-05-31")).toEqual([]);
  });
});

describe("cadenza settimanale", () => {
  it("cade ogni settimana nello stesso giorno", () => {
    const r = { ...base, cadenza: "settimane" as const, intervallo: 1, inizio: "2026-09-07" };
    expect(occorrenzeTra(r, "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("con intervallo 2 salta una settimana", () => {
    const r = { ...base, cadenza: "settimane" as const, intervallo: 2, inizio: "2026-08-03" };
    expect(occorrenzeTra(r, "2026-09-01", "2026-09-30")).toEqual(["2026-09-14", "2026-09-28"]);
  });

  it("attraversa correttamente il cambio di mese", () => {
    const r = { ...base, cadenza: "settimane" as const, intervallo: 1, inizio: "2026-09-28" };
    expect(occorrenzeTra(r, "2026-09-28", "2026-10-12")).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ]);
  });
});

describe("data di fine", () => {
  it("non genera nulla dopo la fine", () => {
    const r = { ...base, giorno: 10, inizio: "2026-07-10", fine: "2026-08-31" };
    expect(occorrenzeTra(r, "2026-07-01", "2026-12-31")).toEqual(["2026-07-10", "2026-08-10"]);
  });

  it("include l'occorrenza che cade esattamente il giorno di fine", () => {
    const r = { ...base, giorno: 10, inizio: "2026-07-10", fine: "2026-08-10" };
    expect(occorrenzeTra(r, "2026-07-01", "2026-12-31")).toEqual(["2026-07-10", "2026-08-10"]);
  });
});

describe("casi limite", () => {
  it("intervallo non valido (0) viene trattato come 1, senza ciclo infinito", () => {
    const r = { ...base, intervallo: 0 };
    const occ = occorrenzeTra(r, "2026-06-01", "2026-08-31");
    expect(occ).toEqual(["2026-06-14", "2026-07-14", "2026-08-14"]);
  });

  it("intervallo di date rovesciato non restituisce nulla", () => {
    expect(occorrenzeTra(base, "2026-09-30", "2026-09-01")).toEqual([]);
  });

  it("un periodo lunghissimo resta limitato: non genera migliaia di spese", () => {
    const r = { ...base, cadenza: "settimane" as const, intervallo: 1, inizio: "2020-01-01" };
    expect(occorrenzeTra(r, "2020-01-01", "2030-01-01").length).toBeLessThanOrEqual(60);
  });
});

describe("prossimaOccorrenza", () => {
  it("trova la prima data utile dopo quella indicata", () => {
    expect(prossimaOccorrenza(base, "2026-09-02")).toBe("2026-09-14");
  });

  it("restituisce null se la ricorrenza è già finita", () => {
    const r = { ...base, fine: "2026-08-31" };
    expect(prossimaOccorrenza(r, "2026-09-02")).toBeNull();
  });
});

describe("etichettaCadenza", () => {
  it("usa il singolare con intervallo 1", () => {
    expect(etichettaCadenza(base)).toBe("Ogni mese");
    expect(etichettaCadenza({ ...base, cadenza: "settimane" })).toBe("Ogni settimana");
  });

  it("usa il plurale con intervallo maggiore", () => {
    expect(etichettaCadenza({ ...base, intervallo: 3 })).toBe("Ogni 3 mesi");
    expect(etichettaCadenza({ ...base, cadenza: "settimane", intervallo: 2 })).toBe(
      "Ogni 2 settimane",
    );
  });
});
