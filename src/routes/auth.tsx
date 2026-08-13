import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

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
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Inserisci email e una password di almeno 6 caratteri");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Account creato! Controlla la mail per confermare.");
      setMode("login");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bentornato!");
    void navigate({ to: "/", replace: true });
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Accesso con Google non riuscito");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pt-[max(env(safe-area-inset-top),28px)] pb-16">
      <button
        onClick={() => void navigate({ to: "/" })}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> Continua senza account
      </button>

      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "login" ? "Accedi" : "Crea account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Con un account le tue spese si sincronizzano tra telefono e computer.
      </p>

      <button
        onClick={google}
        disabled={busy}
        className="mt-6 w-full rounded-2xl border border-border bg-surface py-3.5 text-sm font-semibold disabled:opacity-60"
      >
        Continua con Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> oppure <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground"
        />
        <input
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy}
          className="lime-fill flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Accedi" : "Crea account"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-5 w-full text-center text-sm text-muted-foreground"
      >
        {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
      </button>
    </div>
  );
}
