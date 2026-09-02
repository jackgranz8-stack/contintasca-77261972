import { barTone, pct } from "@/lib/format";

export function ProgressBar({
  value,
  max,
  forecast = 0,
  forecastColor,
  color,
  height = 10,
}: {
  value: number;
  max: number;
  /**
   * Spesa PREVISTA (non ancora realizzata): disegnata in continuità con
   * quella reale, senza stacchi, in tinta molto tenue e con un tratteggio
   * appena accennato. Deve leggersi come "in arrivo", senza mai dare
   * l'impressione che quei soldi siano già usciti.
   */
  forecast?: number;
  /**
   * Colore di riferimento della parte prevista. Quando la barra riguarda UNA
   * categoria si passa il colore di quella categoria, così il previsto resta
   * riconoscibile come suo; quando la barra è complessiva (più categorie
   * insieme) si lascia vuoto e viene usato il verde dell'app.
   */
  forecastColor?: string | undefined;
  color?: string;
  height?: number;
}) {
  const p = pct(value, max);
  const pReale = Math.min(100, p);
  // Il previsto occupa lo spazio che resta: non deve mai spingere la parte
  // reale fuori dalla barra né far sembrare che si sia speso più del vero.
  const pPrevisto = Math.min(100 - pReale, pct(forecast, max));
  const mostraPrevisto = pPrevisto > 0;

  const tonoReale = color ?? barTone(p);
  const tintaPrevisto = forecastColor ?? "var(--accent-lime)";

  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-surface-2"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        // Con il previsto accanto, il lato destro resta squadrato: così la
        // parte prevista riprende esattamente da dove finisce quella reale,
        // senza il gradino che si vedeva quando entrambe erano arrotondate.
        className={`h-full transition-all duration-500 ${
          mostraPrevisto ? "rounded-l-full" : "rounded-full"
        }`}
        style={{ width: `${pReale}%`, background: tonoReale }}
      />
      {mostraPrevisto && (
        <div
          className="h-full rounded-r-full transition-all duration-500"
          style={{
            width: `${pPrevisto}%`,
            // Velo molto leggero della tinta di riferimento...
            backgroundColor: `color-mix(in oklab, ${tintaPrevisto} 16%, transparent)`,
            // ...più righine sottili e distanziate: si intuisce il tratteggio
            // senza che diventi un motivo invadente.
            backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${tintaPrevisto} 28%, transparent) 0 1px, transparent 1px 7px)`,
          }}
        />
      )}
    </div>
  );
}
