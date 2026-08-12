import { eur, monthLabel } from "@/lib/format";

export type BarDatum = { key: string; value: number };

export function TrendBars({
  data,
  selected,
  onSelect,
}: {
  data: BarDatum[];
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end justify-between gap-2">
      {data.map((d) => {
        const active = d.key === selected;
        const h = Math.max(6, (d.value / max) * 96);
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelect?.(d.key)}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            aria-label={`${monthLabel(d.key)}: ${eur(d.value)}`}
          >
            <span
              className={
                active ? "text-[10px] font-semibold text-primary" : "text-[10px] text-muted-foreground"
              }
            >
              {d.value > 0 ? Math.round(d.value) : ""}
            </span>
            <span
              className={`w-full rounded-t-lg transition-all duration-300 ${
                active ? "lime-fill" : "bg-surface-2"
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
