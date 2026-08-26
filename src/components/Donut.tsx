import { useRef, useState } from "react";
import { eur } from "@/lib/format";

export type Slice = { id?: string; label: string; value: number; color: string };

const R = 54;
const CIRC = 2 * Math.PI * R;

export function Donut({
  slices,
  total,
  selected,
  onSelect,
  centerLabel = "Totale",
}: {
  slices: Slice[];
  total: number;
  selected?: string | string[] | null;
  onSelect?: (id: string) => void;
  centerLabel?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const visible = slices.filter((s) => s.value > 0);
  const sum = visible.reduce((a, s) => a + s.value, 0);
  let offset = 0;
  const selectedIds = Array.isArray(selected) ? selected : selected ? [selected] : [];

  const activeSlice = visible.find((s) => (s.id ?? s.label) === active);

  // Determina lo spicchio sotto il dito/puntatore in base all'angolo rispetto al
  // centro del grafico, per poterlo scorrere con il dito (non solo toccare).
  const scrubAt = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg || sum <= 0 || visible.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let screenDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (screenDeg < 0) screenDeg += 360;
    // Il grafico è ruotato di -90° via CSS per far partire lo spicchio dalle ore 12:
    // qui si annulla quella rotazione per ritrovare l'angolo "reale" nel cerchio.
    const localFrac = ((((screenDeg + 90) % 360) + 360) % 360) / 360;
    let acc = 0;
    for (const [i, s] of visible.entries()) {
      const frac = s.value / sum;
      if (localFrac < acc + frac || i === visible.length - 1) {
        setActive(s.id ?? s.label);
        return;
      }
      acc += frac;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div
        className="relative h-[170px] w-[170px] touch-none"
        onPointerMove={(e) => scrubAt(e.clientX, e.clientY)}
        onPointerDown={(e) => scrubAt(e.clientX, e.clientY)}
        onPointerLeave={() => setActive(null)}
        onPointerUp={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
      >
        <svg ref={svgRef} viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
          {sum > 0 &&
            visible.map((s) => {
              const key = s.id ?? s.label;
              const isSel = s.id != null && selectedIds.includes(s.id);
              const isActive = active === key;
              const len = (s.value / sum) * CIRC;
              const dash = `${Math.max(0, len - 2)} ${CIRC - Math.max(0, len - 2)}`;
              const el = (
                <circle
                  key={key}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isSel || isActive ? 20 : 16}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  opacity={selectedIds.length > 0 && !isSel ? 0.4 : 1}
                  className={
                    onSelect
                      ? "cursor-pointer transition-all duration-200"
                      : "transition-all duration-200"
                  }
                  onClick={() => s.id && onSelect?.(s.id)}
                />
              );
              offset += (s.value / sum) * CIRC;
              return el;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {activeSlice ? (
            <>
              <span className="text-[11px] text-muted-foreground">{activeSlice.label}</span>
              <span className="text-lg font-semibold tracking-tight">{eur(activeSlice.value)}</span>
              <span className="text-[11px] text-primary">
                {sum > 0 ? Math.round((activeSlice.value / sum) * 100) : 0}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
              <span className="text-lg font-semibold tracking-tight">{eur(total)}</span>
            </>
          )}
        </div>
      </div>
      {onSelect && visible.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Scorri con il dito per vedere il dettaglio, tocca per filtrare
        </p>
      )}
    </div>
  );
}
