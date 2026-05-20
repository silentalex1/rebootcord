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
  originalCodeContent: "",
  mcView: "overview",
  mcCmd: "",
  botLogs: [],
  mcLogs: [],
  mcFiles: [],
  mcMods: [],
  mcBackups: [],
  username: "",
  missingPackages: []
};

let ws;

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + location.host);
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'log') {
        const p = state.projects.find(x => String(x.id) === String(data.projectId));
        if (!p) return;
        const tgt = p.type === 'minecraft' ? state.mcLogs : state.botLogs;
        tgt.push({ t: getTime(), type: data.type, msg: data.msg });
        trimLogs(tgt);
        
        const match = data.msg.match(/Missing package detected! Type '([^']+)'/);
        if (match && match[1]) {
          if (!state.missingPackages.includes(match[1])) {
            state.missingPackages.push(match[1]);
          }
        }
        
        if (state.currentProject && String(state.currentProject.id) === String(data.projectId)) {
          scheduleRender();
        }
      }
    } catch(err) {}
  };
  ws.onclose = () => {
    setTimeout(connectWS, 2000);
  };
}

connectWS();

let renderPending = false;

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    render();
  });
}

function scrollConsolesToBottom() {
  requestAnimationFrame(() => {
    const bodies = document.querySelectorAll(".console-body,.mc-console-body");
    bodies.forEach(b => b.scrollTop = b.scrollHeight);
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

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "className") {
        node.className = v;
      } else if (k === "style" && typeof v === "object") {
        Object.assign(node.style, v);
      } else {
        node.setAttribute(k, v);
      }
    });
  }
  children.flat(Infinity).forEach(c => {
    if (c == null) return;
    if (typeof c === "string") {
      node.appendChild(document.createTextNode(c));
    } else {
      node.appendChild(c);
    }
  });
  return node;
}

function svgIcon(type, color) {
  const icons = {
    chart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
    folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    plug: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16.5V12a6 6 0 0 0-12 0v4.5"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="3"/><line x1="16" y1="8" x2="16" y2="3"/></svg>`,
    terminal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    backup: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    upload: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
    save: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
    play: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    stop: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    back: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    gear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    pkg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    doc: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    revert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
    discord: `<svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69z"/></svg>`,
    pickaxe: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4"/><path d="m12.5 7.5-5 5L5 15l4-1 6.5-6.5"/><path d="m18 2-1.5 1.5"/><path d="M5.5 18.5 2 22"/></svg>`,
    logout: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  };
  const wrap = document.createElement("span");
  wrap.className = "svg-icon";
  if (color) wrap.style.color = color;
  wrap.innerHTML = icons[type] || icons.doc;
  return wrap;
}

function highlightCode(text, type) {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isMc = type === 'minecraft';
  const kwColor = isMc ? '#6dbd3d' : '#7289da';
  const strColor = isMc ? '#a8d5a2' : '#9ece6a';
  html = html.replace(/(import|from|const|let|var|function|async|await|return|if|else|for|while|class|require|def)\b/g, `<span style="color:${kwColor};font-weight:bold">$1</span>`);
  html = html.replace(/("[^"]*"|'[^']*'|\`[^`]*\`)/g, `<span style="color:${strColor}">$1</span>`);
  return html;
}

function saveProjects() {
  const proj = state.projects.find(x => state.currentProject && x.id === state.currentProject.id);
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
  const proj = state.projects.find(x => x.id === state.currentProject.id);
  if (proj) proj.files = state.currentProject.files;
  saveProjects();
}

function switchFile(filename) {
  saveCurrentFile();
  state.editorFile = filename;
  state.codeContent = "";
  if (state.currentProject.files && state.currentProject.files[filename] !== undefined) {
    state.codeContent = state.currentProject.files[filename];
    state.originalCodeContent = state.codeContent;
  } else {
    fetch('/api/projects/' + state.currentProject.id + '/file?name=' + encodeURIComponent(filename))
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          state.codeContent = d.content;
          state.originalCodeContent = d.content;
          state.currentProject.files[filename] = d.content;
          scheduleRender();
        }
      });
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
  const wrap = el("div", { className: "loading-screen" + (isMc ? " mc" : "") }, 
    el("div", { className: "loading-icon-wrap" }, svgIcon(isMc ? "pickaxe" : "discord")),
    el("div", { className: "loading-bar" }, el("div", { className: "loading-bar-fill" + (isMc ? " mc" : "") })),
    el("div", { className: "loading-text" }, isMc ? "Setting up your Minecraft server..." : "Starting your bot...")
  );
  setTimeout(() => {
    state.loading = false;
    state.page = state.newType === "minecraft" ? "mc-dashboard" : "bot-dashboard";
    state.showNewModal = false;
    render();
  }, 2200);
  return wrap;
}

