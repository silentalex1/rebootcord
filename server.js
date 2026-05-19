const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const BOTS_DIR = path.join(__dirname, 'bots');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BOTS_DIR)) fs.mkdirSync(BOTS_DIR, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function readJSON(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return fallback; }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let users = readJSON(USERS_FILE, []);
let projects = readJSON(PROJECTS_FILE, []);
const inviteCodes = new Map();
const blacklisted = new Set();
const botProcesses = new Map();
const botLogs = new Map();
const restartTimers = new Map();
const restartCounts = new Map();

app.use(express.json({ limit: '50mb' }));
app.use(express.static(PUBLIC_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(BOTS_DIR, req.params.username, req.params.name);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function safePath(base, rel) {
    const full = path.resolve(base, rel);
    return full.startsWith(base + path.sep) || full === base ? full : null;
}

function listFiles(dir, base) {
    const SKIP = new Set(['node_modules', 'packages', '.git', '__pycache__', '.npm']);
    const result = [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return result; }
    for (const e of entries) {
        if (SKIP.has(e.name)) continue;
        const rel = base ? base + '/' + e.name : e.name;
        if (e.isDirectory()) {
            result.push({ name: e.name, path: rel, type: 'dir', children: listFiles(path.join(dir, e.name), rel) });
        } else {
            result.push({ name: e.name, path: rel, type: 'file' });
        }
    }
    return result;
}

function pushLog(key, msg) {
    if (!botLogs.has(key)) botLogs.set(key, []);
    const logs = botLogs.get(key);
    logs.push({ t: Date.now(), m: msg });
    if (logs.length > 500) logs.shift();
}

function spawnBot(username, name) {
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project || !project.mainFile) return false;
    const key = `${username}:${name}`;
    if (botProcesses.has(key)) return false;
    const botDir = path.join(BOTS_DIR, username, name);
    const filePath = path.join(botDir, project.mainFile);
    if (!fs.existsSync(filePath)) return false;
    const ext = path.extname(project.mainFile);
    let cmd, args;
    if (ext === '.js') { cmd = 'node'; args = [filePath]; }
    else if (ext === '.py') { cmd = 'python3'; args = [filePath]; }
    else return false;
    const env = {
        ...process.env,
        DISCORD_TOKEN: project.token,
        NODE_PATH: path.join(botDir, 'node_modules'),
        PYTHONPATH: path.join(botDir, 'packages')
    };
    const proc = spawn(cmd, args, { env, cwd: botDir });
    proc.stdout.on('data', d => {
        d.toString().split('\n').filter(l => l.trim()).forEach(l => pushLog(key, '[OUT] ' + l));
    });
    proc.stderr.on('data', d => {
        d.toString().split('\n').filter(l => l.trim()).forEach(l => pushLog(key, '[ERR] ' + l));
    });
    proc.on('close', code => {
        botProcesses.delete(key);
        const p = projects.find(x => x.owner === username && x.slug === name);
        if (p) { p.status = 'offline'; saveJSON(PROJECTS_FILE, projects); }
        pushLog(key, '[SYS] Process exited with code ' + code);
        if (p && p.autoRestart && code !== 0) {
            const count = (restartCounts.get(key) || 0) + 1;
            restartCounts.set(key, count);
            const delay = Math.min(1000 * Math.pow(2, count - 1), 30000);
            pushLog(key, '[SYS] Auto-restarting in ' + Math.round(delay / 1000) + 's...');
            const t = setTimeout(() => {
                restartTimers.delete(key);
                if (spawnBot(username, name)) {
                    const proj = projects.find(x => x.owner === username && x.slug === name);
                    if (proj) { proj.status = 'online'; saveJSON(PROJECTS_FILE, projects); }
                    pushLog(key, '[SYS] Restarted');
                }
            }, delay);
            restartTimers.set(key, t);
        }
    });
    botProcesses.set(key, proc);
    return true;
}

app.post('/register', (req, res) => {
    const { username, password, invite } = req.body;
    if (!username || !password || !invite) return res.json({ success: false, message: 'All fields required' });
    if (blacklisted.has(invite) || blacklisted.has(username)) return res.json({ success: false, message: 'Blacklisted' });
    if (!inviteCodes.has(invite)) return res.json({ success: false, message: 'Invalid invite code' });
    if (users.find(u => u.username === username)) return res.json({ success: false, message: 'Username taken' });
    users.push({ username, password });
    saveJSON(USERS_FILE, users);
    inviteCodes.delete(invite);
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user && !blacklisted.has(username)) return res.json({ success: true });
    res.json({ success: false, message: 'Invalid credentials' });
});

app.get('/api/stats', (req, res) => {
    res.json({ activeUsers: users.length, totalInvites: inviteCodes.size });
});


app.get('/api/templates/:lang', (req, res) => {
    const lang = req.params.lang;
    const tmplDir = path.join(__dirname, 'templates', lang);
    if (!fs.existsSync(tmplDir)) return res.json({ success: false, files: [] });
    const files = fs.readdirSync(tmplDir).map(f => ({
        name: f,
        content: fs.readFileSync(path.join(tmplDir, f), 'utf8')
    }));
    res.json({ success: true, files });
});
app.post('/api/blacklist', (req, res) => {
    const { key } = req.body;
    if (key) blacklisted.add(key);
    res.json({ success: true });
});

app.post('/api/createcode', (req, res) => {
    const { code } = req.body;
    if (code) inviteCodes.set(code, true);
    res.json({ success: true });
});

app.get('/api/servers', (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({ success: false });
    res.json({ success: true, servers: projects.filter(p => p.owner === username) });
});

app.post('/api/servers', (req, res) => {
    const { username, name, lang } = req.body;
    if (!username || !name || !lang) return res.json({ success: false, message: 'Missing fields' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return res.json({ success: false, message: 'Invalid project name' });
    if (projects.find(p => p.owner === username && p.slug === slug)) return res.json({ success: false, message: 'Name already in use' });
    const TEMPLATES_DIR = path.join(__dirname, 'templates');
    let mainFile = '';
    const project = { owner: username, name, slug, lang, token: '', mainFile: '', status: 'offline', autoRestart: false, created: Date.now() };
    projects.push(project);
    saveJSON(PROJECTS_FILE, projects);
    const botDir = path.join(BOTS_DIR, username, slug);
    fs.mkdirSync(botDir, { recursive: true });
    // Copy language template into the new project dir
    const tmplDir = path.join(TEMPLATES_DIR, lang);
    if (fs.existsSync(tmplDir)) {
        const tmplFiles = fs.readdirSync(tmplDir);
        for (const f of tmplFiles) {
            fs.copyFileSync(path.join(tmplDir, f), path.join(botDir, f));
        }
        // Auto-set main file from template
        const mainExt = lang === 'py' ? '.py' : '.js';
        const mainTmpl = tmplFiles.find(f => f.endsWith(mainExt));
        if (mainTmpl) { project.mainFile = mainTmpl; saveJSON(PROJECTS_FILE, projects); }
    }
    res.json({ success: true, slug });
});

app.get('/api/servers/:username/:name', (req, res) => {
    const { username, name } = req.params;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false, message: 'Not found' });
    const key = `${username}:${name}`;
    res.json({ success: true, project, logs: botLogs.get(key) || [], running: botProcesses.has(key) });
});

app.post('/api/servers/:username/:name/token', (req, res) => {
    const { username, name } = req.params;
    const { token } = req.body;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false });
    project.token = token;
    saveJSON(PROJECTS_FILE, projects);
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/autorestart', (req, res) => {
    const { username, name } = req.params;
    const { autoRestart } = req.body;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false });
    project.autoRestart = !!autoRestart;
    if (!autoRestart) {
        restartCounts.delete(`${username}:${name}`);
        const t = restartTimers.get(`${username}:${name}`);
        if (t) { clearTimeout(t); restartTimers.delete(`${username}:${name}`); }
    }
    saveJSON(PROJECTS_FILE, projects);
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/mainfile', (req, res) => {
    const { username, name } = req.params;
    const { mainFile } = req.body;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false });
    project.mainFile = mainFile;
    saveJSON(PROJECTS_FILE, projects);
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/upload', upload.single('file'), (req, res) => {
    const { username, name } = req.params;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project || !req.file) return res.json({ success: false });
    if (!project.mainFile) {
        const ext = path.extname(req.file.originalname);
        if (ext === '.js' || ext === '.py') project.mainFile = req.file.originalname;
    }
    saveJSON(PROJECTS_FILE, projects);
    res.json({ success: true, filename: req.file.originalname });
});

