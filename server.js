const express = require('express');
const http = require('http');
const net = require('net');
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
const { pipeline } = require('stream/promises');

const execAsync = util.promisify(cp.exec);
const IS_WIN = process.platform === 'win32';
const MC_PROXY_PORT = parseInt(process.env.MC_PROXY_PORT || '25565', 10);
const startingLocks = {};
const installLocks = {};

process.on('uncaughtException', (err) => {
  try { console.error('uncaughtException', err && err.message ? err.message : err); } catch (e) {}
});
process.on('unhandledRejection', (err) => {
  try { console.error('unhandledRejection', err && err.message ? err.message : err); } catch (e) {}
});

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

app.set('trust proxy', 1);

const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => {
    const p = req.path || '';
    return /\/(start|stop|kill|dir|file|detect-deps|backup|command)$/.test(p) || p.includes('/start') || p.includes('/stop') || p.includes('/kill');
  }
});
app.use('/api/', limiter);

const authLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});
app.use('/login', authLimiter);
app.use('/register', authLimiter);

const apiLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many API requests, please try again later.' }
});
app.use('/api/createcode', apiLimiter);

const DB_FILE = path.join(__dirname, 'db.json');
const PROJECTS_DIR = path.join(__dirname, 'projects_data');
const SECRET = process.env.SESSION_SECRET || 'rebootcord-secret-key';

if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

function loadDB() {
  try { if (fs.existsSync(DB_FILE)) { const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); if(!d.changelogs) d.changelogs=[]; if(!d.apiKeys) d.apiKeys=[]; if(!d.feedbacks) d.feedbacks=[]; if(!d.feedbackChats) d.feedbackChats={}; if(!d.mcPorts || d.mcPorts === MC_PROXY_PORT) d.mcPorts = MC_PROXY_PORT + 1; return d; } } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [], mcPorts: MC_PROXY_PORT + 1, changelogs: [], apiKeys: [], feedbacks: [], feedbackChats: {} };
}

function collectUsedMcPorts() {
  const used = new Set([MC_PROXY_PORT]);
  for (const user of db.users || []) {
    for (const p of user.projects || []) {
      if (p.type === 'minecraft' && p.port) used.add(Number(p.port));
    }
  }
  return used;
}