function renderNav() {
  return el("nav", { className: "nav" },
    el("div", { className: "nav-logo" },
      el("span", { className: "nav-logo-r" }, "Reboot"),
      el("span", { className: "nav-logo-t" }, " Cord")
    ),
    el("div", { className: "nav-right" },
      el("span", { className: "nav-user" }, state.username),
      el("button", { 
        className: "btn-logout-nav", 
        onClick: () => { fetch("/logout", { method:"POST" }).finally(() => { window.location.href = "/"; }); } 
      }, svgIcon("logout"), " Logout")
    )
  );
}

function renderProjectsPage() {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderNav());
  
  const page = el("div", { className: "projects-page" },
    el("div", { className: "projects-header" },
      el("div", { className: "projects-title" },
        el("h1", {}, "Your Projects"),
        el("p", {}, "Manage your Discord bots and Minecraft servers")
      ),
      el("button", { className: "btn-new", onClick: () => { state.showNewModal = true; scheduleRender(); } }, 
        svgIcon("plus"), " New Project"
      )
    )
  );

  if (state.projects.length === 0) {
    page.appendChild(el("div", { className: "empty-state" },
      el("div", { className: "empty-icon" }, svgIcon("folder")),
      el("div", { className: "empty-title" }, "No projects yet"),
      el("div", { className: "empty-sub" }, "Create your first Discord bot or Minecraft server to get started."),
      el("button", { className: "btn-new", style: { margin:"0 auto" }, onClick: () => { state.showNewModal = true; scheduleRender(); } },
        svgIcon("plus"), " Create Project"
      )
    ));
  } else {
    const grid = el("div", { className: "projects-grid" });
    state.projects.forEach(p => grid.appendChild(renderProjectCard(p)));
    page.appendChild(grid);
  }
  
  frag.appendChild(page);
  if (state.showNewModal) frag.appendChild(renderModal());
  return frag;
}

function renderProjectCard(p) {
  const isMc = p.type === "minecraft";
  const tags = el("div", { className: "card-tags" },
    el("span", { className: "tag" }, isMc ? p.serverType + " " + p.version : p.lang),
    el("span", { className: "tag " + (p.running ? "running" : "stopped") }, p.running ? "Running" : "Stopped")
  );
  if (isMc && p.port) tags.appendChild(el("span", { className: "tag discord-tag" }, "Port: " + p.port));

  return el("div", { className: "project-card" + (isMc ? " mc" : " discord") },
    el("div", { className: "card-top" },
      el("div", { className: "card-icon " + (isMc ? "mc" : "discord") }, svgIcon(isMc ? "pickaxe" : "discord")),
      el("div", { className: "card-dot" + (p.running ? "" : " stopped") })
    ),
    el("div", { className: "card-name" }, p.name),
    tags,
    el("div", { className: "card-actions" },
      el("button", { className: "btn-manage", onClick: () => openProject(p.id) }, "Manage"),
      el("button", { 
        className: "btn-card-toggle " + (p.running ? "running" : "stopped"), 
        onClick: (e) => { e.stopPropagation(); toggleRunning(p); } 
      }, svgIcon(p.running ? "stop" : "play")),
      el("button", { className: "btn-delete", onClick: () => deleteProject(p.id) }, "Delete")
    )
  );
}

