import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowBigUp, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { db } from "@/integrations/external/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nuova password — Conti in Tasca" },
      {
        name: "description",
        content: "Imposta una nuova password per il tuo account Conti in Tasca.",
      },
      { property: "og:title", content: "Nuova password — Conti in Tasca" },
      {
        property: "og:description",
        content: "Scegli una nuova password e torna a gestire le tue spese.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // Se il link è scaduto o già usato, Supabase reindirizza qui con un
    // errore nell'URL (nella query o nell'hash, a seconda del flusso) invece
    // che con una sessione valida: lo intercettiamo per dare un messaggio
    // chiaro invece di lasciare la pagina bloccata senza spiegazioni.
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const errorDescription =
      url.searchParams.get("error_description") ?? hashParams.get("error_description");
    if (errorDescription) {
      toast.error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
      window.history.replaceState({}, "", url.pathname);
    }

    // Il link dell'email crea una sessione temporanea di recupero (lo scambio
    // del "code", se presente, viene già gestito a livello globale appena
    // l'app si avvia).
    void db.auth.getSession().then(({ data }) => setPronto(Boolean(data.session)));
    const { data } = db.auth.onAuthStateChange((_e, session) => {
      if (session) setPronto(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }
    if (password !== conferma) {
      toast.error("Le due password non coincidono");
      return;
    }
    setBusy(true);
    const { error } = await db.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password aggiornata!");
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="app-page mx-auto w-full max-w-[430px] px-5 pt-[calc(env(safe-area-inset-top,0px)+56px)] pb-[calc(env(safe-area-inset-bottom,0px)+64px)]">
      <span className="lime-fill flex h-14 w-14 items-center justify-center rounded-2xl">
        <KeyRound size={24} />
      </span>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Nuova password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pronto
          ? "Scegli una nuova password per il tuo account."
          : "Apri questa pagina dal link ricevuto via email per poter cambiare la password."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <div className="relative">
          <input
            type={mostra ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={rilevaMaiusc}
            onKeyDown={rilevaMaiusc}
            placeholder="Nuova password"
            className="w-full rounded-2xl border border-border bg-surface py-4 pr-14 pl-4 text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            aria-label={mostra ? "Nascondi password" : "Mostra password"}
            aria-pressed={mostra}
            onClick={() => setMostra((v) => !v)}
            className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground"
          >
            {mostra ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <input
          type={mostra ? "text" : "password"}
          autoComplete="new-password"
          value={conferma}
          onChange={(e) => setConferma(e.target.value)}
          onKeyUp={rilevaMaiusc}
          onKeyDown={rilevaMaiusc}
          placeholder="Conferma password"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
        />
        {maiusc && (
          <p className="flex items-center gap-2 px-1 text-xs text-warn">
            <ArrowBigUp size={16} /> Blocco maiuscole attivo
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !pronto}
          className="lime-fill flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Salva password
        </button>
      </form>

      <button
        onClick={() => void navigate({ to: "/auth" })}
        className="mt-6 w-full text-center text-sm text-muted-foreground"
      >
        Torna all&apos;accesso
      </button>
    </div>
  );
}
