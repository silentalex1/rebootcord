const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

let users = [];
let inviteCodes = new Map();
let blacklisted = new Set();

const OWNER_ID = "841749813702688858";

app.post('/register', (req, res) => {
    const { username, password, invite } = req.body;
    if (blacklisted.has(invite) || blacklisted.has(username)) {
        return res.json({ success: false, message: "This invite has been blacklisted" });
    }
    if (!inviteCodes.has(invite)) {
        return res.json({ success: false, message: "Invalid invite code" });
    }
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, message: "Username already taken" });
    }
    users.push({ username, password, invite });
    inviteCodes.delete(invite);
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user && !blacklisted.has(username)) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid credentials or blacklisted" });
    }
});

app.get('/api/stats', (req, res) => {
    res.json({
        activeUsers: users.length,
        totalInvites: inviteCodes.size
    });
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

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Reboot Cord running on http://localhost:${PORT}`);
});