function renderModal() {
  const isMc = state.newType === "minecraft";
  const overlay = el("div", { className: "modal-overlay", onClick: (ev) => { if (ev.target === overlay) { state.showNewModal = false; scheduleRender(); } } });
  
  const modal = el("div", { className: "modal" },
    el("h2", {}, "New Project"),
    el("div", { className: "modal-type-tabs" },
      el("button", { className: "type-tab" + (!isMc ? " active discord" : ""), onClick: () => { state.newType = "discord"; scheduleRender(); } },
        el("div", { className: "type-tab-icon" }, svgIcon("discord")), "Discord Bot"
      ),
      el("button", { className: "type-tab" + (isMc ? " active mc" : ""), onClick: () => { state.newType = "minecraft"; scheduleRender(); } },
        el("div", { className: "type-tab-icon" }, svgIcon("pickaxe")), "Minecraft Server"
      )
    )
  );

  const nameInput = el("input", { className: "form-input", placeholder: isMc ? "e.g. my-survival-server" : "e.g. my-bot", value: state.newName });
  nameInput.oninput = () => { state.newName = nameInput.value; const btn = document.getElementById("createBtn"); if (btn) btn.disabled = !state.newName.trim(); };
  modal.appendChild(el("div", { className: "form-group" }, el("label", { className: "form-label" }, "Project Name"), nameInput));

  if (isMc) {
    const stGrid = el("div", { className: "lang-grid" });
    MC_SERVER_TYPES.forEach(t => {
      stGrid.appendChild(el("button", { className: "lang-btn mc" + (t === state.newMcServerType ? " active" : ""), onClick: () => { state.newMcServerType = t; scheduleRender(); } }, t));
    });
    modal.appendChild(el("div", { className: "form-group" }, el("label", { className: "form-label" }, "Server Type"), stGrid));

    const sel = el("select", { className: "form-select" });
    MC_VERSIONS.forEach(v => {
      const opt = el("option", { value: v }, v);
      if (v === state.newMcVersion) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => { state.newMcVersion = sel.value; };
    modal.appendChild(el("div", { className: "form-group" }, el("label", { className: "form-label" }, "Minecraft Version"), sel));

    const ipInput = el("input", { className: "form-input", placeholder: "e.g. play.myserver.net", value: state.newMcIp });
    ipInput.oninput = () => { state.newMcIp = ipInput.value; };
    modal.appendChild(el("div", { className: "form-group" }, el("label", { className: "form-label" }, "Server IP / Domain"), ipInput, el("div", { style: { fontSize:"11px", color:"var(--text-muted)", marginTop:"5px" } }, "Players will connect with this address.")));
  } else {
    const lgrid = el("div", { className: "lang-grid" });
    BOT_LANGS.forEach(lang => {
      lgrid.appendChild(el("button", { className: "lang-btn" + (lang === state.newLang ? " active" : ""), onClick: () => { state.newLang = lang; scheduleRender(); } }, lang));
    });
    modal.appendChild(el("div", { className: "form-group" }, el("label", { className: "form-label" }, "Language"), lgrid));
  }

  const createBtn = el("button", { className: "btn-create" + (isMc ? " mc" : ""), id: "createBtn", onClick: createProject }, "Create");
  createBtn.disabled = !state.newName.trim();
  modal.appendChild(el("div", { className: "modal-actions" },
    el("button", { className: "btn-cancel", onClick: () => { state.showNewModal = false; scheduleRender(); } }, "Cancel"),
    createBtn
  ));

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
  const p = {
    id: Date.now(),
    name: state.newName.trim(),
    type: state.newType,
    lang: state.newLang,
    version: state.newMcVersion,
    serverType: state.newMcServerType,
    ip: state.newMcIp || (state.newName.toLowerCase().replace(/\s+/g, "-") + ".rebootcord.io"),
    running: false,
    files: {},
    serverAbout: "",
    serverAboutFont: "",
    _mcFiles: [],
    _mcMods: [],
    _mcBackups: [],
  };
  if (p.type === "discord") {
    const fname = getDefaultFilename(p);
    p.files[fname] = getDefaultCode(p);
  }
  state.projects.push(p);
  state.currentProject = p;
  state.newName = ""; state.newMcIp = ""; state.newMcServerType = "Vanilla";
  state.mcView = "overview"; state.mcFiles = []; state.mcMods = []; state.mcBackups = [];
  state.botLogs = []; state.mcLogs = []; state.missingPackages = [];
  if (p.type === "discord") {
    state.editorFile = getDefaultFilename(p);
    state.codeContent = p.files[state.editorFile];
    state.originalCodeContent = state.codeContent;
  } else {
    state.editorFile = ""; state.codeContent = ""; state.originalCodeContent = "";
  }
  state.loading = true;
  saveProjects();
  render();
}

function openProject(id) {
  const p = state.projects.find(p => p.id === id);
  if (!p) return;
  state.currentProject = p;
  state.page = p.type === "minecraft" ? "mc-dashboard" : "bot-dashboard";
  state.mcView = "overview";
  state.mcFiles = p._mcFiles || [];
  state.mcMods = p._mcMods || [];
  state.mcBackups = p._mcBackups || [];
  state.botLogs = []; state.mcLogs = []; state.missingPackages = [];
  fetch('/api/projects/' + id + '/dir').then(r => r.json()).then(d => {
    if (d.success) {
      if (p.type === "minecraft") {
        state.mcFiles = d.files;
      } else {
        d.files.forEach(f => {
          if (!f.isDir && p.files[f.name] === undefined) {
            p.files[f.name] = "";
          }
        });
      }
    }
    if (p.type === "discord") {
      state.editorFile = getDefaultFilename(p);
      if (p.files[state.editorFile] !== undefined) {
        state.codeContent = p.files[state.editorFile];
        state.originalCodeContent = state.codeContent;
        render();
      } else {
        fetch('/api/projects/' + id + '/file?name=' + encodeURIComponent(state.editorFile))
          .then(r => r.json())
          .then(d2 => {
            if (d2.success) {
              state.codeContent = d2.content;
              state.originalCodeContent = d2.content;
              p.files[state.editorFile] = d2.content;
            }
            render();
          });
      }
    } else {
      render();
    }
  });
}

function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  state.projects = state.projects.filter(p => p.id !== id);
  saveProjects();
  render();
}

function toggleRunning(p) {
  p.running = !p.running;
  const proj = state.projects.find(x => x.id === p.id);
  if (proj) proj.running = p.running;
  if (p.running) {
    fetch(`/api/projects/${p.id}/start`, { method: "POST" }).then(() => render());
  } else {
    fetch(`/api/projects/${p.id}/stop`, { method: "POST" }).then(() => render());
  }
  render();
}

function flashSaveBtn(btn) {
  btn.textContent = "Saved!";
  btn.style.color = "var(--green)";
  setTimeout(() => { btn.textContent = "Save"; btn.style.color = ""; }, 1400);
}

function installPkg() {
  const input = document.getElementById("pkgInput");
  const v = input ? input.value.trim() : "";
  if (!v || !ws || !state.currentProject) return;
  ws.send(JSON.stringify({ event: 'install', projectId: state.currentProject.id, pkg: v }));
  if (input) input.value = "";
}

function installAllPkgs() {
  if (!ws || !state.currentProject || state.missingPackages.length === 0) return;
  state.missingPackages.forEach(pkg => {
    ws.send(JSON.stringify({ event: 'install', projectId: state.currentProject.id, pkg: pkg }));
  });
  state.missingPackages = [];
  render();
}

function renderBotDashboard() {
  const p = state.currentProject || {};
  const frag = document.createDocumentFragment();

  frag.appendChild(el("nav", { className: "dash-nav discord-nav" },
    el("button", { className: "btn-back", onClick: () => { state.page = "projects"; render(); } }, svgIcon("back"), " Back"),
    el("div", { className: "dash-nav-discord-icon" }, svgIcon("discord")),
    el("span", { className: "dash-project-name discord-name" }, p.name || "Bot Project"),
    el("span", { className: "tag discord-tag", style: { fontSize:"11px" } }, p.lang || ""),
    el("div", { className: "dash-tags" },
      el("div", { className: "status-chip" + (p.running ? " discord" : " stopped") },
        el("div", { className: "status-dot" + (p.running ? " discord" : " stopped") }),
        p.running ? " Running" : " Stopped"
      ),
      el("button", { className: p.running ? "btn-stop-discord" : "btn-start-discord", onClick: () => toggleRunning(p) },
        svgIcon(p.running ? "stop" : "play"), p.running ? " Stop" : " Start"
      )
    )
  ));

  const mainFile = getDefaultFilename(p);
  const projectFiles = Object.keys((p.files && typeof p.files === 'object') ? p.files : {});
  if (!projectFiles.includes(mainFile)) projectFiles.unshift(mainFile);

  const filesSection = el("div", { className: "sidebar-section" },
    el("div", { className: "sidebar-label discord-label", style: { display: "flex", justifyContent: "space-between", width: "100%" } }, 
      el("span", {}, svgIcon("folder"), " Files"),
      el("button", { className: "btn-clear", style: { margin: "0" }, onClick: () => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => {
          if (d.success) {
            d.files.forEach(f => { if (!f.isDir && p.files[f.name] === undefined) p.files[f.name] = ""; });
            render();
          }
        });
      }}, "Refresh")
    )
  );

  projectFiles.forEach(fname => {
    const isActive = state.editorFile === fname || (!state.editorFile && fname === mainFile);
    const row = el("div", { className: "sidebar-file discord-file" + (isActive ? " active" : ""), onClick: () => switchFile(fname) }, svgIcon("doc"), " " + fname);
    if (fname === mainFile) row.appendChild(el("span", { className: "file-badge discord-badge" }, "main"));
    filesSection.appendChild(row);
  });

  filesSection.appendChild(el("button", { className: "btn-add-file-small", onClick: () => {
    const name = prompt("New file name (e.g. utils.py):");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/touch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        state.currentProject.files = state.currentProject.files || {};
        state.currentProject.files[name.trim()] = "";
        switchFile(name.trim());
      });
    }
  }}, svgIcon("plus"), " New File"));

  const pkgInput = el("input", { className: "pkg-input discord-input", id: "pkgInput", placeholder: "package name" });
  pkgInput.onkeydown = (ev) => { if (ev.key === "Enter") installPkg(); };

  let installAllSection = null;
  if (state.missingPackages && state.missingPackages.length > 0) {
    installAllSection = el("button", { className: "btn-install discord-btn", style: { marginTop: "8px", background: "var(--green)", color: "#000" }, onClick: installAllPkgs }, svgIcon("download"), " Install All Detected");
  }

  const tInput = el("input", { className: "settings-input discord-input", type: "password", id: "tokenInput", placeholder: "Paste your bot token", value: p.botToken || "" });
  const tSaveBtn = el("button", { className: "btn-save discord-btn-sm" }, svgIcon("save"));
  tSaveBtn.onclick = () => {
    const v = document.getElementById("tokenInput").value.trim();
    if (!v) return;
    p.botToken = v;
    const proj = state.projects.find(x => x.id === p.id);
    if (proj) proj.botToken = v;
    saveProjects();
    tSaveBtn.textContent = "Saved!";
    setTimeout(() => { tSaveBtn.innerHTML = ""; tSaveBtn.appendChild(svgIcon("save")); }, 1400);
  };

  const clearCodeBtn = el("button", { className: "btn-save-file discord-btn-sm", style: { marginRight: "8px", background: "transparent", border: "1px solid var(--border)" }, onClick: () => {
    state.codeContent = "";
    saveCurrentFile();
    render();
  }}, svgIcon("trash"), " Clear Code");

  const revertCodeBtn = el("button", { className: "btn-save-file discord-btn-sm", style: { marginRight: "8px", background: "transparent", border: "1px solid var(--border)" }, onClick: () => {
    state.codeContent = state.originalCodeContent;
    saveCurrentFile();
    render();
  }}, svgIcon("revert"), " Revert Code");

  const saveFileBtn = el("button", { className: "btn-save-file discord-btn-sm" }, svgIcon("save"), " Save");
  saveFileBtn.onclick = () => { saveCurrentFile(); flashSaveBtn(saveFileBtn); };

  const ta = el("textarea", { className: "code-editor", spellcheck: "false", wrap: "off" });
  ta.value = state.codeContent || "";
  
  const hl = el("div", { className: "highlight-layer" });
  
  const lineNums = el("div", { className: "line-numbers" });
  const updateEditor = () => {
    const count = (state.codeContent.match(/\n/g) || []).length + 1;
    const arr = [];
    for(let i=1; i<=count; i++) arr.push(i);
    lineNums.innerText = arr.join('\n');
    hl.innerHTML = highlightCode(state.codeContent, p.type);
  };
  updateEditor();

  ta.onscroll = () => { 
    lineNums.scrollTop = ta.scrollTop; 
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
  };
  ta.oninput = () => { 
    state.codeContent = ta.value; 
    updateEditor();
  };

  const editorWrapper = el("div", { className: "editor-wrapper" }, lineNums, el("div", { className: "code-container" }, hl, ta));

  frag.appendChild(el("div", { className: "dashboard discord-dash" },
    el("div", { className: "sidebar discord-sidebar" },
      el("div", { className: "discord-wave-bg" }),
      filesSection,
      el("div", { className: "sidebar-section" },
        el("div", { className: "sidebar-label discord-label" }, svgIcon("pkg"), " Packages"),
        el("div", { style: { display: "flex", gap: "6px" } }, 
          pkgInput, 
          el("button", { className: "btn-clear", style: { margin: 0, padding: 0 }, onClick: () => { const i = document.getElementById("pkgInput"); if(i) i.value = ""; } }, svgIcon("trash"))
        ),
        el("button", { className: "btn-install discord-btn", onClick: installPkg }, svgIcon("download"), " Install"),
        installAllSection
      ),
      el("div", { className: "sidebar-section" },
        el("div", { className: "sidebar-label discord-label" }, svgIcon("gear"), " Settings"),
        el("div", { className: "settings-field" },
          el("label", {}, "Bot Token"),
          el("div", { className: "settings-row" }, tInput, tSaveBtn)
        )
      )
    ),
    el("div", { className: "main-area" },
      el("div", { className: "editor-toolbar discord-toolbar" },
        el("span", { className: "editor-filename" }, state.editorFile || mainFile),
        el("div", { style: { display: "flex" } }, revertCodeBtn, clearCodeBtn, saveFileBtn)
      ),
      editorWrapper,
      buildConsole()
    )
  ));
  
  return frag;
}

