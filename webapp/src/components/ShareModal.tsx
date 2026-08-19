import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import type { SharedUser, SharePerms } from "../lib/types";

export function ShareModal({
  projectId,
  shared,
  onClose,
  onChange,
}: {
  projectId: number;
  shared: SharedUser[];
  onClose: () => void;
  onChange: (shared: SharedUser[]) => void;
}) {
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { push } = useToast();

  const invite = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await api.projects.share(projectId, trimmed);
      if (res.success && res.shared) {
        onChange(res.shared);
        setUsername("");
        push(`Shared with ${trimmed}`, "success");
      } else {
        push(res.message || "Could not share", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (u: string) => {
    const res = await api.projects.unshare(projectId, u);
    if (res.success && res.shared) {
      onChange(res.shared);
      push(`Removed ${u}`, "info");
    }
  };

  const togglePerm = async (u: SharedUser, key: keyof SharePerms) => {
    const perms = { ...u.perms, [key]: !u.perms[key] };
    const res = await api.projects.sharePerms(projectId, u.username, perms);
    if (res.success && res.shared) onChange(res.shared);
  };

  return (
    <Modal title="Share project" onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder="Discord username"
          id="share-username"
          name="username"
          aria-label="Discord username"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-red focus:bg-surface"
        />
        <button
          onClick={invite}
          disabled={submitting}
          className="shrink-0 rounded-lg bg-red px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-60"
        >
          Share
        </button>
      </div>

      {shared.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-[12.5px] text-text-mute">
          Not shared with anyone yet.
        </p>
      ) : (
        <div className="space-y-2">
          {shared.map((u) => (
            <div key={u.username} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-bold">{u.username}</span>
                <button
                  onClick={() => remove(u.username)}
                  className="text-text-mute transition hover:text-red"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <PermChip label="Edit files" on={u.perms.editFiles} onClick={() => togglePerm(u, "editFiles")} />
                <PermChip label="Rename" on={u.perms.changeName} onClick={() => togglePerm(u, "changeName")} />
                <PermChip label="Full access" on={u.perms.fullAccess} onClick={() => togglePerm(u, "fullAccess")} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PermChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
        on ? "bg-red-soft text-red" : "bg-surface-3 text-text-mute hover:text-text-dim"
      }`}
    >
      {on && <X size={10} className="rotate-45" />}
      {label}
    </button>
  );
}
