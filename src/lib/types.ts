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

/** Unità della cadenza di una spesa ricorrente. */
export type Cadenza = "settimane" | "mesi";

export type Recurring = {
  id: string;
  nome: string;
  categoria: string;
  importo: number;
  /**
   * Giorno del mese (1-28), usato solo con cadenza "mesi". Limitato a 28 di
   * proposito: così la spesa cade in ogni mese, febbraio compreso, senza casi
   * particolari da gestire.
   */
  giorno: number;
  attiva: boolean;
  /** "mesi" = ogni N mesi al giorno indicato; "settimane" = ogni N settimane dalla data di inizio. */
  cadenza: Cadenza;
  /** Ogni quanto: 1 = ogni mese/settimana, 2 = ogni due, ecc. */
  intervallo: number;
  /** Data della prima occorrenza: ancora della serie (YYYY-MM-DD). */
  inizio: string;
  /** Data oltre la quale la ricorrenza non vale più. Assente/null = per sempre. */
  fine?: string | null;
  /** Data dell'ultima occorrenza già registrata (YYYY-MM-DD). */
  ultimaData?: string;
  /**
   * Vecchio segnaposto per mese (YYYY-MM), da prima che esistessero le cadenze
   * diverse da quella mensile. Non viene più aggiornato: resta solo per
   * riconoscere le ricorrenze create prima e non registrarne di nuovo i mesi
   * già passati (vedi runRecurring in store.tsx).
   */
  ultimaGenerazione?: string;
};

export type Housing = "affitto" | "mutuo" | "proprieta" | "famiglia";

export const HOUSING_OPTIONS: { id: Housing; label: string }[] = [
  { id: "affitto", label: "In affitto" },
  { id: "mutuo", label: "Mutuo" },
  { id: "proprieta", label: "Casa di proprietà" },
  { id: "famiglia", label: "Vivo in famiglia" },
];

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

// Gamma estesa di colori selezionabili per le categorie: stessa "firma" (saturazione/luminosità)
// della PALETTE esistente, così ogni colore aggiuntivo resta coerente con lo stile dell'app.
export const CATEGORY_COLORS = [
  "#8CE562",
  "#62D5E5",
  "#E5C462",
  "#E58A62",
  "#B98CE5",
  "#62E5A8",
  "#E56287",
  "#9AA6A0",
  "#E56161",
  "#E57761",
  "#E5E561",
  "#B9E561",
  "#61E577",
  "#61AEE5",
  "#6177E5",
  "#CF61E5",
  "#E561B9",
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
