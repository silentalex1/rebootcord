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
const { sendWelcomeEmail, sendPasswordResetConfirmation, isValidEmail, sendMail, renderTemplate, deriveFirstNameFromEmail, isSmtpConfigured } = require('./email');

const execAsync = util.promisify(cp.exec);
const SITE_ORIGIN = (process.env.SITE_URL || 'https://rebootcord.world').replace(/\/$/, '');




process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
server.headersTimeout = 20000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 15000;
server.maxHeadersCount = 100;
server.maxConnections = 2000;
const wss = new WebSocket.Server({ server, maxPayload: 64 * 1024 });

const SDK_MIME = { '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json; charset=utf-8' };
function safeJoinSdk(base, name) {
  const resolved = path.resolve(base, name);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) return null;
  return resolved;
}
app.use('/sdk', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (SDK_MIME[ext]) res.type(SDK_MIME[ext]);
  res.setHeader('Cache-Control', 'no-cache');
  next();
}, express.static(path.join(__dirname, 'sdk'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (SDK_MIME[ext]) res.setHeader('Content-Type', SDK_MIME[ext]);
    res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.get('/sdk/:file', (req, res, next) => {
  const target = safeJoinSdk(path.join(__dirname, 'sdk'), req.params.file);
  if (!target || !fs.existsSync(target)) return next();
  const ext = path.extname(target).toLowerCase();
  if (SDK_MIME[ext]) res.type(SDK_MIME[ext]);
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(target).pipe(res);
});
const DATA_DIR = process.env.RC_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const TMP_UPLOAD_DIR = path.join(DATA_DIR, 'tmp-uploads');
if (!fs.existsSync(TMP_UPLOAD_DIR)) fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });

const upload = multer({ 
  dest: TMP_UPLOAD_DIR,
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

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'blob:'],
  connectSrc: ["'self'"],
  frameAncestors: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
};
if (process.env.NODE_ENV === 'production') cspDirectives.upgradeInsecureRequests = [];

app.use(helmet({
  contentSecurityPolicy: { useDefaults: true, directives: cspDirectives },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const ipViolations = new Map();
const bannedIPs = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of bannedIPs) { if (until <= now) bannedIPs.delete(ip); }
  for (const [ip, v] of ipViolations) { if (v.expires <= now) ipViolations.delete(ip); }
}, 60000);

function banIp(ip, baseMs) {
  const v = ipViolations.get(ip) || { count: 0, expires: 0 };
  v.count++;
  v.expires = Date.now() + 30 * 60 * 1000;
  ipViolations.set(ip, v);
  const duration = Math.min(baseMs * Math.pow(2, v.count - 1), 24 * 60 * 60 * 1000);
  bannedIPs.set(ip, Date.now() + duration);
}

function makeBanningLimiter(opts) {
  return expressRateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      banIp(req.ip, opts.banMs);
      res.status(429).json({ success: false, message: 'Too many requests. Temporarily blocked.' });
    }
  });
}

app.use((req, res, next) => {
  const ban = bannedIPs.get(req.ip);
  if (ban) {
    if (ban > Date.now()) {
      res.set('Retry-After', String(Math.ceil((ban - Date.now()) / 1000)));
      return res.status(429).json({ success: false, message: 'Temporarily blocked due to abuse.' });
    }
    bannedIPs.delete(req.ip);
  }
  next();
});

const globalLimiter = makeBanningLimiter({ windowMs: 60 * 1000, max: 240, banMs: 5 * 60 * 1000 });
app.use(globalLimiter);

const limiter = makeBanningLimiter({ windowMs: 15 * 60 * 1000, max: 300, banMs: 10 * 60 * 1000 });
app.use('/api/', limiter);

const authLimiter = makeBanningLimiter({ windowMs: 15 * 60 * 1000, max: 5, banMs: 30 * 60 * 1000 });
app.use('/login', authLimiter);
app.use('/register', authLimiter);

const apiLimiter = makeBanningLimiter({ windowMs: 15 * 60 * 1000, max: 20, banMs: 15 * 60 * 1000 });
app.use('/api/createcode', apiLimiter);
app.use('/api/inbox/discord', apiLimiter);

const adminLimiter = makeBanningLimiter({ windowMs: 15 * 60 * 1000, max: 60, banMs: 15 * 60 * 1000 });
app.use('/api/admin/', adminLimiter);

const DB_FILE = path.join(DATA_DIR, 'db.json');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects_data');
function loadOrCreatePersistentSecret() {
  const secretFile = path.join(DATA_DIR, 'session_secret.txt');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing) return existing;
  } catch (e) {}
  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  } catch (e) {}
  return generated;
}
const SECRET = process.env.SESSION_SECRET || loadOrCreatePersistentSecret();
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set. Using a persisted generated secret from data/session_secret.txt so sessions survive restarts. Set SESSION_SECRET in your environment for production deployments.');
}

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const RC_B64_MARKER = '\u0000RCB64\u0000';
function bufferToStoredString(buf) {
  const sample = buf.slice(0, 8000);
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 0) suspicious += 1000;
    else if (c < 7 || (c > 13 && c < 32)) suspicious++;
  }
  const isBinary = sample.length > 0 && (suspicious / sample.length) > 0.02;
  return isBinary ? (RC_B64_MARKER + buf.toString('base64')) : buf.toString('utf8');
}
function storedStringToBuffer(str) {
  if (typeof str === 'string' && str.startsWith(RC_B64_MARKER)) return Buffer.from(str.slice(RC_B64_MARKER.length), 'base64');
  return Buffer.from(str == null ? '' : String(str), 'utf8');
}

function loadDB() {
  try { if (fs.existsSync(DB_FILE)) { const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); if(!d.changelogs) d.changelogs=[]; if(!d.apiKeys) d.apiKeys=[]; if(!d.feedbacks) d.feedbacks=[]; if(!d.feedbackChats) d.feedbackChats={}; if(!d.inboxMessages) d.inboxMessages=[]; if(!d.shareInvites) d.shareInvites=[]; if(!d.mcClientServers) d.mcClientServers=[]; if(!d.emailConfigs) d.emailConfigs={}; if(!d.adminApiKeys) d.adminApiKeys=[]; if(typeof d.adminBootstrapDone !== 'boolean') d.adminBootstrapDone = d.users.some(x => x.admin); return d; } } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [], mcPorts: 25565, changelogs: [], apiKeys: [], feedbacks: [], feedbackChats: {}, inboxMessages: [], shareInvites: [], mcClientServers: [], emailConfigs: {}, adminApiKeys: [], adminBootstrapDone: false };
}

let saveDBPending = false;
let saveDBTimer = null;
function saveDBNow() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
    saveDBPending = false;
  } catch(e) { console.error('[saveDB]', e); }
}
function saveDB() {
  saveDBPending = true;
  if (saveDBTimer) return;
  saveDBTimer = setTimeout(() => { saveDBTimer = null; saveDBNow(); }, 150);
}
setInterval(() => { if (saveDBPending) saveDBNow(); }, 10000);
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => { saveDBNow(); process.exit(0); });
});
process.on('exit', () => { if (saveDBPending) saveDBNow(); });

let db = loadDB();
const procs = {};
const intentionalStops = new Set();
const wsClients = new Set();
const rateLimit = {};

const restartState = {};
function nextRestartDelay(id) {
  const now = Date.now();
  const s = restartState[id] || (restartState[id] = { count: 0, windowStart: now });
  if (now - s.windowStart > 2 * 60 * 1000) { s.count = 0; s.windowStart = now; }
  s.count++;
  if (s.count > 6) return -1;
  return Math.min(3000 * Math.pow(2, s.count - 1), 60000);
}
function noteStableRun(id, startedAt) {
  setTimeout(() => {
    if (Date.now() - startedAt >= 5 * 60 * 1000 && restartState[id]) {
      restartState[id].count = 0;
      restartState[id].windowStart = Date.now();
    }
  }, 5 * 60 * 1000);
}
function checkRate(key, max, winMs) { const now = Date.now(); if (!rateLimit[key]) rateLimit[key] = []; rateLimit[key] = rateLimit[key].filter(t => now - t < winMs); if (rateLimit[key].length >= max) return false; rateLimit[key].push(now); return true; }

