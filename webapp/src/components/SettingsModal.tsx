import { useState } from "react";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";

export function SettingsModal({
  projectId,
  initialName,
  initialPrivate,
  initialHasPassword,
  onClose,
  onSaved,
}: {
  projectId: number;
  initialName: string;
  initialPrivate: boolean;
  initialHasPassword: boolean;
  onClose: () => void;
  onSaved: (name: string, isPrivate: boolean, hasPassword: boolean) => void;
}) {
  const [name, setName] = useState(initialName);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      const payload: { name?: string; private?: boolean; password?: string } = {
        name: name.trim() || initialName,
        private: isPrivate,
      };
      if (clearPassword) payload.password = "";
      else if (password.trim()) payload.password = password.trim();
      const res = await api.projects.settings(projectId, payload);
      if (res.success) {
        onSaved(res.name || name, !!res.private, !!res.hasPassword);
        push("Settings saved", "success");
        onClose();
      } else {
        push("Could not save settings", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Project settings" onClose={onClose}>
      <div className="mb-4">
        <label htmlFor="settings-project-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
          Project name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          id="settings-project-name"
          name="project-name"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-red focus:bg-surface"
        />
      </div>

      <label className="mb-4 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <span className="text-[12.5px] font-semibold text-text-dim">Private project</span>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="h-4 w-4 accent-red"
        />
      </label>

      <div className="mb-2">
        <label htmlFor="settings-password" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
          {initialHasPassword ? "Change password" : "Set a password"}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (e.target.value) setClearPassword(false);
          }}
          placeholder="Leave blank to keep current"
          disabled={clearPassword}
          id="settings-password"
          name="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-red focus:bg-surface disabled:opacity-50"
        />
        {initialHasPassword && (
          <label className="mt-2 flex items-center gap-2 text-[12px] text-text-mute">
            <input
              type="checkbox"
              checked={clearPassword}
              onChange={(e) => {
                setClearPassword(e.target.checked);
                if (e.target.checked) setPassword("");
              }}
              className="h-3.5 w-3.5 accent-red"
            />
            Remove password protection
          </label>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </Modal>
  );
}
