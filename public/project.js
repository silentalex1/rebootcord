const username = localStorage.getItem('rc_user');
if (!username) window.location.href = '/';

const slug = window.location.pathname.split('/dashboard/')[1];
if (!slug) window.location.href = '/dashboard';

document.getElementById('nav-user').textContent = username;

let currentProject = null;
let openFilePath = null;
let fileModified = false;
let pollInterval = null;
let ctxTarget = null;
let isDragging = false;

function logout() {
    localStorage.removeItem('rc_user');
    window.location.href = '/';
}

function api(path, opts) {
    const base = '/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug);
    return fetch(base + path, opts).then(r => r.json());
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, ok) {
    const t = document.createElement('div');
    t.className = 'toast ' + (ok === false ? 'toast-err' : 'toast-ok');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('toast-show'), 10);
    setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 2800);
}

function setStatus(running) {
    const chip = document.getElementById('status-chip');
    const dot = document.getElementById('chip-dot');
    const text = document.getElementById('chip-text');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    if (running) {
        chip.className = 'status-chip online';
        text.textContent = 'Running';
        btnStart.classList.add('hidden');
        btnStop.classList.remove('hidden');
    } else {
        chip.className = 'status-chip';
        text.textContent = 'Offline';
        btnStart.classList.remove('hidden');
        btnStop.classList.add('hidden');
    }
}

function renderLogs(logs) {
    const box = document.getElementById('log-box');
    if (!logs || logs.length === 0) {
        box.innerHTML = '<div class="log-empty">No logs yet. Start your bot to see output here.</div>';
        return;
    }
    const autoscroll = document.getElementById('autoscroll-cb').checked;
    const atBottom = box.scrollHeight - box.clientHeight <= box.scrollTop + 60;
    box.innerHTML = '';
    logs.forEach(entry => {
        const div = document.createElement('div');
        const type = entry.m.startsWith('[ERR]') ? 'err' : entry.m.startsWith('[PKGDONE]') ? 'pkgdone' : entry.m.startsWith('[SYS]') ? 'sys' : entry.m.startsWith('[PKG]') ? 'pkg' : 'out';
        div.className = 'log-line ' + type;
        const d = new Date(entry.t);
        const ts = d.toLocaleTimeString('en-US', { hour12: false });
        div.innerHTML = '<span class="log-ts">' + ts + '</span><span class="log-msg">' + escHtml(entry.m) + '</span>';
        box.appendChild(div);
    });
    if (autoscroll && (atBottom || isDragging)) box.scrollTop = box.scrollHeight;
}

function clearLogs() {
    document.getElementById('log-box').innerHTML = '<div class="log-empty">Cleared.</div>';
}

