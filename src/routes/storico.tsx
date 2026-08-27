import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Calendar, ChevronDown, Copy, FileSpreadsheet, Pencil, Repeat, Search } from "lucide-react";
import { sum, txInMonth, useApp } from "@/lib/store";
import { SwipeToDelete } from "@/components/SwipeToDelete";

import {
  eur,
  formatDay,
  lastMonths,
  monthLabel,
  monthChipLabel,
  monthKey,
  todayISO,
} from "@/lib/format";
import { iconFor } from "@/lib/icons";
import { TrendBars } from "@/components/TrendBars";
import { exportTransactions } from "@/lib/excel";
import { AddExpenseModal } from "@/components/AddExpenseModal";
import { ConfirmPopup } from "@/components/ConfirmPopup";
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

function chipClass(active: boolean) {
  return `shrink-0 rounded-full border px-3.5 py-2 text-xs ${
    active ? "border-primary text-primary" : "border-border text-muted-foreground"
  }`;
}

function StoricoPage() {
  const { state, deleteTransaction } = useApp();
  const [meseSel, setMeseSel] = useState<Set<string>>(() => new Set([monthKey(new Date())]));
  const [catSel, setCatSel] = useState<Set<string>>(new Set());
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [confermaExport, setConfermaExport] = useState(false);
  const [periodoAperto, setPeriodoAperto] = useState(false);
  const [periodoRange, setPeriodoRange] = useState<{ da: string; a: string } | null>(null);
  const [periodoDa, setPeriodoDa] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [periodoA, setPeriodoA] = useState(() => todayISO());

  const [daModificare, setDaModificare] = useState<Transaction | null>(null);
  const [daDuplicare, setDaDuplicare] = useState<Pick<
    Transaction,
    "importo" | "categoria" | "nota"
  > | null>(null);
  const [ricerca, setRicerca] = useState("");

  // Chip sempre visibili: solo gli ultimi 12 mesi, dal più recente al meno
  // recente, per non allungarsi all'infinito con l'uso nel tempo. Per periodi
  // più lontani o precisi al giorno c'è il selettore "Periodo" sotto.
  const mesiDisponibili = useMemo(() => [...lastMonths(12)].reverse(), []);

  const applicaPeriodo = () => {
    const [da, a] = periodoDa <= periodoA ? [periodoDa, periodoA] : [periodoA, periodoDa];
    setPeriodoRange({ da, a });
    setMeseSel(new Set());
    setPeriodoAperto(false);
  };

  const mesiGrafico = useMemo(() => lastMonths(6), []);

  const toggleMese = (m: string) => {
    setPeriodoRange(null);
    setMeseSel((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const toggleCat = (id: string) =>
    setCatSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const base = periodoRange
    ? state.transazioni.filter((t) => t.data >= periodoRange.da && t.data <= periodoRange.a)
    : meseSel.size === 0
      ? state.transazioni
      : state.transazioni.filter((t) => meseSel.has(monthKey(t.data)));
  const q = ricerca.trim().toLowerCase();
  const scoped = catSel.size === 0 ? base : base.filter((t) => catSel.has(t.categoria));
  const filtrate = scoped
    .filter((t) => (q ? (t.nota ?? "").toLowerCase().includes(q) : true))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const meseArr = [...meseSel].sort();
  const catArr = [...catSel];
  const meseLabel = periodoRange
    ? `dal ${formatDay(periodoRange.da)} al ${formatDay(periodoRange.a)}`
    : meseSel.size === 0
      ? "di tutti i mesi"
      : meseSel.size === 1
        ? monthLabel(meseArr[0] ?? "")
        : `di ${meseSel.size} mesi selezionati`;
  const catLabel =
    catSel.size === 0
      ? ""
      : catSel.size === 1
        ? ` · ${state.categorie.find((c) => c.id === catArr[0])?.nome ?? ""}`
        : ` · ${catSel.size} categorie selezionate`;

  const esporta = () => {
    const nomeMese = periodoRange
      ? `${periodoRange.da}_${periodoRange.a}`
      : meseSel.size === 0
        ? "tutto"
        : meseSel.size === 1
          ? meseArr[0]
          : "multi-mese";
    const nomeCat = catSel.size === 1 ? "-" + catArr[0] : catSel.size > 1 ? "-multi-categoria" : "";
    const n = exportTransactions(filtrate, state.categorie, `spese-${nomeMese}${nomeCat}.xlsx`);
    toast.success(`${n} transazioni esportate`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Storico</h1>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <Search size={16} className="shrink-0 text-muted-foreground" />
        <input
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca nella descrizione"
          aria-label="Cerca nelle note"
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Filtri rapidi: mese e categoria, selezionabili insieme per filtri personalizzati */}
      <div className="space-y-2">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <button
            onClick={() => setPeriodoAperto((v) => !v)}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-2 text-xs ${
              periodoAperto || periodoRange
                ? "border-primary text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            <Calendar size={13} /> Periodo
          </button>
          {mesiDisponibili.map((m) => (
            <button key={m} onClick={() => toggleMese(m)} className={chipClass(meseSel.has(m))}>
              {monthChipLabel(m)}
            </button>
          ))}
        </div>

        {/* Periodo personalizzato: raggiunge qualsiasi giorno, anche lontano nel
            tempo, con i selettori nativi giorno/mese/anno (rendono bene sia su
            iPhone che su Android, ognuno con la propria interfaccia di sistema). */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            periodoAperto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="card-surface mt-1 flex flex-wrap items-center gap-2 p-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="date"
                  value={periodoDa}
                  onChange={(e) => setPeriodoDa(e.target.value)}
                  aria-label="Da"
                  className="native-select min-w-0 flex-1 text-xs"
                />
                <span className="shrink-0 text-xs text-muted-foreground">–</span>
                <input
                  type="date"
                  value={periodoA}
                  onChange={(e) => setPeriodoA(e.target.value)}
                  aria-label="A"
                  className="native-select min-w-0 flex-1 text-xs"
                />
              </div>
              <button
                onClick={applicaPeriodo}
                className="lime-fill shrink-0 rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Applica
              </button>
            </div>
          </div>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          <button onClick={() => setCatSel(new Set())} className={chipClass(catSel.size === 0)}>
            Tutte le categorie
          </button>
          {state.categorie.map((c) => {
            const attiva = catSel.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCat(c.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
                  attiva ? "font-medium" : "border-border text-muted-foreground"
                }`}
                style={
                  attiva
                    ? { borderColor: c.colore, color: c.colore, backgroundColor: `${c.colore}15` }
                    : undefined
                }
              >
                {c.nome}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grafico a barre: seleziona/deseleziona un mese toccando una barra.
          Con filtro categoria attivo, ogni barra si colora in proporzione
          al colore di ciascuna categoria filtrata; senza filtro resta verde. */}
      <section className="card-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Andamento nel tempo</h2>
        <TrendBars
          data={mesiGrafico.map((m) => {
            const txMese = txInMonth(state.transazioni, m);
            if (catSel.size === 0) {
              return { key: m, value: sum(txMese) };
            }
            const categorieSelezionate = state.categorie.filter((c) => catSel.has(c.id));
            const segments = categorieSelezionate
              .map((c) => ({
                color: c.colore,
                value: sum(txMese.filter((t) => t.categoria === c.id)),
              }))
              .filter((s) => s.value > 0);
            return {
              key: m,
              value: sum(txMese.filter((t) => catSel.has(t.categoria))),
              segments,
            };
          })}
          selected={meseArr}
          onSelect={toggleMese}
        />
      </section>

      <section className="card-hero p-5">
        <p className="text-xs text-muted-foreground">
          Totale {meseLabel}
          {catLabel}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{eur(sum(filtrate))}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtrate.length} {filtrate.length === 1 ? "transazione" : "transazioni"}
        </p>
      </section>

      {/* Al posto del donut: una nuvola sottile per l'export, con conferma prima di esportare */}
      <div className="flex justify-start">
        <button
          onClick={() => setConfermaExport(true)}
          disabled={filtrate.length === 0}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-40"
        >
          <FileSpreadsheet size={13} className="text-primary" />
          Esporta in Excel
        </button>
      </div>

      <section className="space-y-2">
        {filtrate.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {q ? "Nessuna transazione trovata" : "Nessuna transazione con questi filtri"}
          </p>
        )}
        {filtrate.map((t) => {
          const c = state.categorie.find((x) => x.id === t.categoria);
          const Icon = iconFor(c?.icona ?? "wallet");
          return (
            <SwipeToDelete
              key={t.id}
              id={t.id}
              openId={openSwipeId}
              onOpenChange={setOpenSwipeId}
              className="card-surface"
              label={`Elimina ${t.nota || c?.nome || "transazione"}`}
              onDelete={() => setDaEliminare(t.id)}
            >
              <div className="flex items-center gap-3 px-4 py-3">
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
                  <p className="flex items-center gap-1.5 truncate text-sm">
                    <span className="truncate">{t.nota || (c?.nome ?? "Spesa")}</span>
                    {t.ricorrenteId && (
                      <span
                        title="Generata da una spesa ricorrente"
                        aria-label="Generata da una spesa ricorrente"
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                      >
                        <Repeat size={10} />
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDay(t.data)} · {c?.nome ?? "Categoria eliminata"}
                  </p>
                </div>
                <span className="text-sm font-semibold">{eur(t.importo)}</span>
                <button
                  onClick={() =>
                    setDaDuplicare({ importo: t.importo, categoria: t.categoria, nota: t.nota })
                  }
                  className="p-1.5 text-muted-foreground"
                  aria-label="Duplica"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => setDaModificare(t)}
                  className="p-1.5 text-muted-foreground"
                  aria-label="Modifica"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </SwipeToDelete>
          );
        })}
      </section>

      <AddExpenseModal
        open={daModificare !== null}
        edit={daModificare}
        onClose={() => setDaModificare(null)}
      />

      <AddExpenseModal
        open={daDuplicare !== null}
        preset={daDuplicare}
        onClose={() => setDaDuplicare(null)}
      />

      <ConfirmPopup
        open={confermaExport}
        onClose={() => setConfermaExport(false)}
        title="Esportare questo filtro in Excel?"
        description="Verranno esportate solo le transazioni che rispettano i filtri attualmente selezionati."
        confirmLabel="Esporta"
        onConfirm={() => {
          setConfermaExport(false);
          esporta();
        }}
      />

      <ConfirmPopup
        open={daEliminare !== null}
        onClose={() => setDaEliminare(null)}
        title="Eliminare la transazione?"
        description="L'operazione non è annullabile."
        confirmLabel="Elimina"
        onConfirm={() => {
          if (!daEliminare) return;
          deleteTransaction(daEliminare);
          setDaEliminare(null);
          toast.success("Transazione eliminata");
        }}
      />
    </div>
  );
}
