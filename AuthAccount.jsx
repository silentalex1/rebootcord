import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Terminal, FileCode, Package, Save, Download, Box,
  Cpu, Database, Globe, RefreshCw, ChevronRight, Folder,
  Trash2, Send, ArrowLeft, Bot
} from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent } from "./ui/dialog";
import { toast } from "sonner";

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [config, setConfig] = useState(null);

  const [servers, setServers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [resources, setResources] = useState(null);

  const [files, setFiles] = useState([]);
  const [currentDir, setCurrentDir] = useState("/");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [logs, setLogs] = useState([]);
  const [consoleCmd, setConsoleCmd] = useState("");
  const [wsStatus, setWsStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const wsTokenRef = useRef(null);
  const logsEndRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const rawProjects = sessionStorage.getItem("rc_projects");
    const token = sessionStorage.getItem("rc_token");
    const panel = sessionStorage.getItem("rc_panel");
    if (!rawProjects || !token) { navigate("/"); return; }
    const projects = JSON.parse(rawProjects);
    const proj = projects.find(p => p.id === projectId);
    if (!proj) { navigate("/dashboard"); return; }
    setProject(proj);
    setConfig({ panelUrl: panel || "https://rebootcord.onrender.com", apiKey: proj.token });
  }, [projectId]);

  const api = useCallback(async (path, opts = {}) => {
    if (!config) return null;
    return fetch(path, {
      ...opts,
      headers: {
        "x-panel-url": config.panelUrl,
        "x-api-key": config.apiKey,
        ...(opts.headers || {}),
      },
    });
  }, [config]);

  async function fetchServers() {
    if (!config) return;
    try {
      const res = await api("/api/servers");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setServers(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (err) {
      toast.error(`Server sync failed: ${err.message}`);
    }
  }

  async function fetchResources(id) {
    try {
      const res = await api(`/api/servers/${id}/resources`);
      const data = await res.json();
      if (res.ok) setResources(data);
    } catch {}
  }

  async function fetchFiles(id, dir) {
    try {
      const res = await api(`/api/servers/${id}/files?directory=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (res.ok) setFiles(data);
      else toast.error(data?.error || "File list failed");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function fetchFileContent(id, filePath) {
    try {
      const res = await api(`/api/servers/${id}/files/content?file=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (res.ok) setFileContent(data.content);
      else toast.error(data?.error || "Read failed");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function saveFile() {
    if (!selectedId || !selectedFile) return;
    setIsSaving(true);
    try {
      const filePath = currentDir === "/" ? `/${selectedFile}` : `${currentDir}/${selectedFile}`;
      const res = await api(`/api/servers/${selectedId}/files/write?file=${encodeURIComponent(filePath)}`, {
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
      const res = await api(`/api/servers/${selectedId}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
      });
      if (res.ok) {
        toast.success(signal === "start" ? "Starting..." : signal === "stop" ? "Stopping..." : "Restarting...");
        setTimeout(() => fetchResources(selectedId), 2000);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || "Power action failed");
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function sendCommand() {
    if (!consoleCmd.trim() || !selectedId) return;
    try {
      const res = await api(`/api/servers/${selectedId}/command`, {
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
      const res = await api(`/api/servers/${selectedId}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: currentDir, files: fileNames }),
      });
      if (res.ok) {
        toast.success("Deleted");
        fetchFiles(selectedId, currentDir);
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

  function connectWebSocket(serverId) {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setLogs([]);
    setWsStatus("connecting");
    api(`/api/servers/${serverId}/websocket`)
      .then(r => r.json())
      .then(({ token, socket }) => {
        if (!token || !socket) throw new Error("No WS credentials");
        wsTokenRef.current = token;
        const ws = new WebSocket(socket);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ event: "auth", args: [token] }));
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.event === "auth success") {
              setWsStatus("connected");
              ws.send(JSON.stringify({ event: "send logs", args: [null] }));
              ws.send(JSON.stringify({ event: "send stats", args: [null] }));
            } else if (msg.event === "console output") {
              const line = Array.isArray(msg.args) ? msg.args[0] : "";
              if (line) {
                setLogs(prev => {
                  const next = [...prev, { id: Date.now() + Math.random(), text: line, ts: new Date() }];
                  return next.slice(-200);
                });
              }
            } else if (msg.event === "stats") {
              const stats = Array.isArray(msg.args) ? JSON.parse(msg.args[0]) : null;
              if (stats) setResources(r => ({ ...r, resources: stats }));
            } else if (msg.event === "token expiring") {
              api(`/api/servers/${serverId}/websocket`)
                .then(r => r.json())
                .then(({ token: t }) => {
                  wsTokenRef.current = t;
                  ws.send(JSON.stringify({ event: "auth", args: [t] }));
                })
                .catch(() => {});
            }
          } catch {}
        };
        ws.onerror = () => setWsStatus("error");
        ws.onclose = () => setWsStatus("disconnected");
      })
      .catch(() => setWsStatus("error"));
  }

  useEffect(() => {
    if (!config) return;
    fetchServers();
    const iv = setInterval(fetchServers, 15000);
    return () => clearInterval(iv);
  }, [config]);

  useEffect(() => {
    if (!selectedId || !config) return;
    setCurrentDir("/");
    setSelectedFile(null);
    setFileContent("");
    fetchResources(selectedId);
    fetchFiles(selectedId, "/");
    connectWebSocket(selectedId);
    const iv = setInterval(() => fetchResources(selectedId), 10000);
    return () => {
      clearInterval(iv);
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedId, config]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!project || !config) return null;

  const selectedServer = servers.find(s => s.id === selectedId);
  const currentStatus = resources?.current_state || selectedServer?.status || "offline";
  const cpuPct = resources?.resources?.cpu_absolute ?? 0;
  const memBytes = resources?.resources?.memory_bytes ?? 0;
  const memMB = (memBytes / 1024 / 1024).toFixed(0);
  const memLimit = selectedServer?.limits?.memory ?? 0;
  const memPct = memLimit > 0 ? Math.min((memBytes / 1024 / 1024 / memLimit) * 100, 100) : 0;
  const diskBytes = resources?.resources?.disk_bytes ?? 0;
  const diskMB = (diskBytes / 1024 / 1024).toFixed(0);

  function openFile(file) {
    if (!file.is_file) {
      const newDir = currentDir === "/" ? `/${file.name}` : `${currentDir}/${file.name}`;
      setCurrentDir(newDir);
      fetchFiles(selectedId, newDir);
      setSelectedFile(null);
      setFileContent("");
    } else {
      setSelectedFile(file.name);
      const filePath = currentDir === "/" ? `/${file.name}` : `${currentDir}/${file.name}`;
      fetchFileContent(selectedId, filePath);
    }
  }

  function goUp() {
    if (currentDir === "/") return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    const newDir = parts.length === 0 ? "/" : "/" + parts.join("/");
    setCurrentDir(newDir);
    fetchFiles(selectedId, newDir);
    setSelectedFile(null);
    setFileContent("");
  }

  const statusColor = {
    running: "#54ff54",
    starting: "#ffcc00",
    stopping: "#ff9900",
    offline: "#7a7a7a",
  }[currentStatus] || "#7a7a7a";

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

        <div className="px-6 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bcbcbc] border-b-2 border-black/30">
          Servers ({servers.length})
        </div>

        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-2">
            {servers.length === 0 && (
              <div className="text-[10px] text-[#4a4a4a] uppercase text-center py-8">No servers found</div>
            )}
            {servers.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full flex items-center justify-between p-4 border-4 transition-all ${
                  selectedId === s.id
                    ? "bg-[#3b3b3b] border-[#bcbcbc] shadow-[inset_2px_2px_0px_#1a1a1a]"
                    : "bg-[#2a2a2a] border-black hover:bg-[#322822]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 shrink-0 rounded-none" style={{ background: statusColor }} />
                  <span className="truncate uppercase text-xs tracking-widest">{s.name}</span>
                </div>
                <span className="text-[8px] text-[#7a7a7a] uppercase shrink-0 ml-2">{s.id}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 bg-black/20 border-t-4 border-black">
          <button
            onClick={() => { fetchServers(); if (selectedId) fetchResources(selectedId); }}
            className="mc-btn w-full bg-[#2a2a2a] border-black border-4 flex items-center justify-center gap-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" /> REFRESH
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
        {selectedServer ? (
          <>
            <header className="flex items-center justify-between px-8 py-4 border-b-4 border-black bg-[#3b3b3b] shrink-0">
              <div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{selectedServer.name}</h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: statusColor }}>
                    {currentStatus.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[#7a7a7a]">CPU: {cpuPct.toFixed(1)}%</span>
                  <span className="text-[10px] text-[#7a7a7a]">MEM: {memMB}MB</span>
                  <span className="text-[10px] text-[#7a7a7a]">DISK: {diskMB}MB</span>
                  <span className={`text-[10px] uppercase ${wsStatus === "connected" ? "text-[#54ff54]" : "text-[#7a7a7a]"}`}>
                    WS: {wsStatus}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="mc-btn border-4 border-black font-black text-sm bg-[#54a332]"
                  onClick={() => sendPower("start")}
                  disabled={currentStatus === "running" || currentStatus === "starting"}
                >
                  START
                </button>
                <button
                  className="mc-btn border-4 border-black font-black text-sm bg-[#cc4444]"
                  onClick={() => sendPower("stop")}
                  disabled={currentStatus === "offline" || currentStatus === "stopping"}
                >
                  STOP
                </button>
                <button
                  className="mc-btn border-4 border-black font-black text-sm bg-[#4a3b31]"
                  onClick={() => sendPower("restart")}
                >
                  RESTART
                </button>
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
                          onClick={() => connectWebSocket(selectedId)}
                          className="text-[10px] text-[#7a7a7a] hover:text-white uppercase tracking-widest"
                        >
                          RECONNECT
                        </button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-4 font-mono text-xs text-[#bcbcbc]">
                      {logs.length === 0 && (
                        <div className="text-[#3b3b3b] italic">
                          {wsStatus === "connecting" ? "Connecting..." : wsStatus === "error" ? "WebSocket error — try reconnecting" : "No output yet"}
                        </div>
                      )}
                      {logs.map(log => (
                        <div key={log.id} className="mb-1 flex gap-3 leading-5">
                          <span className="text-[#3b3b3b] shrink-0">[{log.ts.toLocaleTimeString()}]</span>
                          <span className={log.text.toLowerCase().includes("error") || log.text.toLowerCase().includes("exception") ? "text-red-400" : log.text.toLowerCase().includes("warn") ? "text-yellow-400" : "text-[#bcbcbc]"}>
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
                            className="flex-1 p-4 bg-black text-[#54ff54] font-mono text-xs outline-none resize-none leading-5 spellcheck-false"
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
                              <span>CPU</span>
                              <span className="text-[#54ff54]">{cpuPct.toFixed(2)}%</span>
                            </div>
                            <div className="h-4 bg-black border-2 border-[#4a4a4a]">
                              <div className="h-full bg-[#54a332] transition-all" style={{ width: `${Math.min(cpuPct, 100)}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-[#7a7a7a]">
                              <span>MEMORY</span>
                              <span className="text-[#ffcc00]">{memMB}MB / {memLimit}MB</span>
                            </div>
                            <div className="h-4 bg-black border-2 border-[#4a4a4a]">
                              <div className="h-full bg-[#ffcc00] transition-all" style={{ width: `${memPct}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-[#7a7a7a]">
                              <span>DISK</span>
                              <span className="text-[#4da6ff]">{diskMB}MB / {selectedServer?.limits?.disk ?? 0}MB</span>
                            </div>
                            <div className="h-4 bg-black border-2 border-[#4a4a4a]">
                              <div
                                className="h-full bg-[#4da6ff] transition-all"
                                style={{ width: `${selectedServer?.limits?.disk > 0 ? Math.min((diskBytes / 1024 / 1024 / selectedServer.limits.disk) * 100, 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                          <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Server ID</div>
                          <div className="font-mono text-xs text-white">{selectedServer.id}</div>
                        </div>
                        <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                          <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Node</div>
                          <div className="font-mono text-xs text-white">{selectedServer.node || "—"}</div>
                        </div>
                        <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                          <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Status</div>
                          <div className="font-mono text-xs" style={{ color: statusColor }}>{currentStatus}</div>
                        </div>
                        <div className="p-4 border-2 border-[#4a4a4a] bg-black/40 space-y-1">
                          <div className="text-[10px] text-[#7a7a7a] uppercase font-bold">Uptime</div>
                          <div className="font-mono text-xs text-white">
                            {resources?.resources?.uptime
                              ? `${Math.floor(resources.resources.uptime / 3600000)}h ${Math.floor((resources.resources.uptime % 3600000) / 60000)}m`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#1e140a]">
            <div className="w-32 h-32 bg-[#3b3b3b] border-8 border-black flex items-center justify-center mb-8">
              <Terminal className="h-12 w-12 text-[#bcbcbc]/20" />
            </div>
            <h3 className="text-3xl font-black italic text-white uppercase mb-4">No Server Selected</h3>
            <p className="max-w-xs text-[#bcbcbc] font-bold text-sm leading-relaxed">
              {servers.length === 0 ? "No servers found on your panel." : "Select a server from the sidebar."}
            </p>
          </div>
        )}
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
