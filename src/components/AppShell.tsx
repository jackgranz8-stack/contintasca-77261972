import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { isFaceIdEnabled } from "@/lib/webauthn";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { Onboarding } from "./Onboarding";
import { BottomNav } from "./BottomNav";
import { AddExpenseModal } from "./AddExpenseModal";
import { FaceIdGate } from "./FaceIdGate";

const UiContext = createContext<{ openAdd: () => void }>({ openAdd: () => {} });
export const useUi = () => useContext(UiContext);

export function AppShell({ children }: { children: ReactNode }) {
  const { state, loaded, loadError, retryLoad, account, syncing, offlinePending } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAuthRoute = pathname.startsWith("/auth") || pathname.startsWith("/reset-password");

  const [bannerVisible, setBannerVisible] = useState(offlinePending);
  const [bannerIn, setBannerIn] = useState(false);

  useEffect(() => {
    if (offlinePending) {
      setBannerVisible(true);
      const raf = requestAnimationFrame(() => setBannerIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setBannerIn(false);
    const t = window.setTimeout(() => setBannerVisible(false), 300);
    return () => window.clearTimeout(t);
  }, [offlinePending]);

  /*
   * Registra il service worker (public/sw.js), che è quello che rende l'app
   * utilizzabile anche senza rete: tiene in memoria sul telefono la
   * schermata e i file dell'app, così all'apertura successiva partono da
   * lì invece che dalla connessione.
   *
   * Prima veniva registrato SOLO se si attivavano le notifiche push: chi non
   * le usava non aveva alcuna copia offline. Ora parte sempre, appena l'app
   * si apre. La registrazione è la stessa ("/sw.js"), quindi le notifiche
   * continuano a funzionare esattamente come prima.
   */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Non blocca né rallenta l'avvio: se fallisce, l'app funziona comunque
    // normalmente, solo senza copia offline.
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Senza account si accede prima di tutto: nessun onboarding, nessun dato.
  useEffect(() => {
    if (loaded && !account && !isAuthRoute) void navigate({ to: "/auth", replace: true });
  }, [loaded, account, isAuthRoute, navigate]);

  // Applica subito il tema salvato (la classe è già impostata dallo script inline
  // in __root.tsx contro il "flash"; qui sincronizziamo anche la tinta della status
  // bar) e resta in ascolto dei cambi di tema del telefono mentre si è su "Automatico".
  useEffect(() => {
    applyTheme(getStoredTheme());
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // La pagina di accesso ha un layout autonomo (nessun onboarding, nessuna nav).
  if (isAuthRoute) return <>{children}</>;

  if (!loaded || !account) {
    return (
      <div className="app-frame flex items-center justify-center">
        <span
          aria-hidden
          className="inline-block animate-spin text-4xl leading-none font-bold text-primary"
        >
          €
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-frame flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold">Non riesco a leggere i tuoi dati</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Sembra un problema di connessione momentaneo. I tuoi dati sono al sicuro, non è stato
          toccato nulla: riprova appena hai rete.
        </p>
        <button
          onClick={retryLoad}
          disabled={syncing}
          className="lime-fill mt-6 rounded-2xl px-6 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {syncing ? "Verifico..." : "Riprova"}
        </button>
      </div>
    );
  }

  const locked = isFaceIdEnabled(account.id);

  if (!state.profilo.onboardingCompletato) {
    return locked ? (
      <FaceIdGate userId={account.id}>
        <Onboarding />
      </FaceIdGate>
    ) : (
      <Onboarding />
    );
  }

  const app = (
    <UiContext.Provider value={{ openAdd: () => setAddOpen(true) }}>
      <div className="app-frame">
        <div className="app-scroll">
          {/* safe-x: margini laterali che diventano più larghi in orizzontale
              sugli iPhone con la tacca, così il contenuto non ci finisce sotto.
              pb-nav: spazio in fondo pari a barra + barra gesti + aria. */}
          <div className="safe-x pb-nav mx-auto w-full max-w-[430px] pt-[calc(env(safe-area-inset-top,0px)+28px)]">
            {children}
          </div>
        </div>

        {bannerVisible && (
          <div
            className={`fixed inset-x-0 top-0 z-50 bg-warn px-4 pb-2 text-center text-xs font-medium text-background transition-transform duration-300 ease-out ${
              bannerIn ? "translate-y-0" : "-translate-y-full"
            }`}
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
              willChange: "transform",
            }}
          >
            Sei offline: le modifiche sono salvate sul telefono e si sincronizzano da sole al
            ritorno della connessione
          </div>
        )}

        <BottomNav onAdd={() => setAddOpen(true)} />
        <AddExpenseModal open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    </UiContext.Provider>
  );

  return locked ? <FaceIdGate userId={account.id}>{app}</FaceIdGate> : app;
}
