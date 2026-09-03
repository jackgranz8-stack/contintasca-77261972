import { useEffect, useRef, useState, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

const CLOSE_DRAG_THRESHOLD = 120;

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
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none">
      <button
        aria-label="Chiudi"
        onClick={onClose}
        className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        data-scroll-lock-allow
        className="no-scrollbar relative z-10 max-h-[92svh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-popover pb-[max(env(safe-area-inset-bottom),14px)]"
        style={{ transform, transition }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex touch-none justify-center py-2.5"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        <div className="px-4 pt-0.5">{children}</div>
      </div>
    </div>
  );
}
