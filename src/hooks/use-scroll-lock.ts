import { useEffect } from "react";

let locks = 0;
let removeTouchBlock: (() => void) | null = null;
let previous: {
  htmlOverflow: string;
  bodyOverflow: string;
  htmlOverscroll: string;
} | null = null;

/**
 * Blocca lo scorrimento dello sfondo mentre una tendina (BottomSheet) è
 * aperta.
 *
 * PERCHÉ NON SI USA "position: fixed" SUL BODY
 * Il metodo classico è mettere il body in "position: fixed" e ripristinare
 * la posizione alla chiusura. Su iPhone produce lo scatto visibile della
 * barra di navigazione all'apertura e alla chiusura, ed è il momento in cui
 * la barra di Safari può riaprirsi spostando il punto in cui la tendina
 * "atterra". Qui invece non si sposta niente: si dichiara solo che pagina e
 * corpo non scorrono più ("overflow: hidden").
 *
 * PERCHÉ NON BASTA "overflow: hidden"
 * Su iPhone non ferma il dito: la pagina scorre lo stesso. A fermarlo è il
 * blocco di "touchmove" qui sotto.
 *
 * COME DECIDE IL BLOCCO (la parte che prima sbagliava)
 * Prima bastava che il dito fosse dentro una zona marcata
 * [data-scroll-lock-allow] perché il gesto passasse. Ma una zona marcata
 * non è detto che abbia davvero qualcosa da scorrere: la tendina della
 * nuova spesa a tutto schermo, quando il contenuto ci sta tutto, non scorre
 * di un pixel. In quel caso iPhone, trovando il gesto libero, lo passava
 * alla pagina SOTTO, che si vedeva muoversi.
 *
 * Ora il gesto passa solo se, risalendo dal punto toccato fino alla zona
 * marcata, si trova un elemento che può scorrere ADESSO in quella
 * direzione. Questo copre anche i bordi: una lista già in cima, tirata
 * ancora verso il basso, non ha più dove andare e il gesto viene fermato,
 * invece di "scavalcarla" e muovere la pagina dietro.
 *
 * Gli elementi marcati [data-scroll-lock-gesture] (la maniglia della
 * tendina) passano sempre: non scorrono nulla, ma il loro trascinamento
 * serve a chiudere la tendina e non va toccato.
 */

function scorribile(el: HTMLElement, asse: "x" | "y", delta: number): boolean {
  const stile = getComputedStyle(el);
  const overflow = asse === "y" ? stile.overflowY : stile.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;

  if (asse === "y") {
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    // Dito verso il basso: il contenuto va verso l'alto, serve spazio sopra.
    if (delta > 0) return el.scrollTop > 0;
    return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }

  if (el.scrollWidth <= el.clientWidth + 1) return false;
  if (delta > 0) return el.scrollLeft > 0;
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

/** Il gesto può essere assorbito da qualcosa fra il punto toccato e la zona permessa? */
export function gestoConsentito(target: HTMLElement | null, dx: number, dy: number): boolean {
  if (!target) return false;
  if (target.closest("[data-scroll-lock-gesture]")) return true;

  const zona = target.closest<HTMLElement>("[data-scroll-lock-allow]");
  if (!zona) return false;

  const asse = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  const delta = asse === "x" ? dx : dy;
  if (delta === 0) return true;

  let el: HTMLElement | null = target;
  while (el) {
    if (scorribile(el, asse, delta)) return true;
    if (el === zona) break;
    el = el.parentElement;
  }
  return false;
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    if (locks === 0) {
      previous = {
        htmlOverflow: html.style.overflow,
        bodyOverflow: body.style.overflow,
        htmlOverscroll: html.style.overscrollBehavior,
      };
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      // Niente effetto elastico sulla pagina: è proprio quello che faceva
      // intravedere lo sfondo muoversi ai bordi della tendina.
      html.style.overscrollBehavior = "none";
    }
    locks += 1;

    if (!removeTouchBlock) {
      let ultimoX = 0;
      let ultimoY = 0;

      const onStart = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        ultimoX = t.clientX;
        ultimoY = t.clientY;
      };

      const onMove = (e: TouchEvent) => {
        // Due dita: è uno zoom, non uno scorrimento. Va comunque fermato,
        // altrimenti su iPhone sposta la pagina sotto.
        if (e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const t = e.touches[0];
        if (!t) return;
        // Si confronta con l'ultimo movimento, non con il punto di partenza:
        // chi scorre su e poi torna giù nello stesso gesto deve essere
        // valutato sulla direzione di adesso.
        const dx = t.clientX - ultimoX;
        const dy = t.clientY - ultimoY;
        ultimoX = t.clientX;
        ultimoY = t.clientY;
        if (!gestoConsentito(e.target as HTMLElement | null, dx, dy)) e.preventDefault();
      };

      document.addEventListener("touchstart", onStart, { passive: true });
      document.addEventListener("touchmove", onMove, { passive: false });
      removeTouchBlock = () => {
        document.removeEventListener("touchstart", onStart);
        document.removeEventListener("touchmove", onMove);
      };
    }

    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        html.style.overflow = previous?.htmlOverflow ?? "";
        body.style.overflow = previous?.bodyOverflow ?? "";
        html.style.overscrollBehavior = previous?.htmlOverscroll ?? "";
        previous = null;
        removeTouchBlock?.();
        removeTouchBlock = null;
      }
    };
  }, [active]);
}
