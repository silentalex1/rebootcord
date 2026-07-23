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

function loadInbox() {
  Promise.all([
    fetch('/api/inbox').then(r => r.json()),
    fetch('/api/me').then(r => r.json()).catch(() => ({ isAdmin: false }))
  ]).then(([data, me]) => {
    const isAdmin = !!(me && me.isAdmin);
    const list = document.getElementById('inboxList');
    list.innerHTML = '';
    if (!data.success || !data.messages || !data.messages.length) {
      const empty = document.createElement('div');
      empty.className = 'inbox-empty';
      empty.textContent = 'No messages yet.';
      list.appendChild(empty);
      return;
    }
    data.messages.forEach(m => {
      const isNotice = m.rank === 'notice';
      const item = document.createElement('div');
      item.className = 'inbox-item' + (m.read ? '' : ' unread') + (isNotice ? ' notice' : '');

      const avatar = document.createElement('div');
      avatar.className = 'inbox-item-avatar' + (isNotice ? ' notice' : '');
      avatar.textContent = isNotice ? '!' : initials(m.sender);

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
        badge.className = 'inbox-unread-badge' + (isNotice ? ' notice' : '');
        badge.textContent = 'unread';
        titleWrap.appendChild(badge);
      }
      const date = document.createElement('span');
      date.className = 'inbox-item-date';
      date.textContent = formatDate(m.ts);
      top.appendChild(titleWrap);
      top.appendChild(date);

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
      if (m.rank && !isNotice) {
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
            }
          });
        };
        item.appendChild(delBtn);
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
          });
        }
      };
      list.appendChild(item);
    });
  });
}

loadInbox();
