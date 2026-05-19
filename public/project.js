const username = localStorage.getItem('rc_user');
if (!username) window.location.href = '/';

const slug = window.location.pathname.split('/dashboard/')[1];
if (!slug) window.location.href = '/dashboard';

document.getElementById('nav-username').textContent = username;

let pollInterval = null;
let currentProject = null;

function logout() {
    localStorage.removeItem('rc_user');
    window.location.href = '/';
}

function langIcon(lang) {
    if (lang === 'js') return '⚡';
    if (lang === 'py') return '🐍';
    return '🌙';
}

function setStatus(running) {
    const pill = document.getElementById('status-pill');
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');

    if (running) {
        pill.className = 'status-pill online';
        text.textContent = 'Running';
        btnStart.classList.add('hidden');
        btnStop.classList.remove('hidden');
    } else {
        pill.className = 'status-pill';
        text.textContent = 'Offline';
        btnStart.classList.remove('hidden');
        btnStop.classList.add('hidden');
    }
}

function renderLogs(logs) {
    const box = document.getElementById('log-box');
    const empty = document.getElementById('log-empty');
    if (!logs || logs.length === 0) {
        box.innerHTML = '';
        box.appendChild(empty);
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    const atBottom = box.scrollHeight - box.clientHeight <= box.scrollTop + 40;
    box.innerHTML = '';
    logs.forEach(entry => {
        const div = document.createElement('div');
        const type = entry.m.startsWith('[ERR]') ? 'err' : entry.m.startsWith('[SYS]') ? 'sys' : 'out';
        div.className = 'log-entry ' + type;
        const t = new Date(entry.t);
        const ts = t.toLocaleTimeString('en-US', { hour12: false });
        div.innerHTML = '<span class="log-time">[' + ts + ']</span>' + escapeHTML(entry.m);
        box.appendChild(div);
    });
    if (atBottom) box.scrollTop = box.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clearLogs() {
    const box = document.getElementById('log-box');
    const empty = document.getElementById('log-empty');
    box.innerHTML = '';
    box.appendChild(empty);
    empty.classList.remove('hidden');
}

async function loadProject() {
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug));
    const data = await res.json();

    document.getElementById('loading-state').classList.add('hidden');

    if (!data.success) {
        document.getElementById('not-found').classList.remove('hidden');
        return;
    }

    currentProject = data.project;
    document.getElementById('project-content').classList.remove('hidden');
    document.getElementById('proj-name').textContent = data.project.name;
    document.getElementById('proj-icon').textContent = langIcon(data.project.lang);
    document.getElementById('proj-lang-badge').textContent = data.project.lang;
    document.title = data.project.name + ' — Reboot Cord';

    if (data.project.mainFile) {
        document.getElementById('upload-hint').textContent = 'Current file: ' + data.project.mainFile;
    }

    if (data.project.token) {
        document.getElementById('token-input').value = data.project.token;
    }

    setStatus(data.running);
    renderLogs(data.logs);

    if (data.running && !pollInterval) {
        pollInterval = setInterval(pollLogs, 2000);
    }
}

async function pollLogs() {
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug) + '/logs');
    const data = await res.json();
    setStatus(data.running);
    renderLogs(data.logs);
    if (!data.running && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function saveToken() {
    const token = document.getElementById('token-input').value.trim();
    const msg = document.getElementById('token-msg');
    if (!token) { msg.textContent = 'Token cannot be empty'; msg.className = 'field-msg error'; return; }
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug) + '/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
        msg.textContent = 'Token saved';
        msg.className = 'field-msg';
    } else {
        msg.textContent = 'Failed to save token';
        msg.className = 'field-msg error';
    }
    setTimeout(() => { msg.textContent = ''; }, 3000);
}

async function uploadFile(file) {
    if (!file) return;
    const msg = document.getElementById('upload-msg');
    const hint = document.getElementById('upload-hint');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'js' && ext !== 'py') {
        msg.textContent = 'Only .js and .py files are supported';
        msg.className = 'field-msg error';
        return;
    }
    msg.textContent = 'Uploading...';
    msg.className = 'field-msg';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug) + '/upload', {
        method: 'POST',
        body: form
    });
    const data = await res.json();
    if (data.success) {
        msg.textContent = 'Uploaded: ' + data.filename;
        msg.className = 'field-msg';
        hint.textContent = 'Current file: ' + data.filename;
    } else {
        msg.textContent = 'Upload failed';
        msg.className = 'field-msg error';
    }
    setTimeout(() => { msg.textContent = ''; }, 4000);
}

async function startBot() {
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug) + '/start', {
        method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
        setStatus(true);
        if (!pollInterval) pollInterval = setInterval(pollLogs, 2000);
    } else {
        alert(data.message || 'Failed to start bot');
    }
}

async function stopBot() {
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug) + '/stop', {
        method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
        setStatus(false);
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        setTimeout(pollLogs, 500);
    } else {
        alert(data.message || 'Failed to stop bot');
    }
}

async function deleteProject() {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug), {
        method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
        window.location.href = '/dashboard';
    } else {
        alert(data.message || 'Failed to delete project');
    }
}

function onDragOver(e) {
    e.preventDefault();
    document.getElementById('upload-area').classList.add('dragging');
}

function onDragLeave() {
    document.getElementById('upload-area').classList.remove('dragging');
}

function onDrop(e) {
    e.preventDefault();
    document.getElementById('upload-area').classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
}

loadProject();
