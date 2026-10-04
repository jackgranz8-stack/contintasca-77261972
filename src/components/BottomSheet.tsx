import { useEffect, useRef, useState, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

const CLOSE_DRAG_THRESHOLD = 120;

/** Sotto questa altezza coperta (in px) non è una tastiera: si ignora. */
const SOGLIA_TASTIERA = 80;

/**
 * Foglio che sale dal basso, in stile iOS: entra/esce con una transizione
 * morbida (nessun salto secco come prima), e si può chiudere anche
 * trascinandolo verso il basso tramite la maniglia in alto. Se il
 * trascinamento viene rilasciato senza superare la soglia, il foglio torna
 * su con un piccolo rimbalzo elastico invece di scattare di colpo.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  fullScreen = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Foglio a tutta altezza invece che alto quanto il suo contenuto.
   *
   * Serve ai moduli lunghi (la nuova spesa): con tutto lo schermo a
   * disposizione le categorie stanno su più righe tutte visibili e il
   * pulsante di salvataggio può restare ancorato in fondo, senza che il
   * foglio cresca e cali di altezza a ogni campo che si apre.
   *
   * In questa modalità il foglio NON scorre per conto suo: si divide in tre
   * fasce (intestazione, contenuto, pulsante) ed è il contenuto a scorrere.
   * Chi lo usa deve quindi passare dei figli già organizzati così.
   */
  fullScreen?: boolean;
}) {
  const [visible, setVisible] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  const [transitionKind, setTransitionKind] = useState<"smooth" | "spring">("smooth");
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setDragY(0);
      setTransitionKind("smooth");
      const raf = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setTransitionKind("smooth");
    setAnimateIn(false);
    const timer = window.setTimeout(() => setVisible(false), 320);
    return () => window.clearTimeout(timer);
  }, [open]);

  useScrollLock(visible);

  /*
   * TENDINA SOPRA LA TASTIERA
   *
   * La tendina è ancorata al fondo dello schermo. Su iPhone la tastiera
   * copre il fondo SENZA ridurre la pagina: una tendina bassa come
   * "Modifica categoria" finiva interamente dietro la tastiera, campi
   * compresi, e non si vedeva cosa si stava scrivendo.
   *
   * Qui si misura quanta parte della pagina è coperta: altezza della pagina
   * meno l'area davvero visibile (visualViewport, che invece si riduce con la
   * tastiera). La tendina viene alzata di quel tanto e si appoggia al bordo
   * superiore della tastiera.
   *
   * Vale per tutti i sistemi senza doverli distinguere: su Android la
   * pagina dichiara "interactive-widget=resizes-content", quindi è la pagina
   * stessa a restringersi, l'area coperta risulta zero e non si sposta
   * niente. Su iPhone, che quella dichiarazione la ignora, risulta l'altezza
   * della tastiera.
   *
   * Sotto la soglia si ignora: piccole differenze (barre di Safari, arrotondamenti)
   * non devono far sobbalzare la tendina.
   *
   * Solo per le tendine normali: quella a tutto schermo ha già i campi in
   * alto, sopra la tastiera, e non va spostata.
   */
  const [tastiera, setTastiera] = useState({ coperto: 0, visibile: 0 });
  useEffect(() => {
    if (!visible || fullScreen || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const aggiorna = () => {
      const coperto = window.innerHeight - vv.height - vv.offsetTop;
      setTastiera(
        coperto > SOGLIA_TASTIERA
          ? { coperto: Math.round(coperto), visibile: Math.round(vv.height) }
          : { coperto: 0, visibile: 0 },
      );
    };
    aggiorna();
    vv.addEventListener("resize", aggiorna);
    vv.addEventListener("scroll", aggiorna);
    return () => {
      vv.removeEventListener("resize", aggiorna);
      vv.removeEventListener("scroll", aggiorna);
      setTastiera({ coperto: 0, visibile: 0 });
    };
  }, [visible, fullScreen]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dy = Math.max(0, e.clientY - startYRef.current);
    setDragY(dy);
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > CLOSE_DRAG_THRESHOLD) {
      setTransitionKind("smooth");
      onClose();
    } else {
      setTransitionKind("spring");
      setDragY(0);
    }
  };

  if (!visible) return null;

  const transform = animateIn ? `translateY(${dragY}px)` : "translateY(100%)";
  const transition = draggingRef.current
    ? "none"
    : transitionKind === "spring"
      ? "transform 420ms cubic-bezier(0.34,1.56,0.64,1)"
      : "transform 320ms cubic-bezier(0.32,0.72,0,1)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-none transition-[padding] duration-250 ease-out motion-reduce:transition-none"
      style={{ paddingBottom: tastiera.coperto }}
    >
      <button
        aria-label="Chiudi"
        onClick={onClose}
        className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        /*
         * A tutto schermo il permesso di scorrere NON va sull'intero foglio
         * ma solo sulla fascia che scorre davvero, che chi usa il foglio
         * marca da sé. Il blocco in use-scroll-lock lascia comunque passare
         * un gesto solo se lì sotto c'è qualcosa che può scorrere: niente
         * più trascinamenti che muovono la pagina dietro.
         */
        data-scroll-lock-allow={fullScreen ? undefined : true}
        className={
          fullScreen
            ? "relative z-10 flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-3xl border border-border bg-popover pb-[max(env(safe-area-inset-bottom),14px)]"
            : "no-scrollbar relative z-10 max-h-[92svh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-popover pb-[max(env(safe-area-inset-bottom),14px)]"
        }
        style={{
          transform,
          transition,
          ...(tastiera.coperto
            ? {
                // Mai più alta dell'area visibile sopra la tastiera, meno la
                // barra di stato: se il contenuto non ci sta, scorre dentro.
                maxHeight: `calc(${tastiera.visibile}px - env(safe-area-inset-top, 0px) - 8px)`,
                // Lo spazio per la barra "home" di iPhone non serve: in
                // questo momento sta sotto la tastiera.
                paddingBottom: 14,
              }
            : null),
        }}
      >
        <div
          data-scroll-lock-gesture
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`flex shrink-0 touch-none justify-center py-2.5 ${
            fullScreen ? "pt-[calc(env(safe-area-inset-top,0px)+14px)]" : ""
          }`}
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        <div className={fullScreen ? "flex min-h-0 flex-1 flex-col px-4 pt-0.5" : "px-4 pt-0.5"}>
          {children}
        </div>
      </div>
    </div>
  );
}
