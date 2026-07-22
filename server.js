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
const helmet = require('helmet');
const expressRateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');

const execAsync = util.promisify(cp.exec);

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.js', '.py', '.json', '.txt', '.md', '.jar', '.zip', '.tar', '.gz', '.html', '.css', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.env', '.sh', '.bat', '.ps1', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.php', '.rb', '.swift', '.kt', '.xml', '.sql', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || !ext) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});
app.use('/login', authLimiter);
app.use('/register', authLimiter);

const apiLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many API requests, please try again later.' }
});
app.use('/api/createcode', apiLimiter);

const DB_FILE = path.join(__dirname, 'db.json');
const PROJECTS_DIR = path.join(__dirname, 'projects_data');
const SECRET = process.env.SESSION_SECRET || 'rebootcord-secret-key';

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

function loadDB() {
  try { if (fs.existsSync(DB_FILE)) { const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); if(!d.changelogs) d.changelogs=[]; if(!d.apiKeys) d.apiKeys=[]; if(!d.feedbacks) d.feedbacks=[]; if(!d.feedbackChats) d.feedbackChats={}; if(!d.inboxMessages) d.inboxMessages=[]; return d; } } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [], mcPorts: 25565, changelogs: [], apiKeys: [], feedbacks: [], feedbackChats: {}, inboxMessages: [] };
}

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch(e) {}
}

let db = loadDB();
const procs = {};
const wsClients = new Set();
const rateLimit = {};
function checkRate(key, max, winMs) { const now = Date.now(); if (!rateLimit[key]) rateLimit[key] = []; rateLimit[key] = rateLimit[key].filter(t => now - t < winMs); if (rateLimit[key].length >= max) return false; rateLimit[key].push(now); return true; }

const PY_STDLIB = new Set(["os","sys","json","time","random","re","math","datetime","asyncio","pathlib","typing","io","collections","subprocess","threading","socket","abc","argparse","base64","binascii","bisect","builtins","bz2","calendar","cgi","cgitb","chunk","cmd","code","codecs","codeop","colorsys","compileall","concurrent","configparser","contextlib","contextvars","copy","copyreg","crypt","csv","ctypes","curses","dataclasses","dbm","decimal","difflib","dis","distutils","doctest","email","encodings","ensurepip","enum","errno","faulthandler","fcntl","filecmp","fileinput","fnmatch","formatter","fractions","ftplib","functools","gc","getopt","getpass","gettext","glob","graphlib","grp","gzip","hashlib","heapq","hmac","html","http","idlelib","imaplib","imghdr","imp","importlib","inspect","keyword","lib2to3","linecache","locale","logging","lzma","mailbox","mailcap","marshal","mimetypes","mmap","modulefinder","msilib","msvcrt","multiprocessing","netrc","nis","nntplib","ntpath","numbers","opcode","operator","optparse","ossaudiodev","parser","pdb","pickle","pickletools","pipes","pkgutil","platform","plistlib","poplib","posix","posixpath","pprint","profile","pstats","pty","pwd","py_compile","pyclbr","pydoc","queue","quopri","readline","reprlib","resource","rlcompleter","runpy","sched","secrets","select","selectors","shelve","shlex","shutil","signal","site","smtpd","smtplib","sndhdr","socketserver","spwd","sqlite3","sre","sre_compile","sre_constants","sre_parse","ssl","stat","statistics","statvfs","string","stringprep","struct","sunau","symbol","symtable","sysconfig","syslog","tabnanny","tarfile","telnetlib","tempfile","termios","test","textwrap","timeit","tkinter","token","tokenize","trace","traceback","tracemalloc","tty","turtle","turtledemo","types","unicodedata","unittest","urllib","uu","uuid","venv","warnings","wave","weakref","webbrowser","winreg","winsound","wsgiref","xdrlib","xml","xmlrpc","zipapp","zipfile","zipimport","zlib","zoneinfo"]);
const NODE_BUILTIN = new Set(["fs","path","http","https","crypto","os","util","child_process","events","stream","net","dgram","dns","url","zlib","querystring","assert","buffer","console","constants","domain","punycode","readline","repl","string_decoder","timers","tls","tty","vm","worker_threads","perf_hooks","async_hooks","trace_events","inspector","wasi","diagnostics_channel"]);

function detectPyDeps(code, set) {
  const re = /(?:^|[\n;])\s*(?:import\s+([a-zA-Z0-9_.]+)|from\s+([a-zA-Z0-9_.]+)\s+import)/gm;
  let m;
  while ((m = re.exec(code))) {
    let pkg = (m[1] || m[2] || '').split('.')[0].toLowerCase().trim();
    if (pkg && !PY_STDLIB.has(pkg)) {
      set.add(pkg === 'discord' ? 'discord.py' : pkg);
    }
  }
}

