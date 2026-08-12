import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FileDown, Upload } from "lucide-react";
import { useApp } from "@/lib/store";
import { eur, formatDay, uid } from "@/lib/format";
import { PALETTE } from "@/lib/types";
import { exportTemplate, exportTransactions, parseImportFile } from "@/lib/excel";

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
  const { state, update, reset } = useApp();
  const [nome, setNome] = useState(state.profilo.nome);
  const [resetStep, setResetStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const salvaNome = () => {
    update((s) => ({ ...s, profilo: { ...s.profilo, nome: nome.trim() } }));
    toast.success("Nome aggiornato");
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
        <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
        <div className="flex gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Il tuo nome"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={salvaNome}
            className="lime-fill rounded-xl px-4 text-sm font-semibold"
          >
            Salva
          </button>
        </div>
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
            const n = exportTransactions(state.transazioni, state.categorie);
            toast.success(`${n} transazioni esportate`);
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
            exportTemplate();
            toast.success("Modello scaricato");
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
          Cancella spese, categorie, ricorrenti e profilo da questo dispositivo.
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
        Conti in Tasca · i dati restano solo su questo dispositivo
      </p>
    </div>
  );
}
