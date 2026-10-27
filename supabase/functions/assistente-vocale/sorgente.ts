// SORGENTE della Edge Function "assistente-vocale" (Siri e widget).
//
// Questo file NON si incolla su Supabase: importa la logica dell'app da
// src/lib (vocale.ts, domande.ts, spesaAParole.ts, riepilogo.ts…), così app
// e Siri ragionano allo stesso modo. Il file da incollare è index.ts, che
// contiene questo sorgente con tutta la logica già unita in un file solo.
//
// COSA FA
// Riceve dal Comando Rapido (o dal widget Scriptable) un codice personale e
// una frase detta a voce, e:
//   - aggiunge una spesa ("pizza 18 ieri");
//   - risponde a una domanda ("quanto ho speso questo mese?");
//   - elimina o modifica una spesa, SEMPRE dopo conferma;
//   - dà un consiglio sul mese ("come posso risparmiare?");
//   - con modalita "widget" restituisce i numeri del mese per il widget.
// Risponde con { messaggio } da far pronunciare a Siri, più { conferma }
// quando serve un "sì" prima di procedere.
//
// ACCESSO
// Niente login: il Comando Rapido usa un codice personale generato nell'app
// (Profilo → Siri e widget). Sul database c'è solo l'impronta (SHA-256) del
// codice, non il codice. Revocandolo dall'app smette di funzionare subito.
// Per questo la funzione va pubblicata con "Verify JWT" SPENTO.
//
// All'AI (Groq) va solo la frase detta, i nomi delle categorie e, per i
// consigli, i totali del mese per categoria. Mai l'elenco delle spese: i
// conti si fanno qui.
//
// Variabili d'ambiente: GROQ_API_KEY (già impostata per assistente-ai),
// GROQ_MODEL (facoltativa), SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (di default).

import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  applicaModifiche,
  datiWidget,
  descriviSpesa,
  fraseAggiunta,
  fraseConfermaElimina,
  fraseConfermaModifica,
  normalizzaComando,
  pulisciComando,
  rispostaParlata,
  serveAI,
  trovaSpese,
  type Comando,
  type Modifiche,
} from "../../../src/lib/vocale.ts";
import { rispondi } from "../../../src/lib/domande.ts";
import { leggiSpesaLocale } from "../../../src/lib/spesaAParole.ts";
import { categoriaPerDescrizione } from "../../../src/lib/descrizioni.ts";
import { calcolaRiepilogo, datiPerAI, normalizzaConsigli } from "../../../src/lib/riepilogo.ts";
import { shiftMonth, monthKey } from "../../../src/lib/format.ts";
import {
  toCategory,
  toRecurring,
  toTransaction,
  transactionPayload,
  type CategoryRow,
  type RecurringRow,
  type TransactionRow,
} from "../../../src/lib/righeDb.ts";
import {
  initialState,
  type AppState,
  type Housing,
  type Transaction,
} from "../../../src/lib/types.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
const MODELLO_CHE_RAGIONA = GROQ_MODEL.startsWith("openai/gpt-oss");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_TESTO = 300;
/** Una conferma vale 3 minuti: poi bisogna ridire il comando. */
const DURATA_CONFERMA_MS = 3 * 60 * 1000;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** La data di oggi in Italia: il server lavora in UTC, e fra mezzanotte e l'1 sbaglierebbe giorno. */
function oggiInItalia(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

/* ---------- Codice personale ---------- */

async function impronta(testo: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function utenteDaCodice(codice: string): Promise<string | null> {
  if (!/^ct_[A-Za-z0-9_-]{30,80}$/.test(codice)) return null;
  const hash = await impronta(codice);
  const { data } = await admin
    .from("codici_esterni")
    .select("id, user_id")
    .eq("hash", hash)
    .maybeSingle();
  if (!data) return null;
  // Le richieste di Supabase partono solo con "await": senza, l'ultimo uso
  // non verrebbe mai salvato.
  await admin
    .from("codici_esterni")
    .update({ ultimo_uso: new Date().toISOString() })
    .eq("id", data.id);
  return data.user_id as string;
}

/* ---------- Conferme firmate ---------- */
// La conferma non si salva da nessuna parte: è l'azione stessa, firmata con
// una chiave che solo il server conosce. Così non si può falsificare né
// riusare dopo la scadenza.

type Azione =
  | { tipo: "elimina"; utente: string; id: string; scade: number }
  | { tipo: "modifica"; utente: string; id: string; modifiche: Modifiche; scade: number };

const chiaveFirma = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(`conferme:${SUPABASE_SERVICE_ROLE_KEY}`),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

const b64 = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const daB64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function firma(azione: Azione): Promise<string> {
  const corpo = new TextEncoder().encode(JSON.stringify(azione));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chiaveFirma, corpo));
  return `${b64(corpo)}.${b64(sig)}`;
}

