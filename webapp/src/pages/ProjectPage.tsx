import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  Lock,
  Power,
  RotateCw,
  Save,
  Settings as SettingsIcon,
  Share2,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  FilePlus,
  FolderPlus,
  Upload,
} from "lucide-react";
import { TopNav } from "../components/TopNav";
import { StatusPill, TagPill } from "../components/StatusPill";
import { FileTree } from "../components/FileTree";
import { CodeEditor } from "../components/CodeEditor";
import { ShareModal } from "../components/ShareModal";
import { SettingsModal } from "../components/SettingsModal";
import { UploadModal } from "../components/UploadModal";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";
import { rcSocket } from "../lib/socket";
import { slugify } from "../lib/slug";
import type { FileNode, Project, ProjectAccess } from "../lib/types";

type Tab = "files" | "console";

export function ProjectPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");

  const [tree, setTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "Type a command and press enter. Try 'help'.",
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const projectId = project?.id ?? null;

  useEffect(() => {
    resolveProject();
  }, [slug]);

  useEffect(() => {
    if (!projectId || access?.locked) return;
    loadTree();
  }, [projectId, access?.locked]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines, tab]);

  useEffect(() => {
    if (!projectId) return;
    return rcSocket.subscribe((data) => {
      if (data.projectId !== projectId) return;
      if (data.event === "log") {
        setTerminalLines((prev) => [...prev, String(data.msg ?? "")]);
      } else if (data.event === "statusChange") {
        setProject((prev) => (prev ? { ...prev, running: !!data.running } : prev));
      } else if (data.event === "installAllDone") {
        setInstalling(false);
        push(data.success ? "All dependencies installed" : "Install failed, check console", data.success ? "success" : "error");
      } else if (data.event === "removedFromProject") {
        push("You were removed from this project", "info");
        navigate("/dashboard");
      }
    });
  }, [projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const resolveProject = async () => {
    if (!slug) return;
    const [owned, sharedRes] = await Promise.all([api.projects.list(), api.projects.listShared()]);
    const ownedMatch = (owned.projects || []).find((p) => slugify(p.name) === slug);
    if (ownedMatch) {
      setProject(ownedMatch);
      const acc = await api.projects.access(ownedMatch.id);
      setAccess(acc);
      return;
    }
    const sharedMatch = (sharedRes.projects || []).find((p) => slugify(p.name) === slug);
    if (sharedMatch) {
      setProject(sharedMatch);
      const acc = await api.projects.access(sharedMatch.id);
      setAccess(acc);
      return;
    }
    push("Project not found", "error");
    navigate("/dashboard");
  };

  const loadTree = async () => {
    if (!projectId) return;
    setLoadingTree(true);
    try {
      const res = await api.projects.dir(projectId);
      if (res.needsPassword) {
        setAccess((prev) => (prev ? { ...prev, locked: true } : prev));
        return;
      }
      setTree(res.files || []);
    } finally {
      setLoadingTree(false);
    }
  };

  const unlock = async () => {
    if (!projectId || !unlockPassword.trim()) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const res = await api.projects.unlock(projectId, unlockPassword.trim());
      if (res.success) {
        setAccess((prev) => (prev ? { ...prev, locked: false } : prev));
        setUnlockPassword("");
      } else {
        setUnlockError(res.message || "Incorrect password.");
      }
    } finally {
      setUnlocking(false);
    }
  };

  const openFile = async (rel: string) => {
    if (!projectId) return;
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
    if (!activeFile || !projectId) return;
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

  const runControl = async (action: "start" | "stop" | "restart" | "kill") => {
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

  const installAll = async () => {
    if (!projectId) return;
    setInstalling(true);
    setTab("console");
    const deps = await api.projects.detectDeps(projectId);
    rcSocket.send({ event: "installAll", projectId, pkgs: deps.packages || [] });
  };

  const runTerminalCommand = async () => {
    if (!projectId) return;
    const cmd = terminalInput.trim();
    if (!cmd) return;
    setTerminalLines((prev) => [...prev, `$ ${cmd}`]);
    setTerminalInput("");
    if (cmd === "clear") {
      setTerminalLines([]);
      return;
    }
    const res = await api.projects.terminal(projectId, cmd);
    setTerminalLines((prev) => [...prev, res.output || (res.success ? "" : "Command failed.")]);
    if (cmd === "ls" || cmd.startsWith("mkdir") || cmd.startsWith("rm")) loadTree();
  };

  const createFile = async () => {
    if (!projectId) return;
    const name = window.prompt("New file path (e.g. utils/helper.js)");
    if (!name) return;
    await api.projects.touch(projectId, name.trim());
    await loadTree();
    push(`Created ${name}`, "success");
  };

  const createFolder = async () => {
    if (!projectId) return;
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
  const canManage = access?.isOwner;

  if (!project || !access) {
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

  if (access.locked) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 text-red">
            <Lock size={20} />
          </div>
          <h1 className="mb-1 text-[18px] font-bold">{project.name} is password protected</h1>
          <p className="mb-5 text-[13px] text-text-dim">Enter the password to continue.</p>
          <input
            type="password"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="Password"
            className="mb-3 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-red"
          />
          {unlockError && <p className="mb-3 text-[12px] text-red">{unlockError}</p>}
          <button
            onClick={unlock}
            disabled={unlocking}
            className="w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark disabled:opacity-60"
          >
            {unlocking ? "Checking..." : "Unlock"}
          </button>
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
                {access.hasPassword && <Lock size={12} className="text-text-mute" />}
              </div>
              <div className="mt-1 flex gap-1.5">
                <TagPill>{project.lang || project.type}</TagPill>
                {project.ip && <TagPill>{project.ip}</TagPill>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <ControlBtn label="Share" icon={<Share2 size={13} />} onClick={() => setShowShare(true)} />
                <ControlBtn label="Settings" icon={<SettingsIcon size={13} />} onClick={() => setShowSettings(true)} />
              </>
            )}
            <ControlBtn
              label="Install all"
              icon={installing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              busy={installing}
              onClick={installAll}
            />
            {project.running ? (
              <ControlBtn label="Stop" icon={<Square size={13} />} busy={busyAction === "stop"} onClick={() => runControl("stop")} />
            ) : (
              <ControlBtn label="Start" icon={<Power size={13} />} tone="green" busy={busyAction === "start"} onClick={() => runControl("start")} />
            )}
            <ControlBtn label="Restart" icon={<RotateCw size={13} />} busy={busyAction === "restart"} onClick={() => runControl("restart")} />
            <ControlBtn label="Kill" icon={<Power size={13} />} tone="red" busy={busyAction === "kill"} onClick={() => runControl("kill")} />
            {canManage && <ControlBtn label="Delete" icon={<Trash2 size={13} />} tone="red" onClick={deleteProject} />}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-0 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="mb-4 flex flex-col rounded-2xl border border-border bg-surface md:mb-0 md:mr-4">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-mute">Files</span>
            <div className="flex gap-1">
              <button onClick={() => setShowUpload(true)} title="Upload" className="rounded-md p-1 text-text-mute hover:bg-surface-2 hover:text-text">
                <Upload size={13} />
              </button>
              <button onClick={createFile} title="New file" className="rounded-md p-1 text-text-mute hover:bg-surface-2 hover:text-text">
                <FilePlus size={13} />
              </button>
              <button onClick={createFolder} title="New folder" className="rounded-md p-1 text-text-mute hover:bg-surface-2 hover:text-text">
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
              <p className="px-2 py-4 text-center text-[12px] text-text-mute">No files yet.</p>
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

      {showShare && projectId && (
        <ShareModal
          projectId={projectId}
          shared={access.shared || []}
          onClose={() => setShowShare(false)}
          onChange={(shared) => setAccess((prev) => (prev ? { ...prev, shared } : prev))}
        />
      )}
      {showSettings && projectId && (
        <SettingsModal
          projectId={projectId}
          initialName={project.name}
          initialPrivate={!!access.private}
          initialHasPassword={!!access.hasPassword}
          onClose={() => setShowSettings(false)}
          onSaved={(name, isPrivate, hasPassword) => {
            setProject((prev) => (prev ? { ...prev, name } : prev));
            setAccess((prev) => (prev ? { ...prev, private: isPrivate, hasPassword } : prev));
            navigate(`/dashboard/project/${slugify(name)}`, { replace: true });
          }}
        />
      )}
      {showUpload && projectId && (
        <UploadModal projectId={projectId} onClose={() => setShowUpload(false)} onDone={loadTree} />
      )}
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
