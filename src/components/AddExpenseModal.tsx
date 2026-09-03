import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Repeat, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { iconFor } from "@/lib/icons";
import { formatDay, todayISO, uid } from "@/lib/format";
import { RecurrenceFields, type RegoleRicorrenza } from "./RecurrenceFields";
import type { Transaction } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { ConfirmPopup } from "./ConfirmPopup";

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
  preset = null,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Transaction | null;
  /** Precompilazione (es. duplica transazione) senza collegarsi a una spesa esistente. */
  preset?: Pick<Transaction, "importo" | "categoria" | "nota"> | null;
}) {
  const { state, addTransaction, updateTransaction, update } = useApp();
  const [importo, setImporto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState(todayISO());
  const [nota, setNota] = useState("");
  const [ripeti, setRipeti] = useState(false);
  const [regole, setRegole] = useState<RegoleRicorrenza>({
    cadenza: "mesi",
    intervallo: 1,
    giorno: 1,
    fine: null,
  });
  const [confermaStop, setConfermaStop] = useState(false);
  const importoRef = useRef<HTMLInputElement | null>(null);
  /*
   * Il fuoco dato dall'app (non dal dito dell'utente) non deve attivare la
   * modalità "sto scrivendo l'importo", che oscura e disattiva il resto del
   * foglio: altrimenti all'apertura categoria e data risulterebbero
   * inutilizzabili finché non si chiude la tastiera. Così invece la tastiera
   * è pronta per scrivere, ma si può anche toccare subito una categoria.
   */
  const fuocoAutomatico = useRef(false);
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
      setRegole(
        linked
          ? {
              cadenza: linked.cadenza,
              intervallo: linked.intervallo,
              giorno: linked.giorno,
              fine: linked.fine ?? null,
            }
          : { cadenza: "mesi", intervallo: 1, giorno: dayOf(edit.data), fine: null },
      );
    } else if (preset) {
      setImporto(String(preset.importo).replace(".", ","));
      setNota(preset.nota ?? "");
      setData(todayISO());
      setCategoria(preset.categoria || state.categorie[0]?.id || "");
      setRipeti(false);
      setRegole({ cadenza: "mesi", intervallo: 1, giorno: dayOf(todayISO()), fine: null });
    } else {
      setImporto("");
      setNota("");
      setData(todayISO());
      setCategoria(state.categorie[0]?.id ?? "");
      setRipeti(false);
      setRegole({ cadenza: "mesi", intervallo: 1, giorno: dayOf(todayISO()), fine: null });
    }
  }, [open, edit, preset, state.categorie, state.ricorrenti]);

  /*
   * Passaggio del fuoco al campo importo, così si può digitare subito.
   *
   * Solo per una spesa NUOVA: quando si modifica una spesa esistente
   * l'importo è già scritto e più spesso si vuole cambiare categoria o data,
   * quindi alzare la tastiera sarebbe d'impiccio.
   *
   * L'attesa serve a dare il tempo al foglio di salire: la tastiera è già
   * aperta grazie al campo preparatore in AppShell, quindi qui si sta solo
   * spostando il fuoco, senza rischio che si chiuda.
   */
  useEffect(() => {
    if (!open || edit) return;
    const timer = window.setTimeout(() => {
      fuocoAutomatico.current = true;
      importoRef.current?.focus({ preventScroll: true });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [open, edit]);

  const valore = Number(importo.replace(",", "."));

  // Categorie ordinate per uso reale: le più usate per prime, quelle mai usate in fondo.
  const usoPerCategoria = new Map<string, number>();
  for (const t of state.transazioni) {
    usoPerCategoria.set(t.categoria, (usoPerCategoria.get(t.categoria) ?? 0) + 1);
  }
  const categorieOrdinate = [...state.categorie].sort(
    (a, b) => (usoPerCategoria.get(b.id) ?? 0) - (usoPerCategoria.get(a.id) ?? 0),
  );

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
            giorno: regole.giorno,
            attiva: true,
            cadenza: regole.cadenza,
            intervallo: regole.intervallo,
            // La spesa che si sta salvando è la prima della serie: da qui
            // partono i conteggi della cadenza, e risulta già registrata.
            inizio: data,
            fine: regole.fine,
            ultimaData: data,
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
            ? {
                ...r,
                categoria,
                importo: valore,
                giorno: regole.giorno,
                cadenza: regole.cadenza,
                intervallo: regole.intervallo,
                fine: regole.fine,
                attiva: true,
              }
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
            giorno: regole.giorno,
            attiva: true,
            cadenza: regole.cadenza,
            intervallo: regole.intervallo,
            // La spesa che si sta salvando è la prima della serie: da qui
            // partono i conteggi della cadenza, e risulta già registrata.
            inizio: data,
            fine: regole.fine,
            ultimaData: data,
          },
        ],
      }));
    }
    toast.success(ripeti ? "Spesa registrata e resa ricorrente" : "Spesa registrata");
    onClose();
  };

  const dateChips: { label: string; value: string }[] = [
    { label: "Ieri", value: shiftDay(-1) },
    { label: "Oggi", value: todayISO() },
    { label: "Domani", value: shiftDay(1) },
  ];

  // Una data futura non entra nello speso del mese: diventa una "spesa
  // prevista". Va detto subito, altrimenti l'utente la cerca nei totali e non
  // la trova, pensando che l'app non l'abbia salvata.
  const isFutura = data > todayISO();

  return (
    <BottomSheet open={open} onClose={onClose}>
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
          ref={importoRef}
          onFocus={(e) => {
            e.target.select();
            if (fuocoAutomatico.current) {
              fuocoAutomatico.current = false;
              return;
            }
            setCampo("importo");
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
          {categorieOrdinate.map((c) => {
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
        {isFutura && (
          <p className="mb-2.5 text-[11px] text-muted-foreground">
            Data futura: sarà una spesa prevista e verrà conteggiata dal {formatDay(data)}.
          </p>
        )}
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
        <span className="flex-1 truncate text-sm">Spesa ricorrente</span>
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

      {/* Le opzioni della ricorrenza si aprono solo quando serve: chi
          registra una spesa singola non le vede nemmeno. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          ripeti ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" aria-hidden={!ripeti}>
          <div className="mb-3 rounded-2xl border border-border bg-surface p-3.5">
            <RecurrenceFields value={regole} onChange={setRegole} />
          </div>
        </div>
      </div>

      <button
        onClick={salva}
        className="lime-fill w-full rounded-2xl py-3.5 text-base font-semibold active:scale-[0.99]"
      >
        {edit ? "Salva modifiche" : "Salva spesa"}
      </button>

      <ConfirmPopup
        open={confermaStop}
        onClose={() => setConfermaStop(false)}
        title="Fermare la ricorrenza?"
        description="Le spese già registrate in passato non vengono toccate: si ferma solo la generazione automatica dei prossimi mesi."
        confirmLabel="Ferma"
        onConfirm={() => {
          setConfermaStop(false);
          salvaEdit(true);
        }}
      />
    </BottomSheet>
  );
}
