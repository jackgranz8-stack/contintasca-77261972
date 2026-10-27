import { describe, expect, it } from "vitest";
import {
  calcolaAnalisi,
  datiAnalisiPerAI,
  fattoreArea,
  fattoreFamiglia,
  normalizzaCommento,
  riassuntoParlato,
  voceIstatPer,
} from "./analisi";
import { initialState, type AppState, type Transaction } from "./types";

const OGGI = "2026-10-15";
let n = 0;
const tx = (categoria: string, importo: number, data: string, nota = "x"): Transaction => ({
  id: `t${++n}`,
  categoria,
  importo,
  data,
  nota,
});

function stato(transazioni: Transaction[], budget: Record<string, number>, persone = 1): AppState {
  const base = initialState();
  return {
    ...base,
    profilo: { ...base.profilo, persone, abitazione: "affitto", auto: true },
    categorie: [
      { id: "cibo", nome: "Cibo", icona: "x", colore: "#1", budget: budget["cibo"] ?? 0 },
      { id: "auto", nome: "Auto", icona: "x", colore: "#2", budget: budget["auto"] ?? 0 },
      { id: "svago", nome: "Svago", icona: "x", colore: "#3", budget: budget["svago"] ?? 0 },
      { id: "casa", nome: "Casa", icona: "x", colore: "#4", budget: budget["casa"] ?? 0 },
      { id: "mediche", nome: "Spese mediche", icona: "x", colore: "#5", budget: 0 },
      { id: "altro", nome: "Altro", icona: "x", colore: "#6", budget: 0 },
    ],
    transazioni,
  };
}

// Tre mesi chiusi uguali: luglio, agosto, settembre.
const mesi = ["2026-07", "2026-08", "2026-09"];
const TX = mesi.flatMap((m) => [
  tx("cibo", 300, `${m}-05`),
  tx("auto", 400, `${m}-10`),
  tx("svago", 250, `${m}-12`),
  tx("casa", 600, `${m}-01`),
  tx("altro", 50, `${m}-20`),
]);

describe("voci Istat", () => {
  it("collega i nomi delle categorie alle voci giuste", () => {
    expect(voceIstatPer("Spese mediche")?.chiave).toBe("salute");
    expect(voceIstatPer("Cibo")?.chiave).toBe("alimentari");
    expect(voceIstatPer("Macchina")?.chiave).toBe("trasporti");
    expect(voceIstatPer("Bollette")?.chiave).toBe("utenze");
    expect(voceIstatPer("Altro")).toBeNull();
  });

  it("adatta la media al numero di persone", () => {
    expect(fattoreFamiglia(1)).toBeCloseTo(2070.43 / 2782.36, 4);
    expect(fattoreFamiglia(9)).toBeCloseTo(3578.53 / 2782.36, 4);
  });
});

describe("calcolaAnalisi", () => {
  const a = calcolaAnalisi(stato(TX, { cibo: 300, auto: 250, svago: 100, casa: 600 }), OGGI);

  it("usa la media degli ultimi tre mesi chiusi", () => {
    expect(a.mesi).toEqual(mesi);
    expect(a.totaleTuo).toBe(1600);
  });

  it("confronta con la media italiana per una persona in affitto", () => {
    const auto = a.voci.find((v) => v.id === "auto")!;
    expect(auto.riferimento).toBeCloseTo(294.06 * fattoreFamiglia(1), 1);
    expect(auto.differenza! > 0).toBe(true);
    const casa = a.voci.find((v) => v.id === "casa")!;
    expect(casa.riferimento).toBeCloseTo(438 + 114.39 * fattoreFamiglia(1), 1);
    expect(a.voci.find((v) => v.id === "altro")!.riferimento).toBeNull();
    // Dalla più sopra la media.
    expect(a.voci[0]!.id).toBe("auto");
  });

  it("propone tagli solo sulle spese riducibili, per coprire lo sforamento", () => {
    expect(a.scartoBudget).toBe(350);
    // "Altro" non ha confronto Istat ma resta una spesa che si può ridurre.
    expect(a.piano.map((p) => p.id).sort()).toEqual(["altro", "auto", "cibo", "svago"]);
    expect(a.piano.some((p) => p.id === "casa")).toBe(false);
    const totale = a.piano.reduce((s, p) => s + p.taglio, 0);
    expect(totale).toBeGreaterThanOrEqual(330);
    expect(a.piano.every((p) => p.taglio % 5 === 0)).toBe(true);
  });

  it("nessun piano se si è già dentro il budget", () => {
    const b = calcolaAnalisi(stato(TX, { cibo: 500, auto: 500, svago: 300, casa: 700 }), OGGI);
    expect(b.scartoBudget! < 0).toBe(true);
    expect(b.piano).toEqual([]);
  });

  it("mese in corso: speso, restante e spendibile al giorno", () => {
    const s = stato([...TX, tx("cibo", 500, "2026-10-03")], {
      cibo: 300,
      auto: 250,
      svago: 100,
      casa: 600,
    });
    const m = calcolaAnalisi(s, OGGI).meseCorrente;
    expect(m.speso).toBe(500);
    expect(m.restante).toBe(750);
    expect(m.giorniRimasti).toBe(17);
    expect(m.alGiorno).toBeCloseTo(750 / 17, 1);
  });

  it("all'AI vanno solo totali, senza descrizioni", () => {
    const d = JSON.stringify(datiAnalisiPerAI(a));
    expect(d).not.toContain('"x"');
    expect(d).toContain("media_italiana");
  });
});

