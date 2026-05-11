import { motion } from "framer-motion";
import { HardDrive, Pickaxe, Zap } from "lucide-react";

export default function Landing({ onStart }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1e140a] text-[#f0f0f0]">
      {/* Minecraft-like sky/dirt divider */}
      <div className="absolute top-0 left-0 w-full h-[60%] bg-[#4da6ff]/10"></div>
      
      <nav className="flex items-center justify-between px-8 h-20 border-b-4 border-black bg-[#3b3b3b] relative z-10 box-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#54a332] border-4 border-black flex items-center justify-center shadow-[inset_2px_2px_0px_#bcbcbc]">
            <HardDrive className="text-white h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white uppercase italic">Reboot Cord</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-[#bcbcbc] uppercase tracking-wider">
          <a href="#" className="hover:text-white transition-colors">Server List</a>
          <a href="#" className="hover:text-white transition-colors">Purchase</a>
        </div>
        <button 
          className="mc-btn font-bold uppercase tracking-wider"
          onClick={onStart}
        >
          Login
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-8 py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 px-3 py-1 bg-black/40 border-2 border-[#54a332] text-[#54ff54] font-bold"
            >
              <Zap className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Servers are active</span>
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
                The ultimate hosting for discord bot developers. 24/7 uptime, raw file access, and one-click package installation. No complex configs, no complex issues, just pure fast hosting.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button 
                onClick={onStart}
                className="mc-btn px-16 py-8 text-3xl font-black bg-[#54a332] hover:bg-[#65c43d] border-black border-4 shadow-none"
              >
                START NOW
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mc-block p-1 bg-[#1a1a1a]"
          >
            <div className="bg-black/60 p-8 space-y-8 border-4 border-black">
              <div className="flex items-center justify-between border-b-4 border-black pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#4a3b31] border-4 border-black flex items-center justify-center">
                    <Pickaxe className="text-[#ffcc00] h-8 w-8" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-white uppercase italic">Project_Reboot</div>
                    <div className="text-[10px] text-[#bcbcbc] font-bold uppercase">v1.4.2 stable</div>
                  </div>
                </div>
                <div className="w-4 h-4 bg-[#54ff54] animate-pulse"></div>
              </div>
              
              <div className="space-y-6 font-mono">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-[#7a7a7a]">
                    <span>CPU ALLOCATION</span>
                    <span className="text-[#54ff54]">24%</span>
                  </div>
                  <div className="h-4 bg-black border-2 border-[#4a4a4a]">
                    <div className="h-full bg-[#54a332] w-[24%]"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-[#7a7a7a]">
                    <span>MEMORY COMMIT</span>
                    <span className="text-[#ffcc00]">128MB</span>
                  </div>
                  <div className="h-4 bg-black border-2 border-[#4a4a4a]">
                    <div className="h-full bg-[#ffcc00] w-[45%]"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 border-2 border-[#4a4a4a] text-center">
                  <div className="text-[10px] text-[#7a7a7a] font-bold uppercase mb-1">Region</div>
                  <div className="text-md font-bold text-white tracking-widest uppercase">Global</div>
                </div>
                <div className="p-4 bg-black/40 border-2 border-[#4a4a4a] text-center">
                  <div className="text-[10px] text-[#7a7a7a] font-bold uppercase mb-1">Ping</div>
                  <div className="text-md font-bold text-[#54ff54] tracking-widest uppercase">12ms</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="h-24 px-8 flex items-center justify-between border-t-4 border-black bg-[#1a1a1a] text-xs font-bold text-[#7a7a7a] uppercase tracking-widest relative z-10">
        <div>REBOOT_CORD CORE // VERSION 2.0.0</div>
        <div className="flex gap-8">
          <span className="text-white hover:text-[#54a332] cursor-pointer">TERMS</span>
          <span className="text-white hover:text-[#54a332] cursor-pointer">PRIVACY</span>
        </div>
      </footer>
    </div>
  );
}
