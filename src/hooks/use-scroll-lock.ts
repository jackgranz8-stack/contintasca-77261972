import { useEffect } from "react";

let locks = 0;
let removeTouchBlock: (() => void) | null = null;
let lockedScrollY = 0;

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
 * Su mobile la pagina resta legata al viewport reale di Safari. Quando si
 * apre un foglio congeliamo temporaneamente il body nella posizione corrente
 * e la ripristiniamo alla chiusura, evitando sia lo scroll dello sfondo sia
 * alterazioni permanenti all'altezza della pagina.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    if (locks === 0) {
      lockedScrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
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
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, lockedScrollY);
        removeTouchBlock?.();
        removeTouchBlock = null;
      }
    };
  }, [active]);
}
