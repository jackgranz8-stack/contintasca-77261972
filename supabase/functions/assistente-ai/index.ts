// Supabase Edge Function (Deno). Assistente AI di Conti in Tasca.
//
// UNA sola funzione per tutti i lavori dell'AI, scelti con "modalita":
//
//   domanda    "quanto ho speso in benzina?" → COSA calcolare (periodo,
//              filtri). I conti li fa l'app: qui non arriva nessuna spesa.
//   spesa      "2 caffè da 1,20 stamattina" → importo, descrizione, data,
//              categoria. Usata solo quando l'app non riesce da sola.
//   categoria  "Netflix" → la categoria più adatta fra quelle dell'utente.
//   riepilogo  i TOTALI di un mese per categoria → 2-3 consigli scritti.
//              Nessuna singola spesa, nessuna descrizione.
//   analisi    medie per categoria, confronto con la media Istat e piano per
//              il budget, già calcolati dall'app → sintesi e consigli.
//
// Il modello è gratuito su Groq. La funzione accetta solo utenti con accesso
// all'app (controlla da sola il token, quindi funziona sia con "Verify JWT"
// acceso sia spento): la quota gratuita è una sola per tutta l'app.
//
// Variabili d'ambiente (Supabase → Edge Functions → Secrets):
//   GROQ_API_KEY               (obbligatoria: chiave gratuita da console.groq.com)
//   GROQ_MODEL                 (facoltativa: se Groq ritira il modello predefinito;
//                               elenco dei ritiri: console.groq.com/docs/deprecations)
//   SUPABASE_URL               (già presente di default)
//   SUPABASE_SERVICE_ROLE_KEY  (già presente di default)

import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
// Il modello predefinito di prima (llama-3.3-70b-versatile) è stato ritirato
// da Groq il 16 agosto 2026: le chiamate rispondevano 404. Questo è il
// sostituto indicato da Groq stesso.
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";

/*
 * I modelli gpt-oss "ragionano" prima di rispondere, e quel ragionamento
 * consuma token dal limite della risposta: con un limite piccolo (40 token
 * per la categoria) la risposta restava vuota. Si chiede quindi un
 * ragionamento breve, non lo si fa restituire, e si aggiunge margine.
 */