describe("normalizzaCommento", () => {
  it("tiene sintesi e al massimo 4 punti validi", () => {
    const c = normalizzaCommento({
      sintesi: "Ok",
      punti: [
        1,
        { titolo: "A", testo: "a" },
        { titolo: "B" },
        ...Array(5).fill({ titolo: "C", testo: "c" }),
      ],
    });
    expect(c.sintesi).toBe("Ok");
    expect(c.punti).toHaveLength(4);
    expect(normalizzaCommento(null)).toEqual({ sintesi: "", punti: [] });
  });
});

describe("riassuntoParlato", () => {
  it("numeri chiave in poche frasi", () => {
    const s = stato([...TX, tx("cibo", 500, "2026-10-03")], {
      cibo: 300,
      auto: 250,
      svago: 100,
      casa: 600,
    });
    const t = riassuntoParlato(calcolaAnalisi(s, OGGI)).replace(/\s/g, " ");
    expect(t).toContain("ti restano 750 €");
    expect(t).toContain("spendi di più in Auto");
    expect(t).toContain("Per restare nel budget riduci");
  });
});

describe("piano con sforamento piccolo", () => {
  it("non propone più tagli del necessario", () => {
    // Media 1600, budget 1596: sfora di 4 €.
    const a = calcolaAnalisi(stato(TX, { cibo: 300, auto: 396, svago: 300, casa: 600 }), OGGI);
    expect(a.scartoBudget).toBe(4);
    expect(a.piano).toHaveLength(1);
  });
});

describe("profilo completo: area, casa divisa, reddito", () => {
  const conProfilo = (extra: Partial<AppState["profilo"]>) => {
    const s = stato(TX, { cibo: 300, auto: 250, svago: 100, casa: 600 });
    return { ...s, profilo: { ...s.profilo, ...extra } };
  };

  it("la media si adatta all'area geografica", () => {
    const nord = calcolaAnalisi(conProfilo({ regione: "Emilia-Romagna" }), OGGI);
    const sud = calcolaAnalisi(conProfilo({ regione: "Puglia" }), OGGI);
    expect(nord.area).toBe("Nord-est");
    expect(sud.area).toBe("Sud");
    expect(nord.totaleRiferimento).toBeGreaterThan(sud.totaleRiferimento);
    expect(fattoreArea("")).toBe(1);
  });

  it("affitto diviso: conta solo la propria quota, con l'affitto dell'area", () => {
    const a = calcolaAnalisi(conProfilo({ regione: "Lombardia", quotaCasa: 0.5 }), OGGI);
    const casa = a.voci.find((v) => v.id === "casa")!;
    const mobili = 114.39 * fattoreFamiglia(1) * fattoreArea("Lombardia");
    expect(casa.riferimento).toBeCloseTo(477 * 0.5 + mobili, 1);
  });

  it("con il reddito calcola quanto si risparmia", () => {
    const a = calcolaAnalisi(conProfilo({ reddito: 2000 }), OGGI);
    expect(a.risparmioMedio).toBe(400);
    expect(a.tassoRisparmio).toBe(20);
    expect(riassuntoParlato(a).replace(/\s/g, " ")).toContain("metti da parte 400 €");
    const b = calcolaAnalisi(conProfilo({ reddito: 1500 }), OGGI);
    expect(b.risparmioMedio).toBe(-100);
    expect(datiAnalisiPerAI(b).reddito_netto_mensile).toBe(1500);
  });
});
