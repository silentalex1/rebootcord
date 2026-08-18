import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Link2, Loader2, Mail, Send, Unlink } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import type { ApiKey, EmailSystemConfig } from "../lib/types";

const SITE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://rebootcord.world";

const CURL_SNIPPET = (subject: string, message: string) =>
  `curl -X POST ${SITE_ORIGIN}/api/v1/email-system/send \\
  -H "Authorization: rc_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"someone@example.com","name":"Alex"}'

# Subject: ${subject || "(set a subject below)"}
# Message: ${message || "(set a message below)"}`;

const SCRIPT_SNIPPET = (apiKey: string) =>
  `<script src="${SITE_ORIGIN}/api/sdk/emailsystem/${apiKey}"></script>`;

export function EmailSystemTab() {
  const [config, setConfig] = useState<EmailSystemConfig>({
    fromName: "",
    subject: "",
    message: "",
    enabled: false,
    apiKeyId: null,
  });
  const [savedConfig, setSavedConfig] = useState<EmailSystemConfig | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testName, setTestName] = useState("");
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [connectedKeyRaw, setConnectedKeyRaw] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  const { push } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.emailSystem.get();
      if (res.success) {
        setConfig(res.config);
        setSavedConfig(res.config);
        setSmtpConfigured(res.smtpConfigured !== false);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadKeys = async () => {
    const res = await api.apiKeys.list();
    if (res.success) setKeys(res.keys);
    setKeysLoaded(true);
  };

  const isDirty =
    !savedConfig ||
    savedConfig.fromName !== config.fromName ||
    savedConfig.subject !== config.subject ||
    savedConfig.message !== config.message ||
    savedConfig.enabled !== config.enabled;

  const save = async (): Promise<EmailSystemConfig | null> => {
    setSaving(true);
    try {
      const res = await api.emailSystem.save(config);
      if (res.success && res.config) {
        push("Email system saved", "success");
        setConfig(res.config);
        setSavedConfig(res.config);
        if (!res.config.apiKeyId) setShowKeyPicker(true);
        return res.config;
      }
      push(res.message || "Could not save email system", "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    try {
      let active = savedConfig;
      if (isDirty) {
        active = await save();
        if (!active) return;
      }
      if (!active?.enabled) {
        push("Enable the email system and save before sending a test.", "error");
        return;
      }
      const res = await api.emailSystem.test(testTo.trim(), testName.trim());
      push(res.message, res.success ? "success" : "error");
    } finally {
      setTesting(false);
    }
  };

  const openKeyPicker = () => {
    setShowKeyPicker(true);
    if (!keysLoaded) loadKeys();
  };

  const createKey = async () => {
    setCreatingKey(true);
    try {
      const res = await api.apiKeys.create();
      if (res.success) {
        push("API key created", "success");
        await loadKeys();
      } else {
        push("Could not create API key", "error");
      }
    } finally {
      setCreatingKey(false);
    }
  };

  const connectKey = async (id: string) => {
    setConnecting(id);
    try {
      const res = await api.emailSystem.connectKey(id);
      if (res.success && res.config) {
        setConfig(res.config);
        setSavedConfig(res.config);
        setShowKeyPicker(false);
        if (res.sdkUrl) {
          const raw = res.sdkUrl.split("/").pop() || null;
          setConnectedKeyRaw(raw);
        }
        push("API key connected to the email system", "success");
      } else {
        push(res.message || "Could not connect that key", "error");
      }
    } finally {
      setConnecting(null);
    }
  };

  const disconnectKey = async () => {
    const res = await api.emailSystem.disconnectKey();
    if (res.success) {
      setConfig((c) => ({ ...c, apiKeyId: null }));
      setSavedConfig((c) => (c ? { ...c, apiKeyId: null } : c));
      setConnectedKeyRaw(null);
      push("API key disconnected", "success");
    }
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(CURL_SNIPPET(config.subject, config.message));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyScript = () => {
    if (!connectedKeyRaw) return;
    navigator.clipboard.writeText(SCRIPT_SNIPPET(connectedKeyRaw));
    setScriptCopied(true);
    window.setTimeout(() => setScriptCopied(false), 1800);
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
                </code>
                ,{" "}
                <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px]">
                  {"{{email}}"}
                </code>{" "}
                and{" "}
                <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px]">
                  {"{{user}}"}
                </code>{" "}
                as placeholders.{" "}
                <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px]">
                  {"{{user}}"}
                </code>{" "}
                fills with the name you send, or the recipient's first name guessed
                from their email address if no name is given.
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

        {!smtpConfigured && (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[12px] text-yellow-500">
            SMTP isn't configured on the server yet, so emails won't actually send
            until SMTP_HOST, SMTP_USER and SMTP_PASS are set.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="email-from-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              From name
            </label>
            <input
              value={config.fromName}
              onChange={(e) => setConfig((c) => ({ ...c, fromName: e.target.value }))}
              placeholder="Reboot Cord"
              id="email-from-name"
              name="from-name"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
          </div>
          <div>
            <label htmlFor="email-subject" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              Subject
            </label>
            <input
              value={config.subject}
              onChange={(e) => setConfig((c) => ({ ...c, subject: e.target.value }))}
              placeholder="Confirm your email address"
              id="email-subject"
              name="subject"
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
              placeholder={"Hey {{user}}, thanks for reaching out. We'll get back to you soon."}
              rows={5}
              className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-red px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {isDirty && !saving && (
            <span className="text-[11.5px] text-text-mute">Unsaved changes</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[14.5px] font-bold tracking-tight">API key connection</h2>
          {config.apiKeyId ? (
            <span className="flex items-center gap-1.5 rounded-full bg-green-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-green">
              <Link2 size={12} /> Connected
            </span>
          ) : (
            <span className="rounded-full bg-surface-3 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-text-mute">
              Not connected
            </span>
          )}
        </div>
        <p className="mb-4 text-[12.5px] text-text-dim">
          Connect an API key so external sites can trigger this template with a
          single embeddable script tag.
        </p>

        {config.apiKeyId ? (
          <div className="space-y-3">
            {connectedKeyRaw ? (
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3.5 font-mono text-[11.5px] leading-relaxed text-text-dim">
                  {SCRIPT_SNIPPET(connectedKeyRaw)}
                </pre>
                <button
                  onClick={copyScript}
                  className="absolute right-2.5 top-2.5 rounded-md border border-border-bright bg-surface-2 p-1.5 text-text-mute hover:text-text"
                >
                  {scriptCopied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] text-text-mute">
                Key connected. Reveal it from the API keys tab to grab your script
                tag, or reconnect below to see it here.
              </p>
            )}
            <button
              onClick={disconnectKey}
              className="flex items-center gap-1.5 rounded-lg border border-border-bright bg-surface-2 px-3.5 py-2 text-[12.5px] font-bold text-text transition hover:bg-surface-3"
            >
              <Unlink size={13} />
              Disconnect API key
            </button>
          </div>
        ) : showKeyPicker ? (
          <div className="space-y-2">
            {!keysLoaded ? (
              <div className="flex justify-center py-6 text-text-mute">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : keys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-text-mute">
                No API keys yet.
                <button
                  onClick={createKey}
                  disabled={creatingKey}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
                >
                  <KeyRound size={13} />
                  {creatingKey ? "Creating..." : "Create API key"}
                </button>
              </div>
            ) : (
              <>
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                  >
                    <div>
                      <p className="font-mono text-[12.5px] text-text">{k.masked}</p>
                      <p className="text-[11px] text-text-mute">
                        Created {new Date(k.created).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => connectKey(k.id)}
                      disabled={connecting === k.id}
                      className="flex items-center gap-1.5 rounded-lg border border-border-bright bg-surface-3 px-3 py-1.5 text-[12px] font-bold text-text transition hover:bg-surface disabled:opacity-50"
                    >
                      {connecting === k.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Link2 size={12} />
                      )}
                      Connect
                    </button>
                  </div>
                ))}
                <button
                  onClick={createKey}
                  disabled={creatingKey}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-bright bg-surface-2 px-3.5 py-2 text-[12.5px] font-bold text-text transition hover:bg-surface-3 disabled:opacity-50"
                >
                  <KeyRound size={13} />
                  {creatingKey ? "Creating..." : "Create new API key"}
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={openKeyPicker}
            className="flex items-center gap-1.5 rounded-lg bg-red px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark"
          >
            <KeyRound size={13} />
            Create API key to connect the system API to
          </button>
        )}
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
            id="email-test-to"
            name="test-to"
            aria-label="Test recipient email"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
          />
          <input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Name to fill {{name}} / {{user}} with"
            id="email-test-name"
            name="test-name"
            aria-label="Test name"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
          />
        </div>
        <button
          onClick={sendTest}
          disabled={testing || !testTo.trim()}
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