const MODELLO_CHE_RAGIONA = GROQ_MODEL.startsWith("openai/gpt-oss");
const MARGINE_RAGIONAMENTO = 1500;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_TESTO = 200;
const MAX_CATEGORIE = 60;
const MAX_DATI_RIEPILOGO = 12000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ISTRUZIONI_DOMANDA = `Sei il motore di ricerca di un'app italiana di spese personali.
Trasformi la domanda dell'utente in UN SOLO oggetto JSON, senza altro testo.
Non conosci le spese e non devi inventare numeri: descrivi solo cosa calcolare.

Schema:
{
  "tipo": "totale" | "per_categoria" | "per_mese" | "media_mensile" | "piu_care" | "frequenti" | "confronto" | "ultima" | "analisi" | "non_capito",
  "periodo": Periodo,
  "confronto": Periodo | null,
  "categorie": [id di categoria],
  "testo": string | null,
  "limite": numero | null,
  "messaggio": string | null
}
Periodo è uno di:
  {"tipo":"tutto"}
  {"tipo":"mese_corrente"} | {"tipo":"mese_scorso"} | {"tipo":"anno_corrente"} | {"tipo":"anno_scorso"}
  {"tipo":"ultimi_giorni","n":N}      (oggi compreso; "questa settimana" = 7, "ieri e oggi" = 2, "oggi" = 1)
  {"tipo":"ultimi_mesi","n":N}        (mese in corso compreso)
  {"tipo":"mese","valore":"AAAA-MM"}  (un mese preciso: se l'anno manca, il più recente non futuro)
  {"tipo":"anno","valore":"AAAA"}
  {"tipo":"intervallo","da":"AAAA-MM-GG","a":"AAAA-MM-GG"}

Significato di "tipo":
- totale: quanto ho speso. È il default per "quanto".
- per_categoria: suddivisione per categoria ("in cosa spendo di più", "dove vanno i soldi").
- per_mese: andamento mese per mese.
- media_mensile: quanto spendo in media al mese.
- piu_care: le spese singole più alte ("la spesa più cara", "le 3 spese più grandi"). limite = quante (default 5).
- frequenti: le spese che faccio più spesso. limite = quante.
- confronto: due periodi a confronto ("rispetto al mese scorso", "più o meno dell'anno scorso"). periodo = il primo, confronto = il secondo. Se il secondo non è detto, usa il periodo precedente (mese_corrente → mese_scorso, anno_corrente → anno_scorso).
- ultima: quando ho fatto l'ultima volta una spesa.
- analisi: confronto con la media italiana, su cosa spendo troppo, dove/come risparmiare, come restare nel budget, consigli personalizzati ("spendo più della media?", "su cosa devo tagliare?", "come rientro nel budget?").
- Se l'utente chiede un GRAFICO o una TABELLA, scegli il tipo che li produce: andamento nel tempo ("grafico mese per mese", "come sono andate le spese quest'anno") → per_mese; ripartizione ("grafico per categoria", "torta") → per_categoria; classifiche ("tabella delle spese più care") → piu_care o frequenti; due periodi → confronto.
- "macchina" = categoria auto se esiste; usa i sinonimi evidenti per scegliere la categoria (supermercato → cibo, luce/gas → bollette).
- non_capito: la domanda non riguarda le spese o non si può rispondere. In "messaggio" scrivi una frase breve in italiano che spiega cosa si può chiedere.

Regole:
- "categorie": usa un id SOLO se la domanda nomina quella categoria o un suo sinonimo evidente. Altrimenti [].
- "testo": una parola da cercare nella descrizione delle spese, se la domanda nomina una cosa precisa che NON è una categoria (es. "benzina", "esselunga", "netflix", "pizza"). Una sola parola, minuscola, al singolare, senza articoli. Altrimenti null.
- Se la domanda non indica un periodo, usa {"tipo":"tutto"}, tranne per "quanto ho speso" senza altro: mese_corrente.
- "confronto" è null se tipo non è "confronto". "messaggio" è null se tipo non è "non_capito".

Esempi (oggi = 2026-10-26, categorie: cibo=Cibo, auto=Auto, casa=Casa):
"quanto ho speso in benzina quest'anno?" → {"tipo":"totale","periodo":{"tipo":"anno_corrente"},"confronto":null,"categorie":[],"testo":"benzina","limite":null,"messaggio":null}
"quanto spendo al mese per mangiare?" → {"tipo":"media_mensile","periodo":{"tipo":"tutto"},"confronto":null,"categorie":["cibo"],"testo":null,"limite":null,"messaggio":null}
"ad agosto ho speso più o meno di luglio per l'auto?" → {"tipo":"confronto","periodo":{"tipo":"mese","valore":"2026-08"},"confronto":{"tipo":"mese","valore":"2026-07"},"categorie":["auto"],"testo":null,"limite":null,"messaggio":null}
"le 3 spese più care dell'estate" → {"tipo":"piu_care","periodo":{"tipo":"intervallo","da":"2026-06-01","a":"2026-08-31"},"confronto":null,"categorie":[],"testo":null,"limite":3,"messaggio":null}
"quando ho fatto l'ultima volta la spesa all'esselunga?" → {"tipo":"ultima","periodo":{"tipo":"tutto"},"confronto":null,"categorie":[],"testo":"esselunga","limite":null,"messaggio":null}
"che tempo fa?" → {"tipo":"non_capito","periodo":{"tipo":"tutto"},"confronto":null,"categorie":[],"testo":null,"limite":null,"messaggio":"Posso rispondere solo a domande sulle tue spese, per esempio “quanto ho speso in benzina quest'anno?”"}`;

const ISTRUZIONI_SPESA = `Leggi la frase con cui l'utente descrive UNA spesa e rispondi con UN SOLO oggetto JSON:
{"importo": numero in euro, "descrizione": string, "data": "AAAA-MM-GG", "categoria": id | null}
Regole:
- importo: il totale pagato. "2 caffè da 1,20" = 2.4. Usa il punto per i decimali. Se non c'è nessun importo: null.
- descrizione: breve, 1-4 parole, come la scriverebbe l'utente ("Caffè al bar", "Benzina", "Cena da Mario"). Iniziale maiuscola. Senza importo né data.
- data: oggi se non indicata. "ieri", "lunedì scorso", "il 3" ecc. vanno calcolati rispetto alla data di oggi. Mai nel futuro, salvo che la frase lo dica.
- categoria: l'id della categoria più adatta fra quelle date, oppure null se nessuna è adatta.
Esempio (oggi = 2026-10-26, lunedì; categorie: cibo=Cibo, auto=Auto):
"2 caffè da 1,20 stamattina" → {"importo":2.4,"descrizione":"Caffè","data":"2026-10-26","categoria":"cibo"}
"pieno 65€ sabato" → {"importo":65,"descrizione":"Pieno benzina","data":"2026-10-24","categoria":"auto"}`;

