export type FabCorner = "bottom-right" | "bottom-left" | "top-right";

const STORAGE_KEY = "fabCorner";

/** Angolo salvato sul dispositivo. Default: in basso a destra. */
export function getStoredFabCorner(): FabCorner {
  if (typeof window === "undefined") return "bottom-right";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "bottom-left" || v === "top-right" ? v : "bottom-right";
}

export function setStoredFabCorner(corner: FabCorner) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, corner);
}

/**
 * Legge i margini di sicurezza reali del telefono (notch, Dynamic Island,
 * home indicator) tramite un piccolo elemento sonda: env(safe-area-inset-*)
 * non è leggibile direttamente da JS, ma il valore risolto di un padding che
 * lo usa sì.
 */
export function readSafeArea(): { top: number; bottom: number } {
  if (typeof document === "undefined") return { top: 0, bottom: 0 };
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.top = "0";
  probe.style.left = "-9999px";
  probe.style.paddingTop = "env(safe-area-inset-top)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  document.body.removeChild(probe);
  return { top, bottom };
}
