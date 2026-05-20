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
  try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [], mcPorts: 25565 };
}

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch(e) {}
}

let db = loadDB();
const procs = {};
const wsClients = new Set();

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

function getUser(req) { return verifyToken(parseCookies(req)['rc_tok']); }

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
          if (p.lang === 'Python' && !fs.existsSync(path.join(pDir, 'requirements.txt'))) {
            fs.writeFileSync(path.join(pDir, 'requirements.txt'), '');
          } else if (p.lang !== 'Python' && !fs.existsSync(path.join(pDir, 'package.json'))) {
            fs.writeFileSync(path.join(pDir, 'package.json'), '{"name":"bot","dependencies":{}}');
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

app.get('/', (req, res) => {
  if (getUser(req)) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
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
  db.users.push({ username, password, invite: code, projects: [] });
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
  if (u) return res.json({ loggedIn: true, username: u });
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
      files = fs.readdirSync(pDir).map(f => {
        const stat = fs.statSync(path.join(pDir, f));
        return { name: f, size: stat.size, isDir: stat.isDirectory() };
      });
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
    const target = path.join(PROJECTS_DIR, String(p.id), req.body.name);
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
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
    const filePath = path.join(pDir, req.body.name);
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, '');
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
    const target = path.join(pDir, req.body.name);
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
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

    fs.writeFileSync(path.join(pDir, 'eula.txt'), 'eula=true\n');
    fs.writeFileSync(path.join(pDir, 'server.properties'), `server-port=${p.port}\nserver-ip=0.0.0.0\nonline-mode=false\n`);
    
    const jarPath = path.join(pDir, 'server.jar');
    if (!fs.existsSync(jarPath)) {
      broadcastLog(u, p.id, '[System] Downloading Minecraft server.jar...', 'sys');
      try {
        await execAsync(`curl -L -o server.jar https://piston-data.mojang.com/v1/objects/8dd1a28015f51b180288e994e101102e3dc23eea/server.jar`, { cwd: pDir, shell: true });
        broadcastLog(u, p.id, '[System] Download complete.', 'ok');
      } catch (e) {
        broadcastLog(u, p.id, '[System] Failed to download server.jar', 'err');
      }
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
        if (line.includes('Preparing level') || line.includes('Done')) {
          broadcastLog(u, p.id, '[System] Successfully generated the minecraft server world.', 'ok');
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

    const proc = cp.spawn(cmd, ['-u', mainFile], { cwd: pDir, env: envVars, shell: true });
    procs[p.id] = proc;

    let missingPkgs = new Set();

    proc.on('error', (err) => {
      broadcastLog(u, p.id, `[System] Bot failed to start: ${err.message}`, 'err');
    });

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
    
    proc.on('close', () => { 
      p.running = false; 
      saveDB(); 
      if (missingPkgs.size > 0) {
        broadcastLog(u, p.id, `[System] Missing packages detected! Type the following in the Packages box and click Install:`, 'sys');
        missingPkgs.forEach(pkg => broadcastLog(u, p.id, pkg, 'ok'));
      }
      broadcastLog(u, p.id, '[System] Process exited.', 'sys'); 
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
    try { procs[p.id].kill(); } catch(e) {}
    delete procs[p.id];
  }
  
  p.running = false;
  saveDB();
  broadcastLog(u, p.id, '[System] Process stopped manually.', 'warn');
  res.json({ success: true });
});

app.get('/api/admin/data', (req, res) => {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Reboot Cord running on port ' + PORT));
