const MC_VERSIONS = [
  "1.21.5","1.21.4","1.21.3","1.21.2","1.21.1","1.21",
  "1.20.6","1.20.5","1.20.4","1.20.3","1.20.2","1.20.1","1.20",
  "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
  "1.18.2","1.18.1","1.18","1.17.1","1.17",
  "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1","1.16",
  "1.15.2","1.15.1","1.15","1.14.4","1.14.3","1.14.2","1.14.1","1.14",
  "1.13.2","1.13.1","1.13","1.12.2","1.12.1","1.12","1.8.9","1.8.8","1.7.10"
];
const BOT_LANGS = ["JavaScript","TypeScript","Python","Lua","Java","Go","Rust","Ruby","C#","PHP","Kotlin","Dart"];
const MC_SERVER_TYPES = ["Vanilla","Paper","Forge","Fabric","Spigot","Purpur"];
const MAX_LOGS = 500;

const FONTS = [
  { label: "Default", value: "" },
  { label: "Syne", value: "'Syne', sans-serif" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];

const state = {
  page: "projects",
  projects: [],
  currentProject: null,
  showNewModal: false,
  loading: false,
  newType: "discord",
  newName: "",
  newLang: "JavaScript",
  newMcVersion: "1.21.5",
  newMcServerType: "Vanilla",
  newMcIp: "",
  editorFile: "",
  codeContent: "",
  mcView: "overview",
  mcCmd: "",
  botLogs: [],
  mcLogs: [],
  mcFiles: [],
  mcMods: [],
  mcBackups: [],
  username: "",
};

let ws;

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + location.host);
  ws.onmessage = function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'log') {
        const p = state.projects.find(function(x) { return x.id == data.projectId; });
        if (!p) return;
        const tgt = p.type === 'minecraft' ? state.mcLogs : state.botLogs;
        tgt.push({ t: getTime(), type: data.type, msg: data.msg });
        trimLogs(tgt);
        if (state.currentProject && state.currentProject.id == data.projectId) {
          scheduleRender();
        }
      }
    } catch(err) {}
  };
  ws.onclose = function() {
    setTimeout(connectWS, 2000);
  };
}

connectWS();

let renderPending = false;

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(function() {
    renderPending = false;
    render();
  });
}

function scrollConsolesToBottom() {
  requestAnimationFrame(function() {
    const bodies = document.querySelectorAll(".console-body,.mc-console-body");
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].scrollTop = bodies[i].scrollHeight;
    }
  });
}

function trimLogs(arr) {
  if (arr.length > MAX_LOGS) {
    arr.splice(0, arr.length - MAX_LOGS);
  }
}

function getTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function el(tag, attrs) {
  const node = document.createElement(tag);
  if (attrs) {
    const keys = Object.keys(attrs);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = attrs[k];
      if (k === "className") {
        node.className = v;
      } else if (k === "style" && typeof v === "object") {
        Object.assign(node.style, v);
      } else {
        node.setAttribute(k, v);
      }
    }
  }
  for (let i = 2; i < arguments.length; i++) {
    const c = arguments[i];
    if (c == null) continue;
    if (typeof c === "string") {
      node.appendChild(document.createTextNode(c));
    } else {
      node.appendChild(c);
    }
  }
  return node;
}

function svgIcon(type, color) {
  const icons = {
    chart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    plug: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16.5V12a6 6 0 0 0-12 0v4.5"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="3"/><line x1="16" y1="8" x2="16" y2="3"/></svg>',
    terminal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    backup: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
    save: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
    play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    stop: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    gear: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    pkg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    revert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    discord: '<svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69z"/></svg>',
    pickaxe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4"/><path d="m12.5 7.5-5 5L5 15l4-1 6.5-6.5"/><path d="m18 2-1.5 1.5"/><path d="M5.5 18.5 2 22"/></svg>',
    logout: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  };
  const wrap = document.createElement("span");
  wrap.className = "svg-icon";
  if (color) wrap.style.color = color;
  wrap.innerHTML = icons[type] || icons.doc;
  return wrap;
}

function saveProjects() {
  const proj = state.projects.find(function(x) {
    if (state.currentProject && x.id === state.currentProject.id) return true;
    return false;
  });
  if (proj && state.currentProject) {
    proj.files = state.currentProject.files || {};
    proj.running = state.currentProject.running;
    proj._mcFiles = state.mcFiles;
    proj._mcMods = state.mcMods;
    proj._mcBackups = state.mcBackups;
    proj.serverAbout = state.currentProject.serverAbout;
    proj.serverAboutFont = state.currentProject.serverAboutFont;
  }
  fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projects: state.projects })
  });
}

function saveCurrentFile() {
  if (!state.currentProject || !state.editorFile) return;
  state.currentProject.files = state.currentProject.files || {};
  state.currentProject.files[state.editorFile] = state.codeContent;
  const proj = state.projects.find(function(x) { return x.id === state.currentProject.id; });
  if (proj) proj.files = state.currentProject.files;
  saveProjects();
}

function switchFile(filename) {
  saveCurrentFile();
  state.editorFile = filename;
  state.codeContent = "";
  if (state.currentProject.files && state.currentProject.files[filename]) {
    state.codeContent = state.currentProject.files[filename];
  }
  scheduleRender();
}

function render() {
  const app = document.getElementById("app");
  const frag = document.createDocumentFragment();
  if (state.loading) {
    frag.appendChild(renderLoading());
  } else if (state.page === "projects") {
    frag.appendChild(renderProjectsPage());
  } else if (state.page === "bot-dashboard") {
    frag.appendChild(renderBotDashboard());
  } else if (state.page === "mc-dashboard") {
    frag.appendChild(renderMcDashboard());
  }
  app.textContent = "";
  app.appendChild(frag);
  scrollConsolesToBottom();
}

