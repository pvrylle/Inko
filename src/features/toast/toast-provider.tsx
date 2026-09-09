"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, PartyPopper, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastTone = "celebrate" | "success" | "info";
export type Toast = { id: string; title: string; message?: string; tone: ToastTone; durationMs?: number };

type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => string;
  celebrate: (title: string, message?: string) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon = { celebrate: PartyPopper, success: CheckCircle2, info: Info } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const durationMs = toast.durationMs ?? 4200;
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    const timer = setTimeout(() => dismissToast(id), durationMs);
    timers.current.set(id, timer);
    return id;
  }, [dismissToast]);

  const celebrate = useCallback((title: string, message?: string) => showToast({ title, message, tone: "celebrate" }), [showToast]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ toasts, showToast, celebrate, dismissToast }), [toasts, showToast, celebrate, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-viewport">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = toneIcon[toast.tone];
            return (
              <motion.article
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="toast"
                data-tone={toast.tone}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                initial={{ opacity: 0, y: 18, scale: 0.94 }}
                key={toast.id}
                role="status"
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
              >
                <span className="toast-icon" aria-hidden="true"><Icon size={17} /></span>
                <div>
                  <strong>{toast.title}</strong>
                  {toast.message && <p>{toast.message}</p>}
                </div>
                <button aria-label="Dismiss notification" className="toast-close" onClick={() => dismissToast(toast.id)} type="button"><X size={14} /></button>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToasts must be used within ToastProvider");
  return value;
}
