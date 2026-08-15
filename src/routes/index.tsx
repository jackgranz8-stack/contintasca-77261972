import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lightbulb, TrendingUp } from "lucide-react";
import { sum, totalsByCategory, txInMonth, useApp } from "@/lib/store";
import { buildTips, type TipAction } from "@/lib/advice";
import { currentMonth, eur, lastMonths, monthLabel, pct, barTone, uid } from "@/lib/format";
import { iconFor } from "@/lib/icons";
import { ProgressBar } from "@/components/ProgressBar";
import { TrendBars } from "@/components/TrendBars";
import { Donut } from "@/components/Donut";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conti in Tasca — Spese e budget mensile" },
      {
        name: "description",
        content:
          "Registra le spese, controlla il budget di ogni categoria e ricevi consigli intelligenti. Tutto sul tuo telefono, senza account.",
      },
      { property: "og:title", content: "Conti in Tasca — Spese e budget mensile" },
      {
        property: "og:description",
        content: "Spese personali e budget mensile in un'app installabile su iPhone.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { state, update, dismissTip } = useApp();
  const navigate = useNavigate();
  const [mese, setMese] = useState(currentMonth());
  const [catSel, setCatSel] = useState<string | "all">("all");

  const mesi = useMemo(() => lastMonths(6), []);
  const txMese = txInMonth(state.transazioni, mese);
  const txFiltrate = catSel === "all" ? txMese : txMese.filter((t) => t.categoria === catSel);
  const speso = sum(txFiltrate);

  const budgetTotale = state.categorie.reduce((a, c) => a + c.budget, 0);
  const budgetRif =
    catSel === "all" ? budgetTotale : (state.categorie.find((c) => c.id === catSel)?.budget ?? 0);
  const perc = pct(speso, budgetRif);
  const totali = totalsByCategory(txMese);
  const tips = useMemo(() => buildTips(state), [state]);

  const applica = (action: TipAction) => {
    if (action.kind === "setBudget") {
      update((s) => ({
        ...s,
        categorie: s.categorie.map((c) =>
          c.id === action.categoria ? { ...c, budget: action.importo } : c,
        ),
      }));
      toast.success("Budget aggiornato");
    } else if (action.kind === "activateRecurring") {
      update((s) => ({
        ...s,
        ricorrenti: [
          ...s.ricorrenti,
          {
            id: uid(),
            nome: action.nome,
            categoria: action.categoria,
            importo: action.importo,
            giorno: action.giorno,
            attiva: true,
            ultimaGenerazione: currentMonth(),
          },
        ],
      }));
      toast.success("Spesa ricorrente attivata");
    } else {
      navigate({ to: "/budget" });
    }
  };

  const slices = state.categorie
    .map((c) => ({ id: c.id, label: c.nome, value: totali.get(c.id) ?? 0, color: c.colore }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const nome = state.profilo.nome.trim();

  return (
    <div className="space-y-4">
      <header className="mb-1">
        <p className="text-xs text-muted-foreground">
          {nome ? `Ciao ${nome}` : "Bentornato"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Conti in Tasca</h1>
      </header>

      {/* 1. Riepilogo */}
      <section className="card-hero p-5">
        <p className="text-xs text-muted-foreground">
          Speso in {monthLabel(mese)}
          {catSel !== "all" && ` · ${state.categorie.find((c) => c.id === catSel)?.nome}`}
        </p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{eur(speso)}</p>
        <div className="mt-4">
          <ProgressBar value={speso} max={budgetRif} height={12} />
        </div>
        <p className="mt-2.5 text-sm" style={{ color: barTone(perc) }}>
          {budgetRif > 0
            ? speso <= budgetRif
              ? `Ti restano ${eur(budgetRif - speso)} su ${eur(budgetRif)}`
              : `Hai superato il budget di ${eur(speso - budgetRif)} su ${eur(budgetRif)}`
            : "Nessun budget impostato per questa selezione"}
        </p>
      </section>

      {/* 2. Consigli intelligenti */}
      {tips.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Consigli intelligenti</h2>
          </div>
          {tips.map((t) => (
            <article key={t.id} className="card-surface p-4">
              <div className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      t.tono === "danger"
                        ? "var(--danger)"
                        : t.tono === "warn"
                          ? "var(--warn)"
                          : "var(--accent-lime)",
                  }}
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{t.titolo}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.testo}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => applica(t.action)}
                  className="lime-fill flex-1 rounded-xl py-2 text-xs font-semibold"
                >
                  {t.azione}
                </button>
                <button
                  onClick={() => dismissTip(t.id)}
                  className="rounded-xl bg-surface-2 px-4 py-2 text-xs text-muted-foreground"
                >
                  Ignora
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* 3. Andamento nel tempo */}
      <section className="card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Andamento nel tempo</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">ultimi 6 mesi</span>
        </div>
        <TrendBars
          data={mesi.map((m) => ({
            key: m,
            value: sum(
              txInMonth(state.transazioni, m).filter(
                (t) => catSel === "all" || t.categoria === catSel,
              ),
            ),
          }))}
          selected={mese}
          onSelect={setMese}
        />
      </section>

      {/* 4. Ripartizione per categoria */}
      <section className="card-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Ripartizione per categoria</h2>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            onClick={() => setCatSel("all")}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
              catSel === "all"
                ? "border-primary text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            Tutte
          </button>
          {state.categorie.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatSel(catSel === c.id ? "all" : c.id)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
                catSel === c.id ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
        {slices.length > 0 ? (
          <>
            <Donut
              slices={slices}
              total={sum(txMese)}
              selected={catSel === "all" ? null : catSel}
              onSelect={(id) => setCatSel((v) => (v === id ? "all" : id))}
            />
            <ul className="mt-2 space-y-4 border-t border-border pt-4">
              {state.categorie.map((c) => {
                const val = totali.get(c.id) ?? 0;
                const Icon = iconFor(c.icona);
                const attiva = catSel === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCatSel(attiva ? "all" : c.id)}
                      className="w-full text-left"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                        >
                          <Icon size={14} />
                        </span>
                        <span
                          className={`flex-1 text-sm ${attiva ? "font-semibold text-primary" : ""}`}
                        >
                          {c.nome}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {eur(val)} / {eur(c.budget)}
                        </span>
                      </div>
                      <ProgressBar value={val} max={c.budget} height={8} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nessuna spesa in {monthLabel(mese)}
          </p>
        )}
      </section>
    </div>
  );
}