function buildConsole() {
  const body = el("div", { className: "console-body" });
  if (state.botLogs.length === 0) {
    body.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"12px" } }, "Bot console output will appear here."));
  }
  state.botLogs.forEach(l => {
    body.appendChild(el("div", { className: "log-line" },
      el("span", { className: "log-time" }, l.t),
      el("span", { className: "log-" + l.type }, l.msg)
    ));
  });

  return el("div", { className: "console-panel discord-console" },
    el("div", { className: "console-toolbar discord-console-toolbar" },
      el("span", { className: "console-label" }, "Console"),
      el("div", { className: "console-controls" },
        el("button", { className: "btn-clear", onClick: () => { state.botLogs = []; render(); } }, "Clear")
      )
    ),
    body
  );
}

function renderMcDashboard() {
  const p = state.currentProject || {};
  const frag = document.createDocumentFragment();

  frag.appendChild(el("nav", { className: "dash-nav", style: { borderBottomColor:"#162016" } },
    el("button", { className: "btn-back", onClick: () => { state.page = "projects"; render(); } }, svgIcon("back"), " Back"),
    el("span", { className: "dash-project-name" }, p.name || "Minecraft Server"),
    el("div", { className: "dash-tags" },
      el("div", { className: "status-chip" + (p.running ? "" : " stopped") },
        el("div", { className: "status-dot" + (p.running ? "" : " stopped") }),
        p.running ? " Running" : " Stopped"
      ),
      el("button", { className: p.running ? "btn-stop" : "btn-start", onClick: () => toggleRunning(p) },
        svgIcon(p.running ? "stop" : "play"), p.running ? " Stop" : " Start"
      )
    )
  ));

  const navWrap = el("div", { style: { padding:"8px 0", display: "flex", flexDirection: "column", gap: "4px" } });
  [
    { id: "overview",  iconType: "chart",    label: "Overview"       },
    { id: "files",     iconType: "folder",   label: "Files"          },
    { id: "adminfiles",iconType: "gear",     label: "Admin Server Files" },
    { id: "mods",      iconType: "plug",     label: "Mods / Plugins" },
    { id: "console",   iconType: "terminal", label: "Console"        },
    { id: "backups",   iconType: "backup",   label: "Backup Worlds"  },
    { id: "about",     iconType: "info",     label: "Server About"   },
  ].forEach(item => {
    navWrap.appendChild(el("button", { 
      className: "mc-nav-btn" + (state.mcView === item.id ? " active" : ""), 
      onClick: () => { state.mcView = item.id; scheduleRender(); } 
    }, svgIcon(item.iconType), " " + item.label));
  });

  const content = el("div", { className: "mc-content" });
  if (state.mcView === "overview")  buildMcOverview(content, p);
  else if (state.mcView === "files") buildMcFiles(content, p);
  else if (state.mcView === "adminfiles") buildMcAdminFiles(content, p);
  else if (state.mcView === "mods")  buildMcMods(content);
  else if (state.mcView === "backups") buildMcBackups(content, p);
  else if (state.mcView === "about") buildMcAbout(content, p);

  frag.appendChild(el("div", { className: "dashboard", style: { background:"#050e05" } },
    el("div", { className: "mc-sidebar" },
      el("div", { className: "mc-header-section" },
        el("div", { className: "mc-server-name" }, p.name || "Minecraft Server"),
        el("div", { className: "mc-server-ip" }, (p.ip || "play.server.net") + (p.port ? ":" + p.port : "")),
        el("span", { className: "mc-version-tag" }, svgIcon("pickaxe"), " " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5"))
      ),
      navWrap,
      el("div", { style: { padding:"14px", marginTop:"auto", borderTop:"1px solid #162016" } },
        el("div", { style: { fontSize:"10px", color:"var(--text-muted)", marginBottom:"8px", fontWeight:"700", textTransform:"uppercase", letterSpacing:".08em" } }, "Quick Actions"),
        el("button", { className: "mc-quick-btn secondary", onClick: () => { if(state.currentProject) fetch('/api/projects/' + state.currentProject.id + '/backup', { method: 'POST' }).then(()=>render()); } },
          svgIcon("backup"), " Backup World"
        )
      )
    ),
    el("div", { className: "mc-main" }, state.mcView === "console" ? buildMcConsole(p) : content)
  ));
  
  return frag;
}

function buildMcOverview(container, p) {
  const grid = el("div", { className: "mc-stats-grid" });
  [
    { label: "Status",  html: '<span style="font-size:16px;color:var(--green);font-weight:800">' + (p.running ? "Online" : "Offline") + '</span>', sub: p.running ? "Active" : "Server stopped" },
    { label: "Players", html: '0<span style="font-size:14px;color:var(--text-muted)">/20</span>', sub: "Online now" },
    { label: "Version", html: '<span style="font-size:16px">' + (p.version || "1.21.5") + '</span>', sub: (p.serverType || "Vanilla") + " Edition" },
    { label: "Port",    html: '<span style="font-size:16px">' + (p.port || "25565") + '</span>', sub: "Server Port" },
  ].forEach(s => {
    const val = el("div", { className: "mc-stat-value" });
    val.innerHTML = s.html;
    grid.appendChild(el("div", { className: "mc-stat" }, el("div", { className: "mc-stat-label" }, s.label), val, el("div", { className: "mc-stat-sub" }, s.sub)));
  });

  const combinedIp = (p.ip || "play.myserver.net") + (p.port ? ":" + p.port : "");
  const copyBtn = el("button", { 
    style: { background:"#1c381c", color:"var(--mc-bright)", border:"1px solid #2a5a2a", padding:"6px 13px", borderRadius:"7px", fontSize:"12px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", fontFamily:"var(--font)" },
    onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(combinedIp); copyBtn.lastChild.textContent = "Copied!"; setTimeout(() => { copyBtn.lastChild.textContent = "Copy IP"; }, 1400); }
  }, svgIcon("copy"), "Copy IP");

  container.appendChild(grid);
  container.appendChild(el("div", { className: "mc-section-title" }, "Server IP"));
  container.appendChild(el("div", { style: { background:"#090f09", border:"1px solid #162016", borderRadius:"8px", padding:"14px", marginBottom:"20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"8px" } },
    el("span", { style: { fontFamily:"var(--mono)", color:"var(--mc-bright)", fontSize:"15px", fontWeight:"600" } }, combinedIp),
    copyBtn
  ));
}

function buildMcFiles(container, p) {
  const upBtn = el("button", { className: "btn-upload-mod" }, svgIcon("upload"), " Upload File");
  upBtn.onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      if (!e.target.files[0]) return;
      const fd = new FormData();
      fd.append('file', e.target.files[0]);
      fetch('/api/projects/' + p.id + '/upload', { method: 'POST', body: fd }).then(() => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
      });
    };
    input.click();
  };

  const refreshBtn = el("button", { className: "btn-upload-mod", style: { background: "transparent", borderColor: "#162016", color: "var(--text-dim)" } }, svgIcon("refresh"), " Refresh");
  refreshBtn.onclick = () => {
    fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
  };

  container.appendChild(el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } },
    el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Server Files"),
    el("div", { style: { display: "flex", gap: "8px" } }, refreshBtn, upBtn)
  ));

  const list = el("div", { className: "files-list" });
  if (!state.mcFiles || state.mcFiles.length === 0) list.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No files yet."));
  
  (state.mcFiles || []).forEach((f) => {
    const icEl = svgIcon(f.isDir ? "folder" : "doc");
    icEl.style.cssText = "color:var(--mc-bright)";
    list.appendChild(el("div", { className: "file-item" },
      icEl,
      el("span", { className: "file-item-name" }, f.name),
      el("span", { className: "file-item-size" }, f.size + " B"),
      el("div", { className: "file-item-actions" },
        el("button", { className: "btn-file-action danger", onClick: () => {
          if (confirm("Delete " + f.name + "?")) {
            fetch('/api/projects/' + p.id + '/deleteFile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: f.name}) }).then(() => {
              fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
            });
          }
        }}, svgIcon("trash"))
      )
    ));
  });
  container.appendChild(list);

  container.appendChild(el("button", { className: "btn-add-file", onClick: () => {
    const name = prompt("File name:");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/touch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
      });
    }
  }}, svgIcon("plus"), " New File"));
}