app.get('/api/servers/:username/:name/files', (req, res) => {
    const { username, name } = req.params;
    const botDir = path.join(BOTS_DIR, username, name);
    fs.mkdirSync(botDir, { recursive: true });
    res.json({ success: true, files: listFiles(botDir, '') });
});

app.get('/api/servers/:username/:name/files/content', (req, res) => {
    const { username, name } = req.params;
    const { file } = req.query;
    if (!file) return res.json({ success: false, message: 'No file' });
    const botDir = path.join(BOTS_DIR, username, name);
    const full = safePath(botDir, file);
    if (!full || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return res.json({ success: false, message: 'Not found' });
    try {
        const content = fs.readFileSync(full, 'utf8');
        res.json({ success: true, content });
    } catch {
        res.json({ success: false, message: 'Cannot read binary file' });
    }
});

app.put('/api/servers/:username/:name/files/content', (req, res) => {
    const { username, name } = req.params;
    const { file, content } = req.body;
    if (!file) return res.json({ success: false });
    const botDir = path.join(BOTS_DIR, username, name);
    const full = safePath(botDir, file);
    if (!full) return res.json({ success: false });
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content || '');
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/files/new', (req, res) => {
    const { username, name } = req.params;
    const { file } = req.body;
    if (!file || !file.trim()) return res.json({ success: false });
    const botDir = path.join(BOTS_DIR, username, name);
    const full = safePath(botDir, file.trim());
    if (!full) return res.json({ success: false });
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (!fs.existsSync(full)) fs.writeFileSync(full, '');
    res.json({ success: true });
});

