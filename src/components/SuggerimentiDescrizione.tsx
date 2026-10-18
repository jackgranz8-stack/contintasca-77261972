import { History } from "lucide-react";
import { posizioneCorrispondenza } from "@/lib/descrizioni";

/**
 * Tendina delle descrizioni già usate, sotto al campo di scrittura.
 *
 * TOCCARE UN SUGGERIMENTO SENZA PERDERLO
 * Il rischio è che il dito, scendendo sul suggerimento, tolga prima il fuoco
 * al campo: chi usa la tendina la chiude alla perdita del fuoco, la tendina
 * sparisce e il tocco finisce nel vuoto. È esattamente quello che succedeva
 * su iPhone.
 *
 * Si annullano quindi sia "pointerdown" sia "mousedown". Il primo basta in
 * Chrome; su iPhone no, perché Safari sposta il fuoco con gli eventi mouse
 * che simula DOPO il tocco, ed è il "mousedown" a dover essere fermato.
 * Come ulteriore garanzia, chi usa la tendina non la smonta nell'istante
 * della perdita del fuoco ma un attimo dopo (vedi CHIUSURA_RITARDATA_MS).
 *
 * La parte che corrisponde a quanto digitato è in grassetto: ora che si
 * cerca anche in mezzo alla descrizione ("esselunga" trova "Spesa
 * Esselunga"), si vede a colpo d'occhio PERCHÉ un suggerimento è comparso.
 */

/** Il testo con in grassetto la parte che corrisponde a quanto digitato. */
export function TestoEvidenziato({ testo, digitato }: { testo: string; digitato: string }) {
  const p = posizioneCorrispondenza(testo, digitato);
  if (!p) return <>{testo}</>;
  return (
    <>
      {testo.slice(0, p.inizio)}
      <span className="font-semibold">{testo.slice(p.inizio, p.fine)}</span>
      {testo.slice(p.fine)}
    </>
  );
}

/**
 * Quanto aspettare, dopo che il campo ha perso il fuoco, prima di chiudere
 * la tendina. Su iPhone fuoco perso e "click" arrivano a pochi millisecondi
 * l'uno dall'altro: questo margine basta perché il tocco trovi ancora il
 * suggerimento al suo posto, ed è troppo breve per essere percepito.
 */
export const CHIUSURA_RITARDATA_MS = 180;
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onScegli(v)}
              className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm active:bg-surface-2 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <History size={14} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">
                <TestoEvidenziato testo={v} digitato={digitato} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