function renderLoading() {
  const isMc = state.newType === "minecraft";
  let loadingClass = "loading-screen";
  if (isMc) loadingClass += " mc";
  const wrap = el("div", { className: loadingClass });
  const iconWrap = el("div", { className: "loading-icon-wrap" });
  iconWrap.appendChild(svgIcon(isMc ? "pickaxe" : "discord"));
  wrap.appendChild(iconWrap);
  const bar = el("div", { className: "loading-bar" });
  let fillClass = "loading-bar-fill";
  if (isMc) fillClass += " mc";
  bar.appendChild(el("div", { className: fillClass }));
  wrap.appendChild(bar);
  wrap.appendChild(el("div", { className: "loading-text" }, isMc ? "Setting up your Minecraft server..." : "Starting your bot..."));
  setTimeout(function() {
    state.loading = false;
    state.page = state.newType === "minecraft" ? "mc-dashboard" : "bot-dashboard";
    state.showNewModal = false;
    render();
  }, 2200);
  return wrap;
}

function renderNav() {
  const nav = el("nav", { className: "nav" });
  const logo = el("div", { className: "nav-logo" });
  logo.appendChild(el("span", { className: "nav-logo-r" }, "Reboot"));
  logo.appendChild(el("span", { className: "nav-logo-t" }, " Cord"));
  const right = el("div", { className: "nav-right" });
  right.appendChild(el("span", { className: "nav-user" }, state.username));
  const logoutBtn = el("button", { className: "btn-logout-nav" });
  logoutBtn.addEventListener("click", function() {
    fetch("/logout", { method: "POST" }).finally(function() {
      window.location.href = "/";
    });
  });
  logoutBtn.appendChild(svgIcon("logout"));
  logoutBtn.appendChild(document.createTextNode(" Logout"));
  right.appendChild(logoutBtn);
  nav.appendChild(logo);
  nav.appendChild(right);
  return nav;
}

function renderProjectsPage() {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderNav());
  const page = el("div", { className: "projects-page" });
  const header = el("div", { className: "projects-header" });
  const titleDiv = el("div", { className: "projects-title" });
  titleDiv.appendChild(el("h1", null, "Your Projects"));
  titleDiv.appendChild(el("p", null, "Manage your Discord bots and Minecraft servers"));
  header.appendChild(titleDiv);
  const btnNew = el("button", { className: "btn-new" });
  btnNew.addEventListener("click", function() {
    state.showNewModal = true;
    scheduleRender();
  });
  btnNew.appendChild(svgIcon("plus"));
  btnNew.appendChild(document.createTextNode(" New Project"));
  header.appendChild(btnNew);
  page.appendChild(header);
  if (state.projects.length === 0) {
    const empty = el("div", { className: "empty-state" });
    const emptyIcon = el("div", { className: "empty-icon" });
    emptyIcon.appendChild(svgIcon("folder"));
    empty.appendChild(emptyIcon);
    empty.appendChild(el("div", { className: "empty-title" }, "No projects yet"));
    empty.appendChild(el("div", { className: "empty-sub" }, "Create your first Discord bot or Minecraft server to get started."));
    const emptyBtn = el("button", { className: "btn-new", style: { margin: "0 auto" } });
    emptyBtn.addEventListener("click", function() {
      state.showNewModal = true;
      scheduleRender();
    });
    emptyBtn.appendChild(svgIcon("plus"));
    emptyBtn.appendChild(document.createTextNode(" Create Project"));
    empty.appendChild(emptyBtn);
    page.appendChild(empty);
  } else {
    const grid = el("div", { className: "projects-grid" });
    for (let i = 0; i < state.projects.length; i++) {
      grid.appendChild(renderProjectCard(state.projects[i]));
    }
    page.appendChild(grid);
  }
  frag.appendChild(page);
  if (state.showNewModal) {
    frag.appendChild(renderModal());
  }
  return frag;
}

function renderProjectCard(p) {
  const isMc = p.type === "minecraft";
  let cardClass = "project-card";
  if (isMc) cardClass += " mc";
  else cardClass += " discord";
  const card = el("div", { className: cardClass });
  const top = el("div", { className: "card-top" });
  let iconClass = "card-icon";
  if (isMc) iconClass += " mc";
  else iconClass += " discord";
  const iconWrap = el("div", { className: iconClass });
  iconWrap.appendChild(svgIcon(isMc ? "pickaxe" : "discord"));
  top.appendChild(iconWrap);
  let dotClass = "card-dot";
  if (!p.running) dotClass += " stopped";
  top.appendChild(el("div", { className: dotClass }));
  card.appendChild(top);
  card.appendChild(el("div", { className: "card-name" }, p.name));
  const tags = el("div", { className: "card-tags" });
  const labelText = isMc ? p.serverType + " " + p.version : p.lang;
  tags.appendChild(el("span", { className: "tag" }, labelText));
  let runClass = "tag ";
  if (p.running) runClass += "running";
  else runClass += "stopped";
  tags.appendChild(el("span", { className: runClass }, p.running ? "Running" : "Stopped"));
  if (isMc && p.port) {
    tags.appendChild(el("span", { className: "tag discord-tag" }, "Port: " + p.port));
  }
  card.appendChild(tags);
  const actions = el("div", { className: "card-actions" });
  const manage = el("button", { className: "btn-manage" }, "Manage");
  manage.addEventListener("click", function() { openProject(p.id); });
  let toggleClass = "btn-card-toggle ";
  if (p.running) toggleClass += "running";
  else toggleClass += "stopped";
  const stopStartBtn = el("button", { className: toggleClass });
  stopStartBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    toggleRunning(p);
  });
  stopStartBtn.appendChild(svgIcon(p.running ? "stop" : "play"));
  const del = el("button", { className: "btn-delete" }, "Delete");
  del.addEventListener("click", function() { deleteProject(p.id); });
  actions.appendChild(manage);
  actions.appendChild(stopStartBtn);
  actions.appendChild(del);
  card.appendChild(actions);
  return card;
}

