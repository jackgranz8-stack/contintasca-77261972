import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { sum, totalsByCategory, txInMonth, useApp } from "@/lib/store";
import { currentMonth, eur, monthLabel } from "@/lib/format";
import { ICON_KEYS, iconFor } from "@/lib/icons";
import { PALETTE } from "@/lib/types";
import { Donut } from "@/components/Donut";
import { ProgressBar } from "@/components/ProgressBar";


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

  const totale = state.categorie.reduce((a, c) => a + c.budget, 0);

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

      <section className="card-surface divide-y divide-border">
        {state.categorie.map((c) => {
          const Icon = iconFor(c.icona);
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
              >
                <Icon size={16} />
              </span>
              <span className="flex-1 truncate text-sm">{c.nome}</span>
              <div className="flex items-center gap-1 rounded-xl bg-surface px-3 py-1.5">
                <input
                  inputMode="decimal"
                  value={c.budget}
                  onChange={(e) =>
                    updateCategory(c.id, { budget: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-16 bg-transparent text-right text-sm font-semibold outline-none"
                />
                <span className="text-xs text-muted-foreground">€</span>
              </div>
              <button
                onClick={() => {
                  if (!deleteCategory(c.id))
                    toast.error("Categoria in uso: non può essere eliminata");
                  else toast.success("Categoria eliminata");
                }}
                className="text-muted-foreground"
                aria-label={`Elimina ${c.nome}`}
              >
                <Trash2 size={16} />
              </button>
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
                inputMode="decimal"
                value={ric.importo}
                onChange={(e) => setRic({ ...ric, importo: e.target.value })}
                placeholder="Importo €"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <input
                type="number"
                min={1}
                max={28}
                value={ric.giorno}
                onChange={(e) =>
                  setRic({ ...ric, giorno: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })
                }
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none"
              />
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
                onClick={() => {
                  deleteRecurring(r.id);
                  toast.success("Ricorrente eliminata");
                }}
                className="text-muted-foreground"
                aria-label="Elimina"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
