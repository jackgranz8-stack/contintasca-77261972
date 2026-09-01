import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
/** Aria fra il pulsante "+" e il bordo superiore della barra di navigazione. */
const FAB_GAP_OVER_NAV = 14;
const FAB_TOP_GAP = 12;
const NAV_HEIGHT_FALLBACK = 58;

/**
 * Altezza della barra di navigazione, letta dalla variabile CSS --nav-height
 * (definita in styles.css). Così barra, spazio in fondo alle pagine e
 * posizione del "+" restano allineati da soli: si cambia il numero in un
 * punto solo e si sposta tutto insieme.
 */
function readNavHeight(): number {
  if (typeof document === "undefined") return NAV_HEIGHT_FALLBACK;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--nav-height");
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : NAV_HEIGHT_FALLBACK;
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Posizione di riposo del "+" nei tre angoli disponibili.
 *
 * Le misure vengono dalla CORNICE dell'app (.app-frame), non dalla finestra
 * del browser. Sul telefono le due coincidono, ma su tablet/computer la
 * cornice è un pannello centrato largo 430px: usando la finestra, il
 * pulsante finiva fuori dal pannello e spariva. Ricalcolando sulla cornice
 * funziona ovunque, e si riposiziona da solo anche quando si ruota lo
 * schermo o si ridimensiona la finestra.
 */
function fabRestPosition(
  corner: FabCorner,
  box: Box,
  safeArea: { top: number; bottom: number },
  navHeight: number,
) {
  const bottomY = box.h - safeArea.bottom - navHeight - FAB_GAP_OVER_NAV - FAB_SIZE;
  if (corner === "bottom-left") return { x: FAB_MARGIN, y: bottomY };
  if (corner === "top-right")
    return { x: box.w - FAB_MARGIN - FAB_SIZE, y: FAB_TOP_GAP + safeArea.top };
  return { x: box.w - FAB_MARGIN - FAB_SIZE, y: bottomY };
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
  const [navHeight, setNavHeight] = useState(NAV_HEIGHT_FALLBACK);
  const [box, setBox] = useState<Box>(() => ({
    x: 0,
    y: 0,
    w: typeof window !== "undefined" ? window.innerWidth : 390,
    h: typeof window !== "undefined" ? window.innerHeight : 844,
  }));
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [fabPressed, setFabPressed] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const frameElRef = useRef<HTMLDivElement | null>(null);
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

  const measure = useCallback(() => {
    const rect = frameElRef.current?.getBoundingClientRect();
    setBox({
      x: rect?.left ?? 0,
      y: rect?.top ?? 0,
      w: rect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 390),
      h: rect?.height ?? (typeof window !== "undefined" ? window.innerHeight : 844),
    });
    setSafeArea(readSafeArea());
    setNavHeight(readNavHeight());
  }, []);

  // Ref "a funzione": appena la cornice compare nel DOM la misuriamo, senza
  // aspettare un altro giro di rendering.
  const attachFrame = useCallback(
    (el: HTMLDivElement | null) => {
      frameElRef.current = el;
      if (el) measure();
    },
    [measure],
  );

  // Rotazione dello schermo, apertura di un telefono pieghevole, cambio di
  // dimensione della finestra sul computer: tutte le misure si rifanno.
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);

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
    // Coordinate relative alla cornice (vedi fabRestPosition), e trattenute
    // dentro i suoi bordi: il "+" non può più essere trascinato fuori.
    const rawX = e.clientX - startRef.current.offsetX - box.x;
    const rawY = e.clientY - startRef.current.offsetY - box.y;
    setDragPos({
      x: Math.min(box.w - FAB_MARGIN - FAB_SIZE, Math.max(FAB_MARGIN, rawX)),
      y: Math.min(
        box.h - safeArea.bottom - FAB_MARGIN - FAB_SIZE,
        Math.max(safeArea.top + FAB_TOP_GAP, rawY),
      ),
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
        const p = fabRestPosition(c, box, safeArea, navHeight);
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
      <div className="app-frame" ref={attachFrame}>
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

        {(() => {
          const pos = dragPos ?? fabRestPosition(fabCorner, box, safeArea, navHeight);
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
                  willChange: "transform",
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