function detectJsDeps(code, set) {
  const re = /(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"])/g;
  let m;
  while ((m = re.exec(code))) {
    let pkg = (m[1] || m[2] || m[3] || '').split('/')[0].trim();
    if (pkg && !NODE_BUILTIN.has(pkg) && !pkg.startsWith('.') && !pkg.startsWith('@/')) {
      set.add(pkg === 'discord' ? 'discord.js' : pkg);
    }
  }
}

function scanProjectDeps(pDir, lang) {
  const set = new Set();
  const skipDirs = new Set(['modules', 'node_modules', '.git', '__pycache__', 'venv', '.venv']);
  const walk = (dir) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of ents) {
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        walk(path.join(dir, ent.name));
      } else {
        const ext = path.extname(ent.name).toLowerCase();
        if (lang === 'Python' && ext !== '.py') continue;
        if (lang !== 'Python' && !['.js', '.mjs', '.cjs', '.ts'].includes(ext)) continue;
        try {
          const content = fs.readFileSync(path.join(dir, ent.name), 'utf8');
          if (lang === 'Python') detectPyDeps(content, set);
          else detectJsDeps(content, set);
        } catch (e) {}
      }
    }
  };
  walk(pDir);

  if (lang === 'Python') {
    const reqPath = path.join(pDir, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try {
        fs.readFileSync(reqPath, 'utf8').split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) return;
          const name = trimmed.split(/[=<>!~\[; ]/)[0].trim();
          if (name) set.add(name.toLowerCase() === 'discord' ? 'discord.py' : name);
        });
      } catch (e) {}
    }
  } else {
    const pkgPath = path.join(pDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const obj = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        Object.keys(obj.dependencies || {}).forEach((k) => set.add(k));
      } catch (e) {}
    }
  }

  return Array.from(set);
}

function parseEnvFile(content) {
  const out = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    let key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  });
  return out;
}

function depsHash(pkgs) {
  const sorted = Array.from(new Set(pkgs)).map(p => String(p).toLowerCase()).sort();
  return crypto.createHash('sha256').update(sorted.join(',')).digest('hex');
}

function sanitizePkgName(name) {
  const v = String(name || '').trim();
  if (!/^[a-zA-Z0-9_.\-\[\]@/]+$/.test(v)) return null;
  if (v.length > 100) return null;
  return v;
}

const HIDDEN_TREE_DIRS = new Set(['modules', 'node_modules', '__pycache__', '.git']);
const HIDDEN_TREE_EXTS = new Set(['.pyc', '.pyo', '.so', '.dist-info', '.egg-info']);

function getDirTree(dir, base) {
  const res = [];
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return res; }
  for (const ent of ents) {
    if (!base && HIDDEN_TREE_DIRS.has(ent.name)) continue;
    if (ent.name.endsWith('.dist-info') || ent.name.endsWith('.egg-info')) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!ent.isDirectory() && HIDDEN_TREE_EXTS.has(ext)) continue;
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

function isValidUsername(username) {
  return typeof username === 'string' && username.length >= 2 && username.length <= 32 && /^[a-zA-Z0-9_]+$/.test(username);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>\"'&]/g, '');
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
  const isSecure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', 'rc_tok=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800' + (isSecure ? '; Secure' : ''));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'rc_tok=; HttpOnly; Path=/; Max-Age=0');
}

const unlockedAccess = {};

function findOwnerAndProject(id) {
  for (const owner of db.users) {
    const p = (owner.projects || []).find(x => String(x.id) === String(id));
    if (p) return { owner, p };
  }
  return { owner: null, p: null };
}

function getAccess(u, id) {
  const { owner, p } = findOwnerAndProject(id);
  if (!p) return { p: null };
  const isOwner = !!owner && owner.username === u;
  const share = (p.shared || []).find(x => x.username === u);
  const perms = share ? share.perms : { editFiles: false, changeName: false, fullAccess: false };
  const isShared = !!share;
  const locked = !!p.password && !isOwner && !unlockedAccess[u + '::' + id];
  return { owner, p, isOwner, isShared, perms, locked, hasAccess: isOwner || isShared };
}

function canControl(access) {
  return access.isOwner || (access.hasAccess && access.perms.fullAccess);
}

function canEditFiles(access) {
  return access.isOwner || (access.hasAccess && (access.perms.editFiles || access.perms.fullAccess));
}