function renderModal() {
  const overlay = el("div", { className: "modal-overlay" });
  overlay.addEventListener("click", function(ev) {
    if (ev.target === overlay) {
      state.showNewModal = false;
      scheduleRender();
    }
  });
  const modal = el("div", { className: "modal" });
  modal.appendChild(el("h2", null, "New Project"));
  const isMc = state.newType === "minecraft";
  const tabs = el("div", { className: "modal-type-tabs" });

  let disClass = "type-tab";
  if (!isMc) disClass += " active discord";
  const tabDis = el("button", { className: disClass });
  tabDis.addEventListener("click", function() {
    state.newType = "discord";
    scheduleRender();
  });
  const disIconWrap = el("div", { className: "type-tab-icon" });
  disIconWrap.appendChild(svgIcon("discord"));
  tabDis.appendChild(disIconWrap);
  tabDis.appendChild(document.createTextNode("Discord Bot"));

  let mcClass = "type-tab";
  if (isMc) mcClass += " active mc";
  const tabMc = el("button", { className: mcClass });
  tabMc.addEventListener("click", function() {
    state.newType = "minecraft";
    scheduleRender();
  });
  const mcIconWrap = el("div", { className: "type-tab-icon" });
  mcIconWrap.appendChild(svgIcon("pickaxe"));
  tabMc.appendChild(mcIconWrap);
  tabMc.appendChild(document.createTextNode("Minecraft Server"));

  tabs.appendChild(tabDis);
  tabs.appendChild(tabMc);
  modal.appendChild(tabs);

  const nameGroup = el("div", { className: "form-group" });
  nameGroup.appendChild(el("label", { className: "form-label" }, "Project Name"));
  const namePlaceholder = isMc ? "e.g. my-survival-server" : "e.g. my-bot";
  const nameInput = el("input", { className: "form-input", placeholder: namePlaceholder, value: state.newName });
  nameInput.addEventListener("input", function() {
    state.newName = nameInput.value;
    const btn = document.getElementById("createBtn");
    if (btn) btn.disabled = !state.newName.trim();
  });
  nameGroup.appendChild(nameInput);
  modal.appendChild(nameGroup);

  if (isMc) {
    const stGroup = el("div", { className: "form-group" });
    stGroup.appendChild(el("label", { className: "form-label" }, "Server Type"));
    const stGrid = el("div", { className: "lang-grid" });
    for (let i = 0; i < MC_SERVER_TYPES.length; i++) {
      const t = MC_SERVER_TYPES[i];
      let stClass = "lang-btn mc";
      if (t === state.newMcServerType) stClass += " active";
      const btn = el("button", { className: stClass }, t);
      btn.addEventListener("click", function() {
        state.newMcServerType = t;
        scheduleRender();
      });
      stGrid.appendChild(btn);
    }
    stGroup.appendChild(stGrid);
    modal.appendChild(stGroup);

    const vGroup = el("div", { className: "form-group" });
    vGroup.appendChild(el("label", { className: "form-label" }, "Minecraft Version"));
    const sel = el("select", { className: "form-select" });
    for (let i = 0; i < MC_VERSIONS.length; i++) {
      const v = MC_VERSIONS[i];
      const opt = el("option", { value: v }, v);
      if (v === state.newMcVersion) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", function() {
      state.newMcVersion = sel.value;
    });
    vGroup.appendChild(sel);
    modal.appendChild(vGroup);

    const ipGroup = el("div", { className: "form-group" });
    ipGroup.appendChild(el("label", { className: "form-label" }, "Server IP / Domain"));
    const ipInput = el("input", { className: "form-input", placeholder: "e.g. play.myserver.net", value: state.newMcIp });
    ipInput.addEventListener("input", function() {
      state.newMcIp = ipInput.value;
    });
    ipGroup.appendChild(ipInput);
    ipGroup.appendChild(el("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" } }, "Players will connect with this address."));
    modal.appendChild(ipGroup);
  } else {
    const lGroup = el("div", { className: "form-group" });
    lGroup.appendChild(el("label", { className: "form-label" }, "Language"));
    const lgrid = el("div", { className: "lang-grid" });
    for (let i = 0; i < BOT_LANGS.length; i++) {
      const lang = BOT_LANGS[i];
      let btnClass = "lang-btn";
      if (lang === state.newLang) btnClass += " active";
      const btn = el("button", { className: btnClass }, lang);
      btn.addEventListener("click", function() {
        state.newLang = lang;
        scheduleRender();
      });
      lgrid.appendChild(btn);
    }
    lGroup.appendChild(lgrid);
    modal.appendChild(lGroup);
  }

  const actions = el("div", { className: "modal-actions" });
  const cancelBtn = el("button", { className: "btn-cancel" }, "Cancel");
  cancelBtn.addEventListener("click", function() {
    state.showNewModal = false;
    scheduleRender();
  });
  actions.appendChild(cancelBtn);
  let cClass = "btn-create";
  if (isMc) cClass += " mc";
  const createBtn = el("button", { className: cClass, id: "createBtn" }, "Create");
  createBtn.addEventListener("click", createProject);
  if (!state.newName.trim()) {
    createBtn.disabled = true;
  }
  actions.appendChild(createBtn);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}

function getDefaultFilename(p) {
  if (p.lang === "Python") return "main.py";
  if (p.lang === "Ruby") return "main.rb";
  if (p.lang === "Go") return "main.go";
  if (p.lang === "Rust") return "main.rs";
  if (p.lang === "Java" || p.lang === "Kotlin") return "Main.java";
  return "index.js";
}

function getDefaultCode(p) {
  if (p.lang === "Python") return "import os\n\nprint('Bot starting...')\n";
  if (p.lang === "TypeScript") return "console.log('Bot starting...');\n";
  return "console.log('Bot starting...');\n";
}

