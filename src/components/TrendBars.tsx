import { useState } from "react";
import { eur, monthLabel } from "@/lib/format";

export type BarDatum = { key: string; value: number };

export function TrendBars({
  data,
  selected,
  onSelect,
}: {
  data: BarDatum[];
  selected?: string | string[];
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const selectedKeys = Array.isArray(selected) ? selected : selected ? [selected] : [];

  return (
    <div className="relative flex items-end justify-between gap-1.5">
      {data.map((d) => {
        const active = selectedKeys.includes(d.key);
        const shown = hover === d.key;
        const h = Math.max(6, (d.value / max) * 96);
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelect?.(d.key)}
            onPointerEnter={() => setHover(d.key)}
            onPointerLeave={() => setHover((v) => (v === d.key ? null : v))}
            onPointerDown={() => setHover(d.key)}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-2xl py-2 transition-colors active:bg-surface-2"
            aria-pressed={active}
            aria-label={`${monthLabel(d.key)}: ${eur(d.value)}`}
          >
            {shown && (
              <span className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg">
                <span className="capitalize text-muted-foreground">
                  {monthLabel(d.key, true).toLowerCase()}
                </span>{" "}
                <span className="font-semibold">{eur(d.value)}</span>
              </span>
            )}
            <span
              className={
                active
                  ? "text-[10px] font-semibold text-primary"
                  : "text-[10px] text-muted-foreground"
              }
            >
              {d.value > 0 ? Math.round(d.value) : ""}
            </span>
            <span
              className={`w-full rounded-t-lg transition-all duration-300 ${
                active ? "lime-fill" : "bg-surface-2 opacity-70"
              }`}
              style={{ height: h }}
            />
            <span
              className={`text-[11px] capitalize ${
                active ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {monthLabel(d.key, true).toLowerCase()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
