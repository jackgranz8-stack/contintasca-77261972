import { useEffect } from "react";

let locks = 0;

/** Blocca lo scroll/interazione dello sfondo mentre un popup è aperto. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevTouch = body.style.touchAction;
    locks += 1;
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        body.style.overflow = prevOverflow;
        body.style.touchAction = prevTouch;
      }
    };
  }, [active]);
}
