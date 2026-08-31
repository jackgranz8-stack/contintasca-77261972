import { useEffect } from "react";

let locks = 0;

/**
 * Blocca lo scroll/interazione dello sfondo mentre un popup è aperto.
 * Deliberatamente NON usa la tecnica "position: fixed sul body": su iOS,
 * cambiare dinamicamente la position del body provoca un piccolo scatto
 * visivo su tutti gli elementi con position:fixed (es. la barra di
 * navigazione in basso) nel momento in cui il blocco si toglie. overflow +
 * touch-action bastano per bloccare lo scroll di sfondo senza toccare la
 * posizione della pagina, quindi senza nessuno scatto collaterale.
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
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        body.style.overflow = prevOverflow;
        body.style.touchAction = prevTouch;
      }
    };
  }, [active]);
}
