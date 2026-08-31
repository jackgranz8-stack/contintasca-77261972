import { useEffect } from "react";

let locks = 0;
let savedScrollY = 0;
let removeTouchBlock: (() => void) | null = null;

/**
 * Blocca lo scroll/interazione dello sfondo mentre un popup è aperto.
 * "position: fixed sul body" è l'unica tecnica che blocca lo scroll in modo
 * davvero affidabile su iOS Safari (overflow/touch-action da soli lasciano
 * ancora passare lo scroll in certi casi, specie se il tocco parte su un
 * elemento con un proprio comportamento di trascinamento). In più, un
 * blocco diretto su "touchmove" a livello di documento fa da rete di
 * sicurezza aggiuntiva.
 *
 * Il piccolo scatto visivo che questa tecnica può causare sugli elementi
 * fissi (es. la barra di navigazione) durante il grande cambio di layout
 * del body non si risolve evitando la tecnica, ma isolando quegli elementi
 * su un proprio livello grafico indipendente (vedi "will-change: transform"
 * su BottomNav, FAB e banner), così il browser non li ridisegna insieme al
 * resto della pagina.
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
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";
        body.style.touchAction = "";
        window.scrollTo(0, savedScrollY);
        removeTouchBlock?.();
        removeTouchBlock = null;
      }
    };
  }, [active]);
}
