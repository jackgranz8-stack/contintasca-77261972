import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Repeat, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { iconFor } from "@/lib/icons";
import { todayISO, uid } from "@/lib/format";
import type { Transaction } from "@/lib/types";


function shiftDay(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOf(iso: string) {
  const n = Number(iso.slice(8, 10));
  return Math.min(28, Math.max(1, Number.isFinite(n) && n > 0 ? n : 1));
}

export function AddExpenseModal({
  open,
  onClose,
  edit = null,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Transaction | null;
}) {
  const { state, addTransaction, updateTransaction, update } = useApp();
  const [importo, setImporto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState(todayISO());
  const [nota, setNota] = useState("");
  const [ripeti, setRipeti] = useState(false);
  const [giorno, setGiorno] = useState(1);
  const [confermaStop, setConfermaStop] = useState(false);
  const [campo, setCampo] = useState<"importo" | "nota" | null>(null);


  const regola = edit?.ricorrenteId
    ? state.ricorrenti.find((r) => r.id === edit.ricorrenteId)
    : undefined;
  const avevaRicorrenza = Boolean(regola && regola.attiva);

  useEffect(() => {
    if (!open) return;
    setConfermaStop(false);
    setCampo(null);

    if (edit) {
      setImporto(String(edit.importo).replace(".", ","));
      setNota(edit.nota ?? "");
      setData(edit.data);
      setCategoria(edit.categoria);
      const linked = edit.ricorrenteId
        ? state.ricorrenti.find((r) => r.id === edit.ricorrenteId)
        : undefined;
      setRipeti(Boolean(linked && linked.attiva));
      setGiorno(linked ? linked.giorno : dayOf(edit.data));
    } else {
      setImporto("");
      setNota("");
      setData(todayISO());
      setCategoria(state.categorie[0]?.id ?? "");
      setRipeti(false);
      setGiorno(Math.min(28, new Date().getDate()));
    }
  }, [open, edit, state.categorie, state.ricorrenti]);

  useScrollLock(open);

  if (!open) return null;

  const valore = Number(importo.replace(",", "."));


  const nomeRegola = () =>
    nota.trim() || state.categorie.find((c) => c.id === categoria)?.nome || "Spesa";

  const salvaEdit = (stopRicorrenza: boolean) => {
    if (!edit) return;
    const patch: Partial<Omit<Transaction, "id">> = {
      importo: valore,
      categoria,
      data,
      nota: nota.trim(),
    };
    if (ripeti && !avevaRicorrenza) {
      const nuovoId = uid();
      update((s) => ({
        ...s,
        ricorrenti: [
          ...s.ricorrenti.filter((r) => r.id !== edit.ricorrenteId),
          {
            id: nuovoId,
            nome: nomeRegola(),
            categoria,
            importo: valore,
            giorno,
            attiva: true,
            ultimaGenerazione: data.slice(0, 7),
          },
        ],
        transazioni: s.transazioni.map((t) =>
          t.id === edit.id ? { ...t, ...patch, ricorrenteId: nuovoId } : t,
        ),
      }));
      toast.success("Spesa aggiornata e resa ricorrente");
      onClose();
      return;
    }
    if (!ripeti && avevaRicorrenza && stopRicorrenza) {
      update((s) => ({
        ...s,
        ricorrenti: s.ricorrenti.map((r) =>
          r.id === edit.ricorrenteId ? { ...r, attiva: false } : r,
        ),
        transazioni: s.transazioni.map((t) => (t.id === edit.id ? { ...t, ...patch } : t)),
      }));
      toast.success("Ricorrenza disattivata");
      onClose();
      return;
    }
    if (ripeti && avevaRicorrenza) {
      update((s) => ({
        ...s,
        ricorrenti: s.ricorrenti.map((r) =>
          r.id === edit.ricorrenteId
            ? { ...r, categoria, importo: valore, giorno, attiva: true }
            : r,
        ),
        transazioni: s.transazioni.map((t) => (t.id === edit.id ? { ...t, ...patch } : t)),
      }));
      toast.success("Spesa aggiornata");
      onClose();
      return;
    }
    updateTransaction(edit.id, patch);
    toast.success("Spesa aggiornata");
    onClose();
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
    if (edit) {
      if (!ripeti && avevaRicorrenza) {
        setConfermaStop(true);
        return;
      }
      salvaEdit(false);
      return;
    }
    addTransaction({ importo: valore, categoria, data, nota: nota.trim() });
    if (ripeti) {
      update((s) => ({
        ...s,
        ricorrenti: [
          ...s.ricorrenti,
          {
            id: uid(),
            nome: nomeRegola(),
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
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-background/70 backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="Chiudi" onClick={onClose} />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-popover px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">{edit ? "Modifica spesa" : "Nuova spesa"}</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-surface-2 p-2 text-muted-foreground"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {/* Importo in evidenza — solo tastiera nativa iOS */}
        <div
          className={`mb-3 flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-5 transition-opacity ${
            campo === "importo" ? "ring-2 ring-primary" : ""
          } ${campo === "nota" ? "pointer-events-none opacity-40" : ""}`}
        >
          <span className="text-2xl font-semibold text-muted-foreground">€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={importo.replace(",", ".")}
            onFocus={(e) => {
              setCampo("importo");
              e.target.select();
            }}
            onBlur={() => setCampo((v) => (v === "importo" ? null : v))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onChange={(e) => setImporto(e.target.value.replace(".", ","))}
            placeholder="0"
            aria-label="Importo"
            className="w-full min-w-0 bg-transparent text-center text-[42px] font-semibold leading-tight tracking-tight outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className={campo ? "pointer-events-none opacity-40" : ""}>
          {/* Categorie: riga orizzontale di icone */}
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

          {/* Data */}
          <div className="no-scrollbar -mx-4 mb-2.5 flex items-center gap-2 overflow-x-auto px-4">
            {dateChips.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setData(d.value)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
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
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 text-xs outline-none"
            />
          </div>
        </div>

        <input
          value={nota}
          onFocus={() => setCampo("nota")}
          onBlur={() => setCampo((v) => (v === "nota" ? null : v))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Descrizione (opzionale)"
          className={`mb-2.5 w-full rounded-2xl border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted-foreground ${
            campo === "nota" ? "border-primary ring-2 ring-primary" : "border-border"
          } ${campo === "importo" ? "pointer-events-none opacity-40" : ""}`}
        />

        {/* Toggle ricorrenza compatto */}
        <div
          className={`mb-3 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5 ${
            campo ? "pointer-events-none opacity-40" : ""
          }`}
        >

          <Repeat size={15} className="shrink-0 text-primary" />
          <span className="flex-1 truncate text-sm">Ripeti ogni mese</span>
          {ripeti && (
            <select
              value={giorno}
              onChange={(e) => setGiorno(Number(e.target.value))}
              aria-label="Giorno del mese"
              className="native-select w-20 shrink-0"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setRipeti((v) => !v)}
            aria-pressed={ripeti}
            aria-label="Ripeti ogni mese"
            className={`h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${ripeti ? "lime-fill" : "bg-surface-2"}`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-background transition-transform ${ripeti ? "translate-x-5" : ""}`}
            />
          </button>
        </div>

        <button
          onClick={salva}
          className="lime-fill w-full rounded-2xl py-3.5 text-base font-semibold active:scale-[0.99]"
        >
          {edit ? "Salva modifiche" : "Salva spesa"}
        </button>

        {confermaStop && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm">
            <div className="card-surface w-full max-w-[340px] p-5">
              <h3 className="text-base font-semibold">Fermare la ricorrenza?</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Le spese già registrate in passato non vengono toccate: si ferma solo la
                generazione automatica dei prossimi mesi.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setConfermaStop(false)}
                  className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    setConfermaStop(false);
                    salvaEdit(true);
                  }}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
                >
                  Ferma
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