const PY_STDLIB = new Set(["os","sys","json","time","random","re","math","datetime","asyncio","pathlib","typing","io","collections","subprocess","threading","socket","abc","argparse","base64","binascii","bisect","builtins","bz2","calendar","cgi","cgitb","chunk","cmd","code","codecs","codeop","colorsys","compileall","concurrent","configparser","contextlib","contextvars","copy","copyreg","crypt","csv","ctypes","curses","dataclasses","dbm","decimal","difflib","dis","distutils","doctest","email","encodings","ensurepip","enum","errno","faulthandler","fcntl","filecmp","fileinput","fnmatch","formatter","fractions","ftplib","functools","gc","getopt","getpass","gettext","glob","graphlib","grp","gzip","hashlib","heapq","hmac","html","http","idlelib","imaplib","imghdr","imp","importlib","inspect","keyword","lib2to3","linecache","locale","logging","lzma","mailbox","mailcap","marshal","mimetypes","mmap","modulefinder","msilib","msvcrt","multiprocessing","netrc","nis","nntplib","ntpath","numbers","opcode","operator","optparse","ossaudiodev","parser","pdb","pickle","pickletools","pipes","pkgutil","platform","plistlib","poplib","posix","posixpath","pprint","profile","pstats","pty","pwd","py_compile","pyclbr","pydoc","queue","quopri","readline","reprlib","resource","rlcompleter","runpy","sched","secrets","select","selectors","shelve","shlex","shutil","signal","site","smtpd","smtplib","sndhdr","socketserver","spwd","sqlite3","sre","sre_compile","sre_constants","sre_parse","ssl","stat","statistics","statvfs","string","stringprep","struct","sunau","symbol","symtable","sysconfig","syslog","tabnanny","tarfile","telnetlib","tempfile","termios","test","textwrap","timeit","tkinter","token","tokenize","trace","traceback","tracemalloc","tty","turtle","turtledemo","types","unicodedata","unittest","urllib","uu","uuid","venv","warnings","wave","weakref","webbrowser","winreg","winsound","wsgiref","xdrlib","xml","xmlrpc","zipapp","zipfile","zipimport","zlib","zoneinfo"]);
const NODE_BUILTIN = new Set(["fs","path","http","https","crypto","os","util","child_process","events","stream","net","dgram","dns","url","zlib","querystring","assert","buffer","console","constants","domain","punycode","readline","repl","string_decoder","timers","tls","tty","vm","worker_threads","perf_hooks","async_hooks","trace_events","inspector","wasi","diagnostics_channel"]);

const PY_IMPORT_TO_PKG = { pil: 'Pillow', cv2: 'opencv-python', yaml: 'PyYAML', bs4: 'beautifulsoup4', dotenv: 'python-dotenv', sklearn: 'scikit-learn', dateutil: 'python-dateutil', serial: 'pyserial', crypto: 'pycryptodome', jwt: 'PyJWT', attr: 'attrs', discord_slash: 'discord-py-slash-command', magic: 'python-magic', docx: 'python-docx', pptx: 'python-pptx', usb: 'pyusb', googleapiclient: 'google-api-python-client', pymysql: 'PyMySQL', psycopg2: 'psycopg2-binary' };

function detectPyDeps(code, set) {
  const re = /(?:^|[\n;])\s*(?:import\s+([a-zA-Z0-9_.]+)|from\s+([a-zA-Z0-9_.]+)\s+import)/gm;
  let m;
  while ((m = re.exec(code))) {
    let pkg = (m[1] || m[2] || '').split('.')[0].toLowerCase().trim();
    if (pkg && !PY_STDLIB.has(pkg)) {
      if (pkg === 'discord') pkg = 'discord.py';
      else if (PY_IMPORT_TO_PKG[pkg]) pkg = PY_IMPORT_TO_PKG[pkg];
      set.add(pkg);
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
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const expectedBuf = Buffer.from(crypto.createHmac('sha256', SECRET).update(parts[0]).digest('base64'));
    const givenBuf = Buffer.from(parts[1]);
    if (expectedBuf.length !== givenBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, givenBuf)) return null;
    return JSON.parse(Buffer.from(parts[0], 'base64').toString()).u;
  } catch (e) {
    return null;
  }
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

function getUser(req) { const c = verifyToken(parseCookies(req)['rc_tok']); if (c) return c; const h = (req.headers['authorization'] || req.headers['Authorization'] || ''); if (h.startsWith('rc_live_')) { const hash = require('crypto').createHash('sha256').update(h).digest('hex'); const k = (db.apiKeys || []).find(x => x.keyHash === hash); if (k) return k.username; } if (h) { const ak = (db.adminApiKeys || []).find(x => x.key === h); if (ak) return ak.assignedUser || 'Reboot Cord Staff'; } return null; }

function setCookie(res, token) {
  const isSecure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', 'rc_tok=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800' + (isSecure ? '; Secure' : ''));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'rc_tok=; HttpOnly; Path=/; Max-Age=0');
}

const unlockedAccess = {};
const resetPasswordAttempts = new Map();
const RESET_PASSWORD_COOLDOWN_MS = 60 * 1000;

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

const wsIpCounts = new Map();
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';
  if (bannedIPs.has(ip) && bannedIPs.get(ip) > Date.now()) return ws.close(1013, 'Blocked');
  const current = wsIpCounts.get(ip) || 0;
  if (current >= 10) return ws.close(1013, 'Too many connections');
  wsIpCounts.set(ip, current + 1);
  ws.on('close', () => wsIpCounts.set(ip, Math.max(0, (wsIpCounts.get(ip) || 1) - 1)));

  const token = parseCookies(req)['rc_tok'];
  const user = verifyToken(token);
  if (!user) return ws.close();
  ws.username = user;
  ws.ip = ip;
  wsClients.add(ws);
  ws.on('message', (msg) => {
    if (!checkRate('ws:' + ip, 40, 1000)) return;
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

app.get('/sw.js', (req, res) => {
  const candidates = [path.join(__dirname, 'sw.js'), path.join(__dirname, 'dist-web', 'sw.js'), path.join(__dirname, 'webapp', 'public', 'sw.js')];
  const swPath = candidates.find(p => fs.existsSync(p));
  if (!swPath) return res.status(404).type('application/javascript').send('');
  res.type('application/javascript');
  res.sendFile(swPath);
});

app.use(express.static(__dirname, { index: false }));

app.get('/', (req, res) => {
  if (getUser(req)) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/account-setup', (req, res) => {
  if (getUser(req)) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  if (getUser(req)) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard/changelogs', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/our-api', (req, res) => {
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
  const { username, password, invite, discordUsername, email } = req.body;
  if (!username || !password || !invite) return res.json({ success: false, message: 'All fields required' });
  if (!isValidUsername(username)) return res.json({ success: false, message: 'Discord username must be 2-32 characters' });
  if (password.length < 8) return res.json({ success: false, message: 'Password must be at least 8 characters' });
  if (email && !isValidEmail(email)) return res.json({ success: false, message: 'Invalid email address' });
  const code = invite.startsWith('rebootcord-') ? invite : 'rebootcord-' + invite;
  if (db.blacklisted.includes(code) || db.blacklisted.includes(username)) return res.json({ success: false, message: 'Blacklisted' });
  if (!db.inviteCodes[code]) return res.json({ success: false, message: 'Invalid invite code' });
  if (db.inviteCodes[code] !== true && db.inviteCodes[code] !== username) return res.json({ success: false, message: 'Invite code is bound to a different Discord username' });
  if (db.users.find(u => u.username === username)) return res.json({ success: false, message: 'Discord username already registered' });
  const hashedPassword = await bcrypt.hash(password, 10);
  db.users.push({ username, password: hashedPassword, email: email || null, invite: code, discordUsername: username, projects: [], admin: false });
  delete db.inviteCodes[code];
  db.inboxMessages = db.inboxMessages || [];
  db.inboxMessages.unshift({
    id: Date.now(),
    title: 'Welcome to reboot world!',
    body: 'this is a website where you can host your discord bots. Please follow ALL of the rules from the discord server.',
    linkText: 'discord server.',
    linkUrl: 'https://discord.gg/rNKcnJV72c',
    ts: Date.now(),
    readBy: [],
    sender: 'Reboot Cord',
    rank: 'notice',
    recipient: username
  });
  db.inboxMessages.unshift({
    id: Date.now() + 1,
    title: 'Introducing Reboot cord Client!',
    body: 'Reboot cord client is the next step of minecraft server hosting. Get ready to experience the best minecraft server hosting ever. Check out the info for more information of the client.',
    linkText: 'info',
    linkUrl: '/minecraft-client',
    ts: Date.now() + 1,
    readBy: [],
    sender: 'Reboot Cord',
    rank: 'notice',
    variant: 'release',
    recipient: username
  });
  saveDB();
  if (email) sendWelcomeEmail(email, username);
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

app.post('/api/reset-password', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (!username || !email || !newPassword) return res.json({ success: false, message: 'All fields required' });
  if (newPassword.length < 8) return res.json({ success: false, message: 'Password must be at least 8 characters' });
  const user = db.users.find(x => x.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.email || user.email.toLowerCase() !== email.toLowerCase()) {
    return res.json({ success: false, message: 'No account matches that username and email.' });
  }
  const last = resetPasswordAttempts.get(user.username) || 0;
  const wait = RESET_PASSWORD_COOLDOWN_MS - (Date.now() - last);
  if (wait > 0) {
    return res.json({ success: false, message: `Please wait ${Math.ceil(wait / 1000)}s before requesting another reset.` });
  }
  resetPasswordAttempts.set(user.username, Date.now());
  user.password = await bcrypt.hash(newPassword, 10);
  saveDB();
  sendPasswordResetConfirmation(user.email, user.username, newPassword);
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const u = getUser(req);
  if (u) {
    const user = db.users.find(x => x.username === u) || {};
    return res.json({ loggedIn: true, username: u, isAdmin: !!user.admin, avatarColor: user.avatarColor || '#ef4655' });
  }
  res.json({ loggedIn: false });
});

app.post('/api/profile', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  const color = typeof req.body.avatarColor === 'string' ? req.body.avatarColor : '';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.json({ success: false, message: 'Invalid color' });
  user.avatarColor = color;
  saveDB();
  res.json({ success: true, avatarColor: color });
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
  user.projects.forEach(p => {
    if (p.type === 'minecraft' && !p.port) {
      p.port = assignMcClientPort();
    }
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
    if (p.files) {
      for (const fname of Object.keys(p.files)) {
        const filePath = path.join(pDir, fname);
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        fs.writeFileSync(filePath, storedStringToBuffer(p.files[fname]));
      }
    }
  });
  saveDB();
  res.json({ success: true });
});

app.post('/api/projects/:id/delete', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !access.isOwner) return res.json({ success: false });
  const members = projectMemberUsernames(access);

  if (procs[p.id]) {
    intentionalStops.add(p.id);
    killProcessTree(procs[p.id], 'SIGKILL');
    delete procs[p.id];
  }
  p.running = false;

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  try {
    if (fs.existsSync(pDir)) fs.rmSync(pDir, { recursive: true, force: true });
  } catch (e) {}

  const owner = db.users.find(x => x.username === u);
  if (owner) owner.projects = (owner.projects || []).filter(x => String(x.id) !== String(p.id));
  saveDB();

  broadcastToMembers(members, { event: 'log', projectId: p.id, msg: '[System] Project deleted by owner.', type: 'err' });
  broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running: false });
  (p.shared || []).forEach(s => broadcastEvent(s.username, { event: 'removedFromProject', projectId: p.id, projectName: p.name }));

  res.json({ success: true });
});

