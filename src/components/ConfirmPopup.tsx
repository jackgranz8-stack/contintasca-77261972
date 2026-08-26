import { useEffect, useState, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

export function ConfirmPopup({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const raf = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setAnimateIn(false);
    const timer = window.setTimeout(() => setVisible(false), 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  useScrollLock(visible);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-none px-6">
      <button
        aria-label="Annulla"
        onClick={onClose}
        className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-200 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative z-10 w-full max-w-[340px] rounded-3xl border border-border bg-popover p-5 transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm font-medium"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
