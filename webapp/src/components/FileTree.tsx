import { useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import type { FileNode } from "../lib/types";

export function FileTree({
  nodes,
  activeFile,
  onSelect,
  depth = 0,
}: {
  nodes: FileNode[];
  activeFile: string | null;
  onSelect: (rel: string) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes
        .slice()
        .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
        .map((node) => (
          <TreeNode
            key={node.rel}
            node={node}
            activeFile={activeFile}
            onSelect={onSelect}
            depth={depth}
          />
        ))}
    </div>
  );
}

function TreeNode({
  node,
  activeFile,
  onSelect,
  depth,
}: {
  node: FileNode;
  activeFile: string | null;
  onSelect: (rel: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ paddingLeft: 10 + depth * 14 }}
          className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[12.5px] text-text-dim hover:bg-surface-2 hover:text-text"
        >
          <ChevronRight
            size={12}
            className={`shrink-0 text-text-mute transition-transform ${open ? "rotate-90" : ""}`}
          />
          {open ? <FolderOpen size={13} className="shrink-0" /> : <Folder size={13} className="shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <FileTree
            nodes={node.children}
            activeFile={activeFile}
            onSelect={onSelect}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  const active = activeFile === node.rel;
  return (
    <button
      onClick={() => onSelect(node.rel)}
      style={{ paddingLeft: 10 + depth * 14 + 16 }}
      className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[12.5px] transition ${
        active ? "bg-red-soft text-red" : "text-text-dim hover:bg-surface-2 hover:text-text"
      }`}
    >
      <File size={13} className="shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
