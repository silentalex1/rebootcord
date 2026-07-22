function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
      const item = document.createElement('div');
      item.className = 'inbox-item' + (m.read ? '' : ' unread');
      const top = document.createElement('div');
      top.className = 'inbox-item-top';
      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.gap = '8px';
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
      item.appendChild(top);
      item.appendChild(body);
      item.onclick = () => {
        if (!m.read) {
          fetch('/api/inbox/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: m.id })
          }).then(() => { m.read = true; item.classList.remove('unread'); item.querySelector('.inbox-unread-dot').remove(); });
        }
      };
      list.appendChild(item);
    });
  });
}

loadInbox();
