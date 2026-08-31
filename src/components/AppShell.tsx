import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useApp } from "@/lib/store";
import { isFaceIdEnabled } from "@/lib/webauthn";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { getStoredFabCorner, readSafeArea, setStoredFabCorner, type FabCorner } from "@/lib/fab";
import { Onboarding } from "./Onboarding";
import { BottomNav } from "./BottomNav";
import { AddExpenseModal } from "./AddExpenseModal";
import { FaceIdGate } from "./FaceIdGate";

const FAB_SIZE = 56;
const FAB_MARGIN = 16;
const FAB_BOTTOM_GAP = 84;
const FAB_TOP_GAP = 12;

function fabRestPosition(corner: FabCorner, safeArea: { top: number; bottom: number }) {
  const w = typeof window !== "undefined" ? window.innerWidth : 0;
  const h = typeof window !== "undefined" ? window.innerHeight : 0;
  if (corner === "bottom-left") {
    return { x: FAB_MARGIN, y: h - FAB_BOTTOM_GAP - safeArea.bottom - FAB_SIZE };
  }
  if (corner === "top-right") {
    return { x: w - FAB_MARGIN - FAB_SIZE, y: FAB_TOP_GAP + safeArea.top };
  }
  return { x: w - FAB_MARGIN - FAB_SIZE, y: h - FAB_BOTTOM_GAP - safeArea.bottom - FAB_SIZE };
}

const UiContext = createContext<{ openAdd: () => void }>({ openAdd: () => {} });
export const useUi = () => useContext(UiContext);

export function AppShell({ children }: { children: ReactNode }) {
  const { state, loaded, loadError, retryLoad, account, syncing, offlinePending } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAuthRoute = pathname.startsWith("/auth") || pathname.startsWith("/reset-password");

  const [fabCorner, setFabCorner] = useState<FabCorner>(() => getStoredFabCorner());
  const [safeArea, setSafeArea] = useState({ top: 0, bottom: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [fabPressed, setFabPressed] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
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
  const startRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    setSafeArea(readSafeArea());
  }, []);

  const onFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    draggingRef.current = true;
    movedRef.current = false;
    setFabPressed(true);
    const rect = e.currentTarget.getBoundingClientRect();
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onFabPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!movedRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) movedRef.current = true;
    if (!movedRef.current) return;
    setDragPos({
      x: e.clientX - startRef.current.offsetX,
      y: e.clientY - startRef.current.offsetY,
    });
  };

  const onFabPointerEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setFabPressed(false);
    if (movedRef.current && dragPos) {
      const dropCenter = { x: dragPos.x + FAB_SIZE / 2, y: dragPos.y + FAB_SIZE / 2 };
      const corners: FabCorner[] = ["bottom-right", "bottom-left", "top-right"];
      let best: FabCorner = "bottom-right";
      let bestDist = Infinity;
      for (const c of corners) {
        const p = fabRestPosition(c, safeArea);
        const dist = Math.hypot(
          p.x + FAB_SIZE / 2 - dropCenter.x,
          p.y + FAB_SIZE / 2 - dropCenter.y,
        );
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      setFabCorner(best);
      setStoredFabCorner(best);
    }
    setDragPos(null);
  };

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
      <div className="app-frame flex min-h-screen items-center justify-center">
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
      <div className="app-frame flex min-h-screen flex-col items-center justify-center px-6 text-center">
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
      <div className="app-frame min-h-screen">
        {bannerVisible && (
          <div
            className={`fixed inset-x-0 top-0 z-50 bg-warn px-4 py-2 text-center text-xs font-medium text-background transition-transform duration-300 ease-out ${
              bannerIn ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            Sei offline: le modifiche sono salvate sul telefono e si sincronizzano da sole al
            ritorno della connessione
          </div>
        )}
        <div className="mx-auto w-full max-w-[430px] px-4 pt-[calc(env(safe-area-inset-top,0px)+28px)] pb-32">
          {children}
        </div>

        {(() => {
          const pos = dragPos ?? fabRestPosition(fabCorner, safeArea);
          return (
            <>
              {dragPos && (
                <div
                  aria-hidden
                  className="fixed inset-0 z-30 touch-none"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <button
                onPointerDown={onFabPointerDown}
                onPointerMove={onFabPointerMove}
                onPointerUp={onFabPointerEnd}
                onPointerCancel={onFabPointerEnd}
                onClick={() => {
                  if (!movedRef.current) setAddOpen(true);
                }}
                aria-label="Aggiungi spesa"
                className="lime-fill float-shadow fixed top-0 left-0 z-40 flex h-14 w-14 touch-none items-center justify-center rounded-full"
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${fabPressed ? 0.95 : 1})`,
                  transition: dragPos ? "none" : "transform 420ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <Plus size={26} strokeWidth={2.6} />
              </button>
            </>
          );
        })()}

        <BottomNav />
        <AddExpenseModal open={addOpen} onClose={() => setAddOpen(false)} />
      </div>
    </UiContext.Provider>
  );

  return locked ? <FaceIdGate userId={account.id}>{app}</FaceIdGate> : app;
}
