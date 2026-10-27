import { describe, expect, it } from "vitest";
import {
  dataParlata,
  datiWidget,
  fraseAggiunta,
  fraseConfermaElimina,
  fraseConfermaModifica,
  normalizzaComando,
  pulisciComando,
  rispostaParlata,
  serveAI,
  trovaSpese,
} from "./vocale";
import { initialState, type Category, type Transaction } from "./types";

const OGGI = "2026-10-26";
// Intl separa cifra e "€" con uno spazio speciale: nei confronti vale come spazio.
const sp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const CAT: Category[] = [
  { id: "cibo", nome: "Cibo", icona: "x", colore: "#000", budget: 300 },
  { id: "auto", nome: "Auto", icona: "x", colore: "#000", budget: 100 },
];
const ids = CAT.map((c) => c.id);
const tx = (
  id: string,
  nota: string,
  importo: number,
  data: string,
  categoria = "cibo",
): Transaction => ({
  id,
  nota,
  importo,
  data,
  categoria,
});
// Ordine "di inserimento": la prima è l'ultima inserita.
const TX = [
  tx("n", "Pizza", 18, "2026-10-25"),
  tx("m", "Benzina", 50, "2026-10-26", "auto"),
  tx("l", "Pizza", 22, "2026-10-10"),
];

describe("riconoscere il comando", () => {
  it("le frasi di sola spesa non chiamano l'AI", () => {
    expect(serveAI("pizza 18 ieri")).toBe(false);
    expect(serveAI("ho speso 12 per la cena")).toBe(false);
    expect(serveAI("quanto ho speso questo mese")).toBe(true);
    expect(serveAI("elimina l'ultima spesa")).toBe(true);
    expect(serveAI("la pizza di ieri era 20 euro")).toBe(true);
    expect(serveAI("perché spendo così tanto?")).toBe(true);
  });

  it("toglie le parole di comando dall'inizio", () => {
    expect(pulisciComando("Aggiungi una spesa di 20 euro per la pizza")).toBe(
      "20 euro per la pizza",
    );
    expect(pulisciComando("aggiungi spesa esselunga 60")).toBe("spesa esselunga 60");
    expect(pulisciComando("pizza 18")).toBe("pizza 18");
  });

  it("ripulisce i comandi dell'AI", () => {
    expect(normalizzaComando({ azione: "boh" }, OGGI, ids).azione).toBe("non_capito");
    expect(normalizzaComando({ azione: "aggiungi", spesa: { importo: 0 } }, OGGI, ids).azione).toBe(
      "non_capito",
    );
    const m = normalizzaComando(
      {
        azione: "modifica",
        riferimento: { testo: "pizza", periodo: { tipo: "ultimi_giorni", n: 2 } },
        modifiche: { importo: 20, categoria: "inventata" },
      },
      OGGI,
      ids,
    );
    expect(m).toEqual({
      azione: "modifica",
      riferimento: {
        ultima: false,
        testo: "pizza",
        importo: null,
        periodo: { tipo: "ultimi_giorni", n: 2 },
      },
      modifiche: { importo: 20 },
    });
    expect(normalizzaComando({ azione: "modifica", modifiche: {} }, OGGI, ids).azione).toBe(
      "non_capito",
    );
  });
});

describe("trovaSpese", () => {
  const rif = { ultima: false, testo: null, importo: null, periodo: null };
  it("l'ultima spesa è l'ultima inserita, anche se ha la data di ieri", () => {
    expect(trovaSpese(TX, { ...rif, ultima: true }, OGGI, true)[0]?.id).toBe("n");
    // Senza ordine di inserimento vince la data.
    expect(trovaSpese(TX, { ...rif, ultima: true }, OGGI, false)[0]?.id).toBe("m");
  });

  it("filtra per parola, importo e periodo", () => {
    expect(trovaSpese(TX, { ...rif, testo: "pizze" }, OGGI, true).map((t) => t.id)).toEqual([
      "n",
      "l",
    ]);
    expect(
      trovaSpese(TX, { ...rif, testo: "pizza", importo: 22 }, OGGI, true).map((t) => t.id),
    ).toEqual(["l"]);
    expect(
      trovaSpese(
        TX,
        { ...rif, testo: "pizza", periodo: { tipo: "ultimi_giorni", n: 2 } },
        OGGI,
        true,
      ).map((t) => t.id),
    ).toEqual(["n"]);
  });
});

describe("frasi", () => {
  it("date parlate", () => {
    expect(dataParlata(OGGI, OGGI)).toBe("oggi");
    expect(dataParlata("2026-10-25", OGGI)).toBe("ieri");
    expect(dataParlata("2026-10-03", OGGI)).toBe("il 3 ottobre");
    expect(dataParlata("2025-12-31", OGGI)).toBe("il 31 dicembre 2025");
    expect(dataParlata("2026-10-08", OGGI)).toBe("l'8 ottobre");
  });

  it("aggiunta, eliminazione e modifica", () => {
    expect(sp(fraseAggiunta(TX[0]!, CAT, OGGI))).toBe("Aggiunta: Pizza, 18 €, ieri, in Cibo.");
    expect(sp(fraseConfermaElimina([TX[0]!], CAT, OGGI))).toBe(
      "Elimino “Pizza” da 18 € di ieri, in Cibo?",
    );
    expect(fraseConfermaElimina([TX[0]!, TX[2]!], CAT, OGGI)).toContain("Ne ho trovate 2");
    expect(sp(fraseConfermaModifica(TX[2]!, { importo: 20, categoria: "auto" }, CAT, OGGI))).toBe(
      "Modifico “Pizza” da 22 € del 10 ottobre, in Cibo: importo da 22 € a 20 €, categoria in Auto. Confermi?",
    );
  });

  it("risposta a una domanda da leggere", () => {
    expect(
      rispostaParlata({
        valore: "120 €",
        frase: "Spese questo mese per categoria",
        righe: [
          { etichetta: "Cibo", valore: "80 €" },
          { etichetta: "Auto", valore: "40 €" },
        ],
      }),
    ).toBe("120 €. Spese questo mese per categoria. Cibo 80 €, Auto 40 €.");
  });
});

describe("datiWidget", () => {
  it("speso del mese senza le spese future, budget e restante", () => {
    const s = {
      ...initialState(),
      categorie: CAT,
      transazioni: [...TX, tx("f", "Futura", 99, "2026-10-30")],
    };
    expect(datiWidget(s, OGGI)).toMatchObject({
      speso: 90,
      budget: 400,
      restante: 310,
      percentuale: 23,
      previsto: 99,
    });
  });
});
