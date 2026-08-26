import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { ICON_KEYS, iconFor } from "@/lib/icons";
import { CATEGORY_COLORS, type Category } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";

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
  const [nome, setNome] = useState("");
  const [icona, setIcona] = useState("wallet");
  const [colore, setColore] = useState("#8CE562");
  // Resta con l'ultima categoria valida durante l'animazione di chiusura,
  // così il contenuto non sparisce di scatto mentre il foglio scorre giù.
  const [lastEdit, setLastEdit] = useState<Category | null>(edit);

  useEffect(() => {
    if (edit) setLastEdit(edit);
  }, [edit]);

  useEffect(() => {
    if (!open || !edit) return;
    setNome(edit.nome);
    setIcona(edit.icona);
    setColore(edit.colore);
  }, [open, edit]);

  const shown = edit ?? lastEdit;
  if (!shown) return null;

  const Icon = iconFor(icona);

  const salva = () => {
    const n = nome.trim();
    if (!n) {
      toast.error("Il nome non può essere vuoto");
      return;
    }
    updateCategory(shown.id, { nome: n, icona, colore });
    toast.success("Categoria aggiornata");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
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
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Nome categoria"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
        />
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
                icona === k ? "border-primary text-primary" : "border-border text-muted-foreground"
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
              boxShadow: colore === col ? `0 0 0 2px var(--popover), 0 0 0 4px ${col}` : undefined,
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
    </BottomSheet>
  );
}
