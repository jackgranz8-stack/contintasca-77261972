import { useEffect } from "react";

let locks = 0;
let removeTouchBlock: (() => void) | null = null;
let previous: { htmlOverflow: string; bodyOverflow: string } | null = null;

/**
 * Blocca lo scorrimento dello sfondo mentre una tendina (BottomSheet) è
 * aperta.
 *
 * PERCHÉ NON SI USA PIÙ "position: fixed" SUL BODY
 * Il metodo classico per bloccare lo sfondo è mettere il body in
 * "position: fixed" con uno scostamento pari alla posizione di scorrimento,
 * e rimetterlo a posto alla chiusura. Funziona, ma ha un difetto grosso: nel
 * momento in cui il body diventa (e smette di essere) "fisso", l'intera
 * pagina viene ricostruita e la posizione di scorrimento va salvata e
 * ripristinata a mano. Su iPhone questo produce lo scatto visibile della
 * barra di navigazione all'apertura e alla chiusura della tendina, ed è
 * anche il momento in cui la barra di Safari può decidere di riaprirsi,
 * spostando il punto in cui la tendina "atterra".
 *
 * COSA SI FA INVECE
 * Niente viene spostato: si dichiara solo che pagina e corpo non scorrono
 * più ("overflow: hidden"), lasciando tutto esattamente dov'è. La posizione
 * di scorrimento non va salvata né ripristinata, perché non viene mai persa.
 * Risultato: la barra di navigazione resta ferma al suo posto e la tendina
 * sale sempre dallo stesso punto, il bordo inferiore visibile dello schermo.
 *
 * Su iPhone "overflow: hidden" da solo non basta a fermare il trascinamento
 * col dito: a quello pensa il blocco diretto di "touchmove" qui sotto. Gli
 * elementi marcati con [data-scroll-lock-allow] (il contenuto della tendina)
 * restano scorribili normalmente.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    if (locks === 0) {
      previous = { htmlOverflow: html.style.overflow, bodyOverflow: body.style.overflow };
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
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
        html.style.overflow = previous?.htmlOverflow ?? "";
        body.style.overflow = previous?.bodyOverflow ?? "";
        previous = null;
        removeTouchBlock?.();
        removeTouchBlock = null;
      }
    };
  }, [active]);
}