async function leggiFirma(token: string, utente: string): Promise<Azione | null> {
  try {
    const [c, s] = token.split(".");
    if (!c || !s) return null;
    const corpo = daB64(c);
    const ok = await crypto.subtle.verify("HMAC", await chiaveFirma, daB64(s), corpo);
    if (!ok) return null;
    const azione = JSON.parse(new TextDecoder().decode(corpo)) as Azione;
    if (azione.utente !== utente || Date.now() > azione.scade) return null;
    return azione;
  } catch {
    return null;
  }
}

/* ---------- Dati dell'utente ---------- */

type StatoConOrdine = { state: AppState; ordinateDaInserimento: boolean };

async function tutteLeRighe<T>(tabella: string, utente: string): Promise<T[]> {
  // Supabase restituisce al massimo 1000 righe per volta: si legge a blocchi.
  const righe: T[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await admin
      .from(tabella)
      .select("*")
      .eq("user_id", utente)
      .order("id", { ascending: true })
      .range(da, da + 999);
    if (error) throw error;
    righe.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return righe;
  }
}

async function caricaStato(utente: string): Promise<StatoConOrdine> {
  const [cat, tx, rec, prof] = await Promise.all([
    tutteLeRighe<CategoryRow>("categories", utente),
    tutteLeRighe<TransactionRow & { created_at?: string }>("transactions", utente),
    tutteLeRighe<RecurringRow>("recurring", utente),
    admin.from("profiles").select("*").eq("user_id", utente).maybeSingle(),
  ]);
  // Se la tabella ha la data di inserimento, "l'ultima spesa" è l'ultima inserita.
  const ordinateDaInserimento = tx.some((r) => typeof r.created_at === "string");
  // Dalla più recente inserita; a parità (le spese di prima che esistesse
  // la colonna hanno tutte la stessa data di inserimento) vince la data.
  tx.sort((a, b) => {
    const ca = a.created_at ?? "";
    const cb = b.created_at ?? "";
    if (ca !== cb) return ca < cb ? 1 : -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  const base = initialState();
  const p = (prof.data ?? null) as {
    housing?: string;
    has_car?: string;
    household_size?: number;
  } | null;
  return {
    ordinateDaInserimento,
    state: {
      ...base,
      categorie: cat.map(toCategory),
      transazioni: tx.map(toTransaction),
      ricorrenti: rec.map(toRecurring),
      profilo: {
        ...base.profilo,
        abitazione: (p?.housing as Housing | undefined) ?? "affitto",
        auto: (p?.has_car ?? "si") === "si",
        persone: p?.household_size ?? 1,
      },
    },
  };
}

/* ---------- AI ---------- */

const ISTRUZIONI_COMANDO = `Sei l'assistente vocale di un'app italiana di spese personali.
Ricevi una frase detta a voce (con possibili errori di dettatura) e la trasformi in UN SOLO oggetto JSON, senza altro testo.
Non conosci le spese dell'utente: descrivi solo cosa fare.

{"azione": "aggiungi"|"domanda"|"elimina"|"modifica"|"consiglio"|"non_capito",
 "spesa": {...} | null, "domanda": {...} | null, "riferimento": {...} | null, "modifiche": {...} | null, "messaggio": string | null}

aggiungi → "spesa": {"importo": numero in euro (totale: "2 caffè da 1,20" = 2.4), "descrizione": 1-4 parole con iniziale maiuscola, "data": "AAAA-MM-GG" (oggi se non detta), "categoria": id | null}
domanda → "domanda": {"tipo": "totale"|"per_categoria"|"per_mese"|"media_mensile"|"piu_care"|"frequenti"|"confronto"|"ultima", "periodo": Periodo, "confronto": Periodo|null, "categorie": [id], "testo": parola da cercare nella descrizione | null, "limite": numero|null}
  totale = quanto ho speso (default); per_categoria = in cosa spendo di più; per_mese = andamento; media_mensile; piu_care = spese più alte; frequenti; confronto = due periodi (se il secondo manca, il precedente); ultima = quando l'ultima volta.
  Senza periodo: "quanto ho speso" → mese_corrente, il resto → tutto.
elimina → "riferimento": {"ultima": true se dice "l'ultima spesa"/"quella appena messa", "testo": parola della descrizione | null, "importo": numero | null, "periodo": Periodo | null}
modifica → "riferimento" come sopra + "modifiche": {"importo"?: numero, "descrizione"?: string, "data"?: "AAAA-MM-GG", "categoria"?: id}. Metti solo i campi da cambiare. "la pizza di ieri era 20 euro" → riferimento {testo:"pizza", periodo: {"tipo":"intervallo","da":ieri,"a":ieri}}, modifiche {importo:20}.
consiglio → l'utente chiede consigli o come risparmiare.
non_capito → "messaggio": una frase breve in italiano che spiega cosa si può dire.

Periodo: {"tipo":"tutto"} | {"tipo":"mese_corrente"} | {"tipo":"mese_scorso"} | {"tipo":"anno_corrente"} | {"tipo":"anno_scorso"} | {"tipo":"ultimi_giorni","n":N} (oggi compreso) | {"tipo":"ultimi_mesi","n":N} | {"tipo":"mese","valore":"AAAA-MM"} | {"tipo":"anno","valore":"AAAA"} | {"tipo":"intervallo","da":"AAAA-MM-GG","a":"AAAA-MM-GG"}
Categorie: usa solo gli id dati, se la frase nomina quella categoria, un suo sinonimo (macchina → Auto, supermercato → Cibo, luce → Bollette) o una spesa che vi appartiene chiaramente. "testo": una parola minuscola al singolare, per cose che non sono categorie (benzina, esselunga, pizza).`;

const ISTRUZIONI_CATEGORIA = `Scegli la categoria di una spesa personale dalla sua descrizione. Rispondi con UN SOLO oggetto JSON: {"categoria": id | null}. Usa solo gli id dati; null se nessuna è adatta.`;

const ISTRUZIONI_CONSIGLIO = `Sei un consulente di finanza personale pratico e gentile. Ricevi i TOTALI di un mese per categoria (con media dei mesi precedenti e budget) e scrivi 2 consigli brevi da LEGGERE AD ALTA VOCE.
Rispondi con UN SOLO oggetto JSON: {"consigli": [{"titolo": string, "testo": string}]}
Usa solo i numeri forniti, senza calcoli nuovi. Testo: una frase, con un'azione concreta. Niente investimenti o prodotti finanziari. Dai del tu.`;

async function chiediGroq(sistema: string, utente: string, maxToken: number, temperatura = 0) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY mancante");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: temperatura,
      max_completion_tokens: maxToken + (MODELLO_CHE_RAGIONA ? 1500 : 0),
      ...(MODELLO_CHE_RAGIONA ? { reasoning_effort: "low", include_reasoning: false } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: utente },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 429) throw new Error("quota");
  if (!r.ok) {
    console.error("Groq", r.status, (await r.text()).slice(0, 300));
    throw new Error(`groq ${r.status}`);
  }
  const d = await r.json();
  return JSON.parse(d?.choices?.[0]?.message?.content ?? "null") as unknown;
}

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const elencoCategorie = (s: AppState) => s.categorie.map((c) => `${c.id}=${c.nome}`).join(", ");

