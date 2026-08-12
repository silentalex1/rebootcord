(function () {
  if (document.getElementById('reboot-admin-panel')) return;

  const style = document.createElement('style');
  style.innerHTML = `
#reboot-admin-panel{position:fixed;top:20px;right:20px;width:400px;background:#0f0f0f;border:1px solid #2d2d2d;border-radius:12px;z-index:999999;font-family:'Syne',sans-serif,system-ui;color:#f4f4f4;box-shadow:0 10px 30px rgba(0,0,0,0.5);display:flex;flex-direction:column;max-height:80vh}
#reboot-admin-header{padding:12px 16px;border-bottom:1px solid #1f1f1f;display:flex;justify-content:space-between;align-items:center;background:#161616;border-radius:12px 12px 0 0;cursor:grab;user-select:none}
#reboot-admin-header:active{cursor:grabbing}
#reboot-admin-title{font-weight:800;font-size:16px;letter-spacing:-0.02em;pointer-events:none}
#reboot-admin-close{background:transparent;border:none;color:#8a8a8a;cursor:pointer;font-size:28px;line-height:1;padding:0 4px;display:flex;align-items:center;justify-content:center}
#reboot-admin-close:hover{color:#e63946}
#reboot-admin-content{padding:16px;overflow-y:auto;flex:1}
.admin-section-title{font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#8a8a8a;font-weight:700;margin-bottom:14px;margin-top:20px}
.admin-section-title:first-child{margin-top:0}
.admin-list-item{background:#161616;border:1px solid #1f1f1f;padding:14px;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
.admin-item-text{font-size:13px;font-family:'IBM Plex Mono',monospace;flex:1;margin-right:12px;word-break:break-word;line-height:1.4;color:#e2e2e2}
.admin-btn{background:#e63946;color:#fff;border:none;padding:7px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;transition:0.15s;flex-shrink:0}
.admin-btn:hover{background:#c1121f}
.admin-btn.green{background:#2ec27e;color:#000}
.admin-btn.blue{background:#5865f2;color:#fff}
.admin-badge{background:#2ec27e;color:#000;font-size:10px;padding:1px 5px;border-radius:3px;margin-left:6px;font-weight:800}
.likes-count{font-size:10px;color:#8a8a8a}
.admin-create-btn{width:100%;background:#5865f2;color:#fff;border:none;padding:12px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:0.15s;margin-bottom:12px}
.admin-create-btn:hover{background:#4752c4}
.admin-api-key-item{background:#161616;border:1px solid #1f1f1f;padding:12px;border-radius:8px;margin-bottom:10px}
.admin-api-key-text{font-size:12px;font-family:'IBM Plex Mono',monospace;color:#e2e2e2;word-break:break-word;margin-bottom:8px}
.admin-api-validate-input{width:100%;background:#0f0f0f;border:1px solid #2d2d2d;border-radius:6px;padding:8px;color:#f4f4f4;font-size:12px;font-family:'IBM Plex Mono',monospace;outline:none;margin-top:8px}
`;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'reboot-admin-panel';

  const header = document.createElement('div');
  header.id = 'reboot-admin-header';
  const title = document.createElement('div');
  title.id = 'reboot-admin-title';
  title.innerText = 'Reboot Cord Admin Panel';
  const closeBtn = document.createElement('button');
  closeBtn.id = 'reboot-admin-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => panel.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const content = document.createElement('div');
  content.id = 'reboot-admin-content';
  content.innerText = 'Loading data...';
  panel.appendChild(content);
  document.body.appendChild(panel);

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - offsetX) + 'px';
    panel.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  const API_BASE = window.location.origin;

  function generateAdminApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'rc_admin_';
    for (let i = 0; i < 24; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  }

  function apiFetch(path, opts) {
    return fetch(API_BASE + path, Object.assign({ credentials: 'include' }, opts));
  }

  function renderData(data) {
    content.innerHTML = '';

    const createBtn = document.createElement('button');
    createBtn.className = 'admin-create-btn';
    createBtn.innerText = '+ create admin api';
    createBtn.onclick = () => {
      const apiKey = generateAdminApiKey();
      apiFetch('/api/admin/create-admin-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      }).then(() => fetchData());
    };
    content.appendChild(createBtn);

    const adminKeysTitle = document.createElement('div');
    adminKeysTitle.className = 'admin-section-title';
    adminKeysTitle.innerText = 'Admin API Keys';
    content.appendChild(adminKeysTitle);

    if (data.adminApiKeys && data.adminApiKeys.length > 0) {
      data.adminApiKeys.forEach(k => {
        const item = document.createElement('div');
        item.className = 'admin-api-key-item';
        const keyText = document.createElement('div');
        keyText.className = 'admin-api-key-text';
        keyText.innerText = 'Key: ' + k.key;
        item.appendChild(keyText);
        if (k.assignedUser) {
          const userBadge = document.createElement('div');
          userBadge.className = 'admin-badge';
          userBadge.innerText = 'Assigned to: ' + k.assignedUser;
          userBadge.style.marginBottom = '8px';
          item.appendChild(userBadge);
        } else {
          const validateBtn = document.createElement('button');
          validateBtn.className = 'admin-btn blue';
          validateBtn.innerText = 'validate to';
          validateBtn.style.marginBottom = '8px';
          validateBtn.onclick = () => {
            validateBtn.style.display = 'none';
            const input = document.createElement('input');
            input.className = 'admin-api-validate-input';
            input.placeholder = 'Enter username...';
            input.onkeydown = (e) => {
              if (e.key === 'Enter') {
                const username = input.value.trim();
                if (username) {
                  apiFetch('/api/admin/assign-admin-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: k.key, username })
                  }).then(() => fetchData());
                }
              }
            };
            item.appendChild(input);
            input.focus();
          };
          item.appendChild(validateBtn);
        }
        content.appendChild(item);
      });
    } else {
      const noKeys = document.createElement('div');
      noKeys.className = 'admin-item-text';
      noKeys.innerText = 'No admin API keys created yet';
      noKeys.style.color = '#8a8a8a';
      content.appendChild(noKeys);
    }

    const usersTitle = document.createElement('div');
    usersTitle.className = 'admin-section-title';
    usersTitle.innerText = 'Registered Users (' + data.users.length + ')';
    content.appendChild(usersTitle);
    data.users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'admin-list-item';
      const text = document.createElement('div');
      text.className = 'admin-item-text';
      text.innerHTML = u.username + (u.admin ? ' <span class="admin-badge">admin</span>' : '') + (u.premium ? ' <span class="admin-badge" style="background:#e63946">premium</span>' : '');
      const setBtn = document.createElement('button');
      setBtn.className = 'admin-btn ' + (u.admin ? '' : 'green');
      setBtn.innerText = u.admin ? 'Unset Admin' : 'Set to Admin';
      setBtn.onclick = () => {
        apiFetch('/api/admin/set-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u.username, isAdmin: !u.admin })
        }).then(() => fetchData());
      };
      item.appendChild(text);
      item.appendChild(setBtn);
      content.appendChild(item);
    });

    const codesTitle = document.createElement('div');
    codesTitle.className = 'admin-section-title';
    codesTitle.innerText = 'Active Invite Codes (' + Object.keys(data.inviteCodes).length + ')';
    content.appendChild(codesTitle);
    Object.keys(data.inviteCodes).forEach(code => {
      const item = document.createElement('div');
      item.className = 'admin-list-item';
      const text = document.createElement('div');
      text.className = 'admin-item-text';
      const assignedUser = data.inviteCodes[code];
      const userStr = (assignedUser && assignedUser !== true) ? assignedUser : 'Anyone';
      text.innerText = 'Invite code: ' + code + ' (format: rebootcord-xxxxx-xxxxxxx)\nFor: ' + userStr;
      const btn = document.createElement('button');
      btn.className = 'admin-btn';
      btn.innerText = 'Revoke';
      btn.onclick = () => {
        apiFetch('/api/admin/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        }).then(() => fetchData());
      };
      item.appendChild(text);
      item.appendChild(btn);
      content.appendChild(item);
    });
  }

  function fetchData() {
    apiFetch('/api/admin/data', {})
      .then(r => r.json())
      .then(data => renderData(data))
      .catch(() => { content.innerText = 'Error fetching data. Make sure you are logged in and authorized.'; });
  }

  fetchData();
})();
