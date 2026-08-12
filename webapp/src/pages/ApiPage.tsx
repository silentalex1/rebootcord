import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Code2, Copy, KeyRound, Loader2, Lock, Mail, Package, Plus } from "lucide-react";
import { TopNav } from "../components/TopNav";
import { PageHeader } from "../components/PageHeader";
import { EmailSystemTab } from "../components/EmailSystemTab";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import type { ApiKey } from "../lib/types";

type Tab = "keys" | "email" | "sdks";

const SDKS = [
  {
    file: "rebootdevice.js",
    title: "Device Detection",
    desc: "Detects the visitor's device, OS, and browser so bot dashboards can tailor their UI.",
    snippet: '<script src="{origin}/sdk/rebootdevice.js"></script>',
  },
  {
    file: "rebootfeedback.js",
    title: "Feedback Widget",
    desc: "Drop-in feedback form that posts straight into your bot's inbox.",
    snippet: '<script src="{origin}/sdk/rebootfeedback.js"></script>',
  },
  {
    file: "rebootui.js",
    title: "UI Kit",
    desc: "Reboot Cord's dark theme components (cards, buttons, glass panels) for any bot dashboard.",
    snippet: '<script src="{origin}/sdk/rebootui.js"></script>',
  },
];

export function ApiPage() {
  const { me, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (me?.loggedIn) load();
    else setLoading(false);
  }, [me?.loggedIn]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.apiKeys.list();
      setKeys(res.keys || []);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    setCreating(true);
    try {
      const res = await api.apiKeys.create();
      if (res.success) {
        setRevealed(res.key);
        push("New API key created", "success");
        load();
      }
    } finally {
      setCreating(false);
    }
  };

  const copyKey = () => {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-mute">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (!me?.loggedIn) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
            <button onClick={() => navigate("/")}>
              <Logo size="sm" />
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-text-dim transition hover:text-text"
            >
              <ArrowLeft size={14} />
              Go back
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 text-red">
            <Lock size={20} />
          </div>
          <h1 className="mb-2 text-[22px] font-bold tracking-tight">
            Log in to use Our API
          </h1>
          <p className="mx-auto mb-6 max-w-sm text-[13.5px] leading-relaxed text-text-dim">
            Create an account or log in to generate API keys and set up your
            email system.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="rounded-lg bg-red px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/account-setup")}
              className="rounded-lg border border-border-bright bg-surface-2 px-5 py-2.5 text-[13px] font-bold text-text transition hover:bg-surface-3"
            >
              Create account
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          icon={<Code2 size={18} />}
          title="Our API"
          subtitle="Manage API keys for programmatic access to Reboot Cord."
          action={
            tab === "keys" ? (
              <button
                onClick={createKey}
                disabled={creating}
                className="flex items-center gap-1.5 rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                New key
              </button>
            ) : undefined
          }
        />

        <div className="mb-6 flex gap-1 rounded-xl bg-surface-2 p-1">
          <button
            onClick={() => setTab("keys")}
            className={`flex-1 rounded-lg py-2 text-[12.5px] font-bold transition ${
              tab === "keys" ? "bg-surface-3 text-text" : "text-text-mute hover:text-text-dim"
            }`}
          >
            API keys
          </button>
          <button
            onClick={() => setTab("email")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold transition ${
              tab === "email" ? "bg-surface-3 text-text" : "text-text-mute hover:text-text-dim"
            }`}
          >
            <Mail size={13} />
            Email system API
          </button>
          <button
            onClick={() => setTab("sdks")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold transition ${
              tab === "sdks" ? "bg-surface-3 text-text" : "text-text-mute hover:text-text-dim"
            }`}
          >
            <Package size={13} />
            SDKs
          </button>
        </div>

        {tab === "sdks" ? (
          <SdksTab />
        ) : tab === "email" ? (
          <EmailSystemTab />
        ) : (
          <>
            {revealed && (
              <div className="mb-6 rounded-2xl border border-green/30 bg-green-soft p-4">
                <p className="mb-2 text-[12.5px] font-semibold text-green">
                  Copy this key now — you won't be able to see it again.
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                  <code className="flex-1 truncate font-mono text-[12.5px] text-text">
                    {revealed}
                  </code>
                  <button
                    onClick={copyKey}
                    className="shrink-0 text-text-mute hover:text-text"
                  >
                    {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16 text-text-mute">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : keys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center text-[13px] text-text-dim">
                No API keys yet. Create one to get started.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                {keys.map((k, i) => (
                  <div
                    key={k.id}
                    className={`flex items-center justify-between px-4 py-3.5 ${
                      i > 0 ? "border-t border-border" : ""
                    } bg-surface`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-3 text-text-mute">
                        <KeyRound size={15} />
                      </div>
                      <div>
                        <p className="font-mono text-[13px] text-text">{k.masked}</p>
                        <p className="text-[11px] text-text-mute">
                          Created {new Date(k.created).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SdksTab() {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const origin = "https://rebootcord.world";

  const copy = (file: string, snippet: string) => {
    navigator.clipboard.writeText(snippet.replace("{origin}", origin));
    setCopiedFile(file);
    window.setTimeout(() => setCopiedFile(null), 1800);
  };

  return (
    <div className="space-y-4">
      {SDKS.map((sdk) => (
        <div key={sdk.file} className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-red">
                <Package size={18} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold tracking-tight">{sdk.title}</h3>
                <p className="font-mono text-[11.5px] text-text-mute">{sdk.file}</p>
              </div>
            </div>
            <a
              href={`/sdk/${sdk.file}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg border border-border-bright bg-surface-2 px-3 py-1.5 text-[11.5px] font-bold text-text-dim transition hover:text-text"
            >
              View source
            </a>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-text-dim">{sdk.desc}</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <code className="flex-1 truncate font-mono text-[12px] text-text">
              {sdk.snippet.replace("{origin}", origin)}
            </code>
            <button
              onClick={() => copy(sdk.file, sdk.snippet)}
              className="shrink-0 text-text-mute hover:text-text"
            >
              {copiedFile === sdk.file ? <Check size={14} className="text-green" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