async function capisci(testo: string, s: AppState, oggi: string): Promise<Comando> {
  const ids = s.categorie.map((c) => c.id);
  // Frase di sola spesa ("pizza 18 ieri"): la si legge da soli.
  if (!serveAI(testo)) {
    const letta = leggiSpesaLocale(pulisciComando(testo), oggi);
    if (letta) return { azione: "aggiungi", spesa: letta };
  }
  const giorno = GIORNI[new Date(oggi + "T12:00:00Z").getUTCDay()];
  const grezzo = await chiediGroq(
    ISTRUZIONI_COMANDO,
    `Oggi è ${oggi} (${giorno}). Categorie: ${elencoCategorie(s) || "nessuna"}.\nFrase: ${testo}`,
    400,
  );
  return normalizzaComando(grezzo, oggi, ids);
}

async function categoriaPer(descrizione: string, s: AppState): Promise<string> {
  const ids = s.categorie.map((c) => c.id);
  const daStorico = categoriaPerDescrizione(s.transazioni, descrizione, ids);
  if (daStorico) return daStorico;
  try {
    const r = (await chiediGroq(
      ISTRUZIONI_CATEGORIA,
      `Categorie: ${elencoCategorie(s)}.\nDescrizione: ${descrizione}`,
      40,
    )) as { categoria?: unknown } | null;
    if (typeof r?.categoria === "string" && ids.includes(r.categoria)) return r.categoria;
  } catch {
    // Si usa il ripiego qui sotto.
  }
  const altro = s.categorie.find((c) => c.nome.toLowerCase().startsWith("altr"));
  return altro?.id ?? s.categorie[0]?.id ?? "";
}

/* ---------- Esecuzione ---------- */