function broadcastLog(username, projectId, msg, type) {
  const payload = JSON.stringify({ event: 'log', projectId, msg, type: type || 'info' });
  for (const client of wsClients) {
    if (client.username === username && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastEvent(username, payload) {
  const data = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.username === username && client.readyState === WebSocket.OPEN) {
      client.send(data);
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
          const pkg = sanitizePkgName(data.pkg);
          if (!pkg) {
            broadcastLog(user, p.id, `[PKG] Invalid package name`, 'err');
            return;
          }
          const pDir = path.join(PROJECTS_DIR, String(p.id));
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          if (p.lang === 'Python') {
            const modulesDir = path.join(pDir, 'modules');
            if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });
          }
          const cmd = p.lang === 'Python' ? `pip install --disable-pip-version-check --no-input --no-cache-dir --prefer-binary --upgrade "${pkg}" --target ./modules` : `npm install --no-audit --no-fund --prefer-offline "${pkg}"`;
          broadcastLog(user, p.id, `[PKG] Running ${cmd}...`, 'info');
          cp.exec(cmd, { cwd: pDir, shell: true, timeout: 8 * 60 * 1000, maxBuffer: 1024 * 1024 * 30 }, (err, stdout, stderr) => {
            if (stdout) broadcastLog(user, p.id, stdout, 'info');
            if (stderr) broadcastLog(user, p.id, stderr, 'warn');
            if (err) broadcastLog(user, p.id, `[PKG] Failed: ${err.message}`, 'err');
            else { broadcastLog(user, p.id, `[PKG] Installed ${pkg}`, 'ok'); p.depsInstalled = false; saveDB(); }
            broadcastEvent(user, { event: 'installDone', projectId: p.id, pkg, success: !err });
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
          let pkgs = Array.isArray(data.pkgs) ? data.pkgs : [];
          let scanned = [];
          try { scanned = scanProjectDeps(pDir, p.lang || 'Python'); } catch (e) {}
          const merged = new Set();
          pkgs.concat(scanned).forEach((pk) => {
            const safe = sanitizePkgName(pk);
            if (safe) merged.add(safe);
          });
          pkgs = Array.from(merged);
          if (!pkgs.length) {
            broadcastLog(user, p.id, `[PKG] No dependencies found to install`, 'warn');
            broadcastEvent(user, { event: 'installAllDone', projectId: p.id, success: true, count: 0 });
            return;
          }
          const modulesDir = path.join(pDir, p.lang === 'Python' ? 'modules' : 'node_modules');
          const newHash = depsHash(pkgs);
          if (!data.force && p.depsInstalled && p.depsHash === newHash && fs.existsSync(modulesDir)) {
            broadcastLog(user, p.id, `[PKG] Dependencies already up to date (${pkgs.length} package${pkgs.length === 1 ? '' : 's'})`, 'ok');
            broadcastEvent(user, { event: 'installAllDone', projectId: p.id, success: true, count: pkgs.length, skipped: true });
            return;
          }
          broadcastLog(user, p.id, `[PKG] Detected ${pkgs.length} dependenc${pkgs.length === 1 ? 'y' : 'ies'}${pkgs.length ? ': ' + pkgs.join(', ') : ''}`, 'info');
          if (p.lang === 'Python') {
            if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });
            const req = path.join(pDir, 'requirements.txt');
            let cur = fs.existsSync(req) ? fs.readFileSync(req, 'utf8') : '';
            const set = new Set(cur.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
            pkgs.forEach(pk => set.add(pk));
            fs.writeFileSync(req, Array.from(set).join('\n') + (set.size ? '\n' : ''));
          } else {
            const pj = path.join(pDir, 'package.json');
            let obj = { name: 'bot', version: '1.0.0', dependencies: {} };
            if (fs.existsSync(pj)) { try { obj = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch (e) {} }
            obj.dependencies = obj.dependencies || {};
            pkgs.forEach(pk => { if (!obj.dependencies[pk]) obj.dependencies[pk] = '*'; });
            fs.writeFileSync(pj, JSON.stringify(obj, null, 2));
          }
          const cmd = p.lang === 'Python' ? `pip install --disable-pip-version-check --no-input --no-cache-dir --prefer-binary --upgrade -r requirements.txt --target ./modules` : `npm install --no-audit --no-fund --prefer-offline --no-package-lock`;
          broadcastLog(user, p.id, `[PKG] Running ${cmd}...`, 'info');
          cp.exec(cmd, { cwd: pDir, shell: true, timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
            if (stdout) broadcastLog(user, p.id, stdout, 'info');
            if (stderr) broadcastLog(user, p.id, stderr, 'warn');
            if (err) {
              broadcastLog(user, p.id, `[PKG] Failed: ${err.message}`, 'err');
              p.depsInstalled = false;
            } else {
              broadcastLog(user, p.id, `[PKG] Installed all ${pkgs.length} package${pkgs.length === 1 ? '' : 's'} successfully`, 'ok');
              p.depsInstalled = true;
              p.depsHash = newHash;
              saveDB();
            }
            broadcastEvent(user, { event: 'installAllDone', projectId: p.id, success: !err, count: pkgs.length });
          });
        }
      }
    } catch (e) {}
  });
  ws.on('close', () => wsClients.delete(ws));
});

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

