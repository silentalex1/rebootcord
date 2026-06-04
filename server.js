const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const cp = require('child_process');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const util = require('util');

const execAsync = util.promisify(cp.exec);

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const upload = multer({ dest: 'uploads/' });

app.use(cors());

const DB_FILE = path.join(__dirname, 'db.json');
const PROJECTS_DIR = path.join(__dirname, 'projects_data');
const SECRET = process.env.SESSION_SECRET || 'rebootcord-secret-key';

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

function loadDB() {
  try { if (fs.existsSync(DB_FILE)) { const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); if(!d.changelogs) d.changelogs=[]; if(!d.apiKeys) d.apiKeys=[]; if(!d.feedbacks) d.feedbacks=[]; if(!d.feedbackChats) d.feedbackChats={}; return d; } } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [], mcPorts: 25565, changelogs: [], apiKeys: [], feedbacks: [], feedbackChats: {} };
}

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch(e) {}
}

let db = loadDB();
const procs = {};
const wsClients = new Set();
const rateLimit = {};
function checkRate(key, max, winMs) { const now = Date.now(); if (!rateLimit[key]) rateLimit[key] = []; rateLimit[key] = rateLimit[key].filter(t => now - t < winMs); if (rateLimit[key].length >= max) return false; rateLimit[key].push(now); return true; }

function getDirTree(dir, base) {
  const res = [];
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return res; }
  for (const ent of ents) {
    const full = path.join(dir, ent.name);
    let stat;
    try { stat = fs.statSync(full); } catch (e) { continue; }
    const rel = base ? base + "/" + ent.name : ent.name;
    if (ent.isDirectory()) {
      res.push({ name: ent.name, rel: rel, isDir: true, size: 0, children: getDirTree(full, rel) });
    } else {
      res.push({ name: ent.name, rel: rel, isDir: false, size: stat.size });
    }
  }
  return res;
}

function collectFiles(tree, out) {
  if (!out) out = [];
  for (const n of tree) {
    if (n.isDir && n.children) collectFiles(n.children, out);
    else out.push(n);
  }
  return out;
}

function safeJoin(base, name) {
  const resolved = path.resolve(base, name);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

function signToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now() })).toString('base64');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64');
  return payload + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(parts[0]).digest('base64');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))) return null;
  try { return JSON.parse(Buffer.from(parts[0], 'base64').toString()).u; } catch(e) { return null; }
}

function parseCookies(req) {
  const out = {};
  const cookieHeader = req.headers.cookie || '';
  cookieHeader.split(';').forEach(p => {
    const parts = p.trim().split('=');
    const k = parts[0];
    const v = parts.slice(1).join('=');
    if (k) out[k.trim()] = v.trim();
  });
  return out;
}

function getUser(req) { const c = verifyToken(parseCookies(req)['rc_tok']); if (c) return c; const h = (req.headers['authorization'] || req.headers['Authorization'] || ''); if (h.startsWith('rc_live_')) { const hash = require('crypto').createHash('sha256').update(h).digest('hex'); const k = (db.apiKeys || []).find(x => x.keyHash === hash); if (k) return k.username; } return null; }

function setCookie(res, token) {
  res.setHeader('Set-Cookie', 'rc_tok=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800');
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'rc_tok=; HttpOnly; Path=/; Max-Age=0');
}