const ISTRUZIONI_CATEGORIA = `Scegli la categoria di una spesa personale a partire dalla sua descrizione.
Rispondi con UN SOLO oggetto JSON: {"categoria": id | null}
Usa solo gli id delle categorie date. Se nessuna è davvero adatta, o la descrizione non dice nulla, rispondi {"categoria": null}.
Ragiona come un italiano: "Esselunga", "Conad" = spesa alimentare; "Eni", "pieno" = auto/carburante; "Enel", "bolletta luce" = bollette; "farmacia" = salute; "Netflix", "Spotify" = svago o abbonamenti se esiste.`;

const ISTRUZIONI_RIEPILOGO = `Sei un consulente di finanza personale, pratico e gentile, che parla italiano in modo semplice.
Ricevi i TOTALI di un mese di spese di una persona (per categoria, con media dei mesi precedenti e budget) e scrivi 2 o 3 consigli concreti.
Rispondi con UN SOLO oggetto JSON: {"consigli": [{"titolo": string, "testo": string}]}
Regole:
- Usa SOLO i numeri forniti. Non fare calcoli nuovi e non inventare cifre. Puoi citare un numero così com'è.
- Ogni consiglio: titolo di massimo 6 parole; testo di 1-2 frasi, con un'azione che si può fare questo mese.
- Parti da ciò che conta di più: categorie oltre budget o molto sopra la media. Se il mese è andato bene, dillo e suggerisci come mantenere o mettere da parte.
- Niente consigli su investimenti, prestiti o prodotti finanziari. Niente giudizi sulla persona. Dai del tu.`;

const ISTRUZIONI_ANALISI = `Sei un consulente di finanza personale italiano: concreto, gentile, mai giudicante. Dai del tu.
Ricevi un'analisi GIÀ CALCOLATA delle spese di una persona: medie mensili per categoria, confronto con la media italiana Istat per una famiglia simile (stesso numero di persone e stessa situazione abitativa), budget, mese in corso e tagli proposti.
Rispondi con UN SOLO oggetto JSON: {"sintesi": string, "punti": [{"titolo": string, "testo": string}]}
- sintesi: 1-2 frasi sulla situazione complessiva (dentro o fuori budget, sopra o sotto la media italiana).
- punti: da 2 a 4, in ordine di importanza. Ognuno: titolo di massimo 6 parole; testo di 1-2 frasi con un'azione concreta per questo mese.
Regole:
- Usa SOLO i numeri forniti, così come sono. Non fare calcoli nuovi e non inventare cifre.
- Tieni conto del profilo: con più persone è normale spendere di più in alimentari; chi è in affitto o con mutuo ha la casa come costo fisso (se la divide, conta la sua quota); senza auto i trasporti dovrebbero essere bassi; al Nord e al Centro i costi sono più alti che al Sud e nelle Isole (la media fornita ne tiene già conto).
- Se c'è il reddito: un risparmio negativo è la priorità assoluta; un risparmio sotto il 10% del reddito merita attenzione; sopra il 20% va bene. Se il budget supera il reddito, fallo notare.
- Categorie con riducibile_a_breve = false (casa, bollette, salute, assicurazioni): niente tagli immediati, al massimo un'idea a medio termine (cambiare fornitore, rinegoziare).
- Se ci sono tagli_proposti, presentali come piano per rientrare nel budget. Se tagli_non_bastano è true, dillo con tatto: servono scelte sui costi fissi o un budget più realistico.
- Se è tutto sotto controllo, dillo e suggerisci come mettere da parte la differenza.
- La media italiana è un riferimento, non un obiettivo: chi spende meno non deve spendere di più.
- Niente investimenti, prestiti o prodotti finanziari.`;

type Modalita = "domanda" | "spesa" | "categoria" | "riepilogo" | "analisi";

function testoBreve(v: unknown, max = MAX_TESTO): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function elencoCategorie(v: unknown): string {
  const righe = (Array.isArray(v) ? v : [])
    .slice(0, MAX_CATEGORIE)
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : {}))
    .filter((c) => typeof c.id === "string" && typeof c.nome === "string")
    .map((c) => `${String(c.id).slice(0, 60)}=${String(c.nome).slice(0, 60)}`);
  return righe.join(", ") || "nessuna";
}

function dataValida(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? v
    : new Date().toISOString().slice(0, 10);
}

