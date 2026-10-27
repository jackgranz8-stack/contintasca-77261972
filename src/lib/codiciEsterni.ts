import { db, SUPABASE_URL } from "@/integrations/external/client";

/**
 * CODICI PERSONALI PER SIRI E WIDGET
 *
 * Comandi Rapidi e Scriptable non possono fare l'accesso all'app come il
 * telefono: usano un codice personale, lungo e casuale, che si crea qui.
 *
 * - Il codice si vede UNA volta sola, appena creato: sul database finisce
 *   solo la sua impronta (SHA-256), da cui non si può risalire al codice.
 * - Chi ha il codice può aggiungere, modificare ed eliminare spese e leggere
 *   i totali: va trattato come una password.
 * - Revocandolo, Siri e widget smettono subito di funzionare con quel codice.
 */

export const URL_ASSISTENTE_VOCALE = `${SUPABASE_URL}/functions/v1/assistente-vocale`;

export type CodiceEsterno = {
  id: string;
  nome: string;
  creato: string;
  ultimo_uso: string | null;
};

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function impronta(testo: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function elencoCodici(): Promise<CodiceEsterno[]> {
  const { data, error } = await db
    .from("codici_esterni")
    .select("id, nome, creato, ultimo_uso")
    .order("creato", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CodiceEsterno[];
}

/** Crea un codice e lo restituisce in chiaro: è l'unica occasione per vederlo. */
export async function creaCodice(userId: string, nome: string): Promise<string> {
  const casuale = new Uint8Array(32);
  crypto.getRandomValues(casuale);
  const codice = `ct_${base64url(casuale)}`;
  const { error } = await db.from("codici_esterni").insert({
    user_id: userId,
    hash: await impronta(codice),
    nome: nome.trim().slice(0, 40) || "Siri e widget",
  });
  if (error) throw error;
  return codice;
}

export async function revocaCodice(id: string): Promise<void> {
  const { error } = await db.from("codici_esterni").delete().eq("id", id);
  if (error) throw error;
}
