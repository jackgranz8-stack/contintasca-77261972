/**
 * Distingue i dispositivi Apple (iPhone, iPad, Mac con Safari) da tutti gli
 * altri. Usata solo per decidere come chiamare lo sblocco biometrico
 * nell'interfaccia: il meccanismo (WebAuthn) è identico ovunque, cambia solo
 * il nome mostrato all'utente.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ si presenta come "MacIntel" ma ha lo schermo touch: lo
  // distinguiamo così da un vero Mac senza touch.
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  return isIOS || isIPadOS || isMacSafari;
}

/** Nome dello sblocco biometrico da mostrare: "Face ID" solo su dispositivi Apple. */
export function biometricLabel(): string {
  return isApplePlatform() ? "Face ID" : "autenticazione biometrica";
}
