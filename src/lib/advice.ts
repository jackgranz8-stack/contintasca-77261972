import type { AppState } from "./types";
import { trovaAbbonamenti } from "./abbonamenti";
import { currentMonth, monthKey, monthLabel, shiftMonth, todayISO } from "./format";

export type TipAction =
  | { kind: "setBudget"; categoria: string; importo: number }
  | {
      kind: "activateRecurring";
      nome: string;
      categoria: string;
      importo: number;
      giorno: number;
      /** Data dell'ultimo pagamento già inserito: la ricorrente riparte da lì. */
      ultimaData?: string;
    }
  | { kind: "openBudget" }
  | { kind: "riepilogo"; mese: string }
  | { kind: "ack" };

export type Tip = {
  id: string;
  tono: "info" | "warn" | "danger" | "good" | "neutral";
  titolo: string;
  testo: string;
  azione: string;
  action: TipAction;
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function buildTips(state: AppState): Tip[] {
  const tips: Tip[] = [];
  const mk = currentMonth();
  const now = new Date();
  const giorno = now.getDate();
  const giorniMese = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const prevMonths = [shiftMonth(mk, -1), shiftMonth(mk, -2), shiftMonth(mk, -3)];

  // I consigli devono basarsi sullo speso REALE: le transazioni con data
  // futura (spese previste) non sono ancora soldi usciti, e includerle
  // gonfierebbe percentuali e allarmi ("sei al 90% del budget") con denaro
  // che non è ancora stato speso.
  const oggiISO = todayISO();
  const realizzate = state.transazioni.filter((t) => t.data <= oggiISO);
  const inMonth = (m: string) => realizzate.filter((t) => monthKey(t.data) === m);
  const total = (arr: { importo: number }[]) => arr.reduce((a, t) => a + t.importo, 0);
  const catName = (id: string) => state.categorie.find((c) => c.id === id)?.nome ?? "Categoria";

  const speso = total(inMonth(mk));
  const budgetTotale = state.categorie.reduce((a, c) => a + c.budget, 0);

  // a) ritmo di spesa
  if (budgetTotale > 0 && speso > 0 && giorno >= 3) {
    const proiezione = (speso / giorno) * giorniMese;
    if (proiezione > budgetTotale * 1.05) {
      tips.push({
        id: `pace-${mk}`,
        tono: "danger",
        titolo: "Stai andando troppo veloce",
        testo: `Con questo ritmo chiuderai il mese a circa ${Math.round(proiezione)}€, oltre il budget di ${Math.round(budgetTotale)}€. Servirebbe restare sotto ${Math.max(0, Math.round((budgetTotale - speso) / Math.max(1, giorniMese - giorno)))}€ al giorno.`,
        azione: "Rivedi i budget",
        action: { kind: "openBudget" },
      });
    } else if (proiezione < budgetTotale * 0.8) {
      tips.push({
        id: `pace-ok-${mk}`,
        tono: "good",
        titolo: "Ritmo sotto controllo",
        testo: `Con questo ritmo chiuderai a circa ${Math.round(proiezione)}€ su ${Math.round(budgetTotale)}€ di budget: ti avanzeranno circa ${Math.round(budgetTotale - proiezione)}€.`,
        azione: "Vedi budget",
        action: { kind: "openBudget" },
      });
    }
  }

  // riepilogo del mese appena chiuso: consuntivo neutro, non un avviso, mostrato una sola volta
  const meseChiuso = shiftMonth(mk, -1);
  const txMeseChiuso = inMonth(meseChiuso);
  if (txMeseChiuso.length > 0) {
    const sommaChiusa = total(txMeseChiuso);
    const percChiusa = budgetTotale > 0 ? Math.round((sommaChiusa / budgetTotale) * 100) : null;
    tips.push({
      id: `monthly-summary:${meseChiuso}`,
      tono: "neutral",
      titolo: `Riepilogo di ${monthLabel(meseChiuso)}`,
      testo:
        percChiusa != null
          ? `A ${monthLabel(meseChiuso)} hai speso ${Math.round(sommaChiusa)}€, il ${percChiusa}% del budget di quel mese.`
          : `A ${monthLabel(meseChiuso)} hai speso ${Math.round(sommaChiusa)}€.`,
      azione: "Riepilogo e consigli",
      action: { kind: "riepilogo", mese: meseChiuso },
    });
  }

  // d) abbonamenti non ancora ricorrenti (vedi lib/abbonamenti.ts). Vengono
  // prima dei consigli sui budget: sono pochi e concreti, e con il limite di
  // 6 consigli in fondo all'elenco rischiavano di non comparire mai.
  // Al massimo 2 alla volta: gli altri compaiono quando questi vengono
  // accettati o ignorati, senza riempire la Home.
  const abbonamenti = trovaAbbonamenti(state, oggiISO).filter(
    (a) => !state.consigliIgnorati.includes(`fixed-${a.chiave}`),
  );
  for (const a of abbonamenti.slice(0, 2)) {
    tips.push({
      id: `fixed-${a.chiave}`,
      tono: "info",
      titolo: "Sembra un abbonamento",
      testo: `"${a.nome}" da ${a.importo.toFixed(2).replace(".", ",").replace(",00", "")}€ torna ogni mese da ${a.mesi} mesi in ${catName(a.categoria)}. Rendilo ricorrente: si registrerà da solo il giorno ${a.giorno}.`,
      azione: "Rendi ricorrente",
      action: {
        kind: "activateRecurring",
        nome: a.nome,
        categoria: a.categoria,
        importo: a.importo,
        giorno: a.giorno,
        ultimaData: a.ultimaData,
      },
    });
  }

  for (const cat of state.categorie) {
    const medie = prevMonths.map((m) => total(inMonth(m).filter((t) => t.categoria === cat.id)));
    const mesiConDati = medie.filter((v) => v > 0).length;
    if (mesiConDati === 0) continue;
    const media = medie.reduce((a, b) => a + b, 0) / mesiConDati;

    // b) budget da impostare / correggere
    if (cat.budget === 0) {
      tips.push({
        id: `budget-set-${cat.id}`,
        tono: "info",
        titolo: `Imposta un budget per ${cat.nome}`,
        testo: `Negli ultimi mesi hai speso in media ${Math.round(media)}€ al mese in ${cat.nome}, ma non hai ancora un budget.`,
        azione: `Imposta ${round5(media)}€`,
        action: { kind: "setBudget", categoria: cat.id, importo: round5(media) },
      });
    } else if (media > cat.budget * 1.25) {
      tips.push({
        id: `budget-up-${cat.id}`,
        tono: "warn",
        titolo: `Budget troppo basso su ${cat.nome}`,
        testo: `Media ultimi mesi ${Math.round(media)}€ contro un budget di ${Math.round(cat.budget)}€. Meglio allinearlo alla realtà.`,
        azione: `Porta a ${round5(media)}€`,
        action: { kind: "setBudget", categoria: cat.id, importo: round5(media) },
      });
    } else if (media > 0 && media < cat.budget * 0.6) {
      tips.push({
        id: `budget-down-${cat.id}`,
        tono: "info",
        titolo: `Puoi liberare budget da ${cat.nome}`,
        testo: `Spendi in media ${Math.round(media)}€ contro ${Math.round(cat.budget)}€ di budget: ${Math.round(cat.budget - media)}€ sono fermi qui.`,
        azione: `Porta a ${round5(media)}€`,
        action: { kind: "setBudget", categoria: cat.id, importo: round5(media) },
      });
    }

    // c) aumenti anomali
    const spesoCat = total(inMonth(mk).filter((t) => t.categoria === cat.id));
    if (media > 10 && spesoCat > media * 1.5) {
      tips.push({
        id: `spike-${cat.id}-${mk}`,
        tono: "warn",
        titolo: `Spesa anomala in ${cat.nome}`,
        testo: `Questo mese ${Math.round(spesoCat)}€ contro una media di ${Math.round(media)}€: +${Math.round(((spesoCat - media) / media) * 100)}%.`,
        azione: "Controlla lo storico",
        action: { kind: "openBudget" },
      });
    }
  }

  return tips.filter((t) => !state.consigliIgnorati.includes(t.id)).slice(0, 6);
}