app.get('/api/projects/:id/access', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  if (!access.p) return res.json({ success: false, notFound: true });
  if (!access.hasAccess) return res.json({ success: false, removed: true });
  res.json({
    success: true,
    isOwner: access.isOwner,
    isShared: access.isShared,
    perms: access.perms,
    locked: access.locked,
    hasPassword: !!access.p.password,
    private: !!access.p.private,
    name: access.p.name,
    password: access.isOwner ? (access.p.password || '') : undefined,
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
  db.shareInvites = db.shareInvites || [];
  db.shareInvites.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    recipient: targetUser.username,
    sender: u,
    projectId: p.id,
    projectName: p.name,
    ts: Date.now(),
    seen: false
  });
  db.inboxMessages = db.inboxMessages || [];
  db.inboxMessages.unshift({
    id: Date.now(),
    title: `Added to "${p.name}"`,
    body: `${u} has shared their bot project with you.`,
    ts: Date.now(),
    readBy: [],
    sender: u,
    rank: 'notice',
    recipient: targetUser.username
  });
  saveDB();
  broadcastEvent(targetUser.username, { event: 'addedToProject', projectId: p.id, projectName: p.name });
  res.json({ success: true, shared: p.shared });
});

app.get('/api/share-invites', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, invites: [] });
  const invites = (db.shareInvites || []).filter(x => x.recipient === u && !x.seen);
  res.json({ success: true, invites });
});

app.post('/api/share-invites/ack', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const inv = (db.shareInvites || []).find(x => x.id === req.body.id && x.recipient === u);
  if (inv) { inv.seen = true; saveDB(); }
  res.json({ success: true });
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
      body: `${user.username} has removed you from their project.`,
      ts: Date.now(),
      readBy: [],
      sender: user.username,
      rank: 'notice',
      variant: 'danger',
      recipient: removedUser
    });
  }
  saveDB();
  if (wasShared) broadcastEvent(removedUser, { event: 'removedFromProject', projectId: p.id, projectName: p.name });
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
  db.inboxMessages = db.inboxMessages || [];
  const hasWelcomeMsg = db.inboxMessages.some(m => m.title === 'Welcome to reboot world!' && (!m.recipient || m.recipient === u));
  if (!hasWelcomeMsg) {
    db.inboxMessages.unshift({
      id: Date.now() + Math.floor(Math.random() * 100000),
      title: 'Welcome to reboot world!',
      body: 'this is a website where you can host your discord bots. Please follow ALL of the rules from the discord server.',
      linkText: 'discord server.',
      linkUrl: 'https://discord.gg/rNKcnJV72c',
      ts: Date.now(),
      readBy: [],
      sender: 'Reboot Cord',
      rank: 'notice',
      recipient: u
    });
  }
  const hasReleaseMsg = db.inboxMessages.some(m => m.variant === 'release' && (!m.recipient || m.recipient === u));
  if (!hasReleaseMsg) {
    db.inboxMessages.unshift({
      id: Date.now() + Math.floor(Math.random() * 100000) + 1,
      title: 'Introducing Reboot cord Client!',
      body: 'Reboot cord client is the next step of minecraft server hosting. Get ready to experience the best minecraft server hosting ever. Check out the info for more information of the client.',
      linkText: 'info',
      linkUrl: '/minecraft-client',
      ts: Date.now(),
      readBy: [],
      sender: 'Reboot Cord',
      rank: 'notice',
      variant: 'release',
      recipient: u
    });
  }
  if (!hasWelcomeMsg || !hasReleaseMsg) saveDB();
  const msgs = (db.inboxMessages || [])
    .filter(m => !m.recipient || m.recipient === u)
    .map(m => ({
      id: m.id, title: m.title, body: m.body, ts: m.ts,
      read: (m.readBy || []).includes(u),
      sender: m.sender,
      rank: m.rank,
      variant: m.variant,
      linkText: m.linkText,
      linkUrl: m.linkUrl,
      popupVariant: m.popupVariant
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
  db.inboxMessages.unshift({ id: Date.now(), title, body, ts: Date.now(), readBy: [], sender: u, rank: 'staff', popupVariant: 'message' });
  saveDB();
  res.json({ success: true });
});

app.post('/api/inbox/discord', (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(403).json({ success: false, message: 'Invalid or missing API key.' });
  const message = (req.body.message || '').trim();
  const sender = (req.body.sender || 'Staff').trim();
  if (!message) return res.json({ success: false, message: 'Message is required.' });
  db.inboxMessages = db.inboxMessages || [];
  db.inboxMessages.unshift({ id: Date.now(), title: `Message from ${sender}`, body: message, ts: Date.now(), readBy: [], sender, rank: 'staff', popupVariant: 'message' });
  saveDB();
  res.json({ success: true });
});



app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

app.get('/install.sh', (req, res) => {
  res.set('Content-Type', 'text/x-sh');
  res.sendFile(path.join(__dirname, 'install.sh'));
});

app.get('/install.ps1', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'install.ps1'));
});

app.get('/install.bat', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'install.bat'));
});

app.get('/install', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isWindows = userAgent.includes('Windows');
  
  if (isWindows) {
    res.redirect('/install.bat');
  } else {
    res.redirect('/install.sh');
  }
});

