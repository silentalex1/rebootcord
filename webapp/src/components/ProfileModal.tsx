import { useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";

const PALETTE = [
  "#ef4655",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { me, setAvatarColor, refresh } = useSession();
  const [color, setColor] = useState(me?.avatarColor || PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();
  const navigate = useNavigate();

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.profile.setAvatarColor(color);
      if (res.success) {
        setAvatarColor(color);
        push("Settings saved", "success");
        onClose();
      } else {
        push(res.message || "Could not save settings", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await api.logout();
    await refresh();
    onClose();
    push("Logged out", "info");
    navigate("/");
  };

  return (
    <Modal title="Customize your profile" onClose={onClose}>
      <div className="mb-5 flex flex-col items-center gap-2">
        <Avatar username={me?.username || "?"} color={color} size={64} />
        <span className="text-[13px] font-bold text-text-dim">
          [{me?.username || "?"}]
        </span>
      </div>
      <div className="mb-6 grid grid-cols-8 gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{ background: c }}
            className={`h-8 w-8 rounded-full transition ${
              color === c ? "ring-2 ring-text ring-offset-2 ring-offset-surface" : "hover:scale-110"
            }`}
          />
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
      <button
        onClick={logout}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-bright bg-surface-2 py-2.5 text-[13px] font-bold text-text-dim transition hover:border-red/40 hover:text-red"
      >
        <LogOut size={14} />
        Logout account
      </button>
    </Modal>
  );
}
