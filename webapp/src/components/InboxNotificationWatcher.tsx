import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { InboxMessage } from "../lib/types";

const SEEN_KEY = "rc_inbox_notified_ids";

function getSeen(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}

function markSeen(id: number) {
  const seen = getSeen();
  seen.push(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-200)));
}

export function InboxNotificationWatcher() {
  const { me } = useSession();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<InboxMessage[]>([]);

  const poll = async () => {
    const res = await api.inbox.list();
    if (!res.success) return;
    const seen = new Set(getSeen());
    const fresh = (res.messages || []).filter((m) => m.popupVariant && !seen.has(m.id));
    if (fresh.length) {
      setQueue((prev) => {
        const known = new Set(prev.map((x) => x.id));
        const add = fresh.filter((m) => !known.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
    }
  };

  useEffect(() => {
    if (!me?.loggedIn) return;
    poll();
    const interval = window.setInterval(poll, 15000);
    return () => window.clearInterval(interval);
  }, [me?.loggedIn]);

  if (!queue.length) return null;
  const current = queue[0];
  const isStaff = current.popupVariant === "staff";

  const dismiss = () => {
    markSeen(current.id);
    setQueue((prev) => prev.filter((m) => m.id !== current.id));
    navigate("/dashboard/inbox");
  };

  return (
    <div className="fixed inset-0 z-[997] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl shadow-black/50">
        <span className="mb-4 inline-block rounded-md bg-red px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          {isStaff ? "Staff announcement system" : "New message"}
        </span>
        {isStaff ? (
          <p className="mb-6 text-[16px] font-bold leading-snug">You have a new Message!</p>
        ) : (
          <>
            <p className="mb-1.5 text-[16px] font-bold leading-snug">
              new message - [from {current.sender || "Reboot Cord"}]
            </p>
            <p className="mb-6 text-[13px] text-text-dim">check the new message out!</p>
          </>
        )}
        <button
          onClick={dismiss}
          className="w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
        >
          Okay
        </button>
      </div>
    </div>
  );
}