function buildMcAdminFiles(container, p) {
  const refreshBtn = el("button", { className: "btn-upload-mod", style: { background: "transparent", borderColor: "#162016", color: "var(--text-dim)" } }, svgIcon("refresh"), " Refresh");
  refreshBtn.onclick = () => {
    fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
  };

  container.appendChild(el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } },
    el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Admin Server Files"),
    el("div", { style: { display: "flex", gap: "8px" } }, refreshBtn)
  ));

  const list = el("div", { className: "files-list" });
  if (!state.mcFiles || state.mcFiles.length === 0) list.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No directories or files."));
  
  (state.mcFiles || []).forEach((f) => {
    const icEl = svgIcon(f.isDir ? "folder" : "doc");
    icEl.style.cssText = "color:var(--mc-bright)";
    list.appendChild(el("div", { className: "file-item" },
      icEl,
      el("span", { className: "file-item-name" }, f.name),
      el("span", { className: "file-item-size" }, f.isDir ? "Directory" : f.size + " B"),
      el("div", { className: "file-item-actions" },
        el("button", { className: "btn-file-action danger", onClick: () => {
          if (confirm("Delete " + f.name + "?")) {
            fetch('/api/projects/' + p.id + '/deleteFile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: f.name}) }).then(() => {
              fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
            });
          }
        }}, svgIcon("trash"))
      )
    ));
  });
  container.appendChild(list);

  container.appendChild(el("button", { className: "btn-add-file", style: { background: "var(--surface3)", border: "1px dashed var(--border)" }, onClick: () => {
    const name = prompt("Folder name (e.g. plugins):");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/mkdir', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.mcFiles = d.files; render(); });
      });
    }
  }}, svgIcon("plus"), " New Folder"));
}

