import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, User, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AuthAccount() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem("rc_token")) {
      navigate("/");
    }
  }, []);

  function handleCreate(e) {
    e.preventDefault();
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) return toast.error("Username and password are required");
    if (p.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    setTimeout(() => {
      sessionStorage.setItem("rc_user", JSON.stringify({ username: u }));
      if (!sessionStorage.getItem("rc_projects")) {
        sessionStorage.setItem("rc_projects", JSON.stringify([]));
      }
      toast.success(`Welcome, ${u}!`);
      navigate("/dashboard");
    }, 600);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1e140a] text-[#f0f0f0] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-[50%] bg-[#4da6ff]/5 pointer-events-none" />

      <nav className="flex items-center justify-between px-8 h-20 border-b-4 border-black bg-[#3b3b3b] relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#54a332] border-4 border-black flex items-center justify-center shadow-[inset_2px_2px_0px_#bcbcbc]">
            <HardDrive className="text-white h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white uppercase italic">Reboot Cord</span>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-8 py-16 relative z-10">
        <div className="w-full max-w-md space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#54a332] border-4 border-black shadow-[inset_2px_2px_0px_#bcbcbc] mx-auto">
              <ShieldCheck className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">Create Account</h1>
            <p className="text-[#bcbcbc] font-bold text-sm uppercase tracking-widest">Set up your Reboot Cord account</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.07 }}
            className="bg-[#1a1a1a] border-4 border-black p-8 space-y-6"
          >
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7a7a] flex items-center gap-2">
                  <User className="h-3 w-3" /> Enter your username:
                </label>
                <input
                  className="mc-input w-full font-mono text-sm"
                  placeholder="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  type="text"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7a7a] flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Enter the account password:
                </label>
                <input
                  className="mc-input w-full font-mono text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mc-btn w-full bg-[#54a332] border-black border-4 font-black uppercase text-lg disabled:opacity-50 mt-2"
              >
                {loading ? "CREATING..." : "Create Account"}
              </button>
            </form>
          </motion.div>

          <div className="text-[10px] text-[#4a4a4a] text-center font-bold uppercase tracking-widest">
            Account stored in memory only
          </div>
        </div>
      </main>

      <footer className="h-16 px-8 flex items-center justify-between border-t-4 border-black bg-[#1a1a1a] text-xs font-bold text-[#7a7a7a] uppercase tracking-widest relative z-10">
        <div>REBOOT_CORD CORE // VERSION 2.0.0</div>
      </footer>
    </div>
  );
}
