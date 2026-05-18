const username = localStorage.getItem('rc_user');
if (!username) window.location.href = '/';

let selectedLang = null;

document.getElementById('nav-username').textContent = username;

function logout() {
    localStorage.removeItem('rc_user');
    window.location.href = '/';
}

function openModal() {
    selectedLang = null;
    document.getElementById('proj-name').value = '';
    document.getElementById('create-msg').textContent = '';
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function pickLang(el) {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    selectedLang = el.dataset.lang;
}

async function createProject() {
    const name = document.getElementById('proj-name').value.trim();
    const msg = document.getElementById('create-msg');
    if (!name) { msg.textContent = 'Enter a project name'; return; }
    if (!selectedLang) { msg.textContent = 'Select a language'; return; }

    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('progress-title').textContent = 'Setting up ' + name + '...';

    let pct = 0;
    const bar = document.getElementById('prog-bar');
    const pctText = document.getElementById('prog-pct');

    const iv = setInterval(() => {
        pct += Math.random() * 18;
        if (pct >= 90) { pct = 90; clearInterval(iv); }
        bar.style.width = pct + '%';
        pctText.textContent = Math.floor(pct) + '%';
    }, 120);

    const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, lang: selectedLang })
    });
    const data = await res.json();

    clearInterval(iv);
    bar.style.width = '100%';
    pctText.textContent = '100%';

    setTimeout(() => {
        closeModal();
        if (data.success) {
            loadServers();
        } else {
            document.getElementById('step1').classList.remove('hidden');
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('create-msg').textContent = data.message;
        }
    }, 500);
}

function langIcon(lang) {
    if (lang === 'js') return '⚡';
    if (lang === 'py') return '🐍';
    return '🌙';
}

function renderCard(server) {
    const card = document.createElement('div');
    card.className = 'server-card';
    const isOnline = server.status === 'online';
    card.innerHTML =
        '<div class="card-top">' +
            '<div class="card-icon">' + langIcon(server.lang) + '</div>' +
            '<span class="status-dot ' + (isOnline ? 'online' : 'offline') + '"></span>' +
        '</div>' +
        '<div class="card-mid">' +
            '<div class="card-name">' + escapeHTML(server.name) + '</div>' +
            '<span class="card-lang">' + server.lang + '</span>' +
            '<div class="card-status-text' + (isOnline ? ' running' : '') + '">' +
                (isOnline ? 'Running' : 'Offline') +
            '</div>' +
        '</div>' +
        '<button class="btn-manage" onclick="window.location.href=\'/dashboard/' + encodeURIComponent(server.slug) + '\'">Manage Server Project</button>';
    return card;
}

function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadServers() {
    const res = await fetch('/api/servers?username=' + encodeURIComponent(username));
    const data = await res.json();
    const grid = document.getElementById('servers-grid');
    const empty = document.getElementById('empty-state');
    grid.innerHTML = '';

    if (!data.success || data.servers.length === 0) {
        grid.appendChild(empty);
        empty.classList.remove('hidden');
        return;
    }

    data.servers.forEach(s => grid.appendChild(renderCard(s)));
}

loadServers();
