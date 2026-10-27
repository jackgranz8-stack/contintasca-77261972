import { useEffect, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { useApp } from "@/lib/store";
import { HOUSING_OPTIONS, REGIONI, type Profile } from "@/lib/types";

/** Quote pronte per affitto o mutuo divisi: le più comuni, senza far fare conti. */
const QUOTE = [
  { valore: 1, etichetta: "Tutto io" },
  { valore: 0.5, etichetta: "Metà" },
  { valore: 1 / 3, etichetta: "Un terzo" },
  { valore: 0.25, etichetta: "Un quarto" },
];

/**
 * PROFILO → LA TUA SITUAZIONE
 *
 * I dati che servono a confrontare le spese con quelle di una famiglia come
 * la tua (analisi in "Chiedi") e a ricalcolare i budget:
 * - abitazione, e se affitto o mutuo sono divisi, quanto paghi tu;
 * - auto, persone in famiglia, regione;
 * - reddito netto mensile, facoltativo: serve solo a dire quanto risparmi.
 *
 * Prima abitazione, auto e persone stavano dentro "Ricalcola budget", dove
 * non si capiva che contassero anche per altro.
 */
export function ProfiloSituazione() {
  const { state, update } = useApp();
  const p = state.profilo;
  const [aperto, setAperto] = useState(false);
  const [reddito, setReddito] = useState(p.reddito ? String(p.reddito) : "");

  // Se il profilo arriva dal server dopo l'apertura, il campo si allinea.
  useEffect(() => {
    setReddito(p.reddito ? String(p.reddito) : "");
  }, [p.reddito]);

  const cambia = (modifica: Partial<Profile>) =>
    update((s) => ({ ...s, profilo: { ...s.profilo, ...modifica } }));

  const salvaReddito = () => {
    const n = Number(reddito.replace(/\./g, "").replace(",", "."));
    const valore = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    if (valore !== p.reddito) cambia({ reddito: valore });
    setReddito(valore ? String(valore) : "");
  };

  const scelta = (attivo: boolean) =>
    `rounded-2xl border px-3 py-3 text-sm ${
      attivo ? "border-primary bg-surface-2" : "border-border bg-surface text-muted-foreground"
    }`;

  const casaDivisibile = p.abitazione === "affitto" || p.abitazione === "mutuo";

  return (
    <section className="card-surface overflow-hidden p-0">
      <button
        onClick={() => setAperto((v) => !v)}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
          <UserRound size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">La tua situazione</span>
          <span className="block text-[11px] text-muted-foreground">
            Serve all'analisi delle spese e al calcolo dei budget
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
            aperto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aperto && (
        <div className="px-5 pb-5">
          <p className="mb-2 text-xs text-muted-foreground">Situazione abitativa</p>
          <div className="grid grid-cols-2 gap-2">
            {HOUSING_OPTIONS.map((h) => (
              <button
                key={h.id}
                onClick={() => cambia({ abitazione: h.id })}
                className={scelta(p.abitazione === h.id)}
              >
                {h.label}
              </button>
            ))}
          </div>

          {casaDivisibile && (
            <>
              <p className="mt-5 mb-2 text-xs text-muted-foreground">
                {p.abitazione === "affitto" ? "L'affitto" : "Il mutuo"} lo paghi tutto tu?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {QUOTE.map((q) => (
                  <button
                    key={q.etichetta}
                    onClick={() => cambia({ quotaCasa: q.valore })}
                    className={`${scelta(Math.abs(p.quotaCasa - q.valore) < 0.01)} px-1 text-xs`}
                  >
                    {q.etichetta}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mt-5 mb-2 text-xs text-muted-foreground">Hai un&apos;auto?</p>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => cambia({ auto: v })}
                className={scelta(p.auto === v)}
              >
                {v ? "Sì" : "No"}
              </button>
            ))}
          </div>

          <p className="mt-5 mb-1 text-xs text-muted-foreground">Per quante persone spendi?</p>
          <p className="mb-2 text-[11px] text-muted-foreground/70">
            Chi condivide con te le spese di casa e la spesa: non i coinquilini con cui dividi solo
            l&apos;affitto.
          </p>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
            <button
              onClick={() => cambia({ persone: Math.max(1, p.persone - 1) })}
              className="h-9 w-9 rounded-full bg-surface-2 text-lg"
              aria-label="Diminuisci"
            >
              −
            </button>
            <span className="flex-1 text-center text-lg font-semibold">{p.persone}</span>
            <button
              onClick={() => cambia({ persone: Math.min(12, p.persone + 1) })}
              className="h-9 w-9 rounded-full bg-surface-2 text-lg"
              aria-label="Aumenta"
            >
              +
            </button>
          </div>

          <label className="mt-5 mb-2 block text-xs text-muted-foreground" htmlFor="regione">
            Regione
          </label>
          <select
            id="regione"
            value={p.regione}
            onChange={(e) => cambia({ regione: e.target.value })}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base outline-none"
          >
            <option value="">Non indicata (media nazionale)</option>
            {REGIONI.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <label className="mt-5 mb-1 block text-xs text-muted-foreground" htmlFor="reddito">
            Reddito netto mensile <span className="text-muted-foreground/70">(facoltativo)</span>
          </label>
          <p className="mb-2 text-[11px] text-muted-foreground/70">
            Serve a dirti quanto risparmi. Resta nel tuo account; per i consigli l&apos;AI lo riceve
            come numero, insieme ai totali.
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
            <input
              id="reddito"
              type="text"
              inputMode="decimal"
              value={reddito}
              onChange={(e) => setReddito(e.target.value.replace(/[^\d.,]/g, ""))}
              onBlur={salvaReddito}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Es. 1800"
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
        </div>
      )}
    </section>
  );
}