function broadcastLog(username, projectId, msg, type) {
  const payload = JSON.stringify({ event: 'log', projectId, msg, type: type || 'info' });
  for (const client of wsClients) {
    if (client.username === username && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, req) => {
  const token = parseCookies(req)['rc_tok'];
  const user = verifyToken(token);
  if (!user) return ws.close();
  ws.username = user;
  wsClients.add(ws);
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.event === 'cmd' && data.projectId && procs[data.projectId]) {
        procs[data.projectId].stdin.write(data.cmd + '\n');
      }
      if (data.event === 'install' && data.projectId) {
        const uObj = db.users.find(u => u.username === user);
        if (!uObj) return;
        const p = uObj.projects.find(x => String(x.id) === String(data.projectId));
        if (p) {
          const pDir = path.join(PROJECTS_DIR, String(p.id));
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          const cmd = p.lang === 'Python' ? `pip install ${data.pkg} --target ./modules` : `npm install ${data.pkg}`;
          broadcastLog(user, p.id, `[PKG] Running ${cmd}...`, 'info');
          cp.exec(cmd, { cwd: pDir, shell: true }, (err, stdout, stderr) => {
            if (stdout) broadcastLog(user, p.id, stdout, 'info');
            if (stderr) broadcastLog(user, p.id, stderr, 'warn');
            if (err) broadcastLog(user, p.id, `[PKG] Failed: ${err.message}`, 'err');
            else broadcastLog(user, p.id, `[PKG] Installed ${data.pkg}`, 'ok');
          });
        }
      }
      if (data.event === 'installAll' && data.projectId) {
        const uObj = db.users.find(u => u.username === user);
        if (!uObj) return;
        const p = uObj.projects.find(x => String(x.id) === String(data.projectId));
        if (p) {
          const pDir = path.join(PROJECTS_DIR, String(p.id));
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          const pkgs = data.pkgs || [];
          if (p.lang === 'Python') {
            const req = path.join(pDir, 'requirements.txt');
            if (pkgs.length > 0) {
              let cur = fs.existsSync(req) ? fs.readFileSync(req, 'utf8') : '';
              const set = new Set(cur.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
              pkgs.forEach(pk => set.add(pk));
              fs.writeFileSync(req, Array.from(set).join('\n') + '\n');
            } else if (!fs.existsSync(req)) {
              fs.writeFileSync(req, '');
            }
          } else {
            const pj = path.join(pDir, 'package.json');
            if (pkgs.length > 0) {
              let obj = { name: 'bot', dependencies: {} };
              if (fs.existsSync(pj)) { try { obj = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch (e) {} }
              obj.dependencies = obj.dependencies || {};
              pkgs.forEach(pk => { if (!obj.dependencies[pk]) obj.dependencies[pk] = '*'; });
              fs.writeFileSync(pj, JSON.stringify(obj, null, 2));
            } else if (!fs.existsSync(pj)) {
              fs.writeFileSync(pj, '{"name":"bot","dependencies":{}}');
            }
          }
          const cmd = p.lang === 'Python' ? `pip install -r requirements.txt --target ./modules` : `npm install`;
          broadcastLog(user, p.id, `[PKG] Running ${cmd}...`, 'info');
          cp.exec(cmd, { cwd: pDir, shell: true }, (err, stdout, stderr) => {
            if (stdout) broadcastLog(user, p.id, stdout, 'info');
            if (stderr) broadcastLog(user, p.id, stderr, 'warn');
            if (err) broadcastLog(user, p.id, `[PKG] Failed: ${err.message}`, 'err');
            else broadcastLog(user, p.id, `[PKG] Installed all packages successfully`, 'ok');
          });
        }
      }
    } catch (e) {}
  });
  ws.on('close', () => wsClients.delete(ws));
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname, { index: false }));
app.use('/sdk', express.static(path.join(__dirname, 'sdk')));

app.get('/', (req, res) => {
  if (getUser(req)) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard/changelogs', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/ourapi', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/changelog', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/changelog/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/changelogs', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/changelogs/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.post('/register', (req, res) => {
  const { username, password, invite } = req.body;
  if (!username || !password || !invite) return res.json({ success: false, message: 'All fields required' });
  const code = invite.startsWith('rebootcord-') ? invite : 'rebootcord-' + invite;
  if (db.blacklisted.includes(code) || db.blacklisted.includes(username)) return res.json({ success: false, message: 'Blacklisted' });
  if (!db.inviteCodes[code]) return res.json({ success: false, message: 'Invalid invite code' });
  if (db.inviteCodes[code] !== true && db.inviteCodes[code] !== username) return res.json({ success: false, message: 'Invite code is bound to your Discord Username only' });
  if (db.users.find(u => u.username === username)) return res.json({ success: false, message: 'Username taken' });
  db.users.push({ username, password, invite: code, projects: [], admin: false });
  delete db.inviteCodes[code];
  saveDB();
  setCookie(res, signToken(username));
  res.json({ success: true, username });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (user && !db.blacklisted.includes(username)) {
    setCookie(res, signToken(username));
    res.json({ success: true, username });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  clearCookie(res);
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const u = getUser(req);
  if (u) {
    const user = db.users.find(x => x.username === u) || {};
    return res.json({ loggedIn: true, username: u, isAdmin: !!user.admin });
  }
  res.json({ loggedIn: false });
});

app.get('/api/projects', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, projects: [] });
  const user = db.users.find(x => x.username === u);
  res.json({ success: true, projects: (user && user.projects) || [] });
});

app.post('/api/projects', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  user.projects = req.body.projects || [];
  db.mcPorts = db.mcPorts || 25565;
  user.projects.forEach(p => {
    if (p.type === 'minecraft' && !p.port) {
      p.port = db.mcPorts++;
    }
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
    if (p.files) {
      for (const fname of Object.keys(p.files)) {
        const filePath = path.join(pDir, fname);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        fs.writeFileSync(filePath, p.files[fname]);
      }
    }
  });
  saveDB();
  res.json({ success: true });
});

