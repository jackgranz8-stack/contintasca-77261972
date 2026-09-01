import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, List, PieChart, Plus, User } from "lucide-react";

type Slot =
  { kind: "link"; to: string; label: string; icon: typeof Home } | { kind: "add"; label: string };

/**
 * Le cinque posizioni della barra. Il "+" sta in mezzo, come su Instagram:
 * è il gesto più frequente dell'app, quindi finisce nel punto più comodo da
 * raggiungere con il pollice.
 */
const slots: Slot[] = [
  { kind: "link", to: "/", label: "Home", icon: Home },
  { kind: "link", to: "/storico", label: "Storico", icon: List },
  { kind: "add", label: "Aggiungi spesa" },
  { kind: "link", to: "/budget", label: "Budget", icon: PieChart },
  { kind: "link", to: "/profilo", label: "Profilo", icon: User },
];

const ADD_INDEX = slots.findIndex((s) => s.kind === "add");

/** Vibrazione brevissima, solo dove il telefono la supporta (Android). */
function tap(ms: number) {
  if (typeof navigator === "undefined") return;
  if ("vibrate" in navigator) navigator.vibrate?.(ms);
}

/**
 * Barra di navigazione "a nuvola", stile Instagram / libreria Apple.
 *
 * - Pillola flottante staccata dai bordi, in vetro smerigliato: sotto di lei
 *   si intravede il contenuto che scorre (tutto l'aspetto vive in
 *   styles.css, classe .app-nav, così segue da solo tema chiaro e scuro).
 * - Si RIMPICCIOLISCE scorrendo verso il basso e torna piena scorrendo verso
 *   l'alto, al tocco, o quando si è in cima alla pagina: è la regola delle
 *   interfacce Apple — i comandi si fanno da parte mentre leggi e tornano
 *   appena li cerchi.
 * - Il "+" per aggiungere una spesa è dentro la barra, al centro.
 * - Resta lo scorrimento del dito sulla barra per passare da una sezione
 *   all'altra, con l'indicatore che insegue il dito.
 */
export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const trackRef = useRef<HTMLUListElement | null>(null);
  const draggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);

  const activeIndex = slots.findIndex((s) =>
    s.kind === "link" ? (s.to === "/" ? pathname === "/" : pathname.startsWith(s.to)) : false,
  );

  /*
   * Rimpicciolimento allo scorrimento.
   *
   * A scorrere è la PAGINA (finestra), non un riquadro interno: prima ci si
   * agganciava a .app-scroll, che però non è più l'elemento che scorre, e
   * infatti la barra aveva smesso di rimpicciolirsi. Le letture sono
   * raggruppate dentro un requestAnimationFrame, così si aggiorna al massimo
   * una volta per fotogramma senza appesantire lo scorrimento; la soglia di
   * 6px evita che la barra "sfarfalli" ai micro-movimenti del dito.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let last = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (y < 24) setCompact(false);
        else if (delta > 6) setCompact(true);
        else if (delta < -6) setCompact(false);
        last = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const indexFromX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const clamped = Math.min(rect.right - 1, Math.max(rect.left, clientX));
    const ratio = (clamped - rect.left) / rect.width;
    return Math.min(slots.length - 1, Math.max(0, Math.floor(ratio * slots.length)));
  }, []);

  const goTo = (index: number) => {
    const target = slots[index];
    if (!target || target.kind !== "link") return;
    const already = target.to === "/" ? pathname === "/" : pathname.startsWith(target.to);
    if (!already) void navigate({ to: target.to });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Primo tocco: la barra torna sempre a grandezza piena.
    setCompact(false);
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    const idx = indexFromX(e.clientX);
    // Il "+" non fa parte dello scorrimento fra sezioni: è un'azione, non
    // una destinazione, quindi passandoci sopra col dito non lo si "seleziona".
    if (idx === ADD_INDEX) return;
    dragIndexRef.current = idx;
    setDragIndex(idx);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!draggingRef.current) return;
    const idx = indexFromX(e.clientX);
    if (idx === null || idx === ADD_INDEX) return;
    if (idx !== dragIndexRef.current) {
      dragIndexRef.current = idx;
      setDragIndex(idx);
      tap(3);
    }
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragIndexRef.current !== null) {
      if (dragIndexRef.current !== activeIndex) tap(8);
      goTo(dragIndexRef.current);
    }
    dragIndexRef.current = null;
    setDragIndex(null);
  };

  const shownIndex = dragIndex ?? (activeIndex === -1 ? 0 : activeIndex);

  const [moving, setMoving] = useState(false);
  const prevShownRef = useRef(shownIndex);
  useEffect(() => {
    if (prevShownRef.current === shownIndex) return;
    prevShownRef.current = shownIndex;
    setMoving(true);
    const timer = window.setTimeout(() => setMoving(false), 500);
    return () => window.clearTimeout(timer);
  }, [shownIndex]);

  const slotWidth = 100 / slots.length;

  return (
    <nav className="app-nav" data-compact={compact} aria-label="Navigazione principale">
      <ul
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="app-nav-track"
      >
        {/* Indicatore che scorre sotto l'icona attiva: mentre si muove si
            allunga leggermente, poi si riassesta. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute transition-[left,top,bottom] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            moving ? "top-0.5 bottom-0.5" : "top-1.5 bottom-1.5"
          }`}
          style={{ width: `${slotWidth}%`, left: `${slotWidth * shownIndex}%` }}
        >
          <span
            className="mx-1 block h-full rounded-[22px]"
            style={{ backgroundColor: "var(--nav-pill)" }}
          />
        </span>

        {slots.map((slot, i) => {
          if (slot.kind === "add") {
            return (
              <li key="add" className="relative z-10 flex-1">
                <button
                  type="button"
                  aria-label={slot.label}
                  onClick={onAdd}
                  onPointerDown={(e) => {
                    // Il "+" gestisce il proprio tocco: non deve far partire
                    // lo scorrimento fra sezioni.
                    e.stopPropagation();
                    setCompact(false);
                  }}
                  className="flex h-full w-full touch-none items-center justify-center [-webkit-touch-callout:none]"
                >
                  <span className="lime-fill flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-300 ease-out active:scale-90">
                    <Plus size={20} strokeWidth={2.8} />
                  </span>
                </button>
              </li>
            );
          }

          const active = i === shownIndex;
          const Icon = slot.icon;
          return (
            <li key={slot.to} className="relative z-10 flex-1">
              <Link
                to={slot.to}
                aria-label={slot.label}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (draggingRef.current) e.preventDefault();
                }}
                className={`flex h-full touch-none items-center justify-center transition-transform duration-300 ease-out [-webkit-touch-callout:none] ${
                  active && dragIndex !== null ? "scale-110" : "scale-100"
                }`}
                draggable={false}
              >
                <Icon
                  size={24}
                  fill={active ? "currentColor" : "none"}
                  strokeWidth={active ? 1.6 : 1.8}
                  className={active ? "text-foreground" : "text-muted-foreground"}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
