const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const app = express();

const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [], sessions: {} };
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

app.use(express.json());

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = v.join('=').trim();
  });
  return out;
}

function requireAuth(req, res, next) {
  const sid = parseCookies(req)['rc_sid'];
  if (sid && db.sessions[sid]) {
    req.username = db.sessions[sid];
    return next();
  }
  res.redirect('/');
}

app.use(express.static(__dirname, { index: false }));

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/', (req, res) => {
  const sid = parseCookies(req)['rc_sid'];
  if (sid && db.sessions[sid]) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/register', (req, res) => {
  const { username, password, invite } = req.body;
  if (!username || !password || !invite) return res.json({ success: false, message: 'All fields required' });
  const code = invite.startsWith('rebootcord-') ? invite : 'rebootcord-' + invite;
  if (db.blacklisted.includes(code) || db.blacklisted.includes(username)) return res.json({ success: false, message: 'This invite has been blacklisted' });
  if (!db.inviteCodes[code]) return res.json({ success: false, message: 'Invalid invite code' });
  if (db.users.find(u => u.username === username)) return res.json({ success: false, message: 'Username already taken' });
  db.users.push({ username, password, invite: code });
  delete db.inviteCodes[code];
  const sid = crypto.randomBytes(32).toString('hex');
  db.sessions[sid] = username;
  saveDB();
  res.setHeader('Set-Cookie', 'rc_sid=' + sid + '; HttpOnly; Path=/; SameSite=Lax');
  res.json({ success: true, username });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (user && !db.blacklisted.includes(username)) {
    const sid = crypto.randomBytes(32).toString('hex');
    db.sessions[sid] = username;
    saveDB();
    res.setHeader('Set-Cookie', 'rc_sid=' + sid + '; HttpOnly; Path=/; SameSite=Lax');
    res.json({ success: true, username });
  } else {
    res.json({ success: false, message: 'Invalid credentials or account blacklisted' });
  }
});

app.post('/logout', (req, res) => {
  const sid = parseCookies(req)['rc_sid'];
  if (sid) { delete db.sessions[sid]; saveDB(); }
  res.setHeader('Set-Cookie', 'rc_sid=; HttpOnly; Path=/; Max-Age=0');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const sid = parseCookies(req)['rc_sid'];
  if (sid && db.sessions[sid]) return res.json({ loggedIn: true, username: db.sessions[sid] });
  res.json({ loggedIn: false });
});

app.get('/api/stats', (req, res) => {
  res.json({ activeUsers: db.users.length, totalInvites: Object.keys(db.inviteCodes).length });
});

app.post('/api/blacklist', (req, res) => {
  const { key } = req.body;
  if (key && !db.blacklisted.includes(key)) { db.blacklisted.push(key); saveDB(); }
  res.json({ success: true });
});

app.post('/api/createcode', (req, res) => {
  const { code } = req.body;
  if (code) { db.inviteCodes[code] = true; saveDB(); }
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Reboot Cord running on port ' + PORT));