app.post('/api/createcode', (req, res) => {
  const { code, user } = req.body;
  if (code) { db.inviteCodes[code] = user || true; saveDB(); }
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  res.json({ activeUsers: db.users.length, totalInvites: Object.keys(db.inviteCodes).length });
});

app.post('/api/blacklist', (req, res) => {
  const { key } = req.body;
  if (key && !db.blacklisted.includes(key)) { db.blacklisted.push(key); saveDB(); }
  res.json({ success: true });
});

app.get('/api/projects/:id/dir', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, files: [] });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false, files: [] });
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  let files = [];
  try {
    if (fs.existsSync(pDir)) {
      files = getDirTree(pDir);
    }
  } catch(e) {}
  res.json({ success: true, files });
});

app.get('/api/projects/:id/file', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  const fname = req.query.name;
  const target = path.join(PROJECTS_DIR, String(p.id), fname);
  try {
    if (fs.existsSync(target)) {
      const content = fs.readFileSync(target, 'utf8');
      return res.json({ success: true, content });
    }
  } catch(e) {}
  res.json({ success: false });
});

app.post('/api/projects/:id/upload', upload.single('file'), (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (p && req.file) {
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
    fs.renameSync(req.file.path, path.join(pDir, req.file.originalname));
    broadcastLog(u, p.id, '[System] Uploaded ' + req.file.originalname, 'info');
  }
  res.json({ success: true });
});

app.post('/api/projects/:id/deleteFile', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (p && req.body.name) {
    const safe = safeJoin(path.join(PROJECTS_DIR, String(p.id)), req.body.name);
    if (!safe) return res.json({ success: false });
    try {
      if (fs.existsSync(safe)) {
        fs.rmSync(safe, { recursive: true, force: true });
        broadcastLog(u, p.id, '[System] Deleted ' + req.body.name, 'warn');
      }
    } catch(e) {}
  }
  res.json({ success: true });
});

app.post('/api/projects/:id/touch', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (p && req.body.name) {
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    const safe = safeJoin(pDir, req.body.name);
    if (!safe) return res.json({ success: false });
    if (!fs.existsSync(path.dirname(safe))) {
      fs.mkdirSync(path.dirname(safe), { recursive: true });
    }
    fs.writeFileSync(safe, '');
  }
  res.json({ success: true });
});

app.post('/api/projects/:id/mkdir', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (p && req.body.name) {
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    const safe = safeJoin(pDir, req.body.name);
    if (!safe) return res.json({ success: false });
    if (!fs.existsSync(safe)) fs.mkdirSync(safe, { recursive: true });
    broadcastLog(u, p.id, '[System] Created folder ' + req.body.name, 'info');
  }
  res.json({ success: true });
});

app.post('/api/projects/:id/backup', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  const ts = Date.now();
  const bname = 'backup_' + ts;
  p._mcBackups = p._mcBackups || [];
  p._mcBackups.unshift({ id: ts, label: "Backup " + new Date().toLocaleString(), ts: new Date().toLocaleString(), dir: bname });
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  const wDir = path.join(pDir, 'world');
  const target = path.join(pDir, bname);
  try {
    if(fs.existsSync(wDir)) fs.cpSync(wDir, target, { recursive: true });
    broadcastLog(u, p.id, '[Backup] Created ' + bname, 'ok');
  } catch(e) {
    broadcastLog(u, p.id, '[Backup] Error: ' + e.message, 'err');
  }
  saveDB();
  res.json({ success: true });
});

app.post('/api/projects/:id/revert', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  const bname = req.body.dir;
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  const wDir = path.join(pDir, 'world');
  const target = path.join(pDir, bname);
  try {
    if (procs[p.id]) {
      procs[p.id].kill();
      delete procs[p.id];
      p.running = false;
    }
    if(fs.existsSync(target)) {
       if(fs.existsSync(wDir)) fs.rmSync(wDir, { recursive: true, force: true });
       fs.cpSync(target, wDir, { recursive: true });
       broadcastLog(u, p.id, '[Backup] Restored ' + bname, 'ok');
    }
  } catch(e) {
    broadcastLog(u, p.id, '[Backup] Error: ' + e.message, 'err');
  }
  saveDB();
  res.json({ success: true });
});