function createProject() {
  if (!state.newName.trim()) return;
  const id = Date.now();
  let rawIp = state.newMcIp;
  if (!rawIp) {
    rawIp = state.newName.toLowerCase().replace(/\s+/g, "-") + ".rebootcord.io";
  }
  const p = {
    id: id,
    name: state.newName.trim(),
    type: state.newType,
    lang: state.newLang,
    version: state.newMcVersion,
    serverType: state.newMcServerType,
    ip: rawIp,
    running: false,
    files: {},
    serverAbout: "",
    serverAboutFont: "",
    _mcFiles: [],
    _mcMods: [],
    _mcBackups: []
  };
  if (p.type === "discord") {
    const fname = getDefaultFilename(p);
    p.files[fname] = getDefaultCode(p);
  }
  state.projects.push(p);
  state.currentProject = p;
  state.newName = "";
  state.newMcIp = "";
  state.newMcServerType = "Vanilla";
  state.mcView = "overview";
  state.mcFiles = [];
  state.mcMods = [];
  state.mcBackups = [];
  state.botLogs = [];
  state.mcLogs = [];
  if (p.type === "discord") {
    state.editorFile = getDefaultFilename(p);
    state.codeContent = p.files[state.editorFile];
  } else {
    state.editorFile = "";
    state.codeContent = "";
  }
  state.loading = true;
  saveProjects();
  render();
}

function openProject(id) {
  let found = null;
  for (let i = 0; i < state.projects.length; i++) {
    if (state.projects[i].id === id) {
      found = state.projects[i];
      break;
    }
  }
  if (!found) return;
  state.currentProject = found;
  if (found.type === "minecraft") {
    state.page = "mc-dashboard";
  } else {
    state.page = "bot-dashboard";
  }
  state.mcView = "overview";
  state.mcFiles = found._mcFiles || [];
  state.mcMods = found._mcMods || [];
  state.mcBackups = found._mcBackups || [];
  state.botLogs = [];
  state.mcLogs = [];
  if (found.type === "discord") {
    state.editorFile = getDefaultFilename(found);
    state.codeContent = "";
    if (found.files && found.files[state.editorFile]) {
      state.codeContent = found.files[state.editorFile];
    }
    render();
  } else {
    fetch('/api/projects/' + id + '/dir').then(function(r) { return r.json(); }).then(function(d) {
      if (d.success) state.mcFiles = d.files;
      render();
    });
  }
}

function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  const newProjects = [];
  for (let i = 0; i < state.projects.length; i++) {
    if (state.projects[i].id !== id) {
      newProjects.push(state.projects[i]);
    }
  }
  state.projects = newProjects;
  saveProjects();
  render();
}

function toggleRunning(p) {
  p.running = !p.running;
  for (let i = 0; i < state.projects.length; i++) {
    if (state.projects[i].id === p.id) {
      state.projects[i].running = p.running;
    }
  }
  if (p.running) {
    fetch('/api/projects/' + p.id + '/start', { method: "POST" }).then(function() { render(); });
  } else {
    fetch('/api/projects/' + p.id + '/stop', { method: "POST" }).then(function() { render(); });
  }
  render();
}

function flashSaveBtn(btn) {
  btn.textContent = "Saved!";
  btn.style.color = "var(--green)";
  setTimeout(function() {
    btn.textContent = "Save";
    btn.style.color = "";
  }, 1400);
}

function installPkg() {
  const input = document.getElementById("pkgInput");
  let v = "";
  if (input) v = input.value.trim();
  if (!v || !ws || !state.currentProject) return;
  const payload = JSON.stringify({ event: 'install', projectId: state.currentProject.id, pkg: v });
  ws.send(payload);
  if (input) input.value = "";
}

