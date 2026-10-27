import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { eur } from "@/lib/format";

/** Importi senza centesimi: in un confronto "78,36 €" è solo rumore. */
const tondo = (n: number) => eur(Math.round(n));
import { FONTE_ISTAT, type Analisi, type PuntoAnalisi } from "@/lib/analisi";

export type StatoCommento =
  | { fase: "attesa" }
  | { fase: "pronto"; sintesi: string; punti: PuntoAnalisi[] }
  | { fase: "errore"; errore: string };

const ABITAZIONE = {
  affitto: "in affitto",
  mutuo: "con mutuo",
  proprieta: "in casa di proprietà",
  famiglia: "in famiglia",
} as const;

/**
 * RISPOSTA "ANALISI" DI CHIEDI
 *
 * Prima i numeri, calcolati sul telefono (lib/analisi.ts), che si vedono
 * subito: mese in corso, confronto categoria per categoria con la media
 * italiana per una famiglia come quella dell'utente, piano per rientrare nel
 * budget. Sotto, i consigli scritti dall'AI a partire da quei numeri.
 */
export function AnalisiRisposta({
  analisi: a,
  commento,
  onRiprova,
}: {
  analisi: Analisi;
  commento: StatoCommento;
  onRiprova: () => void;
}) {
  const confrontabili = a.voci.filter((v) => v.riferimento !== null && v.tua > 0);
  const senzaConfronto = a.voci.filter((v) => v.riferimento === null && v.tua > 0);
  const max = Math.max(1, ...confrontabili.flatMap((v) => [v.tua, v.riferimento ?? 0]));
  const m = a.meseCorrente;

  return (
    <div className="space-y-5">
      {/* Mese in corso */}
      <section>
        <p className="text-3xl font-semibold tracking-tight">
          {m.restante !== null && m.restante >= 0 ? tondo(m.restante) : tondo(m.speso)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {m.restante === null
            ? `Speso a ${m.etichetta.toLowerCase()}. Imposta un budget per avere un piano.`
            : m.restante >= 0
              ? `Ti restano a ${m.etichetta.toLowerCase()} · circa ${tondo(m.alGiorno ?? 0)} al giorno per ${m.giorniRimasti} giorni`
              : `Speso a ${m.etichetta.toLowerCase()}: budget superato di ${tondo(-m.restante)}`}
        </p>
      </section>

      {/* Confronto con la media italiana */}
      {confrontabili.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Tu e la media italiana</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Famiglia di {a.persone} {a.persone === 1 ? "persona" : "persone"},{" "}
            {ABITAZIONE[a.abitazione]}
            {(a.abitazione === "affitto" || a.abitazione === "mutuo") && a.quotaCasa < 1
              ? ` (paghi il ${Math.round(a.quotaCasa * 100)}%)`
              : ""}
            , {a.area ?? "media nazionale"} · tue spese: {a.etichettaPeriodo}
          </p>
          {!a.area && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Indica la regione in Profilo → La tua situazione per un confronto più preciso.
            </p>
          )}
          <ul className="mt-3 space-y-3.5">
            {confrontabili.map((v) => {
              const pct = v.differenzaPct ?? 0;
              return (
                <li key={v.id}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{v.nome}</span>
                    <span
                      className={`shrink-0 text-[11px] font-medium ${
                        pct >= 10
                          ? "text-warn"
                          : pct <= -10
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {pct > 0 ? "+" : pct < 0 ? "−" : ""}
                      {Math.abs(pct)}%
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <Barra
                      valore={v.tua}
                      max={max}
                      colore={v.colore}
                      etichetta={`Tu ${tondo(v.tua)}`}
                    />
                    <Barra
                      valore={v.riferimento ?? 0}
                      max={max}
                      etichetta={`Italia ${tondo(v.riferimento ?? 0)}`}
                      tenue
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {senzaConfronto.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Senza confronto:{" "}
              {senzaConfronto.map((v) => `${v.nome} (${tondo(v.tua)} al mese)`).join(", ")}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            In tutto spendi {tondo(a.totaleTuo)} al mese; una famiglia come la tua in media{" "}
            {tondo(a.totaleRiferimento)}.
          </p>
        </section>
      )}

      {/* Entrate e risparmio (solo se il reddito è indicato nel profilo) */}
      {a.reddito !== null && a.risparmioMedio !== null && (
        <section>
          <h3 className="text-sm font-semibold">Entrate e risparmio</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {a.risparmioMedio >= 0
              ? `Con un reddito di ${tondo(a.reddito)} metti da parte in media ${tondo(a.risparmioMedio)} al mese: il ${a.tassoRisparmio}%.`
              : `In media spendi ${tondo(-a.risparmioMedio)} al mese più del tuo reddito di ${tondo(a.reddito)}.`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${a.risparmioMedio >= 0 ? "lime-fill" : "bg-warn"}`}
              style={{
                width: `${Math.min(100, Math.max(2, (a.totaleTuo / a.reddito) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Speso {Math.round((a.totaleTuo / a.reddito) * 100)}% del reddito
          </p>
        </section>
      )}

      {/* Piano per il budget */}
      {a.budgetTotale > 0 && a.scartoBudget !== null && (
        <section>
          <h3 className="text-sm font-semibold">Il tuo budget</h3>
          {a.piano.length > 0 ? (
            <>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                In media sfori il budget di {tondo(a.budgetTotale)} di {tondo(a.scartoBudget)} al
                mese. Per rientrare:
              </p>
              <ul className="mt-2 divide-y divide-border rounded-xl bg-surface-2 px-3">
                {a.piano.map((p) => (
                  <li key={p.id} className="flex items-baseline gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                    <span className="shrink-0 font-semibold">−{tondo(p.taglio)}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      tetto {tondo(p.nuovoTetto)}
                    </span>
                  </li>
                ))}
              </ul>
              {a.pianoInsufficiente && (
                <p className="mt-2 text-[11px] text-warn">
                  Tagliando solo le spese variabili non basta: serve rivedere i costi fissi o il
                  budget.
                </p>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              In media resti dentro il budget di {tondo(a.budgetTotale)}, con{" "}
              {tondo(-a.scartoBudget)} di margine al mese.
            </p>
          )}
        </section>
      )}

      {/* Consigli dell'AI */}
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={14} className="text-primary" />
          Consigli
        </h3>
        {commento.fase === "attesa" && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Sto ragionando sui tuoi numeri…
          </p>
        )}
        {commento.fase === "errore" && (
          <div className="mt-2">
            <p className="text-sm">{commento.errore}</p>
            <button
              type="button"
              onClick={onRiprova}
              className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <RotateCcw size={14} /> Riprova
            </button>
          </div>
        )}
        {commento.fase === "pronto" && (
          <>
            {commento.sintesi && <p className="mt-2 text-sm leading-relaxed">{commento.sintesi}</p>}
            <ul className="mt-2 space-y-2">
              {commento.punti.map((p, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-sm font-semibold">{p.titolo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{p.testo}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Media italiana: {FONTE_ISTAT}, adattata a persone, area geografica e abitazione; esclusi gli
        affitti figurativi. È un riferimento indicativo, non un obiettivo.
      </p>
    </div>
  );
}

function Barra({
  valore,
  max,
  colore,
  etichetta,
  tenue = false,
}: {
  valore: number;
  max: number;
  colore?: string;
  etichetta: string;
  tenue?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${tenue ? "bg-muted-foreground/40" : colore ? "" : "lime-fill"}`}
          style={{
            width: `${Math.max(2, (valore / max) * 100)}%`,
            ...(!tenue && colore ? { backgroundColor: colore } : null),
          }}
        />
      </div>
      <span
        className={`w-24 shrink-0 text-right text-[11px] ${tenue ? "text-muted-foreground" : "font-medium"}`}
      >
        {etichetta}
      </span>
    </div>
  );
}
