// @ts-nocheck
// FILE GENERATO: non modificarlo a mano.
// È sorgente.ts con la logica di src/lib già inclusa, pronto da incollare
// nell'editor di Supabase (funzione assistente-vocale, Verify JWT spento).
// Per rigenerarlo: node scripts/genera-funzione-vocale.mjs


// supabase/functions/assistente-vocale/sorgente.ts
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

// src/lib/descrizioni.ts
function normalizza(testo) {
  return testo.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function contieneTesto(testo, ricerca) {
  const q = normalizza(ricerca);
  if (!q) return true;
  return normalizza(testo ?? "").includes(q);
}
function categoriaPerDescrizione(transazioni, descrizione, categorieEsistenti) {
  const chiave = normalizza(descrizione);
  if (!chiave) return null;
  const valide = new Set(categorieEsistenti);
  let migliore = null;
  for (const t of transazioni) {
    if (!valide.has(t.categoria)) continue;
    if (normalizza(t.nota ?? "") !== chiave) continue;
    if (!migliore || t.data > migliore.data) migliore = t;
  }
  return migliore ? migliore.categoria : null;
}

// src/lib/format.ts
var MONTHS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre"
];
function monthKey(d) {
  const date = typeof d === "string" ? /* @__PURE__ */ new Date(d + "T00:00:00") : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function currentMonth() {
  return monthKey(/* @__PURE__ */ new Date());
}
function monthLabel(key, short = false) {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[(m ?? 1) - 1] ?? "";
  return short ? name.slice(0, 3) : `${name} ${y}`;
}
function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}
function todayISO() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function spostaGiorni(iso, n) {
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function eur(n) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2
  }).format(n);
}
function formatDay(iso) {
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${(MONTHS[d.getMonth()] ?? "").slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
}

// src/lib/ricorrenze.ts
var pad = (n) => String(n).padStart(2, "0");
var toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
function giornoDopo(iso) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + 1);
  return toISO(d);
}
function ultimoGiornoDelMese(mk) {
  const [y, m] = mk.split("-").map(Number);
  return toISO(new Date(y ?? 1970, m ?? 1, 0));
}
var MAX_OCCORRENZE = 60;
function occorrenzeTra(r, da, a) {
  if (da > a) return [];
  const intervallo = Math.max(1, Math.round(r.intervallo || 1));
  const limite = r.fine && r.fine < a ? r.fine : a;
  if (da > limite) return [];
  const out = [];
  const inizio = fromISO(r.inizio);
  if (r.cadenza === "settimane") {
    const passo = intervallo * 7;
    const giorniDaInizio = Math.round(
      (fromISO(da).getTime() - inizio.getTime()) / (24 * 60 * 60 * 1e3)
    );
    const saltiIniziali2 = giorniDaInizio > 0 ? Math.ceil(giorniDaInizio / passo) : 0;
    for (let k = saltiIniziali2; out.length < MAX_OCCORRENZE; k++) {
      const d = new Date(inizio);
      d.setDate(d.getDate() + k * passo);
      const iso = toISO(d);
      if (iso > limite) break;
      if (iso >= da) out.push(iso);
    }
    return out;
  }
  const giorno = Math.min(28, Math.max(1, r.giorno || 1));
  const meseInizio = inizio.getFullYear() * 12 + inizio.getMonth();
  const daD = fromISO(da);
  const meseDa = daD.getFullYear() * 12 + daD.getMonth();
  const diff = meseDa - meseInizio;
  const saltiIniziali = diff > 0 ? Math.floor(diff / intervallo) : 0;
  for (let k = saltiIniziali; out.length < MAX_OCCORRENZE; k++) {
    const mesi = meseInizio + k * intervallo;
    const d = new Date(Math.floor(mesi / 12), mesi % 12, giorno);
    const iso = toISO(d);
    if (iso > limite) break;
    if (iso >= da) out.push(iso);
    if (k - saltiIniziali > MAX_OCCORRENZE * 2) break;
  }
  return out;
}

// src/lib/previsioni.ts
function txRealizzate(txs, oggi = todayISO()) {
  return txs.filter((t) => t.data <= oggi);
}
function txFuture(txs, oggi = todayISO()) {
  return txs.filter((t) => t.data > oggi);
}
function ricorrentiInAttesa(state, oggi = todayISO()) {
  const mk = currentMonth();
  const fineMese = ultimoGiornoDelMese(mk);
  const out = [];
  for (const r of state.ricorrenti) {
    if (!r.attiva) continue;
    if (!state.categorie.some((c) => c.id === r.categoria)) continue;
    const occorrenze = occorrenzeTra(r, giornoDopo(oggi), fineMese);
    for (const data of occorrenze) {
      const giaRegistrata = state.transazioni.some(
        (t) => t.ricorrenteId === r.id && t.data === data
      );
      if (giaRegistrata) continue;
      out.push({
        id: `ric:${r.id}:${data}`,
        importo: r.importo,
        categoria: r.categoria,
        data,
        nota: r.nome,
        fonte: "ricorrente",
        ricorrenteId: r.id
      });
    }
  }
  return out;
}
function previsteDelMese(state, mk, oggi = todayISO()) {
  const manuali = txFuture(state.transazioni, oggi).filter((t) => monthKey(t.data) === mk).map((t) => ({
    id: t.id,
    importo: t.importo,
    categoria: t.categoria,
    data: t.data,
    nota: t.nota,
    fonte: "manuale"
  }));
  const ricorrenti = mk === currentMonth() ? ricorrentiInAttesa(state, oggi) : [];
  return [...manuali, ...ricorrenti].sort((a, b) => a.data < b.data ? -1 : 1);
}
function sommaPreviste(list) {
  return list.reduce((a, p) => a + p.importo, 0);
}