app.post('/api/projects/:id/start', async (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  if (procs[p.id]) {
    try { procs[p.id].kill(); } catch(e) {}
  }

  p.running = true;
  saveDB();

  if (p.type === 'minecraft') {
    let javaCmd = 'java';
    try {
      await execAsync('java -version', { shell: true });
    } catch (e) {
      const jreDir = path.join(PROJECTS_DIR, 'jre');
      const jreBin = path.join(jreDir, 'bin', 'java');
      if (!fs.existsSync(jreBin)) {
        broadcastLog(u, p.id, '[System] Java not found locally. Downloading portable JRE...', 'sys');
        try {
          await execAsync('curl -L -o jre.tar.gz https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_linux_hotspot_21.0.2_13.tar.gz', { cwd: PROJECTS_DIR, shell: true });
          await execAsync('mkdir -p jre && tar -xzf jre.tar.gz -C jre --strip-components=1', { cwd: PROJECTS_DIR, shell: true });
          broadcastLog(u, p.id, '[System] JRE downloaded successfully.', 'ok');
        } catch (err) {
          broadcastLog(u, p.id, '[System] Failed to download JRE: ' + err.message, 'err');
        }
      }
      javaCmd = fs.existsSync(jreBin) ? jreBin : 'java';
    }

    let bindIp = '0.0.0.0';
    if (p.ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p.ip)) bindIp = p.ip;
    fs.writeFileSync(path.join(pDir, 'eula.txt'), 'eula=true\n');
    fs.writeFileSync(path.join(pDir, 'server.properties'), `server-port=${p.port}\nserver-ip=${bindIp}\nonline-mode=false\nmotd=${p.name || 'Minecraft Server'}\n`);
    
    const jarPath = path.join(pDir, 'server.jar');
    if (!fs.existsSync(jarPath)) {
      broadcastLog(u, p.id, '[System] Downloading Minecraft server for ' + (p.serverType || 'Vanilla') + ' ' + (p.version || '1.21.5') + '...', 'sys');
      try {
        if (p.serverType === 'Paper') {
          const apiBase = 'https://api.papermc.io/v2/projects/paper';
          const verRes = await axios.get(apiBase + '/versions/' + p.version);
          const builds = verRes.data.builds;
          const latestBuild = builds[builds.length - 1];
          const dlUrl = apiBase + '/versions/' + p.version + '/builds/' + latestBuild + '/downloads/paper-' + p.version + '-' + latestBuild + '.jar';
          await execAsync('curl -L -o server.jar "' + dlUrl + '"', { cwd: pDir, shell: true });
        } else {
          const man = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
          const verEntry = man.data.versions.find(v => v.id === p.version);
          if (verEntry) {
            const vinfo = await axios.get(verEntry.url);
            const serverUrl = vinfo.data.downloads.server.url;
            await execAsync('curl -L -o server.jar "' + serverUrl + '"', { cwd: pDir, shell: true });
          } else {
            await execAsync('curl -L -o server.jar https://piston-data.mojang.com/v1/objects/8dd1a28015f51b180288e994e101102e3dc23eea/server.jar', { cwd: pDir, shell: true });
          }
        }
        broadcastLog(u, p.id, '[System] Download complete.', 'ok');
      } catch (e) {
        broadcastLog(u, p.id, '[System] Failed to download server jar: ' + e.message, 'err');
      }
    }
    if (!fs.existsSync(jarPath)) {
      broadcastLog(u, p.id, '[System] No server.jar found. Use Files tab to upload the correct server jar for this type/version, then Start again.', 'warn');
    }
    const proc = cp.spawn(javaCmd, ['-Xmx1024M', '-jar', 'server.jar', 'nogui'], { cwd: pDir, shell: true });
    procs[p.id] = proc;

    proc.on('error', (err) => {
      broadcastLog(u, p.id, `[System] Server failed to start: ${err.message}`, 'err');
    });
    
    proc.stdout.on('data', d => {
      d.toString().split('\n').forEach(line => {
        if (!line.trim()) return;
        broadcastLog(u, p.id, line.trim(), 'server');
        if (line.includes('Preparing level')) {
          broadcastLog(u, p.id, '[System] World created', 'ok');
        }
        if (line.includes('Done (')) {
          broadcastLog(u, p.id, `[System] your ${p.ip || 'play.server.net'}:${p.port} has successfully started`, 'ok');
        }
      });
    });
    
    proc.stderr.on('data', d => {
      d.toString().split('\n').forEach(line => {
        if (line.trim()) broadcastLog(u, p.id, line.trim(), 'warn');
      });
    });
    
    proc.on('close', () => { p.running = false; saveDB(); broadcastLog(u, p.id, '[System] Process exited.', 'sys'); });

  } else {
    if (p.files) {
      for (const fname of Object.keys(p.files)) {
        const filePath = path.join(pDir, fname);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        fs.writeFileSync(filePath, p.files[fname]);
      }
    }
    const cmd = p.lang === 'Python' ? 'python3' : 'node';
    const mainFile = Object.keys(p.files || {})[0] || (p.lang === 'Python' ? 'main.py' : 'index.js');
    
    const envVars = { ...process.env, BOT_TOKEN: p.botToken || '', TOKEN: p.botToken || '' };
    if (p.lang === 'Python') envVars.PYTHONPATH = path.join(pDir, 'modules');

    try {
      const envP = path.join(pDir, '.env');
      let ec = fs.existsSync(envP) ? fs.readFileSync(envP, 'utf8') : '';
      if (p.botToken && !ec.match(/^BOT_TOKEN=/m)) {
        ec = ec.trim() + `\nBOT_TOKEN=${p.botToken}\n`;
        fs.writeFileSync(envP, ec.trim() + '\n');
      }
    } catch(e) {}

    const proc = cp.spawn(cmd, ['-u', mainFile], { cwd: pDir, env: envVars, shell: true });
    procs[p.id] = proc;
    let missingPkgs = new Set();
    proc.on('error', (err) => { broadcastLog(u, p.id, `[System] Bot failed to start: ${err.message}`, 'err'); p.running=false; saveDB(); });
    proc.on('close', (code) => { if (procs[p.id]) delete procs[p.id]; p.running = false; saveDB(); broadcastLog(u, p.id, '[System] Process exited ('+code+').', 'sys'); });

    proc.stdout.on('data', d => {
      d.toString().split('\n').forEach(line => {
        if (line.trim()) broadcastLog(u, p.id, line.trim(), 'info');
      });
    });
    
    proc.stderr.on('data', d => {
      d.toString().split('\n').forEach(line => {
        if (!line.trim()) return;
        if (line.includes('INFO') || line.includes('discord.gateway') || line.includes('discord.client') || line.includes('Logged in as')) {
          broadcastLog(u, p.id, line.trim(), 'ok');
        } else {
          broadcastLog(u, p.id, line.trim(), 'err');
          const match = line.match(/ModuleNotFoundError: No module named '([^']+)'/);
          if (match && match[1]) {
            missingPkgs.add(match[1]);
          }
        }
      });
    });
    
  }

  res.json({ success: true });
});

