import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, List, PieChart, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/storico", label: "Storico", icon: List },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/profilo", label: "Profilo", icon: User },
] as const;

/** Vibrazione brevissima, solo dove il telefono la supporta (Android). */
function tap(ms: number) {
  if (typeof navigator === "undefined") return;
  if ("vibrate" in navigator) navigator.vibrate?.(ms);
}

/**
 * Barra di navigazione in stile Instagram / tab bar iOS.
 *
 * Rispetto alla versione precedente (pillola flottante staccata dal bordo):
 * - occupa tutta la larghezza e si appoggia al bordo inferiore vero dello
 *   schermo, con il vetro che prosegue sotto la barra gesti del telefono;
 * - è più alta e ha le etichette sotto le icone, come su iPhone: si capisce
 *   dove si sta andando senza dover interpretare l'icona;
 * - resta identica nel comportamento "fluido": si può scorrere il dito sulla
 *   barra per passare da una sezione all'altra, l'indicatore insegue il dito
 *   con il rimbalzo elastico e si allunga mentre si muove.
 *
 * Tutto il "vetro" (sfondo, sfocatura, riga di separazione, colore
 * dell'indicatore) vive in styles.css nelle classi .app-nav / .app-nav-track,
 * così cambia da solo tra tema chiaro e scuro.
 */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const trackRef = useRef<HTMLUListElement | null>(null);
  const draggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const activeIndex = items.findIndex(({ to }) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to),
  );

  const indexFromX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const clamped = Math.min(rect.right - 1, Math.max(rect.left, clientX));
    const ratio = (clamped - rect.left) / rect.width;
    return Math.min(items.length - 1, Math.max(0, Math.floor(ratio * items.length)));
  }, []);

  const goTo = (index: number) => {
    const target = items[index];
    if (!target) return;
    const already = target.to === "/" ? pathname === "/" : pathname.startsWith(target.to);
    if (!already) void navigate({ to: target.to });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    const idx = indexFromX(e.clientX);
    dragIndexRef.current = idx;
    setDragIndex(idx);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!draggingRef.current) return;
    const idx = indexFromX(e.clientX);
    if (idx !== null && idx !== dragIndexRef.current) {
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

  const slot = 100 / items.length;

  return (
    <nav className="app-nav" aria-label="Navigazione principale">
      <ul
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="app-nav-track"
      >
        {/* Indicatore che scorre sotto l'icona attiva. Mentre si muove si
            allunga leggermente in verticale (effetto elastico), poi si
            riassesta: è lo stesso comportamento di prima. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute transition-[left,top,bottom] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            moving ? "top-1 bottom-1" : "top-[7px] bottom-[7px]"
          }`}
          style={{ width: `${slot}%`, left: `${slot * shownIndex}%` }}
        >
          <span
            className="mx-2.5 block h-full rounded-[18px]"
            style={{ backgroundColor: "var(--nav-pill)" }}
          />
        </span>

        {items.map(({ to, label, icon: Icon }, i) => {
          const active = i === shownIndex;
          return (
            <li key={to} className="relative z-10 flex-1">
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (draggingRef.current) e.preventDefault();
                }}
                className={`flex h-full touch-none flex-col items-center justify-center gap-[3px] transition-transform duration-300 ease-out [-webkit-touch-callout:none] ${
                  active && dragIndex !== null ? "scale-[1.06]" : "scale-100"
                }`}
                draggable={false}
              >
                <Icon
                  size={23}
                  fill={active ? "currentColor" : "none"}
                  strokeWidth={active ? 1.6 : 1.8}
                  className={active ? "text-foreground" : "text-muted-foreground"}
                />
                <span
                  className={`text-[10px] leading-none tracking-tight ${
                    active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
