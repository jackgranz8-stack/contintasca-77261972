import type { LucideIcon } from "lucide-react";

/**
 * Stato vuoto: cosa mostrare quando non c'è niente da mostrare.
 *
 * Prima erano righe di testo grigio in mezzo al nulla, tutte scritte in modo
 * un po' diverso. Un buono stato vuoto invece fa tre cose:
 * 1. dice CHE non c'è niente, senza far pensare a un errore o a un
 *    caricamento rimasto a metà;
 * 2. spiega PERCHÉ, o cosa serve per riempirlo;
 * 3. offre la via d'uscita, quando esiste — un pulsante che porta all'azione
 *    invece di lasciare la persona a cercarla.
 *
 * Il segno grafico è un cerchio con l'icona, appena accennato: dà un centro
 * visivo alla schermata senza sembrare una figura decorativa messa lì per
 * riempire.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Versione ridotta, per gli spazi dentro una scheda. */
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? "px-4 py-6" : "px-6 py-10"}`}
    >
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-full bg-surface-2 text-muted-foreground ${
          compact ? "h-10 w-10" : "h-14 w-14"
        }`}
      >
        <Icon size={compact ? 18 : 24} strokeWidth={1.7} />
      </span>
      <p className={`mt-3 font-medium ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
      {description && (
        <p
          className={`mt-1 max-w-[280px] text-muted-foreground ${
            compact ? "text-[11px]" : "text-xs"
          }`}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="lime-fill mt-4 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
