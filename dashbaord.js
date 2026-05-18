function uploadBot() {
    alert("Bot upload system coming soon");
}

fetch('/api/stats')
    .then(res => res.json())
    .then(data => {
        document.getElementById('active-users').textContent = data.activeUsers;
    })
    .catch(() => {});
