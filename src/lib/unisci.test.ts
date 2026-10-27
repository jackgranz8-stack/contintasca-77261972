import { describe, expect, it } from "vitest";
import { unisciModifiche } from "./unisci";
import { initialState, type AppState, type Transaction } from "./types";

const tx = (id: string, importo: number): Transaction => ({
  id,
  importo,
  categoria: "c",
  data: "2026-10-01",
  nota: id,
});
const con = (transazioni: Transaction[]): AppState => ({ ...initialState(), transazioni });

describe("unisciModifiche", () => {
  it("non cancella le spese aggiunte altrove (es. da Siri)", () => {
    const base = con([tx("a", 1)]);
    const locale = con([tx("a", 1), tx("b", 2)]); // aggiunta offline
    const remoto = con([tx("a", 1), tx("siri", 9)]); // aggiunta da Siri
    const ids = unisciModifiche(remoto, base, locale).transazioni.map((t) => t.id);
    expect(ids.sort()).toEqual(["a", "b", "siri"]);
  });

  it("applica eliminazioni e modifiche fatte sul telefono", () => {
    const base = con([tx("a", 1), tx("b", 2)]);
    const locale = con([tx("a", 5)]); // a modificata, b eliminata
    const remoto = con([tx("a", 1), tx("b", 2), tx("c", 3)]);
    const r = unisciModifiche(remoto, base, locale).transazioni;
    expect(r.map((t) => [t.id, t.importo]).sort()).toEqual([
      ["a", 5],
      ["c", 3],
    ]);
  });

  it("lascia le modifiche fatte altrove su ciò che il telefono non ha toccato", () => {
    const base = con([tx("a", 1)]);
    const locale = con([tx("a", 1)]);
    const remoto = con([tx("a", 7)]); // modificata da Siri
    expect(unisciModifiche(remoto, base, locale).transazioni[0]?.importo).toBe(7);
  });
});