function allocateMcPort(preferred) {
  const used = collectUsedMcPorts();
  let port = Number(preferred) || 0;
  if (port && !used.has(port) && port !== MC_PROXY_PORT && port > 1024 && port < 65535) return port;
  db.mcPorts = db.mcPorts || (MC_PROXY_PORT + 1);
  if (db.mcPorts === MC_PROXY_PORT) db.mcPorts++;
  while (used.has(db.mcPorts) || db.mcPorts === MC_PROXY_PORT || db.mcPorts < 1024) {
    db.mcPorts++;
    if (db.mcPorts > 65000) db.mcPorts = MC_PROXY_PORT + 1;
  }
  port = db.mcPorts++;
  return port;
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
          const name = line.split(/[=<>!~\[; ]/)[0].trim();
          if (name) set.add(name);
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

function sanitizePkgName(name) {
  const v = String(name || '').trim();
  if (!/^[a-zA-Z0-9_.\-\[\]@/]+$/.test(v)) return null;
  if (v.length > 100) return null;
  return v;
}

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

function isValidUsername(username) {
  return typeof username === 'string' && username.length >= 2 && username.length <= 32 && /^[a-zA-Z0-9_]+$/.test(username);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>\"'&]/g, '');
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(parts[0]).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[1] || '');
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch (e) {
    return null;
  }
  try { return JSON.parse(Buffer.from(parts[0], 'base64').toString()).u; } catch (e) { return null; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDomain(d) {
  return String(d || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

function isValidDomain(d) {
  const v = normalizeDomain(d);
  if (!v || v.length > 253) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return true;
  return /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v);
}

function findProjectByDomain(host) {
  const h = normalizeDomain(host);
  if (!h) return null;
  for (const user of db.users || []) {
    for (const p of user.projects || []) {
      if (p.type !== 'minecraft') continue;
      const domains = [p.ip, p.customDomain, p.domain].filter(Boolean).map(normalizeDomain);
      if (domains.includes(h)) return { username: user.username, user, p };
    }
  }
  return null;
}

function killProcessTree(proc) {
  if (!proc) return;
  const pid = proc.pid;
  try {
    if (IS_WIN && pid) {
      try { cp.execSync('taskkill /pid ' + pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); } catch (e) {}
    } else if (pid) {
      try { process.kill(-pid, 'SIGKILL'); } catch (e) {
        try { process.kill(pid, 'SIGKILL'); } catch (e2) {}
      }
    }
  } catch (e) {}
  try { proc.kill('SIGKILL'); } catch (e) {}
}

async function downloadFile(url, dest, onProgress) {
  const tmp = dest + '.part';
  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e) {}
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 15 * 60 * 1000,
    maxRedirects: 10,
    headers: { 'User-Agent': 'RebootCord-Host/2.0', Accept: '*/*' },
    validateStatus: (s) => s >= 200 && s < 400
  });
  const total = parseInt(response.headers['content-length'] || '0', 10);
  let done = 0;
  let lastPct = -1;
  response.data.on('data', (chunk) => {
    done += chunk.length;
    if (total > 0 && typeof onProgress === 'function') {
      const pct = Math.floor((done / total) * 100);
      if (pct >= lastPct + 5 || pct === 100) {
        lastPct = pct;
        onProgress(pct, done, total);
      }
    }
  });
  await pipeline(response.data, fs.createWriteStream(tmp));
  const st = fs.statSync(tmp);
  if (!st.size || st.size < 1024) {
    try { fs.unlinkSync(tmp); } catch (e) {}
    throw new Error('Downloaded file is empty or invalid');
  }
  try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch (e) {}
  fs.renameSync(tmp, dest);
  return st.size;
}

function needsModernJava(version) {
  const v = String(version || '');
  if (/^\d{2}(\.|$)/.test(v)) return 25;
  const m = v.match(/^1\.(\d+)/);
  if (m && parseInt(m[1], 10) >= 21) return 21;
  if (m && parseInt(m[1], 10) >= 17) return 17;
  return 8;
}

function findJavaBinary(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return null;
  const direct = path.join(rootDir, 'bin', IS_WIN ? 'java.exe' : 'java');
  if (fs.existsSync(direct)) return direct;
  const walk = (dir, depth) => {
    if (depth > 6) return null;
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
    for (const ent of ents) {
      if (!ent.isDirectory()) continue;
      const full = path.join(dir, ent.name);
      if (ent.name === 'bin') {
        const j = path.join(full, IS_WIN ? 'java.exe' : 'java');
        if (fs.existsSync(j)) return j;
      }
      const found = walk(full, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(rootDir, 0);
}

async function ensureJava(u, pId, version) {
  const minMajor = needsModernJava(version);
  const tryCmds = IS_WIN ? ['java', 'java.exe'] : ['java'];
  for (const cmd of tryCmds) {
    try {
      const { stderr, stdout } = await execAsync(cmd + ' -version', { shell: true, timeout: 15000 });
      const out = (stderr || '') + (stdout || '');
      const m = out.match(/version\s+"?(\d+)/i);
      const major = m ? parseInt(m[1], 10) : 0;
      if (major >= minMajor || (major === 1 && out.includes('1.8') && minMajor <= 8)) return cmd;
      if (major > 0 && major < minMajor) continue;
      if (out) return cmd;
    } catch (e) {}
  }
  const jreDir = path.join(PROJECTS_DIR, 'jre' + minMajor);
  const existing = findJavaBinary(jreDir);
  if (existing) return existing;
  broadcastLog(u, pId, '[System] Java ' + minMajor + '+ not found. Downloading portable JRE...', 'sys');
  const urls = IS_WIN
    ? {
        25: 'https://api.adoptium.net/v3/binary/latest/25/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk',
        21: 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk',
        17: 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk'
      }
    : {
        25: 'https://api.adoptium.net/v3/binary/latest/25/ga/linux/x64/jre/hotspot/normal/eclipse?project=jdk',
        21: 'https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse?project=jdk',
        17: 'https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jre/hotspot/normal/eclipse?project=jdk'
      };
  const url = urls[minMajor] || urls[21];
  const archive = path.join(PROJECTS_DIR, 'jre-download' + (IS_WIN ? '.zip' : '.tar.gz'));
  await downloadFile(url, archive, (pct) => {
    if (pct % 20 === 0) broadcastLog(u, pId, '[System] JRE download ' + pct + '%', 'sys');
  });
  if (fs.existsSync(jreDir)) fs.rmSync(jreDir, { recursive: true, force: true });
  fs.mkdirSync(jreDir, { recursive: true });
  if (IS_WIN) {
    await execAsync('powershell -NoProfile -Command "Expand-Archive -Path \'' + archive.replace(/'/g, "''") + '\' -DestinationPath \'' + jreDir.replace(/'/g, "''") + '\' -Force"', { timeout: 300000, shell: true });
    try { fs.unlinkSync(archive); } catch (e) {}
    const found = findJavaBinary(jreDir);
    if (found) return found;
  } else {
    await execAsync('tar -xzf "' + archive + '" -C "' + jreDir + '" --strip-components=1', { timeout: 300000, shell: true });
    try { fs.unlinkSync(archive); } catch (e) {}
    const found = findJavaBinary(jreDir);
    if (found) return found;
  }
  throw new Error('Failed to install portable Java ' + minMajor);
}

async function resolveServerJarUrl(serverType, version) {
  const type = String(serverType || 'Vanilla').toLowerCase();
  const ver = String(version || '1.21.5');
  const headers = { 'User-Agent': 'RebootCord-Host/2.0', Accept: 'application/json' };

  if (type === 'paper' || type === 'spigot') {
    try {
      const builds = await axios.get('https://fill.papermc.io/v3/projects/paper/versions/' + encodeURIComponent(ver) + '/builds', { headers, timeout: 30000 });
      const list = Array.isArray(builds.data) ? builds.data : [];
      if (!list.length) throw new Error('No Paper builds for ' + ver);
      const url = list[0].downloads && list[0].downloads['server:default'] && list[0].downloads['server:default'].url;
      if (!url) throw new Error('Paper download URL missing');
      return { url, label: type === 'spigot' ? 'Paper (Spigot-compatible)' : 'Paper', jarName: 'server.jar' };
    } catch (e) {
      if (type === 'spigot') {
        const gb = 'https://download.getbukkit.org/spigot/spigot-' + ver + '.jar';
        return { url: gb, label: 'Spigot', jarName: 'server.jar' };
      }
      throw e;
    }
  }

  if (type === 'purpur') {
    const meta = await axios.get('https://api.purpurmc.org/v2/purpur/' + encodeURIComponent(ver), { headers, timeout: 30000 });
    const latest = meta.data && meta.data.builds && meta.data.builds.latest;
    if (!latest) throw new Error('No Purpur build for ' + ver);
    return {
      url: 'https://api.purpurmc.org/v2/purpur/' + encodeURIComponent(ver) + '/' + latest + '/download',
      label: 'Purpur',
      jarName: 'server.jar'
    };
  }

  if (type === 'fabric') {
    const loaders = await axios.get('https://meta.fabricmc.net/v2/versions/loader/' + encodeURIComponent(ver), { headers, timeout: 30000 });
    const list = Array.isArray(loaders.data) ? loaders.data : [];
    const loader = (list.find((x) => x.loader && x.loader.stable) || list[0] || {}).loader;
    if (!loader || !loader.version) throw new Error('No Fabric loader for ' + ver);
    const installers = await axios.get('https://meta.fabricmc.net/v2/versions/installer', { headers, timeout: 30000 });
    const instList = Array.isArray(installers.data) ? installers.data : [];
    const installer = instList.find((x) => x.stable) || instList[0];
    if (!installer) throw new Error('No Fabric installer');
    return {
      url: 'https://meta.fabricmc.net/v2/versions/loader/' + encodeURIComponent(ver) + '/' + loader.version + '/' + installer.version + '/server/jar',
      label: 'Fabric',
      jarName: 'server.jar'
    };
  }

  if (type === 'forge') {
    const metaXml = await axios.get('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml', { headers, timeout: 30000, responseType: 'text' });
    const versions = String(metaXml.data || '').match(/<version>([^<]+)<\/version>/g) || [];
    const ids = versions.map((v) => v.replace(/<\/?version>/g, ''));
    const match = ids.filter((id) => id.startsWith(ver + '-')).pop() || ids.filter((id) => id.startsWith(ver)).pop();
    if (!match) throw new Error('No Forge build for ' + ver);
    return {
      url: 'https://maven.minecraftforge.net/net/minecraftforge/forge/' + match + '/forge-' + match + '-installer.jar',
      label: 'Forge',
      jarName: 'forge-installer.jar',
      forgeVersion: match,
      isInstaller: true
    };
  }

  const man = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', { headers, timeout: 30000 });
  const verEntry = (man.data.versions || []).find((v) => v.id === ver);
  if (!verEntry) throw new Error('Vanilla version not found: ' + ver);
  const vinfo = await axios.get(verEntry.url, { headers, timeout: 30000 });
  const serverUrl = vinfo.data && vinfo.data.downloads && vinfo.data.downloads.server && vinfo.data.downloads.server.url;
  if (!serverUrl) throw new Error('Vanilla server jar URL missing for ' + ver);
  return { url: serverUrl, label: 'Vanilla', jarName: 'server.jar' };
}

async function ensureMcServerJar(u, p, pDir) {
  const jarPath = path.join(pDir, 'server.jar');
  const marker = path.join(pDir, '.rc-server-meta.json');
  const metaWant = { type: p.serverType || 'Vanilla', version: p.version || '1.21.5' };
  let metaHave = null;
  try { if (fs.existsSync(marker)) metaHave = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch (e) {}
  const jarOk = fs.existsSync(jarPath) && fs.statSync(jarPath).size > 10000;
  if (jarOk && metaHave && metaHave.type === metaWant.type && metaHave.version === metaWant.version) {
    return jarPath;
  }
  if (jarOk && !metaHave) {
    fs.writeFileSync(marker, JSON.stringify(metaWant));
    return jarPath;
  }

  broadcastLog(u, p.id, '[System] Resolving ' + metaWant.type + ' ' + metaWant.version + ' download...', 'sys');
  const info = await resolveServerJarUrl(metaWant.type, metaWant.version);
  broadcastLog(u, p.id, '[System] Downloading ' + info.label + ' ' + metaWant.version + '...', 'sys');

  if (info.isInstaller) {
    const installerPath = path.join(pDir, 'forge-installer.jar');
    await downloadFile(info.url, installerPath, (pct) => {
      if (pct % 10 === 0) broadcastLog(u, p.id, '[System] Download ' + pct + '%', 'sys');
    });
    const javaCmd = await ensureJava(u, p.id, metaWant.version);
    broadcastLog(u, p.id, '[System] Installing Forge server libraries...', 'sys');
    await execAsync('"' + javaCmd + '" -jar forge-installer.jar --installServer', { cwd: pDir, shell: true, timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });
    const candidates = fs.readdirSync(pDir).filter((n) => /forge/i.test(n) && n.endsWith('.jar') && !n.includes('installer'));
    let runJar = candidates.sort((a, b) => fs.statSync(path.join(pDir, b)).size - fs.statSync(path.join(pDir, a)).size)[0];
    if (!runJar) {
      const walkArgs = (dir, base) => {
        let found = null;
        let ents = [];
        try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
        for (const ent of ents) {
          const rel = base ? base + '/' + ent.name : ent.name;
          if (ent.isDirectory()) {
            found = walkArgs(path.join(dir, ent.name), rel);
            if (found) return found;
          } else if (ent.name === 'unix_args.txt' || ent.name === 'win_args.txt') {
            if (IS_WIN && ent.name === 'win_args.txt') return rel;
            if (!IS_WIN && ent.name === 'unix_args.txt') return rel;
            found = found || rel;
          }
        }
        return found;
      };
      const unixArgs = walkArgs(pDir, '');
      if (unixArgs) {
        fs.writeFileSync(marker, JSON.stringify({ ...metaWant, forgeArgs: String(unixArgs).replace(/\\/g, '/') }));
        broadcastLog(u, p.id, '[System] Forge install complete.', 'ok');
        return path.join(pDir, 'server.jar');
      }
      throw new Error('Forge install finished but no server jar found');
    }
    fs.copyFileSync(path.join(pDir, runJar), jarPath);
    try { fs.unlinkSync(installerPath); } catch (e) {}
    fs.writeFileSync(marker, JSON.stringify(metaWant));
    broadcastLog(u, p.id, '[System] Forge install complete.', 'ok');
    return jarPath;
  }

  await downloadFile(info.url, jarPath, (pct) => {
    if (pct % 10 === 0) broadcastLog(u, p.id, '[System] Download ' + pct + '%', 'sys');
  });
  fs.writeFileSync(marker, JSON.stringify(metaWant));
  broadcastLog(u, p.id, '[System] Download complete (' + Math.round(fs.statSync(jarPath).size / 1024 / 1024) + ' MB).', 'ok');
  return jarPath;
}

function writeMcConfig(p, pDir) {
  if (!p.port || Number(p.port) === MC_PROXY_PORT) {
    p.port = allocateMcPort(p.port);
  }
  fs.writeFileSync(path.join(pDir, 'eula.txt'), 'eula=true\n');
  const domain = normalizeDomain(p.customDomain || p.ip || '');
  const propsPath = path.join(pDir, 'server.properties');
  let existing = {};
  if (fs.existsSync(propsPath)) {
    try {
      fs.readFileSync(propsPath, 'utf8').split(/\r?\n/).forEach((line) => {
        const i = line.indexOf('=');
        if (i > 0 && !line.trim().startsWith('#')) existing[line.slice(0, i).trim()] = line.slice(i + 1);
      });
    } catch (e) {}
  }
  existing['server-port'] = String(p.port);
  existing['server-ip'] = '0.0.0.0';
  existing['online-mode'] = 'false';
  existing['motd'] = String(p.name || existing.motd || 'Minecraft Server').replace(/[\r\n=]/g, ' ');
  existing['max-players'] = existing['max-players'] || '20';
  existing['spawn-protection'] = existing['spawn-protection'] || '0';
  existing['view-distance'] = existing['view-distance'] || '8';
  existing['simulation-distance'] = existing['simulation-distance'] || '6';
  existing['network-compression-threshold'] = existing['network-compression-threshold'] || '256';
  existing['enable-query'] = 'false';
  existing['enable-rcon'] = 'false';
  existing['pvp'] = existing['pvp'] || 'true';
  existing['difficulty'] = existing['difficulty'] || 'easy';
  existing['gamemode'] = existing['gamemode'] || 'survival';
  existing['white-list'] = existing['white-list'] || 'false';
  existing['enforce-whitelist'] = existing['enforce-whitelist'] || 'false';
  existing['prevent-proxy-connections'] = 'false';
  if (domain) existing['server-name'] = domain;
  const lines = Object.keys(existing).map((k) => k + '=' + existing[k]);
  fs.writeFileSync(propsPath, lines.join('\n') + '\n');
}

function procKey(id) {
  return String(id);
}

function attachProcLogs(u, p, proc) {
  const key = procKey(p.id);
  procs[key] = proc;
  proc.on('error', (err) => {
    broadcastLog(u, p.id, '[System] Process failed: ' + err.message, 'err');
    p.running = false;
    saveDB();
    if (procs[key] === proc) delete procs[key];
  });
  const onData = (buf, kind) => {
    String(buf).split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      let type = kind;
      if (p.type === 'minecraft') {
        type = 'server';
        if (line.includes('Preparing level')) broadcastLog(u, p.id, '[System] World created', 'ok');
        if (line.includes('Done (')) {
          const host = p.customDomain || p.ip || 'play.server.net';
          broadcastLog(u, p.id, '[System] your ' + host + ':' + p.port + ' has successfully started', 'ok');
        }
        if (/ERROR|Exception|FATAL/i.test(line)) type = 'err';
      } else {
        if (line.includes('INFO') || line.includes('discord.gateway') || line.includes('Logged in as') || line.includes('ready') || line.includes('Bot starting')) type = 'ok';
        else if (kind === 'stderr') type = 'err';
        const match = line.match(/ModuleNotFoundError: No module named '([^']+)'/);
        if (match && match[1]) broadcastLog(u, p.id, 'Missing package: ' + match[1], 'err');
        const nm = line.match(/Cannot find module '([^']+)'/);
        if (nm && nm[1]) broadcastLog(u, p.id, 'Missing package: ' + nm[1], 'err');
      }
      broadcastLog(u, p.id, line.trim(), type);
    });
  };
  if (proc.stdout) proc.stdout.on('data', (d) => onData(d, 'info'));
  if (proc.stderr) proc.stderr.on('data', (d) => onData(d, 'stderr'));
  proc.on('close', (code) => {
    if (procs[key] === proc) delete procs[key];
    p.running = false;
    saveDB();
    broadcastLog(u, p.id, '[System] Process exited' + (code != null ? ' (' + code + ')' : '') + '.', 'sys');
    broadcastEvent(u, { event: 'status', projectId: p.id, running: false });
  });
}

async function stopProjectProcess(u, p, force) {
  const key = procKey(p.id);
  const proc = procs[key];
  if (!proc) {
    p.running = false;
    saveDB();
    return true;
  }
  try {
    if (!force && p.type === 'minecraft' && proc.stdin && !proc.stdin.destroyed) {
      try { proc.stdin.write('stop\n'); } catch (e) {}
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        if (!procs[key]) break;
      }
    } else if (!force && p.type === 'discord') {
      try {
        if (proc.stdin && !proc.stdin.destroyed) proc.stdin.end();
      } catch (e) {}
      try { proc.kill(IS_WIN ? undefined : 'SIGTERM'); } catch (e) {}
      for (let i = 0; i < 20; i++) {
        await sleep(200);
        if (!procs[key]) break;
      }
    }
  } catch (e) {}
  if (procs[key]) {
    killProcessTree(procs[key]);
    delete procs[key];
  }
  p.running = false;
  saveDB();
  return true;
}

function resolveBotCommand(p, pDir) {
  const lang = p.lang || 'JavaScript';
  let mainFile = Object.keys(p.files || {})[0] || (lang === 'Python' ? 'main.py' : 'index.js');
  const preferred = lang === 'Python' ? ['main.py', 'bot.py', 'app.py'] : ['index.js', 'bot.js', 'main.js', 'src/index.js'];
  for (const f of preferred) {
    if (fs.existsSync(path.join(pDir, f))) { mainFile = f; break; }
  }
  if (lang === 'Python') {
    const py = IS_WIN ? 'python' : 'python3';
    return { cmd: py, args: ['-u', mainFile], envExtra: { PYTHONPATH: path.join(pDir, 'modules') + (IS_WIN ? ';' : ':') + (process.env.PYTHONPATH || '') } };
  }
  if (lang === 'TypeScript') {
    const tsEntry = fs.existsSync(path.join(pDir, 'index.ts')) ? 'index.ts' : mainFile.endsWith('.ts') ? mainFile : 'index.js';
    if (fs.existsSync(path.join(pDir, 'node_modules', 'ts-node'))) {
      return { cmd: 'npx', args: ['ts-node', tsEntry], envExtra: {} };
    }
    return { cmd: 'node', args: [mainFile.endsWith('.js') ? mainFile : 'index.js'], envExtra: {} };
  }
  return { cmd: 'node', args: [mainFile], envExtra: { NODE_PATH: path.join(pDir, 'node_modules') } };
}

function readVarInt(buf, offset) {
  let num = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const b = buf[pos++];
    num |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value: num, size: pos - offset };
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

function parseMcHandshakeHost(buffer) {
  try {
    let offset = 0;
    const packetLen = readVarInt(buffer, offset);
    if (!packetLen) return null;
    offset += packetLen.size;
    const packetId = readVarInt(buffer, offset);
    if (!packetId || packetId.value !== 0) return null;
    offset += packetId.size;
    const proto = readVarInt(buffer, offset);
    if (!proto) return null;
    offset += proto.size;
    const strLen = readVarInt(buffer, offset);
    if (!strLen) return null;
    offset += strLen.size;
    if (offset + strLen.value > buffer.length) return null;
    const address = buffer.slice(offset, offset + strLen.value).toString('utf8');
    return normalizeDomain(address.split('\0')[0]);
  } catch (e) {
    return null;
  }
}

function startMcDomainProxy() {
  const proxy = net.createServer((client) => {
    let buffered = Buffer.alloc(0);
    let handed = false;
    const onData = (chunk) => {
      if (handed) return;
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.length < 3) return;
      const host = parseMcHandshakeHost(buffered);
      if (!host && buffered.length < 1024) return;
      handed = true;
      client.removeListener('data', onData);
      const mapped = host ? findProjectByDomain(host) : null;
      const targetPort = mapped && mapped.p && mapped.p.running ? mapped.p.port : null;
      if (!targetPort) {
        try { client.destroy(); } catch (e) {}
        return;
      }
      const upstream = net.connect({ host: '127.0.0.1', port: targetPort }, () => {
        upstream.write(buffered);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on('error', () => { try { client.destroy(); } catch (e) {} });
      client.on('error', () => { try { upstream.destroy(); } catch (e) {} });
      client.on('close', () => { try { upstream.destroy(); } catch (e) {} });
    };
    client.on('data', onData);
    client.on('error', () => {});
    client.setTimeout(15000, () => { try { client.destroy(); } catch (e) {} });
  });
  proxy.on('error', (err) => {
    console.error('MC domain proxy bind failed:', err.message);
  });
  proxy.listen(MC_PROXY_PORT, '0.0.0.0', () => {
    console.log('Minecraft custom-domain proxy listening on ' + MC_PROXY_PORT);
  });
}

async function installPythonPackages(pDir, pkgs, broadcast) {
  try {
    const modulesDir = path.join(pDir, 'modules');
    if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });
    const req = path.join(pDir, 'requirements.txt');
    let cur = fs.existsSync(req) ? fs.readFileSync(req, 'utf8') : '';
    const set = new Set(cur.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    pkgs.forEach((pk) => set.add(pk));
    fs.writeFileSync(req, Array.from(set).join('\n') + (set.size ? '\n' : ''));
    const py = IS_WIN ? 'python' : 'python3';
    const pipCmds = [
      py + ' -m pip install --disable-pip-version-check --no-input --no-cache-dir --prefer-binary -r requirements.txt --target ./modules',
      'pip install --disable-pip-version-check --no-input --no-cache-dir --prefer-binary -r requirements.txt --target ./modules',
      'pip3 install --disable-pip-version-check --no-input --no-cache-dir --prefer-binary -r requirements.txt --target ./modules'
    ];
    let lastErr = null;
    for (const cmd of pipCmds) {
      try {
        if (broadcast) broadcast('[PKG] Running ' + cmd + '...');
        await execAsync(cmd, { cwd: pDir, shell: true, timeout: 15 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 });
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('pip install failed');
  } catch (e) {
    throw e;
  }
}

async function installNodePackages(pDir, pkgs, broadcast) {
  try {
    const pj = path.join(pDir, 'package.json');
    let obj = { name: 'bot', version: '1.0.0', private: true, dependencies: {} };
    if (fs.existsSync(pj)) {
      try { obj = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch (e) {}
    }
    obj.dependencies = obj.dependencies || {};
    pkgs.forEach((pk) => { if (!obj.dependencies[pk]) obj.dependencies[pk] = '*'; });
    fs.writeFileSync(pj, JSON.stringify(obj, null, 2));
    const cmds = [
      'npm install --no-audit --no-fund --prefer-offline',
      'npm install --no-audit --no-fund'
    ];
    let lastErr = null;
    for (const cmd of cmds) {
      try {
        if (broadcast) broadcast('[PKG] Running ' + cmd + '...');
        await execAsync(cmd, { cwd: pDir, shell: true, timeout: 15 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 });
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('npm install failed');
  } catch (e) {
    throw e;
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

function getUser(req) { const c = verifyToken(parseCookies(req)['rc_tok']); if (c) return c; const h = (req.headers['authorization'] || req.headers['Authorization'] || ''); if (h.startsWith('rc_live_')) { const hash = require('crypto').createHash('sha256').update(h).digest('hex'); const k = (db.apiKeys || []).find(x => x.keyHash === hash); if (k) return k.username; } return null; }

function setCookie(res, token) {
  const isSecure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', 'rc_tok=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800' + (isSecure ? '; Secure' : ''));
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
      if (data.event === 'cmd' && data.projectId && procs[procKey(data.projectId)]) {
        try {
          const proc = procs[procKey(data.projectId)];
          if (proc.stdin && !proc.stdin.destroyed) proc.stdin.write(String(data.cmd || '') + '\n');
        } catch (e) {}
      }
      if (data.event === 'install' && data.projectId) {
        try {
          const uObj = db.users.find(u => u.username === user);
          if (!uObj) return;
          const p = uObj.projects.find(x => String(x.id) === String(data.projectId));
          if (!p) return;
          const lockKey = String(p.id);
          if (installLocks[lockKey]) {
            broadcastLog(user, p.id, '[PKG] Install already in progress', 'warn');
            return;
          }
          const pkg = sanitizePkgName(data.pkg);
          if (!pkg) {
            broadcastLog(user, p.id, '[PKG] Invalid package name', 'err');
            broadcastEvent(user, { event: 'installDone', projectId: p.id, pkg: data.pkg, success: false });
            return;
          }
          const pDir = path.join(PROJECTS_DIR, String(p.id));
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          installLocks[lockKey] = true;
          (async () => {
            try {
              const log = (m) => broadcastLog(user, p.id, m, 'info');
              if (p.lang === 'Python') await installPythonPackages(pDir, [pkg], log);
              else await installNodePackages(pDir, [pkg], log);
              broadcastLog(user, p.id, '[PKG] Installed ' + pkg, 'ok');
              broadcastEvent(user, { event: 'installDone', projectId: p.id, pkg, success: true });
            } catch (err) {
              broadcastLog(user, p.id, '[PKG] Failed: ' + (err.message || err), 'err');
              broadcastEvent(user, { event: 'installDone', projectId: p.id, pkg, success: false });
            } finally {
              delete installLocks[lockKey];
            }
          })();
        } catch (e) {
          broadcastLog(user, data.projectId, '[PKG] Install failed: ' + (e.message || e), 'err');
        }
      }
      if (data.event === 'installAll' && data.projectId) {
        try {
          const uObj = db.users.find(u => u.username === user);
          if (!uObj) return;
          const p = uObj.projects.find(x => String(x.id) === String(data.projectId));
          if (!p) return;
          const lockKey = String(p.id);
          if (installLocks[lockKey]) {
            broadcastLog(user, p.id, '[PKG] Install already in progress', 'warn');
            return;
          }
          const pDir = path.join(PROJECTS_DIR, String(p.id));
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          installLocks[lockKey] = true;
          (async () => {
            try {
              let pkgs = Array.isArray(data.pkgs) ? data.pkgs : [];
              let scanned = [];
              try { scanned = scanProjectDeps(pDir, p.lang || 'Python'); } catch (e) {}
              const merged = new Set();
              pkgs.concat(scanned).forEach((pk) => {
                const safe = sanitizePkgName(pk);
                if (safe) merged.add(safe);
              });
              pkgs = Array.from(merged);
              broadcastLog(user, p.id, '[PKG] Detected ' + pkgs.length + ' dependenc' + (pkgs.length === 1 ? 'y' : 'ies') + (pkgs.length ? ': ' + pkgs.join(', ') : ''), 'info');
              if (!pkgs.length) {
                broadcastLog(user, p.id, '[PKG] No dependencies found to install', 'warn');
                broadcastEvent(user, { event: 'installAllDone', projectId: p.id, success: true, count: 0 });
                return;
              }
              const log = (m) => broadcastLog(user, p.id, m, 'info');
              if (p.lang === 'Python') await installPythonPackages(pDir, pkgs, log);
              else await installNodePackages(pDir, pkgs, log);
              broadcastLog(user, p.id, '[PKG] Installed all ' + pkgs.length + ' package' + (pkgs.length === 1 ? '' : 's') + ' successfully', 'ok');
              broadcastEvent(user, { event: 'installAllDone', projectId: p.id, success: true, count: pkgs.length });
            } catch (err) {
              broadcastLog(user, p.id, '[PKG] Failed: ' + (err.message || err), 'err');
              broadcastEvent(user, { event: 'installAllDone', projectId: p.id, success: false, count: 0 });
            } finally {
              delete installLocks[lockKey];
            }
          })();
        } catch (e) {
          broadcastLog(user, data.projectId, '[PKG] Install failed: ' + (e.message || e), 'err');
        }
      }
    } catch (e) {}
  });
  ws.on('close', () => wsClients.delete(ws));
});

app.use((req, res, next) => {
  const host = normalizeDomain((req.headers.host || '').split(':')[0]);
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.onrender.com') || host === 'rebootcord.world' || host.endsWith('.rebootcord.world') || host.endsWith('.rebootcord.io')) {
    return next();
  }
  if (req.path.startsWith('/api/') || req.path.startsWith('/sdk/') || req.path.startsWith('/ws')) return next();
  const mapped = findProjectByDomain(host);
  if (!mapped) return next();
  const p = mapped.p;
  const connectHost = p.customDomain || p.ip || host;
  const connectAddr = connectHost + (p.port && p.port !== 25565 ? ':' + p.port : '');
  res.status(200).type('html').send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    String(p.name || 'Minecraft Server').replace(/[<>&]/g, '') +
    '</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050e05;color:#cfe8cf;font-family:Segoe UI,system-ui,sans-serif} .card{background:#0b160b;border:1px solid #1c381c;border-radius:14px;padding:28px;max-width:480px;width:92%} h1{margin:0 0 8px;font-size:22px;color:#7dffa0} .muted{color:#7a947a;font-size:13px} .ip{margin-top:16px;padding:12px 14px;border-radius:10px;background:#091209;border:1px solid #1c381c;font-family:ui-monospace,Consolas,monospace;color:#9cffb5;font-size:15px;word-break:break-all} .badge{display:inline-block;margin-top:12px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:' +
    (p.running ? '#14351d' : '#351414') +
    ';color:' + (p.running ? '#7dffa0' : '#ff8e8e') +
    '}</style></head><body><div class="card"><h1>' +
    String(p.name || 'Minecraft Server').replace(/[<>&]/g, '') +
    '</h1><div class="muted">' +
    String(p.serverType || 'Vanilla') + ' ' + String(p.version || '') +
    '</div><div class="badge">' + (p.running ? 'ONLINE' : 'OFFLINE') +
    '</div><div class="muted" style="margin-top:16px">Connect in Minecraft Java with:</div><div class="ip">' +
    String(connectAddr).replace(/[<>&]/g, '') +
    '</div><div class="muted" style="margin-top:12px">Powered by RebootCord domain hosting</div></div></body></html>'
  );
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
  const projects = ((user && user.projects) || []).map((p) => {
    const live = !!procs[procKey(p.id)];
    if (p.running !== live && !startingLocks[procKey(p.id)]) p.running = live;
    return p;
  });
  res.json({ success: true, projects });
});

app.post('/api/projects', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const user = db.users.find(x => x.username === u);
  if (!user) return res.json({ success: false });
  user.projects = req.body.projects || [];
  db.mcPorts = db.mcPorts || (MC_PROXY_PORT + 1);
  user.projects.forEach(p => {
    if (p.type === 'minecraft') {
      if (!p.port || Number(p.port) === MC_PROXY_PORT) p.port = allocateMcPort(p.port);
      if (p.ip && !p.customDomain) p.customDomain = normalizeDomain(p.ip);
      if (p.customDomain) {
        p.customDomain = normalizeDomain(p.customDomain);
        p.domain = p.customDomain;
        p.ip = p.customDomain;
      }
    }
    if (typeof p.running === 'undefined') p.running = false;
    if (!startingLocks[procKey(p.id)]) p.running = !!procs[procKey(p.id)];
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
  try {
    const u = getUser(req);
    if (!u) return res.json({ success: false, packages: [] });
    const user = db.users.find(x => x.username === u);
    if (!user) return res.json({ success: false, packages: [] });
    const p = user.projects.find(x => String(x.id) === req.params.id);
    if (!p) return res.json({ success: false, packages: [] });
    const pDir = path.join(PROJECTS_DIR, String(p.id));
    let packages = [];
    if (fs.existsSync(pDir)) {
      try {
        packages = scanProjectDeps(pDir, p.lang || 'Python');
      } catch (e) {}
    }
    res.json({ success: true, packages });
  } catch (e) {
    res.json({ success: false, packages: [] });
  }
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
  try {
    const u = getUser(req);
    if (!u) return res.json({ success: false });
    const user = db.users.find(x => x.username === u);
    if (!user) return res.json({ success: false });
    const p = user.projects.find(x => String(x.id) === req.params.id);
    if (!p) return res.json({ success: false });
    if (!req.file) return res.json({ success: false });

    const pDir = path.join(PROJECTS_DIR, String(p.id));
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

    const relPath = (req.body && req.body.relPath) ? String(req.body.relPath).replace(/\\/g, '/') : req.file.originalname;
    const target = safeJoin(pDir, relPath);
    if (!target) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false }); }
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
      fs.renameSync(req.file.path, target);
      broadcastLog(u, p.id, '[System] Uploaded ' + relPath, 'info');
      res.json({ success: true });
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch(cleanupError) {}
      res.json({ success: false });
    }
  } catch (e) {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch(cleanupError) {}
    res.json({ success: false });
  }
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

app.get('/api/mc/versions', async (req, res) => {
  try {
    const man = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', {
      timeout: 20000,
      headers: { 'User-Agent': 'RebootCord-Host/2.0' }
    });
    const versions = (man.data.versions || []).filter((v) => v.type === 'release').map((v) => v.id);
    res.json({ success: true, latest: man.data.latest, versions });
  } catch (e) {
    res.json({
      success: true,
      versions: [
        '26.2', '26.1.2', '26.1.1', '26.1',
        '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
        '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
        '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
        '1.18.2', '1.18.1', '1.18', '1.17.1', '1.17',
        '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16',
        '1.15.2', '1.15.1', '1.15', '1.14.4', '1.14.3', '1.14.2', '1.14.1', '1.14',
        '1.13.2', '1.13.1', '1.13', '1.12.2', '1.12.1', '1.12', '1.8.9', '1.8.8', '1.7.10'
      ]
    });
  }
});

app.post('/api/projects/:id/domain', (req, res) => {
  try {
    const u = getUser(req);
    if (!u) return res.json({ success: false, message: 'Not logged in' });
    const user = db.users.find((x) => x.username === u);
    if (!user) return res.json({ success: false, message: 'User not found' });
    const p = (user.projects || []).find((x) => String(x.id) === String(req.params.id));
    if (!p || p.type !== 'minecraft') return res.json({ success: false, message: 'Minecraft project not found' });
    const domain = normalizeDomain(req.body && (req.body.domain || req.body.ip || req.body.customDomain));
    if (domain && !isValidDomain(domain)) return res.json({ success: false, message: 'Invalid domain' });
    if (domain) {
      const taken = findProjectByDomain(domain);
      if (taken && String(taken.p.id) !== String(p.id)) {
        return res.json({ success: false, message: 'Domain already assigned to another server' });
      }
    }
    p.customDomain = domain || '';
    p.ip = domain || p.ip || '';
    p.domain = domain || '';
    saveDB();
    res.json({
      success: true,
      domain: p.customDomain,
      port: p.port,
      connect: (p.customDomain || p.ip || 'play.server.net') + (p.port ? ':' + p.port : ''),
      proxyPort: MC_PROXY_PORT
    });
  } catch (e) {
    res.json({ success: false, message: e.message || 'Failed' });
  }
});

app.post('/api/projects/:id/start', async (req, res) => {
  let responded = false;
  const send = (body, code) => {
    if (responded) return;
    responded = true;
    try { res.status(code || 200).json(body); } catch (e) {}
  };
  try {
    const u = getUser(req);
    if (!u) return send({ success: false, message: 'Not logged in' });
    const user = db.users.find((x) => x.username === u);
    if (!user) return send({ success: false, message: 'User not found' });
    const p = (user.projects || []).find((x) => String(x.id) === String(req.params.id));
    if (!p) return send({ success: false, message: 'Project not found' });

    const lockKey = String(p.id);
    if (startingLocks[lockKey]) return send({ success: false, message: 'Already starting' });
    if (procs[procKey(p.id)] && !procs[procKey(p.id)].killed) {
      p.running = true;
      saveDB();
      return send({ success: true, alreadyRunning: true, port: p.port, ip: p.ip || p.customDomain });
    }

    const pDir = path.join(PROJECTS_DIR, String(p.id));
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });

    startingLocks[lockKey] = true;
    p.running = true;
    saveDB();
    send({
      success: true,
      starting: true,
      port: p.port,
      ip: p.customDomain || p.ip || null,
      proxyPort: MC_PROXY_PORT
    });

    (async () => {
      try {
        if (procs[procKey(p.id)]) {
          await stopProjectProcess(u, p, true);
          p.running = true;
          saveDB();
        }

        if (p.type === 'minecraft') {
          if (p.ip && isValidDomain(p.ip) && !p.customDomain) p.customDomain = normalizeDomain(p.ip);
          writeMcConfig(p, pDir);
          broadcastLog(u, p.id, '[System] Preparing ' + (p.serverType || 'Vanilla') + ' ' + (p.version || '') + '...', 'sys');
          const javaCmd = await ensureJava(u, p.id, p.version || '1.21.5');
          await ensureMcServerJar(u, p, pDir);
          const jarPath = path.join(pDir, 'server.jar');
          if (!fs.existsSync(jarPath) || fs.statSync(jarPath).size < 1000) {
            throw new Error('server.jar missing after download');
          }
          const marker = path.join(pDir, '.rc-server-meta.json');
          let forgeArgs = null;
          try {
            if (fs.existsSync(marker)) {
              const meta = JSON.parse(fs.readFileSync(marker, 'utf8'));
              forgeArgs = meta.forgeArgs || null;
            }
          } catch (e) {}
          let args;
          if (forgeArgs) {
            args = ['@user_jvm_args.txt', '@' + forgeArgs, 'nogui'];
            if (!fs.existsSync(path.join(pDir, 'user_jvm_args.txt'))) {
              fs.writeFileSync(path.join(pDir, 'user_jvm_args.txt'), '-Xmx1024M\n-Xms512M\n');
            }
          } else {
            args = ['-Xmx1024M', '-Xms512M', '-jar', 'server.jar', 'nogui'];
          }
          broadcastLog(u, p.id, '[System] Launching Minecraft server on port ' + p.port + '...', 'sys');
          const proc = cp.spawn(javaCmd, args, {
            cwd: pDir,
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
          });
          attachProcLogs(u, p, proc);
          broadcastEvent(u, { event: 'status', projectId: p.id, running: true });
        } else {
          if (p.files) {
            for (const fname of Object.keys(p.files)) {
              const filePath = path.join(pDir, fname);
              if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, p.files[fname]);
            }
          }
          try {
            const envP = path.join(pDir, '.env');
            let ec = fs.existsSync(envP) ? fs.readFileSync(envP, 'utf8') : '';
            if (p.botToken) {
              if (!/^BOT_TOKEN=/m.test(ec)) ec = (ec.trim() + '\nBOT_TOKEN=' + p.botToken).trim() + '\n';
              else ec = ec.replace(/^BOT_TOKEN=.*$/m, 'BOT_TOKEN=' + p.botToken);
              if (!/^TOKEN=/m.test(ec)) ec = ec.trim() + '\nTOKEN=' + p.botToken + '\n';
              fs.writeFileSync(envP, ec.trim() + '\n');
            }
          } catch (e) {}

          const bot = resolveBotCommand(p, pDir);
          const envVars = {
            ...process.env,
            BOT_TOKEN: p.botToken || process.env.BOT_TOKEN || '',
            TOKEN: p.botToken || process.env.TOKEN || '',
            DISCORD_TOKEN: p.botToken || process.env.DISCORD_TOKEN || '',
            ...bot.envExtra
          };
          broadcastLog(u, p.id, '[System] Starting Discord bot host (' + (p.lang || 'JavaScript') + ')...', 'sys');
          const mainPath = path.join(pDir, bot.args[bot.args.length - 1]);
          if (!fs.existsSync(mainPath) && bot.cmd !== 'npx') {
            throw new Error('Main bot file not found: ' + bot.args[bot.args.length - 1]);
          }
          const proc = cp.spawn(bot.cmd, bot.args, {
            cwd: pDir,
            env: envVars,
            shell: IS_WIN,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          attachProcLogs(u, p, proc);
          broadcastLog(u, p.id, '[System] Bot process is running. Host online.', 'ok');
          broadcastEvent(u, { event: 'status', projectId: p.id, running: true });
        }
      } catch (err) {
        p.running = false;
        saveDB();
        if (procs[procKey(p.id)]) {
          killProcessTree(procs[procKey(p.id)]);
          delete procs[procKey(p.id)];
        }
        broadcastLog(u, p.id, '[System] Start failed: ' + (err && err.message ? err.message : String(err)), 'err');
        broadcastEvent(u, { event: 'status', projectId: p.id, running: false });
      } finally {
        delete startingLocks[lockKey];
      }
    })();
  } catch (e) {
    send({ success: false, message: e.message || 'Start failed' });
  }
});

