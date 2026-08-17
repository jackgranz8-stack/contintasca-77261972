import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
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
    // Il link dell'email crea una sessione temporanea di recupero.
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
    <div className="mx-auto w-full max-w-[430px] px-5 pt-[calc(env(safe-area-inset-top,0px)+56px)] pb-16">
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
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nuova password"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={conferma}
          onChange={(e) => setConferma(e.target.value)}
          placeholder="Conferma password"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
        />
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
