import { barTone, pct } from "@/lib/format";

export function ProgressBar({
  value,
  max,
  color,
  height = 10,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const p = pct(value, max);
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-surface-2"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, p)}%`, background: color ?? barTone(p) }}
      />
    </div>
  );
}
