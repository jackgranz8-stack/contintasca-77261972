import { useState } from "react";
import { eur } from "@/lib/format";

export type Slice = { id?: string; label: string; value: number; color: string };

export function Donut({
  slices,
  total,
  selected,
  onSelect,
  centerLabel = "Totale",
}: {
  slices: Slice[];
  total: number;
  selected?: string | null;
  onSelect?: (id: string) => void;
  centerLabel?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const visible = slices.filter((s) => s.value > 0);
  const sum = visible.reduce((a, s) => a + s.value, 0);
  let offset = 0;

  const activeSlice = visible.find((s) => (s.id ?? s.label) === active);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative h-[170px] w-[170px]">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={54} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
          {sum > 0 &&
            visible.map((s) => {
              const key = s.id ?? s.label;
              const isSel = selected != null && selected === s.id;
              const isActive = active === key;
              const r = isSel || isActive ? 56 : 54;
              const c = 2 * Math.PI * r;
              const len = (s.value / sum) * c;
              const dash = `${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`;
              const el = (
                <circle
                  key={key}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isSel || isActive ? 20 : 16}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={-((offset / (2 * Math.PI * 54)) * c)}
                  opacity={selected && !isSel ? 0.4 : 1}
                  className={onSelect ? "cursor-pointer transition-all duration-200" : "transition-all duration-200"}
                  onPointerEnter={() => setActive(key)}
                  onPointerLeave={() => setActive((v) => (v === key ? null : v))}
                  onPointerDown={() => setActive(key)}
                  onClick={() => s.id && onSelect?.(s.id)}
                />
              );
              offset += (s.value / sum) * (2 * Math.PI * 54);
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
          Tocca uno spicchio per filtrare
        </p>
      )}
    </div>
  );
}
