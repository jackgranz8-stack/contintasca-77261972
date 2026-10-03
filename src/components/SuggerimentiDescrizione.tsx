import { History } from "lucide-react";

/**
 * Tendina delle descrizioni già usate, sotto al campo di scrittura.
 *
 * Due accortezze che la rendono usabile davvero:
 *
 * 1. "onPointerDown" annulla l'evento. Senza, toccare un suggerimento toglie
 *    prima il fuoco al campo di testo: la tendina sparisce nello stesso
 *    istante in cui il dito scende e il tocco finisce nel vuoto.
 * 2. La parte già digitata resta in grigio e solo il completamento è in
 *    evidenza, come fa iOS: si legge a colpo d'occhio cosa si sta per
 *    aggiungere invece di rileggere ogni riga da capo.
 */
export function SuggerimentiDescrizione({
  voci,
  digitato,
  onScegli,
}: {
  voci: string[];
  digitato: string;
  onScegli: (testo: string) => void;
}) {
  if (voci.length === 0) return null;
  const lunghezza = digitato.trim().length;

  return (
    <div className="absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)]">
      <ul role="listbox" aria-label="Descrizioni già usate">
        {voci.map((v, i) => (
          <li key={v}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onScegli(v)}
              className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm active:bg-surface-2 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <History size={14} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground">{v.slice(0, lunghezza)}</span>
                <span className="font-medium">{v.slice(lunghezza)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
