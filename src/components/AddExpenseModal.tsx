import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { iconFor } from "@/lib/icons";
import { todayISO, uid } from "@/lib/format";

export function AddExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addTransaction, update } = useApp();
  const [importo, setImporto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState(todayISO());
  const [nota, setNota] = useState("");
  const [ripeti, setRipeti] = useState(false);
  const [giorno, setGiorno] = useState(1);

  useEffect(() => {
    if (!open) return;
    setImporto("");
    setNota("");
    setData(todayISO());
    setRipeti(false);
    setGiorno(Math.min(28, new Date().getDate()));
    setCategoria(state.categorie[0]?.id ?? "");
  }, [open, state.categorie]);

  if (!open) return null;

  const valore = Number(importo.replace(",", "."));

  const salva = () => {
    if (!Number.isFinite(valore) || valore <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    if (!categoria) {
      toast.error("Scegli una categoria");
      return;
    }
    addTransaction({ importo: valore, categoria, data, nota: nota.trim() });
    if (ripeti) {
      const nome = nota.trim() || state.categorie.find((c) => c.id === categoria)?.nome || "Spesa";
      update((s) => ({
        ...s,
        ricorrenti: [
          ...s.ricorrenti,
          {
            id: uid(),
            nome,
            categoria,
            importo: valore,
            giorno,
            attiva: true,
            ultimaGenerazione: data.slice(0, 7),
          },
        ],
      }));
    }
    toast.success(ripeti ? "Spesa registrata e resa ricorrente" : "Spesa registrata");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="Chiudi" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] border border-border bg-popover px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aggiungi spesa</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-surface-2 p-2 text-muted-foreground"
            aria-label="Chiudi"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-1 block text-xs text-muted-foreground">Importo</label>
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
          <span className="text-2xl font-semibold text-muted-foreground">€</span>
          <input
            autoFocus
            inputMode="decimal"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
          />
        </div>

        <label className="mb-2 block text-xs text-muted-foreground">Categoria</label>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {state.categorie.map((c) => {
            const Icon = iconFor(c.icona);
            const active = c.id === categoria;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-[10px] leading-tight transition-colors ${
                  active
                    ? "border-primary bg-surface-2 text-foreground"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                >
                  <Icon size={18} />
                </span>
                <span className="line-clamp-2 text-center">{c.nome}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nota</label>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Opzionale"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Ripeti ogni mese</span>
            <button
              type="button"
              onClick={() => setRipeti((v) => !v)}
              aria-pressed={ripeti}
              className={`h-7 w-12 rounded-full p-1 transition-colors ${ripeti ? "lime-fill" : "bg-surface-2"}`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-background transition-transform ${ripeti ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
          {ripeti && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Giorno del mese</span>
              <input
                type="number"
                min={1}
                max={28}
                value={giorno}
                onChange={(e) =>
                  setGiorno(Math.min(28, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-20 rounded-xl border border-border bg-surface-2 px-3 py-2 text-center text-sm outline-none"
              />
            </div>
          )}
        </div>

        <button
          onClick={salva}
          className="lime-fill w-full rounded-2xl py-3.5 text-sm font-semibold"
        >
          Salva spesa
        </button>
      </div>
    </div>
  );
}
