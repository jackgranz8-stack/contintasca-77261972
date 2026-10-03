import { describe, expect, it } from "vitest";
import { suggerimentiDescrizione } from "./descrizioni";
import type { Transaction } from "./types";

let n = 0;
function tx(nota: string, data = "2026-05-01"): Transaction {
  n += 1;
  return { id: `t${n}`, importo: 10, categoria: "cibo", data, nota };
}

describe("suggerimentiDescrizione", () => {
  it("senza niente di digitato non propone nulla", () => {
    expect(suggerimentiDescrizione([tx("Benzina")], "")).toEqual([]);
    expect(suggerimentiDescrizione([tx("Benzina")], "   ")).toEqual([]);
  });

  it("propone solo le descrizioni che iniziano per quanto digitato", () => {
    const t = [tx("Benzina"), tx("Bar colazione"), tx("Spesa Esselunga")];
    expect(suggerimentiDescrizione(t, "be")).toEqual(["Benzina"]);
  });

  it("non considera maiuscole e accenti", () => {
    const t = [tx("Caffè al bar")];
    expect(suggerimentiDescrizione(t, "CAFFE")).toEqual(["Caffè al bar"]);
    expect(suggerimentiDescrizione(t, "caffè")).toEqual(["Caffè al bar"]);
    expect(suggerimentiDescrizione(t, "Caff")).toEqual(["Caffè al bar"]);
  });

  it("mette per prime le descrizioni usate più volte", () => {
    const t = [tx("Spesa Conad"), tx("Spesa Esselunga"), tx("Spesa Esselunga"), tx("Spesa Lidl")];
    expect(suggerimentiDescrizione(t, "spesa")[0]).toBe("Spesa Esselunga");
  });

  it("a parità di usi viene prima la più recente", () => {
    const t = [tx("Pranzo ufficio", "2024-01-10"), tx("Pranzo fuori", "2026-05-20")];
    expect(suggerimentiDescrizione(t, "pranzo")).toEqual(["Pranzo fuori", "Pranzo ufficio"]);
  });

  it("raggruppa le scritture diverse e tiene la più recente", () => {
    const t = [tx("spesa esselunga", "2024-01-01"), tx("Spesa Esselunga", "2026-05-01")];
    expect(suggerimentiDescrizione(t, "spesa")).toEqual(["Spesa Esselunga"]);
  });

  it("non ripropone esattamente quello che si sta già scrivendo", () => {
    const t = [tx("Benzina"), tx("Benzina auto")];
    expect(suggerimentiDescrizione(t, "Benzina")).toEqual(["Benzina auto"]);
  });

  it("ignora le spese senza descrizione", () => {
    expect(suggerimentiDescrizione([tx(""), tx("   ")], "a")).toEqual([]);
  });

  it("rispetta il limite richiesto", () => {
    const t = [tx("Ba 1"), tx("Ba 2"), tx("Ba 3"), tx("Ba 4"), tx("Ba 5"), tx("Ba 6")];
    expect(suggerimentiDescrizione(t, "ba", 3)).toHaveLength(3);
  });
});