app.post('/api/projects/:id/stop', async (req, res) => {
  try {
    const u = getUser(req);
    if (!u) return res.json({ success: false, message: 'Not logged in' });
    const user = db.users.find((x) => x.username === u);
    if (!user) return res.json({ success: false, message: 'User not found' });
    const p = (user.projects || []).find((x) => String(x.id) === String(req.params.id));
    if (!p) return res.json({ success: false, message: 'Project not found' });
    res.json({ success: true, stopping: true });
    broadcastLog(u, p.id, '[System] Stopping process...', 'warn');
    await stopProjectProcess(u, p, false);
    broadcastLog(u, p.id, '[System] Process stopped.', 'warn');
    broadcastEvent(u, { event: 'status', projectId: p.id, running: false });
  } catch (e) {
    try { res.json({ success: false, message: e.message || 'Stop failed' }); } catch (err) {}
  }
});

app.post('/api/projects/:id/kill', async (req, res) => {
  try {
    const u = getUser(req);
    if (!u) return res.json({ success: false, message: 'Not logged in' });
    const user = db.users.find((x) => x.username === u);
    if (!user) return res.json({ success: false, message: 'User not found' });
    const p = (user.projects || []).find((x) => String(x.id) === String(req.params.id));
    if (!p) return res.json({ success: false, message: 'Project not found' });
    res.json({ success: true, killing: true });
    await stopProjectProcess(u, p, true);
    broadcastLog(u, p.id, '[System] Process forcefully killed.', 'warn');
    broadcastEvent(u, { event: 'status', projectId: p.id, running: false });
  } catch (e) {
    try { res.json({ success: false, message: e.message || 'Kill failed' }); } catch (err) {}
  }
});

