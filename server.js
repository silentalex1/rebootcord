const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');

const app = express();
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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(BOTS_DIR, req.params.username, req.params.name);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, file.originalname)
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
});

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
    const project = { owner: username, name, slug, lang, token: '', mainFile: '', status: 'offline', created: Date.now() };
    projects.push(project);
    saveJSON(PROJECTS_FILE, projects);
    fs.mkdirSync(path.join(BOTS_DIR, username, slug), { recursive: true });
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

app.post('/api/servers/:username/:name/upload', upload.single('file'), (req, res) => {
    const { username, name } = req.params;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project || !req.file) return res.json({ success: false });
    project.mainFile = req.file.originalname;
    saveJSON(PROJECTS_FILE, projects);
    res.json({ success: true, filename: req.file.originalname });
});

app.post('/api/servers/:username/:name/start', (req, res) => {
    const { username, name } = req.params;
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (!project) return res.json({ success: false, message: 'Not found' });
    const key = `${username}:${name}`;
    if (botProcesses.has(key)) return res.json({ success: false, message: 'Already running' });
    if (!project.mainFile) return res.json({ success: false, message: 'No bot file uploaded' });
    const filePath = path.join(BOTS_DIR, username, name, project.mainFile);
    if (!fs.existsSync(filePath)) return res.json({ success: false, message: 'File not found on disk' });
    const ext = path.extname(project.mainFile);
    let cmd, args;
    if (ext === '.js') { cmd = 'node'; args = [filePath]; }
    else if (ext === '.py') { cmd = 'python3'; args = [filePath]; }
    else return res.json({ success: false, message: 'Unsupported file type (.js or .py only)' });
    const logs = [];
    botLogs.set(key, logs);
    const proc = spawn(cmd, args, {
        env: { ...process.env, DISCORD_TOKEN: project.token },
        cwd: path.join(BOTS_DIR, username, name)
    });
    proc.stdout.on('data', d => {
        logs.push({ t: Date.now(), m: '[OUT] ' + d.toString().trimEnd() });
        if (logs.length > 300) logs.shift();
    });
    proc.stderr.on('data', d => {
        logs.push({ t: Date.now(), m: '[ERR] ' + d.toString().trimEnd() });
        if (logs.length > 300) logs.shift();
    });
    proc.on('close', code => {
        botProcesses.delete(key);
        const p = projects.find(x => x.owner === username && x.slug === name);
        if (p) { p.status = 'offline'; saveJSON(PROJECTS_FILE, projects); }
        logs.push({ t: Date.now(), m: '[SYS] Process exited with code ' + code });
    });
    botProcesses.set(key, proc);
    project.status = 'online';
    saveJSON(PROJECTS_FILE, projects);
    res.json({ success: true });
});

app.post('/api/servers/:username/:name/stop', (req, res) => {
    const { username, name } = req.params;
    const key = `${username}:${name}`;
    const proc = botProcesses.get(key);
    if (!proc) return res.json({ success: false, message: 'Not running' });
    proc.kill('SIGTERM');
    botProcesses.delete(key);
    const project = projects.find(p => p.owner === username && p.slug === name);
    if (project) { project.status = 'offline'; saveJSON(PROJECTS_FILE, projects); }
    res.json({ success: true });
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/:name', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'project.html'));
});

app.listen(process.env.PORT || 3000);
