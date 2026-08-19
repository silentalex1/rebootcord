import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastContextValue {
  push: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((text: string, kind: ToastKind = "info") => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[999] flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3 shadow-2xl shadow-black/40"
          >
            {t.kind === "success" && (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" />
            )}
            {t.kind === "error" && (
              <XCircle size={16} className="mt-0.5 shrink-0 text-red" />
            )}
            {t.kind === "info" && (
              <Info size={16} className="mt-0.5 shrink-0 text-text-dim" />
            )}
            <p className="flex-1 text-[13px] leading-snug text-text">{t.text}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-text-mute transition hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
