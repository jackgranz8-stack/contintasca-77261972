import { useState } from "react";

export type ThemePreference = "dark" | "light" | "system";

const STORAGE_KEY = "theme";

/** Preferenza salvata sul dispositivo. "system" = nessuna scelta esplicita, segue l'iPhone. */
export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

/** Applica la preferenza alla pagina corrente (classe su <html> + tinta della status bar). */
export function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const isLight =
    pref === "light" ||
    (pref === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("light", isLight);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isLight ? "#F6FAF6" : "#0A0F0C");
}

/** Salva la preferenza sul dispositivo e la applica subito. */
export function setTheme(pref: ThemePreference) {
  if (typeof window === "undefined") return;
  if (pref === "system") window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}

/** Hook per il selettore nel profilo: legge la preferenza attuale e permette di cambiarla. */
export function useThemePreference() {
  const [pref, setPref] = useState<ThemePreference>(() => getStoredTheme());
  const update = (next: ThemePreference) => {
    setTheme(next);
    setPref(next);
  };
  return [pref, update] as const;
}
