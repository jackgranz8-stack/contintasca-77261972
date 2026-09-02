import { useState } from "react";
import { Infinity as InfinityIcon } from "lucide-react";
import type { Cadenza } from "@/lib/types";
import { todayISO } from "@/lib/format";

export type RegoleRicorrenza = {
  cadenza: Cadenza;
  intervallo: number;
  giorno: number;
  fine: string | null;
};

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

      {/* Il giorno del mese serve solo alla cadenza mensile: con quella
          settimanale il giorno lo decide la data di inizio (sempre lo stesso
          giorno della settimana), quindi chiederlo confonderebbe. */}
      {value.cadenza === "mesi" && (
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