app.post('/register', async (req, res) => {
  const { username, password, invite, discordUsername } = req.body;
  if (!username || !password || !invite) return res.json({ success: false, message: 'All fields required' });
  if (!isValidUsername(username)) return res.json({ success: false, message: 'Discord username must be 2-32 characters' });
  if (password.length < 8) return res.json({ success: false, message: 'Password must be at least 8 characters' });
  const code = invite.startsWith('rebootcord-') ? invite : 'rebootcord-' + invite;
  if (db.blacklisted.includes(code) || db.blacklisted.includes(username)) return res.json({ success: false, message: 'Blacklisted' });
  if (!db.inviteCodes[code]) return res.json({ success: false, message: 'Invalid invite code' });
  if (db.inviteCodes[code] !== true && db.inviteCodes[code] !== username) return res.json({ success: false, message: 'Invite code is bound to a different Discord username' });
  if (db.users.find(u => u.username === username)) return res.json({ success: false, message: 'Discord username already registered' });
  const hashedPassword = await bcrypt.hash(password, 10);
  db.users.push({ username, password: hashedPassword, invite: code, discordUsername: username, projects: [], admin: false });
  delete db.inviteCodes[code];
  saveDB();
  setCookie(res, signToken(username));
  res.json({ success: true, username });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'All fields required' });
  const user = db.users.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: 'Invalid Discord username or password' });
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.json({ success: false, message: 'Invalid Discord username or password' });
  if (db.blacklisted.includes(username)) return res.json({ success: false, message: 'Account blacklisted' });
  setCookie(res, signToken(username));
  res.json({ success: true, username });
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

app.get('/api/projects/:id/access', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  if (!access.p) return res.json({ success: false });
  res.json({
    success: true,
    isOwner: access.isOwner,
    isShared: access.isShared,
    perms: access.perms,
    locked: access.locked,
    hasPassword: !!access.p.password,
    private: !!access.p.private,
    name: access.p.name,
    shared: access.isOwner ? (access.p.shared || []).map(s => ({ username: s.username, perms: s.perms })) : []
  });
});

app.post('/api/projects/:id/unlock', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  if (!access.p) return res.json({ success: false });
  if (!access.hasAccess) return res.json({ success: false, message: 'You do not have access to this project.' });
  if (access.p.password && access.p.password === req.body.password) {
    unlockedAccess[u + '::' + req.params.id] = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Incorrect password.' });
});

app.post('/api/projects/:id/share', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  const p = (user.projects || []).find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false, message: 'Project not found.' });
  const target = (req.body.username || '').trim();
  if (!target) return res.json({ success: false, message: 'Enter a username.' });
  if (target === u) return res.json({ success: false, message: 'You cannot share with yourself.' });
  const targetUser = db.users.find(x => x.username.toLowerCase() === target.toLowerCase());
  if (!targetUser) return res.json({ success: false, message: 'That user does not exist.' });
  p.shared = p.shared || [];
  if (p.shared.find(x => x.username === targetUser.username)) return res.json({ success: false, message: 'Already shared with that user.' });
  p.shared.push({ username: targetUser.username, perms: { editFiles: false, changeName: false, fullAccess: false } });
  saveDB();
  res.json({ success: true, shared: p.shared });
});

app.post('/api/projects/:id/unshare', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  const p = (user.projects || []).find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  const removedUser = req.body.username;
  const wasShared = (p.shared || []).some(x => x.username === removedUser);
  p.shared = (p.shared || []).filter(x => x.username !== removedUser);
  delete unlockedAccess[removedUser + '::' + req.params.id];
  if (wasShared) {
    db.inboxMessages = db.inboxMessages || [];
    db.inboxMessages.unshift({
      id: Date.now(),
      title: `Removed from "${p.name}"`,
      body: `${user.username} removed you from the project "${p.name}". You no longer have access to its files or console.`,
      ts: Date.now(),
      readBy: [],
      sender: user.username,
      rank: 'notice',
      recipient: removedUser
    });
  }
  saveDB();
  res.json({ success: true, shared: p.shared });
});

app.post('/api/projects/:id/share-perms', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  const p = (user.projects || []).find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  const entry = (p.shared || []).find(x => x.username === req.body.username);
  if (!entry) return res.json({ success: false });
  entry.perms = {
    editFiles: !!req.body.editFiles,
    changeName: !!req.body.changeName,
    fullAccess: !!req.body.fullAccess
  };
  saveDB();
  res.json({ success: true, shared: p.shared });
});

app.post('/api/projects/:id/settings', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  const p = (user.projects || []).find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  if (typeof req.body.password === 'string') p.password = req.body.password.trim();
  if (typeof req.body.private === 'boolean') p.private = req.body.private;
  if (typeof req.body.name === 'string' && req.body.name.trim()) p.name = req.body.name.trim();
  saveDB();
  res.json({ success: true, name: p.name, private: !!p.private, hasPassword: !!p.password });
});

app.post('/api/projects/:id/rename-shared', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  if (!access.p || access.isOwner) return res.json({ success: false });
  if (access.locked) return res.json({ success: false, needsPassword: true });
  if (!access.perms.changeName && !access.perms.fullAccess) return res.json({ success: false, message: 'No permission to rename.' });
  const name = (req.body.name || '').trim();
  if (!name) return res.json({ success: false });
  access.p.name = name;
  saveDB();
  res.json({ success: true, name });
});

app.get('/api/shared-projects', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, projects: [] });
  const out = [];
  for (const owner of db.users) {
    for (const p of (owner.projects || [])) {
      const share = (p.shared || []).find(x => x.username === u);
      if (share) {
        out.push({
          id: p.id, name: p.name, type: p.type, lang: p.lang, running: p.running,
          owner: owner.username, perms: share.perms,
          locked: !!p.password && !unlockedAccess[u + '::' + p.id]
        });
      }
    }
  }
  res.json({ success: true, projects: out });
});

