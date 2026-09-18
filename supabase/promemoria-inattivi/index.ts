/**
 * PROMEMORIA PER CHI NON APRE L'APP DA DUE GIORNI
 *
 * Chiamata una volta al giorno da pg_cron (vedi la migrazione
 * 20260918100000_promemoria_inattivi.sql).
 *
 * Regole, in breve:
 * - parte solo se in Italia sono le 10 del mattino (il cron è programmato due
 *   volte, alle 08 e alle 09 UTC, e qui si scarta l'esecuzione sbagliata: è il
 *   modo per restare alle 10 italiane sia in ora legale sia in ora solare);
 * - avvisa chi non apre l'app da almeno 2 giorni;
 * - non più di una notifica ogni 2 giorni e non più di 3 in tutto: alla terza
 *   si ferma, perché insistere ogni giorno porta solo a farsi spegnere le
 *   notifiche dal telefono;
 * - il contatore si azzera da solo appena l'utente riapre l'app;
 * - le sottoscrizioni scadute (il telefono ha disinstallato l'app o ha
 *   rigenerato l'endpoint) vengono cancellate al primo errore 404/410.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

type Sottoscrizione = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
};

/** L'ora attuale in Italia, tenendo conto da sola dell'ora legale. */
function oraItaliana(): number {
  const testo = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(testo);
}

function giorniFa(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req: Request) => {
  // Solo il cron (che usa la service role key) può far partire gli invii.
  const atteso = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ricevuto = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!atteso || ricevuto !== atteso) {
    return new Response(JSON.stringify({ error: "non autorizzato" }), { status: 401 });
  }

  // Il cron gira due volte per coprire ora legale e ora solare: una delle due
  // esecuzioni è sempre quella sbagliata e si ferma qui.
  const forzato = new URL(req.url).searchParams.get("forza") === "1";
  if (!forzato && oraItaliana() !== ORA_ITALIANA) {
    return new Response(JSON.stringify({ saltato: "orario non italiano" }), { status: 200 });
  }

  const chiavePubblica = Deno.env.get("VAPID_PUBLIC_KEY");
  const chiavePrivata = Deno.env.get("VAPID_PRIVATE_KEY");
  const soggetto = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@contintasca.app";
  if (!chiavePubblica || !chiavePrivata) {
    return new Response(JSON.stringify({ error: "chiavi VAPID mancanti" }), { status: 500 });
  }
  webpush.setVapidDetails(soggetto, chiavePubblica, chiavePrivata);

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Chi avvisare: fermo da 2 giorni, non già avvisato ieri, non oltre il terzo
  // promemoria. Chi ha last_seen vuoto resta fuori di proposito: non sappiamo
  // nulla di lui e non è il caso di svegliarlo a caso.
  const { data: profili, error } = await db
    .from("profiles")
    .select("user_id, last_reminder, reminder_count")
    .lt("last_seen", giorniFa(GIORNI_INATTIVITA))
    .lt("reminder_count", MASSIMO_PROMEMORIA)
    .or(`last_reminder.is.null,last_reminder.lt.${giorniFa(GIORNI_TRA_UN_PROMEMORIA_E_L_ALTRO)}`);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const utenti = (profili ?? []) as { user_id: string; reminder_count: number }[];
  if (utenti.length === 0) {
    return new Response(JSON.stringify({ avvisati: 0, inviate: 0 }), { status: 200 });
  }

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in(
      "user_id",
      utenti.map((u) => u.user_id),
    );

  const perUtente = new Map<string, Sottoscrizione[]>();
  for (const s of (subs ?? []) as Sottoscrizione[]) {
    const lista = perUtente.get(s.user_id) ?? [];
    lista.push(s);
    perUtente.set(s.user_id, lista);
  }

  let inviate = 0;
  let avvisati = 0;
  const scadute: string[] = [];

  for (const utente of utenti) {
    const dispositivi = perUtente.get(utente.user_id);
    // Nessun dispositivo iscritto: non si tocca il contatore, così se un
    // giorno attiva le notifiche riparte pulito.
    if (!dispositivi || dispositivi.length === 0) continue;

    const frase = FRASI[Math.floor(Math.random() * FRASI.length)];
    const payload = JSON.stringify({ title: frase.title, body: frase.body, url: "/" });

    let almenoUno = false;
    for (const d of dispositivi) {
      try {
        await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          payload,
        );
        inviate++;
        almenoUno = true;
      } catch (err) {
        const codice = (err as { statusCode?: number }).statusCode;
        if (codice === 404 || codice === 410) scadute.push(d.endpoint);
      }
    }

    if (almenoUno) {
      avvisati++;
      await db
        .from("profiles")
        .update({
          last_reminder: new Date().toISOString(),
          reminder_count: (utente.reminder_count ?? 0) + 1,
        })
        .eq("user_id", utente.user_id);
    }
  }

  if (scadute.length) {
    await db.from("push_subscriptions").delete().in("endpoint", scadute);
  }

  return new Response(
    JSON.stringify({ avvisati, inviate, sottoscrizioni_rimosse: scadute.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
