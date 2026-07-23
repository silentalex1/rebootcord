const BASE_DOC_TITLE = 'Reboot Cord';
let knownInboxIds = null;
let lastNotifyId = null;

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return 'RC';
  return name.trim().slice(0, 2).toUpperCase();
}

function updateDocumentTitle(count) {
  const n = Math.max(0, Number(count) || 0);
  const next = n > 0 ? (BASE_DOC_TITLE + ' (' + n + ')') : BASE_DOC_TITLE;
  if (document.title !== next) document.title = next;
}

function ensureNotifPromptStyles() {
  if (document.getElementById('rc-notif-prompt-style')) return;
  const style = document.createElement('style');
  style.id = 'rc-notif-prompt-style';
  style.textContent = '.rc-notif-prompt{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483001;display:flex;align-items:center;gap:12px;max-width:min(520px,92vw);padding:12px 14px;border-radius:12px;background:#121212;border:1px solid #2d2d2d;box-shadow:0 12px 40px rgba(0,0,0,.45);font-family:var(--font),sans-serif;color:#e8e8ec}.rc-notif-prompt-text{font-size:13px;line-height:1.4;flex:1}.rc-notif-prompt-actions{display:flex;gap:8px;flex-shrink:0}.rc-notif-prompt-btn{border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer}.rc-notif-prompt-btn.primary{background:#e63946;color:#fff}.rc-notif-prompt-btn.ghost{background:#1e1e1e;color:#9a9aa2;border:1px solid #2d2d2d}';
  document.head.appendChild(style);
}

function hideNotifPrompt() {
  const el = document.getElementById('rc-notif-prompt');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function showNotifPermissionPrompt() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  if (document.getElementById('rc-notif-prompt')) return;
  let status = '';
  try { status = localStorage.getItem('rc_notif_perm_asked') || ''; } catch (e) {}
  if (status === 'dismissed' || status === 'denied' || status === 'granted') return;
  ensureNotifPromptStyles();
  const box = document.createElement('div');
  box.id = 'rc-notif-prompt';
  box.className = 'rc-notif-prompt';
  const text = document.createElement('div');
  text.className = 'rc-notif-prompt-text';
  text.textContent = 'Allow notifications so you get alerted for new inbox messages.';
  const actions = document.createElement('div');
  actions.className = 'rc-notif-prompt-actions';
  const allow = document.createElement('button');
  allow.className = 'rc-notif-prompt-btn primary';
  allow.type = 'button';
  allow.textContent = 'Allow';
  const later = document.createElement('button');
  later.className = 'rc-notif-prompt-btn ghost';
  later.type = 'button';
  later.textContent = 'Not now';
  allow.onclick = function() {
    hideNotifPrompt();
    requestNotificationPermission(true);
  };
  later.onclick = function() {
    try { localStorage.setItem('rc_notif_perm_asked', 'dismissed'); } catch (e) {}
    hideNotifPrompt();
  };
  actions.appendChild(later);
  actions.appendChild(allow);
  box.appendChild(text);
  box.appendChild(actions);
  document.body.appendChild(box);
}

function showBrowserInboxNotification(messageText, messageId) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') {
    if (Notification.permission === 'default') showNotifPermissionPrompt();
    return;
  }
  try {
    const n = new Notification('New inbox message has been added check it out', {
      body: String(messageText || 'You have a new inbox message.'),
      tag: messageId ? ('rc-inbox-' + String(messageId)) : 'rc-inbox',
      renotify: true
    });
    n.onclick = function() {
      try { window.focus(); } catch (e) {}
      try { n.close(); } catch (e2) {}
    };
    setTimeout(function() { try { n.close(); } catch (e3) {} }, 12000);
  } catch (e) {}
}

function requestNotificationPermission(force) {
  if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    try { localStorage.setItem('rc_notif_perm_asked', Notification.permission); } catch (e) {}
    hideNotifPrompt();
    return Promise.resolve(Notification.permission);
  }
  if (!force) {
    showNotifPermissionPrompt();
    return Promise.resolve('default');
  }
  return Notification.requestPermission().then(function(p) {
    try { localStorage.setItem('rc_notif_perm_asked', p || 'default'); } catch (e) {}
    if (p === 'granted') hideNotifPrompt();
    return p;
  }).catch(function() { return 'default'; });
}

function bindNotificationGestureAsk() {
  if (window.__rcNotifGestureBound) return;
  window.__rcNotifGestureBound = true;
  const tryAsk = function() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    let status = '';
    try { status = localStorage.getItem('rc_notif_perm_asked') || ''; } catch (e) {}
    if (status === 'dismissed' || status === 'denied') return;
    requestNotificationPermission(true);
  };
  ['pointerdown', 'click', 'keydown', 'touchstart'].forEach(function(ev) {
    document.addEventListener(ev, tryAsk, { once: true, capture: true, passive: true });
  });
}

function countUnread(messages) {
  return (messages || []).filter(function(m) { return !m.read; }).length;
}

function trackNewMessages(messages) {
  const list = messages || [];
  const ids = {};
  list.forEach(function(m) { ids[String(m.id)] = true; });
  const isFirst = knownInboxIds === null;
  const fresh = [];
  if (!isFirst) {
    list.forEach(function(m) {
      if (!knownInboxIds[String(m.id)]) fresh.push(m);
    });
  }
  knownInboxIds = ids;
  if (fresh.length) {
    fresh.forEach(function(msg) {
      if (String(msg.id) === String(lastNotifyId)) return;
      lastNotifyId = msg.id;
      showBrowserInboxNotification(msg.body || msg.title || 'You have a new inbox message.', msg.id);
    });
  }
  updateDocumentTitle(countUnread(list));
}