app.get('/api/inbox', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, messages: [] });
  const msgs = (db.inboxMessages || [])
    .filter(m => !m.recipient || m.recipient === u)
    .map(m => ({
      id: m.id, title: m.title, body: m.body, ts: m.ts,
      read: (m.readBy || []).includes(u),
      sender: m.sender,
      rank: m.rank
    }));
  res.json({ success: true, messages: msgs });
});

app.post('/api/inbox/delete', (req, res) => {
  const user = requireAdmin(req, res);
  if (!user) return res.json({ success: false });
  db.inboxMessages = (db.inboxMessages || []).filter(x => String(x.id) !== String(req.body.id));
  saveDB();
  res.json({ success: true });
});

app.post('/api/inbox/read', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const m = (db.inboxMessages || []).find(x => String(x.id) === String(req.body.id));
  if (m) {
    m.readBy = m.readBy || [];
    if (!m.readBy.includes(u)) m.readBy.push(u);
    saveDB();
  }
  res.json({ success: true });
});

app.post('/api/inbox/send', (req, res) => {
  const u = getUser(req);
  const user = db.users.find(x => x.username === u);
  if (!user || !user.admin) return res.json({ success: false, message: 'Admin only.' });
  const title = (req.body.title || '').trim();
  const body = (req.body.body || '').trim();
  if (!title || !body) return res.json({ success: false });
  db.inboxMessages = db.inboxMessages || [];
  db.inboxMessages.unshift({ id: Date.now(), title, body, ts: Date.now(), readBy: [] });
  saveDB();
  res.json({ success: true });
});

app.post('/api/inbox/discord', (req, res) => {
  const message = (req.body.message || '').trim();
  const sender = (req.body.sender || 'Staff').trim();
  if (!message) return res.json({ success: false });
  db.inboxMessages = db.inboxMessages || [];
  db.inboxMessages.unshift({ id: Date.now(), title: `Message from ${sender}`, body: message, ts: Date.now(), readBy: [], sender, rank: 'staff' });
  saveDB();
  res.json({ success: true });
});

app.get('/inbox', (req, res) => {
  res.sendFile(path.join(__dirname, 'inbox-system', 'inbox.html'));
});

app.post('/api/createcode', (req, res) => {
  const { code, user } = req.body;
  if (!code || !code.startsWith('rebootcord-')) return res.json({ success: false, message: 'Invalid code format' });
  const parts = code.split('-');
  if (parts.length !== 3 || parts[1].length !== 5 || parts[2].length !== 7) return res.json({ success: false, message: 'Invalid code structure' });
  if (user && (typeof user !== 'string' || user.length < 2 || user.length > 32)) return res.json({ success: false, message: 'Invalid username' });
  db.inviteCodes[code] = user || true;
  saveDB();
  res.json({ success: true });
});

app.post('/api/bot/validate', (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ valid: false, reason: 'No code provided' });
  if (!code.startsWith('rebootcord-')) return res.json({ valid: false, reason: 'Invalid code format' });
  const parts = code.split('-');
  if (parts.length !== 3 || parts[1].length !== 5 || parts[2].length !== 7) return res.json({ valid: false, reason: 'Invalid code structure' });
  if (db.inviteCodes[code] === undefined) return res.json({ valid: false, reason: 'Code not found in database' });
  res.json({ valid: true, boundTo: db.inviteCodes[code] });
});

app.get('/api/stats', (req, res) => {
  res.json({ activeUsers: db.users.length, totalInvites: Object.keys(db.inviteCodes).length });
});

app.post('/api/blacklist', (req, res) => {
  const { key } = req.body;
  if (key && !db.blacklisted.includes(key)) { db.blacklisted.push(key); saveDB(); }
  res.json({ success: true });
});

app.get('/api/projects/:id/detect-deps', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, packages: [] });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false, packages: [] });
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  let packages = [];
  try {
    packages = scanProjectDeps(pDir, p.lang || 'Python');
  } catch (e) {}
  res.json({ success: true, packages });
});

app.get('/api/projects/:id/deps-status', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user && user.projects.find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  let packages = [];
  try { packages = scanProjectDeps(pDir, p.lang || 'Python'); } catch (e) {}
  const modulesDir = path.join(pDir, p.lang === 'Python' ? 'modules' : 'node_modules');
  const upToDate = !!p.depsInstalled && p.depsHash === depsHash(packages) && fs.existsSync(modulesDir);
  res.json({ success: true, upToDate, packages });
});

app.get('/api/projects/:id/dir', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, files: [] });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !access.hasAccess) return res.json({ success: false, files: [] });
  if (access.locked) return res.json({ success: false, files: [], needsPassword: true });
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !access.hasAccess) return res.json({ success: false });
  if (access.locked) return res.json({ success: false, needsPassword: true });
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