function renderBotDashboard() {
  let p = state.currentProject;
  if (!p) p = {};
  const frag = document.createDocumentFragment();

  const dnav = el("nav", { className: "dash-nav discord-nav" });
  const backBtn = el("button", { className: "btn-back" });
  backBtn.addEventListener("click", function() {
    state.page = "projects";
    render();
  });
  backBtn.appendChild(svgIcon("back"));
  backBtn.appendChild(document.createTextNode(" Back"));
  dnav.appendChild(backBtn);

  const discordIcon = el("div", { className: "dash-nav-discord-icon" });
  discordIcon.appendChild(svgIcon("discord"));
  dnav.appendChild(discordIcon);

  dnav.appendChild(el("span", { className: "dash-project-name discord-name" }, p.name || "Bot Project"));
  const langTag = el("span", { className: "tag discord-tag", style: { fontSize: "11px" } }, p.lang || "");
  dnav.appendChild(langTag);

  const dtags = el("div", { className: "dash-tags" });
  let cClass = "status-chip";
  if (p.running) cClass += " discord";
  else cClass += " stopped";
  const chip = el("div", { className: cClass });
  let dotClass = "status-dot";
  if (p.running) dotClass += " discord";
  else dotClass += " stopped";
  chip.appendChild(el("div", { className: dotClass }));
  chip.appendChild(document.createTextNode(p.running ? " Running" : " Stopped"));
  dtags.appendChild(chip);
  let togClass = p.running ? "btn-stop-discord" : "btn-start-discord";
  const toggleBtn = el("button", { className: togClass });
  toggleBtn.addEventListener("click", function() { toggleRunning(p); });
  toggleBtn.appendChild(svgIcon(p.running ? "stop" : "play"));
  toggleBtn.appendChild(document.createTextNode(p.running ? " Stop" : " Start"));
  dtags.appendChild(toggleBtn);
  dnav.appendChild(dtags);
  frag.appendChild(dnav);

  const dash = el("div", { className: "dashboard discord-dash" });
  const sb = el("div", { className: "sidebar discord-sidebar" });

  const waveBg = el("div", { className: "discord-wave-bg" });
  sb.appendChild(waveBg);

  const filesSection = el("div", { className: "sidebar-section" });
  const filesLbl = el("div", { className: "sidebar-label discord-label" });
  filesLbl.appendChild(svgIcon("folder"));
  filesLbl.appendChild(document.createTextNode(" Files"));
  filesSection.appendChild(filesLbl);

  const mainFile = getDefaultFilename(p);
  const projectFiles = [];
  if (p.files && typeof p.files === 'object') {
    const keys = Object.keys(p.files);
    for (let i = 0; i < keys.length; i++) projectFiles.push(keys[i]);
  }
  let hasMain = false;
  for (let i = 0; i < projectFiles.length; i++) {
    if (projectFiles[i] === mainFile) hasMain = true;
  }
  if (!hasMain) projectFiles.unshift(mainFile);

  for (let i = 0; i < projectFiles.length; i++) {
    const fname = projectFiles[i];
    let isActive = false;
    if (state.editorFile === fname) isActive = true;
    if (!state.editorFile && fname === mainFile) isActive = true;
    let rClass = "sidebar-file discord-file";
    if (isActive) rClass += " active";
    const row = el("div", { className: rClass });
    row.addEventListener("click", function() { switchFile(fname); });
    row.appendChild(svgIcon("doc"));
    row.appendChild(document.createTextNode(" " + fname));
    if (fname === mainFile) {
      row.appendChild(el("span", { className: "file-badge discord-badge" }, "main"));
    }
    filesSection.appendChild(row);
  }

  const addFileBtn = el("button", { className: "btn-add-file-small" });
  addFileBtn.addEventListener("click", function() {
    const name = prompt("New file name:");
    if (name && name.trim()) {
      state.currentProject.files = state.currentProject.files || {};
      state.currentProject.files[name.trim()] = "";
      switchFile(name.trim());
    }
  });
  addFileBtn.appendChild(svgIcon("plus"));
  addFileBtn.appendChild(document.createTextNode(" New File"));
  filesSection.appendChild(addFileBtn);
  sb.appendChild(filesSection);

  const pkgSection = el("div", { className: "sidebar-section" });
  const pkgLbl = el("div", { className: "sidebar-label discord-label" });
  pkgLbl.appendChild(svgIcon("pkg"));
  pkgLbl.appendChild(document.createTextNode(" Packages"));
  pkgSection.appendChild(pkgLbl);
  const pkgInput = el("input", { className: "pkg-input discord-input", id: "pkgInput", placeholder: "package name" });
  pkgInput.addEventListener("keydown", function(ev) {
    if (ev.key === "Enter") installPkg();
  });
  pkgSection.appendChild(pkgInput);
  const installBtn = el("button", { className: "btn-install discord-btn" });
  installBtn.addEventListener("click", installPkg);
  installBtn.appendChild(svgIcon("download"));
  installBtn.appendChild(document.createTextNode(" Install"));
  pkgSection.appendChild(installBtn);
  sb.appendChild(pkgSection);

  const settingsSection = el("div", { className: "sidebar-section" });
  const settingsLbl = el("div", { className: "sidebar-label discord-label" });
  settingsLbl.appendChild(svgIcon("gear"));
  settingsLbl.appendChild(document.createTextNode(" Settings"));
  settingsSection.appendChild(settingsLbl);

  const tokenField = el("div", { className: "settings-field" });
  tokenField.appendChild(el("label", null, "Bot Token"));
  const tRow = el("div", { className: "settings-row" });
  const tInput = el("input", { className: "settings-input discord-input", type: "password", id: "tokenInput", placeholder: "Paste your bot token", value: p.botToken || "" });
  const tSaveBtn = el("button", { className: "btn-save discord-btn-sm" });
  tSaveBtn.appendChild(svgIcon("save"));
  tSaveBtn.addEventListener("click", function() {
    const v = document.getElementById("tokenInput").value.trim();
    if (!v) return;
    p.botToken = v;
    for (let i = 0; i < state.projects.length; i++) {
      if (state.projects[i].id === p.id) {
        state.projects[i].botToken = v;
      }
    }
    saveProjects();
    tSaveBtn.textContent = "Saved!";
    setTimeout(function() {
      tSaveBtn.innerHTML = "";
      tSaveBtn.appendChild(svgIcon("save"));
    }, 1400);
  });
  tRow.appendChild(tInput);
  tRow.appendChild(tSaveBtn);
  tokenField.appendChild(tRow);
  settingsSection.appendChild(tokenField);
  sb.appendChild(settingsSection);
  dash.appendChild(sb);

  const main = el("div", { className: "main-area" });
  const toolbar = el("div", { className: "editor-toolbar discord-toolbar" });
  toolbar.appendChild(el("span", { className: "editor-filename" }, state.editorFile || mainFile));
  const saveFileBtn = el("button", { className: "btn-save-file discord-btn-sm" });
  saveFileBtn.appendChild(svgIcon("save"));
  saveFileBtn.appendChild(document.createTextNode(" Save"));
  saveFileBtn.addEventListener("click", function() {
    saveCurrentFile();
    flashSaveBtn(saveFileBtn);
  });
  toolbar.appendChild(saveFileBtn);
  main.appendChild(toolbar);

  const edArea = el("div", { className: "editor-area" });
  const ta = el("textarea", { className: "code-editor", spellcheck: "false", placeholder: "Write your bot code here..." });
  ta.value = state.codeContent;
  ta.addEventListener("input", function() {
    state.codeContent = ta.value;
  });
  edArea.appendChild(ta);
  main.appendChild(edArea);
  main.appendChild(buildConsole());
  dash.appendChild(main);
  frag.appendChild(dash);
  return frag;
}

function buildConsole() {
  const panel = el("div", { className: "console-panel discord-console" });
  const toolbar = el("div", { className: "console-toolbar discord-console-toolbar" });
  toolbar.appendChild(el("span", { className: "console-label" }, "Console"));
  const controls = el("div", { className: "console-controls" });
  const clearBtn = el("button", { className: "btn-clear" }, "Clear");
  clearBtn.addEventListener("click", function() {
    state.botLogs = [];
    render();
  });
  controls.appendChild(clearBtn);
  toolbar.appendChild(controls);
  panel.appendChild(toolbar);
  const body = el("div", { className: "console-body" });
  if (state.botLogs.length === 0) {
    body.appendChild(el("div", { style: { color: "var(--text-muted)", fontSize: "12px", padding: "12px" } }, "Bot console output will appear here."));
  }
  for (let i = 0; i < state.botLogs.length; i++) {
    const l = state.botLogs[i];
    const line = el("div", { className: "log-line" });
    line.appendChild(el("span", { className: "log-time" }, l.t));
    line.appendChild(el("span", { className: "log-" + l.type }, l.msg));
    body.appendChild(line);
  }
  panel.appendChild(body);
  return panel;
}

