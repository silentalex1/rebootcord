function showTab(n) {
    document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === n));
    document.getElementById('tab-register').classList.toggle('hidden', n !== 0);
    document.getElementById('tab-login').classList.toggle('hidden', n !== 1);
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    let invite = document.getElementById('invite-code').value.trim();
    const msg = document.getElementById('reg-msg');
    if (!username || !password || !invite) { msg.textContent = 'All fields required'; return; }
    if (!invite.startsWith('rebootcord-')) invite = 'rebootcord-' + invite;
    const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, invite })
    });
    const data = await res.json();
    if (data.success) {
        localStorage.setItem('rc_user', username);
        window.location.href = '/dashboard';
    } else {
        msg.textContent = data.message;
    }
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const msg = document.getElementById('login-msg');
    if (!username || !password) { msg.textContent = 'All fields required'; return; }
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
        localStorage.setItem('rc_user', username);
        window.location.href = '/dashboard';
    } else {
        msg.textContent = data.message;
    }
}
