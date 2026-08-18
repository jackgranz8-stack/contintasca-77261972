import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing, Download, FileDown, Fingerprint, LogIn, LogOut, Upload } from "lucide-react";
import { useApp } from "@/lib/store";
import { eur, formatDay, uid } from "@/lib/format";
import { HOUSING_OPTIONS, PALETTE, type Housing } from "@/lib/types";
import { exportTemplate, exportTransactions, parseImportFile } from "@/lib/excel";
import { suggestBudgets } from "@/lib/budget-suggest";
import { disableFaceId, enrollFaceId, faceIdSupported, isFaceIdEnabled } from "@/lib/webauthn";
import { disablePush, enablePush, isPushEnabled, pushSupported, sendPush } from "@/lib/push";

export const Route = createFileRoute("/profilo")({
  head: () => ({
    meta: [
      { title: "Profilo ed Excel — Conti in Tasca" },
      {
        name: "description",
        content:
          "Gestisci il tuo profilo, esporta o importa le spese in formato Excel e reimposta l'app quando vuoi.",
      },
      { property: "og:title", content: "Profilo ed Excel — Conti in Tasca" },
      {
        property: "og:description",
        content: "Esporta e importa le tue spese in Excel, gestisci il profilo.",
      },
    ],
  }),
  component: ProfiloPage,
});

