import { db } from "@/integrations/external/client";

/**
 * Unico punto da cui l'app parla con l'AI: la Edge Function "assistente-ai".
 *
 * La funzione fa quattro lavori ("modalità"), e per ognuno riceve solo lo
 * stretto necessario:
 * - domanda:   la domanda e i nomi delle categorie (i conti li fa il telefono);
 * - spesa:     la frase scritta ("pizza 18 ieri") e i nomi delle categorie;
 * - categoria: una descrizione e i nomi delle categorie;
 * - riepilogo: i TOTALI di un mese per categoria, mai le singole spese;
 * - analisi:   medie per categoria, confronto Istat e piano per il budget
 *              (già calcolati sul telefono), per scrivere i consigli.
 */
export type ModalitaAI = "domanda" | "spesa" | "categoria" | "riepilogo" | "analisi";

export type EsitoAI = { ok: true; dati: unknown } | { ok: false; errore: string };

const NON_DISPONIBILE = "Il servizio non è disponibile, riprova tra poco.";

export async function chiamaAI(
  modalita: ModalitaAI,
  payload: Record<string, unknown>,
): Promise<EsitoAI> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, errore: "Serve la connessione." };
  }
  try {
    const { data, error } = await db.functions.invoke("assistente-ai", {
      body: { modalita, ...payload },
    });
    if (error) {
      // Il messaggio utile sta nel corpo della risposta, non in error.message.
      let errore = "";
      const ctx = (error as { context?: unknown }).context;
      if (ctx instanceof Response) {
        errore = await ctx
          .json()
          .then((b: { errore?: string }) => b?.errore ?? "")
          .catch(() => "");
      }
      return { ok: false, errore: errore || NON_DISPONIBILE };
    }
    if (!data || typeof data !== "object" || !("risultato" in data)) {
      return { ok: false, errore: "Risposta non valida dal servizio." };
    }
    return { ok: true, dati: (data as { risultato: unknown }).risultato };
  } catch {
    return { ok: false, errore: NON_DISPONIBILE };
  }
}

/** Solo id e nome: è tutto quello che serve all'AI delle categorie. */
export function categoriePerAI(categorie: { id: string; nome: string }[]) {
  return categorie.map((c) => ({ id: c.id, nome: c.nome }));
}
