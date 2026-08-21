import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { db } from "@/integrations/external/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi — Conti in Tasca" },
      {
        name: "description",
        content:
          "Accedi a Conti in Tasca per ritrovare le tue spese e i tuoi budget su telefono e computer.",
      },
      { property: "og:title", content: "Accedi — Conti in Tasca" },
      {
        property: "og:description",
        content: "Un account per sincronizzare spese e budget su tutti i tuoi dispositivi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void db.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "reset") {
      if (!email.trim()) {
        toast.error("Inserisci la tua email");
        return;
      }
      setBusy(true);
      const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Ti abbiamo inviato il link per reimpostare la password");
      setMode("login");
      return;
    }
    if (!email.trim() || password.length < 6) {
      toast.error("Inserisci email e una password di almeno 6 caratteri");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await db.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        toast.success("Account creato!");
        void navigate({ to: "/", replace: true });
        return;
      }
      toast.success("Account creato! Controlla la mail per confermare.");
      setMode("login");
      return;
    }
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bentornato!");
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="app-frame mx-auto w-full max-w-[430px] px-5 pt-[calc(env(safe-area-inset-top,0px)+56px)] pb-16">
      <span className="lime-fill flex h-14 w-14 items-center justify-center rounded-2xl">
        <Wallet size={26} />
      </span>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Conti in Tasca</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login"
          ? "Accedi per ritrovare spese, budget e ricorrenti su ogni dispositivo."
          : mode === "signup"
            ? "Crea un account: i tuoi dati restano legati solo a te."
            : "Inserisci la tua email: ti inviamo un link per reimpostare la password."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
        />
        {mode !== "reset" && (
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-4 text-base outline-none placeholder:text-muted-foreground"
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="lime-fill flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Accedi" : mode === "signup" ? "Crea account" : "Invia link di reset"}
        </button>
      </form>

      {mode === "login" && (
        <button
          onClick={() => setMode("reset")}
          className="mt-4 w-full text-center text-sm text-primary"
        >
          Password dimenticata?
        </button>
      )}

      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-6 w-full text-center text-sm text-muted-foreground"
      >
        {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
      </button>
    </div>
  );
}
