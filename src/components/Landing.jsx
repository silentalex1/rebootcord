import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, Zap, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Landing() {
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleConnect(e) {
    e.preventDefault();
    const token = botToken.trim();
    if (!token) return toast.error("Bot token is required");
    setLoading(true);
    try {
      const res = await fetch("/api/discord/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Invalid bot token");
      sessionStorage.setItem("rc_token", token);
      toast.success(`Connected as ${data.username}!`);
      navigate("/authaccount");
    } catch (err) {
      toast.error(`Connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1e140a] text-[#f0f0f0]">
      <div className="absolute top-0 left-0 w-full h-[60%] bg-[#4da6ff]/10" />

      <nav className="flex items-center justify-between px-8 h-20 border-b-4 border-black bg-[#3b3b3b] relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#54a332] border-4 border-black flex items-center justify-center shadow-[inset_2px_2px_0px_#bcbcbc]">
            <HardDrive className="text-white h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white uppercase italic">Reboot Cord</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-[#bcbcbc] uppercase tracking-wider">
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Dev Portal</a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8 py-24 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 px-3 py-1 bg-black/40 border-2 border-[#54a332] text-[#54ff54] font-bold"
            >
              <Zap className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Self-Hosted Bot Manager</span>
            </motion.div>

            <div className="space-y-4">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="text-7xl md:text-8xl font-black text-white leading-[0.85] uppercase italic"
              >
                FAST <br />
                <span className="text-[#ffcc00] drop-shadow-[6px_6px_0px_#cc9900]">BOT HOST.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-[#bcbcbc] max-w-lg leading-relaxed font-bold border-l-4 border-[#4a3b31] pl-6"
              >
                Connect your Discord bot and manage it directly. Real-time logs, file editor, and power controls — no third-party panels needed.
              </motion.p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mc-block p-1 bg-[#1a1a1a]"
          >
            <div className="bg-black/60 p-8 space-y-6 border-4 border-black">
              <div className="border-b-4 border-black pb-6">
                <div className="text-lg font-black text-white uppercase italic mb-1">Panel Login</div>
                <div className="text-[10px] text-[#bcbcbc] font-bold uppercase tracking-widest">Connect your Discord bot</div>
              </div>

              <form onSubmit={handleConnect} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7a7a] flex items-center gap-2">
                    <KeyRound className="h-3 w-3" /> Your Bot Token
                  </label>
                  <input
                    className="mc-input w-full font-mono text-sm"
                    placeholder="Enter your Discord bot token..."
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                    type="password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mc-btn w-full bg-[#54a332] border-black border-4 font-black uppercase text-lg disabled:opacity-50"
                >
                  {loading ? "CONNECTING..." : "CONNECT"}
                </button>
              </form>

              <div className="text-[10px] text-[#4a4a4a] text-center font-bold uppercase tracking-widest">
                Credentials stored in memory only
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="h-24 px-8 flex items-center justify-between border-t-4 border-black bg-[#1a1a1a] text-xs font-bold text-[#7a7a7a] uppercase tracking-widest relative z-10">
        <div>REBOOT_CORD CORE // VERSION 2.1.0</div>
        <div className="flex gap-8">
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-white hover:text-[#54a332] cursor-pointer">DEV PORTAL</a>
        </div>
      </footer>
    </div>
  );
}
