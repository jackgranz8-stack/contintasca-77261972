import type { Risposta } from "@/lib/domande";

/** "1.250 €" → "1,3k" sopra le colonne, dove lo spazio è poco. */
function compatto(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}k`;
  return String(Math.round(n));
}

/**
 * GRAFICO DI UNA RISPOSTA DI "CHIEDI"
 *
 * - colonne: l'andamento mese per mese, dal più vecchio al più recente,
 *   con il valore sopra ogni colonna e sotto tutte la tabella completa;
 * - barre: classifiche e confronti (categorie, spese più alte, più
 *   frequenti, due periodi). Ogni barra porta già nome e importo, quindi fa
 *   anche da tabella.
 *
 * Disegnato con semplici blocchi colorati: niente librerie di grafici, che
 * peserebbero sull'app per pochi rettangoli.
 */
export function GraficoRisposta({ risposta }: { risposta: Risposta }) {
  const righe = risposta.righe ?? [];
  if (righe.length === 0) return null;
  const max = Math.max(0, ...righe.map((r) => r.numero ?? 0));

  if (risposta.grafico === "colonne" && max > 0) {
    // Le righe arrivano dalla più recente: nel grafico il tempo va a destra.
    const dati = [...righe].reverse();
    return (
      <>
        <div
          role="img"
          aria-label={`Grafico: ${risposta.frase}`}
          className="mt-7 flex h-44 items-stretch gap-1.5"
        >
          {dati.map((r, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="relative w-full flex-1">
                <div
                  className="absolute inset-x-0 bottom-0 flex flex-col items-center"
                  style={{ height: `${Math.max(3, ((r.numero ?? 0) / max) * 100)}%` }}
                >
                  <span className="-mt-4 text-[10px] whitespace-nowrap text-muted-foreground">
                    {compatto(r.numero ?? 0)}
                  </span>
                  <div className="lime-fill w-full flex-1 rounded-t-md" />
                </div>
              </div>
              <span className="mt-1.5 w-full truncate text-center text-[10px] text-muted-foreground">
                {r.breve ?? r.etichetta}
              </span>
            </div>
          ))}
        </div>
        <Tabella risposta={risposta} />
      </>
    );
  }

  if (risposta.grafico === "barre" && max > 0) {
    return (
      <ul className="mt-4 space-y-3">
        {righe.map((r, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.etichetta}</span>
              {r.nota && (
                <span className="shrink-0 text-[11px] text-muted-foreground">{r.nota}</span>
              )}
              <span className="shrink-0 font-semibold">{r.valore}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${r.colore ? "" : "lime-fill"}`}
                style={{
                  width: `${Math.max(2, ((r.numero ?? 0) / max) * 100)}%`,
                  ...(r.colore ? { backgroundColor: r.colore } : null),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return <Tabella risposta={risposta} />;
}

function Tabella({ risposta }: { risposta: Risposta }) {
  return (
    <ul className="mt-3 divide-y divide-border border-t border-border">
      {(risposta.righe ?? []).map((r, i) => (
        <li key={i} className="flex items-baseline gap-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1 truncate">{r.etichetta}</span>
          {r.nota && <span className="shrink-0 text-[11px] text-muted-foreground">{r.nota}</span>}
          <span className="shrink-0 font-semibold">{r.valore}</span>
        </li>
      ))}
    </ul>
  );
}