async function pollLogs() {
    const data = await api('/logs');
    setStatus(data.running);
    renderLogs(data.logs);
    if (!data.running && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function startPolling() {
    if (!pollInterval) pollInterval = setInterval(pollLogs, 1500);
}

function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

async function loadProject() {
    const data = await api('');
    document.getElementById('app-loading').classList.add('hidden');
    if (!data.success) {
        document.getElementById('not-found-screen').classList.remove('hidden');
        return;
    }
    currentProject = data.project;
    document.getElementById('ide').classList.remove('hidden');
    document.getElementById('top-name').textContent = data.project.name;
    document.getElementById('top-icon').textContent = langIcon(data.project.lang);
    document.getElementById('top-lang').textContent = data.project.lang;
    document.title = data.project.name + ' — RebootCord';
    if (data.project.token) document.getElementById('token-input').value = data.project.token;
    document.getElementById('autorestart-cb').checked = !!data.project.autoRestart;
    updateMainFileDisplay();
    setStatus(data.running);
    renderLogs(data.logs);
    if (data.running) startPolling();
    loadFiles();
}

function langIcon(lang) {
    if (lang === 'js') return '⚡';
    if (lang === 'py') return '🐍';
    return '🌙';
}

function updateMainFileDisplay() {
    const el = document.getElementById('mainfile-display');
    el.textContent = currentProject.mainFile || 'None set';
    el.className = 'mainfile-display' + (currentProject.mainFile ? ' has-file' : '');
}

function renderTree(files, container) {
    files.forEach(f => {
        if (f.type === 'dir') {
            const folder = document.createElement('div');
            folder.className = 'tree-folder';
            folder.innerHTML = '<div class="tree-folder-label"><span class="tree-arrow">▸</span><span class="folder-icon">📁</span>' + escHtml(f.name) + '</div>';
            const children = document.createElement('div');
            children.className = 'tree-children collapsed';
            const label = folder.querySelector('.tree-folder-label');
            label.onclick = () => {
                const arrow = label.querySelector('.tree-arrow');
                const collapsed = children.classList.toggle('collapsed');
                arrow.textContent = collapsed ? '▸' : '▾';
            };
            if (f.children && f.children.length) renderTree(f.children, children);
            folder.appendChild(children);
            container.appendChild(folder);
        } else {
            const row = document.createElement('div');
            const isMain = currentProject && currentProject.mainFile === f.path;
            row.className = 'tree-file' + (f.path === openFilePath ? ' active' : '') + (isMain ? ' is-main' : '');
            row.dataset.path = f.path;
            row.innerHTML = '<span class="file-icon">' + fileIcon(f.name) + '</span><span class="file-name">' + escHtml(f.name) + '</span>' + (isMain ? '<span class="main-badge">main</span>' : '');
            row.onclick = () => openFile(f.path);
            row.oncontextmenu = (e) => { e.preventDefault(); showCtxMenu(e, f.path); };
            container.appendChild(row);
        }
    });
}

function fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = { js: '🟨', ts: '🟦', py: '🐍', json: '🔧', md: '📝', txt: '📄', env: '🔑', sh: '⚙', yml: '⚙', yaml: '⚙', css: '🎨', html: '🌐', toml: '🔧', requirements: '📋' };
    return map[ext] || '📄';
}

async function loadFiles() {
    const data = await api('/files');
    const tree = document.getElementById('file-tree');
    tree.innerHTML = '';
    if (!data.success || !data.files || data.files.length === 0) {
        tree.innerHTML = '<div class="tree-empty">No files yet</div>';
        return;
    }
    renderTree(data.files, tree);
}

async function openFile(filePath) {
    if (fileModified && openFilePath) {
        if (!confirm('You have unsaved changes. Discard?')) return;
    }
    const data = await api('/files/content?file=' + encodeURIComponent(filePath));
    if (!data.success) { showToast('Cannot read file: ' + (data.message || 'error'), false); return; }
    openFilePath = filePath;
    fileModified = false;
    const editor = document.getElementById('editor');
    const welcome = document.getElementById('editor-welcome');
    editor.value = data.content;
    editor.classList.remove('hidden');
    welcome.classList.add('hidden');
    document.getElementById('editor-filename').textContent = filePath;
    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    refreshFileTree();
}

function onEditorChange() {
    fileModified = true;
    document.getElementById('save-btn').textContent = 'Save *';
}

function handleEditorKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '    ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
    }
}

async function saveFile() {
    if (!openFilePath) return;
    const content = document.getElementById('editor').value;
    const data = await api('/files/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: openFilePath, content })
    });
    if (data.success) {
        fileModified = false;
        document.getElementById('save-btn').textContent = 'Save';
        showToast('Saved', true);
    } else {
        showToast('Save failed', false);
    }
}

function promptNewFile() {
    document.getElementById('new-file-input').value = '';
    document.getElementById('new-file-msg').textContent = '';
    document.getElementById('new-file-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('new-file-input').focus(), 50);
}

function closeNewFileModal() {
    document.getElementById('new-file-modal').classList.add('hidden');
}

async function confirmNewFile() {
    const name = document.getElementById('new-file-input').value.trim();
    const msg = document.getElementById('new-file-msg');
    if (!name) { msg.textContent = 'Enter a filename'; return; }
    const data = await api('/files/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: name })
    });
    if (data.success) {
        closeNewFileModal();
        await loadFiles();
        openFile(name);
    } else {
        msg.textContent = 'Failed to create file';
    }
}

