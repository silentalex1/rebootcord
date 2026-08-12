import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Power,
  RotateCw,
  Save,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { TopNav } from "../components/TopNav";
import { StatusPill, TagPill } from "../components/StatusPill";
import { FileTree } from "../components/FileTree";
import { CodeEditor } from "../components/CodeEditor";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import type { FileNode, Project } from "../lib/types";

type Tab = "files" | "console";

export function ProjectPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { push } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("files");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "Type a command and press enter. Try 'help'.",
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProject();
    loadTree();
  }, [projectId]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines, tab]);

  const loadProject = async () => {
    const res = await api.projects.list();
    const p = (res.projects || []).find((x) => x.id === projectId) || null;
    setProject(p);
  };

  const loadTree = async () => {
    setLoadingTree(true);
    try {
      const res = await api.projects.dir(projectId);
      setTree(res.files || []);
    } finally {
      setLoadingTree(false);
    }
  };

  const openFile = async (rel: string) => {
    setActiveFile(rel);
    setLoadingFile(true);
    setTab("files");
    try {
      const res = await api.projects.readFile(projectId, rel);
      const text = res.content ?? "";
      setContent(text);
      setOriginalContent(text);
    } finally {
      setLoadingFile(false);
    }
  };

  const saveFile = async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      const res = await api.projects.saveFile(projectId, activeFile, content);
      if (res.success) {
        setOriginalContent(content);
        push(`Saved ${activeFile}`, "success");
      } else {
        push("Could not save file", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const runControl = async (
    action: "start" | "stop" | "restart" | "kill",
  ) => {
    if (!project) return;
    setBusyAction(action);
    try {
      if (action === "start") {
        const r = await api.projects.start(project.id);
        setProject({ ...project, running: !!r.success });
        push(r.success ? "Started" : r.message || "Could not start", r.success ? "success" : "error");
      } else if (action === "stop") {
        await api.projects.stop(project.id);
        setProject({ ...project, running: false });
        push("Stopping...", "info");
      } else if (action === "restart") {
        const r = await api.projects.restart(project.id);
        setProject({ ...project, running: !!r.success });
        push(r.success ? "Restarted" : r.message || "Could not restart", r.success ? "success" : "error");
      } else if (action === "kill") {
        await api.projects.kill(project.id);
        setProject({ ...project, running: false });
        push("Killed", "info");
      }
    } finally {
      setBusyAction(null);
    }
  };

  const runTerminalCommand = async () => {
    const cmd = terminalInput.trim();
    if (!cmd) return;
    setTerminalLines((prev) => [...prev, `$ ${cmd}`]);
    setTerminalInput("");
    if (cmd === "clear") {
      setTerminalLines([]);
      return;
    }
    const res = await api.projects.terminal(projectId, cmd);
    setTerminalLines((prev) => [
      ...prev,
      res.output || (res.success ? "" : "Command failed."),
    ]);
    if (cmd === "ls" || cmd.startsWith("mkdir") || cmd.startsWith("rm")) loadTree();
  };

  const createFile = async () => {
    const name = window.prompt("New file path (e.g. utils/helper.js)");
    if (!name) return;
    await api.projects.touch(projectId, name.trim());
    await loadTree();
    push(`Created ${name}`, "success");
  };

  const createFolder = async () => {
    const name = window.prompt("New folder path");
    if (!name) return;
    await api.projects.mkdir(projectId, name.trim());
    await loadTree();
    push(`Created ${name}/`, "success");
  };

  const deleteProject = async () => {
    if (!project) return;
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await api.projects.remove(project.id);
    push(`${project.name} deleted`, "info");
    navigate("/dashboard");
  };

  const dirty = content !== originalContent;

  if (!project) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24 text-text-dim">
          <Loader2 size={18} className="mr-2 animate-spin" />
          Loading project...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="border-b border-border bg-surface/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-lg border border-border bg-surface-2 p-2 text-text-dim transition hover:text-text"
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-bold tracking-tight">{project.name}</h1>
                <StatusPill running={project.running} />
              </div>
              <div className="mt-1 flex gap-1.5">
                <TagPill>{project.lang || project.type}</TagPill>
                {project.ip && <TagPill>{project.ip}</TagPill>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {project.running ? (
              <ControlBtn
                label="Stop"
                icon={<Square size={13} />}
                busy={busyAction === "stop"}
                onClick={() => runControl("stop")}
              />
            ) : (
              <ControlBtn
                label="Start"
                icon={<Power size={13} />}
                tone="green"
                busy={busyAction === "start"}
                onClick={() => runControl("start")}
              />
            )}
            <ControlBtn
              label="Restart"
              icon={<RotateCw size={13} />}
              busy={busyAction === "restart"}
              onClick={() => runControl("restart")}
            />
            <ControlBtn
              label="Kill"
              icon={<Power size={13} />}
              tone="red"
              busy={busyAction === "kill"}
              onClick={() => runControl("kill")}
            />
            <ControlBtn
              label="Delete"
              icon={<Trash2 size={13} />}
              tone="red"
              onClick={deleteProject}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-0 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="mb-4 flex flex-col rounded-2xl border border-border bg-surface md:mb-0 md:mr-4">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-mute">
              Files
            </span>
            <div className="flex gap-1">
              <button
                onClick={createFile}
                title="New file"
                className="rounded-md p-1 text-text-mute hover:bg-surface-2 hover:text-text"
              >
                <FilePlus size={13} />
              </button>
              <button
                onClick={createFolder}
                title="New folder"
                className="rounded-md p-1 text-text-mute hover:bg-surface-2 hover:text-text"
              >
                <FolderPlus size={13} />
              </button>
            </div>
          </div>
          <div className="max-h-[440px] overflow-y-auto p-2 md:max-h-[560px]">
            {loadingTree ? (
              <div className="flex items-center justify-center py-8 text-text-mute">
                <Loader2 size={15} className="animate-spin" />
              </div>
            ) : tree.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] text-text-mute">
                No files yet.
              </p>
            ) : (
              <FileTree nodes={tree} activeFile={activeFile} onSelect={openFile} />
            )}
          </div>
        </aside>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex gap-1">
              <PanelTabBtn active={tab === "files"} onClick={() => setTab("files")}>
                Editor
              </PanelTabBtn>
              <PanelTabBtn active={tab === "console"} onClick={() => setTab("console")}>
                <TerminalIcon size={12} />
                Console
              </PanelTabBtn>
            </div>
            {tab === "files" && activeFile && (
              <button
                onClick={saveFile}
                disabled={!dirty || saving}
                className="flex items-center gap-1.5 rounded-lg bg-red px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-red-dark disabled:opacity-40"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {dirty ? "Save*" : "Saved"}
              </button>
            )}
          </div>

          <div className="h-[500px] flex-1">
            {tab === "files" ? (
              activeFile ? (
                loadingFile ? (
                  <div className="flex h-full items-center justify-center text-text-mute">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : (
                  <CodeEditor filename={activeFile} value={content} onChange={setContent} />
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-text-mute">
                  <p className="text-[13px]">Select a file to start editing</p>
                </div>
              )
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-text-dim">
                  {terminalLines.map((line, i) => (
                    <div key={i} className={line.startsWith("$") ? "text-text" : ""}>
                      {line || "\u00A0"}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                  <span className="font-mono text-[12px] text-text-mute">$</span>
                  <input
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runTerminalCommand();
                    }}
                    placeholder="ls, mkdir, help..."
                    className="flex-1 bg-transparent font-mono text-[12.5px] text-text outline-none placeholder:text-text-mute"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ControlBtn({
  label,
  icon,
  onClick,
  tone,
  busy,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "red" | "green";
  busy?: boolean;
}) {
  const toneCls =
    tone === "red"
      ? "border-red/30 text-red hover:bg-red-soft"
      : tone === "green"
        ? "border-green/30 text-green hover:bg-green-soft"
        : "border-border-bright text-text-dim hover:bg-surface-2 hover:text-text";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-lg border bg-surface-2 px-3 py-2 text-[12px] font-bold transition disabled:opacity-50 ${toneCls}`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PanelTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition ${
        active ? "bg-surface-3 text-text" : "text-text-mute hover:text-text-dim"
      }`}
    >
      {children}
    </button>
  );
}
