import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  function pteroHeaders(req: express.Request) {
    return {
      Authorization: `Bearer ${req.headers["x-api-key"]}`,
      Accept: "Application/vnd.pterodactyl.v1+json",
      "Content-Type": "application/json",
    };
  }

  function panelUrl(req: express.Request) {
    return ((req.headers["x-panel-url"] as string) || "").replace(/\/$/, "");
  }

  async function safeJson(r: Response): Promise<any> {
    const text = await r.text();
    if (!text || !text.trim()) return {};
    try { return JSON.parse(text); } catch { return { _raw: text }; }
  }

  app.get("/api/servers", async (req, res) => {
    try {
      const r = await fetch(`${panelUrl(req)}/api/client`, { headers: pteroHeaders(req) });
      const data = await safeJson(r);
      if (!r.ok) return res.status(r.status).json({ error: data?.errors?.[0]?.detail || data?.message || `HTTP ${r.status}` });
      const servers = (data.data || []).map((s: any) => ({
        id: s.attributes.identifier,
        uuid: s.attributes.uuid,
        name: s.attributes.name,
        description: s.attributes.description,
        status: s.attributes.status,
        is_suspended: s.attributes.is_suspended,
        limits: s.attributes.limits,
        node: s.attributes.node,
      }));
      res.json(servers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/servers/:id/resources", async (req, res) => {
    try {
      const r = await fetch(`${panelUrl(req)}/api/client/servers/${req.params.id}/resources`, { headers: pteroHeaders(req) });
      const data = await safeJson(r);
      if (!r.ok) return res.status(r.status).json({ error: data?.errors?.[0]?.detail || `HTTP ${r.status}` });
      res.json(data.attributes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/servers/:id/power", async (req, res) => {
    try {
      const r = await fetch(`${panelUrl(req)}/api/client/servers/${req.params.id}/power`, {
        method: "POST",
        headers: pteroHeaders(req),
        body: JSON.stringify({ signal: req.body.signal }),
      });
      if (r.status === 204) return res.json({ success: true });
      const data = await safeJson(r);
      res.status(r.ok ? 200 : r.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/servers/:id/command", async (req, res) => {
    try {
      const r = await fetch(`${panelUrl(req)}/api/client/servers/${req.params.id}/command`, {
        method: "POST",
        headers: pteroHeaders(req),
        body: JSON.stringify({ command: req.body.command }),
      });
      if (r.status === 204) return res.json({ success: true });
      const data = await safeJson(r);
      res.status(r.ok ? 200 : r.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/servers/:id/websocket", async (req, res) => {
    try {
      const r = await fetch(`${panelUrl(req)}/api/client/servers/${req.params.id}/websocket`, { headers: pteroHeaders(req) });
      const data = await safeJson(r);
      if (!r.ok) return res.status(r.status).json({ error: data?.errors?.[0]?.detail || `HTTP ${r.status}` });
      res.json(data.data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/servers/:id/files", async (req, res) => {
    try {
      const dir = (req.query.directory as string) || "/";
      const r = await fetch(
        `${panelUrl(req)}/api/client/servers/${req.params.id}/files/list?directory=${encodeURIComponent(dir)}`,
        { headers: pteroHeaders(req) }
      );
      const data = await safeJson(r);
      if (!r.ok) return res.status(r.status).json({ error: data?.errors?.[0]?.detail || `HTTP ${r.status}` });
      const files = (data.data || []).map((f: any) => ({
        name: f.attributes.name,
        is_file: f.attributes.is_file,
        size: f.attributes.size,
        modified_at: f.attributes.modified_at,
      }));
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/servers/:id/files/content", async (req, res) => {
    try {
      const file = (req.query.file as string) || "";
      const r = await fetch(
        `${panelUrl(req)}/api/client/servers/${req.params.id}/files/contents?file=${encodeURIComponent(file)}`,
        { headers: pteroHeaders(req) }
      );
      if (!r.ok) {
        const data = await safeJson(r);
        return res.status(r.status).json({ error: data?.errors?.[0]?.detail || `HTTP ${r.status}` });
      }
      const text = await r.text();
      res.json({ content: text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/servers/:id/files/write", async (req, res) => {
    try {
      const file = (req.query.file as string) || "";
      const r = await fetch(
        `${panelUrl(req)}/api/client/servers/${req.params.id}/files/write?file=${encodeURIComponent(file)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${req.headers["x-api-key"]}`,
            Accept: "Application/vnd.pterodactyl.v1+json",
            "Content-Type": "text/plain",
          },
          body: req.body.content,
        }
      );
      if (r.status === 204) return res.json({ success: true });
      const data = await safeJson(r);
      res.status(r.ok ? 200 : r.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/servers/:id/files/delete", async (req, res) => {
    try {
      const r = await fetch(
        `${panelUrl(req)}/api/client/servers/${req.params.id}/files/delete`,
        {
          method: "POST",
          headers: pteroHeaders(req),
          body: JSON.stringify({ root: req.body.root || "/", files: req.body.files }),
        }
      );
      if (r.status === 204) return res.json({ success: true });
      const data = await safeJson(r);
      res.status(r.ok ? 200 : r.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Reboot Cord running on http://localhost:${PORT}`);
  });
}

startServer();
