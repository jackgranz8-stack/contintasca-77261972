import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { iconFor } from "@/lib/icons";
import type { Recurring } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { RecurrenceFields, type RegoleRicorrenza } from "./RecurrenceFields";

export function EditRecurringModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit: Recurring | null;
}) {
  const { state, updateRecurring } = useApp();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [importo, setImporto] = useState("");
  const [regole, setRegole] = useState<RegoleRicorrenza>({
    cadenza: "mesi",
    intervallo: 1,
    giorno: 1,
    fine: null,
  });
  const [campo, setCampo] = useState<"importo" | "nome" | null>(null);
  // Resta con l'ultima ricorrente valida durante l'animazione di chiusura,
  // così il contenuto non sparisce di scatto mentre il foglio scorre giù.
  const [lastEdit, setLastEdit] = useState<Recurring | null>(edit);

  useEffect(() => {
    if (edit) setLastEdit(edit);
  }, [edit]);

  useEffect(() => {
    if (!open || !edit) return;
    setNome(edit.nome);
    setCategoria(edit.categoria);
    setImporto(String(edit.importo));
    setRegole({
      cadenza: edit.cadenza,
      intervallo: edit.intervallo,
      giorno: Math.min(28, Math.max(1, edit.giorno)),
      fine: edit.fine ?? null,
    });
    setCampo(null);
  }, [open, edit]);

  const shown = edit ?? lastEdit;
  if (!shown) return null;

  const salva = () => {
    const valore = Number(importo.replace(",", "."));
    if (!nome.trim() || !Number.isFinite(valore) || valore <= 0 || !categoria) {
      toast.error("Compila nome, importo e categoria");
      return;
    }
    updateRecurring(shown.id, {
      nome: nome.trim(),
      categoria,
      importo: valore,
      giorno: Math.min(28, Math.max(1, regole.giorno)),
      cadenza: regole.cadenza,
      intervallo: regole.intervallo,
      fine: regole.fine,
    });
    toast.success("Spesa ricorrente aggiornata");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Modifica ricorrente</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-surface-2 p-2 text-muted-foreground"
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>
      </div>

      <div
        className={`mb-3 flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-5 transition-opacity ${
          campo === "importo" ? "ring-2 ring-primary" : ""
        } ${campo === "nome" ? "pointer-events-none opacity-40" : ""}`}
      >
        <span className="text-2xl font-semibold text-muted-foreground">€</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={importo}
          onFocus={(e) => {
            setCampo("importo");
            e.target.select();
          }}
          onBlur={() => setCampo((v) => (v === "importo" ? null : v))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onChange={(e) => setImporto(e.target.value)}
          placeholder="0"
          aria-label="Importo"
          className="w-full min-w-0 bg-transparent text-center text-[42px] font-semibold leading-tight tracking-tight outline-none placeholder:text-muted-foreground"
        />
      </div>

      <input
        value={nome}
        onFocus={(e) => {
          setCampo("nome");
          e.target.select();
        }}
        onBlur={() => setCampo((v) => (v === "nome" ? null : v))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome (es. Affitto)"
        className={`mb-3 w-full rounded-2xl border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted-foreground ${
          campo === "nome" ? "border-primary ring-2 ring-primary" : "border-border"
        } ${campo === "importo" ? "pointer-events-none opacity-40" : ""}`}
      />

      <div className={campo ? "pointer-events-none opacity-40" : ""}>
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          {state.categorie.map((c) => {
            const Icon = iconFor(c.icona);
            const active = c.id === categoria;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[11px] transition-colors ${
                  active
                    ? "border-primary bg-surface-2 font-semibold text-foreground"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                >
                  <Icon size={18} />
                </span>
                <span className="w-full truncate text-center">{c.nome}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-3 rounded-2xl border border-border bg-surface p-3.5">
          <RecurrenceFields value={regole} onChange={setRegole} />
        </div>
      </div>

      <button
        onClick={salva}
        className={`lime-fill w-full rounded-2xl py-3.5 text-base font-semibold ${
          campo ? "pointer-events-none opacity-40" : ""
        }`}
      >
        Salva modifiche
      </button>
    </BottomSheet>
  );
}
