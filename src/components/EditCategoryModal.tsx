import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, X } from "lucide-react";
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
  const [budget, setBudget] = useState("0");
  // Icona e colore restano nascosti finché non si tocca l'icona: la
  // modifica del nome/budget resta la cosa in primo piano, personalizzare
  // aspetto è un passo secondario e opzionale.
  const [personalizzaAperta, setPersonalizzaAperta] = useState(false);
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
    setBudget(String(edit.budget));
    setPersonalizzaAperta(false);
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
    const budgetValue = Math.max(0, Number(budget.replace(",", ".")) || 0);
    updateCategory(shown.id, { nome: n, icona, colore, budget: budgetValue });
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
        <button
          type="button"
          onClick={() => setPersonalizzaAperta((v) => !v)}
          aria-label="Cambia icona e colore"
          aria-expanded={personalizzaAperta}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colore}22`, color: colore }}
        >
          <Icon size={22} />
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground"
          >
            <ChevronDown
              size={12}
              className={`transition-transform duration-300 ${personalizzaAperta ? "rotate-180" : ""}`}
            />
          </span>
        </button>
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

      <p className="mb-2 text-xs text-muted-foreground">Budget mensile</p>
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3.5">
        <span className="text-lg font-semibold text-primary">€</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={budget}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="0"
          aria-label="Budget mensile"
          className="w-full min-w-0 bg-transparent text-lg font-semibold text-primary outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          personalizzaAperta ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" aria-hidden={!personalizzaAperta}>
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
        </div>
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
