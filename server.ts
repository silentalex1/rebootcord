import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import db from "./src/lib/db.ts";
import { randomUUID } from "crypto";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botProcesses = new Map<string, ChildProcess>();
const BOTS_DIR = path.join(process.cwd(), "bots");

if (!fs.existsSync(BOTS_DIR)) {
  fs.mkdirSync(BOTS_DIR, { recursive: true });
}

function addLog(botId: string, message: string) {
  db.prepare("INSERT INTO logs (bot_id, message) VALUES (?, ?)").run(botId, message);
}

async function startBot(botId: string) {
  if (botProcesses.has(botId)) return;

  const botDir = path.join(BOTS_DIR, botId);
  const mainFile = path.join(botDir, "main.py");

  if (!fs.existsSync(mainFile)) {
    addLog(botId, "Error: main.py not found. Please create it first.");
    return;
  }

  addLog(botId, "System: Initializing Python environment...");

  const process = spawn("python3", ["-u", "main.py"], {
    cwd: botDir,
    env: { ...process.env, PYTHONUNBUFFERED: "1" }
  });

  botProcesses.set(botId, process);
  db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(botId);

  process.stdout.on("data", (data) => {
    addLog(botId, data.toString().trim());
  });

  process.stderr.on("data", (data) => {
    addLog(botId, `Error: ${data.toString().trim()}`);
  });

  process.on("close", (code) => {
    addLog(botId, `System: Process exited with code ${code}`);
    botProcesses.delete(botId);
    db.prepare("UPDATE bots SET status = 'stopped' WHERE id = ?").run(botId);
  });
}

async function stopBot(botId: string) {
  const process = botProcesses.get(botId);
  if (process) {
    process.kill();
    botProcesses.delete(botId);
    addLog(botId, "System: Instance terminated safely.");
    db.prepare("UPDATE bots SET status = 'stopped' WHERE id = ?").run(botId);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/bots", (req, res) => {
    const bots = db.prepare("SELECT * FROM bots ORDER BY created_at DESC").all();
    res.json(bots);
  });

  app.post("/api/bots", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Missing name" });
    const id = randomUUID();
    
    // Create bot directory and basic template
    const botDir = path.join(BOTS_DIR, id);
    fs.mkdirSync(botDir, { recursive: true });
    fs.writeFileSync(path.join(botDir, "main.py"), "print('Hello from Reboot Cord!')\nimport os\n# Print environment variables for debug\n# print(os.environ)");
    fs.writeFileSync(path.join(botDir, "requirements.txt"), "discord.py\n");

    db.prepare("INSERT INTO bots (id, name, token, status) VALUES (?, ?, ?, ?)").run(id, name, 'N/A', 'stopped');
    res.json({ id, name, status: 'stopped' });
  });

  app.get("/api/bots/:id/files", (req, res) => {
    const { id } = req.params;
    const botDir = path.join(BOTS_DIR, id);
    if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot not found" });
    const files = fs.readdirSync(botDir);
    res.json(files);
  });

  app.get("/api/bots/:id/files/:filename", (req, res) => {
    const { id, filename } = req.params;
    const filePath = path.join(BOTS_DIR, id, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content });
  });

  app.post("/api/bots/:id/files/:filename", (req, res) => {
    const { id, filename } = req.params;
    const { content } = req.body;
    const filePath = path.join(BOTS_DIR, id, filename);
    fs.writeFileSync(filePath, content);
    res.json({ success: true });
  });

  app.post("/api/bots/:id/pip", (req, res) => {
    const { id } = req.params;
    const botDir = path.join(BOTS_DIR, id);
    addLog(id, "System: Installing dependencies from requirements.txt...");
    
    const pip = spawn("pip3", ["install", "-r", "requirements.txt"], {
      cwd: botDir
    });

    pip.stdout.on("data", (data) => addLog(id, data.toString().trim()));
    pip.stderr.on("data", (data) => addLog(id, `Pip Error: ${data.toString().trim()}`));
    pip.on("close", (code) => {
      addLog(id, `System: Pip finished with code ${code}`);
      res.json({ success: code === 0 });
    });
  });

  app.post("/api/bots/:id/start", async (req, res) => {
    const { id } = req.params;
    await startBot(id);
    res.json({ success: true });
  });

  app.post("/api/bots/:id/stop", async (req, res) => {
    const { id } = req.params;
    await stopBot(id);
    res.json({ success: true });
  });

  app.get("/api/bots/:id/logs", (req, res) => {
    const { id } = req.params;
    const logs = db.prepare("SELECT * FROM logs WHERE bot_id = ? ORDER BY timestamp DESC LIMIT 50").all();
    res.json(logs);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
