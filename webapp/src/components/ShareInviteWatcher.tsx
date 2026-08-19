import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { rcSocket } from "../lib/socket";
import type { ShareInvite } from "../lib/types";

export function ShareInviteWatcher() {
  const { me } = useSession();
  const [queue, setQueue] = useState<ShareInvite[]>([]);

  const poll = async () => {
    const res = await api.shareInvites.list();
    if (res.success && res.invites.length) {
      setQueue((prev) => {
        const known = new Set(prev.map((x) => x.id));
        const fresh = res.invites.filter((x) => !known.has(x.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    }
  };

  useEffect(() => {
    if (!me?.loggedIn) return;
    poll();
    const interval = window.setInterval(poll, 20000);
    const unsub = rcSocket.subscribe((data) => {
      if (data.event === "addedToProject") poll();
    });
    return () => {
      window.clearInterval(interval);
      unsub();
    };
  }, [me?.loggedIn]);

  const dismiss = async (invite: ShareInvite) => {
    setQueue((prev) => prev.filter((x) => x.id !== invite.id));
    await api.shareInvites.ack(invite.id);
  };

  if (!queue.length) return null;
  const current = queue[0];

  return (
    <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl shadow-black/50">
        <span className="mb-4 inline-block rounded-md bg-red px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          Shared
        </span>
        <p className="mb-6 text-[16px] font-bold leading-snug">
          {current.sender} has shared their {current.projectName} with you!
        </p>
        <button
          onClick={() => dismiss(current)}
          className="w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
        >
          Okay
        </button>
      </div>
    </div>
  );
}
