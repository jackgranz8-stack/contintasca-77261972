import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { ICON_KEYS, iconFor } from "@/lib/icons";
import { CATEGORY_COLORS, type Category } from "@/lib/types";

export function EditCategoryModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit: Category | null;
}) {
  const { updateCategory } = useApp();
  const [icona, setIcona] = useState("wallet");
  const [colore, setColore] = useState("#8CE562");

  useEffect(() => {
    if (!open || !edit) return;
    setIcona(edit.icona);
    setColore(edit.colore);
  }, [open, edit]);

  useScrollLock(open);

  if (!open || !edit) return null;

  const Icon = iconFor(icona);

  const salva = () => {
    updateCategory(edit.id, { icona, colore });
    toast.success("Categoria aggiornata");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-background/70 backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="Chiudi" onClick={onClose} />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-popover px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Modifica categoria</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-surface-2 p-2 text-muted-foreground"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface p-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${colore}22`, color: colore }}
          >
            <Icon size={22} />
          </span>
          <p className="truncate text-sm font-medium">{edit.nome}</p>
        </div>

        <p className="mb-2 text-xs text-muted-foreground">Icona</p>
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          {ICON_KEYS.map((k) => {
            const OptIcon = iconFor(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setIcona(k)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                  icona === k
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
                aria-label={`Icona ${k}`}
              >
                <OptIcon size={17} />
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs text-muted-foreground">Colore</p>
        <div className="mb-4 grid grid-cols-6 gap-2.5">
          {CATEGORY_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => setColore(col)}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-transform"
              style={{
                backgroundColor: col,
                boxShadow:
                  colore === col ? `0 0 0 2px var(--popover), 0 0 0 4px ${col}` : undefined,
                transform: colore === col ? "scale(1.08)" : undefined,
              }}
              aria-label={`Colore ${col}`}
            >
              {colore === col && <Check size={16} color="#fff" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <button
          onClick={salva}
          className="lime-fill w-full rounded-2xl py-3.5 text-base font-semibold"
        >
          Salva modifiche
        </button>
      </div>
    </div>
  );
}