app.get('/minecraft-client', (req, res) => {
  res.sendFile(path.join(__dirname, 'minecraft-info', 'client.html'));
});

app.get('/backend-mc', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend-mc', 'backend.html'));
});
app.use('/backend-mc', express.static(path.join(__dirname, 'backend-mc')));

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

app.get('/api/users', (req, res) => {
  const usernames = db.users.map(x => x.username).sort((a, b) => a.localeCompare(b));
  res.json({ success: true, count: usernames.length, users: usernames });
});

app.post('/api/blacklist', (req, res) => {
  const { key } = req.body;
  if (key && !db.blacklisted.includes(key)) { db.blacklisted.push(key); saveDB(); }
  res.json({ success: true });
});

app.get('/api/projects/:id/detect-deps', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, packages: [] });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !access.hasAccess) return res.json({ success: false, packages: [] });
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !access.hasAccess) return res.json({ success: false });
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
  if (!u) { if (req.file) try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false }); }
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canEditFiles(access)) { if (req.file) try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false }); }
  if (access.locked) { if (req.file) try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false, needsPassword: true }); }
  if (!req.file) return res.json({ success: false });

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  let relPath = (req.body && req.body.relPath) ? String(req.body.relPath).replace(/\\/g, '/') : req.file.originalname;
  relPath = relPath.split('/').map(s => s.trim()).filter(s => s && s !== '.' && s !== '..').join('/');
  if (!relPath) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false }); }

  const target = safeJoin(pDir, relPath);
  if (!target) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false }); }
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  try {
    fs.renameSync(req.file.path, target);
    const buf = fs.readFileSync(target);
    p.files = p.files || {};
    p.files[relPath] = bufferToStoredString(buf);
    saveDB();
    broadcastLog(u, p.id, '[System] Uploaded ' + relPath, 'info');
    res.json({ success: true, path: relPath });
  } catch (e) {
    try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch(e2) {}
    res.json({ success: false });
  }
});

app.post('/api/projects/:id/deleteFile', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (p && canEditFiles(access) && req.body.name) {
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (p && canEditFiles(access) && req.body.name) {
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (p && canEditFiles(access) && req.body.name) {
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });
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
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });
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

const termProcs = {};

function tokenizeCommand(str) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str))) out.push(m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]));
  return out;
}

const TERMINAL_HELP = [
  'Available commands:',
  'help - shows all available commands',
  'ls [path] - list files and folders in the project directory',
  'mkdir <name> - create a new folder',
  'delete <name> - delete a file or folder',
  'pip install <package...> - install python packages',
  'pip install -r requirements.txt - install from requirements.txt',
  'npm install [package...] - install node packages (no args installs all dependencies)',
  'python <file> [args...] - run a python file',
  'node <file> [args...] - run a node file',
  'silent restart - restarts the bot without a full reset, skips launch if already running',
  'clear - clear the terminal output'
].join('\n');

function runStreamedCommand(username, projectId, bin, args, cwd) {
  let proc;
  try {
    proc = cp.spawn(bin, args, { cwd, shell: false });
  } catch (e) {
    broadcastEvent(username, { event: 'terminalOutput', projectId, line: 'Error: ' + e.message });
    broadcastEvent(username, { event: 'terminalDone', projectId });
    return;
  }
  termProcs[projectId] = termProcs[projectId] || [];
  termProcs[projectId].push(proc);
  proc.on('error', (err) => {
    broadcastEvent(username, { event: 'terminalOutput', projectId, line: 'Error: ' + err.message });
    broadcastEvent(username, { event: 'terminalDone', projectId });
  });
  proc.stdout.on('data', d => {
    d.toString().split('\n').forEach(line => { if (line.trim()) broadcastEvent(username, { event: 'terminalOutput', projectId, line }); });
  });
  proc.stderr.on('data', d => {
    d.toString().split('\n').forEach(line => { if (line.trim()) broadcastEvent(username, { event: 'terminalOutput', projectId, line }); });
  });
  proc.on('close', (code) => {
    termProcs[projectId] = (termProcs[projectId] || []).filter(x => x !== proc);
    broadcastEvent(username, { event: 'terminalOutput', projectId, line: 'Process exited with code ' + code });
    broadcastEvent(username, { event: 'terminalDone', projectId });
  });
}

app.post('/api/projects/:id/terminal', async (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, output: 'Not authenticated.' });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false, output: 'Access denied.' });
  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  const raw = String(req.body.command || '').trim();
  if (!raw) return res.json({ success: true, output: '' });
  const tokens = tokenizeCommand(raw);
  const cmd = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);

  if (cmd === 'help') return res.json({ success: true, output: TERMINAL_HELP });
  if (cmd === 'clear') return res.json({ success: true, output: '' });

  if (cmd === 'ls') {
    const target = args[0] ? safeJoin(pDir, args[0]) : pDir;
    if (!target || !fs.existsSync(target)) return res.json({ success: false, output: 'No such directory: ' + (args[0] || '.') });
    try {
      const entries = fs.readdirSync(target, { withFileTypes: true });
      if (!entries.length) return res.json({ success: true, output: '(empty directory)' });
      const lines = entries.map(e => e.isDirectory() ? (e.name + '/') : e.name);
      return res.json({ success: true, output: lines.join('\n') });
    } catch (e) { return res.json({ success: false, output: 'Error: ' + e.message }); }
  }

  if (cmd === 'mkdir') {
    if (!canEditFiles(access)) return res.json({ success: false, output: 'Permission denied.' });
    if (!args[0]) return res.json({ success: false, output: 'Usage: mkdir <name>' });
    const target = safeJoin(pDir, args[0]);
    if (!target) return res.json({ success: false, output: 'Invalid path.' });
    try {
      fs.mkdirSync(target, { recursive: true });
      broadcastEvent(u, { event: 'terminalFsChange', projectId: p.id });
      return res.json({ success: true, output: 'Created folder: ' + args[0] });
    } catch (e) { return res.json({ success: false, output: 'Error: ' + e.message }); }
  }

  if (cmd === 'delete') {
    if (!canEditFiles(access)) return res.json({ success: false, output: 'Permission denied.' });
    if (!args[0]) return res.json({ success: false, output: 'Usage: delete <name>' });
    const target = safeJoin(pDir, args[0]);
    if (!target || target === pDir) return res.json({ success: false, output: 'Invalid path.' });
    if (!fs.existsSync(target)) return res.json({ success: false, output: 'No such file or folder: ' + args[0] });
    try {
      fs.rmSync(target, { recursive: true, force: true });
      if (p.files) {
        Object.keys(p.files).forEach(k => {
          if (k === args[0] || k.indexOf(args[0] + '/') === 0) delete p.files[k];
        });
      }
      saveDB();
      broadcastEvent(u, { event: 'terminalFsChange', projectId: p.id, deleted: args[0] });
      return res.json({ success: true, output: 'Deleted: ' + args[0] });
    } catch (e) { return res.json({ success: false, output: 'Error: ' + e.message }); }
  }

  if (cmd === 'pip' && args[0] === 'install') {
    if (!canEditFiles(access)) return res.json({ success: false, output: 'Permission denied.' });
    const modulesDir = path.join(pDir, 'modules');
    if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });
    let pipArgs;
    if (args[1] === '-r') {
      const reqPath = safeJoin(pDir, args[2] || 'requirements.txt');
      if (!reqPath || !fs.existsSync(reqPath)) return res.json({ success: false, output: 'requirements.txt not found.' });
      pipArgs = ['install', '--target', modulesDir, '-r', reqPath];
    } else {
      const pkgs = args.slice(1);
      if (!pkgs.length) return res.json({ success: false, output: 'Usage: pip install <package...>' });
      pipArgs = ['install', '--target', modulesDir].concat(pkgs);
    }
    res.json({ success: true, streaming: true });
    runStreamedCommand(u, p.id, 'pip3', pipArgs, pDir);
    return;
  }

  if (cmd === 'npm' && args[0] === 'install') {
    if (!canEditFiles(access)) return res.json({ success: false, output: 'Permission denied.' });
    const npmArgs = ['install'].concat(args.slice(1));
    res.json({ success: true, streaming: true });
    runStreamedCommand(u, p.id, 'npm', npmArgs, pDir);
    return;
  }

  if (cmd === 'silent' && args[0] === 'restart') {
    if (!canControl(access)) return res.json({ success: false, output: 'Permission denied.' });
    if (procs[p.id]) {
      killProcessTree(procs[p.id], 'SIGKILL');
      delete procs[p.id];
    }
    p.running = false;
    saveDB();
    await startProjectHandler(req, res);
    return;
  }

  if (cmd === 'python' || cmd === 'node') {
    if (!canControl(access)) return res.json({ success: false, output: 'Permission denied.' });
    if (!args[0]) return res.json({ success: false, output: 'Usage: ' + cmd + ' <file> [args...]' });
    const target = safeJoin(pDir, args[0]);
    if (!target || !fs.existsSync(target)) return res.json({ success: false, output: 'No such file: ' + args[0] });
    res.json({ success: true, streaming: true });
    const bin = cmd === 'python' ? 'python3' : 'node';
    runStreamedCommand(u, p.id, bin, [args[0]].concat(args.slice(1)), pDir);
    return;
  }

  return res.json({ success: false, output: 'Unknown command: ' + cmd + '. Type "help" for a list of commands.' });
});

