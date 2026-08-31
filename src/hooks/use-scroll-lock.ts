import { useEffect } from "react";

let locks = 0;
let removeTouchBlock: (() => void) | null = null;

/**
 * Blocca lo scroll/interazione dello sfondo mentre un popup è aperto.
 * Deliberatamente NON usa "position: fixed sul body": su iOS, cambiare
 * dinamicamente la position del body provoca un piccolo scatto visivo su
 * tutti gli elementi con position:fixed (es. la barra di navigazione in
 * basso) nel momento in cui il blocco si toglie.
 *
 * overflow/touch-action da soli, però, non bastano sempre su iOS: se il
 * tocco parte su un elemento annidato con un proprio touch-action (es. una
 * riga con swipe), quello può prevalere e lasciar scorrere comunque lo
 * sfondo. Per questo il blocco vero avviene intercettando "touchmove" a
 * livello di documento: viene lasciato passare solo se il tocco è iniziato
 * dentro un elemento marcato esplicitamente con data-scroll-lock-allow
 * (il contenuto interno dei fogli, che deve poter scorrere per conto suo).
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevTouch = body.style.touchAction;
    locks += 1;
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    if (!removeTouchBlock) {
      const blockTouch = (e: TouchEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("[data-scroll-lock-allow]")) return;
        e.preventDefault();
      };
      document.addEventListener("touchmove", blockTouch, { passive: false });
      removeTouchBlock = () => document.removeEventListener("touchmove", blockTouch);
    }

    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        body.style.overflow = prevOverflow;
        body.style.touchAction = prevTouch;
        removeTouchBlock?.();
        removeTouchBlock = null;
      }
    };
  }, [active]);
}
