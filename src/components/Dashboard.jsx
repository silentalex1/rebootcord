import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Play, 
  StopCircle, 
  LayoutDashboard, 
  Bot, 
  Terminal, 
  Activity, 
  Search,
  MoreVertical,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  FileCode,
  Package,
  Save,
  Download,
  Box
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { toast } from "sonner";

export default function Dashboard({ onBack }) {
  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  
  // File management
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("main.py");
  const [fileContent, setFileContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const fetchBots = async () => {
    try {
      const res = await fetch("/api/bots");
      const data = await res.json();
      setBots(data);
      if (data.length > 0 && !selectedBotId) {
        setSelectedBotId(data[0].id);
      }
    } catch (err) {
      toast.error("Failed to sync with grid");
    }
  };

  const fetchLogs = async (id) => {
    try {
      const res = await fetch(`/api/bots/${id}/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Link error", err);
    }
  };

  const fetchFiles = async (id) => {
    try {
      const res = await fetch(`/api/bots/${id}/files`);
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      toast.error("Data fetch error");
    }
  };

  const fetchFileContent = async (id, filename) => {
    try {
      const res = await fetch(`/api/bots/${id}/files/${filename}`);
      const data = await res.json();
      setFileContent(data.content);
    } catch (err) {
      toast.error("Buffer error");
    }
  };

  useEffect(() => {
    fetchBots();
    const interval = setInterval(fetchBots, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      fetchLogs(selectedBotId);
      fetchFiles(selectedBotId);
      const interval = setInterval(() => fetchLogs(selectedBotId), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedBotId]);

  useEffect(() => {
    if (selectedBotId && selectedFile) {
      fetchFileContent(selectedBotId, selectedFile);
    }
  }, [selectedBotId, selectedFile]);

  const selectedBot = bots.find(b => b.id === selectedBotId);

  const addBot = async () => {
    if (!newName) return toast.error("Label the node");
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        toast.success("Instance spawned");
        fetchBots();
        setIsAddOpen(false);
        setNewName("");
      }
    } catch (err) {
      toast.error("Spawn failure");
    }
  };

  const toggleBot = async (bot) => {
    const action = bot.status === 'running' ? 'stop' : 'start';
    try {
      const res = await fetch(`/api/bots/${bot.id}/${action}`, { method: "POST" });
      if (res.ok) {
        toast.success(action === 'start' ? "Powering On" : "Shutting Down");
        fetchBots();
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const saveFile = async () => {
    if (!selectedBotId || !selectedFile) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/bots/${selectedBotId}/files/${selectedFile}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fileContent })
      });
      if (res.ok) {
        toast.success("State Saved");
      }
    } catch (err) {
      toast.error("Save failure");
    } finally {
      setIsSaving(false);
    }
  };

  const installPackages = async () => {
    if (!selectedBotId) return;
    setIsInstalling(true);
    try {
      const res = await fetch(`/api/bots/${selectedBotId}/pip`, { method: "POST" });
      if (res.ok) {
        toast.success("Modules Integrated");
      }
    } catch (err) {
      toast.error("Installation error");
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#1e140a] overflow-hidden text-[#f0f0f0] font-bold">
      {/* Sidebar - Dirt Theme */}
      <aside className="w-80 border-r-4 border-black bg-[#4a3b31] flex flex-col">
        <div 
          onClick={onBack}
          className="p-8 flex items-center gap-4 bg-black/40 border-b-4 border-black cursor-pointer hover:bg-black/60 transition-colors"
        >
          <div className="w-12 h-12 bg-[#54a332] border-4 border-black flex items-center justify-center shadow-[inset_2px_2px_0px_#bcbcbc]">
            <Box className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="font-black italic text-xl text-white uppercase block">REBOOT</span>
            <span className="text-[10px] text-[#54ff54]">BACK_TO_HOME</span>
          </div>
        </div>

        <div className="px-6 py-8 text-[10px] uppercase tracking-[0.3em] text-[#bcbcbc]">
          Active Segments
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4">
            {bots.map(bot => (
              <button
                key={bot.id}
                onClick={() => setSelectedBotId(bot.id)}
                className={`w-full flex items-center justify-between p-4 border-4 transition-all ${
                  selectedBotId === bot.id 
                    ? "bg-[#3b3b3b] border-[#bcbcbc] shadow-[inset_2px_2px_0px_#1a1a1a]" 
                    : "bg-[#2a2a2a] border-black hover:bg-[#322822]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 ${bot.status === 'running' ? "bg-[#54ff54] shadow-[0_0_8px_#54ff54]" : "bg-[#1a1a1a]"}`} />
                  <span className="truncate uppercase text-xs tracking-widest">{bot.name}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-6 bg-black/20 border-t-4 border-black">
          <button 
            className="mc-btn w-full bg-[#54a332] border-black border-4"
            onClick={() => setIsAddOpen(true)}
          >
            NEW INSTANCE
          </button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="bg-[#3b3b3b] border-4 border-black text-white p-0 overflow-hidden">
              <div className="p-2 bg-[#54a332] border-b-4 border-black font-black uppercase italic px-6">
                Node Initialization
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#bcbcbc]">Identifier</label>
                  <input 
                    placeholder="BOT_UNIT_01" 
                    className="mc-input w-full uppercase" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                  />
                </div>
                <button 
                  onClick={addBot} 
                  className="mc-btn w-full bg-[#54a332] font-black uppercase text-lg"
                >
                  SPAWN
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </aside>

      {/* Main Terminal Area */}
      <main className="flex-1 flex flex-col bg-[#1e1e1e]">
        {selectedBot ? (
          <>
            <header className="flex items-center justify-between px-10 h-24 border-b-4 border-black bg-[#3b3b3b]">
              <div className="flex items-center gap-6">
                <div>
                  <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-1">{selectedBot.name}</h2>
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${selectedBot.status === 'running' ? "text-[#54ff54]" : "text-[#7a7a7a]"}`}>
                      {selectedBot.status === 'running' ? "STATUS: RUNNING" : "STATUS: STANDBY"}
                    </span>
                    <span className="text-[10px] text-[#7a7a7a] tracking-widest">ID: {selectedBot.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  className={`mc-btn min-w-[200px] border-4 border-black font-black ${
                    selectedBot.status === 'running' ? "bg-destructive" : "bg-[#54a332]"
                  }`}
                  onClick={() => toggleBot(selectedBot)}
                >
                  {selectedBot.status === 'running' ? "TERMINATE" : "ACTIVATE"}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-hidden p-8 flex flex-col gap-8">
              <Tabs defaultValue="code" className="flex-1 flex flex-col gap-0 border-0">
                <TabsList className="bg-transparent border-0 p-0 flex gap-2 h-auto mb-[-4px]">
                  <TabsTrigger value="code" className="mc-tab data-[state=active]:bg-[#3b3b3b] data-[state=active]:text-white data-[state=inactive]:bg-[#2a2a2a] text-[#7a7a7a] font-black uppercase italic tracking-widest text-xs z-10">SOURCE CODE</TabsTrigger>
                  <TabsTrigger value="console" className="mc-tab data-[state=active]:bg-[#3b3b3b] data-[state=active]:text-white data-[state=inactive]:bg-[#2a2a2a] text-[#7a7a7a] font-black uppercase italic tracking-widest text-xs z-10">LIVE LOGS</TabsTrigger>
                  <TabsTrigger value="packages" className="mc-tab data-[state=active]:bg-[#3b3b3b] data-[state=active]:text-white data-[state=inactive]:bg-[#2a2a2a] text-[#7a7a7a] font-black uppercase italic tracking-widest text-xs z-10">PACKAGES</TabsTrigger>
                </TabsList>

                <div className="flex-1 bg-[#3b3b3b] border-4 border-black p-1">
                  <TabsContent value="code" className="h-full m-0 flex overflow-hidden border-4 border-black">
                    {/* File Sidebar */}
                    <div className="w-56 bg-[#2a2a2a] border-r-4 border-black flex flex-col">
                      <div className="p-4 bg-black/20 border-b-2 border-black text-[10px] uppercase text-[#7a7a7a] font-black">Files</div>
                      <ScrollArea className="flex-1 px-2 py-2">
                        {files.map(file => (
                          <button
                            key={file}
                            onClick={() => setSelectedFile(file)}
                            className={`w-full p-2 text-left text-[10px] uppercase tracking-tighter truncate border-2 mb-1 transition-all ${
                              selectedFile === file ? "bg-[#54a332] border-white text-white shadow-[inset_2px_2px_0px_#bcbcbc]" : "border-transparent hover:bg-white/5 text-[#bcbcbc]"
                            }`}
                          >
                            <FileCode className="inline-block mr-2 h-3 w-3" />
                            {file}
                          </button>
                        ))}
                      </ScrollArea>
                    </div>
                    {/* Editor */}
                    <div className="flex-1 flex flex-col bg-black">
                      <div className="p-4 bg-[#1a1a1a] border-b-2 border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-[#54ff54]"></div>
                          <span className="text-[10px] font-mono text-[#54ff54] uppercase tracking-widest">{selectedFile}</span>
                        </div>
                        <div className="flex gap-4">
                           <button 
                            onClick={saveFile}
                            disabled={isSaving}
                            className={`mc-btn py-1 px-4 text-[10px] flex items-center gap-2 border-2 ${isSaving ? "opacity-50" : "bg-[#54a332] hover:bg-[#65c43d]"}`}
                          >
                            <Save className="h-3 w-3" /> {isSaving ? "SAVING..." : "SAVE"}
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 relative flex">
                        <div className="w-12 bg-[#1a1a1a] border-r border-white/5 flex flex-col items-center py-6 text-[#3b3b3b] font-mono text-[10px] select-none">
                          {Array.from({ length: 30 }).map((_, i) => (
                            <div key={i} className="h-5 leading-5">{i + 1}</div>
                          ))}
                        </div>
                        <textarea
                          className="flex-1 p-6 bg-black text-[#54ff54] font-mono text-sm outline-none resize-none spellcheck-false leading-5"
                          value={fileContent}
                          onChange={e => setFileContent(e.target.value)}
                          placeholder="# Write your python code here"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="console" className="h-full m-0 flex flex-col overflow-hidden border-4 border-black bg-black">
                     <div className="p-3 bg-[#1a1a1a] border-b-2 border-white/5 flex items-center justify-between px-6">
                        <span className="text-[10px] font-black text-[#7a7a7a] uppercase tracking-widest">Bot Output Stream</span>
                        <div className="flex gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        </div>
                     </div>
                     <ScrollArea className="flex-1 p-8 font-mono text-xs text-[#bcbcbc]">
                        {logs.length === 0 && <div className="text-[#3b3b3b] italic">Waiting for bot to start...</div>}
                        {logs.map(log => (
                          <div key={log.id} className="mb-2 flex gap-4">
                            <span className="text-[#3b3b3b] shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={log.message.includes("Error") ? "text-red-500" : "text-white/90"}>
                              <span className="text-[#54a332] mr-2">❯</span>
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </ScrollArea>
                  </TabsContent>

                  <TabsContent value="packages" className="h-full m-0 flex flex-col bg-black p-10 border-4 border-black">
                    <div className="max-w-2xl mx-auto w-full space-y-10">
                      <div className="bg-[#1a1a1a] p-8 border-4 border-black">
                        <h3 className="text-xl font-black text-white italic uppercase mb-4 flex items-center gap-3">
                          <Package className="text-[#54a332]" /> Package Manager
                        </h3>
                        <p className="text-xs text-[#7a7a7a] mb-8 font-bold leading-relaxed">
                          Install any Python package you want. Edit <code className="text-[#ffcc00]">requirements.txt</code> in the code tab and click the button below.
                        </p>
                        <button 
                          onClick={installPackages}
                          disabled={isInstalling}
                          className="mc-btn w-full bg-[#54a332] text-xl font-black py-4 border-4 flex items-center justify-center gap-4 shadow-none"
                        >
                          <Download className="h-6 w-6" /> {isInstalling ? "INSTALLING..." : "INSTALL PACKAGES"}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="text-[10px] font-bold text-[#7a7a7a] uppercase tracking-[0.2em]">Default Substrates</div>
                        <div className="grid grid-cols-2 gap-4">
                          {["discord.py", "python-dotenv", "aiohttp", "requests"].map(pkg => (
                            <div key={pkg} className="p-4 border-2 border-[#4a4a4a] flex items-center justify-between bg-black/40">
                              <span className="font-mono text-xs">{pkg}</span>
                              <div className="w-2 h-2 bg-[#54a332]"></div>
                            </div>
                          ))}
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
            <h3 className="text-3xl font-black italic text-white uppercase mb-4">No Node Linked</h3>
            <p className="max-w-xs text-[#bcbcbc] font-bold text-sm leading-relaxed">
              Initialize a compute segment from the core sidebar to begin telemetry.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