function projectMemberUsernames(access) {
  const names = access.owner ? [access.owner.username] : [];
  (access.p.shared || []).forEach(s => { if (!names.includes(s.username)) names.push(s.username); });
  return names;
}

function broadcastToMembers(members, payload) {
  members.forEach(m => broadcastEvent(m, payload));
}

async function ensureJava() {
  const jre25Bin = path.join(PROJECTS_DIR, 'jre25', 'bin', 'java');
  if (fs.existsSync(jre25Bin)) return jre25Bin;
  try {
    const { stdout, stderr } = await execAsync('java -version', { shell: true });
    const out = (stdout || '') + (stderr || '');
    const m = out.match(/version "(\d+)/);
    const major = m ? parseInt(m[1], 10) : 0;
    if (major >= 21) return 'java';
  } catch (e) {}
  try {
    await execAsync('curl -L -o jre25.tar.gz https://github.com/adoptium/temurin25-binaries/releases/latest/download/OpenJDK25U-jre_x64_linux_hotspot.tar.gz', { cwd: PROJECTS_DIR, shell: true });
    await execAsync('mkdir -p jre25 && tar -xzf jre25.tar.gz -C jre25 --strip-components=1', { cwd: PROJECTS_DIR, shell: true });
    if (fs.existsSync(jre25Bin)) return jre25Bin;
  } catch (e) {}
  const jre21Bin = path.join(PROJECTS_DIR, 'jre', 'bin', 'java');
  if (fs.existsSync(jre21Bin)) return jre21Bin;
  try {
    await execAsync('curl -L -o jre.tar.gz https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_linux_hotspot_21.0.2_13.tar.gz', { cwd: PROJECTS_DIR, shell: true });
    await execAsync('mkdir -p jre && tar -xzf jre.tar.gz -C jre --strip-components=1', { cwd: PROJECTS_DIR, shell: true });
    if (fs.existsSync(jre21Bin)) return jre21Bin;
  } catch (e) {}
  return 'java';
}

async function launchMinecraftProject(p, members) {
  function logAll(msg, type) { broadcastToMembers(members, { event: 'log', projectId: p.id, msg, type: type || 'info' }); }
  function statusAll(running) { broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running }); }

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  intentionalStops.delete(p.id);
  p.running = true;
  saveDB();
  statusAll(true);

  const javaCmd = await ensureJava();

  let bindIp = '0.0.0.0';
  if (p.ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p.ip)) bindIp = p.ip;
  fs.writeFileSync(path.join(pDir, 'eula.txt'), 'eula=true\n');
  fs.writeFileSync(path.join(pDir, 'server.properties'), `server-port=${p.port}\nserver-ip=${bindIp}\nonline-mode=false\nmotd=${p.name || 'Minecraft Server'}\n`);

  const jarPath = path.join(pDir, 'server.jar');
  if (!fs.existsSync(jarPath)) {
    logAll('[System] Downloading Minecraft server for ' + (p.serverType || 'Vanilla') + ' ' + (p.version || '1.21.5') + '...', 'sys');
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
      logAll('[System] Download complete.', 'ok');
    } catch (e) {
      logAll('[System] Failed to download server jar: ' + e.message, 'err');
    }
  }
  if (!fs.existsSync(jarPath)) {
    logAll('[System] No server.jar found. Use Files tab to upload the correct server jar for this type/version, then Start again.', 'warn');
  }
  const startedAt = Date.now();
  const proc = cp.spawn(javaCmd, ['-Xms512M', '-Xmx1024M', '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200', '-XX:+UnlockExperimentalVMOptions', '-jar', 'server.jar', 'nogui'], { cwd: pDir, shell: true, detached: true });
  procs[p.id] = proc;
  noteStableRun(p.id, startedAt);

  proc.on('error', (err) => {
    logAll(`[System] Server failed to start: ${err.message}`, 'err');
  });

  proc.stdout.on('data', d => {
    d.toString().split('\n').forEach(line => {
      if (!line.trim()) return;
      logAll(line.trim(), 'server');
      if (line.includes('Preparing level')) {
        logAll('[System] World created', 'ok');
      }
      if (line.includes('Done (')) {
        logAll(`[System] your ${p.ip || 'play.server.net'}:${p.port} has successfully started`, 'ok');
      }
    });
  });

  proc.stderr.on('data', d => {
    d.toString().split('\n').forEach(line => {
      if (line.trim()) logAll(line.trim(), 'warn');
    });
  });

  proc.on('close', () => {
    if (procs[p.id] === proc) delete procs[p.id];
    const wasIntentional = intentionalStops.has(p.id);
    intentionalStops.delete(p.id);
    p.running = false;
    saveDB();
    statusAll(false);
    if (wasIntentional) {
      logAll('[System] Process exited.', 'sys');
      return;
    }
    const delay = nextRestartDelay(p.id);
    if (delay === -1) {
      logAll('[System] Server crashed repeatedly. Auto-restart paused, check your config/files and start manually.', 'err');
      return;
    }
    logAll(`[System] Process exited unexpectedly. Restarting in ${Math.round(delay / 1000)}s...`, 'warn');
    setTimeout(() => {
      const stillExists = findOwnerAndProject(p.id).p;
      if (!stillExists) return;
      launchMinecraftProject(p, members).catch(e => logAll('[System] Restart failed: ' + e.message, 'err'));
    }, delay);
  });
}

function detectCrashReason(lines, missingPkgs, lang) {
  const text = lines.join('\n');
  if (missingPkgs && missingPkgs.size > 0) {
    const pkgs = Array.from(missingPkgs).join(', ');
    return `Missing ${lang === 'Python' ? 'package(s)' : 'module(s)'}: ${pkgs}. Add ${lang === 'Python' ? 'them to requirements.txt' : 'them to package.json'} and install dependencies, then start again.`;
  }
  if (/LoginFailure|Improper token has been passed|401 Unauthorized|TokenInvalid|invalid token/i.test(text)) {
    return 'Invalid bot token. Double check the token in your project Settings and make sure it hasn\'t been regenerated on the Discord Developer Portal.';
  }
  if (/PrivilegedIntentsRequired|disallowed intents|requesting privileged intents/i.test(text)) {
    return 'Your bot is requesting privileged intents that aren\'t enabled for it. Enable the required intents (Message Content / Presence / Server Members) for your bot in the Discord Developer Portal.';
  }
  if (/Cannot find module/i.test(text)) {
    return 'A required Node package is missing. Add it to package.json and reinstall dependencies, then start again.';
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return 'Network error while connecting to Discord. This is usually temporary — the bot will retry automatically.';
  }
  if (/SyntaxError|IndentationError/i.test(text)) {
    return 'Your code has a syntax error. Check the traceback above for the exact file and line, fix it, then start again.';
  }
  if (/RateLimited|429 Too Many Requests|Cloudflare/i.test(text)) {
    return 'The bot is being rate limited by Discord. It will back off and retry automatically.';
  }
  return null;
}

