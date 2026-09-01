import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, List, PieChart, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/storico", label: "Storico", icon: List },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/profilo", label: "Profilo", icon: User },
] as const;

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
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(3);
      }
    }
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragIndexRef.current !== null) goTo(dragIndexRef.current);
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

  // Barra flottante arrotondata in stile Instagram (quella sopra i Reel):
  // quasi tutta larghezza (piccoli margini a sinistra/destra, non centrata
  // stretta), angoli molto arrotondati, vetro smerigliato semi-trasparente,
  // una piccola distanza dal bordo vero dello schermo invece di stare a
  // filo, e un'ombra morbida al posto di un bordo visibile.
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2.5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <nav
        className="float-shadow w-full rounded-[28px] bg-popover/80 backdrop-blur-2xl"
        style={{ willChange: "transform" }}
      >
        <ul
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative flex touch-none items-center select-none"
        >
          <span
            className={`pointer-events-none absolute rounded-full bg-foreground/10 transition-[left,top,bottom] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              moving ? "top-1 bottom-1" : "top-2.5 bottom-2.5"
            }`}
            style={{
              width: `${100 / items.length}%`,
              left: `${(100 / items.length) * shownIndex}%`,
            }}
          />
          {items.map(({ to, label, icon: Icon }, i) => {
            const active = i === shownIndex;
            return (
              <li key={to} className="relative z-10 flex-1">
                <Link
                  to={to}
                  aria-label={label}
                  onClick={(e) => {
                    if (draggingRef.current) e.preventDefault();
                  }}
                  className="flex touch-none items-center justify-center py-3 [-webkit-touch-callout:none]"
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
    </div>
  );
}
