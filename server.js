const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const app = express();

const DB_FILE = path.join(__dirname, 'db.json');
const SECRET = process.env.SESSION_SECRET || 'rebootcord-secret-key-change-in-prod';

function loadDB() {
  try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) {}
  return { users: [], inviteCodes: {}, blacklisted: [] };
}
function saveDB() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch(e) {} }
let db = loadDB();

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
  (req.headers.cookie || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = v.join('=').trim();
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

app.use(express.json());
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
  if (db.users.find(u => u.username === username)) return res.json({ success: false, message: 'Username taken' });
  db.users.push({ username, password, invite: code });
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
    res.json({ success: false, message: 'Invalid credentials or blacklisted' });
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
