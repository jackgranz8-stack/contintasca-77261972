import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lightbulb, Repeat, TrendingUp, X } from "lucide-react";
import { sum, totalsByCategory, txInMonth, useApp } from "@/lib/store";
import {
  previsteByCategoria,
  previsteDelMese,
  sommaPreviste,
  txRealizzate,
} from "@/lib/previsioni";
import { buildTips, type TipAction } from "@/lib/advice";
import {
  currentMonth,
  eur,
  formatDay,
  lastMonths,
  monthLabel,
  pct,
  barTone,
  uid,
  todayISO,
} from "@/lib/format";
import { iconFor } from "@/lib/icons";
import { ProgressBar } from "@/components/ProgressBar";
import { TrendBars } from "@/components/TrendBars";
import { Donut } from "@/components/Donut";
import { SwipeToDelete } from "@/components/SwipeToDelete";

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
        content: "Spese personali e budget mensile in un'app installabile sul tuo telefono.",
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
  const [openSwipeTipId, setOpenSwipeTipId] = useState<string | null>(null);

  const mesi = useMemo(() => lastMonths(6), []);
  const oggi = todayISO();

  // Lo speso conta SOLO le transazioni già realizzate (data <= oggi): quelle
  // con data futura sono "previste" e vivono a parte, per non falsare la
  // risposta a "quanto ho speso davvero questo mese".
  const txMese = txInMonth(state.transazioni, mese);
  const txMeseReali = txRealizzate(txMese, oggi);
  const txFiltrate =
    catSel === "all" ? txMeseReali : txMeseReali.filter((t) => t.categoria === catSel);
  const speso = sum(txFiltrate);

  // Previsto = transazioni future inserite a mano + ricorrenti non ancora
  // scattate (queste ultime non esistono nei dati finché non scattano, quindi
  // vengono proiettate al volo — vedi lib/previsioni.ts).
  const previsteMese = useMemo(() => previsteDelMese(state, mese, oggi), [state, mese, oggi]);
  const previsteFiltrate =
    catSel === "all" ? previsteMese : previsteMese.filter((p) => p.categoria === catSel);
  const previsto = sommaPreviste(previsteFiltrate);
  const previstiPerCat = useMemo(() => previsteByCategoria(previsteMese), [previsteMese]);
  // Con una categoria filtrata il previsto prende il SUO colore: resta
  // riconoscibile come spesa di quella categoria. Senza filtro (più categorie
  // insieme) nessun colore sarebbe corretto, quindi si usa il verde dell'app.
  const catColore =
    catSel === "all" ? undefined : state.categorie.find((c) => c.id === catSel)?.colore;

  const budgetTotale = state.categorie.reduce((a, c) => a + c.budget, 0);
  const budgetRif =
    catSel === "all" ? budgetTotale : (state.categorie.find((c) => c.id === catSel)?.budget ?? 0);
  const perc = pct(speso, budgetRif);
  const totali = totalsByCategory(txMeseReali);
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
            // Suggerimento accettato: si imposta la cadenza classica mensile,
            // che è quella che il consiglio ha rilevato dai movimenti passati.
            cadenza: "mesi",
            intervallo: 1,
            inizio: `${currentMonth()}-${String(action.giorno).padStart(2, "0")}`,
            fine: null,
            ultimaData: `${currentMonth()}-${String(action.giorno).padStart(2, "0")}`,
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
        <p className="text-xs text-muted-foreground">{nome ? `Ciao ${nome}` : "Bentornato"}</p>
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
          <ProgressBar
            value={speso}
            max={budgetRif}
            forecast={previsto}
            forecastColor={catSel === "all" ? undefined : catColore}
            height={12}
          />
        </div>
        <p className="mt-2.5 text-sm" style={{ color: barTone(perc) }}>
          {budgetRif > 0
            ? speso <= budgetRif
              ? `Ti restano ${eur(budgetRif - speso)} su ${eur(budgetRif)}`
              : `Hai superato il budget di ${eur(speso - budgetRif)} su ${eur(budgetRif)}`
            : "Nessun budget impostato per questa selezione"}
        </p>
        {/* Riga leggera, non una card a sé: il previsto va visto, ma non deve
            mettersi in competizione con il numero dello speso reale. */}
        {previsto > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            + {eur(previsto)} previsti{" "}
            {mese === currentMonth() ? "entro fine mese" : `in ${monthLabel(mese)}`}
            {budgetRif > 0 &&
              speso <= budgetRif &&
              speso + previsto > budgetRif &&
              ` · sforerebbero il budget di ${eur(speso + previsto - budgetRif)}`}
          </p>
        )}
      </section>

      {/* 2. Consigli intelligenti */}
      {tips.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Consigli intelligenti</h2>
          </div>
          {tips.map((t) => (
            <SwipeToDelete
              key={t.id}
              id={t.id}
              openId={openSwipeTipId}
              onOpenChange={setOpenSwipeTipId}
              className="card-surface"
              label={`Ignora consiglio: ${t.titolo}`}
              icon={X}
              revealClassName="bg-surface-2 text-muted-foreground"
              onDelete={() => dismissTip(t.id)}
            >
              <article className="p-4">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        t.tono === "danger"
                          ? "var(--danger)"
                          : t.tono === "warn"
                            ? "var(--warn)"
                            : t.tono === "neutral"
                              ? "var(--muted-foreground)"
                              : "var(--accent-lime)",
                    }}
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{t.titolo}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.testo}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {t.action.kind === "ack" ? (
                    <button
                      onClick={() => dismissTip(t.id)}
                      className="w-full rounded-xl bg-surface-2 py-2 text-xs font-semibold"
                    >
                      Ho capito
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </article>
            </SwipeToDelete>
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
          data={mesi.map((m) => {
            const reali = txRealizzate(txInMonth(state.transazioni, m), oggi).filter(
              (t) => catSel === "all" || t.categoria === catSel,
            );
            // Solo il mese in corso ha un "previsto": i mesi passati sono
            // chiusi, non c'è più nulla in arrivo da mostrare.
            const prev =
              m === currentMonth()
                ? sommaPreviste(
                    previsteDelMese(state, m, oggi).filter(
                      (p) => catSel === "all" || p.categoria === catSel,
                    ),
                  )
                : 0;
            return { key: m, value: sum(reali), forecast: prev, forecastColor: catColore };
          })}
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
          {state.categorie.map((c) => {
            const attiva = catSel === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCatSel(catSel === c.id ? "all" : c.id)}
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
        {slices.length > 0 ? (
          <>
            <Donut
              slices={slices}
              // Con una categoria filtrata al centro va il totale DI QUELLA
              // categoria, non quello del mese: se ha solo spese previste il
              // suo speso reale è 0, e 0 è la risposta giusta a "quanto ho
              // speso qui finora".
              total={catSel === "all" ? sum(txMeseReali) : speso}
              centerLabel={
                catSel === "all"
                  ? "Totale"
                  : (state.categorie.find((c) => c.id === catSel)?.nome ?? "Totale")
              }
              selected={catSel === "all" ? null : catSel}
              onSelect={(id) => setCatSel((v) => (v === id ? "all" : id))}
            />
            {catSel === "all" ? (
              <ul className="mt-2 space-y-4 border-t border-border pt-4">
                {state.categorie.map((c) => {
                  const val = totali.get(c.id) ?? 0;
                  const Icon = iconFor(c.icona);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCatSel(c.id)}
                        className="w-full text-left"
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                          >
                            <Icon size={14} />
                          </span>
                          <span className="flex-1 text-sm">{c.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {eur(val)} / {eur(c.budget)}
                          </span>
                        </div>
                        <ProgressBar
                          value={val}
                          max={c.budget}
                          forecast={previstiPerCat.get(c.id) ?? 0}
                          forecastColor={c.colore}
                          height={8}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              (() => {
                const c = state.categorie.find((x) => x.id === catSel);
                if (!c) return null;
                const Icon = iconFor(c.icona);
                const val = totali.get(c.id) ?? 0;
                // Nella lista di dettaglio le previste ci sono, ma marcate: qui
                // serve il quadro completo della categoria, cosa è uscito e cosa
                // sta per uscire. Le più imminenti stanno in cima.
                const txCat = txRealizzate(txMese, oggi)
                  .filter((t) => t.categoria === catSel)
                  .sort((a, b) => (a.data < b.data ? 1 : -1));
                const prevCat = previsteMese.filter((p) => p.categoria === catSel);
                return (
                  <div className="mt-2 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="flex-1 text-sm font-semibold">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {eur(val)} / {eur(c.budget)}
                      </span>
                      <button
                        onClick={() => setCatSel("all")}
                        className="shrink-0 rounded-full bg-surface-2 p-1.5 text-muted-foreground"
                        aria-label="Deseleziona categoria, mostra tutte"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="mt-2.5">
                      <ProgressBar
                        value={val}
                        max={c.budget}
                        forecast={previstiPerCat.get(c.id) ?? 0}
                        forecastColor={c.colore}
                        height={8}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      {prevCat.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                              <span className="truncate">{p.nota || c.nome}</span>
                              {p.fonte === "ricorrente" && (
                                <span
                                  title="Spesa ricorrente non ancora scattata"
                                  aria-label="Spesa ricorrente non ancora scattata"
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                                >
                                  <Repeat size={10} />
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDay(p.data)} · prevista
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-muted-foreground">
                            {eur(p.importo)}
                          </span>
                        </div>
                      ))}
                      {txCat.length === 0 && prevCat.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          Nessuna transazione in {c.nome} in {monthLabel(mese)}
                        </p>
                      ) : (
                        txCat.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{t.nota || c.nome}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDay(t.data)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold">{eur(t.importo)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()
            )}
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