function buildMcMods(container) {
  container.appendChild(el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } },
    el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Mods / Plugins")
  ));
  container.appendChild(el("div", { className: "mods-grid" },
    el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "To install mods or plugins, upload them in the Files tab to the mods or plugins directory.")
  ));
}

function buildMcConsole(p) {
  const body = el("div", { className: "mc-console-body", style: { flex:"1" } });
  if (state.mcLogs.length === 0) body.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"12px" } }, "Server console output will appear here."));
  state.mcLogs.forEach(l => {
    body.appendChild(el("div", { className: "log-line" }, el("span", { className: "log-time" }, l.t), el("span", { className: "mc-log-" + l.type }, l.msg)));
  });

  const cmdInput = el("input", { className: "mc-cmd-input", placeholder: "Type a server command...", value: state.mcCmd });
  cmdInput.oninput = () => { state.mcCmd = cmdInput.value; };
  cmdInput.onkeydown = (ev) => { if (ev.key === "Enter") sendMcCmd(cmdInput.value); };

  return el("div", { className: "mc-console", style: { flex:"1" } },
    el("div", { className: "mc-console-toolbar" },
      el("span", { style: { fontSize:"10px", fontWeight:"800", color:"var(--mc-bright)", textTransform:"uppercase", letterSpacing:".1em" } }, "Console"),
      el("div", { style: { display:"flex", gap:"8px", alignItems:"center" } },
        el("div", { className: "status-chip" + (p.running ? "" : " stopped") },
          el("div", { className: "status-dot" + (p.running ? "" : " stopped") }),
          p.running ? " Running" : " Stopped"
        ),
        el("button", { className: "btn-clear", onClick: () => { state.mcLogs = []; render(); } }, "Clear")
      )
    ),
    body,
    el("div", { className: "mc-console-input-row" },
      cmdInput,
      el("button", { className: "btn-send-cmd", onClick: () => sendMcCmd(cmdInput.value) }, "Send")
    )
  );
}

