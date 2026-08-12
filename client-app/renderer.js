const { ipcRenderer } = require('electron');

let currentUser = null;
let hostSelectedType = null;

async function apiRequest(method, url, data = null) {
  const result = await ipcRenderer.invoke('api-request', { method, url, data });
  return result;
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    alert('Please enter username and password');
    return;
  }
  
  const result = await apiRequest('POST', '/login', { username, password });
  
  if (result.success && result.data.success) {
    currentUser = username;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('main').style.display = 'flex';
    document.getElementById('userName').textContent = username;
    document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();
    loadDashboard();
  } else {
    alert('Login failed: ' + (result.data?.message || 'Unknown error'));
  }
}

function logout() {
  currentUser = null;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('main').style.display = 'none';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(pageName + 'Page').classList.add('active');
  event.currentTarget.classList.add('active');
  
  const titles = {
    dashboard: 'Dashboard',
    servers: 'Servers',
    console: 'Console',
    host: 'Host'
  };
  document.getElementById('pageTitle').textContent = titles[pageName];
  
  if (pageName === 'servers') {
    loadServers();
  }
}

async function loadDashboard() {
  const result = await apiRequest('GET', '/api/projects');
  if (result.success && result.data.projects) {
    document.getElementById('serverCount').textContent = result.data.projects.length;
  }
}

async function loadServers() {
  const result = await apiRequest('GET', '/api/projects');
  const grid = document.getElementById('serversGrid');
  grid.innerHTML = '';
  
  if (result.success && result.data.projects) {
    result.data.projects.forEach(project => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title">${project.name}</div>
          <div class="card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${project.type === 'minecraft' ? '<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M12 2v20"/><path d="M2 12h20"/>' : '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>'}
            </svg>
          </div>
        </div>
        <div class="card-body">${project.type === 'minecraft' ? 'Minecraft Server' : 'Discord Bot'}</div>
        <div class="card-stat">${project.running ? 'Running' : 'Stopped'}</div>
        <div class="card-stat-label">${project.running ? 'Active' : 'Inactive'}</div>
      `;
      grid.appendChild(card);
    });
  }
}

function refresh() {
  const activePage = document.querySelector('.page.active');
  if (activePage.id === 'dashboardPage') {
    loadDashboard();
  } else if (activePage.id === 'serversPage') {
    loadServers();
  }
}

function logToConsole(message, type = 'info') {
  const console = document.getElementById('consoleOutput');
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  console.appendChild(line);
  console.scrollTop = console.scrollHeight;
}

function onHostVersionChange() {
  const select = document.getElementById('hostVersionSelect');
  const checkbox = document.getElementById('hostCheckVersion');
  checkbox.checked = !!select.value;
  updatePingButton();
}

function onHostTypeSelect(btn) {
  document.querySelectorAll('.host-type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  hostSelectedType = btn.getAttribute('data-type');
  const checkbox = document.getElementById('hostCheckType');
  checkbox.checked = true;
  updatePingButton();
}

function updatePingButton() {
  const versionChecked = document.getElementById('hostCheckVersion').checked;
  const typeChecked = document.getElementById('hostCheckType').checked;
  document.getElementById('pingWebsiteBtn').disabled = !(versionChecked && typeChecked);
}

async function pingWebsite() {
  const statusEl = document.getElementById('hostStatus');
  const version = document.getElementById('hostVersionSelect').value;
  const serverType = hostSelectedType;

  if (!currentUser) {
    statusEl.textContent = 'Log in first before pinging the website.';
    statusEl.className = 'host-status err';
    return;
  }
  if (!version || !serverType) {
    statusEl.textContent = 'Select a version and server type first.';
    statusEl.className = 'host-status err';
    return;
  }

  const btn = document.getElementById('pingWebsiteBtn');
  btn.disabled = true;
  statusEl.textContent = 'Pinging rebootcord.world...';
  statusEl.className = 'host-status';

  const result = await apiRequest('POST', '/api/minecraft/ping', { version, serverType });

  if (result.success && result.data && result.data.success) {
    statusEl.textContent = 'Ping received — finish setup in your browser dashboard.';
    statusEl.className = 'host-status ok';
    logToConsole('Pinged website for ' + serverType + ' ' + version, 'success');
  } else {
    const msg = (result.data && result.data.message) || result.error || 'Failed to reach the website.';
    statusEl.textContent = msg;
    statusEl.className = 'host-status err';
    logToConsole('Ping failed: ' + msg, 'error');
  }

  updatePingButton();
}

document.addEventListener('DOMContentLoaded', () => {
  logToConsole('Reboot Cord Client initialized');
});