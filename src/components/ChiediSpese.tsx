import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { todayISO } from "@/lib/format";
import { categoriePerAI, chiamaAI } from "@/lib/ai";
import { normalizzaInterpretazione, rispondi, type Risposta } from "@/lib/domande";
import { BottomSheet } from "./BottomSheet";

/** Domande pronte: mostrano cosa si può chiedere e si toccano per provarle. */
const ESEMPI = [
  "Quanto ho speso questo mese?",
  "In cosa spendo di più?",
  "Rispetto al mese scorso?",
  "Le 3 spese più care dell'anno",
];

const MAX_DOMANDA = 200;

type Stato =
  | { fase: "vuoto" }
  | { fase: "attesa"; domanda: string }
  | { fase: "risposta"; domanda: string; risposta: Risposta }
  | { fase: "errore"; domanda: string; errore: string };

/**
 * DOMANDE LIBERE SULLE SPESE
 *
 * La domanda va all'AI solo per essere CAPITA; il calcolo lo fa il telefono
 * sulle spese vere (lib/domande.ts). Per questo i numeri sono esatti e le
 * spese non escono mai dall'app: lo si dice anche in fondo alla tendina,
 * perché è la prima cosa che ci si chiede davanti a un'AI in un'app di soldi.
 */
export function ChiediSpese({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useApp();
  const [domanda, setDomanda] = useState("");
  const [stato, setStato] = useState<Stato>({ fase: "vuoto" });
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Solo l'ultima domanda conta: una risposta lenta a una domanda vecchia
  // non deve sovrascrivere quella nuova.
  const ultimaRichiesta = useRef(0);

  // Ogni apertura riparte pulita.
  useEffect(() => {
    if (!open) return;
    setDomanda("");
    setStato({ fase: "vuoto" });
  }, [open]);

  const chiedi = async (testo: string) => {
    const q = testo.trim().slice(0, MAX_DOMANDA);
    if (!q) return;
    const id = ++ultimaRichiesta.current;
    setDomanda(q);
    setStato({ fase: "attesa", domanda: q });
    inputRef.current?.blur();

    const oggi = todayISO();
    const esito = await chiamaAI("domanda", {
      domanda: q,
      oggi,
      categorie: categoriePerAI(state.categorie),
    });
    if (id !== ultimaRichiesta.current) return;
    if (!esito.ok) {
      setStato({ fase: "errore", domanda: q, errore: esito.errore });
      return;
    }
    const interpretazione = normalizzaInterpretazione(
      esito.dati,
      state.categorie.map((c) => c.id),
    );
    setStato({
      fase: "risposta",
      domanda: q,
      risposta: rispondi(interpretazione, state.transazioni, state.categorie, oggi),
    });
  };

  const inAttesa = stato.fase === "attesa";

  return (
    <BottomSheet open={open} onClose={onClose}>
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
        className="flex items-center gap-2 rounded-2xl border border-border bg-surface py-1.5 pr-1.5 pl-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary"
      >
        <input
          ref={inputRef}
          value={domanda}
          onChange={(e) => setDomanda(e.target.value.slice(0, MAX_DOMANDA))}
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

      <div className="mt-4 min-h-[120px]">
        {stato.fase === "vuoto" && (
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

        {stato.fase === "attesa" && (
          <p className="px-1 pt-2 text-sm text-muted-foreground">Sto leggendo la domanda…</p>
        )}

        {stato.fase === "errore" && (
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm">{stato.errore}</p>
            <button
              type="button"
              onClick={() => void chiedi(stato.domanda)}
              className="mt-2 text-sm font-medium text-primary"
            >
              Riprova
            </button>
          </div>
        )}

        {stato.fase === "risposta" && (
          <div className="card-hero p-5" aria-live="polite">
            {stato.risposta.valore && (
              <p className="text-3xl font-semibold tracking-tight">{stato.risposta.valore}</p>
            )}
            <p
              className={
                stato.risposta.valore ? "mt-1 text-xs text-muted-foreground" : "text-sm font-medium"
              }
            >
              {stato.risposta.frase}
            </p>
            {stato.risposta.righe && stato.risposta.righe.length > 0 && (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {stato.risposta.righe.map((r, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{r.etichetta}</span>
                    {r.nota && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{r.nota}</span>
                    )}
                    <span className="shrink-0 font-semibold">{r.valore}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        All'AI arriva solo la domanda: le tue spese restano sul telefono.
      </p>
    </BottomSheet>
  );
}