async function launchGenericProject(p, members) {
  function logAll(msg, type) { broadcastToMembers(members, { event: 'log', projectId: p.id, msg, type: type || 'info' }); }
  function statusAll(running) { broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running }); }

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  intentionalStops.delete(p.id);
  p.running = true;
  saveDB();
  statusAll(true);

  if (p.files) {
    for (const fname of Object.keys(p.files)) {
      const filePath = path.join(pDir, fname);
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      fs.writeFileSync(filePath, storedStringToBuffer(p.files[fname]));
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
  } catch (e) {}

  let cmd, args;
  if (p.lang === 'Python') {
    cmd = 'python3';
    args = ['-u', '-c', 'import sys, runpy; modules_dir, main_file = sys.argv[1], sys.argv[2]; sys.path.insert(0, modules_dir); sys.argv = [main_file]; runpy.run_path(main_file, run_name="__main__")', modulesDir, mainFile];
  } else {
    cmd = 'node';
    args = [mainFile];
  }

  const startedAt = Date.now();
  const proc = cp.spawn(cmd, args, { cwd: pDir, env: envVars, shell: p.lang === 'Python' ? false : true, detached: true });
  procs[p.id] = proc;
  noteStableRun(p.id, startedAt);

  const missingPkgs = new Set();
  const recentLines = [];
  function trackLine(line) {
    recentLines.push(line);
    if (recentLines.length > 80) recentLines.shift();
  }

  proc.on('error', (err) => {
    logAll(`[System] Bot failed to start: ${err.message}`, 'err');
    if (procs[p.id] === proc) delete procs[p.id];
    p.running = false;
    saveDB();
    statusAll(false);
  });

  proc.stdout.on('data', d => {
    d.toString().split('\n').forEach(line => {
      if (!line.trim()) return;
      trackLine(line);
      logAll(line.trim(), 'info');
    });
  });

  proc.stderr.on('data', d => {
    d.toString().split('\n').forEach(line => {
      if (!line.trim()) return;
      trackLine(line);
      if (line.includes('INFO') || line.includes('discord.gateway') || line.includes('discord.client') || line.includes('Logged in as')) {
        logAll(line.trim(), 'ok');
      } else {
        logAll(line.trim(), 'err');
        const match = line.match(/ModuleNotFoundError: No module named '([^']+)'/) || line.match(/Cannot find module '([^']+)'/);
        if (match && match[1]) missingPkgs.add(match[1]);
      }
    });
  });

  proc.on('close', (code) => {
    if (procs[p.id] === proc) delete procs[p.id];
    const wasIntentional = intentionalStops.has(p.id);
    intentionalStops.delete(p.id);
    p.running = false;
    saveDB();
    statusAll(false);
    if (wasIntentional) {
      logAll('[System] Process exited.', 'sys');
      return;
    }
    const reason = detectCrashReason(recentLines, missingPkgs, p.lang);
    if (reason) logAll('[System] ' + reason, 'err');
    if (missingPkgs.size > 0) {
      logAll('[System] Bot stopped due to missing dependencies. Fix and start manually.', 'err');
      return;
    }
    const delay = nextRestartDelay(p.id);
    if (delay === -1) {
      logAll('[System] Bot crashed repeatedly. Auto-restart paused, check your code/token and start manually.', 'err');
      return;
    }
    logAll(`[System] Process exited unexpectedly (code ${code}). Restarting in ${Math.round(delay / 1000)}s...`, 'warn');
    setTimeout(() => {
      const stillExists = findOwnerAndProject(p.id).p;
      if (!stillExists) return;
      launchGenericProject(p, members).catch(e => logAll('[System] Restart failed: ' + e.message, 'err'));
    }, delay);
  });
}

async function startProjectHandler(req, res) {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });
  if (access.locked) return res.json({ success: false, needsPassword: true });

  const members = projectMemberUsernames(access);
  function statusAll(running) { broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running }); }

  const pDir = path.join(PROJECTS_DIR, String(p.id));
  if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

  intentionalStops.add(p.id);
  if (procs[p.id]) {
    killProcessTree(procs[p.id], 'SIGKILL');
    delete procs[p.id];
  }

  p.running = true;
  saveDB();
  statusAll(true);

  if (p.type === 'minecraft') {
    intentionalStops.delete(p.id);
    await launchMinecraftProject(p, members);
  } else {
    await launchGenericProject(p, members);
  }

  res.json({ success: true });
}

app.post('/api/projects/:id/start', startProjectHandler);

app.post('/api/projects/:id/restart', async (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });
  const members = projectMemberUsernames(access);
  if (procs[p.id]) {
    killProcessTree(procs[p.id], 'SIGKILL');
    delete procs[p.id];
  }
  p.running = false;
  saveDB();
  broadcastToMembers(members, { event: 'log', projectId: p.id, msg: '[System] Restarting...', type: 'sys' });
  broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running: false });
  await startProjectHandler(req, res);
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
  const members = projectMemberUsernames(access);

  if (procs[p.id]) {
    const proc = procs[p.id];
    intentionalStops.add(p.id);
    broadcastToMembers(members, { event: 'log', projectId: p.id, msg: '[System] Stopping process...', type: 'warn' });
    killProcessTree(proc, 'SIGTERM');
    setTimeout(() => {
      if (procs[p.id] === proc) {
        killProcessTree(proc, 'SIGKILL');
        delete procs[p.id];
        p.running = false;
        saveDB();
        broadcastToMembers(members, { event: 'log', projectId: p.id, msg: '[System] Process did not exit gracefully, forced stop.', type: 'warn' });
        broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running: false });
      }
    }, 3000);
  } else {
    p.running = false;
    saveDB();
    broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running: false });
  }
  res.json({ success: true });
});

app.post('/api/projects/:id/kill', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const access = getAccess(u, req.params.id);
  const p = access.p;
  if (!p || !canControl(access)) return res.json({ success: false });
  const members = projectMemberUsernames(access);

  if (procs[p.id]) {
    const proc = procs[p.id];
    intentionalStops.add(p.id);
    killProcessTree(proc, 'SIGKILL');
    delete procs[p.id];
  }
  if (termProcs[p.id]) {
    termProcs[p.id].forEach(tp => { try { tp.kill('SIGKILL'); } catch (e) {} });
    termProcs[p.id] = [];
  }

  p.running = false;
  saveDB();
  broadcastToMembers(members, { event: 'log', projectId: p.id, msg: '[System] Process forcefully killed.', type: 'warn' });
  broadcastToMembers(members, { event: 'statusChange', projectId: p.id, running: false });
  res.json({ success: true });
});

function requireAdmin(req, res) {
  const u = getUser(req);
  if (!u) return null;
  const user = db.users.find(x => x.username === u);
  if (!user) return null;
  if (user.admin) return user;
  const bootstrapEligible = !db.adminBootstrapDone && !db.users.some(x => x.admin);
  if (bootstrapEligible) {
    user.admin = true;
    db.adminBootstrapDone = true;
    saveDB();
    return user;
  }
  return null;
}

app.get('/api/admin/data', (req, res) => {
  if (!requireAdmin(req, res)) return res.json({ users: [], inviteCodes: {}, adminApiKeys: [] });
  const users = db.users.map(u => ({ username: u.username, admin: !!u.admin, premium: !!u.premium }));
  res.json({ users, inviteCodes: db.inviteCodes || {}, adminApiKeys: db.adminApiKeys || [] });
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
    const wasAdmin = !!target.admin;
    target.admin = !!isAdmin;
    if (target.admin && !wasAdmin && !target.staffWelcomeSent) {
      db.inboxMessages = db.inboxMessages || [];
      db.inboxMessages.unshift({
        id: Date.now(),
        title: 'Staff Team',
        body: 'welcome to the staff team ' + target.username + '!',
        ts: Date.now(),
        readBy: [],
        sender: 'System',
        rank: 'staff',
        recipient: target.username,
        popupVariant: 'staff'
      });
      target.staffWelcomeSent = true;
    }
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
  const { title, body, generateLink, ts } = req.body;
  if (!title || !body) return res.json({ success: false });
  db.changelogs = db.changelogs || [];
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const timestamp = ts && !isNaN(ts) ? Number(ts) : Date.now();
  const ch = { id: Date.now(), title: title.trim(), body: body.trim(), author: u, ts: timestamp, likes: [], hasLink: !!generateLink, slug: slug };
  db.changelogs.unshift(ch);
  saveDB();
  res.json({ success: true });
});

