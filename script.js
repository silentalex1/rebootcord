function showTab(n) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(['register-tab', 'login-tab'][n]).style.display = 'block';
    document.querySelectorAll('.tab-btn')[n].classList.add('active');
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    let invite = document.getElementById('invite-code').value.trim();
    if (!invite.startsWith('rebootcord-')) invite = 'rebootcord-' + invite;
    const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, invite })
    });
    const data = await res.json();
    if (data.success) {
        alert('Account created successfully!');
        window.location.href = '/dashboard';
    } else {
        alert(data.message);
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
        window.location.href = '/dashboard';
    } else {
        alert(data.message);
    }
});