async function esegui(
  comando: Comando,
  { state, ordinateDaInserimento }: StatoConOrdine,
  utente: string,
  oggi: string,
): Promise<{ messaggio: string; conferma?: string }> {
  switch (comando.azione) {
    case "non_capito":
      return { messaggio: comando.messaggio };

    case "aggiungi": {
      const sp = comando.spesa;
      const categoria = sp.categoria ?? (await categoriaPer(sp.descrizione, state));
      const t: Transaction = {
        id: crypto.randomUUID(),
        importo: sp.importo,
        categoria,
        data: sp.data,
        nota: sp.descrizione,
        ricorrenteId: null,
      };
      const { error } = await admin.from("transactions").insert(transactionPayload(t, utente));
      if (error) throw error;
      return { messaggio: fraseAggiunta(t, state.categorie, oggi) };
    }

    case "domanda":
      return {
        messaggio: rispostaParlata(
          rispondi(comando.interpretazione, state.transazioni, state.categorie, oggi),
        ),
      };

    case "elimina":
    case "modifica": {
      const candidate = trovaSpese(
        state.transazioni,
        comando.riferimento,
        oggi,
        ordinateDaInserimento,
      );
      const t = candidate[0];
      if (!t) return { messaggio: "Non ho trovato nessuna spesa così." };
      const scade = Date.now() + DURATA_CONFERMA_MS;
      if (comando.azione === "elimina") {
        return {
          messaggio: fraseConfermaElimina(candidate, state.categorie, oggi),
          conferma: await firma({ tipo: "elimina", utente, id: t.id, scade }),
        };
      }
      return {
        messaggio: fraseConfermaModifica(t, comando.modifiche, state.categorie, oggi),
        conferma: await firma({
          tipo: "modifica",
          utente,
          id: t.id,
          modifiche: comando.modifiche,
          scade,
        }),
      };
    }

    case "consiglio": {
      // Mese appena chiuso se siamo nei primi 10 giorni, altrimenti quello in corso.
      const mese =
        Number(oggi.slice(8, 10)) <= 10 ? shiftMonth(monthKey(oggi), -1) : monthKey(oggi);
      const r = calcolaRiepilogo(state, mese, oggi);
      if (r.numeroSpese === 0)
        return { messaggio: "Non ci sono ancora abbastanza spese per un consiglio." };
      const consigli = normalizzaConsigli(
        await chiediGroq(
          ISTRUZIONI_CONSIGLIO,
          `Totali del mese:\n${JSON.stringify(datiPerAI(r, state.profilo))}`,
          300,
          0.4,
        ),
      );
      if (!consigli.length)
        return { messaggio: "Non sono riuscito a preparare un consiglio, riprova." };
      return { messaggio: consigli.map((c) => `${c.titolo}. ${c.testo}`).join(" ") };
    }
  }
}

async function confermaAzione(token: string, utente: string, s: AppState, oggi: string) {
  const azione = await leggiFirma(token, utente);
  if (!azione) return "La conferma è scaduta: ripeti il comando.";
  const t = s.transazioni.find((x) => x.id === azione.id);
  if (!t) return "Quella spesa non c'è più.";
  if (azione.tipo === "elimina") {
    const { error } = await admin
      .from("transactions")
      .delete()
      .eq("id", t.id)
      .eq("user_id", utente);
    if (error) throw error;
    return `Fatto: eliminata ${descriviSpesa(t, s.categorie, oggi)}.`;
  }
  const nuova = applicaModifiche(t, azione.modifiche);
  const { error } = await admin
    .from("transactions")
    .update(transactionPayload(nuova, utente))
    .eq("id", t.id)
    .eq("user_id", utente);
  if (error) throw error;
  return `Fatto: ora è ${descriviSpesa(nuova, s.categorie, oggi)}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ messaggio: "Metodo non consentito" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ messaggio: "Richiesta non valida." }, 400);
  }

  const codice = typeof body.codice === "string" ? body.codice.trim() : "";
  const utente = await utenteDaCodice(codice);
  if (!utente) {
    return json(
      { messaggio: "Codice non valido. Creane uno nuovo nell'app, in Profilo, Siri e widget." },
      401,
    );
  }

  const oggi = oggiInItalia();
  try {
    const dati = await caricaStato(utente);

    if (body.modalita === "widget") return json(datiWidget(dati.state, oggi));

    if (typeof body.conferma === "string" && body.conferma) {
      return json({ messaggio: await confermaAzione(body.conferma, utente, dati.state, oggi) });
    }

    const testo = typeof body.testo === "string" ? body.testo.trim().slice(0, MAX_TESTO) : "";
    if (!testo) return json({ messaggio: "Non ho sentito niente. Riprova." });

    const comando = await capisci(testo, dati.state, oggi);
    return json(await esegui(comando, dati, utente, oggi));
  } catch (e) {
    console.error(e);
    const quota = e instanceof Error && e.message === "quota";
    return json(
      {
        messaggio: quota
          ? "Troppe richieste in poco tempo, riprova tra un minuto."
          : "Qualcosa non ha funzionato, riprova tra poco.",
      },
      quota ? 429 : 500,
    );
  }
});
