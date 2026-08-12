import { useEffect, useState } from "react";
import { Inbox as InboxIcon, Loader2, Mail, MailOpen, Send, Trash2 } from "lucide-react";
import { TopNav } from "../components/TopNav";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import type { InboxMessage } from "../lib/types";

export function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { me } = useSession();
  const { push } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.inbox.list();
      setMessages(res.messages || []);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (m: InboxMessage) => {
    if (m.read) return;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
    await api.inbox.markRead(m.id);
  };

  const remove = async (id: number) => {
    await api.inbox.remove(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    push("Message removed", "info");
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await api.inbox.send(title.trim(), body.trim());
      if (res.success) {
        setTitle("");
        setBody("");
        push("Broadcast sent", "success");
        load();
      } else {
        push(res.message || "Could not send", "error");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          icon={<InboxIcon size={18} />}
          title="Inbox"
          subtitle="Announcements and messages from the Reboot Cord team."
        />

        {me?.isAdmin && (
          <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-text-mute">
              Send broadcast
            </h2>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="mb-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message body"
              rows={3}
              className="mb-3 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            <button
              onClick={send}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send to everyone
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16 text-text-mute">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-[13px] text-text-dim">
            No messages yet.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                onClick={() => markRead(m)}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  m.read
                    ? "border-border bg-surface"
                    : "border-red/30 bg-red-soft/40"
                }`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {m.read ? (
                      <MailOpen size={14} className="text-text-mute" />
                    ) : (
                      <Mail size={14} className="text-red" />
                    )}
                    <h3 className="text-[14px] font-bold">{m.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-mute">
                      {new Date(m.ts).toLocaleDateString()}
                    </span>
                    {me?.isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(m.id);
                        }}
                        className="text-text-mute hover:text-red"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-text-dim">{m.body}</p>
                {m.linkUrl && (
                  <a
                    href={m.linkUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-block text-[12.5px] font-semibold text-red hover:underline"
                  >
                    {m.linkText || m.linkUrl} &rarr;
                  </a>
                )}
                {m.sender && (
                  <p className="mt-2 text-[11px] text-text-mute">from {m.sender}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
