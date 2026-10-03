import { describe, expect, it } from "vitest";
import { categoriaPerDescrizione, suggerimentiDescrizione } from "./descrizioni";
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

describe("categoriaPerDescrizione", () => {
  function txc(nota: string, categoria: string, data: string): Transaction {
    n += 1;
    return { id: `c${n}`, importo: 10, categoria, data, nota };
  }
  const tutte = ["cibo", "svago", "abbonamenti", "auto"];

  it("propone la categoria dell'ultima spesa con la stessa descrizione", () => {
    const t = [txc("Spesa Esselunga", "cibo", "2026-05-01")];
    expect(categoriaPerDescrizione(t, "Spesa Esselunga", tutte)).toBe("cibo");
  });

  it("vince la più recente, non la più frequente", () => {
    const t = [
      txc("Netflix", "svago", "2026-01-01"),
      txc("Netflix", "svago", "2026-02-01"),
      txc("Netflix", "svago", "2026-03-01"),
      txc("Netflix", "abbonamenti", "2026-04-01"),
    ];
    expect(categoriaPerDescrizione(t, "Netflix", tutte)).toBe("abbonamenti");
  });

  it("non considera maiuscole, accenti e spazi ai bordi", () => {
    const t = [txc("Caffè al bar", "cibo", "2026-05-01")];
    expect(categoriaPerDescrizione(t, "  caffe AL BAR ", tutte)).toBe("cibo");
  });

  it("serve la descrizione intera: un inizio non basta", () => {
    const t = [txc("Benzina auto", "auto", "2026-05-01")];
    expect(categoriaPerDescrizione(t, "Benzina", tutte)).toBeNull();
  });

  it("ignora le categorie che non esistono più", () => {
    const t = [txc("Palestra", "svago", "2026-01-01"), txc("Palestra", "eliminata", "2026-05-01")];
    expect(categoriaPerDescrizione(t, "Palestra", tutte)).toBe("svago");
  });

  it("senza precedenti o senza testo non propone nulla", () => {
    expect(categoriaPerDescrizione([], "Benzina", tutte)).toBeNull();
    expect(categoriaPerDescrizione([txc("Benzina", "auto", "2026-05-01")], "  ", tutte)).toBeNull();
  });
});
