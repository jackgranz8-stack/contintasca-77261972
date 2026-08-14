export type Category = {
  id: string;
  nome: string;
  icona: string;
  colore: string;
  budget: number;
};

export type Transaction = {
  id: string;
  importo: number;
  categoria: string;
  data: string; // YYYY-MM-DD
  nota: string;
  ricorrenteId?: string | null;
};

export type Recurring = {
  id: string;
  nome: string;
  categoria: string;
  importo: number;
  giorno: number; // 1-28
  attiva: boolean;
  ultimaGenerazione?: string; // YYYY-MM
};

export type Housing = "affitto" | "mutuo" | "proprieta" | "famiglia";

export type Profile = {
  nome: string;
  onboardingCompletato: boolean;
  budgetTotale: number;
  abitazione: Housing;
  auto: boolean;
  persone: number;
  primoUtilizzo: string; // ISO
};

export type AppState = {
  categorie: Category[];
  transazioni: Transaction[];
  ricorrenti: Recurring[];
  profilo: Profile;
  consigliIgnorati: string[];
};

export const PALETTE = [
  "#8CE562",
  "#62D5E5",
  "#E5C462",
  "#E58A62",
  "#B98CE5",
  "#62E5A8",
  "#E56287",
  "#9AA6A0",
];

export const DEFAULT_CATEGORIES: Omit<Category, "budget">[] = [
  { id: "casa", nome: "Casa", icona: "home", colore: "#8CE562" },
  { id: "cibo", nome: "Cibo", icona: "utensils", colore: "#62D5E5" },
  { id: "auto", nome: "Auto", icona: "car", colore: "#E5C462" },
  { id: "bollette", nome: "Bollette", icona: "zap", colore: "#E58A62" },
  { id: "mediche", nome: "Spese mediche", icona: "heart-pulse", colore: "#B98CE5" },
  { id: "svago", nome: "Svago", icona: "party", colore: "#62E5A8" },
  { id: "altro", nome: "Altro", icona: "wallet", colore: "#9AA6A0" },
];

export function emptyProfile(): Profile {
  return {
    nome: "",
    onboardingCompletato: false,
    budgetTotale: 0,
    abitazione: "affitto",
    auto: true,
    persone: 1,
    primoUtilizzo: new Date().toISOString(),
  };
}

export function initialState(): AppState {
  return {
    categorie: [],
    transazioni: [],
    ricorrenti: [],
    profilo: emptyProfile(),
    consigliIgnorati: [],
  };
}
