import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

const REVEAL = 76;

/**
 * Wrapper che aggiunge lo swipe-to-delete in stile iOS a una singola riga/card.
 * Lo scorrimento verso sinistra rivela un pannello rosso con l'icona del cestino,
 * confinato esclusivamente al riquadro di questa riga (non influenza le altre).
 *
 * È un componente controllato: `openId`/`onOpenChange` sono condivisi tra tutte le
 * righe di una stessa lista, così aprendone una tutte le altre si richiudono da sole.
 */
export function SwipeToDelete({
  id,
  openId,
  onOpenChange,
  onDelete,
  label = "Elimina",
  className = "",
  children,
}: {
  id: string;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  onDelete: () => void;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = openId === id;
  const [offset, setOffset] = useState(0);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, base: 0 });
  const axisRef = useRef<"none" | "x" | "y">("none");

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    axisRef.current = "none";
    startRef.current = { x: e.clientX, y: e.clientY, base: open ? -REVEAL : 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (axisRef.current === "none") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisRef.current === "x") e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (axisRef.current !== "x") return;
    e.preventDefault();
    const next = Math.min(4, Math.max(-REVEAL - 14, startRef.current.base + dx));
    setOffset(next);
  };

  const finish = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (axisRef.current === "x") {
      const shouldOpen = offset < -REVEAL / 2;
      if (shouldOpen) onOpenChange(id);
      else if (open) onOpenChange(null);
      setOffset(shouldOpen ? -REVEAL : 0);
    }
    axisRef.current = "none";
  };

  const shown = draggingRef.current ? offset : open ? -REVEAL : 0;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-y-0 right-0 z-0" style={{ width: REVEAL }}>
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            onOpenChange(null);
            setOffset(0);
            onDelete();
          }}
          className="flex h-full w-full items-center justify-center bg-destructive text-destructive-foreground"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          if (open) {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(null);
            setOffset(0);
          }
        }}
        className="relative z-10 bg-[image:var(--gradient-card)]"
        style={{
          transform: `translateX(${shown}px)`,
          transition: draggingRef.current
            ? "none"
            : "transform 500ms cubic-bezier(0.34,1.56,0.64,1)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
