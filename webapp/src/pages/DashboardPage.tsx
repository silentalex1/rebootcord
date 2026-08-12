import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Rocket, LayoutGrid, Share2 } from "lucide-react";
import { TopNav } from "../components/TopNav";
import { ProjectCard } from "../components/ProjectCard";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import type { Project } from "../lib/types";

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [ownedRes, sharedRes] = await Promise.all([
        api.projects.list(),
        api.projects.listShared(),
      ]);
      setProjects(ownedRes.projects || []);
      setSharedProjects(sharedRes.projects || []);
    } finally {
      setLoading(false);
    }
  };

  const persist = async (next: Project[]) => {
    setProjects(next);
    await api.projects.saveAll(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.lang.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const filteredShared = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sharedProjects;
    return sharedProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.lang.toLowerCase().includes(q),
    );
  }, [sharedProjects, query]);

  const runningCount = projects.filter((p) => p.running).length;

  const handleCreate = async (project: Project) => {
    await persist([...projects, project]);
    push(`${project.name} created`, "success");
  };

  const handleStart = async (p: Project) => {
    const res = await api.projects.start(p.id);
    if (res.success) {
      updateProjectRunning(p.id, true);
      push(`${p.name} started`, "success");
    } else {
      push(res.message || `Could not start ${p.name}`, "error");
    }
  };

  const handleStop = async (p: Project) => {
    await api.projects.stop(p.id);
    updateProjectRunning(p.id, false);
    push(`${p.name} stopped`, "info");
  };

  const handleKill = async (p: Project) => {
    await api.projects.kill(p.id);
    updateProjectRunning(p.id, false);
    push(`${p.name} killed`, "info");
  };

  const handleRestart = async (p: Project) => {
    const res = await api.projects.restart(p.id);
    if (res.success) {
      updateProjectRunning(p.id, true);
      push(`${p.name} restarted`, "success");
    } else {
      push(res.message || `Could not restart ${p.name}`, "error");
    }
  };

  const updateProjectRunning = (id: number, running: boolean) => {
    setProjects((prev) => prev.map((x) => (x.id === id ? { ...x, running } : x)));
    setSharedProjects((prev) => prev.map((x) => (x.id === id ? { ...x, running } : x)));
  };

  const handleDelete = async (p: Project) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await api.projects.remove(p.id);
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
    push(`${p.name} deleted`, "info");
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-10 [container-type:inline-size]">
        <PageHeader
          icon={<LayoutGrid size={18} />}
          title="Your projects"
          subtitle={`${projects.length} project${projects.length === 1 ? "" : "s"} · ${runningCount} running`}
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 focus-within:border-border-bright">
            <Search size={15} className="text-text-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-mute"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
          >
            <Plus size={15} />
            New project
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[176px] animate-pulse rounded-2xl border border-border bg-surface"
              />
            ))}
          </div>
        ) : filtered.length === 0 && filteredShared.length === 0 ? (
          <EmptyState hasProjects={projects.length > 0 || sharedProjects.length > 0} onCreate={() => setShowCreate(true)} />
        ) : (
          <>
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onStart={handleStart}
                    onStop={handleStop}
                    onKill={handleKill}
                    onRestart={handleRestart}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
            {filteredShared.length > 0 && (
              <div className={filtered.length > 0 ? "mt-8" : ""}>
                <div className="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-text-mute">
                  <Share2 size={12} />
                  Shared with you
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredShared.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onStart={handleStart}
                      onStop={handleStop}
                      onKill={handleKill}
                      onRestart={handleRestart}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function EmptyState({
  hasProjects,
  onCreate,
}: {
  hasProjects: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-text-mute">
        <Rocket size={20} />
      </div>
      <h3 className="mb-1 text-[15px] font-bold">
        {hasProjects ? "No projects match your search" : "No projects yet"}
      </h3>
      <p className="mb-5 max-w-xs text-[13px] text-text-dim">
        {hasProjects
          ? "Try a different search term."
          : "Spin up a Discord bot or Minecraft server to get started."}
      </p>
      {!hasProjects && (
        <button
          onClick={onCreate}
          className="rounded-lg bg-red px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark"
        >
          Create your first project
        </button>
      )}
    </div>
  );
}
