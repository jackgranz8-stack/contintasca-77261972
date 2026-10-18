import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { History, Search, X } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { descrizioniFrequenti, suggerimentiDescrizione } from "@/lib/descrizioni";
import type { Transaction } from "@/lib/types";
import { TestoEvidenziato } from "./SuggerimentiDescrizione";

/** Quante descrizioni proporre, sia a campo vuoto sia mentre si scrive. */
const SUGGERIMENTI_MAX = 8;

/** Sotto questa altezza coperta (in px) non è una tastiera: si ignora. */
const SOGLIA_TASTIERA = 80;

/**
 * RICERCA DELLO STORICO A TUTTO SCHERMO
 *
 * Toccando il campo di ricerca la pagina sparisce e resta solo la ricerca,
 * come su iOS: campo in alto, periodo subito sotto, e la lista delle
 * descrizioni già usate. Prima la tendina si apriva sopra grafico e lista,
 * che restavano visibili sotto e confondevano.
 *
 * - A campo vuoto propone le descrizioni più usate (a parità, le più
 *   recenti): spesso la spesa che si cerca è proprio una di quelle.
 * - Scrivendo, propone quelle che CONTENGONO il testo, con in grassetto la
 *   parte trovata. In cima c'è sempre "Cerca …" per cercare esattamente
 *   quanto scritto, anche se non è una descrizione intera.
 * - Le chip del periodo sono le stesse della pagina (stesso stato): quello
 *   che si sceglie qui resta scelto anche dopo.
 *
 * I suggerimenti vengono da TUTTE le spese, non solo dal periodo scelto:
 * altrimenti con il mese corrente selezionato (il predefinito) non si
 * troverebbe mai una spesa di mesi fa, che è proprio quando serve.
 *
 * "Annulla" chiude senza cambiare la ricerca che c'era prima di aprire.
 */
export function RicercaStorico({
  open,
  valoreIniziale,
  transazioni,
  chipPeriodo,
  onApplica,
  onAnnulla,
}: {
  open: boolean;
  valoreIniziale: string;
  transazioni: Transaction[];
  /** Le chip del periodo, disegnate dalla pagina che ne possiede lo stato. */
  chipPeriodo: ReactNode;
  onApplica: (testo: string) => void;
  onAnnulla: () => void;
}) {
  const [testo, setTesto] = useState(valoreIniziale);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // A ogni apertura si riparte dalla ricerca in corso sulla pagina.
  useEffect(() => {
    if (open) setTesto(valoreIniziale);
  }, [open, valoreIniziale]);

  /*
   * Fuoco al campo appena la schermata esiste. Su iPhone la tastiera si apre
   * solo dentro il gesto del dito: è già aperta perché il tocco è arrivato
   * sul campo della pagina, e passare il fuoco da un campo all'altro a
   * tastiera aperta la lascia su. Per questo si usa useLayoutEffect, che
   * gira subito, prima che il browser ridisegni.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const fine = el.value.length;
    el.setSelectionRange(fine, fine);
  }, [open]);

  useScrollLock(open);

  // Spazio in fondo pari alla tastiera: su iPhone la tastiera copre la
  // pagina senza accorciarla, e gli ultimi suggerimenti finirebbero sotto.
  const [tastiera, setTastiera] = useState(0);
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const aggiorna = () => {
      const coperto = window.innerHeight - vv.height - vv.offsetTop;
      setTastiera(coperto > SOGLIA_TASTIERA ? Math.round(coperto) : 0);
    };
    aggiorna();
    vv.addEventListener("resize", aggiorna);
    vv.addEventListener("scroll", aggiorna);
    return () => {
      vv.removeEventListener("resize", aggiorna);
      vv.removeEventListener("scroll", aggiorna);
      setTastiera(0);
    };
  }, [open]);

  // Esc su computer: come "Annulla".
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnnulla();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onAnnulla]);

  const digitato = testo.trim();
  const voci = useMemo(
    () =>
      digitato
        ? suggerimentiDescrizione(transazioni, digitato, SUGGERIMENTI_MAX)
        : descrizioniFrequenti(transazioni, SUGGERIMENTI_MAX),
    [transazioni, digitato],
  );

  if (!open) return null;

  const applica = (valore: string) => {
    inputRef.current?.blur();
    onApplica(valore.trim());
  };

  const riga = (i: number) =>
    `flex w-full items-center gap-3 px-4 py-3 text-left text-sm active:bg-surface-2 ${
      i > 0 ? "border-t border-border" : ""
    }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cerca nello storico"
      className="fixed inset-x-0 top-0 z-50 flex h-[100dvh] justify-center bg-background animate-in fade-in-0 duration-150 motion-reduce:animate-none"
    >
      <div className="safe-x flex h-full w-full max-w-[430px] flex-col pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-primary bg-surface px-4 py-3 ring-2 ring-primary">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applica(testo);
              }}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Cerca nella descrizione"
              aria-label="Cerca nella descrizione"
              className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            {testo && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTesto("");
                  inputRef.current?.focus();
                }}
                aria-label="Cancella testo"
                className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onAnnulla}
            className="shrink-0 text-sm font-medium text-primary"
          >
            Annulla
          </button>
        </div>

        <div data-scroll-lock-allow className="mt-3">
          {chipPeriodo}
        </div>

        <div
          data-scroll-lock-allow
          className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: Math.max(tastiera, 0) + 24 }}
        >
          {(digitato || voci.length > 0) && (
            <p className="px-1 pb-2 text-xs text-muted-foreground">
              {digitato ? "Suggerimenti" : "Più usate e recenti"}
            </p>
          )}
          {(digitato || voci.length > 0) && (
            <ul
              role="listbox"
              aria-label="Descrizioni già usate"
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              {digitato && (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applica(testo)}
                    className={riga(0)}
                  >
                    <Search size={14} className="shrink-0 text-primary" />
                    <span className="min-w-0 truncate">
                      Cerca <span className="font-semibold">“{digitato}”</span>
                    </span>
                  </button>
                </li>
              )}
              {voci.map((v, i) => (
                <li key={v}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applica(v)}
                    className={riga(digitato ? i + 1 : i)}
                  >
                    <History size={14} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      <TestoEvidenziato testo={v} digitato={digitato} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!digitato && voci.length === 0 && (
            <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
              Le descrizioni che usi compariranno qui.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
