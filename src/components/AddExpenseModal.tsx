import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Repeat, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { iconFor } from "@/lib/icons";
import { formatDay, todayISO, uid } from "@/lib/format";
import { dataInizioSettimanale, fromISO, giornoRicorrenzaDa } from "@/lib/ricorrenze";
import { categoriaPerDescrizione, suggerimentiDescrizione } from "@/lib/descrizioni";
import { RecurrenceFields, type RegoleRicorrenza } from "./RecurrenceFields";
import type { Transaction } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { CHIUSURA_RITARDATA_MS, SuggerimentiDescrizione } from "./SuggerimentiDescrizione";
import { ConfirmPopup } from "./ConfirmPopup";

function shiftDay(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AddExpenseModal({
  open,
  onClose,
  edit = null,
  preset = null,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Transaction | null;
  /** Precompilazione (es. duplica transazione) senza collegarsi a una spesa esistente. */
  preset?: Pick<Transaction, "importo" | "categoria" | "nota"> | null;
}) {
  const { state, addTransaction, updateTransaction, update } = useApp();
  const [importo, setImporto] = useState("");
  const [categoria, setCategoria] = useState("");
  /*
   * La categoria è stata decisa da qualcuno (l'utente toccandola, oppure la
   * spesa che si sta modificando, oppure il consiglio da cui si è partiti)?
   * In quel caso la descrizione non la tocca più: proporre è utile,
   * scavalcare una scelta fatta apposta no.
   */
  const categoriaDecisa = useRef(false);
  const [data, setData] = useState(todayISO());
  const [nota, setNota] = useState("");
  const [ripeti, setRipeti] = useState(false);
  const [regole, setRegole] = useState<RegoleRicorrenza>({
    cadenza: "mesi",
    intervallo: 1,
    giorno: giornoRicorrenzaDa(todayISO()),
    giornoSettimana: new Date().getDay(),
    fine: null,
  });
  const [confermaStop, setConfermaStop] = useState(false);
  const importoRef = useRef<HTMLInputElement | null>(null);
  const corpoRef = useRef<HTMLDivElement | null>(null);
  const descrizioneRef = useRef<HTMLDivElement | null>(null);
  const descrizioneInputRef = useRef<HTMLInputElement | null>(null);
  /*
   * Il testo della descrizione, letto al momento giusto. Lo stato "nota" si
   * aggiorna solo al ridisegno successivo: chi lo legge subito dopo aver
   * scelto un suggerimento troverebbe ancora le lettere digitate prima, e
   * proporrebbe la categoria sbagliata.
   */
  const notaCorrente = useRef("");
  const chiusuraNota = useRef<number | null>(null);
  /*
   * Di quanto far salire il contenuto quando si scrive la descrizione: la
   * distanza fra l'inizio del foglio e il campo, misurata nel momento in cui
   * lo si tocca (dipende dalla dimensione dello schermo e dal testo).
   */
  const [salita, setSalita] = useState(0);
  /*
   * Il fuoco dato dall'app (non dal dito dell'utente) non deve attivare la
   * modalità "sto scrivendo l'importo", che oscura e disattiva il resto del
   * foglio: altrimenti all'apertura categoria e data risulterebbero
   * inutilizzabili finché non si chiude la tastiera. Così invece la tastiera
   * è pronta per scrivere, ma si può anche toccare subito una categoria.
   */
  const fuocoAutomatico = useRef(false);
  const [campo, setCampo] = useState<"importo" | "nota" | null>(null);

  const regola = edit?.ricorrenteId
    ? state.ricorrenti.find((r) => r.id === edit.ricorrenteId)
    : undefined;
  const avevaRicorrenza = Boolean(regola && regola.attiva);

  useEffect(() => {
    if (!open) return;
    setConfermaStop(false);
    setCampo(null);

    if (edit) {
      setImporto(String(edit.importo).replace(".", ","));
      setNota(edit.nota ?? "");
      setData(edit.data);
      setCategoria(edit.categoria);
      categoriaDecisa.current = true;
      const linked = edit.ricorrenteId
        ? state.ricorrenti.find((r) => r.id === edit.ricorrenteId)
        : undefined;
      setRipeti(Boolean(linked && linked.attiva));
      setRegole(
        linked
          ? {
              cadenza: linked.cadenza,
              intervallo: linked.intervallo,
              giorno: linked.giorno,
              giornoSettimana: fromISO(linked.inizio).getDay(),
              fine: linked.fine ?? null,
            }
          : {
              cadenza: "mesi",
              intervallo: 1,
              giorno: giornoRicorrenzaDa(edit.data),
              giornoSettimana: fromISO(edit.data).getDay(),
              fine: null,
            },
      );
    } else if (preset) {
      setImporto(String(preset.importo).replace(".", ","));
      setNota(preset.nota ?? "");
      setData(todayISO());
      setCategoria(preset.categoria || state.categorie[0]?.id || "");
      categoriaDecisa.current = Boolean(preset.categoria);
      setRipeti(false);
      setRegole({
        cadenza: "mesi",
        intervallo: 1,
        giorno: giornoRicorrenzaDa(todayISO()),
        giornoSettimana: new Date().getDay(),
        fine: null,
      });
    } else {
      setImporto("");
      setNota("");
      setData(todayISO());
      setCategoria(state.categorie[0]?.id ?? "");
      categoriaDecisa.current = false;
      setRipeti(false);
      setRegole({
        cadenza: "mesi",
        intervallo: 1,
        giorno: giornoRicorrenzaDa(todayISO()),
        giornoSettimana: new Date().getDay(),
        fine: null,
      });
    }
  }, [open, edit, preset, state.categorie, state.ricorrenti]);

  /*
   * Passaggio del fuoco al campo importo, così si può digitare subito.
   *
   * Solo per una spesa NUOVA: quando si modifica una spesa esistente
   * l'importo è già scritto e più spesso si vuole cambiare categoria o data,
   * quindi alzare la tastiera sarebbe d'impiccio.
   *
   * L'attesa serve a dare il tempo al foglio di salire: la tastiera è già
   * aperta grazie al campo preparatore in AppShell, quindi qui si sta solo
   * spostando il fuoco, senza rischio che si chiuda.
   */
  useEffect(() => {
    if (!open || edit) return;
    const timer = window.setTimeout(() => {
      fuocoAutomatico.current = true;
      importoRef.current?.focus({ preventScroll: true });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [open, edit]);

  const valore = Number(importo.replace(",", "."));

  // Le descrizioni già usate che iniziano per quanto digitato. Si ricalcolano
  // solo quando cambia il testo o l'elenco delle spese, non a ogni ridisegno.
  // Il testo corrente segue anche le impostazioni fatte all'apertura
  // (modifica di una spesa, consiglio), che non passano da onChange.
  useEffect(() => {
    notaCorrente.current = nota;
  }, [nota]);

  // Nessuna chiusura ritardata deve sopravvivere alla tendina.
  useEffect(
    () => () => {
      if (chiusuraNota.current) window.clearTimeout(chiusuraNota.current);
    },
    [],
  );

  const suggerimenti = useMemo(
    () => suggerimentiDescrizione(state.transazioni, nota),
    [state.transazioni, nota],
  );

  /*
   * Categoria automatica dalla descrizione: se questa descrizione è già
   * stata usata, si seleziona la categoria dell'ultima volta.
   *
   * Scatta in due momenti: scegliendo un suggerimento, e lasciando il campo
   * dopo aver scritto a mano una descrizione già nota. NON a ogni lettera:
   * chi scrive "Benzina" e sta per aggiungere " moto" vedrebbe la categoria
   * saltare avanti e indietro mentre digita.
   *
   * Non scavalca mai una categoria scelta apposta (vedi categoriaDecisa).
   * Fra due descrizioni automatiche invece sì: chi cambia idea da "Benzina"
   * a "Spesa Esselunga" deve vedere la categoria seguirlo.
   */
  const proponiCategoria = (testo: string) => {
    if (categoriaDecisa.current) return;
    const proposta = categoriaPerDescrizione(
      state.transazioni,
      testo,
      state.categorie.map((c) => c.id),
    );
    if (proposta) setCategoria(proposta);
  };

  // Categorie ordinate per uso reale: le più usate per prime, quelle mai usate in fondo.
  const usoPerCategoria = new Map<string, number>();
  for (const t of state.transazioni) {
    usoPerCategoria.set(t.categoria, (usoPerCategoria.get(t.categoria) ?? 0) + 1);
  }
  const categorieOrdinate = [...state.categorie].sort(
    (a, b) => (usoPerCategoria.get(b.id) ?? 0) - (usoPerCategoria.get(a.id) ?? 0),
  );

  const nomeRegola = () =>
    nota.trim() || state.categorie.find((c) => c.id === categoria)?.nome || "Spesa";

  const salvaEdit = (stopRicorrenza: boolean) => {
    if (!edit) return;
    const patch: Partial<Omit<Transaction, "id">> = {
      importo: valore,
      categoria,
      data,
      nota: nota.trim(),
    };
    if (ripeti && !avevaRicorrenza) {
      const nuovoId = uid();
      update((s) => ({
        ...s,
        ricorrenti: [
          ...s.ricorrenti.filter((r) => r.id !== edit.ricorrenteId),
          {
            id: nuovoId,
            nome: nomeRegola(),
            categoria,
            importo: valore,
            giorno: regole.giorno,
            attiva: true,
            cadenza: regole.cadenza,
            intervallo: regole.intervallo,
            // La spesa che si sta salvando è la prima della serie: da qui
            // partono i conteggi della cadenza, e risulta già registrata.
            inizio: data,
            fine: regole.fine,
            ultimaData: data,
          },
        ],
        transazioni: s.transazioni.map((t) =>
          t.id === edit.id ? { ...t, ...patch, ricorrenteId: nuovoId } : t,
        ),
      }));
      toast.success("Spesa aggiornata e resa ricorrente");
      onClose();
      return;
    }
    if (!ripeti && avevaRicorrenza && stopRicorrenza) {
      update((s) => ({
        ...s,
        ricorrenti: s.ricorrenti.map((r) =>
          r.id === edit.ricorrenteId ? { ...r, attiva: false } : r,
        ),
        transazioni: s.transazioni.map((t) => (t.id === edit.id ? { ...t, ...patch } : t)),
      }));
      toast.success("Ricorrenza disattivata");
      onClose();
      return;
    }
    if (ripeti && avevaRicorrenza) {
      update((s) => ({
        ...s,
        ricorrenti: s.ricorrenti.map((r) =>
          r.id === edit.ricorrenteId
            ? {
                ...r,
                categoria,
                importo: valore,
                giorno: regole.giorno,
                cadenza: regole.cadenza,
                intervallo: regole.intervallo,
                fine: regole.fine,
                attiva: true,
              }
            : r,
        ),
        transazioni: s.transazioni.map((t) => (t.id === edit.id ? { ...t, ...patch } : t)),
      }));
      toast.success("Spesa aggiornata");
      onClose();
      return;
    }
    updateTransaction(edit.id, patch);
    toast.success("Spesa aggiornata");
    onClose();
  };

  const salva = () => {
    if (!Number.isFinite(valore) || valore <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    if (!categoria) {
      toast.error("Scegli una categoria");
      return;
    }
    if (edit) {
      if (!ripeti && avevaRicorrenza) {
        setConfermaStop(true);
        return;
      }
      salvaEdit(false);
      return;
    }
    addTransaction({ importo: valore, categoria, data, nota: nota.trim() });
    if (ripeti) {
      update((s) => ({
        ...s,
        ricorrenti: [
          ...s.ricorrenti,
          {
            id: uid(),
            nome: nomeRegola(),
            categoria,
            importo: valore,
            giorno: regole.giorno,
            attiva: true,
            cadenza: regole.cadenza,
            intervallo: regole.intervallo,
            // La spesa che si sta salvando è la prima della serie: da qui
            // partono i conteggi della cadenza, e risulta già registrata.
            inizio: data,
            fine: regole.fine,
            ultimaData: data,
          },
        ],
      }));
    }
    toast.success(ripeti ? "Spesa registrata e resa ricorrente" : "Spesa registrata");
    onClose();
  };

  const dateChips: { label: string; value: string }[] = [
    { label: "Ieri", value: shiftDay(-1) },
    { label: "Oggi", value: todayISO() },
    { label: "Domani", value: shiftDay(1) },
  ];

  // Una data futura non entra nello speso del mese: diventa una "spesa
  // prevista". Va detto subito, altrimenti l'utente la cerca nei totali e non
  // la trova, pensando che l'app non l'abbia salvata.
  const isFutura = data > todayISO();

  return (
    <BottomSheet open={open} onClose={onClose} fullScreen>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="text-base font-semibold">{edit ? "Modifica spesa" : "Nuova spesa"}</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-surface-2 p-2 text-muted-foreground"
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>
      </div>

      {/*
       * Fascia che scorre. "min-h-0" serve perché in un contenitore flex un
       * figlio non si restringe mai sotto il proprio contenuto se non glielo
       * si dice, e il pulsante di salvataggio finirebbe fuori schermo.
       *
       * Mentre si scrive in un campo la fascia smette di scorrere: il dito
       * che si appoggia per sbaglio non deve spostare nulla.
       */}
      <div
        ref={corpoRef}
        data-scroll-lock-allow
        className={`no-scrollbar -mx-4 min-h-0 flex-1 px-4 ${
          campo ? "overflow-hidden" : "overflow-y-auto overscroll-contain"
        }`}
      >
        <div
          className="relative transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: campo === "nota" ? `translateY(-${salita}px)` : "translateY(0)" }}
        >
          {/*
           * ORDINE DEI CAMPI, pensato per la tastiera.
           *
           * Importo e descrizione sono gli unici due campi che aprono la
           * tastiera, e stanno uno sotto l'altro, in cima:
           *
           * - la tastiera di iPhone copre circa la metà bassa dello schermo.
           *   Con la descrizione in alto, i suggerimenti che si aprono sotto
           *   restano nella metà visibile. Prima stava dopo le categorie, e i
           *   suggerimenti finivano dietro la tastiera;
           * - essendo adiacenti, la freccia "giù" sopra la tastiera di iPhone
           *   porta dall'importo alla descrizione senza chiudere la tastiera:
           *   si scrivono di fila.
           *
           * Categorie, data e ricorrenza si toccano e basta: vengono dopo, e si
           * usano a tastiera chiusa, quando tutto lo schermo è libero.
           *
           * Mentre si scrive, gli altri campi restano al loro posto ma sbiaditi
           * e non toccabili: si vede dove si è, senza poter finire altrove per
           * sbaglio. Per chiudere basta "Fine" sulla tastiera.
           */}

          {/* Importo */}
          <div
            className={`mb-3 flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-5 transition-opacity ${
              campo === "importo" ? "ring-2 ring-primary" : ""
            } ${campo === "nota" ? "pointer-events-none opacity-40" : ""}`}
          >
            <span className="text-2xl font-semibold text-muted-foreground">€</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={importo.replace(",", ".")}
              ref={importoRef}
              onFocus={(e) => {
                e.target.select();
                if (fuocoAutomatico.current) {
                  fuocoAutomatico.current = false;
                  return;
                }
                setCampo("importo");
              }}
              onBlur={() => setCampo((v) => (v === "importo" ? null : v))}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onChange={(e) => setImporto(e.target.value.replace(".", ","))}
              placeholder="0"
              aria-label="Importo"
              className="w-full min-w-0 bg-transparent text-center text-[42px] font-semibold leading-tight tracking-tight outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/*
           * Descrizione, con i suggerimenti sotto.
           *
           * Toccandola, il contenuto del foglio scivola su finché il campo non
           * arriva in cima: l'importo scorre via sotto l'intestazione (non
           * sparisce, torna giù appena si chiude la tastiera) e sotto il campo
           * resta tutto lo spazio per i suggerimenti, anche su iPhone SE e con
           * la Dynamic Island.
           *
           * Si muove solo il contenuto del foglio, con una traslazione: niente
           * "scrollIntoView", che su iPhone sposta anche la pagina e fa
           * intravedere lo sfondo.
           */}
          <div ref={descrizioneRef} className="relative mb-3">
            <input
              ref={descrizioneInputRef}
              value={nota}
              onFocus={() => {
                // Tornato il fuoco prima della chiusura ritardata: la tendina
                // resta aperta, non si chiude e riapre.
                if (chiusuraNota.current) {
                  window.clearTimeout(chiusuraNota.current);
                  chiusuraNota.current = null;
                }
                // Se la fascia era stata fatta scorrere, si riparte da zero
                // così la misura qui sotto è quella giusta.
                corpoRef.current?.scrollTo({ top: 0 });
                // offsetTop e non getBoundingClientRect: non risente della
                // traslazione, quindi la misura resta giusta anche se si
                // tocca di nuovo il campo mentre il contenuto sta tornando giù.
                setSalita(descrizioneRef.current?.offsetTop ?? 0);
                setCampo("nota");
              }}
              onBlur={() => {
                /*
                 * Chiusura un attimo DOPO la perdita del fuoco, non subito.
                 * Su iPhone il dito che tocca un suggerimento fa perdere il
                 * fuoco al campo prima che arrivi il "click": chiudendo
                 * subito, la tendina sparirebbe e il suggerimento toccato
                 * non verrebbe mai inserito.
                 */
                if (chiusuraNota.current) window.clearTimeout(chiusuraNota.current);
                chiusuraNota.current = window.setTimeout(() => {
                  chiusuraNota.current = null;
                  setCampo((v) => (v === "nota" ? null : v));
                  proponiCategoria(notaCorrente.current);
                }, CHIUSURA_RITARDATA_MS);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onChange={(e) => {
                notaCorrente.current = e.target.value;
                setNota(e.target.value);
              }}
              enterKeyHint="done"
              placeholder="Descrizione (opzionale)"
              className={`w-full rounded-2xl border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted-foreground ${
                campo === "nota" ? "border-primary ring-2 ring-primary" : "border-border"
              } ${campo === "importo" ? "pointer-events-none opacity-40" : ""}`}
            />
            {campo === "nota" && (
              <SuggerimentiDescrizione
                voci={suggerimenti}
                digitato={nota}
                onScegli={(testo) => {
                  notaCorrente.current = testo;
                  setNota(testo);
                  proponiCategoria(testo);
                  // Scelto il suggerimento la descrizione è finita: si chiude
                  // la tastiera e si torna al resto del modulo, con la
                  // categoria già selezionata.
                  descrizioneInputRef.current?.blur();
                }}
              />
            )}
          </div>

          <div className={`transition-opacity ${campo ? "pointer-events-none opacity-40" : ""}`}>
            {/*
             * Categorie su griglia: tutte visibili insieme, ordinate per uso
             * così le più frequenti capitano nella prima riga.
             */}
            <div className="mb-3 grid grid-cols-4 gap-2">
              {categorieOrdinate.map((c) => {
                const Icon = iconFor(c.icona);
                const active = c.id === categoria;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      categoriaDecisa.current = true;
                      setCategoria(c.id);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[11px] transition-colors ${
                      active
                        ? "border-primary bg-surface-2 font-semibold text-foreground"
                        : "border-border bg-surface text-muted-foreground"
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${c.colore}22`, color: c.colore }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="line-clamp-2 w-full text-center leading-tight">{c.nome}</span>
                  </button>
                );
              })}
            </div>

            {/* Data */}
            <div className="no-scrollbar -mx-4 mb-2.5 flex items-center gap-2 overflow-x-auto px-4">
              {dateChips.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setData(d.value)}
                  className={`shrink-0 rounded-full border px-3.5 py-2 text-xs ${
                    data === d.value
                      ? "border-primary bg-surface-2 font-semibold"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="chip shrink-0 bg-surface outline-none"
              />
            </div>
            {isFutura && (
              <p className="mb-2.5 text-[11px] text-muted-foreground">
                Data futura: sarà una spesa prevista e verrà conteggiata dal {formatDay(data)}.
              </p>
            )}

            {/* Ricorrenza */}
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5">
              <Repeat size={15} className="shrink-0 text-primary" />
              <span className="flex-1 truncate text-sm">Spesa ricorrente</span>
              <button
                type="button"
                onClick={() => setRipeti((v) => !v)}
                aria-pressed={ripeti}
                aria-label="Ripeti ogni mese"
                className={`h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${ripeti ? "lime-fill" : "bg-surface-2"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-background transition-transform ${ripeti ? "translate-x-5" : ""}`}
                />
              </button>
            </div>

            {/* Le opzioni della ricorrenza si aprono solo quando serve. */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                ripeti ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden" aria-hidden={!ripeti}>
                <div className="mb-3 rounded-2xl border border-border bg-surface p-3.5">
                  <RecurrenceFields value={regole} onChange={setRegole} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`shrink-0 pt-3 transition-opacity ${campo ? "pointer-events-none opacity-40" : ""}`}
      >
        <button
          onClick={salva}
          className="lime-fill w-full rounded-2xl py-3.5 text-base font-semibold active:scale-[0.99]"
        >
          {edit ? "Salva modifiche" : "Salva spesa"}
        </button>
      </div>

      <ConfirmPopup
        open={confermaStop}
        onClose={() => setConfermaStop(false)}
        title="Fermare la ricorrenza?"
        description="Le spese già registrate in passato non vengono toccate: si ferma solo la generazione automatica dei prossimi mesi."
        confirmLabel="Ferma"
        onConfirm={() => {
          setConfermaStop(false);
          salvaEdit(true);
        }}
      />
    </BottomSheet>
  );
}
