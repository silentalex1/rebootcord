import { useState } from "react";
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
  const { me, setAvatarColor } = useSession();
  const [color, setColor] = useState(me?.avatarColor || PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

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

  return (
    <Modal title="Customize your profile" onClose={onClose}>
      <div className="mb-5 flex justify-center">
        <Avatar username={me?.username || "?"} color={color} size={64} />
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
    </Modal>
  );
}
