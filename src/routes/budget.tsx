import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { sum, totalsByCategory, txInMonth, useApp } from "@/lib/store";
import { useScrollLock } from "@/hooks/use-scroll-lock";

import { currentMonth, eur, monthLabel } from "@/lib/format";
import { ICON_KEYS, iconFor } from "@/lib/icons";
import { PALETTE } from "@/lib/types";
import { Donut } from "@/components/Donut";
import { ProgressBar } from "@/components/ProgressBar";
import { EditRecurringModal } from "@/components/EditRecurringModal";



export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget e spese ricorrenti — Conti in Tasca" },
      {
        name: "description",
        content:
          "Imposta il budget di ogni categoria, aggiungi categorie personalizzate e gestisci le spese ricorrenti mensili.",
      },
      { property: "og:title", content: "Budget e spese ricorrenti — Conti in Tasca" },
      {
        property: "og:description",
        content: "Budget per categoria e spese fisse mensili sempre sotto controllo.",
      },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const {
    state,
    updateCategory,
    addCategory,
    deleteCategory,
    addRecurring,
    updateRecurring,
    deleteRecurring,
  } = useApp();

  const [nuovaCat, setNuovaCat] = useState("");
  const [nuovaIcona, setNuovaIcona] = useState("cart");
  const [formRic, setFormRic] = useState(false);
  const [ric, setRic] = useState({
    nome: "",
    categoria: state.categorie[0]?.id ?? "",
    importo: "",
    giorno: 1,
  });

  const [focusCat, setFocusCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [ricEdit, setRicEdit] = useState<string | null>(null);
  const [ricDaEliminare, setRicDaEliminare] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  useScrollLock(editing !== null);
  useScrollLock(ricDaEliminare !== null);



  const totale = state.categorie.reduce((a, c) => a + c.budget, 0);
  const mese = currentMonth();
  const spesiMese = totalsByCategory(txInMonth(state.transazioni, mese));
  const spesoTotale = sum(txInMonth(state.transazioni, mese));
  const slicesBudget = state.categorie
    .map((c) => ({ id: c.id, label: c.nome, value: c.budget, color: c.colore }))
    .filter((s) => s.value > 0);

  const vaiAlCampo = (id: string) => {
    setFocusCat(id);
    const row = document.getElementById(`cat-row-${id}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  };


  const creaCategoria = () => {
    const n = nuovaCat.trim();
    if (!n) return;
    addCategory({
      nome: n,
      icona: nuovaIcona,
      colore: PALETTE[state.categorie.length % PALETTE.length] ?? "#8CE562",
      budget: 0,
    });
    setNuovaCat("");
    toast.success("Categoria aggiunta");
  };

  const creaRicorrente = () => {
    const importo = Number(ric.importo.replace(",", "."));
    if (!ric.nome.trim() || !Number.isFinite(importo) || importo <= 0 || !ric.categoria) {
      toast.error("Compila nome, importo e categoria");
      return;
    }
    addRecurring({
      nome: ric.nome.trim(),
      categoria: ric.categoria,
      importo,
      giorno: Math.min(28, Math.max(1, ric.giorno)),
      attiva: true,
    });
    setRic({ nome: "", categoria: state.categorie[0]?.id ?? "", importo: "", giorno: 1 });
    setFormRic(false);
    toast.success("Spesa ricorrente creata");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>

      <section className="card-hero p-5">
        <p className="text-xs text-muted-foreground">Budget totale mensile</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{eur(totale)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          somma di {state.categorie.length} categorie
        </p>
      </section>

      {slicesBudget.length > 0 && (
        <section className="card-surface p-5">
          <h2 className="text-sm font-semibold">Budget pianificato vs speso</h2>
          <p className="mt-1 text-[11px] capitalize text-muted-foreground">{monthLabel(mese)}</p>
          <Donut
            slices={slicesBudget}
            total={totale}
            selected={focusCat}
            onSelect={vaiAlCampo}
            centerLabel="Pianificato"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Speso questo mese</span>
            <span className="font-semibold">
              {eur(spesoTotale)} / {eur(totale)}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar value={spesoTotale} max={totale} height={8} />
          </div>
        </section>
      )}

      {editing && (
        <button
          type="button"
          aria-label="Conferma importo"
          onClick={() => inputRefs.current[editing]?.blur()}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm"
        />
      )}

      <section className="card-surface divide-y divide-border">
        {state.categorie.map((c) => {
          const Icon = iconFor(c.icona);
          const speso = spesiMese.get(c.id) ?? 0;
          const evidenzia = focusCat === c.id;
          const inModifica = editing === c.id;
          return (
            <div
              id={`cat-row-${c.id}`}
              key={c.id}
              className={`px-4 py-3 transition-colors ${evidenzia ? "bg-surface-2 ring-1 ring-primary/40" : ""} ${
                inModifica ? "relative z-40 rounded-2xl bg-surface-2 ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.nome}</p>
                  <p className="text-[11px] text-muted-foreground">speso {eur(speso)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-xl bg-surface px-2.5 py-1.5">
                  <input
                    ref={(el) => {
                      inputRefs.current[c.id] = el;
                    }}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={c.budget}
                    onFocus={(e) => {
                      setFocusCat(c.id);
                      setEditing(c.id);
                      e.target.select();
                    }}
                    onBlur={() => setEditing((v) => (v === c.id ? null : v))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    onChange={(e) =>
                      updateCategory(c.id, { budget: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-[72px] bg-transparent py-1 text-right text-base font-semibold outline-none"
                  />
                  <span className="text-xs text-muted-foreground">€</span>
                </div>
                <button
                  onClick={() => {
                    if (!deleteCategory(c.id))
                      toast.error("Categoria in uso: non può essere eliminata");
                    else toast.success("Categoria eliminata");
                  }}
                  className="shrink-0 p-1 text-muted-foreground"
                  aria-label={`Elimina ${c.nome}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2">
                <ProgressBar value={speso} max={c.budget} height={6} />
              </div>
            </div>
          );


        })}
      </section>

      <section className="card-surface p-4">
        <p className="mb-2 text-xs text-muted-foreground">Nuova categoria</p>
        <input
          value={nuovaCat}
          onChange={(e) => setNuovaCat(e.target.value)}
          placeholder="Es. Abbonamenti"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {ICON_KEYS.map((k) => {
            const Icon = iconFor(k);
            return (
              <button
                key={k}
                onClick={() => setNuovaIcona(k)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                  nuovaIcona === k
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Icon size={17} />
              </button>
            );
          })}
        </div>
        <button
          onClick={creaCategoria}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-2.5 text-sm font-medium"
        >
          <Plus size={15} /> Aggiungi categoria
        </button>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Spese ricorrenti</h2>
          <button
            onClick={() => setFormRic((v) => !v)}
            className="rounded-full bg-surface-2 px-3 py-1.5 text-xs"
          >
            {formRic ? "Chiudi" : "Aggiungi"}
          </button>
        </div>

        {formRic && (
          <div className="card-surface space-y-3 p-4">
            <input
              value={ric.nome}
              onChange={(e) => setRic({ ...ric, nome: e.target.value })}
              placeholder="Nome (es. Affitto)"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <select
              value={ric.categoria}
              onChange={(e) => setRic({ ...ric, categoria: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none"
            >
              {state.categorie.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={ric.importo}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setRic({ ...ric, importo: e.target.value })}
                placeholder="Importo €"
                className="w-full rounded-xl border border-border bg-surface px-3 py-3.5 text-lg font-semibold outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground"
              />
              <select
                value={ric.giorno}
                onChange={(e) => setRic({ ...ric, giorno: Number(e.target.value) })}
                aria-label="Giorno del mese"
                className="native-select w-full py-3.5"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Giorno {d}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={creaRicorrente}
              className="lime-fill w-full rounded-xl py-2.5 text-sm font-semibold"
            >
              Crea ricorrente
            </button>
          </div>
        )}

        {state.ricorrenti.length === 0 && !formRic && (
          <p className="card-surface p-4 text-center text-xs text-muted-foreground">
            Nessuna spesa ricorrente. Le ricorrenti attive si registrano da sole ogni mese.
          </p>
        )}

        {state.ricorrenti.map((r) => {
          const c = state.categorie.find((x) => x.id === r.categoria);
          const Icon = iconFor(c?.icona ?? "wallet");
          return (
            <div key={r.id} className="card-surface flex items-center gap-3 px-4 py-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${c?.colore ?? "#9AA6A0"}22`,
                  color: c?.colore ?? "#9AA6A0",
                }}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${r.attiva ? "" : "text-muted-foreground"}`}>
                  {r.nome}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {eur(r.importo)} · giorno {r.giorno} · {c?.nome ?? "—"}
                  {r.attiva ? "" : " · in pausa"}
                </p>
              </div>
              <button
                onClick={() => updateRecurring(r.id, { attiva: !r.attiva })}
                className="text-muted-foreground"
                aria-label={r.attiva ? "Metti in pausa" : "Riattiva"}
              >
                {r.attiva ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                onClick={() => setRicEdit(r.id)}
                className="text-muted-foreground"
                aria-label={`Modifica ${r.nome}`}
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setRicDaEliminare(r.id)}
                className="text-muted-foreground"
                aria-label="Elimina"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </section>

      <EditRecurringModal
        open={ricEdit !== null}
        onClose={() => setRicEdit(null)}
        edit={state.ricorrenti.find((r) => r.id === ricEdit) ?? null}
      />

      {ricDaEliminare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-background/70 px-6 backdrop-blur-sm">
          <button
            className="absolute inset-0"
            aria-label="Annulla"
            onClick={() => setRicDaEliminare(null)}
          />
          <div className="relative z-10 w-full max-w-[340px] rounded-3xl border border-border bg-popover p-5">
            <p className="text-sm font-semibold">Eliminare questa spesa ricorrente?</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Le transazioni già generate in passato non verranno toccate: si ferma solo la
              generazione futura.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRicDaEliminare(null)}
                className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  deleteRecurring(ricDaEliminare);
                  setRicDaEliminare(null);
                  toast.success("Ricorrente eliminata");
                }}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
