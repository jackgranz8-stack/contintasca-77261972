import { useState } from "react";
import { eur, monthLabel } from "@/lib/format";

export type BarSegment = { color: string; value: number };
export type BarDatum = {
  key: string;
  value: number;
  segments?: BarSegment[];
  /**
   * Spesa PREVISTA del mese (non ancora realizzata): disegnata come blocco a
   * tratto leggero SOPRA la parte reale, così l'altezza totale mostra dove si
   * arriverebbe, ma il numero sopra la barra continua a indicare solo lo
   * speso vero. Usato di norma solo sul mese in corso: i mesi passati sono
   * chiusi, non hanno nulla da prevedere.
   */
  forecast?: number;
  /**
   * Colore di riferimento del previsto: il colore della categoria quando il
   * grafico ne mostra una sola, altrimenti si lascia vuoto e viene usato il
   * verde dell'app.
   */
  forecastColor?: string | undefined;
};

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
  // L'altezza si scala sul totale (reale + previsto), altrimenti un previsto
  // alto sforerebbe fuori dal grafico.
  const max = Math.max(1, ...data.map((d) => d.value + (d.forecast ?? 0)));
  const selectedKeys = Array.isArray(selected) ? selected : selected ? [selected] : [];

  return (
    <div className="relative flex items-end justify-between gap-1.5">
      {data.map((d) => {
        const active = selectedKeys.includes(d.key);
        const shown = hover === d.key;
        const forecast = d.forecast ?? 0;
        const tintaPrevisto = d.forecastColor ?? "var(--accent-lime)";
        const totale = d.value + forecast;
        const h = Math.max(6, (totale / max) * 96);
        const segments = d.value > 0 && d.segments && d.segments.length > 0 ? d.segments : null;
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
                {forecast > 0 && (
                  <span className="text-muted-foreground"> + {eur(forecast)} previsti</span>
                )}
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
              className={`relative flex w-full flex-col overflow-hidden rounded-t-lg transition-all duration-300 ${
                segments || forecast > 0
                  ? `bg-surface-2 ${active ? "ring-2 ring-foreground/50" : ""}`
                  : active
                    ? "lime-fill"
                    : "bg-surface-2 opacity-70"
              }`}
              style={{ height: h }}
            >
              {/* Previsto: sta in cima, a righine leggere. La distinzione non è
                  solo di colore ma di trama, così si capisce anche a colpo
                  d'occhio veloce o con difficoltà nel distinguere i colori.
                  Viene tirato giù di un raggio così da scivolare SOTTO la cima
                  arrotondata della parte reale (che gli sta sopra): la parte
                  reale conserva la sua cima tonda e il previsto sembra
                  continuare da lì, senza gradini. */}
              {forecast > 0 && !segments && (
                <span
                  className="absolute inset-x-0 rounded-t-lg"
                  style={{
                    bottom: `calc(${(d.value / totale) * 100}% - 8px)`,
                    height: `calc(${(forecast / totale) * 100}% + 8px)`,
                    backgroundColor: `color-mix(in oklab, ${tintaPrevisto} 16%, transparent)`,
                    backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${tintaPrevisto} 28%, transparent) 0 1px, transparent 1px 7px)`,
                  }}
                />
              )}
              {segments ? (
                segments.map((seg, i) => (
                  <span
                    key={i}
                    className="relative z-10 w-full shrink-0"
                    style={{
                      height: `${(seg.value / totale) * 100}%`,
                      backgroundColor: seg.color,
                    }}
                  />
                ))
              ) : forecast > 0 ? (
                <span
                  className={`absolute inset-x-0 bottom-0 z-10 rounded-t-lg ${
                    active ? "lime-fill" : "bg-surface-2 opacity-70"
                  }`}
                  style={{ height: `${(d.value / totale) * 100}%` }}
                />
              ) : null}
            </span>
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