app.delete('/api/servers/:username/:name/files/item', (req, res) => {
    const { username, name } = req.params;
    const { file } = req.body;
    if (!file) return res.json({ success: false });
    const botDir = path.join(BOTS_DIR, username, name);
    const full = safePath(botDir, file);
    if (!full || !fs.existsSync(full)) return res.json({ success: false });
    fs.rmSync(full, { recursive: true, force: true });
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (project && project.mainFile === file) {
        project.mainFile = '';
        saveJSON(PROJECTS_FILE, projects);
    }
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/files/upload', upload.array('files', 30), (req, res) => {
    const { username, name } = req.params;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project || !req.files || !req.files.length) return res.json({ success: false });
    const uploaded = req.files.map(f => f.originalname);
    if (!project.mainFile) {
        const main = uploaded.find(n => n.endsWith('.js') || n.endsWith('.py'));
        if (main) { project.mainFile = main; saveJSON(PROJECTS_FILE, projects); }
    }
    res.json({ success: true, files: uploaded });
});

app.post('/api/servers/:username/:name/install', (req, res) => {
    const { username, name } = req.params;
    const { pkg } = req.body;
    if (!pkg || !pkg.trim()) return res.json({ success: false, message: 'Package name required' });
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false });
    const key = `${username}:${name}`;
    const botDir = path.join(BOTS_DIR, username, name);
    const pkgName = pkg.trim();
    let cmd, args;
    if (project.lang === 'py') {
        const pkgDir = path.join(botDir, 'packages');
        fs.mkdirSync(pkgDir, { recursive: true });
        cmd = 'pip3';
        args = ['install', pkgName, '--target', pkgDir, '-q'];
    } else {
        cmd = 'npm';
        args = ['install', pkgName, '--prefix', botDir, '--save', '--loglevel=error'];
    }
    pushLog(key, '[SYS] Installing ' + pkgName + '...');
    const proc = spawn(cmd, args, { cwd: botDir, env: { ...process.env, HOME: process.env.HOME || '/tmp' } });
    proc.stdout.on('data', d => {
        d.toString().split('\n').filter(l => l.trim()).forEach(l => pushLog(key, '[PKG] ' + l));
    });
    proc.stderr.on('data', d => {
        d.toString().split('\n').filter(l => l.trim()).forEach(l => pushLog(key, '[PKG] ' + l));
    });
    proc.on('close', code => {
        pushLog(key, '[SYS] Install ' + (code === 0 ? 'succeeded ✓' : 'failed (code ' + code + ')'));
    });
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/start', (req, res) => {
    const { username, name } = req.params;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false, message: 'Not found' });
    const key = `${username}:${name}`;
    if (botProcesses.has(key)) return res.json({ success: false, message: 'Already running' });
    if (!project.mainFile) return res.json({ success: false, message: 'No main file set' });
    const t = restartTimers.get(key);
    if (t) { clearTimeout(t); restartTimers.delete(key); }
    restartCounts.delete(key);
    if (!spawnBot(username, name)) return res.json({ success: false, message: 'Failed to start — check your main file exists' });
    project.status = 'online';
    saveJSON(PROJECTS_FILE, projects);
    pushLog(key, '[SYS] Bot started');
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/stop', (req, res) => {
    const { username, name } = req.params;
    const key = `${username}:${name}`;
    const t = restartTimers.get(key);
    if (t) { clearTimeout(t); restartTimers.delete(key); }
    restartCounts.delete(key);
    const proc = botProcesses.get(key);
    if (!proc) return res.json({ success: false, message: 'Not running' });
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (project) { project.autoRestart = false; }
    proc.kill('SIGTERM');
    botProcesses.delete(key);
    if (project) { project.status = 'offline'; saveJSON(PROJECTS_FILE, projects); }
    pushLog(key, '[SYS] Bot stopped');
    res.json({ success: true });
});