// src/lib/domande.ts
var TIPI_DOMANDA = [
  "totale",
  "per_categoria",
  "per_mese",
  "media_mensile",
  "piu_care",
  "frequenti",
  "confronto",
  "ultima",
  "non_capito"
];
var DATA = /^\d{4}-\d{2}-\d{2}$/;
var MESE = /^\d{4}-(0[1-9]|1[0-2])$/;
var ANNO = /^\d{4}$/;
function intero(v, min, max, predefinito) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return predefinito;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function oggetto(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function normalizzaPeriodo(v) {
  const p = oggetto(v);
  switch (p.tipo) {
    case "tutto":
    case "mese_corrente":
    case "mese_scorso":
    case "anno_corrente":
    case "anno_scorso":
      return { tipo: p.tipo };
    case "ultimi_giorni":
      return { tipo: "ultimi_giorni", n: intero(p.n, 1, 3650, 30) };
    case "ultimi_mesi":
      return { tipo: "ultimi_mesi", n: intero(p.n, 1, 120, 3) };
    case "mese":
      return typeof p.valore === "string" && MESE.test(p.valore) ? { tipo: "mese", valore: p.valore } : null;
    case "anno":
      return typeof p.valore === "string" && ANNO.test(p.valore) ? { tipo: "anno", valore: p.valore } : null;
    case "intervallo": {
      if (typeof p.da !== "string" || typeof p.a !== "string") return null;
      if (!DATA.test(p.da) || !DATA.test(p.a)) return null;
      const [da, a] = p.da <= p.a ? [p.da, p.a] : [p.a, p.da];
      return { tipo: "intervallo", da, a };
    }
    default:
      return null;
  }
}
function normalizzaInterpretazione(grezza, categorieEsistenti) {
  const g = oggetto(grezza);
  const tipo = TIPI_DOMANDA.includes(g.tipo) ? g.tipo : "non_capito";
  const valide = new Set(categorieEsistenti);
  const categorie = Array.isArray(g.categorie) ? [...new Set(g.categorie.filter((c) => typeof c === "string" && valide.has(c)))] : [];
  const testo = typeof g.testo === "string" && g.testo.trim() ? g.testo.trim().slice(0, 40) : null;
  const messaggio = typeof g.messaggio === "string" && g.messaggio.trim() ? g.messaggio.trim().slice(0, 200) : null;
  const confronto = tipo === "confronto" ? normalizzaPeriodo(g.confronto) : null;
  return {
    // Un confronto senza secondo periodo non si può fare: diventa un totale.
    tipo: tipo === "confronto" && !confronto ? "totale" : tipo,
    periodo: normalizzaPeriodo(g.periodo) ?? { tipo: "tutto" },
    confronto,
    categorie,
    testo,
    limite: intero(g.limite, 1, 10, 5),
    messaggio
  };
}
function ultimoGiornoMese(mk) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y ?? 2e3, m ?? 1, 0);
  return `${mk}-${String(d.getDate()).padStart(2, "0")}`;
}
function intervalloDi(p, oggi) {
  const mc = monthKey(oggi);
  const anno = oggi.slice(0, 4);
  switch (p.tipo) {
    case "tutto":
      return null;
    case "mese_corrente":
      return { da: `${mc}-01`, a: ultimoGiornoMese(mc) };
    case "mese_scorso": {
      const ms = shiftMonth(mc, -1);
      return { da: `${ms}-01`, a: ultimoGiornoMese(ms) };
    }
    case "anno_corrente":
      return { da: `${anno}-01-01`, a: `${anno}-12-31` };
    case "anno_scorso": {
      const a = String(Number(anno) - 1);
      return { da: `${a}-01-01`, a: `${a}-12-31` };
    }
    case "ultimi_giorni":
      return { da: spostaGiorni(oggi, -(p.n - 1)), a: oggi };
    case "ultimi_mesi":
      return { da: `${shiftMonth(mc, -(p.n - 1))}-01`, a: oggi };
    case "mese":
      return { da: `${p.valore}-01`, a: ultimoGiornoMese(p.valore) };
    case "anno":
      return { da: `${p.valore}-01-01`, a: `${p.valore}-12-31` };
    case "intervallo":
      return { da: p.da, a: p.a };
  }
}
function etichettaPeriodo(p, oggi) {
  switch (p.tipo) {
    case "tutto":
      return "in totale";
    case "mese_corrente":
      return "questo mese";
    case "mese_scorso":
      return `a ${monthLabel(shiftMonth(monthKey(oggi), -1)).toLowerCase()}`;
    case "anno_corrente":
      return "quest'anno";
    case "anno_scorso":
      return "l'anno scorso";
    case "ultimi_giorni":
      return p.n === 1 ? "oggi" : `negli ultimi ${p.n} giorni`;
    case "ultimi_mesi":
      return p.n === 1 ? "questo mese" : `negli ultimi ${p.n} mesi`;
    case "mese":
      return `a ${monthLabel(p.valore).toLowerCase()}`;
    case "anno":
      return `nel ${p.valore}`;
    case "intervallo":
      return `dal ${formatDay(p.da)} al ${formatDay(p.a)}`;
  }
}
function radice(parola) {
  const p = parola.trim();
  if (p.length >= 5 && /[aeiouàèéìòù]$/i.test(p)) return p.slice(0, -1);
  return p;
}
function filtra(txs, i, p, oggi) {
  const intervallo = intervalloDi(p, oggi);
  const cat = new Set(i.categorie);
  const parola = i.testo ? radice(i.testo) : "";
  return txs.filter(
    (t) => (!intervallo || t.data >= intervallo.da && t.data <= intervallo.a) && (cat.size === 0 || cat.has(t.categoria)) && (!parola || contieneTesto(t.nota, parola))
  );
}
var somma = (txs) => txs.reduce((s, t) => s + t.importo, 0);
var arrotonda = (n) => Math.round(n * 100) / 100;
function senzaPreposizione(etichetta) {
  return etichetta.replace(/^(a|nel) /, "");
}
function quante(n) {
  return n === 1 ? "1 spesa" : `${n} spese`;
}
function soggetto(i, categorie) {
  const nomi = i.categorie.map((id) => categorie.find((c) => c.id === id)?.nome).filter((n) => !!n);
  const parti = [];
  if (nomi.length > 0) parti.push(`in ${nomi.join(", ")}`);
  if (i.testo) parti.push(`per \u201C${i.testo}\u201D`);
  return parti.join(" ");
}
function frase(...pezzi) {
  const s = pezzi.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function rispondi(i, transazioni, categorie, oggi) {
  if (i.tipo === "non_capito") {
    return {
      frase: i.messaggio ?? "Non ho capito la domanda. Prova con qualcosa come \u201Cquanto ho speso in benzina quest'anno?\u201D"
    };
  }
  const realizzate = txRealizzate(transazioni, oggi);
  const scelte = filtra(realizzate, i, i.periodo, oggi);
  const chi = soggetto(i, categorie);
  const quando = etichettaPeriodo(i.periodo, oggi);
  const quandoBreve = i.periodo.tipo === "tutto" ? "" : quando;
  if (scelte.length === 0 && i.tipo !== "confronto") {
    return { frase: frase("Nessuna spesa", chi, quando + ".") };
  }
  switch (i.tipo) {
    case "totale":
      return {
        valore: eur(arrotonda(somma(scelte))),
        frase: frase("Hai speso", chi, quando, `\xB7 ${quante(scelte.length)}`)
      };
    case "per_categoria": {
      const tot = somma(scelte);
      const per = /* @__PURE__ */ new Map();
      for (const t of scelte) per.set(t.categoria, (per.get(t.categoria) ?? 0) + t.importo);
      const righe = [...per.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({
        etichetta: categorie.find((c) => c.id === id)?.nome ?? "Categoria eliminata",
        valore: eur(arrotonda(v)),
        nota: tot > 0 ? `${Math.round(v / tot * 100)}%` : void 0
      }));
      return {
        valore: eur(arrotonda(tot)),
        frase: frase("Spese", chi, quandoBreve, "per categoria"),
        righe
      };
    }
    case "per_mese": {
      const per = /* @__PURE__ */ new Map();
      for (const t of scelte) {
        const m = monthKey(t.data);
        per.set(m, (per.get(m) ?? 0) + t.importo);
      }
      const righe = [...per.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1).slice(0, 24).map(([m, v]) => ({ etichetta: monthLabel(m), valore: eur(arrotonda(v)) }));
      return {
        valore: eur(arrotonda(somma(scelte))),
        frase: frase("Spese", chi, quandoBreve, "mese per mese"),
        righe
      };
    }
    case "media_mensile": {
      const intervallo = intervalloDi(i.periodo, oggi);
      const primaData = scelte.reduce((m, t) => t.data < m ? t.data : m, scelte[0].data);
      const inizio = monthKey(intervallo ? intervallo.da : primaData);
      const fine = monthKey(intervallo && intervallo.a < oggi ? intervallo.a : oggi);
      const [ya, ma] = inizio.split("-").map(Number);
      const [yb, mb] = fine.split("-").map(Number);
      const mesi = Math.max(1, ((yb ?? 0) - (ya ?? 0)) * 12 + ((mb ?? 0) - (ma ?? 0)) + 1);
      return {
        valore: eur(arrotonda(somma(scelte) / mesi)),
        frase: frase(
          "In media al mese",
          chi,
          quandoBreve,
          `\xB7 ${eur(arrotonda(somma(scelte)))} in ${mesi} ${mesi === 1 ? "mese" : "mesi"}`
        )
      };
    }
    case "piu_care": {
      const righe = [...scelte].sort((a, b) => b.importo - a.importo).slice(0, i.limite).map((t) => ({
        etichetta: t.nota || categorie.find((c) => c.id === t.categoria)?.nome || "Spesa",
        valore: eur(t.importo),
        nota: formatDay(t.data)
      }));
      return { frase: frase("Le spese pi\xF9 alte", chi, quandoBreve), righe };
    }
    case "frequenti": {
      const per = /* @__PURE__ */ new Map();
      for (const t of scelte) {
        const testo = (t.nota ?? "").trim();
        if (!testo) continue;
        const k = testo.toLowerCase();
        const v = per.get(k) ?? { testo, n: 0, tot: 0 };
        v.n += 1;
        v.tot += t.importo;
        per.set(k, v);
      }
      const righe = [...per.values()].sort((a, b) => b.n - a.n || b.tot - a.tot).slice(0, i.limite).map((v) => ({
        etichetta: v.testo,
        valore: eur(arrotonda(v.tot)),
        nota: v.n === 1 ? "1 volta" : `${v.n} volte`
      }));
      if (righe.length === 0) {
        return { frase: frase("Le spese", chi, quandoBreve, "non hanno descrizione.") };
      }
      return { frase: frase("Le spese pi\xF9 frequenti", chi, quandoBreve), righe };
    }
    case "confronto": {
      const altro = i.confronto ?? { tipo: "tutto" };
      const b = filtra(realizzate, i, altro, oggi);
      const va = arrotonda(somma(scelte));
      const vb = arrotonda(somma(b));
      const diff = arrotonda(va - vb);
      const pctDiff = vb > 0 ? Math.round(diff / vb * 100) : null;
      const quandoB = etichettaPeriodo(altro, oggi);
      const esito = diff === 0 ? "uguale" : `${diff > 0 ? "+" : "\u2212"}${eur(Math.abs(diff))}${pctDiff !== null ? ` (${diff > 0 ? "+" : "\u2212"}${Math.abs(pctDiff)}%)` : ""}`;
      return {
        valore: esito,
        frase: frase(chi || "Spese", quando, "rispetto a", senzaPreposizione(quandoB)),
        righe: [
          {
            etichetta: frase(senzaPreposizione(quando)),
            valore: eur(va),
            nota: quante(scelte.length)
          },
          { etichetta: frase(senzaPreposizione(quandoB)), valore: eur(vb), nota: quante(b.length) }
        ]
      };
    }
    case "ultima": {
      const t = scelte.reduce((m, x) => x.data > m.data ? x : m, scelte[0]);
      return {
        valore: formatDay(t.data),
        frase: frase(
          "L'ultima volta",
          chi,
          `\xB7 ${t.nota || categorie.find((c) => c.id === t.categoria)?.nome || "spesa"} da ${eur(t.importo)}`
        )
      };
    }
  }
}

// src/lib/spesaAParole.ts
var GIORNI = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
var RIEMPITIVI = /* @__PURE__ */ new Set([
  "ho",
  "speso",
  "pagato",
  "comprato",
  "preso",
  "euro",
  "eur",
  "\u20AC",
  "per",
  "di",
  "da",
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "una",
  "uno",
  "al",
  "allo",
  "alla",
  "ai",
  "agli",
  "alle",
  "del",
  "della",
  "a",
  "e",
  "in"
]);
function senzaAccenti(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function ultimoGiorno(oggi, indice) {
  const d = /* @__PURE__ */ new Date(oggi + "T00:00:00");
  const diff = (d.getDay() - indice + 7) % 7;
  return spostaGiorni(oggi, -diff);
}
function leggiSpesaLocale(frase2, oggi) {
  let testo = ` ${senzaAccenti(frase2.trim())} `;
  if (testo.trim().length === 0) return null;
  let data = oggi;
  const giorniFa = testo.match(/\s(\d{1,2})\s+giorn[oi]\s+fa\s/);
  if (giorniFa) {
    data = spostaGiorni(oggi, -Number(giorniFa[1]));
    testo = testo.replace(giorniFa[0], " ");
  } else if (/\s(l['’]?altro\s*ieri|altroieri)\s/.test(testo)) {
    data = spostaGiorni(oggi, -2);
    testo = testo.replace(/\s(l['’]?altro\s*ieri|altroieri)\s/, " ");
  } else if (/\sieri(\s+sera|\s+mattina)?\s/.test(testo)) {
    data = spostaGiorni(oggi, -1);
    testo = testo.replace(/\sieri(\s+sera|\s+mattina)?\s/, " ");
  } else if (/\s(oggi|stamattina|stasera|stamani)\s/.test(testo)) {
    testo = testo.replace(/\s(oggi|stamattina|stasera|stamani)\s/, " ");
  } else {
    const giorno = GIORNI.findIndex((g) => new RegExp(`\\s${g}\\s`).test(testo));
    if (giorno >= 0) {
      data = ultimoGiorno(oggi, giorno);
      testo = testo.replace(new RegExp(`\\s${GIORNI[giorno] ?? ""}\\s`), " ");
    }
  }
  const numeri = [...testo.matchAll(/(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)?/g)];
  if (numeri.length !== 1) return null;
  const trovato = numeri[0];
  const importo = Number((trovato[1] ?? "").replace(",", "."));
  if (!Number.isFinite(importo) || importo <= 0) return null;
  testo = testo.replace(trovato[0], " ");
  const parole = testo.split(/\s+/).filter(Boolean);
  while (parole.length > 0 && RIEMPITIVI.has(parole[0])) parole.shift();
  while (parole.length > 0 && RIEMPITIVI.has(parole[parole.length - 1])) parole.pop();
  if (parole.length === 0) return null;
  const pulita = parole.join(" ");
  const originale = frase2.trim();
  const inizio = senzaAccenti(originale).indexOf(pulita);
  const descrizione = inizio >= 0 ? originale.slice(inizio, inizio + pulita.length) : pulita;
  return {
    importo: Math.round(importo * 100) / 100,
    descrizione: descrizione.charAt(0).toUpperCase() + descrizione.slice(1),
    data,
    categoria: null
  };
}
function normalizzaSpesaAI(grezza, oggi, categorieEsistenti) {
  if (!grezza || typeof grezza !== "object") return null;
  const g = grezza;
  const importo = typeof g.importo === "number" ? g.importo : Number(g.importo);
  if (!Number.isFinite(importo) || importo <= 0 || importo > 1e6) return null;
  const descrizione = typeof g.descrizione === "string" ? g.descrizione.trim().slice(0, 80) : "";
  const minima = spostaGiorni(oggi, -366);
  const massima = spostaGiorni(oggi, 366);
  const data = typeof g.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.data) && g.data >= minima && g.data <= massima ? g.data : oggi;
  const categoria = typeof g.categoria === "string" && categorieEsistenti.includes(g.categoria) ? g.categoria : null;
  return {
    importo: Math.round(importo * 100) / 100,
    descrizione: descrizione ? descrizione.charAt(0).toUpperCase() + descrizione.slice(1) : "",
    data,
    categoria
  };
}

// src/lib/vocale.ts
var NON_CAPITO = "Non ho capito. Puoi dire per esempio: \u201Cpizza 18 ieri\u201D, \u201Cquanto ho speso questo mese?\u201D oppure \u201Celimina l'ultima spesa\u201D.";
var PAROLE_NON_AGGIUNTA = /\b(elimina|eliminare|cancella|cancellare|togli|rimuovi|modifica|cambia|correggi|sposta|era|erano|quanto|quanti|quante|quando|qual|quale|quali|cosa|come|perche|dove|consiglio|consigli|risparmi\w*|budget)\b|\?/;
function senzaAccenti2(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function serveAI(testo) {
  return PAROLE_NON_AGGIUNTA.test(senzaAccenti2(testo));
}
function pulisciComando(testo) {
  return testo.trim().replace(
    /^(aggiungi|aggiungere|segna|segnami|registra|inserisci|metti)(\s+una)?(\s+spesa\s+(di|da|per))?\s+/i,
    ""
  ).trim();
}
function oggetto2(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function normalizzaRiferimento(v) {
  const r = oggetto2(v);
  const importo = typeof r["importo"] === "number" ? r["importo"] : Number(r["importo"]);
  return {
    ultima: r["ultima"] === true,
    testo: typeof r["testo"] === "string" && r["testo"].trim() ? r["testo"].trim().slice(0, 40) : null,
    importo: Number.isFinite(importo) && importo > 0 ? Math.round(importo * 100) / 100 : null,
    periodo: r["periodo"] ? normalizzaPeriodo(r["periodo"]) : null
  };
}
function normalizzaModifiche(v, oggi, categorie) {
  const m = oggetto2(v);
  const out = {};
  const importo = typeof m["importo"] === "number" ? m["importo"] : Number(m["importo"]);
  if (m["importo"] != null && Number.isFinite(importo) && importo > 0 && importo < 1e6) {
    out.importo = Math.round(importo * 100) / 100;
  }
  if (typeof m["descrizione"] === "string" && m["descrizione"].trim()) {
    const d = m["descrizione"].trim().slice(0, 80);
    out.descrizione = d.charAt(0).toUpperCase() + d.slice(1);
  }
  if (typeof m["data"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m["data"]) && m["data"] >= spostaGiorni(oggi, -366) && m["data"] <= spostaGiorni(oggi, 366)) {
    out.data = m["data"];
  }
  if (typeof m["categoria"] === "string" && categorie.includes(m["categoria"])) {
    out.categoria = m["categoria"];
  }
  return out;
}
function normalizzaComando(grezzo, oggi, categorie) {
  const g = oggetto2(grezzo);
  const messaggio = typeof g["messaggio"] === "string" && g["messaggio"].trim() ? g["messaggio"].trim().slice(0, 200) : NON_CAPITO;
  switch (g["azione"]) {
    case "aggiungi": {
      const spesa = normalizzaSpesaAI(g["spesa"], oggi, categorie);
      return spesa ? { azione: "aggiungi", spesa } : {
        azione: "non_capito",
        messaggio: "Non ho capito l'importo. Riprova con qualcosa come \u201Cpizza 18 ieri\u201D."
      };
    }
    case "domanda":
      return {
        azione: "domanda",
        interpretazione: normalizzaInterpretazione(g["domanda"], categorie)
      };
    case "elimina":
      return { azione: "elimina", riferimento: normalizzaRiferimento(g["riferimento"]) };
    case "modifica": {
      const modifiche = normalizzaModifiche(g["modifiche"], oggi, categorie);
      if (Object.keys(modifiche).length === 0) {
        return {
          azione: "non_capito",
          messaggio: "Non ho capito cosa cambiare. Prova con \u201Cla pizza di ieri era 20 euro\u201D."
        };
      }
      return {
        azione: "modifica",
        riferimento: normalizzaRiferimento(g["riferimento"]),
        modifiche
      };
    }
    case "consiglio":
      return { azione: "consiglio" };
    default:
      return { azione: "non_capito", messaggio };
  }
}
function trovaSpese(transazioni, rif, oggi, ordinateDaInserimento) {
  const parola = rif.testo ? radice(rif.testo) : "";
  const intervallo = rif.periodo ? intervalloDi(rif.periodo, oggi) : null;
  const trovate = transazioni.filter(
    (t) => (!parola || contieneTesto(t.nota, parola)) && (rif.importo === null || Math.abs(t.importo - rif.importo) < 5e-3) && (!intervallo || t.data >= intervallo.da && t.data <= intervallo.a)
  );
  const perData = !(rif.ultima && ordinateDaInserimento && !parola && !intervallo);
  const ordinate = perData ? [...trovate].sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : 0) : trovate;
  return ordinate.slice(0, 5);
}
function applicaModifiche(t, m) {
  return {
    ...t,
    ...m.importo !== void 0 ? { importo: m.importo } : {},
    ...m.descrizione !== void 0 ? { nota: m.descrizione } : {},
    ...m.data !== void 0 ? { data: m.data } : {},
    ...m.categoria !== void 0 ? { categoria: m.categoria } : {}
  };
}
var MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre"
];
function dataParlata(iso, oggi) {
  if (iso === oggi) return "oggi";
  if (iso === spostaGiorni(oggi, -1)) return "ieri";
  if (iso === spostaGiorni(oggi, 1)) return "domani";
  const [a, m, g] = iso.split("-").map(Number);
  const anno = a !== Number(oggi.slice(0, 4)) ? ` ${a}` : "";
  const articolo = g === 1 || g === 8 || g === 11 ? "l'" : "il ";
  return `${articolo}${g} ${MESI[(m ?? 1) - 1] ?? ""}${anno}`;
}
function nomeCategoria(id, categorie) {
  return categorie.find((c) => c.id === id)?.nome ?? "";
}
function descriviSpesa(t, categorie, oggi) {
  const nome = t.nota?.trim() || nomeCategoria(t.categoria, categorie) || "spesa";
  const quando = dataParlata(t.data, oggi);
  const di = quando.startsWith("il ") ? `del ${quando.slice(3)}` : quando.startsWith("l'") ? `dell'${quando.slice(2)}` : `di ${quando}`;
  const cat = nomeCategoria(t.categoria, categorie);
  return `\u201C${nome}\u201D da ${eur(t.importo)} ${di}${cat ? `, in ${cat}` : ""}`;
}
function fraseAggiunta(t, categorie, oggi) {
  const nome = t.nota?.trim() || "Spesa";
  const cat = nomeCategoria(t.categoria, categorie);
  return `Aggiunta: ${nome}, ${eur(t.importo)}, ${dataParlata(t.data, oggi)}${cat ? `, in ${cat}` : ""}.`;
}
function fraseConfermaElimina(candidate, categorie, oggi) {
  const prima = candidate[0];
  if (!prima) return "Non ho trovato nessuna spesa cos\xEC.";
  const d = descriviSpesa(prima, categorie, oggi);
  return candidate.length > 1 ? `Ne ho trovate ${candidate.length}: la pi\xF9 recente \xE8 ${d}. Elimino questa?` : `Elimino ${d}?`;
}
function fraseConfermaModifica(t, m, categorie, oggi) {
  const cambi = [];
  if (m.importo !== void 0) cambi.push(`importo da ${eur(t.importo)} a ${eur(m.importo)}`);
  if (m.descrizione !== void 0) cambi.push(`descrizione in \u201C${m.descrizione}\u201D`);
  if (m.data !== void 0) cambi.push(`data a ${dataParlata(m.data, oggi)}`);
  if (m.categoria !== void 0)
    cambi.push(`categoria in ${nomeCategoria(m.categoria, categorie)}`);
  return `Modifico ${descriviSpesa(t, categorie, oggi)}: ${cambi.join(", ")}. Confermi?`;
}
function rispostaParlata(r) {
  const parti = [];
  if (r.valore) parti.push(`${r.valore}.`);
  parti.push(r.frase.replace(/ · /g, ", ") + ".");
  if (r.righe?.length) {
    parti.push(
      r.righe.slice(0, 4).map((x) => `${x.etichetta} ${x.valore}`).join(", ") + "."
    );
  }
  return parti.join(" ").replace(/\.\./g, ".");
}
function datiWidget(state, oggi) {
  const mk = monthKey(oggi);
  const speso = txRealizzate(
    state.transazioni.filter((t) => monthKey(t.data) === mk),
    oggi
  ).reduce((s, t) => s + t.importo, 0);
  const budget = state.categorie.reduce((s, c) => s + c.budget, 0);
  const previsto = sommaPreviste(previsteDelMese(state, mk, oggi));
  const r22 = (n) => Math.round(n * 100) / 100;
  return {
    mese: monthLabel(mk),
    speso: r22(speso),
    budget: r22(budget),
    restante: budget > 0 ? r22(budget - speso) : null,
    percentuale: budget > 0 ? Math.round(speso / budget * 100) : null,
    previsto: r22(previsto)
  };
}

// src/lib/riepilogo.ts
var MESI_MEDIA = 3;
var r2 = (n) => Math.round(n * 100) / 100;
function calcolaRiepilogo(state, mese, oggi) {
  const reali = state.transazioni.filter((t) => t.data <= oggi);
  const delMese = (m) => reali.filter((t) => monthKey(t.data) === m);
  const somma2 = (l) => l.reduce((a, t) => a + t.importo, 0);
  const precedenti = Array.from({ length: MESI_MEDIA }, (_, i) => shiftMonth(mese, -(i + 1)));
  const totaliPrecedenti = precedenti.map((m) => somma2(delMese(m))).filter((v) => v > 0);
  const tx = delMese(mese);
  const categorie = state.categorie.map((c) => {
    const speso = somma2(tx.filter((t) => t.categoria === c.id));
    const prec = precedenti.map((m) => somma2(delMese(m).filter((t) => t.categoria === c.id))).filter((v) => v > 0);
    return {
      id: c.id,
      nome: c.nome,
      speso: r2(speso),
      media: prec.length ? r2(prec.reduce((a, b) => a + b, 0) / prec.length) : null,
      budget: c.budget
    };
  }).filter((c) => c.speso > 0 || (c.media ?? 0) > 0).sort((a, b) => b.speso - a.speso);
  return {
    mese,
    etichetta: monthLabel(mese),
    totale: r2(somma2(tx)),
    numeroSpese: tx.length,
    budgetTotale: state.categorie.reduce((a, c) => a + c.budget, 0),
    mediaPrecedente: totaliPrecedenti.length ? r2(totaliPrecedenti.reduce((a, b) => a + b, 0) / totaliPrecedenti.length) : null,
    categorie
  };
}
function variazione(attuale, riferimento) {
  if (riferimento === null || riferimento <= 0) return null;
  return Math.round((attuale - riferimento) / riferimento * 100);
}
function datiPerAI(r, profilo) {
  return {
    mese: r.etichetta,
    totale: r.totale,
    budget_totale: r.budgetTotale || null,
    percentuale_budget: r.budgetTotale > 0 ? Math.round(r.totale / r.budgetTotale * 100) : null,
    media_mesi_precedenti: r.mediaPrecedente,
    variazione_su_media_percento: variazione(r.totale, r.mediaPrecedente),
    profilo: { persone: profilo.persone, abitazione: profilo.abitazione, auto: profilo.auto },
    categorie: r.categorie.map((c) => ({
      nome: c.nome,
      speso: c.speso,
      media_mesi_precedenti: c.media,
      variazione_percento: variazione(c.speso, c.media),
      budget: c.budget || null,
      oltre_budget: c.budget > 0 ? r2(Math.max(0, c.speso - c.budget)) : null
    }))
  };
}
function normalizzaConsigli(grezzi) {
  const lista = grezzi?.consigli;
  if (!Array.isArray(lista)) return [];
  return lista.map((c) => c && typeof c === "object" ? c : {}).filter((c) => typeof c.titolo === "string" && typeof c.testo === "string").map((c) => ({
    titolo: String(c.titolo).trim().slice(0, 80),
    testo: String(c.testo).trim().slice(0, 400)
  })).filter((c) => c.titolo && c.testo).slice(0, 3);
}

// src/lib/righeDb.ts
var num = (v) => Number(v ?? 0) || 0;
function toCategory(r) {
  return {
    id: r.id,
    nome: r.name ?? "Senza nome",
    icona: r.icon ?? "wallet",
    colore: r.color ?? "#8CE562",
    budget: num(r.budget)
  };
}
function toTransaction(r) {
  return {
    id: r.id,
    importo: num(r.amount),
    categoria: r.category_id ?? "",
    data: (r.date ?? "").slice(0, 10),
    nota: r.note ?? "",
    ricorrenteId: r.recurring_id ?? null
  };
}
function toRecurring(r) {
  const giorno = Math.min(28, Math.max(1, r.day ?? 1));
  return {
    id: r.id,
    nome: r.name ?? "Spesa",
    categoria: r.category_id ?? "",
    importo: num(r.amount),
    giorno,
    attiva: r.active ?? true,
    // Valori di ripiego pensati per le ricorrenze create prima delle cadenze
    // personalizzate: erano tutte "ogni mese al giorno indicato", quindi si
    // comportano esattamente come prima.
    cadenza: r.cadence === "settimane" ? "settimane" : "mesi",
    intervallo: Math.max(1, r.interval_count ?? 1),
    inizio: r.start_date ?? `${currentMonth()}-${String(giorno).padStart(2, "0")}`,
    fine: r.end_date ?? null,
    ...r.last_generated_date ? { ultimaData: r.last_generated_date } : {},
    ...r.last_generated_month ? { ultimaGenerazione: r.last_generated_month } : {}
  };
}
var transactionPayload = (t, userId) => ({
  id: t.id,
  user_id: userId,
  category_id: t.categoria || null,
  amount: t.importo,
  date: t.data,
  note: t.nota ?? "",
  recurring_id: t.ricorrenteId ?? null
});

// src/lib/types.ts
function emptyProfile() {
  return {
    nome: "",
    onboardingCompletato: false,
    budgetTotale: 0,
    abitazione: "affitto",
    auto: true,
    persone: 1,
    primoUtilizzo: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function initialState() {
  return {
    categorie: [],
    transazioni: [],
    ricorrenti: [],
    profilo: emptyProfile(),
    consigliIgnorati: []
  };
}

// supabase/functions/assistente-vocale/sorgente.ts
var GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
var GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
var MODELLO_CHE_RAGIONA = GROQ_MODEL.startsWith("openai/gpt-oss");
var SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
var SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
var MAX_TESTO = 300;
var DURATA_CONFERMA_MS = 3 * 60 * 1e3;
var admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}
function oggiInItalia() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
}
async function impronta(testo) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function utenteDaCodice(codice) {
  if (!/^ct_[A-Za-z0-9_-]{30,80}$/.test(codice)) return null;
  const hash = await impronta(codice);
  const { data } = await admin.from("codici_esterni").select("id, user_id").eq("hash", hash).maybeSingle();
  if (!data) return null;
  await admin.from("codici_esterni").update({ ultimo_uso: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", data.id);
  return data.user_id;
}
var chiaveFirma = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(`conferme:${SUPABASE_SERVICE_ROLE_KEY}`),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);
var b64 = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var daB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function firma(azione) {
  const corpo = new TextEncoder().encode(JSON.stringify(azione));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chiaveFirma, corpo));
  return `${b64(corpo)}.${b64(sig)}`;
}
async function leggiFirma(token, utente) {
  try {
    const [c, s] = token.split(".");
    if (!c || !s) return null;
    const corpo = daB64(c);
    const ok = await crypto.subtle.verify("HMAC", await chiaveFirma, daB64(s), corpo);
    if (!ok) return null;
    const azione = JSON.parse(new TextDecoder().decode(corpo));
    if (azione.utente !== utente || Date.now() > azione.scade) return null;
    return azione;
  } catch {
    return null;
  }
}
async function tutteLeRighe(tabella, utente) {
  const righe = [];
  for (let da = 0; ; da += 1e3) {
    const { data, error } = await admin.from(tabella).select("*").eq("user_id", utente).order("id", { ascending: true }).range(da, da + 999);
    if (error) throw error;
    righe.push(...data ?? []);
    if (!data || data.length < 1e3) return righe;
  }
}
async function caricaStato(utente) {
  const [cat, tx, rec, prof] = await Promise.all([
    tutteLeRighe("categories", utente),
    tutteLeRighe("transactions", utente),
    tutteLeRighe("recurring", utente),
    admin.from("profiles").select("*").eq("user_id", utente).maybeSingle()
  ]);
  const ordinateDaInserimento = tx.some((r) => typeof r.created_at === "string");
  tx.sort((a, b) => {
    const ca = a.created_at ?? "";
    const cb = b.created_at ?? "";
    if (ca !== cb) return ca < cb ? 1 : -1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  const base = initialState();
  const p = prof.data ?? null;
  return {
    ordinateDaInserimento,
    state: {
      ...base,
      categorie: cat.map(toCategory),
      transazioni: tx.map(toTransaction),
      ricorrenti: rec.map(toRecurring),
      profilo: {
        ...base.profilo,
        abitazione: p?.housing ?? "affitto",
        auto: (p?.has_car ?? "si") === "si",
        persone: p?.household_size ?? 1
      }
    }
  };
}
var ISTRUZIONI_COMANDO = `Sei l'assistente vocale di un'app italiana di spese personali.
Ricevi una frase detta a voce (con possibili errori di dettatura) e la trasformi in UN SOLO oggetto JSON, senza altro testo.
Non conosci le spese dell'utente: descrivi solo cosa fare.

{"azione": "aggiungi"|"domanda"|"elimina"|"modifica"|"consiglio"|"non_capito",
 "spesa": {...} | null, "domanda": {...} | null, "riferimento": {...} | null, "modifiche": {...} | null, "messaggio": string | null}

aggiungi \u2192 "spesa": {"importo": numero in euro (totale: "2 caff\xE8 da 1,20" = 2.4), "descrizione": 1-4 parole con iniziale maiuscola, "data": "AAAA-MM-GG" (oggi se non detta), "categoria": id | null}
domanda \u2192 "domanda": {"tipo": "totale"|"per_categoria"|"per_mese"|"media_mensile"|"piu_care"|"frequenti"|"confronto"|"ultima", "periodo": Periodo, "confronto": Periodo|null, "categorie": [id], "testo": parola da cercare nella descrizione | null, "limite": numero|null}
  totale = quanto ho speso (default); per_categoria = in cosa spendo di pi\xF9; per_mese = andamento; media_mensile; piu_care = spese pi\xF9 alte; frequenti; confronto = due periodi (se il secondo manca, il precedente); ultima = quando l'ultima volta.
  Senza periodo: "quanto ho speso" \u2192 mese_corrente, il resto \u2192 tutto.
elimina \u2192 "riferimento": {"ultima": true se dice "l'ultima spesa"/"quella appena messa", "testo": parola della descrizione | null, "importo": numero | null, "periodo": Periodo | null}
modifica \u2192 "riferimento" come sopra + "modifiche": {"importo"?: numero, "descrizione"?: string, "data"?: "AAAA-MM-GG", "categoria"?: id}. Metti solo i campi da cambiare. "la pizza di ieri era 20 euro" \u2192 riferimento {testo:"pizza", periodo: {"tipo":"intervallo","da":ieri,"a":ieri}}, modifiche {importo:20}.
consiglio \u2192 l'utente chiede consigli o come risparmiare.
non_capito \u2192 "messaggio": una frase breve in italiano che spiega cosa si pu\xF2 dire.

Periodo: {"tipo":"tutto"} | {"tipo":"mese_corrente"} | {"tipo":"mese_scorso"} | {"tipo":"anno_corrente"} | {"tipo":"anno_scorso"} | {"tipo":"ultimi_giorni","n":N} (oggi compreso) | {"tipo":"ultimi_mesi","n":N} | {"tipo":"mese","valore":"AAAA-MM"} | {"tipo":"anno","valore":"AAAA"} | {"tipo":"intervallo","da":"AAAA-MM-GG","a":"AAAA-MM-GG"}
Categorie: usa solo gli id dati, e solo se la frase nomina quella categoria o la spesa vi appartiene chiaramente. "testo": una parola minuscola al singolare, per cose che non sono categorie (benzina, esselunga, pizza).`;
var ISTRUZIONI_CATEGORIA = `Scegli la categoria di una spesa personale dalla sua descrizione. Rispondi con UN SOLO oggetto JSON: {"categoria": id | null}. Usa solo gli id dati; null se nessuna \xE8 adatta.`;
var ISTRUZIONI_CONSIGLIO = `Sei un consulente di finanza personale pratico e gentile. Ricevi i TOTALI di un mese per categoria (con media dei mesi precedenti e budget) e scrivi 2 consigli brevi da LEGGERE AD ALTA VOCE.
Rispondi con UN SOLO oggetto JSON: {"consigli": [{"titolo": string, "testo": string}]}
Usa solo i numeri forniti, senza calcoli nuovi. Testo: una frase, con un'azione concreta. Niente investimenti o prodotti finanziari. Dai del tu.`;
async function chiediGroq(sistema, utente, maxToken, temperatura = 0) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY mancante");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: temperatura,
      max_completion_tokens: maxToken + (MODELLO_CHE_RAGIONA ? 1500 : 0),
      ...MODELLO_CHE_RAGIONA ? { reasoning_effort: "low", include_reasoning: false } : {},
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: utente }
      ]
    }),
    signal: AbortSignal.timeout(2e4)
  });
  if (r.status === 429) throw new Error("quota");
  if (!r.ok) {
    console.error("Groq", r.status, (await r.text()).slice(0, 300));
    throw new Error(`groq ${r.status}`);
  }
  const d = await r.json();
  return JSON.parse(d?.choices?.[0]?.message?.content ?? "null");
}
var GIORNI2 = ["domenica", "luned\xEC", "marted\xEC", "mercoled\xEC", "gioved\xEC", "venerd\xEC", "sabato"];
var elencoCategorie = (s) => s.categorie.map((c) => `${c.id}=${c.nome}`).join(", ");
async function capisci(testo, s, oggi) {
  const ids = s.categorie.map((c) => c.id);
  if (!serveAI(testo)) {
    const letta = leggiSpesaLocale(pulisciComando(testo), oggi);
    if (letta) return { azione: "aggiungi", spesa: letta };
  }
  const giorno = GIORNI2[(/* @__PURE__ */ new Date(oggi + "T12:00:00Z")).getUTCDay()];
  const grezzo = await chiediGroq(
    ISTRUZIONI_COMANDO,
    `Oggi \xE8 ${oggi} (${giorno}). Categorie: ${elencoCategorie(s) || "nessuna"}.
Frase: ${testo}`,
    400
  );
  return normalizzaComando(grezzo, oggi, ids);
}
async function categoriaPer(descrizione, s) {
  const ids = s.categorie.map((c) => c.id);
  const daStorico = categoriaPerDescrizione(s.transazioni, descrizione, ids);
  if (daStorico) return daStorico;
  try {
    const r = await chiediGroq(
      ISTRUZIONI_CATEGORIA,
      `Categorie: ${elencoCategorie(s)}.
Descrizione: ${descrizione}`,
      40
    );
    if (typeof r?.categoria === "string" && ids.includes(r.categoria)) return r.categoria;
  } catch {
  }
  const altro = s.categorie.find((c) => c.nome.toLowerCase().startsWith("altr"));
  return altro?.id ?? s.categorie[0]?.id ?? "";
}
async function esegui(comando, { state, ordinateDaInserimento }, utente, oggi) {
  switch (comando.azione) {
    case "non_capito":
      return { messaggio: comando.messaggio };
    case "aggiungi": {
      const sp = comando.spesa;
      const categoria = sp.categoria ?? await categoriaPer(sp.descrizione, state);
      const t = {
        id: crypto.randomUUID(),
        importo: sp.importo,
        categoria,
        data: sp.data,
        nota: sp.descrizione,
        ricorrenteId: null
      };
      const { error } = await admin.from("transactions").insert(transactionPayload(t, utente));
      if (error) throw error;
      return { messaggio: fraseAggiunta(t, state.categorie, oggi) };
    }
    case "domanda":
      return {
        messaggio: rispostaParlata(
          rispondi(comando.interpretazione, state.transazioni, state.categorie, oggi)
        )
      };
    case "elimina":
    case "modifica": {
      const candidate = trovaSpese(
        state.transazioni,
        comando.riferimento,
        oggi,
        ordinateDaInserimento
      );
      const t = candidate[0];
      if (!t) return { messaggio: "Non ho trovato nessuna spesa cos\xEC." };
      const scade = Date.now() + DURATA_CONFERMA_MS;
      if (comando.azione === "elimina") {
        return {
          messaggio: fraseConfermaElimina(candidate, state.categorie, oggi),
          conferma: await firma({ tipo: "elimina", utente, id: t.id, scade })
        };
      }
      return {
        messaggio: fraseConfermaModifica(t, comando.modifiche, state.categorie, oggi),
        conferma: await firma({
          tipo: "modifica",
          utente,
          id: t.id,
          modifiche: comando.modifiche,
          scade
        })
      };
    }
    case "consiglio": {
      const mese = Number(oggi.slice(8, 10)) <= 10 ? shiftMonth(monthKey(oggi), -1) : monthKey(oggi);
      const r = calcolaRiepilogo(state, mese, oggi);
      if (r.numeroSpese === 0)
        return { messaggio: "Non ci sono ancora abbastanza spese per un consiglio." };
      const consigli = normalizzaConsigli(
        await chiediGroq(
          ISTRUZIONI_CONSIGLIO,
          `Totali del mese:
${JSON.stringify(datiPerAI(r, state.profilo))}`,
          300,
          0.4
        )
      );
      if (!consigli.length)
        return { messaggio: "Non sono riuscito a preparare un consiglio, riprova." };
      return { messaggio: consigli.map((c) => `${c.titolo}. ${c.testo}`).join(" ") };
    }
  }
}
async function confermaAzione(token, utente, s, oggi) {
  const azione = await leggiFirma(token, utente);
  if (!azione) return "La conferma \xE8 scaduta: ripeti il comando.";
  const t = s.transazioni.find((x) => x.id === azione.id);
  if (!t) return "Quella spesa non c'\xE8 pi\xF9.";
  if (azione.tipo === "elimina") {
    const { error: error2 } = await admin.from("transactions").delete().eq("id", t.id).eq("user_id", utente);
    if (error2) throw error2;
    return `Fatto: eliminata ${descriviSpesa(t, s.categorie, oggi)}.`;
  }
  const nuova = applicaModifiche(t, azione.modifiche);
  const { error } = await admin.from("transactions").update(transactionPayload(nuova, utente)).eq("id", t.id).eq("user_id", utente);
  if (error) throw error;
  return `Fatto: ora \xE8 ${descriviSpesa(nuova, s.categorie, oggi)}.`;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ messaggio: "Metodo non consentito" }, 405);
  let body;
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
      401
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
        messaggio: quota ? "Troppe richieste in poco tempo, riprova tra un minuto." : "Qualcosa non ha funzionato, riprova tra poco."
      },
      quota ? 429 : 500
    );
  }
});
