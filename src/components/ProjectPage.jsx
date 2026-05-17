import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Terminal, FileCode, Save, Box,
  RefreshCw, Folder, Trash2, Send, ArrowLeft, Bot
} from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent } from "./ui/dialog";
import { toast } from "sonner";

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ cpu: 0, memory: 0, uptime: 0 });

  const [files, setFiles] = useState([]);
  const [currentDir, setCurrentDir] = useState("/");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [logs, setLogs] = useState([]);
  const [consoleCmd, setConsoleCmd] = useState("");
  const [wsStatus, setWsStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const rawProjects = sessionStorage.getItem("rc_projects");
    const token = sessionStorage.getItem("rc_token");
    if (!rawProjects || !token) { navigate("/"); return; }
    const projects = JSON.parse(rawProjects);
    const proj = projects.find(p => p.id === projectId);
    if (!proj) { navigate("/dashboard"); return; }
    setProject(proj);
  }, [projectId]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setWsStatus("connecting");

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?projectId=${projectId}`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("connected");

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "log") {
          setLogs(prev => {
            const next = [...prev, { id: Date.now() + Math.random(), text: msg.line, ts: new Date() }];
            return next.slice(-300);
          });
        } else if (msg.type === "status") {
          setRunning(msg.running);
        }
      } catch {}
    };

    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => setWsStatus("disconnected");
  }, [projectId]);

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/bots/${projectId}/status`);
      const data = await res.json();
      if (res.ok) {
        setRunning(data.running);
        setStats({ cpu: data.cpu ?? 0, memory: data.memory ?? 0, uptime: data.uptime ?? 0 });
      }
    } catch {}
  }

  async function fetchFiles(dir) {
    try {
      const res = await fetch(`/api/bots/${projectId}/files?directory=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (res.ok) setFiles(data);
      else toast.error(data?.error || "File list failed");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function fetchFileContent(filePath) {
    try {
      const res = await fetch(`/api/bots/${projectId}/files/content?file=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (res.ok) setFileContent(data.content);
      else toast.error(data?.error || "Read failed");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function saveFile() {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const filePath = currentDir === "/" ? `/${selectedFile}` : `${currentDir}/${selectedFile}`;
      const res = await fetch(`/api/bots/${projectId}/files/write?file=${encodeURIComponent(filePath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fileContent }),
      });
      if (res.ok) toast.success("File saved");
      else {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || "Save failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function sendPower(signal) {
    try {
      const res = await fetch(`/api/bots/${projectId}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(signal === "start" ? "Starting..." : signal === "stop" ? "Stopping..." : "Restarting...");
        setTimeout(fetchStatus, 1000);
      } else {
        toast.error(d?.error || "Power action failed");
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function sendCommand() {
    if (!consoleCmd.trim()) return;
    try {
      const res = await fetch(`/api/bots/${projectId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: consoleCmd.trim() }),
      });
      if (res.ok) setConsoleCmd("");
      else toast.error("Command failed");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteFiles(fileNames) {
    try {
      const res = await fetch(`/api/bots/${projectId}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: currentDir, files: fileNames }),
      });
      if (res.ok) {
        toast.success("Deleted");
        fetchFiles(currentDir);
        if (fileNames.includes(selectedFile)) {
          setSelectedFile(null);
          setFileContent("");
        }
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || "Delete failed");
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  function openFile(file) {
    if (!file.is_file) {
      const newDir = currentDir === "/" ? `/${file.name}` : `${currentDir}/${file.name}`;
      setCurrentDir(newDir);
      fetchFiles(newDir);
      setSelectedFile(null);
      setFileContent("");
    } else {
      setSelectedFile(file.name);
      const filePath = currentDir === "/" ? `/${file.name}` : `${currentDir}/${file.name}`;
      fetchFileContent(filePath);
    }
  }

  function goUp() {
    if (currentDir === "/") return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    const newDir = parts.length === 0 ? "/" : "/" + parts.join("/");
    setCurrentDir(newDir);
    fetchFiles(newDir);
    setSelectedFile(null);
    setFileContent("");
  }

  useEffect(() => {
    if (!project) return;
    fetchStatus();
    fetchFiles("/");
    connectWebSocket();
    const iv = setInterval(fetchStatus, 10000);
    return () => {
      clearInterval(iv);
      if (wsRef.current) wsRef.current.close();
    };
  }, [project, connectWebSocket]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const memMB = (stats.memory / 1024 / 1024).toFixed(1);
  const uptimeStr = stats.uptime > 0
    ? `${Math.floor(stats.uptime / 3600000)}h ${Math.floor((stats.uptime % 3600000) / 60000)}m`
    : "—";
  const statusColor = running ? "#54ff54" : "#7a7a7a";

  if (!project) return null;

  return (
    <div className="flex h-screen bg-[#1e140a] overflow-hidden text-[#f0f0f0] font-bold">
      <aside className="w-72 border-r-4 border-black bg-[#4a3b31] flex flex-col">
        <div
          onClick={() => navigate("/dashboard")}
          className="p-6 flex items-center gap-4 bg-black/40 border-b-4 border-black cursor-pointer hover:bg-black/60 transition-colors"
        >
          <div className="w-12 h-12 bg-[#54a332] border-4 border-black flex items-center justify-center shadow-[inset_2px_2px_0px_#bcbcbc]">
            <ArrowLeft className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="font-black italic text-xl text-white uppercase block truncate max-w-[140px]">{project.name}</span>
            <span className="text-[10px] text-[#54ff54]">← BACK TO PROJECTS</span>
          </div>
        </div>

        <div className="px-6 py-4 border-b-2 border-black/30">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#bcbcbc] mb-3">Bot Status</div>
          <div className="bg-[#2a2a2a] border-4 border-black p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 shrink-0 border-2 border-black" style={{ background: statusColor }} />
              <span className="text-xs font-black uppercase" style={{ color: statusColor }}>
                {running ? "RUNNING" : "OFFLINE"}
              </span>
            </div>
            <div className="text-[10px] text-[#7a7a7a] space-y-1">
              <div>MEMORY: {memMB}MB</div>
              <div>UPTIME: {uptimeStr}</div>
              <div className={`uppercase ${wsStatus === "connected" ? "text-[#54ff54]" : "text-[#7a7a7a]"}`}>
                WS: {wsStatus}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-2 border-b-2 border-black/30">
          <button
            className="mc-btn w-full border-4 border-black font-black text-xs bg-[#54a332] disabled:opacity-40"
            onClick={() => sendPower("start")}
            disabled={running}
          >
            START
          </button>
          <button
            className="mc-btn w-full border-4 border-black font-black text-xs bg-[#cc4444] disabled:opacity-40"
            onClick={() => sendPower("stop")}
            disabled={!running}
          >
            STOP
          </button>
          <button
            className="mc-btn w-full border-4 border-black font-black text-xs bg-[#4a3b31]"
            onClick={() => sendPower("restart")}
          >
            RESTART
          </button>
        </div>

        <div className="flex-1" />

        <div className="p-4 bg-black/20 border-t-4 border-black">
          <button
            onClick={() => { fetchStatus(); fetchFiles(currentDir); }}
            className="mc-btn w-full bg-[#2a2a2a] border-black border-4 flex items-center justify-center gap-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" /> REFRESH
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
        <header className="flex items-center justify-between px-8 py-4 border-b-4 border-black bg-[#3b3b3b] shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{project.name}</h2>
            <div className="text-[10px] text-[#7a7a7a] mt-1 font-mono">{project.id}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 border-2 border-black" style={{ background: statusColor }} />
            <span className="text-xs font-black uppercase" style={{ color: statusColor }}>
              {running ? "RUNNING" : "OFFLINE"}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          <Tabs defaultValue="console" className="flex-1 flex flex-col">
            <TabsList className="bg-transparent border-0 p-0 flex gap-2 h-auto mb-[-4px]">
              <TabsTrigger value="console" className="mc-tab data-[state=active]:bg-[#3b3b3b] data-[state=active]:text-white data-[state=inactive]:bg-[#2a2a2a] text-[#7a7a7a] font-black uppercase italic tracking-widest text-xs z-10">CONSOLE</TabsTrigger>
              <TabsTrigger value="files" className="mc-tab data-[state=active]:bg-[#3b3b3b] data-[state=active]:text-white data-[state=inactive]:bg-[#2a2a2a] text-[#7a7a7a] font-black uppercase italic tracking-widest text-xs z-10">FILES</TabsTrigger>
              <TabsTrigger value="stats" className="mc-tab data-[state=active]:bg-[#3b3b3b] data-[state=active]:text-white data-[state=inactive]:bg-[#2a2a2a] text-[#7a7a7a] font-black uppercase italic tracking-widest text-xs z-10">STATS</TabsTrigger>
            </TabsList>

            <div className="flex-1 bg-[#3b3b3b] border-4 border-black p-1 overflow-hidden">
              <TabsContent value="console" className="h-full m-0 flex flex-col overflow-hidden border-4 border-black bg-black">
                <div className="p-3 bg-[#1a1a1a] border-b-2 border-white/5 flex items-center justify-between px-4 shrink-0">
                  <span className="text-[10px] font-black text-[#7a7a7a] uppercase tracking-widest">Live Console</span>
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2" style={{ background: wsStatus === "connected" ? "#54ff54" : "#7a7a7a" }} />
                    <button
                      onClick={connectWebSocket}
                      className="text-[10px] text-[#7a7a7a] hover:text-white uppercase tracking-widest"
                    >
                      RECONNECT
                    </button>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4 font-mono text-xs text-[#bcbcbc]">
                  {logs.length === 0 && (
                    <div className="text-[#3b3b3b] italic">
                      {wsStatus === "connecting" ? "Connecting..." : wsStatus === "error" ? "WebSocket error — try reconnecting" : "No output yet. Start the bot to see logs."}
                    </div>
                  )}
                  {logs.map(log => (
                    <div key={log.id} className="mb-1 flex gap-3 leading-5">
                      <span className="text-[#3b3b3b] shrink-0">[{log.ts.toLocaleTimeString()}]</span>
                      <span className={
                        log.text.includes("[ERR]") || log.text.toLowerCase().includes("error") || log.text.toLowerCase().includes("exception")
                          ? "text-red-400"
                          : log.text.includes("[SYSTEM]")
                          ? "text-[#ffcc00]"
                          : log.text.toLowerCase().includes("warn")
                          ? "text-yellow-400"
                          : "text-[#bcbcbc]"
                      }>
                        {log.text}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </ScrollArea>
                <div className="flex gap-2 p-3 border-t-2 border-white/5 bg-[#1a1a1a] shrink-0">
                  <input
                    className="mc-input flex-1 font-mono text-xs"
                    placeholder="Enter command..."
                    value={consoleCmd}
                    onChange={e => setConsoleCmd(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendCommand()}
                  />
                  <button onClick={sendCommand} className="mc-btn border-2 border-black bg-[#54a332] px-4">
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="files" className="h-full m-0 flex overflow-hidden border-4 border-black">
                <div className="w-64 bg-[#2a2a2a] border-r-4 border-black flex flex-col shrink-0">
                  <div className="p-3 bg-black/20 border-b-2 border-black flex items-center justify-between">
                    <span className="text-[10px] uppercase text-[#7a7a7a] font-black truncate">{currentDir}</span>
                    {currentDir !== "/" && (
                      <button onClick={goUp} className="text-[10px] text-[#54a332] hover:text-white uppercase ml-2 shrink-0">↑ UP</button>
                    )}
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {files.length === 0 && (
                        <div className="text-[10px] text-[#4a4a4a] uppercase text-center py-8">
                          No files yet. Create index.js to get started.
                        </div>
                      )}
                      {files.map(file => (
                        <div
                          key={file.name}
                          className={`flex items-center justify-between p-2 border-2 cursor-pointer group ${
                            selectedFile === file.name && file.is_file
                              ? "bg-[#54a332] border-white"
                              : "border-transparent hover:bg-white/5"
                          }`}
                        >
                          <button
                            className="flex items-center gap-2 min-w-0 flex-1 text-left"
                            onClick={() => openFile(file)}
                          >
                            {file.is_file ? (
                              <FileCode className="h-3 w-3 shrink-0 text-[#7a7a7a]" />
                            ) : (
                              <Folder className="h-3 w-3 shrink-0 text-[#ffcc00]" />
                            )}
                            <span className="text-[10px] uppercase tracking-tighter truncate">{file.name}</span>
                          </button>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-300 ml-1 shrink-0"
                            onClick={e => { e.stopPropagation(); setDeleteTarget(file.name); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex-1 flex flex-col bg-black min-w-0">
                  {selectedFile ? (
                    <>
                      <div className="p-3 bg-[#1a1a1a] border-b-2 border-white/5 flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-mono text-[#54ff54] uppercase tracking-widest">{selectedFile}</span>
                        <button
                          onClick={saveFile}
                          disabled={isSaving}
                          className="mc-btn py-1 px-4 text-[10px] flex items-center gap-2 border-2 bg-[#54a332] disabled:opacity-50"
                        >
                          <Save className="h-3 w-3" /> {isSaving ? "SAVING..." : "SAVE"}
                        </button>
                      </div>
                      <textarea
                        className="flex-1 p-4 bg-black text-[#54ff54] font-mono text-xs outline-none resize-none leading-5"
                        value={fileContent}
                        onChange={e => setFileContent(e.target.value)}
                        spellCheck={false}
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[#3b3b3b] text-xs uppercase tracking-widest">
                      Select a file to edit
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="stats" className="h-full m-0 flex flex-col bg-black p-8 border-4 border-black overflow-auto">
                <div className="max-w-2xl w-full space-y-8 mx-auto">
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold text-[#7a7a7a] uppercase tracking-[0.2em]">Resource Usage</div>
                    <div className="bg-[#1a1a1a] p-6 border-4 border-black space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-[#7a7a7a]">
                          <span>MEMORY</span>
                          <span className="text-[#ffcc00]">{memMB}MB</span>
                        </div>
                        <div className="h-4 bg-black border-2 border-[#4a4a4a]">
                          <div
                            className="h-full bg-[#ffcc00] transition-all"
                            style={{ width: `${Math.min((stats.memory / 1024 / 1024 / 512) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                      <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Project ID</div>
                      <div className="font-mono text-xs text-white break-all">{project.id}</div>
                    </div>
                    <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                      <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Status</div>
                      <div className="font-mono text-xs" style={{ color: statusColor }}>{running ? "running" : "offline"}</div>
                    </div>
                    <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                      <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Uptime</div>
                      <div className="font-mono text-xs text-white">{uptimeStr}</div>
                    </div>
                    <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                      <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Created</div>
                      <div className="font-mono text-xs text-white">{new Date(project.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-2">
                    <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Entry Files Supported</div>
                    <div className="font-mono text-xs text-[#54ff54]">index.js · bot.js · main.js · app.js</div>
                    <div className="text-[10px] text-[#4a4a4a]">Upload one of these files then press START</div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-[#3b3b3b] border-4 border-black text-white p-0 overflow-hidden">
          <div className="p-2 bg-[#cc4444] border-b-4 border-black font-black uppercase italic px-6">Confirm Delete</div>
          <div className="p-8 space-y-6">
            <p className="text-sm font-bold text-[#bcbcbc]">Delete <span className="text-white">{deleteTarget}</span>?</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteTarget(null)} className="mc-btn flex-1 border-4 border-black bg-[#2a2a2a]">CANCEL</button>
              <button
                onClick={() => { deleteFiles([deleteTarget]); setDeleteTarget(null); }}
                className="mc-btn flex-1 border-4 border-black bg-[#cc4444] font-black"
              >
                DELETE
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