app.post('/api/projects/:id/savefile', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canEditFiles(access)) return res.json({ success: false });
  if (access.locked) return res.json({ success: false, needsPassword: true });
  const fname = req.body.name;
  const content = req.body.content || '';
  if (!fname) return res.json({ success: false });
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  const target = path.join(pDir, fname);
  try {
    if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    p.files = p.files || {};
    p.files[fname] = content;
    saveDB();
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
  }
});

app.post('/api/projects/:id/upload', upload.single('file'), (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  const p = user.projects.find(x => String(x.id) === req.params.id);
  if (p && req.file) {
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
    const relPath = (req.body && req.body.relPath) ? String(req.body.relPath).replace(/\\/g, '/') : req.file.originalname;
    const target = safeJoin(pDir, relPath);
    if (!target) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false }); }
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.renameSync(req.file.path, target);
    broadcastLog(u, p.id, '[System] Uploaded ' + relPath, 'info');
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
      killProcessTree(procs[p.id], 'SIGKILL');
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });
  if (access.locked) return res.json({ success: false, needsPassword: true });

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  if (procs[p.id]) {
    killProcessTree(procs[p.id], 'SIGKILL');
    delete procs[p.id];
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
    const proc = cp.spawn(javaCmd, ['-Xmx1024M', '-jar', 'server.jar', 'nogui'], { cwd: pDir, shell: true, detached: true });
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
    const mainFile = Object.keys(p.files || {})[0] || (p.lang === 'Python' ? 'main.py' : 'index.js');

    const envVars = { ...process.env, BOT_TOKEN: p.botToken || '', TOKEN: p.botToken || '' };
    const modulesDir = path.join(pDir, 'modules');
    if (p.lang === 'Python') envVars.PYTHONPATH = modulesDir;

    try {
      const envP = path.join(pDir, '.env');
      let ec = fs.existsSync(envP) ? fs.readFileSync(envP, 'utf8') : '';
      if (p.botToken && !ec.match(/^BOT_TOKEN=/m)) {
        ec = ec.trim() + `\nBOT_TOKEN=${p.botToken}\n`;
        fs.writeFileSync(envP, ec.trim() + '\n');
      }
      const parsedEnv = parseEnvFile(ec);
      Object.assign(envVars, parsedEnv);
      if (parsedEnv.DISCORD_TOKEN && !parsedEnv.BOT_TOKEN) envVars.BOT_TOKEN = parsedEnv.DISCORD_TOKEN;
      if (parsedEnv.TOKEN && !parsedEnv.BOT_TOKEN) envVars.BOT_TOKEN = parsedEnv.TOKEN;
    } catch(e) {}

    let cmd, args;
    if (p.lang === 'Python') {
      cmd = 'python3';
      args = ['-u', '-c', 'import sys, runpy; modules_dir, main_file = sys.argv[1], sys.argv[2]; sys.path.insert(0, modules_dir); sys.argv = [main_file]; runpy.run_path(main_file, run_name="__main__")', modulesDir, mainFile];
    } else {
      cmd = 'node';
      args = [mainFile];
    }

    const proc = cp.spawn(cmd, args, { cwd: pDir, env: envVars, shell: p.lang === 'Python' ? false : true, detached: true });
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

function killProcessTree(proc, signal) {
  try {
    process.kill(-proc.pid, signal);
  } catch(e) {
    try { proc.kill(signal); } catch(e2) {}
  }
}

app.post('/api/projects/:id/stop', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });

  if (procs[p.id]) {
    const proc = procs[p.id];
    killProcessTree(proc, 'SIGTERM');
    setTimeout(() => {
      if (procs[p.id] === proc) {
        killProcessTree(proc, 'SIGKILL');
        delete procs[p.id];
      }
    }, 2000);
  }
  p.running = false;
  saveDB();
  broadcastLog(u, p.id, '[System] Process stopped.', 'warn');
  res.json({ success: true });
});

app.post('/api/projects/:id/kill', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });

  if (procs[p.id]) {
    const proc = procs[p.id];
    killProcessTree(proc, 'SIGKILL');
    delete procs[p.id];
  }

  p.running = false;
  saveDB();
  broadcastLog(u, p.id, '[System] Process forcefully killed.', 'warn');
  res.json({ success: true });
});

app.post('/api/projects/:id/upload', upload.single('file'), (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  const p = (user.projects || []).find(x => String(x.id) === req.params.id);
  if (!p) return res.json({ success: false });
  if (!req.file) return res.json({ success: false });

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  const relPath = req.body.relPath || req.file.originalname;
  const targetPath = path.join(pDir, relPath);
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(req.file.path, targetPath);
    res.json({ success: true });
  } catch (e) {
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {}
    res.json({ success: false });
  }
});

function requireAdmin(req, res) {
  const u = getUser(req);
  if (!u) return null;
  const user = db.users.find(x => x.username === u);
  if (!user) return null;
  const noAdminsYet = !db.users.some(x => x.admin);
  if (noAdminsYet || user.admin) return user;
  return null;
}

app.get('/api/admin/data', (req, res) => {
  if (!requireAdmin(req, res)) return res.json({ users: [], inviteCodes: {}, adminApiKeys: [] });
  const users = db.users.map(u => ({ username: u.username, admin: !!u.admin, premium: !!u.premium }));
  res.json({ users, inviteCodes: db.inviteCodes, adminApiKeys: db.adminApiKeys || [] });
});

