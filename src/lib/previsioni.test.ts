import { describe, expect, it } from "vitest";
import {
  previsteDelMese,
  previsteByCategoria,
  prossimePreviste,
  sommaPreviste,
  txFuture,
  txRealizzate,
} from "./previsioni";
import { currentMonth } from "./format";
import { ultimoGiornoDelMese } from "./ricorrenze";
import type { AppState, Recurring, Transaction } from "./types";
import { emptyProfile } from "./types";

/**
 * Verifica la regola di fondo dell'app: il previsto non deve MAI finire nei
 * totali dello speso reale. È il tipo di confine che si rompe facilmente
 * modificando altro, e quando si rompe i numeri diventano sbagliati senza
 * dare alcun segnale visibile.
 *
 * I test usano il mese CORRENTE calcolato al momento (non una data fissa),
 * perché le ricorrenze si proiettano solo sul mese in corso: con date
 * inventate i test passerebbero oggi e fallirebbero il mese prossimo.
 */

const mese = currentMonth();
const fineMese = ultimoGiornoDelMese(mese);
const g = (giorno: number) => `${mese}-${String(giorno).padStart(2, "0")}`;

const tx = (id: string, data: string, importo: number, categoria = "casa"): Transaction => ({
  id,
  importo,
  categoria,
  data,
  nota: "",
});

const ric = (over: Partial<Recurring> = {}): Recurring => ({
  id: "r1",
  nome: "Affitto",
  categoria: "casa",
  importo: 250,
  giorno: 20,
  attiva: true,
  cadenza: "mesi",
  intervallo: 1,
  inizio: g(20),
  fine: null,
  ...over,
});

const stato = (over: Partial<AppState> = {}): AppState => ({
  categorie: [
    { id: "casa", nome: "Casa", icona: "home", colore: "#8CE562", budget: 500 },
    { id: "cibo", nome: "Cibo", icona: "utensils", colore: "#62D5E5", budget: 300 },
  ],
  transazioni: [],
  ricorrenti: [],
  profilo: emptyProfile(),
  consigliIgnorati: [],
  ...over,
});

describe("separazione tra speso reale e previsto", () => {
  it("txRealizzate tiene oggi e il passato, txFuture solo il futuro", () => {
    const lista = [tx("a", g(1), 10), tx("b", g(15), 20), tx("c", g(28), 30)];
    expect(txRealizzate(lista, g(15)).map((t) => t.id)).toEqual(["a", "b"]);
    expect(txFuture(lista, g(15)).map((t) => t.id)).toEqual(["c"]);
  });

  it("una spesa con data odierna è realizzata, non prevista", () => {
    const lista = [tx("a", g(15), 10)];
    expect(txRealizzate(lista, g(15))).toHaveLength(1);
    expect(txFuture(lista, g(15))).toHaveLength(0);
  });
});

describe("previsteDelMese", () => {
  it("include le spese manuali con data futura", () => {
    const s = stato({ transazioni: [tx("a", g(1), 10), tx("b", g(25), 40)] });
    const p = previsteDelMese(s, mese, g(15));
    expect(p).toHaveLength(1);
    expect(p[0]?.importo).toBe(40);
    expect(p[0]?.fonte).toBe("manuale");
  });

  it("include le ricorrenti non ancora scattate", () => {
    const s = stato({ ricorrenti: [ric({ giorno: 25, inizio: g(25) })] });
    const p = previsteDelMese(s, mese, g(15));
    expect(p).toHaveLength(1);
    expect(p[0]?.fonte).toBe("ricorrente");
    expect(p[0]?.importo).toBe(250);
  });

  it("esclude le ricorrenti in pausa", () => {
    const s = stato({ ricorrenti: [ric({ giorno: 25, inizio: g(25), attiva: false })] });
    expect(previsteDelMese(s, mese, g(15))).toHaveLength(0);
  });

  it("esclude le ricorrenti la cui categoria è stata eliminata", () => {
    const s = stato({ ricorrenti: [ric({ giorno: 25, inizio: g(25), categoria: "sparita" })] });
    expect(previsteDelMese(s, mese, g(15))).toHaveLength(0);
  });

  it("non conta due volte una ricorrente già registrata a quella data", () => {
    // Caso reale: una spesa con data futura collegata a una ricorrenza (si
    // ottiene rendendo ricorrente una spesa datata in avanti). La spesa è già
    // salvata, quindi va mostrata UNA volta come spesa vera: la proiezione
    // della ricorrenza per quella stessa data non deve aggiungersi.
    const s = stato({
      ricorrenti: [ric({ giorno: 25, inizio: g(25) })],
      transazioni: [{ ...tx("t1", g(25), 250), ricorrenteId: "r1" }],
    });
    const p = previsteDelMese(s, mese, g(15));
    expect(p).toHaveLength(1);
    expect(p[0]?.fonte).toBe("manuale");
    expect(p.filter((x) => x.fonte === "ricorrente")).toHaveLength(0);
  });

  it("una ricorrente settimanale può comparire più volte nello stesso mese", () => {
    const s = stato({
      ricorrenti: [ric({ cadenza: "settimane", intervallo: 1, inizio: g(1) })],
    });
    const p = previsteDelMese(s, mese, g(1));
    expect(p.length).toBeGreaterThan(1);
    // Tutte dentro il mese, nessuna oltre la fine.
    expect(p.every((x) => x.data <= fineMese)).toBe(true);
  });

  it("ordina dalla più imminente alla più lontana", () => {
    const s = stato({ transazioni: [tx("a", g(28), 10), tx("b", g(20), 20)] });
    const p = previsteDelMese(s, mese, g(15));
    expect(p.map((x) => x.data)).toEqual([g(20), g(28)]);
  });
});

describe("somme e raggruppamenti", () => {
  it("sommaPreviste somma gli importi", () => {
    const s = stato({ transazioni: [tx("a", g(20), 30), tx("b", g(25), 12.5)] });
    expect(sommaPreviste(previsteDelMese(s, mese, g(15)))).toBe(42.5);
  });

  it("previsteByCategoria raggruppa per categoria", () => {
    const s = stato({
      transazioni: [
        tx("a", g(20), 30, "casa"),
        tx("b", g(25), 20, "cibo"),
        tx("c", g(26), 5, "casa"),
      ],
    });
    const m = previsteByCategoria(previsteDelMese(s, mese, g(15)));
    expect(m.get("casa")).toBe(35);
    expect(m.get("cibo")).toBe(20);
  });

  it("senza nulla in arrivo la somma è zero", () => {
    expect(sommaPreviste(previsteDelMese(stato(), mese, g(15)))).toBe(0);
  });
});

describe("prossimePreviste", () => {
  it("guarda oltre il mese corrente, a differenza di previsteDelMese", () => {
    const annoProssimo = `${Number(mese.slice(0, 4)) + 1}-03-10`;
    const s = stato({ transazioni: [tx("a", annoProssimo, 99)] });
    expect(previsteDelMese(s, mese, g(15))).toHaveLength(0);
    expect(prossimePreviste(s, g(15))).toHaveLength(1);
  });
});
