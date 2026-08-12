import { useState } from "react";
import { Bot, Server } from "lucide-react";
import { Modal } from "./Modal";
import type { Project, ProjectType } from "../lib/types";

const DISCORD_LANGS = ["JavaScript", "Python", "TypeScript", "Go", "Rust", "Java"];
const MC_VERSIONS = ["1.21.4", "1.20.6", "1.20.4", "1.19.4", "1.18.2", "1.16.5"];
const MC_TYPES = ["Vanilla", "Paper", "Spigot", "Forge", "Fabric"];

function defaultFile(lang: string): { name: string; code: string } {
  if (lang === "Python") return { name: "main.py", code: "import os\n\nprint('Bot starting...')\n" };
  if (lang === "TypeScript") return { name: "index.ts", code: "console.log('Bot starting...');\n" };
  if (lang === "Go") return { name: "main.go", code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Bot starting...")\n}\n' };
  if (lang === "Rust") return { name: "main.rs", code: 'fn main() {\n    println!("Bot starting...");\n}\n' };
  if (lang === "Java") return { name: "Main.java", code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Bot starting...");\n    }\n}\n' };
  return { name: "index.js", code: "console.log('Bot starting...');\n" };
}

export function CreateProjectModal({
  onClose,
  onCreate,
  existingCount,
}: {
  onClose: () => void;
  onCreate: (project: Project) => Promise<void>;
  existingCount: number;
}) {
  const [type, setType] = useState<ProjectType>("discord");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("JavaScript");
  const [mcVersion, setMcVersion] = useState("1.21.4");
  const [mcType, setMcType] = useState("Vanilla");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your project a name.");
      return;
    }
    setSubmitting(true);
    setError("");
    const project: Project = {
      id: Date.now(),
      name: trimmed,
      type,
      lang: type === "discord" ? lang : "",
      running: false,
      files: {},
    };
    if (type === "discord") {
      const f = defaultFile(lang);
      project.files = { [f.name]: f.code };
    } else {
      project.version = mcVersion;
      project.serverType = mcType;
      project.ip = trimmed.toLowerCase().replace(/\s+/g, "-") + ".rebootcord.io";
      project.port = 25565 + existingCount;
    }
    try {
      await onCreate(project);
      onClose();
    } catch {
      setError("Could not create project. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New project" onClose={onClose}>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => setType("discord")}
          className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition ${
            type === "discord"
              ? "border-red/50 bg-red-soft text-text"
              : "border-border bg-surface-2 text-text-dim hover:border-border-bright"
          }`}
        >
          <Bot size={20} />
          <span className="text-[12px] font-bold">Discord Bot</span>
        </button>
        <button
          onClick={() => setType("minecraft")}
          className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition ${
            type === "minecraft"
              ? "border-red/50 bg-red-soft text-text"
              : "border-border bg-surface-2 text-text-dim hover:border-border-bright"
          }`}
        >
          <Server size={20} />
          <span className="text-[12px] font-bold">Minecraft Server</span>
        </button>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
          Project name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === "discord" ? "My Discord Bot" : "My Server"}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none transition focus:border-red focus:bg-surface"
        />
      </div>

      {type === "discord" ? (
        <div className="mb-2">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
            Language
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DISCORD_LANGS.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                  lang === l
                    ? "border-red/50 bg-red-soft text-red"
                    : "border-border bg-surface-2 text-text-dim hover:border-border-bright"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              Version
            </label>
            <select
              value={mcVersion}
              onChange={(e) => setMcVersion(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-red"
            >
              {MC_VERSIONS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-text-mute">
              Server type
            </label>
            <select
              value={mcType}
              onChange={(e) => setMcType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-red"
            >
              {MC_TYPES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-[12px] text-red">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-5 w-full rounded-lg bg-red py-2.5 text-[13px] font-bold text-white transition hover:bg-red-dark disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create project"}
      </button>
    </Modal>
  );
}