app.post('/api/admin/revoke', (req, res) => {
  if (!requireAdmin(req, res)) return res.json({ success: false });
  const { code } = req.body;
  if (db.inviteCodes[code] !== undefined) {
    delete db.inviteCodes[code];
    saveDB();
  }
  res.json({ success: true });
});

app.post('/api/admin/set-admin', (req, res) => {
  if (!requireAdmin(req, res)) return res.json({ success: false });
  const { username, isAdmin } = req.body;
  const target = db.users.find(x => x.username === username);
  if (target) {
    target.admin = !!isAdmin;
    saveDB();
  }
  res.json({ success: true });
});

app.post('/api/admin/create-admin-key', (req, res) => {
  if (!requireAdmin(req, res)) return res.json({ success: false });
  const { apiKey } = req.body;
  db.adminApiKeys = db.adminApiKeys || [];
  db.adminApiKeys.push({ key: apiKey, assignedUser: null, createdAt: Date.now() });
  saveDB();
  res.json({ success: true });
});

app.post('/api/admin/assign-admin-key', (req, res) => {
  if (!requireAdmin(req, res)) return res.json({ success: false });
  const { apiKey, username } = req.body;
  const keyObj = (db.adminApiKeys || []).find(k => k.key === apiKey);
  if (!keyObj) return res.json({ success: false });
  const userObj = db.users.find(x => x.username === username);
  if (!userObj) return res.json({ success: false });
  keyObj.assignedUser = username;
  userObj.admin = true;
  userObj.premium = true;
  saveDB();
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
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'prysmis-ai';
const AI_PROVIDER = (process.env.AI_PROVIDER || 'auto').toLowerCase();

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

async function callOllama(model, messages, extra) {
  const ollamaModel = (model && !model.toLowerCase().startsWith('gemini')) ? model : OLLAMA_VISION_MODEL;
  const ollamaMessages = [];
  const msgs = Array.isArray(messages) ? messages : (messages ? [{ role: 'user', content: messages }] : []);

  for (const m of msgs) {
    if (!m) continue;
    let role = 'user';
    if (m.role === 'assistant' || m.role === 'ai' || m.role === 'model') role = 'assistant';
    else if (m.role === 'system' || m.role === 'developer') role = 'system';
    else role = 'user';

    let content = '';
    const images = [];

    if (typeof m.content === 'string') {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      const textParts = m.content
        .filter(c => c && c.type === 'text' && c.text)
        .map(c => c.text);
      content = textParts.join('\n');

      for (const part of m.content) {
        if (!part || part.type !== 'image_url' || !part.image_url || !part.image_url.url) continue;
        const u = part.image_url.url;
        if (u.startsWith('data:')) {
          const comma = u.indexOf(',');
          if (comma > -1) {
            const b64 = u.slice(comma + 1);
            if (b64) images.push(b64);
          }
        } else if (u.startsWith('http://') || u.startsWith('https://')) {
          try {
            const r = await axios.get(u, { responseType: 'arraybuffer', timeout: 20000, maxContentLength: 8 * 1024 * 1024 });
            const b64 = Buffer.from(r.data).toString('base64');
            images.push(b64);
          } catch (e) {
            content += `\n[Image from URL could not be loaded: ${u}]`;
          }
        }
      }
    } else if (m.content) {
      content = JSON.stringify(m.content);
    }

    const om = { role, content: content || (images.length ? ' ' : 'Hello') };
    if (images.length > 0) om.images = images;
    ollamaMessages.push(om);
  }

  if (ollamaMessages.length === 0) {
    ollamaMessages.push({ role: 'user', content: 'Hello' });
  }

  const body = {
    model: ollamaModel,
    messages: ollamaMessages,
    stream: false,
    options: {}
  };

  if (extra) {
    if (extra.temperature != null) body.options.temperature = Math.max(0, Math.min(2, extra.temperature));
    if (extra.max_tokens != null) body.options.num_predict = Math.max(1, Math.min(8192, extra.max_tokens));
    if (extra.top_p != null) body.options.top_p = Math.max(0, Math.min(1, extra.top_p));
  }

  const base = OLLAMA_BASE.replace(/\/$/, '');
  const resp = await axios.post(`${base}/api/chat`, body, { timeout: 180000 });

  const msg = resp.data && resp.data.message;
  const text = (msg && typeof msg.content === 'string') ? msg.content : 'No response from local Ollama vision model.';

  const usage = {
    prompt_tokens: resp.data.prompt_eval_count || 0,
    completion_tokens: resp.data.eval_count || 0,
    total_tokens: (resp.data.prompt_eval_count || 0) + (resp.data.eval_count || 0)
  };

  return { text: sanitizeText(text), model: ollamaModel, usage, blocked: false };
}

app.get('/v1/models', (req, res) => {
  const models = [
    { id: OLLAMA_VISION_MODEL, object: 'model', created: 1710000000, owned_by: 'rebootcord', vision: true },
    { id: 'prysmis-ai', object: 'model', created: 1710000000, owned_by: 'rebootcord', vision: true },
    { id: 'rebootcord-vision', object: 'model', created: 1710000000, owned_by: 'rebootcord', vision: true },
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
  ];
  res.json({ object: 'list', data: models });
});

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '0';
    if (!checkRate('v1chat:' + ip, 20, 60000)) return res.status(429).json({ error: 'Rate limited (20 req/min)' });
    const body = req.body || {};
    const ps = JSON.stringify(body).length;
    if (ps > 30000) return res.status(413).json({ error: 'payload too large' });
    const requestedModel = body.model || body["AI model"];
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array required' });

    const hasImages = Array.isArray(messages) && messages.some(m => Array.isArray(m.content) && m.content.some(p => p && p.type === 'image_url'));
    const modelLower = (requestedModel || '').toLowerCase();
    // Prefer Gemini (cloud AI) on Render/production if GEMINI_API_KEY present. Only force local Ollama/PrysmisAI for explicit provider or no key.
    const forceOllama = AI_PROVIDER === 'ollama' || (!GEMINI_API_KEY && (modelLower.includes('llava') || modelLower.includes('vision') || modelLower.includes('ollama') || modelLower === 'rebootcord-vision' || modelLower === 'prysmis-ai'));
    const useOllama = forceOllama || AI_PROVIDER === 'ollama' || (!GEMINI_API_KEY && AI_PROVIDER !== 'gemini') || (hasImages && !GEMINI_API_KEY);

    let result;
    if (useOllama) {
      try {
        result = await callOllama(requestedModel, messages, body);
      } catch (ollamaErr) {
        const msg = 'PrysmisAI is thinking.. Set GEMINI_API_KEY for cloud AI, or ensure Ollama is reachable via OLLAMA_BASE_URL (local model requires self-hosting with sufficient resources).';
        return res.json({ id: 'chatcmpl-' + Date.now().toString(36), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: OLLAMA_VISION_MODEL, choices: [{ index: 0, message: { role: 'assistant', content: msg }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
      }
    } else if (!GEMINI_API_KEY) {
      return res.json({
        id: 'chatcmpl-' + Date.now().toString(36),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestedModel || OLLAMA_VISION_MODEL,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'PrysmisAI ready. For full AI on Render/cloud, set GEMINI_API_KEY env var. Local model requires running Ollama with prysmis-ai tag.' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
    } else {
      result = await callGemini(requestedModel, messages, body);
    }

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
    const ip = req.ip || req.headers['x-forwarded-for'] || '0';
    if (!checkRate('v1msg:' + ip, 20, 60000)) return res.status(429).json({ error: 'Rate limited (20 req/min)' });
    const body = req.body || {};
    const ps = JSON.stringify(body).length;
    if (ps > 30000) return res.status(413).json({ error: 'payload too large' });
    const requestedModel = body.model || body["AI model"];
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array required' });

    const hasImages = Array.isArray(messages) && messages.some(m => Array.isArray(m.content) && m.content.some(p => p && p.type === 'image_url'));
    const modelLower = (requestedModel || '').toLowerCase();
    // Prefer Gemini (cloud AI) on Render/production if GEMINI_API_KEY present. Only force local Ollama/PrysmisAI for explicit provider or no key.
    const forceOllama = AI_PROVIDER === 'ollama' || (!GEMINI_API_KEY && (modelLower.includes('llava') || modelLower.includes('vision') || modelLower.includes('ollama') || modelLower === 'rebootcord-vision' || modelLower === 'prysmis-ai'));
    const useOllama = forceOllama || AI_PROVIDER === 'ollama' || (!GEMINI_API_KEY && AI_PROVIDER !== 'gemini') || (hasImages && !GEMINI_API_KEY);

    let result;
    if (useOllama) {
      try {
        result = await callOllama(requestedModel, messages, body);
      } catch (ollamaErr) {
        const msg = 'PrysmisAI is thinking.. Set GEMINI_API_KEY for cloud AI, or ensure Ollama is reachable via OLLAMA_BASE_URL (local model requires self-hosting with sufficient resources).';
        return res.json({ id: 'msg-' + Date.now().toString(36), role: 'assistant', model: OLLAMA_VISION_MODEL, content: [{ type: 'text', text: msg }], stop_reason: 'end_turn' });
      }
    } else if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'PrysmisAI active. For cloud/Render, set GEMINI_API_KEY. Local requires Ollama + prysmis-ai model.' });
    } else {
      result = await callGemini(requestedModel, messages, body);
    }

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

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

const PORT = process.env.PORT || 1000;
server.listen(PORT, () => {
  console.log('Reboot Cord running on port ' + PORT);
  const isRender = !!process.env.RENDER;
  console.log('PrysmisAI model: ' + OLLAMA_VISION_MODEL + (isRender ? ' (Render deployment - set GEMINI_API_KEY for cloud AI or OLLAMA_BASE_URL for remote Ollama)' : ' (local default port 1000)'));
});
