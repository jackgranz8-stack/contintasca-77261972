import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ChevronDown, Pause, Pencil, Play, Plus, Repeat } from "lucide-react";
import { sum, totalsByCategory, txInMonth, useApp } from "@/lib/store";
import { useScrollLock } from "@/hooks/use-scroll-lock";

import { currentMonth, eur, formatDay, monthLabel, todayISO } from "@/lib/format";
import { ICON_KEYS, iconFor } from "@/lib/icons";
import { CATEGORY_COLORS, PALETTE, type Category } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { RecurrenceFields, type RegoleRicorrenza } from "@/components/RecurrenceFields";
import { etichettaCadenza } from "@/lib/ricorrenze";
import {
  previsteByCategoria,
  previsteDelMese,
  sommaPreviste,
  txRealizzate,
} from "@/lib/previsioni";
import { EditRecurringModal } from "@/components/EditRecurringModal";
import { EditCategoryModal } from "@/components/EditCategoryModal";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { ConfirmPopup } from "@/components/ConfirmPopup";

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
  const { state, addCategory, deleteCategory, addRecurring, updateRecurring, deleteRecurring } =
    useApp();

  const [formCat, setFormCat] = useState(false);
  const [nuovaCat, setNuovaCat] = useState("");
  const [nuovaIcona, setNuovaIcona] = useState("cart");
  const [nuovaColore, setNuovaColore] = useState<string | null>(null);
  const [catEdit, setCatEdit] = useState<string | null>(null);
  const [formRic, setFormRic] = useState(false);
  const [ric, setRic] = useState({
    nome: "",
    categoria: state.categorie[0]?.id ?? "",
    importo: "",
  });
  const [regoleRic, setRegoleRic] = useState<RegoleRicorrenza>({
    cadenza: "mesi",
    intervallo: 1,
    giorno: 1,
    fine: null,
  });
  const [ricorrentiAperte, setRicorrentiAperte] = useState(false);

  const [editingNomeCat, setEditingNomeCat] = useState(false);
  const [ricEdit, setRicEdit] = useState<string | null>(null);
  const [ricDaEliminare, setRicDaEliminare] = useState<string | null>(null);
  const [openSwipeCatId, setOpenSwipeCatId] = useState<string | null>(null);
  const [openSwipeRicId, setOpenSwipeRicId] = useState<string | null>(null);
  const nomeCatRef = useRef<HTMLInputElement | null>(null);
  useScrollLock(editingNomeCat);

  const totale = state.categorie.reduce((a, c) => a + c.budget, 0);
  const mese = currentMonth();
  // Speso = solo transazioni già realizzate. Le date future e le ricorrenti
  // non ancora scattate sono "previste" e restano fuori dai totali.
  const txMeseReali = txRealizzate(txInMonth(state.transazioni, mese));
  const spesiMese = totalsByCategory(txMeseReali);
  const spesoTotale = sum(txMeseReali);
  const previsteMese = previsteDelMese(state, mese);
  const previstiPerCat = previsteByCategoria(previsteMese);
  const previstoTotale = sommaPreviste(previsteMese);
  // Peso mensile indicativo delle ricorrenti attive. Le cadenze settimanali
  // vengono riportate su base mensile (52 settimane / 12 mesi ≈ 4,33 volte al
  // mese) per poter sommare mele con mele: è una stima, ed è per questo che
  // l'etichetta dice "circa".
  const pesoMensileRicorrenti = state.ricorrenti
    .filter((r) => r.attiva)
    .reduce((tot, r) => {
      const n = Math.max(1, r.intervallo || 1);
      return tot + (r.cadenza === "settimane" ? (r.importo * (52 / 12)) / n : r.importo / n);
    }, 0);

  const creaCategoria = () => {
    const n = nuovaCat.trim();
    if (!n) return;
    addCategory({
      nome: n,
      icona: nuovaIcona,
      colore: nuovaColore ?? PALETTE[state.categorie.length % PALETTE.length] ?? "#8CE562",
      budget: 0,
    });
    setNuovaCat("");
    setNuovaIcona("cart");
    setNuovaColore(null);
    setFormCat(false);
    setEditingNomeCat(false);
    toast.success("Categoria aggiunta");
  };

  const creaRicorrente = () => {
    const importo = Number(ric.importo.replace(",", "."));
    if (!ric.nome.trim() || !Number.isFinite(importo) || importo <= 0 || !ric.categoria) {
      toast.error("Compila nome, importo e categoria");
      return;
    }
    const giorno = Math.min(28, Math.max(1, regoleRic.giorno));
    addRecurring({
      nome: ric.nome.trim(),
      categoria: ric.categoria,
      importo,
      giorno,
      attiva: true,
      cadenza: regoleRic.cadenza,
      intervallo: regoleRic.intervallo,
      // La serie parte da oggi: le occorrenze passate non vengono inventate.
      inizio: todayISO(),
      fine: regoleRic.fine,
    });
    setRic({ nome: "", categoria: state.categorie[0]?.id ?? "", importo: "" });
    setRegoleRic({ cadenza: "mesi", intervallo: 1, giorno: 1, fine: null });
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

      {totale > 0 && (
        <section className="card-surface p-5">
          <h2 className="text-sm font-semibold">Budget pianificato vs speso</h2>
          <p className="mt-1 text-[11px] capitalize text-muted-foreground">{monthLabel(mese)}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Speso questo mese</span>
            <span className="font-semibold">
              {eur(spesoTotale)} / {eur(totale)}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar value={spesoTotale} max={totale} forecast={previstoTotale} height={8} />
          </div>
          {previstoTotale > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              + {eur(previstoTotale)} previsti entro fine mese
              {spesoTotale <= totale &&
                spesoTotale + previstoTotale > totale &&
                ` · sforerebbero di ${eur(spesoTotale + previstoTotale - totale)}`}
            </p>
          )}
        </section>
      )}

      {editingNomeCat && (
        <button
          type="button"
          aria-label="Conferma nome categoria"
          onClick={() => nomeCatRef.current?.blur()}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm"
        />
      )}

      <div className="space-y-2">
        {state.categorie.map((c) => {
          const Icon = iconFor(c.icona);
          const speso = spesiMese.get(c.id) ?? 0;
          return (
            <SwipeToDelete
              key={c.id}
              id={c.id}
              openId={openSwipeCatId}
              onOpenChange={setOpenSwipeCatId}
              label={`Elimina ${c.nome}`}
              onDelete={() => {
                if (!deleteCategory(c.id))
                  toast.error("Categoria in uso: non può essere eliminata");
                else toast.success("Categoria eliminata");
              }}
              className="card-surface transition-colors"
            >
              <div id={`cat-row-${c.id}`} className="px-4 py-3">
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
                  <span className="shrink-0 rounded-xl bg-surface px-2.5 py-1.5 text-base font-semibold">
                    {eur(c.budget)}
                  </span>
                  <button
                    onClick={() => setCatEdit(c.id)}
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Modifica ${c.nome}`}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={speso}
                    max={c.budget}
                    forecast={previstiPerCat.get(c.id) ?? 0}
                    forecastColor={c.colore}
                    height={6}
                  />
                </div>
              </div>
            </SwipeToDelete>
          );
        })}
      </div>

      <section className={`card-surface overflow-hidden ${editingNomeCat ? "relative z-40" : ""}`}>
        <button
          type="button"
          onClick={() => setFormCat((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-medium"
          aria-expanded={formCat}
        >
          <span className="flex items-center gap-2">
            <Plus size={15} /> Aggiungi Categoria
          </span>
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform ${formCat ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            formCat ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden" aria-hidden={!formCat}>
            <div className="border-t border-border p-4 pt-3.5">
              <input
                ref={nomeCatRef}
                value={nuovaCat}
                onChange={(e) => setNuovaCat(e.target.value)}
                onFocus={() => setEditingNomeCat(true)}
                onBlur={() => setEditingNomeCat(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="Es. Abbonamenti"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />

              <p className="mb-2 mt-3 text-xs text-muted-foreground">Icona</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {ICON_KEYS.map((k) => {
                  const Icon = iconFor(k);
                  return (
                    <button
                      key={k}
                      type="button"
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

              <p className="mb-2 mt-3 text-xs text-muted-foreground">Colore</p>
              <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8">
                {CATEGORY_COLORS.map((col) => {
                  const attivo =
                    nuovaColore === col ||
                    (!nuovaColore &&
                      col === (PALETTE[state.categorie.length % PALETTE.length] ?? "#8CE562"));
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNuovaColore(col)}
                      className="flex h-10 w-10 items-center justify-center rounded-full transition-transform"
                      style={{
                        backgroundColor: col,
                        boxShadow: attivo
                          ? `0 0 0 2px var(--surface), 0 0 0 4px ${col}`
                          : undefined,
                        transform: attivo ? "scale(1.08)" : undefined,
                      }}
                      aria-label={`Colore ${col}`}
                    >
                      {attivo && <Check size={16} color="#fff" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={creaCategoria}
                className="lime-fill mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
              >
                <Plus size={15} /> Aggiungi categoria
              </button>
            </div>
          </div>
        </div>
      </section>

      <EditCategoryModal
        open={catEdit !== null}
        onClose={() => setCatEdit(null)}
        edit={state.categorie.find((c) => c.id === catEdit) ?? null}
      />

      {/* Spese ricorrenti come tendina, stesso schema di "Prossime spese"
          nello Storico: chiusa mostra quante sono e quanto pesano al mese,
          aperta si gestiscono. Così la pagina Budget si apre compatta invece
          di srotolare subito l'elenco intero. */}
      <section className="card-surface overflow-hidden">
        <button
          onClick={() => setRicorrentiAperte((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          aria-expanded={ricorrentiAperte}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Repeat size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              Spese ricorrenti ({state.ricorrenti.length})
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {state.ricorrenti.length === 0
                ? "Nessuna ancora impostata"
                : `${eur(pesoMensileRicorrenti)} al mese circa`}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted-foreground transition-transform duration-300 ${
              ricorrentiAperte ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            ricorrentiAperte ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-2 px-4 pb-4">
              <button
                onClick={() => setFormRic((v) => !v)}
                className="w-full rounded-xl bg-surface-2 px-3 py-2 text-xs"
              >
                {formRic ? "Chiudi" : "+ Aggiungi spesa ricorrente"}
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  formRic ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden" aria-hidden={!formRic}>
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
                    <div>
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
                    </div>
                    <RecurrenceFields value={regoleRic} onChange={setRegoleRic} />
                    <button
                      onClick={creaRicorrente}
                      className="lime-fill w-full rounded-xl py-2.5 text-sm font-semibold"
                    >
                      Crea ricorrente
                    </button>
                  </div>
                </div>
              </div>

              {state.ricorrenti.length === 0 && !formRic && (
                <p className="card-surface p-4 text-center text-xs text-muted-foreground">
                  Nessuna spesa ricorrente. Le ricorrenti attive si registrano da sole ogni mese.
                </p>
              )}

              {state.ricorrenti.map((r) => {
                const c = state.categorie.find((x) => x.id === r.categoria);
                const Icon = iconFor(c?.icona ?? "wallet");
                return (
                  <SwipeToDelete
                    key={r.id}
                    id={r.id}
                    openId={openSwipeRicId}
                    onOpenChange={setOpenSwipeRicId}
                    className="card-surface"
                    label={`Elimina ${r.nome}`}
                    onDelete={() => setRicDaEliminare(r.id)}
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
                        <p
                          className={`truncate text-sm ${r.attiva ? "" : "text-muted-foreground"}`}
                        >
                          {r.nome}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {eur(r.importo)} · {etichettaCadenza(r).toLowerCase()}
                          {r.cadenza === "mesi" ? ` il ${r.giorno}` : ""} · {c?.nome ?? "—"}
                          {r.fine ? ` · fino al ${formatDay(r.fine)}` : ""}
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
                    </div>
                  </SwipeToDelete>
                );
              })}

              {state.ricorrenti.length === 0 && !formRic && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Le spese fisse (affitto, bollette, abbonamenti) si registrano da sole alla data
                  che scegli.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <EditRecurringModal
        open={ricEdit !== null}
        onClose={() => setRicEdit(null)}
        edit={state.ricorrenti.find((r) => r.id === ricEdit) ?? null}
      />

      <ConfirmPopup
        open={ricDaEliminare !== null}
        onClose={() => setRicDaEliminare(null)}
        title="Eliminare questa spesa ricorrente?"
        description="Le transazioni già generate in passato non verranno toccate: si ferma solo la generazione futura."
        confirmLabel="Elimina"
        onConfirm={() => {
          if (!ricDaEliminare) return;
          deleteRecurring(ricDaEliminare);
          setRicDaEliminare(null);
          toast.success("Ricorrente eliminata");
        }}
      />
    </div>
  );
}
