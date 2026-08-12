import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, Send } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import type { EmailSystemConfig } from "../lib/types";

const CURL_SNIPPET = (subject: string, message: string) =>
  `curl -X POST https://rebootcord.world/api/v1/email-system/send \\
  -H "Authorization: rc_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"someone@example.com","name":"Alex"}'

# Subject: ${subject || "(set a subject below)"}
# Message: ${message || "(set a message below)"}`;

export function EmailSystemTab() {
  const [config, setConfig] = useState<EmailSystemConfig>({
    fromName: "",
    subject: "",
    message: "",
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testName, setTestName] = useState("");
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.emailSystem.get();
      if (res.success) setConfig(res.config);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.emailSystem.save(config);
      if (res.success) {
        push("Email system saved", "success");
        if (res.config) setConfig(res.config);
      } else {
        push(res.message || "Could not save email system", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    try {
      const res = await api.emailSystem.test(testTo.trim(), testName.trim());
      push(res.message, res.success ? "success" : "error");
    } finally {
      setTesting(false);
    }
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(CURL_SNIPPET(config.subject, config.message));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-text-mute">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-red">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-[14.5px] font-bold tracking-tight">
                Auto-reply email
              </h2>
              <p className="text-[12.5px] text-text-dim">
                Set the message your website sends. Use{" "}
                <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px]">
                  {"{{name}}"}
                </code>{" "}
                and{" "}
                <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px]">
                  {"{{email}}"}
                </code>{" "}
                as placeholders.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              config.enabled
                ? "bg-green-soft text-green"
                : "bg-surface-3 text-text-mute"
            }`}
          >
            {config.enabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              From name
            </label>
            <input
              value={config.fromName}
              onChange={(e) => setConfig((c) => ({ ...c, fromName: e.target.value }))}
              placeholder="Reboot Cord"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              Subject
            </label>
            <input
              value={config.subject}
              onChange={(e) => setConfig((c) => ({ ...c, subject: e.target.value }))}
              placeholder="Confirm your email address"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              Message
            </label>
            <textarea
              value={config.message}
              onChange={(e) => setConfig((c) => ({ ...c, message: e.target.value }))}
              placeholder={"Hey {{name}}, thanks for reaching out. We'll get back to you soon."}
              rows={5}
              className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 rounded-lg bg-red px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 text-[14.5px] font-bold tracking-tight">Send a test</h2>
        <p className="mb-4 text-[12.5px] text-text-dim">
          Sends a real email using your saved template right now.
        </p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
          />
          <input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Name to fill {{name}} with"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
          />
        </div>
        <button
          onClick={sendTest}
          disabled={testing || !config.enabled}
          title={config.enabled ? undefined : "Enable and save the email system first"}
          className="flex items-center gap-1.5 rounded-lg border border-border-bright bg-surface-2 px-3.5 py-2 text-[12.5px] font-bold text-text transition hover:bg-surface-3 disabled:opacity-50"
        >
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Send test email
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 text-[14.5px] font-bold tracking-tight">
          Use it from your own site
        </h2>
        <p className="mb-4 text-[12.5px] text-text-dim">
          Call this endpoint with your API key to trigger your auto-reply from
          anywhere.
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3.5 font-mono text-[11.5px] leading-relaxed text-text-dim">
            {CURL_SNIPPET(config.subject, config.message)}
          </pre>
          <button
            onClick={copySnippet}
            className="absolute right-2.5 top-2.5 rounded-md border border-border-bright bg-surface-2 p-1.5 text-text-mute hover:text-text"
          >
            {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
