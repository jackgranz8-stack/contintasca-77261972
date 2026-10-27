// Conti in Tasca — widget per l'app Scriptable (iPhone, gratuita).
//
// Mostra lo speso del mese, quanto resta del budget e una barra di
// avanzamento. I numeri arrivano dalla funzione "assistente-vocale" con il
// tuo codice personale (Profilo → Siri e widget nell'app).
//
// 1. Incolla qui sotto il codice personale (tra le virgolette).
// 2. Facoltativo: incolla l'indirizzo dell'app, per aprirla toccando il widget.
// L'aggiornamento lo decide iOS (di solito ogni 15-60 minuti), non è in tempo reale.

const CODICE = "INCOLLA_QUI_IL_CODICE";
const INDIRIZZO_APP = ""; // es. "https://contintasca.vercel.app"
const INDIRIZZO_FUNZIONE =
  "https://vwoedwuwepujxmdkroak.supabase.co/functions/v1/assistente-vocale";

const VERDE = new Color("#5FC93A");
const ARANCIO = new Color("#E0A030");
const ROSSO = new Color("#E0533A");
const TESTO = Color.dynamic(new Color("#141A16"), new Color("#F2F5F2"));
const TENUE = Color.dynamic(new Color("#6B756E"), new Color("#9AA6A0"));
const SFONDO = Color.dynamic(new Color("#F4F7F3"), new Color("#0E120F"));
const BINARIO = Color.dynamic(new Color("#E2E8E1"), new Color("#26302A"));

const euro = (n) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

async function leggiDati() {
  const r = new Request(INDIRIZZO_FUNZIONE);
  r.method = "POST";
  r.headers = { "Content-Type": "application/json" };
  r.body = JSON.stringify({ codice: CODICE, modalita: "widget" });
  r.timeoutInterval = 20;
  const dati = await r.loadJSON();
  if (r.response.statusCode !== 200) throw new Error(dati.messaggio || "Errore");
  return dati;
}

function barra(percentuale, larghezza) {
  const h = 8;
  const dc = new DrawContext();
  dc.size = new Size(larghezza, h);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const fondo = new Path();
  fondo.addRoundedRect(new Rect(0, 0, larghezza, h), h / 2, h / 2);
  dc.addPath(fondo);
  dc.setFillColor(BINARIO);
  dc.fillPath();
  const p = Math.max(0, Math.min(100, percentuale));
  if (p > 0) {
    const pieno = new Path();
    pieno.addRoundedRect(new Rect(0, 0, Math.max(h, (larghezza * p) / 100), h), h / 2, h / 2);
    dc.addPath(pieno);
    dc.setFillColor(percentuale > 100 ? ROSSO : percentuale > 85 ? ARANCIO : VERDE);
    dc.fillPath();
  }
  return dc.getImage();
}

function testo(w, t, dimensione, colore, grassetto = false) {
  const s = w.addText(t);
  s.font = grassetto ? Font.semiboldSystemFont(dimensione) : Font.systemFont(dimensione);
  s.textColor = colore;
  s.minimumScaleFactor = 0.6;
  s.lineLimit = 1;
  return s;
}

async function creaWidget() {
  const w = new ListWidget();
  w.backgroundColor = SFONDO;
  w.setPadding(14, 14, 14, 14);
  if (INDIRIZZO_APP) w.url = INDIRIZZO_APP;
  const grande = config.widgetFamily !== "small";

  let dati;
  try {
    dati = await leggiDati();
  } catch (e) {
    testo(w, "Conti in Tasca", 12, TENUE, true);
    w.addSpacer(6);
    const m = w.addText(String(e.message || e));
    m.font = Font.systemFont(12);
    m.textColor = TESTO;
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    return w;
  }

  testo(w, `Speso a ${dati.mese.split(" ")[0].toLowerCase()}`, 12, TENUE);
  w.addSpacer(2);
  testo(w, euro(dati.speso), grande ? 30 : 26, TESTO, true);
  w.addSpacer();

  if (dati.budget > 0) {
    const img = w.addImage(barra(dati.percentuale, grande ? 300 : 130));
    img.imageSize = new Size(grande ? 300 : 130, 8);
    w.addSpacer(6);
    const resta =
      dati.restante >= 0 ? `Ti restano ${euro(dati.restante)}` : `Oltre di ${euro(-dati.restante)}`;
    testo(w, grande ? `${resta} su ${euro(dati.budget)}` : resta, 12, TESTO);
  } else {
    testo(w, "Nessun budget impostato", 12, TENUE);
  }
  if (grande && dati.previsto > 0) {
    w.addSpacer(2);
    testo(w, `+ ${euro(dati.previsto)} previsti entro fine mese`, 11, TENUE);
  }

  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return w;
}

const widget = await creaWidget();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
