import { useEffect } from "react";

let locks = 0;
let savedScrollY = 0;

/**
 * Blocca lo scroll/interazione dello sfondo mentre un popup è aperto.
 * Non basta "overflow: hidden": su iOS Safari a volte lascia comunque un
 * piccolo scorrimento residuo. Qui la pagina viene fissata alla sua
 * posizione attuale (position: fixed) e poi ripristinata esattamente allo
 * stesso punto alla chiusura.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const body = document.body;
    if (locks === 0) {
      savedScrollY = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${savedScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    }
    locks += 1;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";
        body.style.touchAction = "";
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [active]);
}