function renderMcDashboard() {
  let p = state.currentProject;
  if (!p) p = {};
  const frag = document.createDocumentFragment();

  const dnav = el("nav", { className: "dash-nav", style: { borderBottomColor: "#162016" } });
  const backBtn = el("button", { className: "btn-back" });
  backBtn.addEventListener("click", function() {
    state.page = "projects";
    render();
  });
  backBtn.appendChild(svgIcon("back"));
  backBtn.appendChild(document.createTextNode(" Back"));
  dnav.appendChild(backBtn);
  dnav.appendChild(el("span", { className: "dash-project-name" }, p.name || "Minecraft Server"));

  const dtags = el("div", { className: "dash-tags" });
  let chipClass = "status-chip";
  if (!p.running) chipClass += " stopped";
  const chip = el("div", { className: chipClass });
  let dotClass = "status-dot";
  if (!p.running) dotClass += " stopped";
  chip.appendChild(el("div", { className: dotClass }));
  chip.appendChild(document.createTextNode(p.running ? " Running" : " Stopped"));
  dtags.appendChild(chip);
  const togClass = p.running ? "btn-stop" : "btn-start";
  const toggleBtn = el("button", { className: togClass });
  toggleBtn.addEventListener("click", function() { toggleRunning(p); });
  toggleBtn.appendChild(svgIcon(p.running ? "stop" : "play"));
  toggleBtn.appendChild(document.createTextNode(p.running ? " Stop" : " Start"));
  dtags.appendChild(toggleBtn);
  dnav.appendChild(dtags);
  frag.appendChild(dnav);

  const dash = el("div", { className: "dashboard", style: { background: "#050e05" } });
  const sb = el("div", { className: "mc-sidebar" });

  const hdr = el("div", { className: "mc-header-section" });
  hdr.appendChild(el("div", { className: "mc-server-name" }, p.name || "Minecraft Server"));
  let ipStr = p.ip || "play.server.net";
  if (p.port) ipStr += ":" + p.port;
  hdr.appendChild(el("div", { className: "mc-server-ip" }, ipStr));
  const vtag = el("span", { className: "mc-version-tag" });
  vtag.appendChild(svgIcon("pickaxe"));
  const vText = " " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5");
  vtag.appendChild(document.createTextNode(vText));
  hdr.appendChild(vtag);
  sb.appendChild(hdr);

  const navWrap = el("div", { style: { padding: "8px 0" } });
  const navItems = [
    { id: "overview",  iconType: "chart",    label: "Overview"       },
    { id: "files",     iconType: "folder",   label: "Files"          },
    { id: "mods",      iconType: "plug",     label: "Mods / Plugins" },
    { id: "console",   iconType: "terminal", label: "Console"        },
    { id: "backups",   iconType: "backup",   label: "Backup Worlds"  },
    { id: "about",     iconType: "info",     label: "Server About"   },
  ];
  for (let i = 0; i < navItems.length; i++) {
    const item = navItems[i];
    let btnClass = "mc-nav-btn";
    if (state.mcView === item.id) btnClass += " active";
    const btn = el("button", { className: btnClass });
    btn.addEventListener("click", function() {
      state.mcView = item.id;
      scheduleRender();
    });
    btn.appendChild(svgIcon(item.iconType));
    btn.appendChild(document.createTextNode(" " + item.label));
    navWrap.appendChild(btn);
  }
  sb.appendChild(navWrap);

  const qa = el("div", { style: { padding: "14px", marginTop: "auto", borderTop: "1px solid #162016" } });
  qa.appendChild(el("div", { style: { fontSize: "10px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".08em" } }, "Quick Actions"));

  const backupQuickBtn = el("button", { className: "mc-quick-btn secondary" });
  backupQuickBtn.addEventListener("click", function() {
    if (!state.currentProject) return;
    fetch('/api/projects/' + state.currentProject.id + '/backup', { method: 'POST' }).then(function() { render(); });
  });
  backupQuickBtn.appendChild(svgIcon("backup"));
  backupQuickBtn.appendChild(document.createTextNode(" Backup World"));
  qa.appendChild(backupQuickBtn);
  sb.appendChild(qa);

  dash.appendChild(sb);

  const main = el("div", { className: "mc-main" });
  if (state.mcView === "console") {
    main.style.cssText = "display:flex;flex-direction:column";
    main.appendChild(buildMcConsole(p));
  } else {
    const content = el("div", { className: "mc-content" });
    if (state.mcView === "overview") buildMcOverview(content, p);
    else if (state.mcView === "files") buildMcFiles(content, p);
    else if (state.mcView === "mods") buildMcMods(content);
    else if (state.mcView === "backups") buildMcBackups(content, p);
    else if (state.mcView === "about") buildMcAbout(content, p);
    main.appendChild(content);
  }

  dash.appendChild(main);
  frag.appendChild(dash);
  return frag;
}

function buildMcOverview(container, p) {
  const statusHtml = '<span style="font-size:16px;color:var(--green);font-weight:800">' + (p.running ? "Online" : "Offline") + '</span>';
  const playerHtml = '0<span style="font-size:14px;color:var(--text-muted)">/20</span>';
  const verHtml = '<span style="font-size:16px">' + (p.version || "1.21.5") + '</span>';
  const portHtml = '<span style="font-size:16px">' + (p.port || "25565") + '</span>';
  const stats = [
    { label: "Status",  html: statusHtml, sub: p.running ? "Active" : "Server stopped" },
    { label: "Players", html: playerHtml, sub: "Online now" },
    { label: "Version", html: verHtml, sub: (p.serverType || "Vanilla") + " Edition" },
    { label: "Port",    html: portHtml, sub: "Server Port" },
  ];
  const grid = el("div", { className: "mc-stats-grid" });
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const card = el("div", { className: "mc-stat" });
    card.appendChild(el("div", { className: "mc-stat-label" }, s.label));
    const val = el("div", { className: "mc-stat-value" });
    val.innerHTML = s.html;
    card.appendChild(val);
    card.appendChild(el("div", { className: "mc-stat-sub" }, s.sub));
    grid.appendChild(card);
  }
  container.appendChild(grid);
  container.appendChild(el("div", { className: "mc-section-title" }, "Server IP"));
  const ipRow = el("div", { style: { background: "#090f09", border: "1px solid #162016", borderRadius: "8px", padding: "14px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } });
  let combinedIp = p.ip || "play.myserver.net";
  if (p.port) combinedIp += ":" + p.port;
  const ipText = el("span", { style: { fontFamily: "var(--mono)", color: "var(--mc-bright)", fontSize: "15px", fontWeight: "600" } }, combinedIp);
  
  const copyBtn = el("button", { style: { background: "#1c381c", color: "var(--mc-bright)", border: "1px solid #2a5a2a", padding: "6px 13px", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font)" } });
  copyBtn.addEventListener("click", function() {
    if (navigator.clipboard) navigator.clipboard.writeText(combinedIp);
    copyBtn.lastChild.textContent = "Copied!";
    setTimeout(function() {
      copyBtn.lastChild.textContent = "Copy IP";
    }, 1400);
  });
  copyBtn.appendChild(svgIcon("copy"));
  copyBtn.appendChild(document.createTextNode("Copy IP"));
  
  ipRow.appendChild(ipText);
  ipRow.appendChild(copyBtn);
  container.appendChild(ipRow);
}

function buildMcFiles(container, p) {
  const topRow = el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" } });
  topRow.appendChild(el("div", { className: "mc-section-title", style: { marginBottom: "0" } }, "Server Files"));
  const upBtn = el("button", { className: "btn-upload-mod" });
  upBtn.addEventListener("click", function() {
    const input = document.createElement("input");
    input.type = "file";
    input.addEventListener("change", function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fetch('/api/projects/' + p.id + '/upload', { method: 'POST', body: fd }).then(function() {
        fetch('/api/projects/' + p.id + '/dir').then(function(r) { return r.json(); }).then(function(d) {
          if (d.success) state.mcFiles = d.files;
          render();
        });
      });
    });
    input.click();
  });
  upBtn.appendChild(svgIcon("upload"));
  upBtn.appendChild(document.createTextNode(" Upload File"));
  topRow.appendChild(upBtn);
  container.appendChild(topRow);

  const list = el("div", { className: "files-list" });
  const filesArr = state.mcFiles || [];
  if (filesArr.length === 0) {
    list.appendChild(el("div", { style: { color: "var(--text-muted)", fontSize: "12px", padding: "14px" } }, "No files yet."));
  }
  for (let i = 0; i < filesArr.length; i++) {
    const f = filesArr[i];
    const item = el("div", { className: "file-item" });
    const icEl = svgIcon(f.isDir ? "folder" : "doc");
    icEl.style.cssText = "color:var(--mc-bright)";
    item.appendChild(icEl);
    item.appendChild(el("span", { className: "file-item-name" }, f.name));
    item.appendChild(el("span", { className: "file-item-size" }, f.size + " B"));
    const actions = el("div", { className: "file-item-actions" });
    const delBtn = el("button", { className: "btn-file-action danger" });
    delBtn.addEventListener("click", function() {
      if (confirm("Delete " + f.name + "?")) {
        fetch('/api/projects/' + p.id + '/deleteFile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: f.name}) }).then(function() {
          fetch('/api/projects/' + p.id + '/dir').then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) state.mcFiles = d.files;
            render();
          });
        });
      }
    });
    delBtn.appendChild(svgIcon("trash"));
    actions.appendChild(delBtn);
    item.appendChild(actions);
    list.appendChild(item);
  }
  container.appendChild(list);

  const addBtn = el("button", { className: "btn-add-file" });
  addBtn.addEventListener("click", function() {
    const name = prompt("File name:");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/touch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(function() {
        fetch('/api/projects/' + p.id + '/dir').then(function(r) { return r.json(); }).then(function(d) {
          if (d.success) state.mcFiles = d.files;
          render();
        });
      });
    }
  });
  addBtn.appendChild(svgIcon("plus"));
  addBtn.appendChild(document.createTextNode(" New File"));
  container.appendChild(addBtn);
}

function buildMcMods(container) {
  const topRow = el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" } });
  topRow.appendChild(el("div", { className: "mc-section-title", style: { marginBottom: "0" } }, "Mods / Plugins"));
  container.appendChild(topRow);
  const grid = el("div", { className: "mods-grid" });
  grid.appendChild(el("div", { style: { color: "var(--text-muted)", fontSize: "12px", padding: "14px" } }, "To install mods or plugins, upload them in the Files tab to the mods or plugins directory."));
  container.appendChild(grid);
}

function buildMcConsole(p) {
  const wrap = el("div", { className: "mc-console", style: { flex: "1" } });
  const toolbar = el("div", { className: "mc-console-toolbar" });
  toolbar.appendChild(el("span", { style: { fontSize: "10px", fontWeight: "800", color: "var(--mc-bright)", textTransform: "uppercase", letterSpacing: ".1em" } }, "Console"));
  const rightTools = el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } });
  let chipClass = "status-chip";
  if (!p.running) chipClass += " stopped";
  const chip = el("div", { className: chipClass });
  let dotClass = "status-dot";
  if (!p.running) dotClass += " stopped";
  chip.appendChild(el("div", { className: dotClass }));
  chip.appendChild(document.createTextNode(p.running ? " Running" : " Stopped"));
  rightTools.appendChild(chip);
  const clearBtn = el("button", { className: "btn-clear" }, "Clear");
  clearBtn.addEventListener("click", function() {
    state.mcLogs = [];
    render();
  });
  rightTools.appendChild(clearBtn);
  toolbar.appendChild(rightTools);
  wrap.appendChild(toolbar);
  const body = el("div", { className: "mc-console-body", style: { flex: "1" } });
  if (state.mcLogs.length === 0) {
    body.appendChild(el("div", { style: { color: "var(--text-muted)", fontSize: "12px", padding: "12px" } }, "Server console output will appear here."));
  }
  for (let i = 0; i < state.mcLogs.length; i++) {
    const l = state.mcLogs[i];
    const line = el("div", { className: "log-line" });
    line.appendChild(el("span", { className: "log-time" }, l.t));
    line.appendChild(el("span", { className: "mc-log-" + l.type }, l.msg));
    body.appendChild(line);
  }
  wrap.appendChild(body);
  const inputRow = el("div", { className: "mc-console-input-row" });
  const cmdInput = el("input", { className: "mc-cmd-input", placeholder: "Type a server command...", value: state.mcCmd });
  cmdInput.addEventListener("input", function() {
    state.mcCmd = cmdInput.value;
  });
  cmdInput.addEventListener("keydown", function(ev) {
    if (ev.key === "Enter") sendMcCmd(cmdInput.value);
  });
  inputRow.appendChild(cmdInput);
  const sendBtn = el("button", { className: "btn-send-cmd" }, "Send");
  sendBtn.addEventListener("click", function() { sendMcCmd(cmdInput.value); });
  inputRow.appendChild(sendBtn);
  wrap.appendChild(inputRow);
  return wrap;
}

