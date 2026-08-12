import { useEffect, useState } from "react";
import { Heart, Loader2, Plus, ScrollText, Trash2 } from "lucide-react";
import { TopNav } from "../components/TopNav";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import type { Changelog } from "../lib/types";

function toDatetimeLocal(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderBody(body: string) {
  const lines = body.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flush = () => {
    if (bulletBuffer.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="mb-3 ml-4 list-disc space-y-1 text-[13.5px] leading-relaxed text-text-dim">
          {bulletBuffer.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bulletBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^[+*]\s*/.test(trimmed) && trimmed.replace(/^[+*]\s*/, "").length > 0) {
      bulletBuffer.push(trimmed.replace(/^[+*]\s*/, ""));
    } else {
      flush();
      if (trimmed) {
        blocks.push(
          <p key={`p-${idx}`} className="mb-3 text-[13.5px] leading-relaxed text-text-dim">
            {trimmed}
          </p>,
        );
      }
    }
  });
  flush();
  return blocks;
}

export function ChangelogsPage() {
  const [logs, setLogs] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dateValue, setDateValue] = useState(toDatetimeLocal(Date.now()));
  const [posting, setPosting] = useState(false);
  const { me } = useSession();
  const { push } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.changelogs.list();
      setLogs(res.changelogs || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (log: Changelog) => {
    const liked = me?.username ? log.likes.includes(me.username) : false;
    setLogs((prev) =>
      prev.map((l) =>
        l.id === log.id
          ? {
              ...l,
              likes: liked
                ? l.likes.filter((u) => u !== me?.username)
                : [...l.likes, me?.username || ""],
            }
          : l,
      ),
    );
    await api.changelogs.like(log.id);
  };

  const remove = async (id: number) => {
    await api.changelogs.remove(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    push("Changelog removed", "info");
  };

  const openForm = () => {
    setDateValue(toDatetimeLocal(Date.now()));
    setShowForm((s) => !s);
  };

  const post = async () => {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      const ts = dateValue ? new Date(dateValue).getTime() : Date.now();
      const res = await api.changelogs.create(title.trim(), body.trim(), false, ts && !isNaN(ts) ? ts : Date.now());
      if (res.success) {
        setTitle("");
        setBody("");
        setShowForm(false);
        push("Changelog posted", "success");
        load();
      } else {
        push(res.message || "Could not post", "error");
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          icon={<ScrollText size={18} />}
          title="Changelogs"
          subtitle="What's new on Reboot Cord."
          action={
            me?.isAdmin ? (
              <button
                onClick={openForm}
                className="flex items-center gap-1.5 rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark"
              >
                <Plus size={14} />
                Post Changelog
              </button>
            ) : undefined
          }
        />

        {showForm && (
          <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-text-mute">
              New changelog
            </h2>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] outline-none focus:border-red"
              />
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-red sm:w-auto"
              />
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"What changed?\nStart a line with + or * to make it a bullet point."}
              rows={5}
              className="mb-3 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] outline-none focus:border-red"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={post}
                disabled={posting || !title.trim() || !body.trim()}
                className="rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
              >
                {posting ? "Posting..." : "Publish"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-border-bright bg-surface-2 px-3.5 py-2 text-[12.5px] font-bold text-text-dim transition hover:text-text"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16 text-text-mute">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-[13px] text-text-dim">
            No changelogs yet.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const liked = me?.username ? log.likes.includes(me.username) : false;
              return (
                <div key={log.id} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-[16px] font-bold tracking-tight text-red underline decoration-red/40 underline-offset-4">
                      {log.title}
                    </h3>
                    {me?.isAdmin && (
                      <button
                        onClick={() => remove(log.id)}
                        className="text-text-mute hover:text-red"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="mb-3">{renderBody(log.body)}</div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] font-bold text-text-dim">
                      {log.author}
                    </span>
                    <span className="text-[11px] text-text-mute">
                      {new Date(log.ts).toLocaleDateString()},{" "}
                      {new Date(log.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleLike(log)}
                    className={`flex items-center gap-1.5 text-[12.5px] font-semibold transition ${
                      liked ? "text-red" : "text-text-mute hover:text-text-dim"
                    }`}
                  >
                    <Heart size={14} fill={liked ? "currentColor" : "none"} />
                    {log.likes.length}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
