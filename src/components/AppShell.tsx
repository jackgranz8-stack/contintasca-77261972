import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { Onboarding } from "./Onboarding";
import { BottomNav } from "./BottomNav";
import { AddExpenseModal } from "./AddExpenseModal";

const UiContext = createContext<{ openAdd: () => void }>({ openAdd: () => {} });
export const useUi = () => useContext(UiContext);

export function AppShell({ children }: { children: ReactNode }) {
  const { state, loaded, account } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAuthRoute = pathname.startsWith("/auth");

  // Senza account si accede prima di tutto: nessun onboarding, nessun dato.
  useEffect(() => {
    if (loaded && !account && !isAuthRoute) void navigate({ to: "/auth", replace: true });
  }, [loaded, account, isAuthRoute, navigate]);

  // La pagina di accesso ha un layout autonomo (nessun onboarding, nessuna nav).
  if (isAuthRoute) return <>{children}</>;

  if (!loaded || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!state.profilo.onboardingCompletato) return <Onboarding />;

  const showFab = pathname === "/" || pathname.startsWith("/storico");

  return (
    <UiContext.Provider value={{ openAdd: () => setAddOpen(true) }}>
      <div className="mx-auto w-full max-w-[430px] px-4 pt-[calc(env(safe-area-inset-top,0px)+28px)] pb-32">
        {children}
      </div>


      {showFab && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Aggiungi spesa"
          className="lime-fill float-shadow fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-[max(16px,calc(50vw-215px+16px))] z-40 flex h-14 w-14 items-center justify-center rounded-full active:scale-95"
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
      )}

      <BottomNav />
      <AddExpenseModal open={addOpen} onClose={() => setAddOpen(false)} />
    </UiContext.Provider>
  );
}
