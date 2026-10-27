import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { eur, todayISO } from "@/lib/format";
import { chiamaAI } from "@/lib/ai";
import {
  calcolaRiepilogo,
  datiPerAI,
  normalizzaConsigli,
  variazione,
  type Consiglio,
} from "@/lib/riepilogo";
import { BottomSheet } from "./BottomSheet";

/**
 * RIEPILOGO DEL MESE CHIUSO, CON CONSIGLI DELL'AI
 *
 * Numeri e confronti li calcola il telefono (lib/riepilogo.ts) e si vedono
 * subito, senza rete. I consigli dell'AI invece si chiedono con un tocco,
 * mai da soli: è il momento in cui dei dati (solo i totali) escono dall'app,
 * e deve deciderlo l'utente, sapendolo.
 *
 * I consigli ricevuti restano salvati sul telefono per quel mese: riaprendo
 * il riepilogo non si richiedono. Se nel frattempo il totale del mese cambia
 * (una spesa inserita in ritardo) i consigli vecchi non valgono più e si
 * possono richiedere.
 */

const chiaveMemoria = (mese: string) => `consigli-ai:${mese}`;

function leggiConsigli(mese: string, totale: number): Consiglio[] | null {
  try {
    const v = localStorage.getItem(chiaveMemoria(mese));
    if (!v) return null;
    const salvato = JSON.parse(v) as { totale?: number; consigli?: unknown };
    if (salvato.totale !== totale) return null;
    const consigli = normalizzaConsigli(salvato);
    return consigli.length ? consigli : null;
  } catch {
    return null;
  }
}

function salvaConsigli(mese: string, totale: number, consigli: Consiglio[]) {
  try {
    localStorage.setItem(chiaveMemoria(mese), JSON.stringify({ totale, consigli }));
  } catch {
    // Memoria non disponibile: si potranno richiedere la prossima volta.
  }
}

type StatoConsigli =
  | { fase: "da_chiedere" }
  | { fase: "attesa" }
  | { fase: "pronti"; consigli: Consiglio[] }
  | { fase: "errore"; testo: string };

export function RiepilogoMese({ mese, onClose }: { mese: string | null; onClose: () => void }) {
  const { state } = useApp();
  // Si tiene l'ultimo mese aperto anche durante la chiusura, così il
  // contenuto non sparisce mentre la tendina scende.
  const [meseVisto, setMeseVisto] = useState(mese);
  useEffect(() => {
    if (mese) setMeseVisto(mese);
  }, [mese]);

  const riepilogo = useMemo(
    () => (meseVisto ? calcolaRiepilogo(state, meseVisto, todayISO()) : null),
    [state, meseVisto],
  );

  const [consigli, setConsigli] = useState<StatoConsigli>({ fase: "da_chiedere" });
  useEffect(() => {
    if (!mese || !riepilogo) return;
    const salvati = leggiConsigli(mese, riepilogo.totale);
    setConsigli(salvati ? { fase: "pronti", consigli: salvati } : { fase: "da_chiedere" });
  }, [mese, riepilogo]);

  const chiediConsigli = async () => {
    if (!riepilogo) return;
    setConsigli({ fase: "attesa" });
    const esito = await chiamaAI("riepilogo", { dati: datiPerAI(riepilogo, state.profilo) });
    if (!esito.ok) {
      setConsigli({ fase: "errore", testo: esito.errore });
      return;
    }
    const lista = normalizzaConsigli(esito.dati);
    if (lista.length === 0) {
      setConsigli({ fase: "errore", testo: "Nessun consiglio ricevuto, riprova tra poco." });
      return;
    }
    salvaConsigli(riepilogo.mese, riepilogo.totale, lista);
    setConsigli({ fase: "pronti", consigli: lista });
  };

  const r = riepilogo;
  const varTot = r ? variazione(r.totale, r.mediaPrecedente) : null;

  return (
    <BottomSheet open={mese !== null} onClose={onClose}>
      {r && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Riepilogo di {r.etichetta}</h2>
            <button
              onClick={onClose}
              className="rounded-full bg-surface-2 p-2 text-muted-foreground"
              aria-label="Chiudi"
            >
              <X size={18} />
            </button>
          </div>

          <section className="card-hero p-5">
            <p className="text-3xl font-semibold tracking-tight">{eur(r.totale)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.numeroSpese === 1 ? "1 spesa" : `${r.numeroSpese} spese`}
              {r.budgetTotale > 0 &&
                ` · ${Math.round((r.totale / r.budgetTotale) * 100)}% del budget di ${eur(r.budgetTotale)}`}
            </p>
            {varTot !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {varTot === 0
                  ? "In linea con la media dei mesi prima"
                  : `${varTot > 0 ? "+" : "−"}${Math.abs(varTot)}% rispetto alla media dei mesi prima`}
              </p>
            )}
          </section>

          {r.categorie.length > 0 && (
            <ul className="mt-3 divide-y divide-border rounded-2xl bg-surface px-4">
              {r.categorie.map((c) => {
                const v = variazione(c.speso, c.media);
                const oltre = c.budget > 0 && c.speso > c.budget;
                return (
                  <li key={c.id} className="flex items-baseline gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                    {v !== null && v !== 0 && (
                      <span
                        className={`shrink-0 text-[11px] ${
                          v >= 15 ? "text-warn" : "text-muted-foreground"
                        }`}
                      >
                        {v > 0 ? "+" : "−"}
                        {Math.abs(v)}%
                      </span>
                    )}
                    <span className={`shrink-0 font-semibold ${oltre ? "text-warn" : ""}`}>
                      {eur(c.speso)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Le percentuali confrontano con la media dei 3 mesi prima.
          </p>

          <section className="mt-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles size={14} className="text-primary" />
              Consigli
            </h3>

            {consigli.fase === "da_chiedere" && (
              <>
                <button
                  type="button"
                  onClick={() => void chiediConsigli()}
                  className="lime-fill w-full rounded-xl py-2.5 text-sm font-semibold"
                >
                  Chiedi consigli all'AI
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  All'AI arrivano solo i totali per categoria qui sopra, non le singole spese.
                </p>
              </>
            )}

            {consigli.fase === "attesa" && (
              <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <Loader2 size={15} className="animate-spin" />
                Sto leggendo il mese…
              </p>
            )}

            {consigli.fase === "errore" && (
              <div className="rounded-2xl bg-surface p-4">
                <p className="text-sm">{consigli.testo}</p>
                <button
                  type="button"
                  onClick={() => void chiediConsigli()}
                  className="mt-2 text-sm font-medium text-primary"
                >
                  Riprova
                </button>
              </div>
            )}

            {consigli.fase === "pronti" && (
              <ul className="space-y-2">
                {consigli.consigli.map((c, i) => (
                  <li key={i} className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-sm font-semibold">{c.titolo}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.testo}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </BottomSheet>
  );
}