app.delete('/api/servers/:username/:name', (req, res) => {
    const { username, name } = req.params;
    const key = `${username}:${name}`;
    const t = restartTimers.get(key);
    if (t) { clearTimeout(t); restartTimers.delete(key); }
    const proc = botProcesses.get(key);
    if (proc) { proc.kill('SIGTERM'); botProcesses.delete(key); }
    botLogs.delete(key);
    restartCounts.delete(key);
    restartTimers.delete(key);
    const idx = projects.findIndex(p => p.owner === username && p.slug === name);
    if (idx === -1) return res.json({ success: false, message: 'Not found' });
    projects.splice(idx, 1);
    saveJSON(PROJECTS_FILE, projects);
    const botDir = path.join(BOTS_DIR, username, name);
    if (fs.existsSync(botDir)) fs.rmSync(botDir, { recursive: true, force: true });
    res.json({ success: true });
});

app.get('/api/servers/:username/:name/logs', (req, res) => {
    const { username, name } = req.params;
    const key = `${username}:${name}`;
    res.json({ logs: botLogs.get(key) || [], running: botProcesses.has(key) });
});

app.get('/ping', (req, res) => res.send('OK'));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html')));
app.get('/dashboard/:name', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'project.html')));

app.listen(process.env.PORT || 3000);

// 24/7 keep-alive: self-ping every 10 minutes to prevent hosting provider sleep
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || null;
if (SELF_URL) {
    const https = require('https');
    const http = require('http');
    setInterval(() => {
        try {
            const url = SELF_URL.trimEnd('/') + '/ping';
            const mod = url.startsWith('https') ? https : http;
            mod.get(url, () => {}).on('error', () => {});
        } catch (_) {}
    }, 10 * 60 * 1000);
}