app.post('/api/projects/:id/stop', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });

  if (procs[p.id]) {
    try { procs[p.id].kill('SIGTERM'); setTimeout(()=>{ try{ if(procs[p.id]) procs[p.id].kill('SIGKILL'); }catch(e){} }, 800); } catch(e) {}
    delete procs[p.id];
  }
  p.running = false;
  saveDB();
  broadcastLog(u, p.id, '[System] Process stopped manually.', 'warn');
  res.json({ success: true });
});

app.post('/api/projects/:id/kill', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });

  if (procs[p.id]) {
    try { procs[p.id].kill('SIGKILL'); } catch(e) {}
    delete procs[p.id];
  }
  
  p.running = false;
  saveDB();
  broadcastLog(u, p.id, '[System] Process forcefully killed.', 'warn');
  res.json({ success: true });
});

app.get('/api/admin/data', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ users: [], inviteCodes: {} });
  res.json({ users: db.users, inviteCodes: db.inviteCodes });
});

app.post('/api/admin/revoke', (req, res) => {
  const { code } = req.body;
  if (db.inviteCodes[code] !== undefined) {
    delete db.inviteCodes[code];
    saveDB();
  }
  res.json({ success: true });
});

app.post('/api/admin/set-admin', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const { username, isAdmin } = req.body;
  const target = db.users.find(x => x.username === username);
  if (target) {
    target.admin = !!isAdmin;
    saveDB();
  }
  res.json({ success: true });
});

app.get('/api/changelogs', (req, res) => {
  res.json({ success: true, changelogs: db.changelogs || [] });
});

app.post('/api/changelogs', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, message: 'Login required' });
  const user = db.users.find(x => x.username === u);
  if (!user || !user.admin) return res.json({ success: false, message: 'Admin only' });
  const { title, body, generateLink } = req.body;
  if (!title || !body) return res.json({ success: false });
  db.changelogs = db.changelogs || [];
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ch = { id: Date.now(), title: title.trim(), body: body.trim(), author: u, ts: Date.now(), likes: [], hasLink: !!generateLink, slug: slug };
  db.changelogs.unshift(ch);
  saveDB();
  res.json({ success: true });
});

app.post('/api/changelogs/:id/like', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  db.changelogs = db.changelogs || [];
  const ch = db.changelogs.find(c => String(c.id) === req.params.id);
  if (ch) {
    ch.likes = ch.likes || [];
    const idx = ch.likes.indexOf(u);
    if (idx >= 0) ch.likes.splice(idx, 1);
    else ch.likes.push(u);
    saveDB();
  }
  res.json({ success: true, likes: ch ? (ch.likes || []) : [] });
});

