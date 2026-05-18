let selectedLang = null;

function showCreateModal() {
    document.getElementById('create-modal').classList.remove('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('step-2').classList.add('hidden');
    selectedLang = null;
    document.getElementById('create-server-btn').classList.add('bg-zinc-700', 'cursor-not-allowed');
    document.getElementById('create-server-btn').classList.remove('bg-white');
}

function selectLang(el) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'bg-zinc-800');
    });
    el.classList.add('border-blue-500', 'bg-zinc-800');
    selectedLang = el.dataset.lang;
    const btn = document.getElementById('create-server-btn');
    btn.classList.remove('bg-zinc-700', 'cursor-not-allowed');
    btn.classList.add('bg-white');
}

function startCreation() {
    const name = document.getElementById('project-name').value.trim();
    if (!name || !selectedLang) return;
    
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    document.getElementById('setup-title').textContent = `Setting up ${name}...`;

    let progress = 0;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');

    const interval = setInterval(() => {
        progress += Math.random() * 12;
        if (progress > 100) progress = 100;
        bar.style.width = `${progress}%`;
        text.textContent = `${Math.floor(progress)}%`;
        if (progress === 100) {
            clearInterval(interval);
            setTimeout(() => {
                alert("Server created successfully!");
                document.getElementById('create-modal').classList.add('hidden');
            }, 800);
        }
    }, 120);
}

fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
        document.getElementById('active-users').textContent = data.activeUsers;
    })
    .catch(() => {});