app.post('/api/projects/:id/command', (req, res) => {
  try {
    const u = getUser(req);
    if (!u) return res.json({ success: false });
    const user = db.users.find((x) => x.username === u);
    if (!user) return res.json({ success: false });
    const p = (user.projects || []).find((x) => String(x.id) === String(req.params.id));
    if (!p) return res.json({ success: false });
    const proc = procs[procKey(p.id)];
    if (!proc || !proc.stdin || proc.stdin.destroyed) return res.json({ success: false, message: 'Process not running' });
    const cmd = String((req.body && req.body.cmd) || '').trim();
    if (!cmd) return res.json({ success: false, message: 'Empty command' });
    proc.stdin.write(cmd + '\n');
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message || 'Failed' });
  }
});



app.get('/api/admin/data', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ users: [], inviteCodes: {}, adminApiKeys: [] });
  res.json({ users: db.users, inviteCodes: db.inviteCodes, adminApiKeys: db.adminApiKeys || [] });
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

app.post('/api/admin/create-admin-key', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
  const { apiKey } = req.body;
  db.adminApiKeys = db.adminApiKeys || [];
  db.adminApiKeys.push({ key: apiKey, assignedUser: null, createdAt: Date.now() });
  saveDB();
  res.json({ success: true });
});

app.post('/api/admin/assign-admin-key', (req, res) => {
  const u = getUser(req);
  if (!u) return res.json({ success: false });
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
  try { startMcDomainProxy(); } catch (e) { console.error('MC proxy start error', e.message); }
});
