import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, ChildProcess } from "child_process";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json({ limit: "10mb" }));

interface BotProcess {
  proc: ChildProcess;
  startedAt: number;
}

const processes = new Map<string, BotProcess>();
const logBuffers = new Map<string, string[]>();
const wsClients = new Map<string, Set<WebSocket>>();

const BOTS_DIR = path.join(process.cwd(), "bots");
fs.mkdirSync(BOTS_DIR, { recursive: true });

function safePath(base: string, rel: string): string {
  const resolved = path.resolve(base, rel.replace(/^\/+/, ""));
  if (!resolved.startsWith(base)) throw new Error("Invalid path");
  return resolved;
}

function addLog(id: string, line: string) {
  if (!logBuffers.has(id)) logBuffers.set(id, []);
  const buf = logBuffers.get(id)!;
  buf.push(line);
  if (buf.length > 500) buf.shift();
  const clients = wsClients.get(id);
  if (clients) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "log", line }));
      }
    }
  }
}

function broadcastStatus(id: string, running: boolean) {
  const clients = wsClients.get(id);
  if (clients) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status", running }));
      }
    }
  }
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const id = url.searchParams.get("projectId");
  if (!id) { ws.close(); return; }

  if (!wsClients.has(id)) wsClients.set(id, new Set());
  wsClients.get(id)!.add(ws);

  const buf = logBuffers.get(id) || [];
  for (const line of buf) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "log", line }));
    }
  }

  const running = processes.has(id);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "status", running }));
  }

  ws.on("close", () => {
    wsClients.get(id)?.delete(ws);
  });
});

app.post("/api/discord/validate", async (req, res) => {
  try {
    const token = (req.body.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token required" });
    const r = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) return res.status(401).json({ error: "Invalid Discord bot token" });
    const data = await r.json() as { username: string; id: string };
    res.json({ valid: true, username: data.username, id: data.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots", (req, res) => {
  try {
    const { id, token } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    const botDir = path.join(BOTS_DIR, id);
    fs.mkdirSync(botDir, { recursive: true });
    if (token) {
      const envPath = path.join(botDir, ".env");
      fs.writeFileSync(envPath, `DISCORD_TOKEN=${token}\n`, "utf8");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bots/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const bp = processes.get(id);
    if (!bp || !bp.proc.pid) return res.json({ running: false, cpu: 0, memory: 0, uptime: 0 });

    let memVal = 0;
    try {
      const statusFile = `/proc/${bp.proc.pid}/status`;
      if (fs.existsSync(statusFile)) {
        const content = fs.readFileSync(statusFile, "utf8");
        const match = content.match(/VmRSS:\s+(\d+)/);
        if (match) memVal = parseInt(match[1]) * 1024;
      }
    } catch {}

    res.json({
      running: true,
      cpu: 0,
      memory: memVal,
      uptime: Date.now() - bp.startedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots/:id/power", (req, res) => {
  try {
    const { id } = req.params;
    const { signal } = req.body;
    const botDir = path.join(BOTS_DIR, id);

    if (signal === "stop" || signal === "restart") {
      const bp = processes.get(id);
      if (bp) {
        try { bp.proc.kill("SIGTERM"); } catch {}
        processes.delete(id);
        addLog(id, "[SYSTEM] Bot stopped");
        broadcastStatus(id, false);
      }
    }

    if (signal === "start" || signal === "restart") {
      if (processes.has(id)) {
        try { processes.get(id)!.proc.kill("SIGTERM"); } catch {}
        processes.delete(id);
      }
      fs.mkdirSync(botDir, { recursive: true });
      const entry = ["index.js", "bot.js", "main.js", "app.js"].find((f) =>
        fs.existsSync(path.join(botDir, f))
      );
      if (!entry) {
        return res.status(400).json({
          error: "No entry file found. Upload index.js, bot.js, main.js, or app.js first.",
        });
      }
      const env: NodeJS.ProcessEnv = { ...process.env };
      const envFile = path.join(botDir, ".env");
      if (fs.existsSync(envFile)) {
        for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
          const eqIdx = line.indexOf("=");
          if (eqIdx > 0) {
            const k = line.slice(0, eqIdx).trim();
            const v = line.slice(eqIdx + 1).trim();
            if (k) env[k] = v;
          }
        }
      }
      const proc = spawn("node", [entry], {
        cwd: botDir,
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
      processes.set(id, { proc, startedAt: Date.now() });
      addLog(id, `[SYSTEM] Starting ${entry}`);
      broadcastStatus(id, true);

      proc.stdout!.on("data", (d: Buffer) => {
        d.toString().split("\n").filter(Boolean).forEach((l) => addLog(id, l));
      });
      proc.stderr!.on("data", (d: Buffer) => {
        d.toString().split("\n").filter(Boolean).forEach((l) => addLog(id, `[ERR] ${l}`));
      });
      proc.on("exit", (code) => {
        processes.delete(id);
        addLog(id, `[SYSTEM] Bot exited with code ${code ?? "unknown"}`);
        broadcastStatus(id, false);
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots/:id/command", (req, res) => {
  try {
    const bp = processes.get(req.params.id);
    if (!bp) return res.status(400).json({ error: "Bot not running" });
    try { bp.proc.stdin!.write(req.body.command + "\n"); } catch {}
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bots/:id/files", (req, res) => {
  try {
    const botDir = path.join(BOTS_DIR, req.params.id);
    const dir = safePath(botDir, (req.query.directory as string) || "/");
    fs.mkdirSync(dir, { recursive: true });
    const entries = fs.readdirSync(dir, { withFileTypes: true }).map((e) => {
      const fp = path.join(dir, e.name);
      const stat = fs.statSync(fp);
      return {
        name: e.name,
        is_file: e.isFile(),
        size: stat.size,
        modified_at: stat.mtime.toISOString(),
      };
    });
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bots/:id/files/content", (req, res) => {
  try {
    const botDir = path.join(BOTS_DIR, req.params.id);
    const filePath = safePath(botDir, (req.query.file as string) || "");
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.json({ content: fs.readFileSync(filePath, "utf8") });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots/:id/files/write", (req, res) => {
  try {
    const botDir = path.join(BOTS_DIR, req.params.id);
    const filePath = safePath(botDir, (req.query.file as string) || "");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, req.body.content ?? "", "utf8");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots/:id/files/delete", (req, res) => {
  try {
    const botDir = path.join(BOTS_DIR, req.params.id);
    const root = (req.body.root as string) || "/";
    for (const f of (req.body.files as string[]) || []) {
      const fp = safePath(botDir, path.join(root, f));
      if (fs.existsSync(fp)) fs.rmSync(fp, { recursive: true, force: true });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`RebootCord running on port ${PORT}`);
  });
}

startServer();