function giornoSettimana(iso: string): string {
  const giorni = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  return giorni[new Date(iso + "T12:00:00Z").getUTCDay()] ?? "";
}

/** Prepara istruzioni e messaggio per ogni modalità; null se l'input non va. */
function preparaRichiesta(
  modalita: Modalita,
  body: Record<string, unknown>,
): { sistema: string; utente: string; temperatura: number; maxToken: number } | { errore: string } {
  switch (modalita) {
    case "domanda": {
      const domanda = testoBreve(body.domanda);
      if (!domanda) return { errore: "Domanda vuota" };
      const oggi = dataValida(body.oggi);
      return {
        sistema: ISTRUZIONI_DOMANDA,
        utente: `Oggi è ${oggi}. Categorie dell'utente: ${elencoCategorie(body.categorie)}.\nDomanda: ${domanda}`,
        temperatura: 0,
        maxToken: 300,
      };
    }
    case "spesa": {
      const testo = testoBreve(body.testo);
      if (!testo) return { errore: "Frase vuota" };
      const oggi = dataValida(body.oggi);
      return {
        sistema: ISTRUZIONI_SPESA,
        utente: `Oggi è ${oggi} (${giornoSettimana(oggi)}). Categorie: ${elencoCategorie(body.categorie)}.\nFrase: ${testo}`,
        temperatura: 0,
        maxToken: 150,
      };
    }
    case "categoria": {
      const descrizione = testoBreve(body.descrizione, 80);
      if (!descrizione) return { errore: "Descrizione vuota" };
      return {
        sistema: ISTRUZIONI_CATEGORIA,
        utente: `Categorie: ${elencoCategorie(body.categorie)}.\nDescrizione: ${descrizione}`,
        temperatura: 0,
        maxToken: 40,
      };
    }
    case "analisi": {
      const dati = JSON.stringify(body.dati ?? null);
      if (!body.dati || dati.length > MAX_DATI_RIEPILOGO) return { errore: "Dati non validi" };
      return {
        sistema: ISTRUZIONI_ANALISI,
        utente: `Analisi delle spese:\n${dati}`,
        temperatura: 0.4,
        maxToken: 700,
      };
    }
    case "riepilogo": {
      const dati = JSON.stringify(body.dati ?? null);
      if (!body.dati || dati.length > MAX_DATI_RIEPILOGO) return { errore: "Dati non validi" };
      return {
        sistema: ISTRUZIONI_RIEPILOGO,
        utente: `Totali del mese:\n${dati}`,
        temperatura: 0.4,
        maxToken: 500,
      };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);
  if (!GROQ_API_KEY) return json({ errore: "GROQ_API_KEY mancante nei Secrets" }, 500);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ errore: "Accesso richiesto" }, 401);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: utente, error: errUtente } = await admin.auth.getUser(token);
  if (errUtente || !utente?.user) return json({ errore: "Accesso richiesto" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida" }, 400);
  }

  const modalita = body.modalita as Modalita;
  if (!["domanda", "spesa", "categoria", "riepilogo", "analisi"].includes(modalita)) {
    return json({ errore: "Modalità non valida" }, 400);
  }
  const richiesta = preparaRichiesta(modalita, body);
  if ("errore" in richiesta) return json({ errore: richiesta.errore }, 400);

  let risposta: Response;
  try {
    risposta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: richiesta.temperatura,
        max_completion_tokens:
          richiesta.maxToken + (MODELLO_CHE_RAGIONA ? MARGINE_RAGIONAMENTO : 0),
        ...(MODELLO_CHE_RAGIONA ? { reasoning_effort: "low", include_reasoning: false } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: richiesta.sistema },
          { role: "user", content: richiesta.utente },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return json({ errore: "Il servizio AI non risponde, riprova tra poco" }, 504);
  }

  if (risposta.status === 429) {
    return json({ errore: "Troppe richieste in poco tempo: riprova tra un minuto" }, 429);
  }
  if (!risposta.ok) {
    console.error("Groq", risposta.status, (await risposta.text()).slice(0, 300));
    return json({ errore: `Servizio AI non disponibile (${risposta.status})` }, 502);
  }

  const dati = await risposta.json().catch(() => null);
  const testo: string = dati?.choices?.[0]?.message?.content ?? "";
  try {
    // La validazione vera la fa l'app, campo per campo: qui basta che sia JSON.
    return json({ risultato: JSON.parse(testo) });
  } catch {
    return json({ errore: "Risposta dell'AI non leggibile, riprova" }, 502);
  }
});
