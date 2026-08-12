import { useEffect, useState } from "react";
import { Heart, Loader2, Plus, ScrollText, Trash2 } from "lucide-react";
import { TopNav } from "../components/TopNav";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import type { Changelog } from "../lib/types";

export function ChangelogsPage() {
  const [logs, setLogs] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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

  const post = async () => {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      const res = await api.changelogs.create(title.trim(), body.trim(), false);
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
                onClick={() => setShowForm((s) => !s)}
                className="flex items-center gap-1.5 rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark"
              >
                <Plus size={14} />
                Post
              </button>
            ) : undefined
          }
        />

        {showForm && (
          <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="mb-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What changed?"
              rows={4}
              className="mb-3 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            <button
              onClick={post}
              disabled={posting}
              className="rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-red-dark disabled:opacity-50"
            >
              {posting ? "Posting..." : "Publish"}
            </button>
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
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-bold tracking-tight">{log.title}</h3>
                    {me?.isAdmin && (
                      <button
                        onClick={() => remove(log.id)}
                        className="text-text-mute hover:text-red"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mb-3 text-[11px] text-text-mute">
                    {log.author} &middot; {new Date(log.ts).toLocaleDateString()}
                  </p>
                  <p className="mb-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-dim">
                    {log.body}
                  </p>
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
