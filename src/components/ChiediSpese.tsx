import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, RotateCcw, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { todayISO } from "@/lib/format";
import { categoriePerAI, chiamaAI } from "@/lib/ai";
import { normalizzaInterpretazione, rispondi, type Risposta } from "@/lib/domande";
import { BottomSheet } from "./BottomSheet";
import { GraficoRisposta } from "./GraficoRisposta";
import { AnalisiRisposta, type StatoCommento } from "./AnalisiRisposta";
import { calcolaAnalisi, datiAnalisiPerAI, normalizzaCommento, type Analisi } from "@/lib/analisi";

/** Domande pronte: mostrano cosa si può chiedere e si toccano per provarle. */
const ESEMPI = [
  "Dove spendo più della media italiana?",
  "Su cosa risparmio per restare nel budget?",
  "Quanto ho speso questo mese?",
  "In cosa spendo di più?",
  "Grafico delle spese mese per mese",
  "Rispetto al mese scorso?",
  "Le 5 spese più care dell'anno",
  "Quanto spendo al mese per la macchina?",
];

const MAX_DOMANDA = 200;
/** Quante domande tenere in cronologia mentre la schermata è aperta. */
const MAX_CRONOLOGIA = 20;

type Voce =
  | { id: number; domanda: string; fase: "attesa" }
  | { id: number; domanda: string; fase: "risposta"; risposta: Risposta }
  | { id: number; domanda: string; fase: "analisi"; analisi: Analisi; commento: StatoCommento }
  | { id: number; domanda: string; fase: "errore"; errore: string };

/**
 * DOMANDE LIBERE SULLE SPESE, A TUTTO SCHERMO
 *
 * Si apre a tutto schermo perché le risposte possono essere grafici e
 * classifiche ("grafico delle spese mese per mese", "in cosa spendo di
 * più?"), che nella tendina bassa si vedevano male.
 *
 * Le domande fatte restano una sotto l'altra finché la schermata è aperta,
 * la più recente in alto: si possono confrontare due risposte senza
 * richiederle. Chiudendo si riparte puliti.
 *
 * La domanda va all'AI solo per essere CAPITA; il calcolo lo fa il telefono
 * sulle spese vere (lib/domande.ts): i numeri sono esatti e le spese non
 * escono mai dall'app.
 */
