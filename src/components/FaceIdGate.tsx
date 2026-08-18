import { useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { verifyFaceId } from "@/lib/webauthn";

const SESSION_KEY = "faceid-unlocked";

export function isUnlockedThisSession(): boolean {
  return typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "true";
}

export function FaceIdGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => isUnlockedThisSession());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const tryUnlock = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await verifyFaceId(userId);
    setBusy(false);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setUnlocked(true);
    } else {
      setFailed(true);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-primary">
        <Fingerprint size={28} />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Sblocca Conti in Tasca</h1>
      <p className="mt-2 text-sm text-muted-foreground">Usa Face ID o Touch ID per continuare.</p>
      {failed && <p className="mt-3 text-xs text-destructive">Verifica non riuscita. Riprova.</p>}
      <button
        onClick={() => void tryUnlock()}
        disabled={busy}
        className="lime-fill mt-6 flex w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        Sblocca
      </button>
    </div>
  );
}
