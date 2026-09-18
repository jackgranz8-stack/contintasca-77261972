import { db } from "@/integrations/external/client";

/**
 * ULTIMA APERTURA DELL'APP
 *
 * Serve solo al promemoria "non apri l'app da due giorni": la Edge Function
 * `promemoria-inattivi` legge questa data e decide a chi mandare la notifica.
 *
 * Due accortezze volute:
 *
 * 1. Si scrive al massimo una volta all'ora per dispositivo. Aprire e
 *    chiudere l'app dieci volte di seguito non deve produrre dieci scritture
 *    inutili sul database: per capire se uno è sparito da due giorni, la
 *    precisione al minuto non serve a nulla.
 * 2. Non fallisce mai in modo rumoroso. Se non c'è rete, o la colonna non è
 *    ancora stata creata sul database, l'app continua a funzionare
 *    esattamente come prima: al massimo salta un promemoria.
 */

const CHIAVE = "ct:ultima-presenza";
const UN_ORA = 60 * 60 * 1000;

function letturaLocale(userId: string): number {
  try {
    const raw = localStorage.getItem(`${CHIAVE}:${userId}`);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function scritturaLocale(userId: string, ts: number): void {
  try {
    localStorage.setItem(`${CHIAVE}:${userId}`, String(ts));
  } catch {
    /* localStorage pieno o disabilitato: pazienza, si riproverà. */
  }
}

/**
 * Registra che l'utente sta usando l'app adesso.
 * Da chiamare all'avvio e ogni volta che l'app torna in primo piano.
 */
export async function segnalaPresenza(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const ora = Date.now();
  if (ora - letturaLocale(userId) < UN_ORA) return;

  // Segnato subito in locale: se la scrittura sul server fallisce si riprova
  // alla prossima ora, non ad ogni singolo ritorno in primo piano.
  scritturaLocale(userId, ora);

  try {
    await db
      .from("profiles")
      .update({ last_seen: new Date(ora).toISOString(), reminder_count: 0 })
      .eq("user_id", userId);
  } catch {
    /* Silenzioso di proposito: è un dato accessorio, non un dato dell'utente. */
  }
}
