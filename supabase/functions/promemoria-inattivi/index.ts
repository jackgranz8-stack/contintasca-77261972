// Supabase Edge Function (Deno). Promemoria a chi non apre l'app da due giorni.
//
// Chiamata una volta al giorno da pg_cron. A differenza di send-push, qui non
// c'è un utente che chiede qualcosa: è il database che chiama, quindi l'unico
// autorizzato è chi conosce la service role key.
//
// Regole:
// - parte solo se in Italia sono le 10 del mattino (il cron è programmato alle
//   08 e alle 09 UTC e qui si scarta l'esecuzione sbagliata: è il modo per
//   restare alle 10 italiane sia in ora legale sia in ora solare);
// - avvisa chi non apre l'app da almeno 2 giorni;
// - non più di una notifica ogni 2 giorni e non più di 3 in tutto, perché
//   insistere ogni giorno porta solo a farsi spegnere le notifiche dal telefono;
// - il contatore si azzera da solo appena l'utente riapre l'app (lo fa
//   src/lib/presenza.ts scrivendo last_seen);
// - le sottoscrizioni scadute (410/404) vengono rimosse, come in send-push.
//
// Variabili d'ambiente richieste (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   SUPABASE_URL               (di solito già presente di default)
//   SUPABASE_SERVICE_ROLE_KEY  (di solito già presente di default)

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

webpush.setVapidDetails("mailto:noreply@contintasca.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GIORNI_INATTIVITA = 2;
const GIORNI_TRA_UN_PROMEMORIA_E_L_ALTRO = 2;
const MASSIMO_PROMEMORIA = 3;
const ORA_ITALIANA = 10;

/** Le frasi ruotano a caso: la stessa notifica ripetuta viene ignorata. */
const FRASI: { title: string; body: string }[] = [
  { title: "I conti in tasca non si fanno da soli", body: "aggiungi le ultime spese" },
  { title: "Stai ghostando il tuo budget", body: "due giorni di silenzio assoluto" },
  { title: "Il tuo portafoglio ha visto cose", body: "raccontamele, ci vogliono 30 secondi" },
  { title: "POV: hai speso e non l'hai segnato", body: "rimediamo adesso?" },
  { title: "Hai lasciato i conti in visualizzato", body: "due giorni, nessuna risposta" },
  { title: "Modalità struzzo: disattivata", body: "due giorni di spese ti aspettano" },
];

type Sottoscrizione = { user_id: string; endpoint: string; p256dh: string; auth: string };
type Profilo = { user_id: string; reminder_count: number | null };

/** L'ora attuale in Italia, che tiene conto da sola dell'ora legale. */
function oraItaliana(): number {
  return Number(
    new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

function giorniFa(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Qui non c'è un utente da identificare: chiama il cron. L'unico titolo
    // valido è la service role key, che conosce solo il database.
    const ricevuto = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!SUPABASE_SERVICE_ROLE_KEY || ricevuto !== SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Non autorizzato" }, 401);
    }

    // Il cron gira due volte per coprire ora legale e ora solare: una delle
    // due esecuzioni è sempre quella sbagliata e si ferma qui.
    const forzato = new URL(req.url).searchParams.get("forza") === "1";
    if (!forzato && oraItaliana() !== ORA_ITALIANA) {
      return json({ saltato: "non sono le 10 in Italia" });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: "Chiavi VAPID mancanti" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Chi avvisare: fermo da 2 giorni, non già avvisato ieri, non oltre il
    // terzo promemoria. Chi ha last_seen vuoto resta fuori di proposito: non
    // sappiamo nulla di lui e non è il caso di svegliarlo a caso.
    const { data: profili, error: profiliError } = await admin
      .from("profiles")
      .select("user_id, reminder_count")
      .lt("last_seen", giorniFa(GIORNI_INATTIVITA))
      .lt("reminder_count", MASSIMO_PROMEMORIA)
      .or(`last_reminder.is.null,last_reminder.lt.${giorniFa(GIORNI_TRA_UN_PROMEMORIA_E_L_ALTRO)}`);
    if (profiliError) throw profiliError;

    const utenti = (profili ?? []) as Profilo[];
    if (utenti.length === 0) return json({ avvisati: 0, inviate: 0, rimosse: 0 });

    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in(
        "user_id",
        utenti.map((u) => u.user_id),
      );
    if (subsError) throw subsError;

    const perUtente = new Map<string, Sottoscrizione[]>();
    for (const s of (subs ?? []) as Sottoscrizione[]) {
      const lista = perUtente.get(s.user_id) ?? [];
      lista.push(s);
      perUtente.set(s.user_id, lista);
    }

    let avvisati = 0;
    let inviate = 0;
    const expired: string[] = [];

    for (const utente of utenti) {
      const dispositivi = perUtente.get(utente.user_id) ?? [];
      // Nessun dispositivo iscritto: non si tocca il contatore, così se un
      // giorno attiva le notifiche riparte pulito.
      if (dispositivi.length === 0) continue;

      const frase = FRASI[Math.floor(Math.random() * FRASI.length)];
      const payload = JSON.stringify({ title: frase.title, body: frase.body, url: "/" });

      const results = await Promise.allSettled(
        dispositivi.map((s) =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          ),
        ),
      );

      // Stessa regola di send-push: una sottoscrizione scaduta o revocata non
      // è un errore da segnalare, si rimuove e basta.
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const statusCode = (r.reason as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            const sub = dispositivi[i];
            if (sub) expired.push(sub.endpoint);
          }
        }
      });

      const riuscite = results.filter((r) => r.status === "fulfilled").length;
      inviate += riuscite;

      // Il contatore si alza solo se la notifica è davvero partita: un utente
      // irraggiungibile non deve bruciare i suoi tre tentativi.
      if (riuscite > 0) {
        avvisati++;
        await admin
          .from("profiles")
          .update({
            last_reminder: new Date().toISOString(),
            reminder_count: (utente.reminder_count ?? 0) + 1,
          })
          .eq("user_id", utente.user_id);
      }
    }

    if (expired.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", expired);
    }

    return json({ avvisati, inviate, rimosse: expired.length });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
