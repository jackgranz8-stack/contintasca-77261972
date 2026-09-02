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
   * Spesa PREVISTA (non ancora realizzata): in tinta molto tenue e con un
   * tratteggio appena accennato. Deve leggersi come "in arrivo", senza mai
   * dare l'impressione che quei soldi siano già usciti.
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
  // Raggio della punta arrotondata: metà dell'altezza, come in una pillola.
  const raggio = height / 2;

  return (
    <div
      className="relative flex w-full overflow-hidden rounded-full bg-surface-2"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/*
        La parte prevista viene disegnata PRIMA e tirata indietro di un raggio,
        così scivola SOTTO la punta arrotondata di quella reale (che le sta
        sopra, essendo disegnata dopo con z-index maggiore). In questo modo la
        parte reale conserva la sua punta tonda e il previsto sembra
        continuare esattamente da dove quella finisce, senza gradini né
        spazi vuoti in mezzo.
      */}
      {mostraPrevisto && (
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-500"
          style={{
            left: `calc(${pReale}% - ${raggio}px)`,
            width: `calc(${pPrevisto}% + ${raggio}px)`,
            backgroundColor: `color-mix(in oklab, ${tintaPrevisto} 16%, transparent)`,
            backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${tintaPrevisto} 28%, transparent) 0 1px, transparent 1px 7px)`,
          }}
        />
      )}
      <div
        className="relative z-10 h-full rounded-full transition-all duration-500"
        style={{ width: `${pReale}%`, background: tonoReale }}
      />
    </div>
  );
}