export function ChiediSpese({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useApp();
  const [domanda, setDomanda] = useState("");
  const [voci, setVoci] = useState<Voce[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const prossimoId = useRef(1);

  // Ogni apertura riparte pulita.
  useEffect(() => {
    if (!open) return;
    setDomanda("");
    setVoci([]);
  }, [open]);

  const aggiorna = (id: number, voce: Voce) =>
    setVoci((v) => v.map((x) => (x.id === id ? voce : x)));

  /*
   * ANALISI: i numeri si calcolano qui e si mostrano subito; poi si chiede
   * all'AI di commentarli (solo totali e confronti, mai le singole spese).
   */
  const commenta = async (id: number, domanda: string, analisi: Analisi) => {
    aggiorna(id, { id, domanda, fase: "analisi", analisi, commento: { fase: "attesa" } });
    const esito = await chiamaAI("analisi", { dati: datiAnalisiPerAI(analisi) });
    const commento: StatoCommento = !esito.ok
      ? { fase: "errore", errore: esito.errore }
      : (() => {
          const c = normalizzaCommento(esito.dati);
          return c.punti.length || c.sintesi
            ? { fase: "pronto" as const, ...c }
            : { fase: "errore" as const, errore: "Nessun consiglio ricevuto, riprova." };
        })();
    aggiorna(id, { id, domanda, fase: "analisi", analisi, commento });
  };

  const chiedi = async (testo: string) => {
    const q = testo.trim().slice(0, MAX_DOMANDA);
    if (!q) return;
    const id = prossimoId.current++;
    setVoci((v) => [{ id, domanda: q, fase: "attesa" as const }, ...v].slice(0, MAX_CRONOLOGIA));
    setDomanda("");
    inputRef.current?.blur();
    listaRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    const oggi = todayISO();
    const esito = await chiamaAI("domanda", {
      domanda: q,
      oggi,
      categorie: categoriePerAI(state.categorie),
    });
    if (!esito.ok) {
      aggiorna(id, { id, domanda: q, fase: "errore", errore: esito.errore });
      return;
    }
    const interpretazione = normalizzaInterpretazione(
      esito.dati,
      state.categorie.map((c) => c.id),
    );
    if (interpretazione.tipo === "analisi") {
      await commenta(id, q, calcolaAnalisi(state, oggi));
      return;
    }
    aggiorna(id, {
      id,
      domanda: q,
      fase: "risposta",
      risposta: rispondi(interpretazione, state.transazioni, state.categorie, oggi),
    });
  };

  const inAttesa = voci.some((v) => v.fase === "attesa");

  return (
    <BottomSheet open={open} onClose={onClose} fullScreen>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Chiedi alle tue spese</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-surface-2 p-2 text-muted-foreground"
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void chiedi(domanda);
        }}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-surface py-1.5 pr-1.5 pl-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
      >
        <input
          ref={inputRef}
          value={domanda}
          onChange={(e) => setDomanda(e.target.value.slice(0, MAX_DOMANDA))}
          onFocus={() => {
            // Come in "A parole": iPhone non deve spostare in su la schermata.
            requestAnimationFrame(() => {
              if (window.scrollY !== 0) window.scrollTo(0, 0);
            });
          }}
          enterKeyHint="send"
          placeholder="Fai una domanda sulle spese"
          aria-label="La tua domanda"
          className="w-full min-w-0 bg-transparent py-1.5 text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!domanda.trim() || inAttesa}
          aria-label="Chiedi"
          className="lime-fill flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
        >
          {inAttesa ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} />}
        </button>
      </form>

      {/* Fascia che scorre: esempi, poi le risposte dalla più recente. */}
      <div
        ref={listaRef}
        data-scroll-lock-allow
        className="no-scrollbar -mx-4 mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
      >
        {voci.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {ESEMPI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => void chiedi(e)}
                className="rounded-full border border-border px-3.5 py-2 text-xs text-muted-foreground active:bg-surface-2"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {voci.map((v, i) => (
            <article
              key={v.id}
              aria-live={i === 0 ? "polite" : undefined}
              className={
                i === 0 ? "card-hero p-5" : "rounded-2xl border border-border bg-surface p-5"
              }
            >
              <p className="mb-2 text-xs text-muted-foreground">{v.domanda}</p>

              {v.fase === "attesa" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={15} className="animate-spin" />
                  Sto leggendo la domanda…
                </p>
              )}

              {v.fase === "errore" && (
                <>
                  <p className="text-sm">{v.errore}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setVoci((x) => x.filter((y) => y.id !== v.id));
                      void chiedi(v.domanda);
                    }}
                    className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary"
                  >
                    <RotateCcw size={14} /> Riprova
                  </button>
                </>
              )}

              {v.fase === "analisi" && (
                <AnalisiRisposta
                  analisi={v.analisi}
                  commento={v.commento}
                  onRiprova={() => void commenta(v.id, v.domanda, v.analisi)}
                />
              )}

              {v.fase === "risposta" && (
                <>
                  {v.risposta.valore && (
                    <p className="text-3xl font-semibold tracking-tight">{v.risposta.valore}</p>
                  )}
                  <p
                    className={
                      v.risposta.valore
                        ? "mt-1 text-xs text-muted-foreground"
                        : "text-sm font-medium"
                    }
                  >
                    {v.risposta.frase}
                  </p>
                  <GraficoRisposta risposta={v.risposta} />
                </>
              )}
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          All'AI arrivano solo la domanda e, per le analisi, i totali per categoria: mai le singole
          spese.
        </p>
      </div>
    </BottomSheet>
  );
}