async function uploadFileList(fileEntries) {
    if (!fileEntries || !fileEntries.length) return;
    const form = new FormData();
    for (const { file, path: relPath } of fileEntries) {
        form.append(relPath, file, relPath);
    }
    const res = await fetch('/api/servers/' + encodeURIComponent(username) + '/' + encodeURIComponent(slug) + '/files/upload', {
        method: 'POST', body: form
    });
    const data = await res.json();
    if (data.success) {
        showToast('Uploaded ' + data.files.length + ' file(s)', true);
        if (currentProject && !currentProject.mainFile && data.files) {
            const main = data.files.find(n => n.endsWith('.js') || n.endsWith('.py'));
            if (main) { currentProject.mainFile = main; updateMainFileDisplay(); }
        }
        loadFiles();
    } else {
        showToast('Upload failed', false);
    }
    document.getElementById('multi-upload').value = '';
}

async function uploadFiles(files) {
    const entries = Array.from(files).map(f => ({ file: f, path: f.name }));
    await uploadFileList(entries);
}

function readEntry(entry, prefix) {
    return new Promise(resolve => {
        if (entry.isFile) {
            entry.file(f => resolve([{ file: f, path: prefix + entry.name }]));
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const readAll = (acc) => {
                reader.readEntries(async batch => {
                    if (!batch.length) {
                        const nested = await Promise.all(acc.map(e => readEntry(e, prefix + entry.name + '/')));
                        resolve(nested.flat());
                    } else {
                        readAll(acc.concat(Array.from(batch)));
                    }
                });
            };
            readAll([]);
        } else {
            resolve([]);
        }
    });
}

function fileDragOver(e) {
    e.preventDefault();
    isDragging = true;
    document.getElementById('file-drop-zone').classList.add('dragging');
}

function fileDragLeave(e) {
    if (!document.getElementById('file-drop-zone').contains(e.relatedTarget)) {
        isDragging = false;
        document.getElementById('file-drop-zone').classList.remove('dragging');
    }
}

async function fileDrop(e) {
    e.preventDefault();
    isDragging = false;
    document.getElementById('file-drop-zone').classList.remove('dragging');
    const items = e.dataTransfer.items;
    if (items && items.length) {
        const allEntries = [];
        for (const item of items) {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) {
                const files = await readEntry(entry, '');
                allEntries.push(...files);
            } else if (item.getAsFile) {
                const f = item.getAsFile();
                if (f) allEntries.push({ file: f, path: f.name });
            }
        }
        if (allEntries.length) await uploadFileList(allEntries);
    } else {
        await uploadFiles(e.dataTransfer.files);
    }
}

function refreshFileTree() {
    document.querySelectorAll('.tree-file').forEach(el => {
        const p = el.dataset.path;
        el.className = 'tree-file' + (p === openFilePath ? ' active' : '') + (currentProject && currentProject.mainFile === p ? ' is-main' : '');
    });
}

function showCtxMenu(e, filePath) {
    ctxTarget = filePath;
    const menu = document.getElementById('ctx-menu');
    menu.classList.remove('hidden');
    let x = e.clientX, y = e.clientY;
    if (x + 160 > window.innerWidth) x = window.innerWidth - 170;
    if (y + 100 > window.innerHeight) y = window.innerHeight - 110;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    const isMain = currentProject && currentProject.mainFile === filePath;
    document.getElementById('ctx-main').textContent = isMain ? '★ Is Main File' : 'Set as Main File';
}

document.addEventListener('click', () => document.getElementById('ctx-menu').classList.add('hidden'));

function ctxOpen() { if (ctxTarget) openFile(ctxTarget); }

async function ctxSetMain() {
    if (!ctxTarget) return;
    const data = await api('/mainfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainFile: ctxTarget })
    });
    if (data.success) {
        currentProject.mainFile = ctxTarget;
        updateMainFileDisplay();
        loadFiles();
        showToast('Main file set: ' + ctxTarget, true);
    }
}

