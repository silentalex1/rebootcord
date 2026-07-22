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
  fetch('/api/inbox').then(r => r.json()).then(data => {
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
      if (!m.read) {
        const dot = document.createElement('span');
        dot.className = 'inbox-unread-dot';
        titleWrap.appendChild(dot);
      }
      const title = document.createElement('span');
      title.className = 'inbox-item-title';
      title.textContent = m.title;
      titleWrap.appendChild(title);
      const date = document.createElement('span');
      date.className = 'inbox-item-date';
      date.textContent = formatDate(m.ts);
      top.appendChild(titleWrap);
      top.appendChild(date);

      const body = document.createElement('div');
      body.className = 'inbox-item-body';
      body.textContent = m.body;

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

      item.onclick = () => {
        if (!m.read) {
          fetch('/api/inbox/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: m.id })
          }).then(() => {
            m.read = true;
            item.classList.remove('unread');
            const dot = item.querySelector('.inbox-unread-dot');
            if (dot) dot.remove();
          });
        }
      };
      list.appendChild(item);
    });
  });
}

loadInbox();
