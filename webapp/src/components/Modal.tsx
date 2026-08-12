import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${width} rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-mute transition hover:bg-surface-3 hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