function loadInbox(opts) {
  opts = opts || {};
  Promise.all([
    fetch('/api/inbox', { cache: 'no-store' }).then(r => r.json()),
    fetch('/api/me').then(r => r.json()).catch(() => ({ isAdmin: false }))
  ]).then(([data, me]) => {
    const isAdmin = !!(me && me.isAdmin);
    const list = document.getElementById('inboxList');
    if (!list) return;
    const messages = (data.success && data.messages) ? data.messages : [];
    trackNewMessages(messages);
    if (opts.silent) return;
    list.innerHTML = '';
    if (!messages.length) {
      const empty = document.createElement('div');
      empty.className = 'inbox-empty';
      empty.textContent = 'No messages yet.';
      list.appendChild(empty);
      return;
    }
    messages.forEach(m => {
      const titleText = String(m.title || '');
      const isRemoved = m.rank === 'removed' || /^Removed from\b/i.test(titleText) || /has removed you from their project/i.test(String(m.body || ''));
      const isNotice = !isRemoved && m.rank === 'notice';
      const item = document.createElement('div');
      item.className = 'inbox-item' + (m.read ? '' : ' unread') + (isRemoved ? ' removed' : (isNotice ? ' notice' : ''));

      const avatar = document.createElement('div');
      avatar.className = 'inbox-item-avatar' + (isRemoved ? ' removed' : (isNotice ? ' notice' : ''));
      if (isRemoved || isNotice) {
        const mark = document.createElement('span');
        mark.className = 'inbox-item-avatar-mark';
        mark.textContent = isRemoved ? 'X' : '!';
        avatar.appendChild(mark);
      } else {
        avatar.textContent = initials(m.sender);
      }

      const main = document.createElement('div');
      main.className = 'inbox-item-main';

      const top = document.createElement('div');
      top.className = 'inbox-item-top';
      const titleWrap = document.createElement('div');
      titleWrap.className = 'inbox-item-title-wrap';
      const title = document.createElement('span');
      title.className = 'inbox-item-title';
      title.textContent = m.title;
      titleWrap.appendChild(title);
      if (!m.read) {
        const badge = document.createElement('span');
        badge.className = 'inbox-unread-badge' + (isRemoved ? ' removed' : (isNotice ? ' notice' : ''));
        badge.textContent = 'unread';
        titleWrap.appendChild(badge);
      }
      const meta = document.createElement('div');
      meta.className = 'inbox-item-meta';
      const date = document.createElement('span');
      date.className = 'inbox-item-date';
      date.textContent = formatDate(m.ts);
      meta.appendChild(date);
      top.appendChild(titleWrap);
      top.appendChild(meta);

      const body = document.createElement('div');
      body.className = 'inbox-item-body';
      if (m.linkText && m.linkUrl && m.body.indexOf(m.linkText) !== -1) {
        const idx = m.body.indexOf(m.linkText);
        const before = m.body.slice(0, idx);
        const after = m.body.slice(idx + m.linkText.length);
        if (before) body.appendChild(document.createTextNode(before));
        const a = document.createElement('a');
        a.href = m.linkUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'inbox-item-link';
        a.textContent = m.linkText;
        a.onclick = (ev) => ev.stopPropagation();
        body.appendChild(a);
        if (after) body.appendChild(document.createTextNode(after));
      } else {
        body.textContent = m.body;
      }

      main.appendChild(top);
      if (m.rank && !isNotice && !isRemoved) {
        const rank = document.createElement('div');
        rank.className = 'inbox-item-rank';
        rank.textContent = m.rank;
        main.appendChild(rank);
      }
      main.appendChild(body);

      item.appendChild(avatar);
      item.appendChild(main);

      if (isAdmin) {
        item.classList.add('is-admin');
        const delBtn = document.createElement('button');
        delBtn.className = 'inbox-delete-btn';
        delBtn.textContent = 'Delete post';
        delBtn.onclick = (ev) => {
          ev.stopPropagation();
          fetch('/api/inbox/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: m.id })
          }).then(r => r.json()).then(res => {
            if (res.success) {
              item.remove();
              if (!list.children.length) {
                const empty = document.createElement('div');
                empty.className = 'inbox-empty';
                empty.textContent = 'No messages yet.';
                list.appendChild(empty);
              }
              loadInbox({ silent: true });
            }
          });
        };
        meta.appendChild(delBtn);
      }

      item.onclick = () => {
        if (!m.read) {
          fetch('/api/inbox/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: m.id })
          }).then(() => {
            m.read = true;
            item.classList.remove('unread');
            const badge = item.querySelector('.inbox-unread-badge');
            if (badge) badge.remove();
            updateDocumentTitle(countUnread(messages));
          });
        }
      };
      list.appendChild(item);
    });
  });
}

bindNotificationGestureAsk();
requestNotificationPermission(false);
loadInbox();

setInterval(function() {
  fetch('/api/inbox', { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(data) {
    if (!data.success || !data.messages) return;
    const prev = knownInboxIds ? Object.keys(knownInboxIds).length : 0;
    const beforeUnread = document.title.match(/\((\d+)\)/);
    trackNewMessages(data.messages);
    const after = Object.keys(knownInboxIds || {}).length;
    const unreadNow = countUnread(data.messages);
    const unreadBefore = beforeUnread ? parseInt(beforeUnread[1], 10) : 0;
    if (after !== prev || unreadNow !== unreadBefore) loadInbox();
  }).catch(function() {});
}, 2000);

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') loadInbox();
});
window.addEventListener('focus', function() { loadInbox({ silent: true }); });
