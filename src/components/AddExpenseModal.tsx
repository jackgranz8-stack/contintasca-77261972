import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Delete, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { iconFor } from "@/lib/icons";
import { todayISO, uid } from "@/lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"] as const;

function shiftDay(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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

  const premi = (k: string) => {
    setImporto((v) => {
      if (k === "back") return v.slice(0, -1);
      if (k === ",") return v.includes(",") ? v : v === "" ? "0," : `${v},`;
      const [, dec] = v.split(",");
      if (dec !== undefined && dec.length >= 2) return v;
      if (v === "0") return k;
      if (v.replace(",", "").length >= 8) return v;
      return v + k;
    });
  };

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

  const dateChips: { label: string; value: string }[] = [
    { label: "Oggi", value: todayISO() },
    { label: "Ieri", value: shiftDay(-1) },
    { label: "2 gg fa", value: shiftDay(-2) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="Chiudi" onClick={onClose} />
      <div className="relative z-10 max-h-[94vh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border border-border bg-popover px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nuova spesa</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-surface-2 p-2.5 text-muted-foreground"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {/* Importo grande */}
        <div className="mb-4 flex items-baseline justify-center gap-2 rounded-3xl bg-surface px-4 py-6">
          <span className="text-3xl font-semibold text-muted-foreground">€</span>
          <span
            className={`text-[52px] font-semibold leading-none tracking-tight ${
              importo ? "" : "text-muted-foreground"
            }`}
          >
            {importo || "0"}
          </span>
        </div>

        {/* Tastierino */}
        <div className="mb-5 grid grid-cols-3 gap-2.5">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => premi(k)}
              className="flex h-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl font-medium active:scale-95"
              aria-label={k === "back" ? "Cancella" : k}
            >
              {k === "back" ? <Delete size={22} /> : k}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-sm font-medium">Categoria</label>
        <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {state.categorie.map((c) => {
            const Icon = iconFor(c.icona);
            const active = c.id === categoria;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-3 text-sm transition-colors ${
                  active
                    ? "border-primary bg-surface-2 font-semibold text-foreground"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                >
                  <Icon size={17} />
                </span>
                {c.nome}
              </button>
            );
          })}
        </div>

        <label className="mb-2 block text-sm font-medium">Quando</label>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {dateChips.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setData(d.value)}
              className={`rounded-full border px-4 py-2.5 text-sm ${
                data === d.value
                  ? "border-primary bg-surface-2 font-semibold"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none"
          />
        </div>

        <label className="mb-2 block text-sm font-medium">Descrizione</label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Es. spesa supermercato"
          className="mb-4 w-full rounded-2xl border border-border bg-surface px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
        />

        <div className="mb-5 rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ripeti ogni mese</span>
            <button
              type="button"
              onClick={() => setRipeti((v) => !v)}
              aria-pressed={ripeti}
              className={`h-8 w-14 rounded-full p-1 transition-colors ${ripeti ? "lime-fill" : "bg-surface-2"}`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-background transition-transform ${ripeti ? "translate-x-6" : ""}`}
              />
            </button>
          </div>
          {ripeti && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Giorno del mese</span>
              <input
                type="number"
                min={1}
                max={28}
                value={giorno}
                onChange={(e) => setGiorno(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-center text-base outline-none"
              />
            </div>
          )}
        </div>

        <button
          onClick={salva}
          className="lime-fill w-full rounded-2xl py-4 text-base font-semibold active:scale-[0.99]"
        >
          Salva spesa
        </button>
      </div>
    </div>
  );
}