app.post('/api/changelogs/:id/setdate', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user || !user.admin) return res.json({ success: false });
  db.changelogs = db.changelogs || [];
  const ch = db.changelogs.find(c => String(c.id) === req.params.id);
  if (!ch) return res.json({ success: false, message: 'Changelog not found' });
  const ts = Number(req.body.ts);
  if (!ts || isNaN(ts)) return res.json({ success: false, message: 'Invalid date' });
  ch.ts = ts;
  saveDB();
  res.json({ success: true, ts: ch.ts });
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
  db.apiKeys.push({ id, username: u, keyHash: hash, key: raw, created: new Date().toISOString() });
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

app.get('/api/v1/apikeys/:id/reveal', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const key = (db.apiKeys || []).find(k => k.id === req.params.id && k.username === u);
  if (!key || !key.key) return res.json({ success: false, message: 'Key not found' });
  res.json({ success: true, key: key.key });
});

const emailSystemLimiter = makeBanningLimiter({ windowMs: 60 * 1000, max: 15, banMs: 10 * 60 * 1000 });

function sanitizeEmailField(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\r\n]/g, ' ').slice(0, max).trim();
}

function buildTemplateVars(to, rawName) {
  const name = sanitizeEmailField(rawName, 60);
  const user = name || deriveFirstNameFromEmail(to);
  return { name: name || user, email: to, user };
}

app.get('/api/email-system/config', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const cfg = (db.emailConfigs && db.emailConfigs[u]) || null;
  const apiKeyId = cfg && cfg.apiKeyId ? cfg.apiKeyId : null;
  const connectedKey = apiKeyId ? (db.apiKeys || []).find(k => k.id === apiKeyId && k.username === u) : null;
  res.json({
    success: true,
    config: cfg ? { ...cfg, apiKeyId: connectedKey ? apiKeyId : null } : { fromName: '', subject: '', message: '', enabled: false, apiKeyId: null },
    smtpConfigured: isSmtpConfigured(),
  });
});

app.post('/api/email-system/config', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const fromName = sanitizeEmailField(req.body.fromName, 60);
  const subject = sanitizeEmailField(req.body.subject, 150);
  const message = typeof req.body.message === 'string' ? req.body.message.slice(0, 5000) : '';
  const enabled = !!req.body.enabled;
  if (enabled && (!subject || !message)) {
    return res.json({ success: false, message: 'Subject and message are required to enable the email system' });
  }
  db.emailConfigs = db.emailConfigs || {};
  const existing = db.emailConfigs[u] || {};
  db.emailConfigs[u] = { fromName, subject, message, enabled, apiKeyId: existing.apiKeyId || null, updated: new Date().toISOString() };
  saveDB();
  res.json({ success: true, config: db.emailConfigs[u], smtpConfigured: isSmtpConfigured() });
});

app.post('/api/email-system/connect-key', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const apiKeyId = typeof req.body.apiKeyId === 'string' ? req.body.apiKeyId : '';
  const key = (db.apiKeys || []).find(k => k.id === apiKeyId && k.username === u);
  if (!key) return res.json({ success: false, message: 'API key not found' });
  db.emailConfigs = db.emailConfigs || {};
  if (!db.emailConfigs[u]) db.emailConfigs[u] = { fromName: '', subject: '', message: '', enabled: false };
  db.emailConfigs[u].apiKeyId = key.id;
  saveDB();
  res.json({ success: true, config: db.emailConfigs[u], sdkUrl: `${SITE_ORIGIN}/api/sdk/emailsystem/${key.key}` });
});

app.post('/api/email-system/disconnect-key', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  db.emailConfigs = db.emailConfigs || {};
  if (db.emailConfigs[u]) db.emailConfigs[u].apiKeyId = null;
  saveDB();
  res.json({ success: true, config: db.emailConfigs[u] || null });
});

app.post('/api/email-system/test', emailSystemLimiter, async (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const cfg = db.emailConfigs && db.emailConfigs[u];
  if (!cfg || !cfg.enabled) return res.json({ success: false, message: 'Email system is not enabled yet. Toggle it on and save before sending a test.' });
  if (!isValidEmail(req.body.to)) return res.json({ success: false, message: 'Invalid recipient email' });
  if (!isSmtpConfigured()) return res.json({ success: false, message: 'SMTP is not configured on the server (missing SMTP_HOST/SMTP_USER/SMTP_PASS).' });
  const vars = buildTemplateVars(req.body.to, req.body.name);
  const subject = renderTemplate(cfg.subject, vars);
  const text = renderTemplate(cfg.message, vars);
  const html = text.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('');
  const result = await sendMail({ to: req.body.to, subject, text, html, fromName: cfg.fromName || undefined });
  res.json({ success: result.sent, message: result.sent ? 'Sent' : (result.reason || 'Could not send email') });
});

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const emailSendCooldown = new Map();

app.post('/api/v1/email-system/send', emailSystemLimiter, async (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const cfg = db.emailConfigs && db.emailConfigs[u];
  if (!cfg || !cfg.enabled) return res.json({ success: false, message: 'Email system is not enabled for this account' });
  if (!isValidEmail(req.body.to)) return res.json({ success: false, message: 'Invalid recipient email' });
  if (!isSmtpConfigured()) return res.json({ success: false, message: 'SMTP is not configured on the server' });
  const dedupeKey = `${u}:${req.body.to}`;
  const lastSent = emailSendCooldown.get(dedupeKey) || 0;
  if (Date.now() - lastSent < 2000) return res.json({ success: false, message: 'Please wait before sending another email to this recipient.' });
  emailSendCooldown.set(dedupeKey, Date.now());
  const vars = buildTemplateVars(req.body.to, req.body.name);
  const subject = sanitizeEmailField(req.body.subject, 150) || renderTemplate(cfg.subject, vars);
  const messageBody = typeof req.body.message === 'string' && req.body.message.trim() ? req.body.message.slice(0, 5000) : cfg.message;
  const text = renderTemplate(messageBody, vars);
  const html = text.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('');
  const result = await sendMail({ to: req.body.to, subject, text, html, fromName: cfg.fromName || undefined });
  res.json({ success: result.sent, message: result.sent ? 'Sent' : (result.reason || 'Could not send email') });
});