app.post('/api/changelogs/:id/delete', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user || !user.admin) return res.json({ success: false });
  const id = req.params.id;
  db.changelogs = (db.changelogs || []).filter(c => String(c.id) !== String(id));
  saveDB();
  res.json({ success: true });
});

app.post('/api/v1/apikeys', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const raw = 'rc_live_' + require('crypto').randomBytes(32).toString('hex').slice(0, 40);
  const hash = require('crypto').createHash('sha256').update(raw).digest('hex');
  db.apiKeys = db.apiKeys || [];
  db.apiKeys.push({ id, username: u, keyHash: hash, created: new Date().toISOString() });
  saveDB();
  res.json({ success: true, key: raw, id, masked: 'rc_******' });
});

app.get('/api/v1/apikeys', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, keys: [] });
  const keys = (db.apiKeys || []).filter(k => k.username === u).map(k => ({
    id: k.id,
    created: k.created,
    masked: 'rc_******'
  }));
  res.json({ success: true, keys });
});

app.post('/api/v1/deploy', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, message: 'Login required' });
  if (!checkRate('deploy:' + (req.ip || 'x'), 10, 60000)) return res.json({ success: false, message: 'Rate limited' });
  const body = req.body || {};
  res.json({ success: true, message: 'Deploy request received. Hosting magic started.', project: body.projectId || null });
});

app.post('/api/v1/feedback', (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const ip = req.ip || req.headers['x-forwarded-for'] || '0';
  if (!checkRate('fb:' + u + ':' + ip, 8, 120000)) return res.json({ success: false, message: 'Rate limited' });
  const { type, message, email, page } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length < 3) return res.json({ success: false, message: 'Message too short' });
  db.feedbacks = db.feedbacks || [];
  const fb = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), username: u, type: (type||'suggestion').slice(0,32), message: String(message).trim().slice(0,2000), email: email?String(email).slice(0,200):'', page: page?String(page).slice(0,200):'', created: new Date().toISOString() };
  db.feedbacks.push(fb);
  saveDB();
  res.json({ success: true, id: fb.id });
});

app.get('/api/v1/feedbacks', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, feedbacks: [] });
  const list = (db.feedbacks || []).filter(f => f.username === u).slice(-100).reverse();
  res.json({ success: true, feedbacks: list });
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL_MAP = {
  'claude-opus-4-5-20251101': 'gemini-2.5-pro',
  'claude-opus-4-5': 'gemini-2.5-pro',
  'claude-sonnet-4-5-20250929': 'gemini-2.5-pro',
  'claude-sonnet-4-5': 'gemini-2.5-pro',
  'claude-sonnet-4-20250514': 'gemini-2.0-flash',
  'claude-sonnet-4': 'gemini-2.0-flash',
  'claude-3-7-sonnet-20250219': 'gemini-2.0-flash',
  'claude-3-7-sonnet': 'gemini-2.0-flash',
  'claude-3-5-sonnet-20241022': 'gemini-2.5-pro',
  'claude-3-5-sonnet': 'gemini-2.5-pro',
  'claude-3-5-haiku-20241022': 'gemini-2.0-flash',
  'claude-3-5-haiku': 'gemini-2.0-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-pro-exp': 'gemini-2.5-pro',
  'gemini-2.5-pro-001': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-flash-exp': 'gemini-2.5-flash',
  'gemini-2.5-flash-001': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-2.0-flash-exp': 'gemini-2.0-flash',
  'gemini-2.0-flash-001': 'gemini-2.0-flash',
  'gemini-2.0-flash-thinking': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-1.5-pro-exp': 'gemini-1.5-pro',
  'gemini-1.5-pro-001': 'gemini-1.5-pro',
  'gemini-1.5-flash': 'gemini-2.0-flash',
  'gemini-1.5-flash-exp': 'gemini-2.0-flash',
  'gemini-1.5-flash-001': 'gemini-2.0-flash',
  'gpt-4o': 'gemini-2.5-pro',
  'gpt-4o-mini': 'gemini-2.0-flash',
  'gpt-4o-2024-05-13': 'gemini-2.5-pro',
  'gpt-4o-2024-08-06': 'gemini-2.5-pro',
  'gpt-4-turbo': 'gemini-2.0-flash',
  'gpt-4-turbo-2024-04-09': 'gemini-2.0-flash',
  'gpt-4': 'gemini-2.0-flash',
  'gpt-4-0613': 'gemini-2.0-flash',
  'gpt-4-32k': 'gemini-2.0-flash',
  'gpt-3.5-turbo': 'gemini-2.0-flash',
  'gpt-3.5-turbo-0125': 'gemini-2.0-flash',
  'gpt-3.5-turbo-1106': 'gemini-2.0-flash',
  'o1-preview': 'gemini-2.5-pro',
  'o1-mini': 'gemini-2.0-flash',
  'sonnet': 'gemini-2.5-pro',
  'claude': 'gemini-2.5-pro',
  'opus': 'gemini-2.5-pro',
  'haiku': 'gemini-2.0-flash',
  'gpt': 'gemini-2.5-pro',
  'text-davinci-003': 'gemini-2.0-flash',
  'text-davinci-002': 'gemini-2.0-flash',
  'text-curie-001': 'gemini-2.0-flash',
  'text-babbage-001': 'gemini-2.0-flash',
  'text-ada-001': 'gemini-2.0-flash'
};