function sendMcCmd(cmd) {
  let safeCmd = "";
  if (cmd) safeCmd = cmd.trim();
  if (!safeCmd || !ws || !state.currentProject) return;
  const payload = JSON.stringify({ event: 'cmd', projectId: state.currentProject.id, cmd: safeCmd });
  ws.send(payload);
  state.mcCmd = "";
  render();
}

function buildMcBackups(container, p) {
  container.appendChild(el("div", { className: "mc-section-title" }, "Backup Worlds"));
  const createBtn = el("button", { className: "btn-upload-mod", style: { marginBottom: "16px" } });
  createBtn.addEventListener("click", function() {
    if (!state.currentProject) return;
    fetch('/api/projects/' + state.currentProject.id + '/backup', { method: 'POST' }).then(function() { render(); });
  });
  createBtn.appendChild(svgIcon("backup"));
  createBtn.appendChild(document.createTextNode(" Create Backup Now"));
  container.appendChild(createBtn);

  if (!p._mcBackups || p._mcBackups.length === 0) {
    container.appendChild(el("div", { style: { color: "var(--text-muted)", fontSize: "12px", padding: "16px", background: "#090f09", border: "1px solid #162016", borderRadius: "8px", textAlign: "center" } }, "No backups yet. Click the button above to create your first backup."));
    return;
  }

  const list = el("div", { className: "backups-list" });
  for (let i = 0; i < p._mcBackups.length; i++) {
    const b = p._mcBackups[i];
    const row = el("div", { className: "backup-row" });
    const left = el("div", { className: "backup-left" });
    left.appendChild(svgIcon("backup"));
    const info = el("div", { className: "backup-info" });
    info.appendChild(el("div", { className: "backup-label" }, b.label));
    info.appendChild(el("div", { className: "backup-ts" }, b.ts));
    left.appendChild(info);
    row.appendChild(left);

    const revertBtn = el("button", { className: "btn-revert" });
    revertBtn.addEventListener("click", function() {
      if (!confirm("Revert to this backup? The server will restart.")) return;
      fetch('/api/projects/' + p.id + '/revert', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({dir: b.dir}) }).then(function() { render(); });
    });
    revertBtn.appendChild(svgIcon("revert"));
    revertBtn.appendChild(document.createTextNode(" Revert to this backup"));
    row.appendChild(revertBtn);
    list.appendChild(row);
  }
  container.appendChild(list);
}

