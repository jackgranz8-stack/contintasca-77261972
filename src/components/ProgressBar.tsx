import { barTone, pct } from "@/lib/format";

export function ProgressBar({
  value,
  max,
  forecast = 0,
  color,
  height = 10,
}: {
  value: number;
  max: number;
  /**
   * Spesa PREVISTA (non ancora realizzata): disegnata subito dopo quella
   * reale, nello stesso colore ma a tratto leggero e con righine diagonali.
   * Serve a rispondere a colpo d'occhio a "se anche il previsto si realizza,
   * sforo il budget?", senza mai far sembrare quei soldi già usciti.
   */
  forecast?: number;
  color?: string;
  height?: number;
}) {
  const p = pct(value, max);
  const pReale = Math.min(100, p);
  // Il previsto occupa lo spazio che resta: non deve mai spingere la parte
  // reale fuori dalla barra né far sembrare che si sia speso più del vero.
  const pPrevisto = Math.min(100 - pReale, pct(forecast, max));
  const tonoReale = color ?? barTone(p);
  // Tonalità del previsto: quella che avrebbe la barra SE il previsto si
  // realizzasse. Così se il totale sfora, la parte leggera vira già al rosso
  // e l'avviso arriva prima, non a cose fatte.
  const tonoPrevisto = color ?? barTone(pct(value + forecast, max));

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
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pReale}%`, background: tonoReale }}
      />
      {pPrevisto > 0 && (
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pPrevisto}%`,
            // Righine diagonali sul colore di base, tenuto trasparente: si
            // legge come "in arrivo" anche da chi non distingue bene i colori,
            // perché la differenza non è solo di tinta ma di trama.
            backgroundColor: `color-mix(in oklab, ${tonoPrevisto} 32%, transparent)`,
            backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${tonoPrevisto} 55%, transparent) 0 2px, transparent 2px 5px)`,
          }}
        />
      )}
    </div>
  );
}
