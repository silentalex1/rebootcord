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
  document.title = n > 0 ? (BASE_DOC_TITLE + ' (' + n + ')') : BASE_DOC_TITLE;
}

function showBrowserInboxNotification(messageText, messageId) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
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
  } catch (e) {}
}

function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    try { localStorage.setItem('rc_notif_perm_asked', '1'); } catch (e) {}
    return Promise.resolve(Notification.permission);
  }
  try { localStorage.setItem('rc_notif_perm_asked', '1'); } catch (e) {}
  return Notification.requestPermission().catch(function() { return 'default'; });
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
    fetch('/api/inbox').then(r => r.json()),
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
      avatar.textContent = isRemoved ? '×' : (isNotice ? '!' : initials(m.sender));

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

requestNotificationPermission().finally(function() {
  loadInbox();
});

setInterval(function() {
  fetch('/api/inbox').then(function(r) { return r.json(); }).then(function(data) {
    if (!data.success || !data.messages) return;
    const prev = knownInboxIds ? Object.keys(knownInboxIds).length : 0;
    const beforeUnread = document.title.match(/\((\d+)\)/);
    trackNewMessages(data.messages);
    const after = Object.keys(knownInboxIds || {}).length;
    const unreadNow = countUnread(data.messages);
    const unreadBefore = beforeUnread ? parseInt(beforeUnread[1], 10) : 0;
    if (after !== prev || unreadNow !== unreadBefore) loadInbox();
  }).catch(function() {});
}, 5000);
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') loadInbox();
});