function sendMcCmd(cmd) {
  const safeCmd = (cmd || "").trim();
  if (!safeCmd || !ws || !state.currentProject) return;
  ws.send(JSON.stringify({ event: 'cmd', projectId: state.currentProject.id, cmd: safeCmd }));
  state.mcCmd = "";
  render();
}

function buildMcBackups(container, p) {
  container.appendChild(el("div", { className: "mc-section-title" }, "Backup Worlds"));
  container.appendChild(el("button", { className: "btn-upload-mod", style: { marginBottom:"16px" }, onClick: () => {
    if(!state.currentProject) return;
    fetch('/api/projects/' + state.currentProject.id + '/backup', { method: 'POST' }).then(()=>render());
  }}, svgIcon("backup"), " Create Backup Now"));

  if (!p._mcBackups || p._mcBackups.length === 0) {
    container.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"16px", background:"#090f09", border:"1px solid #162016", borderRadius:"8px", textAlign:"center" } }, "No backups yet. Click the button above to create your first backup."));
    return;
  }

  const list = el("div", { className: "backups-list" });
  p._mcBackups.forEach((b) => {
    list.appendChild(el("div", { className: "backup-row" },
      el("div", { className: "backup-left" },
        svgIcon("backup"),
        el("div", { className: "backup-info" },
          el("div", { className: "backup-label" }, b.label),
          el("div", { className: "backup-ts" }, b.ts)
        )
      ),
      el("button", { className: "btn-revert", onClick: () => {
        if (!confirm("Revert to this backup? The server will restart.")) return;
        fetch('/api/projects/' + p.id + '/revert', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({dir: b.dir}) }).then(()=>render());
      }}, svgIcon("revert"), " Revert to this backup")
    ));
  });
  container.appendChild(list);
}

