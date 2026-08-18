import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { ICON_KEYS, iconFor } from "@/lib/icons";
import {
  DEFAULT_CATEGORIES,
  HOUSING_OPTIONS,
  PALETTE,
  type Category,
  type Housing,
} from "@/lib/types";
import { eur, uid } from "@/lib/format";
import { suggestBudgets } from "@/lib/budget-suggest";

type Draft = Category & { attiva: boolean };

export function Onboarding() {
  const { update } = useApp();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [totale, setTotale] = useState("");
  const [abitazione, setAbitazione] = useState<Housing>("affitto");
  const [auto, setAuto] = useState(true);
  const [persone, setPersone] = useState(1);
  const [cats, setCats] = useState<Draft[]>(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, budget: 0, attiva: true })),
  );
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovaIcona, setNuovaIcona] = useState("cart");

  const totaleNum = Math.max(0, Number(totale.replace(",", ".")) || 0);
  const attive = cats.filter((c) => c.attiva);
  const sommaBudget = useMemo(() => attive.reduce((a, c) => a + c.budget, 0), [attive]);

  const next = () => {
    if (step === 1 && totaleNum <= 0) return;
    if (step === 3) {
      if (attive.length === 0) return;
      setCats((cs) => suggestBudgets(cs, totaleNum, abitazione, auto, persone));
    }
    setStep((s) => s + 1);
  };

  const aggiungiCategoria = () => {
    const n = nuovoNome.trim();
    if (!n) return;
    setCats((cs) => [
      ...cs,
      {
        id: uid(),
        nome: n,
        icona: nuovaIcona,
        colore: PALETTE[cs.length % PALETTE.length] ?? "#8CE562",
        budget: 0,
        attiva: true,
      },
    ]);
    setNuovoNome("");
  };

  const conferma = () => {
    update((s) => ({
      ...s,
      categorie: attive.map(({ attiva: _attiva, ...c }) => ({ ...c, id: uid() })),
      profilo: {
        ...s.profilo,
        nome: nome.trim(),
        budgetTotale: totaleNum,
        abitazione,
        auto,
        persone,
        onboardingCompletato: true,
        primoUtilizzo: new Date().toISOString(),
      },
    }));
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pt-[calc(env(safe-area-inset-top,0px)+40px)] pb-8">
      <div className="mb-6 flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "lime-fill" : "bg-surface-2"}`}
          />
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && (
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Conti in Tasca</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tieni le spese sotto controllo in pochi tap. I tuoi dati sono salvati nel tuo account
              e disponibili su ogni dispositivo.
            </p>
            <label className="mt-8 mb-1 block text-xs text-muted-foreground">
              Come ti chiami? (opzionale)
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Il tuo nome"
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Budget mensile</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Quanto puoi spendere ogni mese in totale?
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-4">
              <span className="text-3xl font-semibold text-muted-foreground">€</span>
              <input
                autoFocus
                inputMode="decimal"
                value={totale}
                onChange={(e) => setTotale(e.target.value)}
                placeholder="1500"
                className="w-full bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profilo rapido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Serve a proporti dei budget realistici.
            </p>
            <p className="mt-6 mb-2 text-xs text-muted-foreground">Situazione abitativa</p>
            <div className="grid grid-cols-2 gap-2">
              {HOUSING_OPTIONS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setAbitazione(h.id)}
                  className={`rounded-2xl border px-3 py-3 text-sm ${
                    abitazione === h.id
                      ? "border-primary bg-surface-2"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <p className="mt-6 mb-2 text-xs text-muted-foreground">Hai un&apos;auto?</p>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setAuto(v)}
                  className={`rounded-2xl border px-3 py-3 text-sm ${
                    auto === v
                      ? "border-primary bg-surface-2"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {v ? "Sì" : "No"}
                </button>
              ))}
            </div>

            <p className="mt-6 mb-2 text-xs text-muted-foreground">Persone in famiglia</p>
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
              <button
                onClick={() => setPersone((p) => Math.max(1, p - 1))}
                className="h-9 w-9 rounded-full bg-surface-2 text-lg"
              >
                −
              </button>
              <span className="flex-1 text-center text-lg font-semibold">{persone}</span>
              <button
                onClick={() => setPersone((p) => Math.min(12, p + 1))}
                className="h-9 w-9 rounded-full bg-surface-2 text-lg"
              >
                +
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Le tue categorie</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tocca per attivare o disattivare. Puoi aggiungerne altre.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {cats.map((c) => {
                const Icon = iconFor(c.icona);
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setCats((cs) =>
                        cs.map((x) => (x.id === c.id ? { ...x, attiva: !x.attiva } : x)),
                      )
                    }
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-[11px] ${
                      c.attiva
                        ? "border-primary bg-surface-2"
                        : "border-border bg-surface text-muted-foreground"
                    }`}
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                    >
                      <Icon size={19} />
                    </span>
                    <span className="text-center leading-tight">{c.nome}</span>
                  </button>
                );
              })}
            </div>

            <div className="card-surface mt-5 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Nuova categoria</p>
              <input
                value={nuovoNome}
                onChange={(e) => setNuovoNome(e.target.value)}
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
                onClick={aggiungiCategoria}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-2.5 text-sm font-medium"
              >
                <Plus size={15} /> Aggiungi
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Budget proposti</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Divisi in base alle tue risposte. Modificali come vuoi.
            </p>
            <div className="mt-5 space-y-2">
              {attive.map((c) => {
                const Icon = iconFor(c.icona);
                return (
                  <div key={c.id} className="card-surface flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="flex-1 text-sm">{c.nome}</span>
                    <div className="flex items-center gap-1 rounded-xl bg-surface px-3 py-1.5">
                      <input
                        inputMode="decimal"
                        value={c.budget}
                        onChange={(e) =>
                          setCats((cs) =>
                            cs.map((x) =>
                              x.id === c.id
                                ? { ...x, budget: Math.max(0, Number(e.target.value) || 0) }
                                : x,
                            ),
                          )
                        }
                        className="w-16 bg-transparent text-right text-sm font-semibold outline-none"
                      />
                      <span className="text-xs text-muted-foreground">€</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Totale assegnato {eur(sommaBudget)} su {eur(totaleNum)}
            </p>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tutto pronto</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {nome.trim() ? `Ciao ${nome.trim()}, ` : ""}ecco il tuo riepilogo.
            </p>
            <div className="card-hero mt-5 p-5">
              <p className="text-xs text-muted-foreground">Budget mensile</p>
              <p className="text-3xl font-semibold tracking-tight">{eur(sommaBudget)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {attive.length} categorie · {persone} {persone === 1 ? "persona" : "persone"} ·{" "}
                {HOUSING_OPTIONS.find((h) => h.id === abitazione)?.label.toLowerCase()}
                {auto ? " · con auto" : ""}
              </p>
            </div>
            <div className="card-surface mt-3 divide-y divide-border">
              {attive.map((c) => (
                <div key={c.id} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>{c.nome}</span>
                  <span className="font-semibold" style={{ color: c.colore }}>
                    {eur(c.budget)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2"
            aria-label="Indietro"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        {step < 5 ? (
          <button
            onClick={next}
            disabled={(step === 1 && totaleNum <= 0) || (step === 3 && attive.length === 0)}
            className="lime-fill flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-40"
          >
            Continua <ArrowRight size={17} />
          </button>
        ) : (
          <button
            onClick={conferma}
            className="lime-fill flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
          >
            <Check size={17} /> Inizia
          </button>
        )}
      </div>
    </div>
  );
}