function getGeminiModel(requested) {
  if (!requested) return 'gemini-2.5-pro';
  const key = requested.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-').replace(/[.:]/g, '-');
  if (GEMINI_MODEL_MAP[key]) return GEMINI_MODEL_MAP[key];
  for (const k in GEMINI_MODEL_MAP) {
    if (key.includes(k.replace(/[-:]/g, '')) || k.includes(key.replace(/[-:]/g, ''))) {
      return GEMINI_MODEL_MAP[k];
    }
  }
  return 'gemini-2.5-pro';
}

function sanitizeText(t) {
  if (!t) return '';
  return String(t).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\\u0000/g, '').slice(0, 120000);
}

const geminiAxios = axios.create({ timeout: 120000, headers: { 'User-Agent': 'RebootCord-AI-Proxy/1.0' } });

async function axiosWithRetry(makeCall, attempts) {
  if (!attempts) attempts = 5;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await makeCall(); } catch (e) { lastErr = e; if (i < attempts - 1) { await new Promise(function(r){ setTimeout(r, 300 * (i + 1)); }); } }
  }
  throw lastErr;
}

async function callGemini(model, messages, extra) {
  const geminiModel = getGeminiModel(model);
  let systemInstruction = null;
  const contents = [];
  const msgs = Array.isArray(messages) ? messages : (messages ? [{ role: 'user', content: messages }] : []);
  for (const m of msgs) {
    if (!m) continue;
    if (m.role === 'system' || m.role === 'developer') {
      const t = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(function(c){return c.text||c.type==='text'?c.text:'';}).filter(Boolean).join('\n') : JSON.stringify(m.content));
      if (t) systemInstruction = systemInstruction ? systemInstruction + '\n' + t : t;
      continue;
    }
    let role = m.role;
    if (role === 'assistant' || role === 'ai' || role === 'model') role = 'model';
    else if (!role || role === 'user') role = 'user';
    else role = 'user';
    let text = '';
    if (typeof m.content === 'string') text = m.content;
    else if (Array.isArray(m.content)) {
      const textParts = m.content.filter(function(c){ return c.type==='text' && c.text; }).map(function(c){ return c.text; });
      const imageParts = m.content.filter(function(c){ return c.type==='image_url'; });
      if (textParts.length > 0) text = textParts.join('\n');
      else if (imageParts.length > 0) text = '[Image content not supported]';
    }
    else text = JSON.stringify(m.content);
    if (text) contents.push({ role: role, parts: [{ text: sanitizeText(text) }] });
  }
  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: sanitizeText(systemInstruction) }] };
  }
  if (extra) {
    body.generationConfig = body.generationConfig || {};
    const gc = body.generationConfig;
    if (extra.temperature != null) gc.temperature = Math.max(0, Math.min(2, extra.temperature));
    if (extra.max_tokens != null) gc.maxOutputTokens = Math.max(1, Math.min(8192, extra.max_tokens));
    if (extra.top_p != null) gc.topP = Math.max(0, Math.min(1, extra.top_p));
    if (extra.topP != null) gc.topP = Math.max(0, Math.min(1, extra.topP));
    if (extra.top_k != null) gc.topK = Math.max(1, Math.min(40, extra.top_k));
    if (extra.stop || extra.stop_sequences) {
      const stops = [].concat(extra.stop || extra.stop_sequences || []).filter(Boolean).map(sanitizeText);
      if (stops.length) gc.stopSequences = stops.slice(0, 5);
    }
  }
  const resp = await axiosWithRetry(function(){ return geminiAxios.post(url, body, { headers: { 'Content-Type': 'application/json' } }); });
  const cand = resp.data.candidates && resp.data.candidates[0];
  let text = '';
  let blocked = false;
  if (!cand || cand.finishReason === 'SAFETY' || cand.finishReason === 'BLOCKED' || !cand.content || !cand.content.parts) {
    blocked = true;
    text = cand && cand.finishReason === 'SAFETY' ? '[Response blocked by Gemini safety filters]' : '[No response generated]';
  } else {
    text = cand.content.parts.map(function(p){ return p.text || ''; }).join('\n');
  }
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  if (resp.data.usageMetadata) {
    const um = resp.data.usageMetadata;
    usage = {
      prompt_tokens: um.promptTokenCount || 0,
      completion_tokens: um.candidatesTokenCount || 0,
      total_tokens: um.totalTokenCount || 0
    };
  }
  return { text: sanitizeText(text), model: geminiModel, usage: usage, blocked: blocked };
}