function buildMcAbout(container, p) {
  container.appendChild(el("div", { className: "mc-section-title" }, "Server About"));
  
  const fontRow = el("div", { style: { display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"12px", alignItems:"center" } },
    el("span", { style: { fontSize:"11px", color:"var(--text-muted)", fontWeight:"700", textTransform:"uppercase", letterSpacing:".06em" } }, "Font:")
  );
  
  FONTS.forEach(f => {
    fontRow.appendChild(el("button", { 
      className: "font-btn" + ((p.serverAboutFont || "") === f.value ? " active" : ""), 
      style: { fontFamily: f.value || "inherit" }, 
      onClick: () => { p.serverAboutFont = f.value; saveProjects(); scheduleRender(); }
    }, f.label));
  });
  container.appendChild(fontRow);

  const ta = el("textarea", { className: "about-editor", placeholder: "Write your server description here...", style: { fontFamily: p.serverAboutFont || "inherit" } });
  ta.value = p.serverAbout || "";
  
  const preview = el("div", { className: "about-preview", style: { fontFamily: p.serverAboutFont || "inherit" } });
  preview.textContent = p.serverAbout || "Your description will appear here...";
  if (!p.serverAbout) preview.style.color = "var(--text-muted)";

  ta.oninput = () => { 
    p.serverAbout = ta.value; 
    preview.style.fontFamily = p.serverAboutFont || "inherit"; 
    preview.textContent = ta.value || "Your description will appear here..."; 
  };
  container.appendChild(ta);

  const saveBtn = el("button", { className: "btn-upload-mod", style: { marginTop:"10px", marginBottom:"16px" } }, svgIcon("save"), " Save Description");
  saveBtn.onclick = () => {
    p.serverAbout = ta.value;
    saveProjects();
    saveBtn.textContent = "Saved!";
    setTimeout(() => { saveBtn.innerHTML = ""; saveBtn.appendChild(svgIcon("save")); saveBtn.appendChild(document.createTextNode(" Save Description")); }, 1400);
  };
  container.appendChild(saveBtn);

  container.appendChild(el("div", { className: "mc-section-title" }, "Preview"));
  container.appendChild(preview);
}

fetch("/api/me").then(r => r.json()).then(d => {
  if (!d.loggedIn) { window.location.href = "/"; return; }
  state.username = d.username;
  fetch("/api/projects").then(r => r.json()).then(pd => {
    if (pd && pd.projects) state.projects = pd.projects;
    render();
  }).catch(() => render());
}).catch(() => render());
