import { useEffect } from "react";

let locks = 0;
let removeTouchBlock: (() => void) | null = null;

/**
 * Blocca l'interazione con lo sfondo mentre un foglio (BottomSheet) è
 * aperto.
 *
 * Prima questa funzione doveva alternare "position: fixed" sul body per
 * bloccarne lo scroll in modo affidabile su iOS Safari. Era proprio quel
 * cambio di layout — unito al ricalcolo della barra degli indirizzi di
 * Safari quando il body tornava "normale" alla chiusura del foglio — a
 * causare lo scatto visibile sugli elementi fissi (barra di navigazione,
 * FAB).
 *
 * Ora html e body sono bloccati in modo permanente (vedi styles.css:
 * overflow: hidden su entrambi) e l'unico elemento che scorre in tutta
 * l'app è .app-scroll (dentro .app-frame, ma separato dagli elementi
 * "fixed" come barra di navigazione e FAB). Per bloccare lo sfondo basta
 * quindi congelare .app-scroll con "overflow: hidden", senza alcun
 * riposizionamento: nessuno scatto, perché nulla si sposta quando il
 * blocco si toglie. Il blocco diretto su "touchmove" a livello di
 * documento resta come rete di sicurezza aggiuntiva (utile anche per non
 * far scorrere lo sfondo se il tocco parte su un elemento con un proprio
 * comportamento di trascinamento).
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const scroller = document.querySelector<HTMLElement>(".app-scroll");

    if (locks === 0 && scroller) {
      scroller.style.overflow = "hidden";
      scroller.style.touchAction = "none";
    }
    locks += 1;

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
        if (scroller) {
          scroller.style.overflow = "";
          scroller.style.touchAction = "";
        }
        removeTouchBlock?.();
        removeTouchBlock = null;
      }
    };
  }, [active]);
}