app.get('/v1/models', (req, res) => {
  res.json({ object: 'list', data: [
    { id: 'gemini-2.5-pro', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gemini-2.5-flash', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gemini-2.0-flash', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gemini-1.5-pro', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gpt-4o', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gpt-4o-mini', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gpt-4-turbo', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'gpt-4', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'claude-opus-4-5-20251101', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'claude-sonnet-4-5-20250929', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'claude-3-5-sonnet-20241022', object: 'model', created: 1710000000, owned_by: 'rebootcord' },
    { id: 'claude-3-5-haiku-20241022', object: 'model', created: 1710000000, owned_by: 'rebootcord' }
  ] });
});

app.post('/v1/chat/completions', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.json({
        id: 'chatcmpl-' + Date.now().toString(36),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gemini-2.5-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'The AI service is currently in demo mode. To enable full AI capabilities, the administrator needs to configure the GEMINI_API_KEY environment variable. In the meantime, I can help with basic questions about API setup, models, and platform features. Ask me about the Reboot Cord platform!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    }
    const ip = req.ip || req.headers['x-forwarded-for'] || '0';
    if (!checkRate('v1chat:' + ip, 20, 60000)) return res.status(429).json({ error: 'Rate limited (20 req/min)' });
    const body = req.body || {};
    const ps = JSON.stringify(body).length;
    if (ps > 30000) return res.status(413).json({ error: 'payload too large' });
    const requestedModel = body.model || body["AI model"];
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array required' });
    const result = await callGemini(requestedModel, messages, body);
    const response = {
      id: 'chatcmpl-' + Date.now().toString(36),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: requestedModel || result.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.text },
        finish_reason: result.blocked ? 'content_filter' : 'stop'
      }],
      usage: result.usage
    };
    res.json(response);
  } catch (err) {
    console.error('Chat completion error:', err);
    res.status(500).json({ error: (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message || 'proxy error' });
  }
});

app.post('/v1/messages', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini proxy not configured' });
    const ip = req.ip || req.headers['x-forwarded-for'] || '0';
    if (!checkRate('v1msg:' + ip, 20, 60000)) return res.status(429).json({ error: 'Rate limited (20 req/min)' });
    const body = req.body || {};
    const ps = JSON.stringify(body).length;
    if (ps > 30000) return res.status(413).json({ error: 'payload too large' });
    const requestedModel = body.model || body["AI model"];
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array required' });
    const result = await callGemini(requestedModel, messages, body);
    const response = {
      id: 'msg-' + Date.now().toString(36),
      role: 'assistant',
      model: requestedModel || result.model,
      content: [{ type: 'text', text: result.text }],
      stop_reason: result.blocked ? 'safety' : 'end_turn'
    };
    res.json(response);
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message || 'proxy error' });
  }
});

app.get('/api/v1/feedback-users', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, users: [] });
  const isAdmin = db.users.find(user => user.username === u) && db.users.find(user => user.username === u).isAdmin;
  if (!isAdmin) return res.json({ success: false, users: [] });
  const feedbackUsers = (db.feedbacks || []).reduce((acc, fb) => {
    if (!acc[fb.username]) {
      acc[fb.username] = {
        username: fb.username,
        messages: [],
        created: fb.created,
        email: fb.email || ''
      };
    }
    return acc;
  }, {});
  const usersList = Object.values(feedbackUsers);
  res.json({ success: true, users: usersList });
});

app.post('/api/v1/feedback-reply', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const isAdmin = db.users.find(user => user.username === u) && db.users.find(user => user.username === u).isAdmin;
  if (!isAdmin) return res.json({ success: false, message: 'Admin only' });
  const { username, message, adminName } = req.body || {};
  if (!username || !message) return res.json({ success: false, message: 'Missing required fields' });
  
  db.feedbacks = db.feedbacks || [];
  const userFeedbacks = db.feedbacks.filter(fb => fb.username === username);
  if (userFeedbacks.length > 0) {
    userFeedbacks.push({
      username: username,
      type: 'admin-reply',
      message: message,
      adminName: adminName || 'Admin',
      created: new Date().toISOString()
    });
    saveDB();
  }
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Reboot Cord running on port ' + PORT));
