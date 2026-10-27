import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, KeyRound, Mic, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  creaCodice,
  elencoCodici,
  revocaCodice,
  URL_ASSISTENTE_VOCALE,
  type CodiceEsterno,
} from "@/lib/codiciEsterni";
import { ConfirmPopup } from "./ConfirmPopup";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

async function copia(testo: string, cosa: string) {
  try {
    await navigator.clipboard.writeText(testo);
    toast.success(`${cosa} copiato`);
  } catch {
    toast.error("Copia non riuscita: tieni premuto il testo e copialo a mano");
  }
}

/**
 * PROFILO → SIRI E WIDGET
 *
 * Qui si crea il codice personale da incollare nel Comando Rapido (Siri) e
 * nello script del widget (Scriptable), e si revocano i codici non più usati
 * (telefono cambiato, codice finito nel posto sbagliato).
 *
 * Il codice appena creato resta visibile finché non si chiude la sezione:
 * dopo non lo si può più rivedere, perché l'app stessa non lo conserva.
 */
export function SiriWidget() {
  const { account } = useApp();
  const [aperto, setAperto] = useState(false);
  const [codici, setCodici] = useState<CodiceEsterno[] | null>(null);
  const [errore, setErrore] = useState(false);
  const [nuovo, setNuovo] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [daRevocare, setDaRevocare] = useState<CodiceEsterno | null>(null);

  const ricarica = async () => {
    try {
      setCodici(await elencoCodici());
      setErrore(false);
    } catch {
      setErrore(true);
    }
  };

  useEffect(() => {
    if (aperto) void ricarica();
    else setNuovo(null);
  }, [aperto]);

  const crea = async () => {
    if (!account || inCorso) return;
    setInCorso(true);
    try {
      setNuovo(await creaCodice(account.id, "iPhone"));
      await ricarica();
    } catch {
      toast.error("Codice non creato. Hai eseguito l'istruzione SQL su Supabase?");
    } finally {
      setInCorso(false);
    }
  };

  return (
    <section className="card-surface overflow-hidden p-0">
      <button
        onClick={() => setAperto((v) => !v)}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
          <Mic size={17} />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">Siri e widget</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
            aperto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aperto && (
        <div className="space-y-3 px-5 pb-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Con un codice personale puoi aggiungere, modificare ed eliminare spese e fare domande a
            Siri, e vedere il mese in un widget. Trattalo come una password.
          </p>

          {nuovo ? (
            <div className="space-y-2 rounded-2xl border border-primary bg-surface p-4">
              <p className="text-xs font-semibold">Il tuo codice: copialo ora, non lo rivedrai</p>
              <p className="rounded-xl bg-surface-2 p-3 font-mono text-xs break-all select-all">
                {nuovo}
              </p>
              <button
                onClick={() => void copia(nuovo, "Codice")}
                className="lime-fill flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
              >
                <Copy size={15} /> Copia codice
              </button>
              <p className="pt-1 text-[11px] text-muted-foreground">Indirizzo da usare:</p>
              <p className="rounded-xl bg-surface-2 p-3 font-mono text-[11px] break-all select-all">
                {URL_ASSISTENTE_VOCALE}
              </p>
              <button
                onClick={() => void copia(URL_ASSISTENTE_VOCALE, "Indirizzo")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-2.5 text-sm"
              >
                <Copy size={15} /> Copia indirizzo
              </button>
            </div>
          ) : (
            <button
              onClick={() => void crea()}
              disabled={inCorso}
              className="lime-fill flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              <KeyRound size={15} /> Crea un codice
            </button>
          )}

          {errore && (
            <p className="text-xs text-warn">
              Elenco non disponibile. Se non l'hai ancora fatto, esegui l'istruzione SQL su Supabase
              (vedi istruzioni).
            </p>
          )}

          {codici && codici.length > 0 && (
            <ul className="divide-y divide-border rounded-2xl bg-surface px-4">
              {codici.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Creato {quando(c.creato)} ·{" "}
                      {c.ultimo_uso ? `usato ${quando(c.ultimo_uso)}` : "mai usato"}
                    </p>
                  </div>
                  <button
                    onClick={() => setDaRevocare(c)}
                    aria-label={`Revoca ${c.nome}`}
                    className="rounded-full bg-surface-2 p-2 text-muted-foreground"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmPopup
        open={daRevocare !== null}
        onClose={() => setDaRevocare(null)}
        title="Revocare questo codice?"
        description="Siri e il widget che lo usano smetteranno subito di funzionare. Potrai crearne uno nuovo."
        confirmLabel="Revoca"
        onConfirm={() => {
          const c = daRevocare;
          setDaRevocare(null);
          if (!c) return;
          void revocaCodice(c.id)
            .then(() => {
              toast.success("Codice revocato");
              return ricarica();
            })
            .catch(() => toast.error("Revoca non riuscita, riprova"));
        }}
      />
    </section>
  );
}