function buildMcAbout(container, p) {
  container.appendChild(el("div", { className: "mc-section-title" }, "Server About"));
  const fontRow = el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" } });
  fontRow.appendChild(el("span", { style: { fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".06em" } }, "Font:"));
  for (let i = 0; i < FONTS.length; i++) {
    const f = FONTS[i];
    let btnClass = "font-btn";
    const curFont = p.serverAboutFont || "";
    if (curFont === f.value) btnClass += " active";
    const btn = el("button", { className: btnClass, style: { fontFamily: f.value || "inherit" } }, f.label);
    btn.addEventListener("click", function() {
      p.serverAboutFont = f.value;
      saveProjects();
      scheduleRender();
    });
    fontRow.appendChild(btn);
  }
  container.appendChild(fontRow);

  const ta = el("textarea", { className: "about-editor", placeholder: "Write your server description here...", style: { fontFamily: p.serverAboutFont || "inherit" } });
  ta.value = p.serverAbout || "";
  
  const preview = el("div", { className: "about-preview", style: { fontFamily: p.serverAboutFont || "inherit" } });
  preview.textContent = p.serverAbout || "Your description will appear here...";
  if (!p.serverAbout) preview.style.color = "var(--text-muted)";

  ta.addEventListener("input", function() {
    p.serverAbout = ta.value;
    preview.style.fontFamily = p.serverAboutFont || "inherit";
    preview.textContent = ta.value || "Your description will appear here...";
  });
  container.appendChild(ta);

  const saveBtn = el("button", { className: "btn-upload-mod", style: { marginTop: "10px", marginBottom: "16px" } });
  saveBtn.addEventListener("click", function() {
    p.serverAbout = ta.value;
    saveProjects();
    saveBtn.textContent = "Saved!";
    setTimeout(function() {
      saveBtn.innerHTML = "";
      saveBtn.appendChild(svgIcon("save"));
      saveBtn.appendChild(document.createTextNode(" Save Description"));
    }, 1400);
  });
  saveBtn.appendChild(svgIcon("save"));
  saveBtn.appendChild(document.createTextNode(" Save Description"));
  container.appendChild(saveBtn);

  container.appendChild(el("div", { className: "mc-section-title" }, "Preview"));
  container.appendChild(preview);
}

fetch("/api/me").then(function(r) { return r.json(); }).then(function(d) {
  if (!d.loggedIn) {
    window.location.href = "/";
    return;
  }
  state.username = d.username;
  fetch("/api/projects").then(function(r) { return r.json(); }).then(function(pd) {
    if (pd && pd.projects) state.projects = pd.projects;
    render();
  }).catch(function() { render(); });
}).catch(function() { render(); });
