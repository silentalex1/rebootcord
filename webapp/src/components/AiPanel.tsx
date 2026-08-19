import { useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

interface AiMessage {
  from: "user" | "ai";
  text: string;
}

interface AiPanelProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  variant?: "modal" | "dock";
}

export function AiPanel({ title, subtitle, onClose, variant = "modal" }: AiPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { from: "user", text },
      { from: "ai", text: "Reboot Cord AI is not connected yet. Check back soon." },
    ]);
    setInput("");
  };

  const panel = (
    <div className="flex h-[70vh] max-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red text-white">
            <Sparkles size={14} />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight">{title}</p>
            <p className="text-[11px] leading-tight text-text-mute">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-mute transition hover:bg-surface-3 hover:text-text"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-[12.5px] text-text-mute">
            Ask me anything about your bot.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                m.from === "user"
                  ? "ml-auto bg-red text-white"
                  : "bg-surface-2 text-text-dim"
              }`}
            >
              {m.text}
            </div>
          ))
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message Reboot Cord AI..."
          id="ai-message-input"
          name="ai-message"
          aria-label="Message"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] outline-none focus:border-red"
        />
        <button
          onClick={send}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red text-white transition hover:bg-red-dark"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );

  if (variant === "dock") {
    return (
      <div className="fixed inset-x-4 bottom-4 z-[996] sm:inset-x-auto sm:right-4 sm:w-96">
        {panel}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[996] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">{panel}</div>
    </div>
  );
}
