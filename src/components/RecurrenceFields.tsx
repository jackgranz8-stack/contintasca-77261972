import { useState } from "react";
import { Infinity as InfinityIcon } from "lucide-react";
import type { Cadenza } from "@/lib/types";
import { todayISO } from "@/lib/format";

export type RegoleRicorrenza = {
  cadenza: Cadenza;
  intervallo: number;
  /** Giorno del mese (1-28), usato solo con cadenza "mesi". */
  giorno: number;
  /** Giorno della settimana, usato solo con cadenza "settimane". Convenzione
   *  JavaScript: 0 = domenica, 1 = lunedì, ... 6 = sabato. */
  giornoSettimana: number;
  fine: string | null;
};

/** Lunedì per primo, come sui calendari italiani; il valore resta 0-6 di JS. */
const GIORNI_SETTIMANA = [
  { valore: 1, sigla: "L", nome: "Lunedì" },
  { valore: 2, sigla: "M", nome: "Martedì" },
  { valore: 3, sigla: "M", nome: "Mercoledì" },
  { valore: 4, sigla: "G", nome: "Giovedì" },
  { valore: 5, sigla: "V", nome: "Venerdì" },
  { valore: 6, sigla: "S", nome: "Sabato" },
  { valore: 0, sigla: "D", nome: "Domenica" },
];

const INTERVALLI = [1, 2, 3, 4, 6, 12];

/**
 * Controlli di cadenza e fine di una spesa ricorrente, condivisi da tutti i
 * punti in cui si crea o si modifica una ricorrenza (nuova spesa, modifica
 * ricorrente, aggiunta da Budget). Tenerli in un componente solo evita che le
 * tre schermate finiscano per offrire opzioni diverse fra loro.
 *
 * Impostazione della schermata, in stile iOS: si parte dal caso più comune
 * già pronto ("Ogni mese", senza fine) e le opzioni in più si aprono solo se
 * servono. Chi vuole la spesa fissa mensile non deve toccare nulla.
 */
export function RecurrenceFields({
  value,
  onChange,
}: {
  value: RegoleRicorrenza;
  onChange: (v: RegoleRicorrenza) => void;
}) {
  const [mostraFine, setMostraFine] = useState(value.fine !== null);

  const set = (patch: Partial<RegoleRicorrenza>) => onChange({ ...value, ...patch });

  const unita: { id: Cadenza; label: string }[] = [
    { id: "settimane", label: "Settimane" },
    { id: "mesi", label: "Mesi" },
  ];

  return (
    <div className="space-y-3">
      {/* Unità: due sole scelte, come un interruttore a due posizioni iOS. */}
      <div>
        <p className="mb-1.5 text-[11px] text-muted-foreground">Si ripete ogni</p>
        <div className="flex gap-2">
          <select
            value={value.intervallo}
            onChange={(e) => set({ intervallo: Number(e.target.value) })}
            aria-label="Ogni quanto si ripete"
            className="native-select w-20 shrink-0 py-2.5"
          >
            {INTERVALLI.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="flex flex-1 gap-1 rounded-xl bg-surface-2 p-1">
            {unita.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => set({ cadenza: u.id })}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  value.cadenza === u.id
                    ? "bg-popover text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {value.cadenza === "mesi" ? (
        <div>
          <p className="mb-1.5 text-[11px] text-muted-foreground">Giorno del mese</p>
          <select
            value={value.giorno}
            onChange={(e) => set({ giorno: Number(e.target.value) })}
            aria-label="Giorno del mese"
            className="native-select w-full py-2.5"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Giorno {d}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Fino al 28, così la spesa cade in ogni mese, febbraio compreso.
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-[11px] text-muted-foreground">Giorno della settimana</p>
          <div className="flex gap-1">
            {GIORNI_SETTIMANA.map((g) => (
              <button
                key={g.valore}
                type="button"
                onClick={() => set({ giornoSettimana: g.valore })}
                aria-label={g.nome}
                aria-pressed={value.giornoSettimana === g.valore}
                className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                  value.giornoSettimana === g.valore
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {g.sigla}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fine: chiusa di default su "Mai", che è il caso normale. */}
      <div>
        <p className="mb-1.5 text-[11px] text-muted-foreground">Fine</p>
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => {
              setMostraFine(false);
              set({ fine: null });
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
              !mostraFine ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <InfinityIcon size={13} />
            Mai
          </button>
          <button
            type="button"
            onClick={() => {
              setMostraFine(true);
              if (value.fine === null) set({ fine: todayISO() });
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
              mostraFine ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            In una data
          </button>
        </div>
        {mostraFine && (
          <input
            type="date"
            value={value.fine ?? todayISO()}
            min={todayISO()}
            onChange={(e) => set({ fine: e.target.value })}
            aria-label="Data di fine ricorrenza"
            className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none"
          />
        )}
      </div>
    </div>
  );
}
