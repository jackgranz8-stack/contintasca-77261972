import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { sum, totalsByCategory, txInMonth, useApp } from "@/lib/store";
import { eur, formatDay, lastMonths, monthLabel, monthKey } from "@/lib/format";
import { iconFor } from "@/lib/icons";
import { TrendBars } from "@/components/TrendBars";
import { Donut } from "@/components/Donut";
import { exportTransactions } from "@/lib/excel";
import { AddExpenseModal } from "@/components/AddExpenseModal";
import type { Transaction } from "@/lib/types";

export const Route = createFileRoute("/storico")({
  head: () => ({
    meta: [
      { title: "Storico spese — Conti in Tasca" },
      {
        name: "description",
        content:
          "Filtra le tue spese per mese e categoria, controlla i totali ed esporta tutto in Excel.",
      },
      { property: "og:title", content: "Storico spese — Conti in Tasca" },
      {
        property: "og:description",
        content: "Filtra le spese per mese e categoria ed esportale in Excel.",
      },
    ],
  }),
  component: StoricoPage,
});

function StoricoPage() {
  const { state, deleteTransaction } = useApp();
  const [mese, setMese] = useState<string | "all">(monthKey(new Date()));
  const [cat, setCat] = useState<string | "all">("all");
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [daModificare, setDaModificare] = useState<Transaction | null>(null);

  const mesiDisponibili = useMemo(() => {
    const set = new Set(state.transazioni.map((t) => monthKey(t.data)));
    lastMonths(6).forEach((m) => set.add(m));
    return [...set].sort().reverse();
  }, [state.transazioni]);

  const mesiGrafico = useMemo(() => lastMonths(6), []);


  const base = txInMonth(state.transazioni, mese);
  const filtrate = (cat === "all" ? base : base.filter((t) => t.categoria === cat)).sort((a, b) =>
    a.data < b.data ? 1 : -1,
  );
  const totali = totalsByCategory(cat === "all" ? base : base.filter((t) => t.categoria === cat));
  const slices = state.categorie
    .map((c) => ({ id: c.id, label: c.nome, value: totali.get(c.id) ?? 0, color: c.colore }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const esporta = () => {
    const n = exportTransactions(
      filtrate,
      state.categorie,
      `spese-${mese === "all" ? "tutto" : mese}${cat === "all" ? "" : "-" + cat}.xlsx`,
    );
    toast.success(`${n} transazioni esportate`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Storico</h1>

      {/* Grafico a barre: unico pilota del filtro mese */}
      <section className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Andamento nel tempo</h2>
          <button
            onClick={() => setMese("all")}
            className={`ml-auto shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              mese === "all" ? "border-primary text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Tutto
          </button>
        </div>
        <TrendBars
          data={mesiGrafico.map((m) => ({
            key: m,
            value: sum(
              txInMonth(state.transazioni, m).filter((t) => cat === "all" || t.categoria === cat),
            ),
          }))}
          selected={mese === "all" ? undefined : mese}
          onSelect={setMese}
        />
        <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {mesiDisponibili.map((m) => (
            <button
              key={m}
              onClick={() => setMese(m)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs capitalize ${
                mese === m ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </section>

      <section className="card-hero p-5">
        <p className="text-xs text-muted-foreground">
          Totale {mese === "all" ? "di tutti i mesi" : monthLabel(mese)}
          {cat !== "all" && ` · ${state.categorie.find((c) => c.id === cat)?.nome}`}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{eur(sum(filtrate))}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtrate.length} {filtrate.length === 1 ? "transazione" : "transazioni"}
        </p>
      </section>

      {/* Pillole categoria + donut */}
      <section className="card-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Ripartizione per categoria</h2>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            onClick={() => setCat("all")}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
              cat === "all" ? "border-primary text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Tutte
          </button>
          {state.categorie.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(cat === c.id ? "all" : c.id)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
                cat === c.id ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
        {slices.length > 0 ? (
          <Donut
            slices={slices}
            total={sum(filtrate)}
            selected={cat === "all" ? null : cat}
            onSelect={(id) => setCat((v) => (v === id ? "all" : id))}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nessuna spesa con questi filtri
          </p>
        )}
      </section>


      <button
        onClick={esporta}
        disabled={filtrate.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-medium disabled:opacity-40"
      >
        <FileSpreadsheet size={16} className="text-primary" />
        Esporta questo filtro in Excel
      </button>

      <section className="space-y-2">
        {filtrate.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nessuna transazione con questi filtri
          </p>
        )}
        {filtrate.map((t) => {
          const c = state.categorie.find((x) => x.id === t.categoria);
          const Icon = iconFor(c?.icona ?? "wallet");
          return (
            <div key={t.id} className="card-surface flex items-center gap-3 px-4 py-3">
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
                <p className="truncate text-sm">{t.nota || (c?.nome ?? "Spesa")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDay(t.data)} · {c?.nome ?? "Categoria eliminata"}
                </p>
              </div>
              <span className="text-sm font-semibold">{eur(t.importo)}</span>
              <button
                onClick={() => setDaModificare(t)}
                className="p-1.5 text-muted-foreground"
                aria-label="Modifica"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setDaEliminare(t.id)}
                className="p-1.5 text-muted-foreground"
                aria-label="Elimina"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </section>

      <AddExpenseModal
        open={daModificare !== null}
        edit={daModificare}
        onClose={() => setDaModificare(null)}
      />

      {daEliminare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm">
          <div className="card-surface w-full max-w-[340px] p-5">
            <h3 className="text-base font-semibold">Eliminare la transazione?</h3>
            <p className="mt-1 text-xs text-muted-foreground">L&apos;operazione non è annullabile.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDaEliminare(null)}
                className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  deleteTransaction(daEliminare);
                  setDaEliminare(null);
                  toast.success("Transazione eliminata");
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