function ProfiloPage() {
  const { state, update, reset, account, syncing, signOut } = useApp();
  const navigate = useNavigate();
  const [nome, setNome] = useState(state.profilo.nome);
  const [resetStep, setResetStep] = useState(0);
  const [confirmRicalcolo, setConfirmRicalcolo] = useState(false);
  const [faceIdOn, setFaceIdOn] = useState(false);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (account) setFaceIdOn(isFaceIdEnabled(account.id));
    void isPushEnabled().then(setPushOn);
  }, [account]);

  const togglePush = async () => {
    if (!account) return;
    setPushBusy(true);
    if (pushOn) {
      await disablePush(account.id);
      setPushOn(false);
      toast.success("Notifiche disattivate");
    } else {
      const ok = await enablePush(account.id);
      if (ok) {
        setPushOn(true);
        toast.success("Notifiche attivate");
      } else {
        toast.error("Permesso negato o non supportato su questo dispositivo");
      }
    }
    setPushBusy(false);
  };

  const toggleFaceId = async () => {
    if (!account) return;
    setFaceIdBusy(true);
    if (faceIdOn) {
      disableFaceId(account.id);
      setFaceIdOn(false);
      toast.success("Face ID disattivato");
    } else {
      const ok = await enrollFaceId(account.id, account.email ?? "");
      if (ok) {
        setFaceIdOn(true);
        toast.success("Face ID attivato: da ora ti servirà per aprire l'app");
      } else {
        toast.error("Non riesco ad attivare Face ID su questo dispositivo");
      }
    }
    setFaceIdBusy(false);
  };

  const salvaNome = () => {
    update((s) => ({ ...s, profilo: { ...s.profilo, nome: nome.trim() } }));
    toast.success("Nome aggiornato");
  };

  const setAbitazione = (abitazione: Housing) =>
    update((s) => ({ ...s, profilo: { ...s.profilo, abitazione } }));
  const setAuto = (auto: boolean) => update((s) => ({ ...s, profilo: { ...s.profilo, auto } }));
  const setPersone = (persone: number) =>
    update((s) => ({ ...s, profilo: { ...s.profilo, persone } }));

  const ricalcolaBudget = () => {
    const totale = state.categorie.reduce((a, c) => a + c.budget, 0);
    if (totale <= 0) {
      toast.error("Imposta prima almeno un budget nelle categorie");
      setConfirmRicalcolo(false);
      return;
    }
    const draft = state.categorie.map((c) => ({ ...c, attiva: true }));
    const proposte = suggestBudgets(
      draft,
      totale,
      state.profilo.abitazione,
      state.profilo.auto,
      state.profilo.persone,
    );
    update((s) => ({
      ...s,
      categorie: s.categorie.map((c) => {
        const p = proposte.find((x) => x.id === c.id);
        return p ? { ...c, budget: p.budget } : c;
      }),
    }));
    setConfirmRicalcolo(false);
    toast.success("Budget ricalcolati in base al profilo");
  };

  const importa = async (file: File) => {
    try {
      const res = await parseImportFile(file, state.categorie);
      if (res.righeValide.length === 0) {
        toast.error("Nessuna riga valida trovata nel file");
        return;
      }
      update((s) => {
        const categorie = [...s.categorie];
        for (const nomeCat of res.nuoveCategorie) {
          if (!categorie.some((c) => c.nome.toLowerCase() === nomeCat.toLowerCase())) {
            categorie.push({
              id: uid(),
              nome: nomeCat,
              icona: "cart",
              colore: PALETTE[categorie.length % PALETTE.length] ?? "#8CE562",
              budget: 0,
            });
          }
        }
        const transazioni = [...s.transazioni];
        for (const r of res.righeValide) {
          const cat = categorie.find((c) => c.nome.toLowerCase() === r.categoria.toLowerCase());
          if (!cat) continue;
          transazioni.push({
            id: uid(),
            importo: r.importo,
            categoria: cat.id,
            data: r.data,
            nota: r.nota,
          });
        }
        return { ...s, categorie, transazioni };
      });
      toast.success(
        `${res.righeValide.length} spese importate${res.scartate ? `, ${res.scartate} righe ignorate` : ""}`,
      );
    } catch {
      toast.error("File non leggibile");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>

      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        {account ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {account.email ?? "Account collegato"} — spese sincronizzate
              {syncing ? " (sincronizzazione…)" : ""}
            </p>
            <button
              onClick={() => {
                void signOut();
                toast.success("Disconnesso");
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium"
            >
              <LogOut size={16} /> Esci
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Accedi per ritrovare le tue spese su telefono e computer.
            </p>
            <button
              onClick={() => void navigate({ to: "/auth" })}
              className="lime-fill mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
            >
              <LogIn size={16} /> Accedi o registrati
            </button>
          </>
        )}
      </section>

      {account && faceIdSupported() && (
        <section className="card-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-primary">
              <Fingerprint size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Sblocco con Face ID</h2>
              <p className="text-xs text-muted-foreground">
                {faceIdOn ? "Attivo su questo dispositivo" : "Aggiungi un livello in più, solo qui"}
              </p>
            </div>
            <button
              onClick={() => void toggleFaceId()}
              disabled={faceIdBusy}
              className={`rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60 ${
                faceIdOn ? "bg-surface-2 text-muted-foreground" : "lime-fill"
              }`}
            >
              {faceIdOn ? "Disattiva" : "Attiva"}
            </button>
          </div>
        </section>
      )}

      {account && pushSupported() && (
        <section className="card-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-primary">
              <BellRing size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Notifiche</h2>
              <p className="text-xs text-muted-foreground">
                {pushOn ? "Attive su questo dispositivo" : "Avviso quando il ritmo di spesa è alto"}
              </p>
            </div>
            <button
              onClick={() => void togglePush()}
              disabled={pushBusy}
              className={`rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-60 ${
                pushOn ? "bg-surface-2 text-muted-foreground" : "lime-fill"
              }`}
            >
              {pushOn ? "Disattiva" : "Attiva"}
            </button>
          </div>
          {pushOn && (
            <button
              onClick={() => {
                void sendPush("Conti in Tasca", "Le notifiche funzionano correttamente.");
                toast.success("Notifica di prova inviata");
              }}
              className="mt-3 w-full rounded-xl bg-surface-2 py-2.5 text-xs font-medium text-muted-foreground"
            >
              Invia notifica di prova
            </button>
          )}
        </section>
      )}

      <section className="card-surface p-5">
        <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
        <div className="flex gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Il tuo nome"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={salvaNome} className="lime-fill rounded-xl px-4 text-sm font-semibold">
            Salva
          </button>
        </div>
      </section>

      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold">Il mio profilo</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Usati per calcolare i budget suggeriti. Aggiornali se cambia la tua situazione.
        </p>

        <p className="mt-5 mb-2 text-xs text-muted-foreground">Situazione abitativa</p>
        <div className="grid grid-cols-2 gap-2">
          {HOUSING_OPTIONS.map((h) => (
            <button
              key={h.id}
              onClick={() => setAbitazione(h.id)}
              className={`rounded-2xl border px-3 py-3 text-sm ${
                state.profilo.abitazione === h.id
                  ? "border-primary bg-surface-2"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <p className="mt-5 mb-2 text-xs text-muted-foreground">Hai un&apos;auto?</p>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => setAuto(v)}
              className={`rounded-2xl border px-3 py-3 text-sm ${
                state.profilo.auto === v
                  ? "border-primary bg-surface-2"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {v ? "Sì" : "No"}
            </button>
          ))}
        </div>

        <p className="mt-5 mb-2 text-xs text-muted-foreground">Persone in famiglia</p>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
          <button
            onClick={() => setPersone(Math.max(1, state.profilo.persone - 1))}
            className="h-9 w-9 rounded-full bg-surface-2 text-lg"
            aria-label="Diminuisci"
          >
            −
          </button>
          <span className="flex-1 text-center text-lg font-semibold">{state.profilo.persone}</span>
          <button
            onClick={() => setPersone(Math.min(12, state.profilo.persone + 1))}
            className="h-9 w-9 rounded-full bg-surface-2 text-lg"
            aria-label="Aumenta"
          >
            +
          </button>
        </div>

        {!confirmRicalcolo ? (
          <button
            onClick={() => setConfirmRicalcolo(true)}
            className="mt-5 w-full rounded-xl bg-surface-2 py-2.5 text-sm font-medium"
          >
            Ricalcola budget suggeriti in base al profilo
          </button>
        ) : (
          <div className="mt-5">
            <p className="mb-2 text-xs text-muted-foreground">
              Sostituisce il budget attuale di ogni categoria con una nuova proposta, mantenendo lo
              stesso totale. Puoi comunque modificarli dopo dalla scheda Budget.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRicalcolo(false)}
                className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={ricalcolaBudget}
                className="lime-fill flex-1 rounded-xl py-2.5 text-sm font-semibold"
              >
                Ricalcola
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card-hero grid grid-cols-2 gap-4 p-5">
        <div>
          <p className="text-xs text-muted-foreground">Transazioni totali</p>
          <p className="text-2xl font-semibold tracking-tight">{state.transazioni.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Primo utilizzo</p>
          <p className="text-sm font-medium">
            {formatDay(state.profilo.primoUtilizzo.slice(0, 10))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Categorie</p>
          <p className="text-2xl font-semibold tracking-tight">{state.categorie.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Speso in totale</p>
          <p className="text-lg font-semibold tracking-tight">
            {eur(state.transazioni.reduce((a, t) => a + t.importo, 0))}
          </p>
        </div>
      </section>

      <section className="card-surface space-y-2 p-5">
        <h2 className="mb-2 text-sm font-semibold">Excel</h2>
        <button
          onClick={() => {
            void (async () => {
              const n = await exportTransactions(state.transazioni, state.categorie);
              toast.success(`${n} transazioni esportate`);
            })();
          }}
          className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm"
        >
          <Download size={16} className="text-primary" /> Esporta tutte le transazioni
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm"
        >
          <Upload size={16} className="text-primary" /> Importa da file .xlsx
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importa(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => {
            void (async () => {
              await exportTemplate();
              toast.success("Modello scaricato");
            })();
          }}
          className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm"
        >
          <FileDown size={16} className="text-primary" /> Scarica modello vuoto
        </button>
        <p className="pt-1 text-[11px] text-muted-foreground">
          Colonne richieste: Data, Categoria, Importo, Nota. Le righe non valide vengono ignorate.
        </p>
      </section>

      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold">Reimposta app</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Cancella spese, categorie, ricorrenti e profilo dal tuo account.
        </p>
        {resetStep === 0 && (
          <button
            onClick={() => setResetStep(1)}
            className="mt-3 w-full rounded-xl border border-destructive py-2.5 text-sm font-medium text-destructive"
          >
            Reimposta app
          </button>
        )}
        {resetStep === 1 && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setResetStep(0)}
              className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm"
            >
              Annulla
            </button>
            <button
              onClick={() => setResetStep(2)}
              className="flex-1 rounded-xl border border-destructive py-2.5 text-sm text-destructive"
            >
              Sei sicuro?
            </button>
          </div>
        )}
        {resetStep === 2 && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setResetStep(0)}
              className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm"
            >
              No, torna indietro
            </button>
            <button
              onClick={() => {
                reset();
                toast.success("App reimpostata");
              }}
              className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
            >
              Cancella tutto
            </button>
          </div>
        )}
      </section>

      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        Conti in Tasca · i dati sono legati al tuo account e disponibili su ogni dispositivo dopo il
        login
      </p>
    </div>
  );
}
