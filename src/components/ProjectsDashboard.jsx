import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HardDrive, Plus, X, Bot, ChevronRight, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [botName, setBotName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const u = sessionStorage.getItem("rc_user");
    const t = sessionStorage.getItem("rc_token");
    if (!u || !t) { navigate("/"); return; }
    setUser(JSON.parse(u));
    const p = sessionStorage.getItem("rc_projects");
    setProjects(p ? JSON.parse(p) : []);
  }, []);

  function saveProjects(list) {
    sessionStorage.setItem("rc_projects", JSON.stringify(list));
    setProjects(list);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = botName.trim();
    const token = botToken.trim();
    if (!name || !token) return toast.error("Bot name and token are required");
    setCreating(true);
    try {
      const id = `proj_${Date.now()}`;
      const regRes = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token }),
      });
      if (!regRes.ok) {
        const d = await regRes.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to register bot");
      }
      const newProject = { id, name, token, createdAt: new Date().toISOString() };
      const updated = [...projects, newProject];
      saveProjects(updated);
      toast.success(`Project "${name}" created!`);
      setBotName("");
      setBotToken("");
      setShowModal(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    sessionStorage.clear();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#1e140a] text-[#f0f0f0] flex flex-col">
      <nav className="flex items-center justify-between px-8 h-20 border-b-4 border-black bg-[#3b3b3b] relative z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#54a332] border-4 border-black flex items-center justify-center shadow-[inset_2px_2px_0px_#bcbcbc]">
            <HardDrive className="text-white h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white uppercase italic">Reboot Cord</span>
        </div>
        <div className="flex items-center gap-6">
          {user && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#54ff54]">
              {user.username}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="mc-btn border-4 border-black bg-[#cc4444] font-black text-xs flex items-center gap-2"
          >
            <LogOut className="h-3 w-3" /> LOGOUT
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-16">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Your Projects</h1>
            <p className="text-[#bcbcbc] font-bold text-sm uppercase tracking-widest mt-2">
              {projects.length} bot{projects.length !== 1 ? "s" : ""} managed
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="mc-btn border-4 border-black bg-[#54a332] font-black text-sm flex items-center gap-3 px-6 py-3"
          >
            <Plus className="h-4 w-4" /> Create New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="w-24 h-24 bg-[#3b3b3b] border-4 border-black flex items-center justify-center mb-6">
              <Bot className="h-12 w-12 text-[#bcbcbc]/20" />
            </div>
            <h3 className="text-2xl font-black italic text-white uppercase mb-3">No Projects Yet</h3>
            <p className="text-[#bcbcbc] font-bold text-sm max-w-xs leading-relaxed">
              Create your first bot project to get started.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mc-btn border-4 border-black bg-[#54a332] font-black text-sm flex items-center gap-2 mt-8"
            >
              <Plus className="h-4 w-4" /> Create New Project
            </button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj, i) => (
              <motion.div
                key={proj.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#1a1a1a] border-4 border-black p-6 space-y-4 hover:border-[#54a332] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-[#54a332] border-2 border-black flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[8px] text-[#4a4a4a] font-mono uppercase">{proj.id}</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic truncate">{proj.name}</h3>
                  <p className="text-[10px] text-[#7a7a7a] font-bold uppercase tracking-widest mt-1">
                    {new Date(proj.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/project/${proj.id}`)}
                  className="mc-btn w-full border-4 border-black bg-[#3b3b3b] font-black text-xs flex items-center justify-center gap-2 hover:bg-[#4a3b31]"
                >
                  GO TO PROJECT <ChevronRight className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#1a1a1a] border-4 border-black"
            >
              <div className="flex items-center justify-between p-5 bg-[#54a332] border-b-4 border-black">
                <span className="font-black uppercase italic text-white text-lg">New Bot Project</span>
                <button onClick={() => setShowModal(false)} className="text-white hover:text-[#1a1a1a]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7a7a]">
                    Bot name:
                  </label>
                  <input
                    className="mc-input w-full font-mono text-sm"
                    placeholder="My Awesome Bot"
                    value={botName}
                    onChange={e => setBotName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7a7a]">
                    Discord bot token:
                  </label>
                  <input
                    className="mc-input w-full font-mono text-sm"
                    placeholder="Bot token..."
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                    type="password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="mc-btn w-full bg-[#54a332] border-black border-4 font-black uppercase text-base disabled:opacity-50 mt-2"
                >
                  {creating ? "CREATING..." : "CREATE PROJECT"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