async function ctxDelete() {
    if (!ctxTarget) return;
    if (!confirm('Delete ' + ctxTarget + '?')) return;
    const data = await api('/files/item', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: ctxTarget })
    });
    if (data.success) {
        if (openFilePath === ctxTarget) {
            openFilePath = null;
            fileModified = false;
            document.getElementById('editor').classList.add('hidden');
            document.getElementById('editor-welcome').classList.remove('hidden');
            document.getElementById('editor-filename').textContent = 'No file open';
            document.getElementById('save-btn').disabled = true;
        }
        if (currentProject && currentProject.mainFile === ctxTarget) {
            currentProject.mainFile = '';
            updateMainFileDisplay();
        }
        loadFiles();
        showToast('Deleted', true);
    } else {
        showToast('Delete failed', false);
    }
}

async function saveToken() {
    const token = document.getElementById('token-input').value.trim();
    const msg = document.getElementById('token-msg');
    if (!token) { msg.textContent = 'Token cannot be empty'; return; }
    const data = await api('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });
    if (data.success) {
        msg.textContent = 'Saved ✓';
        msg.className = 'setting-msg ok';
        if (currentProject) currentProject.token = token;
    } else {
        msg.textContent = 'Failed';
        msg.className = 'setting-msg err';
    }
    setTimeout(() => { msg.textContent = ''; msg.className = 'setting-msg'; }, 3000);
}

async function toggleAutoRestart(val) {
    const data = await api('/autorestart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRestart: val })
    });
    if (data.success && currentProject) currentProject.autoRestart = val;
}

async function installPkg() {
    const input = document.getElementById('pkg-input');
    const hint = document.getElementById('pkg-hint');
    const btn = document.querySelector('.pkg-install-btn');
    const pkg = input.value.trim();
    if (!pkg) { hint.textContent = 'Enter a package name'; hint.className = 'pkg-hint err'; return; }
    hint.textContent = 'Installing ' + pkg + '...';
    hint.className = 'pkg-hint';
    btn.disabled = true;
    btn.textContent = '...';
    const data = await api('/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pkg })
    });
    if (data.success) {
        input.value = '';
        startPolling();
        // Poll logs until we see PKGDONE or failure
        const startTime = Date.now();
        const checkDone = setInterval(async () => {
            const logData = await api('/logs');
            renderLogs(logData.logs);
            const done = (logData.logs || []).slice(-20).find(l =>
                l.m.includes('[PKGDONE]') && l.m.includes(pkg) && l.t > startTime
            );
            const failed = (logData.logs || []).slice(-20).find(l =>
                l.m.includes('Install failed') && l.t > startTime
            );
            if (done) {
                clearInterval(checkDone);
                hint.textContent = '';
                hint.className = 'pkg-hint';
                btn.disabled = false; btn.textContent = 'Install';
                showToast(pkg + ' installed successfully ✓', true);
            } else if (failed || Date.now() - startTime > 120000) {
                clearInterval(checkDone);
                hint.textContent = 'Install failed — check console';
                hint.className = 'pkg-hint err';
                btn.disabled = false; btn.textContent = 'Install';
                setTimeout(() => { hint.textContent = ''; hint.className = 'pkg-hint'; }, 5000);
            }
        }, 1500);
    } else {
        hint.textContent = data.message || 'Install failed';
        hint.className = 'pkg-hint err';
        btn.disabled = false; btn.textContent = 'Install';
        setTimeout(() => { hint.textContent = ''; hint.className = 'pkg-hint'; }, 5000);
    }
}

async function startBot() {
    const data = await api('/start', { method: 'POST' });
    if (data.success) {
        setStatus(true);
        startPolling();
    } else {
        showToast(data.message || 'Failed to start', false);
    }
}

async function stopBot() {
    const data = await api('/stop', { method: 'POST' });
    if (data.success) {
        setStatus(false);
        stopPolling();
        setTimeout(pollLogs, 600);
    } else {
        showToast(data.message || 'Failed to stop', false);
    }
}

async function deleteProject() {
    if (!confirm('Delete this project and all its files? This cannot be undone.')) return;
    const data = await api('', { method: 'DELETE' });
    if (data.success) window.location.href = '/dashboard';
    else showToast(data.message || 'Delete failed', false);
}

loadProject();
