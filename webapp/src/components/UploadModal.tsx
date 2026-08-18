import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import JSZip from "jszip";
import { Modal } from "./Modal";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";

const CONCURRENCY = 4;

async function uploadInBatches(
  files: { relPath: string; file: File }[],
  projectId: number,
  onProgress: (done: number, total: number) => void,
) {
  let done = 0;
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const idx = i++;
      const { relPath, file } = files[idx];
      await api.projects.upload(projectId, file, relPath);
      done++;
      onProgress(done, files.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
}

async function readEntry(entry: FileSystemEntry, base: string): Promise<{ relPath: string; file: File }[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    return [{ relPath: base + entry.name, file }];
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: FileSystemEntry[] = await new Promise((resolve, reject) => {
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (!batch.length) return resolve(all);
          all.push(...batch);
          readBatch();
        }, reject);
      };
      readBatch();
    });
    const nested = await Promise.all(entries.map((e) => readEntry(e, base + entry.name + "/")));
    return nested.flat();
  }
  return [];
}

export function UploadModal({
  projectId,
  onClose,
  onDone,
}: {
  projectId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  const processFiles = async (collected: { relPath: string; file: File }[]) => {
    const expanded: { relPath: string; file: File }[] = [];
    for (const item of collected) {
      if (item.file.name.toLowerCase().endsWith(".zip")) {
        try {
          const zip = await JSZip.loadAsync(item.file);
          const entries = Object.values(zip.files).filter((f) => !f.dir);
          for (const entry of entries) {
            const blob = await entry.async("blob");
            expanded.push({
              relPath: entry.name,
              file: new File([blob], entry.name.split("/").pop() || entry.name),
            });
          }
        } catch {
          push(`Could not read ${item.file.name} as a zip`, "error");
        }
      } else {
        expanded.push(item);
      }
    }
    if (!expanded.length) return;
    setProgress({ done: 0, total: expanded.length });
    await uploadInBatches(expanded, projectId, (done, total) => setProgress({ done, total }));
    setProgress(null);
    push(`Uploaded ${expanded.length} file${expanded.length === 1 ? "" : "s"}`, "success");
    onDone();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    const collected: { relPath: string; file: File }[] = [];
    if (items && items.length && typeof items[0].webkitGetAsEntry === "function") {
      const entries = Array.from(items)
        .map((it) => it.webkitGetAsEntry())
        .filter((x): x is FileSystemEntry => !!x);
      const nested = await Promise.all(entries.map((en) => readEntry(en, "")));
      collected.push(...nested.flat());
    } else {
      Array.from(e.dataTransfer.files).forEach((f) => collected.push({ relPath: f.name, file: f }));
    }
    processFiles(collected);
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const collected = Array.from(files).map((f) => ({
      relPath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      file: f,
    }));
    processFiles(collected);
  };

  return (
    <Modal title="Upload Files" onClose={onClose}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-green bg-green-soft/20" : "border-border-bright bg-surface-2"
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-green">
          <UploadCloud size={20} />
        </div>
        {progress ? (
          <>
            <p className="text-[14px] font-bold">
              Uploading {progress.done}/{progress.total}...
            </p>
            <div className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-green transition-all"
                style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-[14px] font-bold">Drop your project files here</p>
            <p className="text-[12px] text-text-mute">
              Folders and .zip files are both supported. Files upload straight to your bot.
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-green px-4 py-2 text-[12.5px] font-bold text-black transition hover:brightness-90"
            >
              Browse Files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleBrowse}
              id="upload-file-input"
              name="files"
              aria-label="Choose files to upload"
              className="hidden"
            />
          </>
        )}
      </div>
      <button
        onClick={onClose}
        className="mt-4 w-full rounded-lg border border-border bg-surface-2 py-2.5 text-[13px] font-bold text-text-dim transition hover:bg-surface-3"
      >
        Close
      </button>
    </Modal>
  );
}