app.get('/api/sdk/emailsystem/:key', (req, res) => {
  const rawKey = String(req.params.key || '');
  const keyEntry = (db.apiKeys || []).find(k => k.key === rawKey);
  if (!keyEntry) return res.status(404).type('application/javascript').send('console.error("[RebootEmailSystem] invalid or revoked API key");');
  const owner = keyEntry.username;
  const cfg = db.emailConfigs && db.emailConfigs[owner];
  const isConnected = cfg && cfg.apiKeyId === keyEntry.id;
  res.type('application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`(function(){
  var API_KEY = ${JSON.stringify(rawKey)};
  var ENDPOINT = ${JSON.stringify(SITE_ORIGIN)} + "/api/v1/email-system/send";
  var CONNECTED = ${isConnected ? 'true' : 'false'};
  function send(payload){
    if(!CONNECTED){
      return Promise.resolve({ success: false, message: "This API key is not connected to the email system." });
    }
    payload = payload || {};
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": API_KEY },
      body: JSON.stringify({ to: payload.to, name: payload.name, subject: payload.subject, message: payload.message })
    }).then(function(r){ return r.json(); });
  }
  window.RebootEmailSystem = { send: send, connected: CONNECTED };
})();`);
});

function detectDeviceFromUA(uaRaw, hints) {
  const ua = (uaRaw || '').toLowerCase();
  hints = hints || {};
  let type = 'desktop';
  let os = 'unknown';
  let browser = 'unknown';

  if (/ipad/.test(ua) || (/macintosh/.test(ua) && hints.touch)) type = 'tablet';
  else if (/tablet|kindle|silk|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) type = 'tablet';
  else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/.test(ua)) type = 'mobile';
  else if (/smart-tv|smarttv|googletv|appletv|hbbtv|netcast|viera|tizen.*tv|web0s/.test(ua)) type = 'tv';
  else if (/xbox|playstation|nintendo/.test(ua)) type = 'console';
  else if (/bot|crawl|spider|slurp|bingpreview/.test(ua)) type = 'bot';
  else type = 'desktop';

  if (typeof hints.maxTouchPoints === 'number' && hints.maxTouchPoints > 0 && typeof hints.screenWidth === 'number') {
    if (hints.screenWidth < 640 && type === 'desktop') type = 'mobile';
    else if (hints.screenWidth < 1100 && type === 'desktop') type = 'tablet';
  }

  if (/windows nt/.test(ua)) os = 'windows';
  else if (/mac os x|macintosh/.test(ua)) os = 'macos';
  else if (/android/.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
  else if (/cros/.test(ua)) os = 'chromeos';
  else if (/linux/.test(ua)) os = 'linux';

  if (/edg\//.test(ua)) browser = 'edge';
  else if (/opr\/|opera/.test(ua)) browser = 'opera';
  else if (/chrome\//.test(ua)) browser = 'chrome';
  else if (/crios/.test(ua)) browser = 'chrome';
  else if (/fxios|firefox/.test(ua)) browser = 'firefox';
  else if (/safari/.test(ua)) browser = 'safari';

  return { type, os, browser };
}

app.get('/api/v1/device', (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const hints = {
    touch: req.query.touch === '1',
    maxTouchPoints: req.query.mtp ? parseInt(req.query.mtp, 10) : 0,
    screenWidth: req.query.w ? parseInt(req.query.w, 10) : 0
  };
  const info = detectDeviceFromUA(req.headers['user-agent'] || '', hints);
  res.json({ success: true, type: info.type, os: info.os, browser: info.browser });
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

const mcClientProcs = {};

const MC_PORT_MIN = parseInt(process.env.MC_PORT_MIN, 10) || 25565;
const MC_PORT_MAX = parseInt(process.env.MC_PORT_MAX, 10) || 25864;
function usedMcPorts() {
  const used = new Set();
  (db.users || []).forEach(u => (u.projects || []).forEach(p => { if (p.type === 'minecraft' && p.port) used.add(p.port); }));
  (db.mcClientServers || []).forEach(s => { if (s.port) used.add(s.port); });
  return used;
}
function assignMcClientPort() {
  const used = usedMcPorts();
  for (let port = MC_PORT_MIN; port <= MC_PORT_MAX; port++) {
    if (!used.has(port)) return port;
  }
  return null;
}

async function launchMcClientServer(server) {
  const sDir = path.join(PROJECTS_DIR, 'mc-client', server.id);
  if (!fs.existsSync(sDir)) fs.mkdirSync(sDir, { recursive: true });

  const javaCmd = await ensureJava();

  let bindIp = '0.0.0.0';
  if (server.ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(server.ip)) bindIp = server.ip;
  fs.writeFileSync(path.join(sDir, 'eula.txt'), 'eula=true\n');
  fs.writeFileSync(path.join(sDir, 'server.properties'), `server-port=${server.port}\nserver-ip=${bindIp}\nonline-mode=false\nmotd=Hosted by Reboot Cord\n`);

  const jarPath = path.join(sDir, 'server.jar');
  if (!fs.existsSync(jarPath)) {
    try {
      if (server.serverType === 'Paper') {
        const apiBase = 'https://api.papermc.io/v2/projects/paper';
        const verRes = await axios.get(apiBase + '/versions/' + server.version);
        const builds = verRes.data.builds;
        const latestBuild = builds[builds.length - 1];
        const dlUrl = apiBase + '/versions/' + server.version + '/builds/' + latestBuild + '/downloads/paper-' + server.version + '-' + latestBuild + '.jar';
        await execAsync('curl -L -o server.jar "' + dlUrl + '"', { cwd: sDir, shell: true });
      } else {
        const man = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        const verEntry = man.data.versions.find(v => v.id === server.version);
        if (verEntry) {
          const vinfo = await axios.get(verEntry.url);
          const serverUrl = vinfo.data.downloads.server.url;
          await execAsync('curl -L -o server.jar "' + serverUrl + '"', { cwd: sDir, shell: true });
        }
      }
    } catch (e) {
      server.status = 'failed';
      server.error = 'Failed to download server: ' + e.message;
      saveDB();
      return;
    }
  }
  if (!fs.existsSync(jarPath)) {
    server.status = 'failed';
    server.error = 'Unsupported version or server type.';
    saveDB();
    return;
  }

  const startedAt = Date.now();
  const proc = cp.spawn(javaCmd, ['-Xms512M', '-Xmx1024M', '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200', '-XX:+UnlockExperimentalVMOptions', '-jar', 'server.jar', 'nogui'], { cwd: sDir, shell: true, detached: true });
  mcClientProcs[server.id] = proc;
  server.status = 'running';
  server.error = null;
  saveDB();
  noteStableRun(server.id, startedAt);

  proc.on('error', (err) => {
    server.status = 'failed';
    server.error = err.message;
    saveDB();
  });

  proc.on('close', () => {
    if (mcClientProcs[server.id] === proc) delete mcClientProcs[server.id];
    const current = (db.mcClientServers || []).find(s => s.id === server.id);
    if (current && current.status !== 'stopped') {
      const delay = nextRestartDelay(server.id);
      if (delay === -1) {
        current.status = 'crashed';
        current.error = 'Crashed repeatedly, auto-restart paused.';
        saveDB();
        return;
      }
      current.status = 'restarting';
      saveDB();
      setTimeout(() => launchMcClientServer(current), delay);
    }
  });
}

const MC_VERSION_RE = /^(1\.\d+(\.\d+)?|\d{2}\.\d+(\.\d+)?)$/;

app.post('/api/minecraft/ping', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false, message: 'Not logged in.' });
  const { version, serverType } = req.body || {};
  if (!version || !MC_VERSION_RE.test(version)) return res.json({ success: false, message: 'Enter a valid Minecraft version.' });
  const allowedTypes = ['Vanilla', 'Paper', 'Fabric', 'Forge', 'Bukkit'];
  const type = allowedTypes.includes(serverType) ? serverType : 'Vanilla';
  broadcastEvent(u, { event: 'mcPing', version, serverType: type });
  res.json({ success: true });
});

app.post('/api/minecraft/create', async (req, res) => {
  const { version, ip, serverType } = req.body || {};
  if (!version || !MC_VERSION_RE.test(version)) return res.json({ success: false, message: 'Enter a valid Minecraft version.' });
  const port = assignMcClientPort();
  if (!port) return res.json({ success: false, message: 'No hosting slots available right now, try again later.' });
  const id = 'mc-' + crypto.randomBytes(8).toString('hex');
  const server = {
    id,
    version,
    ip: ip || '',
    serverType: serverType || 'Vanilla',
    port,
    status: 'starting',
    error: null,
    createdAt: Date.now(),
    hosting: '24/7-cloud'
  };
  db.mcClientServers = db.mcClientServers || [];
  db.mcClientServers.push(server);
  saveDB();
  res.json({ success: true, serverId: id, port: server.port, message: 'Server is starting and will stay online 24/7.' });
  launchMcClientServer(server);
});

app.get('/api/minecraft/status/:serverId', (req, res) => {
  const server = (db.mcClientServers || []).find(s => s.id === req.params.serverId);
  if (!server) return res.json({ success: false, message: 'Server not found' });
  res.json({ success: true, status: server.status, config: server });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    users: [],
    inviteCodes: {},
    adminApiKeys: [],
    messages: [],
    projects: [],
    shared: []
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

if (process.env.KEEPALIVE_URL) {
  setInterval(() => {
    axios.get(process.env.KEEPALIVE_URL).catch(() => {});
  }, 4 * 60 * 1000);
}

const PORT = process.env.PORT || 1000;
server.listen(PORT, () => {
  console.log('Reboot Cord running on port ' + PORT);
  const isRender = !!process.env.RENDER;
  console.log('PrysmisAI model: ' + OLLAMA_VISION_MODEL + (isRender ? ' (Render deployment - set GEMINI_API_KEY for cloud AI or OLLAMA_BASE_URL for remote Ollama)' : ' (local default port 1000)'));

  (db.users || []).forEach(owner => {
    (owner.projects || []).forEach(p => {
      if (p.type === 'minecraft' && p.running) {
        const members = [owner.username];
        (p.shared || []).forEach(s => { if (!members.includes(s.username)) members.push(s.username); });
        console.log('[Boot] Resuming minecraft server: ' + p.name);
        launchMinecraftProject(p, members).catch(e => console.error('[Boot] Failed to resume ' + p.name + ': ' + e.message));
      }
    });
  });

  (db.mcClientServers || []).forEach(s => {
    if (s.status === 'running' || s.status === 'starting' || s.status === 'restarting') {
      console.log('[Boot] Resuming client-hosted minecraft server: ' + s.id);
      launchMcClientServer(s);
    }
  });
});

