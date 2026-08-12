import { eur } from "@/lib/format";

export type Slice = { label: string; value: number; color: string };

export function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const sum = slices.reduce((a, s) => a + s.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center justify-center py-2">
      <div className="relative h-[150px] w-[150px]">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth="16"
          />
          {sum > 0 &&
            slices
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / sum) * c;
                const dash = `${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`;
                const el = (
                  <circle
                    key={s.label}
                    cx="70"
                    cy="70"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">Totale</span>
          <span className="text-lg font-semibold tracking-tight">{eur(total)}</span>
        </div>
      </div>
    </div>
  );
}
