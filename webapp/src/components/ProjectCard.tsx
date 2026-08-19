import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Server,
  Square,
  Power,
  RotateCw,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Project } from "../lib/types";
import { slugify } from "../lib/slug";
import { StatusPill, TagPill } from "./StatusPill";

interface ProjectCardProps {
  project: Project;
  onStart: (p: Project) => Promise<void>;
  onStop: (p: Project) => Promise<void>;
  onKill: (p: Project) => Promise<void>;
  onRestart: (p: Project) => Promise<void>;
  onDelete: (p: Project) => Promise<void>;
}

export function ProjectCard({
  project,
  onStart,
  onStop,
  onKill,
  onRestart,
  onDelete,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const Icon = project.type === "minecraft" ? Server : Bot;

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-surface p-5 transition hover:border-border-bright hover:bg-surface-2/60">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-text-dim transition group-hover:text-red">
          <Icon size={18} />
        </div>
        <StatusPill running={project.running} />
      </div>

      <button
        onClick={() => navigate(`/dashboard/project/${slugify(project.name)}`)}
        className="mb-1 text-left text-[15px] font-bold tracking-tight text-text hover:text-red"
      >
        {project.name}
      </button>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <TagPill>{project.lang || project.type}</TagPill>
        {project.type === "minecraft" && project.version && (
          <TagPill>{project.version}</TagPill>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-1">
        <button
          onClick={() => navigate(`/dashboard/project/${slugify(project.name)}`)}
          className="flex-1 rounded-lg bg-surface-3 px-3 py-2 text-[12px] font-bold text-text transition hover:bg-border-bright"
        >
          Manage
        </button>
        {project.running ? (
          <IconBtn
            title="Stop"
            busy={busy === "stop"}
            onClick={() => run("stop", () => onStop(project))}
          >
            <Square size={13} />
          </IconBtn>
        ) : (
          <IconBtn
            title="Start"
            tone="green"
            busy={busy === "start"}
            onClick={() => run("start", () => onStart(project))}
          >
            <Power size={13} />
          </IconBtn>
        )}
        <IconBtn
          title="Restart"
          tone="blue"
          busy={busy === "restart"}
          onClick={() => run("restart", () => onRestart(project))}
        >
          <RotateCw size={13} />
        </IconBtn>
        <IconBtn
          title="Kill"
          tone="red"
          busy={busy === "kill"}
          onClick={() => run("kill", () => onKill(project))}
        >
          <Power size={13} />
        </IconBtn>
        <IconBtn
          title="Delete"
          busy={busy === "delete"}
          onClick={() => run("delete", () => onDelete(project))}
        >
          <Trash2 size={13} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  tone,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "red" | "green" | "blue";
  busy?: boolean;
}) {
  const toneCls =
    tone === "red"
      ? "hover:border-red/40 hover:text-red"
      : tone === "green"
        ? "hover:border-green/40 hover:text-green"
        : tone === "blue"
          ? "hover:border-sky-500/40 hover:text-sky-400"
          : "hover:border-border-bright hover:text-text";
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={busy}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-mute transition disabled:opacity-50 ${toneCls}`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : children}
    </button>
  );
}
