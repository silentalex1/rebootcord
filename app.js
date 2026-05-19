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

let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
}

function scrollConsolesToBottom() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".console-body,.mc-console-body").forEach(b => { b.scrollTop = b.scrollHeight; });
  });
}

function trimLogs(arr) {
  if (arr.length > MAX_LOGS) arr.splice(0, arr.length - MAX_LOGS);
}

function getTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "className") node.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// SVG icon helper — no weird font icons
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

function saveProjects() {
  const proj = state.projects.find(x => x.id === (state.currentProject && state.currentProject.id));
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
  state.codeContent = (state.currentProject.files && state.currentProject.files[filename]) || "";
  scheduleRender();
}

function render() {
  const app = document.getElementById("app");
  const frag = document.createDocumentFragment();
  if (state.loading) frag.appendChild(renderLoading());
  else if (state.page === "projects") frag.appendChild(renderProjectsPage());
  else if (state.page === "bot-dashboard") frag.appendChild(renderBotDashboard());
  else if (state.page === "mc-dashboard") frag.appendChild(renderMcDashboard());
  app.textContent = "";
  app.appendChild(frag);
  scrollConsolesToBottom();
}

function renderLoading() {
  const isMc = state.newType === "minecraft";
  const wrap = el("div", { className: "loading-screen" + (isMc ? " mc" : "") });
  const iconWrap = el("div", { className: "loading-icon-wrap" });
  iconWrap.appendChild(svgIcon(isMc ? "pickaxe" : "discord"));
  wrap.appendChild(iconWrap);
  const bar = el("div", { className: "loading-bar" });
  bar.appendChild(el("div", { className: "loading-bar-fill" + (isMc ? " mc" : "") }));
  wrap.appendChild(bar);
  wrap.appendChild(el("div", { className: "loading-text" }, isMc ? "Setting up your Minecraft server..." : "Starting your bot..."));
  setTimeout(() => {
    state.loading = false;
    state.page = state.newType === "minecraft" ? "mc-dashboard" : "bot-dashboard";
    state.showNewModal = false;
    const t = getTime();
    if (state.newType !== "minecraft") {
      state.botLogs = [
        { t, type: "sys", msg: "[System] Bot container initialized." },
        { t, type: "info", msg: "[Info] Installing dependencies..." },
        { t, type: "ok", msg: "[Info] Dependencies ready." },
        { t, type: "ok", msg: "[Info] Bot process started. Waiting for token to connect..." },
      ];
    } else {
      state.mcLogs = [
        { t, type: "server", msg: "[Server thread/INFO]: Starting Minecraft server version " + (state.currentProject.version || "1.21.5") },
        { t, type: "server", msg: "[Server thread/INFO]: Loading properties..." },
        { t, type: "server", msg: "[Server thread/INFO]: " + (state.currentProject.serverType || "Vanilla") + " server is running." },
        { t, type: "info", msg: "[Server thread/INFO]: Preparing spawn area..." },
        { t, type: "info", msg: '[Server thread/INFO]: Done! For help, type "help"' },
      ];
    }
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
  const logoutBtn = el("button", { className: "btn-logout-nav", onClick: () => { fetch("/logout", { method:"POST" }).finally(() => { window.location.href = "/"; }); } });
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
  titleDiv.appendChild(el("h1", {}, "Your Projects"));
  titleDiv.appendChild(el("p", {}, "Manage your Discord bots and Minecraft servers"));
  header.appendChild(titleDiv);
  const btnNew = el("button", { className: "btn-new", onClick: () => { state.showNewModal = true; scheduleRender(); } });
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
    const emptyBtn = el("button", { className: "btn-new", style: { margin:"0 auto" }, onClick: () => { state.showNewModal = true; scheduleRender(); } });
    emptyBtn.appendChild(svgIcon("plus"));
    emptyBtn.appendChild(document.createTextNode(" Create Project"));
    empty.appendChild(emptyBtn);
    page.appendChild(empty);
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
  const card = el("div", { className: "project-card" + (isMc ? " mc" : " discord") });
  const top = el("div", { className: "card-top" });
  const iconWrap = el("div", { className: "card-icon " + (isMc ? "mc" : "discord") });
  iconWrap.appendChild(svgIcon(isMc ? "pickaxe" : "discord"));
  top.appendChild(iconWrap);
  top.appendChild(el("div", { className: "card-dot" + (p.running ? "" : " stopped") }));
  card.appendChild(top);
  card.appendChild(el("div", { className: "card-name" }, p.name));
  const tags = el("div", { className: "card-tags" });
  tags.appendChild(el("span", { className: "tag" }, isMc ? (p.serverType + " " + p.version) : p.lang));
  tags.appendChild(el("span", { className: "tag " + (p.running ? "running" : "stopped") }, p.running ? "Running" : "Stopped"));
  card.appendChild(tags);
  const actions = el("div", { className: "card-actions" });
  const manage = el("button", { className: "btn-manage", onClick: () => openProject(p.id) }, "Manage");
  // Stop/Start icon button on card
  const stopStartBtn = el("button", { className: "btn-card-toggle " + (p.running ? "running" : "stopped"), onClick: (e) => { e.stopPropagation(); toggleRunningFromCard(p); } });
  stopStartBtn.appendChild(svgIcon(p.running ? "stop" : "play"));
  const del = el("button", { className: "btn-delete", onClick: () => deleteProject(p.id) }, "Delete");
  actions.appendChild(manage);
  actions.appendChild(stopStartBtn);
  actions.appendChild(del);
  card.appendChild(actions);
  return card;
}

function toggleRunningFromCard(p) {
  p.running = !p.running;
  const proj = state.projects.find(x => x.id === p.id);
  if (proj) proj.running = p.running;
  saveProjects();
  render();
}

function renderModal() {
  const overlay = el("div", { className: "modal-overlay", onClick: (ev) => { if (ev.target === overlay) { state.showNewModal = false; scheduleRender(); } } });
  const modal = el("div", { className: "modal" });
  modal.appendChild(el("h2", {}, "New Project"));
  const isMc = state.newType === "minecraft";
  const tabs = el("div", { className: "modal-type-tabs" });

  const tabDis = el("button", { className: "type-tab" + (!isMc ? " active discord" : ""), onClick: () => { state.newType = "discord"; scheduleRender(); } });
  const disIconWrap = el("div", { className: "type-tab-icon" });
  disIconWrap.appendChild(svgIcon("discord"));
  tabDis.appendChild(disIconWrap);
  tabDis.appendChild(document.createTextNode("Discord Bot"));

  const tabMc = el("button", { className: "type-tab" + (isMc ? " active mc" : ""), onClick: () => { state.newType = "minecraft"; scheduleRender(); } });
  const mcIconWrap = el("div", { className: "type-tab-icon" });
  mcIconWrap.appendChild(svgIcon("pickaxe"));
  tabMc.appendChild(mcIconWrap);
  tabMc.appendChild(document.createTextNode("Minecraft Server"));

  tabs.appendChild(tabDis);
  tabs.appendChild(tabMc);
  modal.appendChild(tabs);

  const nameGroup = el("div", { className: "form-group" });
  nameGroup.appendChild(el("label", { className: "form-label" }, "Project Name"));
  const nameInput = el("input", { className: "form-input", placeholder: isMc ? "e.g. my-survival-server" : "e.g. my-bot", value: state.newName });
  nameInput.oninput = () => {
    state.newName = nameInput.value;
    const btn = document.getElementById("createBtn");
    if (btn) btn.disabled = !state.newName.trim();
  };
  nameGroup.appendChild(nameInput);
  modal.appendChild(nameGroup);

  if (isMc) {
    const stGroup = el("div", { className: "form-group" });
    stGroup.appendChild(el("label", { className: "form-label" }, "Server Type"));
    const stGrid = el("div", { className: "lang-grid" });
    MC_SERVER_TYPES.forEach(t => {
      stGrid.appendChild(el("button", { className: "lang-btn mc" + (t === state.newMcServerType ? " active" : ""), onClick: () => { state.newMcServerType = t; scheduleRender(); } }, t));
    });
    stGroup.appendChild(stGrid);
    modal.appendChild(stGroup);

    const vGroup = el("div", { className: "form-group" });
    vGroup.appendChild(el("label", { className: "form-label" }, "Minecraft Version"));
    const sel = el("select", { className: "form-select" });
    MC_VERSIONS.forEach(v => {
      const opt = el("option", { value: v }, v);
      if (v === state.newMcVersion) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => { state.newMcVersion = sel.value; };
    vGroup.appendChild(sel);
    modal.appendChild(vGroup);

    const ipGroup = el("div", { className: "form-group" });
    ipGroup.appendChild(el("label", { className: "form-label" }, "Server IP / Domain"));
    const ipInput = el("input", { className: "form-input", placeholder: "e.g. play.myserver.net", value: state.newMcIp });
    ipInput.oninput = () => { state.newMcIp = ipInput.value; };
    ipGroup.appendChild(ipInput);
    ipGroup.appendChild(el("div", { style: { fontSize:"11px", color:"var(--text-muted)", marginTop:"5px" } }, "Players will connect with this address."));
    modal.appendChild(ipGroup);
  } else {
    const lGroup = el("div", { className: "form-group" });
    lGroup.appendChild(el("label", { className: "form-label" }, "Language"));
    const lgrid = el("div", { className: "lang-grid" });
    BOT_LANGS.forEach(lang => {
      lgrid.appendChild(el("button", { className: "lang-btn" + (lang === state.newLang ? " active" : ""), onClick: () => { state.newLang = lang; scheduleRender(); } }, lang));
    });
    lGroup.appendChild(lgrid);
    modal.appendChild(lGroup);
  }

  const actions = el("div", { className: "modal-actions" });
  actions.appendChild(el("button", { className: "btn-cancel", onClick: () => { state.showNewModal = false; scheduleRender(); } }, "Cancel"));
  const createBtn = el("button", { className: "btn-create" + (isMc ? " mc" : ""), id: "createBtn", onClick: createProject }, "Create");
  createBtn.disabled = !state.newName.trim();
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
  if (p.lang === "Python") return "import discord\nimport os\n\nintents = discord.Intents.default()\nintents.message_content = True\nclient = discord.Client(intents=intents)\n\n@client.event\nasync def on_ready():\n    print(f'Logged in as {client.user}')\n\n@client.event\nasync def on_message(message):\n    if message.author == client.user:\n        return\n    if message.content.startswith('!ping'):\n        await message.channel.send('Pong!')\n\nclient.run(os.environ['BOT_TOKEN'])\n";
  if (p.lang === "TypeScript") return "import { Client, GatewayIntentBits } from 'discord.js';\n\nconst client = new Client({\n  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]\n});\n\nclient.once('ready', () => {\n  console.log(`Logged in as ${client.user?.tag}`);\n});\n\nclient.on('messageCreate', message => {\n  if (message.author.bot) return;\n  if (message.content === '!ping') {\n    message.reply('Pong!');\n  }\n});\n\nclient.login(process.env.BOT_TOKEN);\n";
  return "const { Client, GatewayIntentBits } = require('discord.js');\n\nconst client = new Client({\n  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]\n});\n\nclient.once('ready', () => {\n  console.log(`Logged in as ${client.user.tag}`);\n});\n\nclient.on('messageCreate', message => {\n  if (message.author.bot) return;\n  if (message.content === '!ping') {\n    message.reply('Pong!');\n  }\n});\n\nclient.login(process.env.BOT_TOKEN);\n";
}

function createProject() {
  if (!state.newName.trim()) return;
  const id = Date.now();
  const p = {
    id, name: state.newName.trim(), type: state.newType,
    lang: state.newLang, version: state.newMcVersion,
    serverType: state.newMcServerType,
    ip: state.newMcIp || (state.newName.toLowerCase().replace(/\s+/g, "-") + ".rebootcord.io"),
    running: false, files: {}, serverAbout: "", serverAboutFont: "",
    _mcFiles: [], _mcMods: [], _mcBackups: [],
  };
  if (p.type === "discord") {
    const fname = getDefaultFilename(p);
    p.files[fname] = getDefaultCode(p);
  }
  state.projects.push(p);
  state.currentProject = p;
  state.newName = ""; state.newMcIp = ""; state.newMcServerType = "Vanilla";
  state.mcView = "overview"; state.mcFiles = []; state.mcMods = []; state.mcBackups = [];
  state.botLogs = []; state.mcLogs = [];
  if (p.type === "discord") {
    state.editorFile = getDefaultFilename(p);
    state.codeContent = p.files[state.editorFile];
  } else {
    state.editorFile = ""; state.codeContent = "";
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
  state.botLogs = []; state.mcLogs = [];
  if (p.type === "discord") {
    state.editorFile = getDefaultFilename(p);
    state.codeContent = (p.files && p.files[state.editorFile]) || "";
  }
  render();
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
  const t = getTime();
  if (p.type === "discord") {
    if (p.running) {
      state.botLogs.push({ t, type: "sys", msg: "[System] Bot process started." });
      state.botLogs.push({ t, type: "info", msg: "[Info] Connecting to Discord gateway..." });
      state.botLogs.push({ t, type: "ok", msg: "[Info] Bot is online and ready." });
    } else {
      state.botLogs.push({ t, type: "warn", msg: "[System] Bot process stopped." });
    }
    trimLogs(state.botLogs);
  } else {
    if (p.running) {
      state.mcLogs.push({ t, type: "server", msg: "[Server thread/INFO]: Starting Minecraft server..." });
      state.mcLogs.push({ t, type: "server", msg: "[Server thread/INFO]: Loading " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5") });
      state.mcLogs.push({ t, type: "info", msg: '[Server thread/INFO]: Done! For help, type "help"' });
    } else {
      state.mcLogs.push({ t, type: "warn", msg: "[Server thread/INFO]: Stopping the server..." });
      state.mcLogs.push({ t, type: "server", msg: "[Server thread/INFO]: Server stopped." });
    }
    trimLogs(state.mcLogs);
  }
  saveProjects();
  render();
}

function flashSaveBtn(btn, orig) {
  btn.textContent = "Saved!";
  btn.style.color = "var(--green)";
  setTimeout(() => { btn.textContent = "Save"; btn.style.color = ""; }, 1400);
}

// ========== BOT DASHBOARD ==========
function renderBotDashboard() {
  const p = state.currentProject || {};
  const frag = document.createDocumentFragment();

  const dnav = el("nav", { className: "dash-nav discord-nav" });
  const backBtn = el("button", { className: "btn-back", onClick: () => { state.page = "projects"; render(); } });
  backBtn.appendChild(svgIcon("back"));
  backBtn.appendChild(document.createTextNode(" Back"));
  dnav.appendChild(backBtn);

  const discordIcon = el("div", { className: "dash-nav-discord-icon" });
  discordIcon.appendChild(svgIcon("discord"));
  dnav.appendChild(discordIcon);

  dnav.appendChild(el("span", { className: "dash-project-name discord-name" }, p.name || "Bot Project"));
  const langTag = el("span", { className: "tag discord-tag", style: { fontSize:"11px" } }, p.lang || "");
  dnav.appendChild(langTag);

  const dtags = el("div", { className: "dash-tags" });
  const chip = el("div", { className: "status-chip" + (p.running ? " discord" : " stopped") });
  chip.appendChild(el("div", { className: "status-dot" + (p.running ? " discord" : " stopped") }));
  chip.appendChild(document.createTextNode(p.running ? " Running" : " Stopped"));
  dtags.appendChild(chip);
  const toggleBtn = el("button", { className: p.running ? "btn-stop-discord" : "btn-start-discord", onClick: () => toggleRunning(p) });
  toggleBtn.appendChild(svgIcon(p.running ? "stop" : "play"));
  toggleBtn.appendChild(document.createTextNode(p.running ? " Stop" : " Start"));
  dtags.appendChild(toggleBtn);
  dnav.appendChild(dtags);
  frag.appendChild(dnav);

  const dash = el("div", { className: "dashboard discord-dash" });
  const sb = el("div", { className: "sidebar discord-sidebar" });

  // Wave background for discord sidebar
  const waveBg = el("div", { className: "discord-wave-bg" });
  sb.appendChild(waveBg);

  const filesSection = el("div", { className: "sidebar-section" });
  const filesLbl = el("div", { className: "sidebar-label discord-label" });
  filesLbl.appendChild(svgIcon("folder"));
  filesLbl.appendChild(document.createTextNode(" Files"));
  filesSection.appendChild(filesLbl);

  const mainFile = getDefaultFilename(p);
  // Get all files from project
  const projectFiles = Object.keys((p.files && typeof p.files === 'object') ? p.files : {});
  if (!projectFiles.includes(mainFile)) projectFiles.unshift(mainFile);
  const extraFiles = ["requirements." + (p.lang === "Python" ? "txt" : "json"), "config.json"];
  extraFiles.forEach(f => { if (!projectFiles.includes(f)) projectFiles.push(f); });

  projectFiles.forEach(fname => {
    const isActive = state.editorFile === fname || (!state.editorFile && fname === mainFile);
    const row = el("div", { className: "sidebar-file discord-file" + (isActive ? " active" : ""), onClick: () => switchFile(fname) });
    row.appendChild(svgIcon("doc"));
    row.appendChild(document.createTextNode(" " + fname));
    if (fname === mainFile) row.appendChild(el("span", { className: "file-badge discord-badge" }, "main"));
    filesSection.appendChild(row);
  });

  // Add new file button
  const addFileBtn = el("button", { className: "btn-add-file-small", onClick: () => {
    const name = prompt("New file name (e.g. utils.py):");
    if (name && name.trim()) {
      state.currentProject.files = state.currentProject.files || {};
      state.currentProject.files[name.trim()] = "";
      switchFile(name.trim());
    }
  }});
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
  pkgInput.onkeydown = (ev) => { if (ev.key === "Enter") installPkg(); };
  pkgSection.appendChild(pkgInput);
  const installBtn = el("button", { className: "btn-install discord-btn", onClick: installPkg });
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
  tokenField.appendChild(el("label", {}, "Bot Token"));
  const tRow = el("div", { className: "settings-row" });
  const tInput = el("input", { className: "settings-input discord-input", type: "password", id: "tokenInput", placeholder: "Paste your bot token", value: p.botToken || "" });
  const tSaveBtn = el("button", { className: "btn-save discord-btn-sm" });
  tSaveBtn.appendChild(svgIcon("save"));
  tSaveBtn.addEventListener("click", () => {
    const v = document.getElementById("tokenInput").value.trim();
    if (!v) return;
    p.botToken = v;
    const proj = state.projects.find(x => x.id === p.id);
    if (proj) proj.botToken = v;
    saveProjects();
    tSaveBtn.textContent = "Saved!";
    setTimeout(() => { tSaveBtn.innerHTML = ""; tSaveBtn.appendChild(svgIcon("save")); }, 1400);
  });
  tRow.appendChild(tInput);
  tRow.appendChild(tSaveBtn);
  tokenField.appendChild(tRow);
  settingsSection.appendChild(tokenField);

  const autoField = el("div", { className: "settings-field", style: { display:"flex", alignItems:"center", gap:"8px" } });
  const autoCheck = el("input", { type: "checkbox", id: "autoRestart", style: { accentColor:"#5865f2" } });
  if (p.autoRestart) autoCheck.checked = true;
  autoCheck.onchange = () => {
    p.autoRestart = autoCheck.checked;
    const proj = state.projects.find(x => x.id === p.id);
    if (proj) proj.autoRestart = p.autoRestart;
    saveProjects();
  };
  autoField.appendChild(autoCheck);
  autoField.appendChild(el("label", { htmlFor: "autoRestart", style: { fontSize:"12px", color:"var(--text-dim)" } }, "Auto-restart on crash"));
  settingsSection.appendChild(autoField);
  sb.appendChild(settingsSection);
  dash.appendChild(sb);

  const main = el("div", { className: "main-area" });
  const toolbar = el("div", { className: "editor-toolbar discord-toolbar" });
  toolbar.appendChild(el("span", { className: "editor-filename" }, state.editorFile || mainFile));
  const saveFileBtn = el("button", { className: "btn-save-file discord-btn-sm" });
  saveFileBtn.appendChild(svgIcon("save"));
  saveFileBtn.appendChild(document.createTextNode(" Save"));
  saveFileBtn.addEventListener("click", () => {
    saveCurrentFile();
    flashSaveBtn(saveFileBtn);
    const t = getTime();
    state.botLogs.push({ t, type: "sys", msg: "[System] File " + (state.editorFile || mainFile) + " saved." });
    trimLogs(state.botLogs);
    scrollConsolesToBottom();
  });
  toolbar.appendChild(saveFileBtn);
  main.appendChild(toolbar);

  const edArea = el("div", { className: "editor-area" });
  const ta = el("textarea", { className: "code-editor", spellcheck: "false", placeholder: "Write your bot code here..." });
  ta.value = state.codeContent;
  ta.oninput = () => { state.codeContent = ta.value; };
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
  controls.appendChild(el("button", { className: "btn-clear", onClick: () => { state.botLogs = []; render(); } }, "Clear"));
  toolbar.appendChild(controls);
  panel.appendChild(toolbar);
  const body = el("div", { className: "console-body" });
  if (state.botLogs.length === 0) {
    body.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"12px" } }, "Bot console output will appear here."));
  }
  state.botLogs.forEach(l => {
    const line = el("div", { className: "log-line" });
    line.appendChild(el("span", { className: "log-time" }, l.t));
    line.appendChild(el("span", { className: "log-" + l.type }, l.msg));
    body.appendChild(line);
  });
  panel.appendChild(body);
  return panel;
}

function installPkg() {
  const input = document.getElementById("pkgInput");
  const v = input ? input.value.trim() : "";
  if (!v) return;
  if (input) input.value = "";
  const t = getTime();
  state.botLogs.push({ t, type: "info", msg: "[PKG] Installing " + v + "..." });
  trimLogs(state.botLogs);
  render();
  setTimeout(() => {
    state.botLogs.push({ t: getTime(), type: "ok", msg: "[PKGDONE] " + v + " installed successfully." });
    trimLogs(state.botLogs);
    render();
  }, 1200);
}

// ========== MC DASHBOARD ==========
function renderMcDashboard() {
  const p = state.currentProject || {};
  const frag = document.createDocumentFragment();

  const dnav = el("nav", { className: "dash-nav", style: { borderBottomColor:"#162016" } });
  const backBtn = el("button", { className: "btn-back", onClick: () => { state.page = "projects"; render(); } });
  backBtn.appendChild(svgIcon("back"));
  backBtn.appendChild(document.createTextNode(" Back"));
  dnav.appendChild(backBtn);
  dnav.appendChild(el("span", { className: "dash-project-name" }, p.name || "Minecraft Server"));

  const dtags = el("div", { className: "dash-tags" });
  const chip = el("div", { className: "status-chip" + (p.running ? "" : " stopped") });
  chip.appendChild(el("div", { className: "status-dot" + (p.running ? "" : " stopped") }));
  chip.appendChild(document.createTextNode(p.running ? " Running" : " Stopped"));
  dtags.appendChild(chip);
  const toggleBtn = el("button", { className: p.running ? "btn-stop" : "btn-start", onClick: () => toggleRunning(p) });
  toggleBtn.appendChild(svgIcon(p.running ? "stop" : "play"));
  toggleBtn.appendChild(document.createTextNode(p.running ? " Stop" : " Start"));
  dtags.appendChild(toggleBtn);
  dnav.appendChild(dtags);
  frag.appendChild(dnav);

  const dash = el("div", { className: "dashboard", style: { background:"#050e05" } });
  const sb = el("div", { className: "mc-sidebar" });

  const hdr = el("div", { className: "mc-header-section" });
  hdr.appendChild(el("div", { className: "mc-server-name" }, p.name || "Minecraft Server"));
  hdr.appendChild(el("div", { className: "mc-server-ip" }, p.ip || "play.server.net"));
  const vtag = el("span", { className: "mc-version-tag" });
  vtag.appendChild(svgIcon("pickaxe"));
  vtag.appendChild(document.createTextNode(" " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5")));
  hdr.appendChild(vtag);
  sb.appendChild(hdr);

  const navWrap = el("div", { style: { padding:"8px 0" } });
  [
    { id: "overview",  iconType: "chart",    label: "Overview"       },
    { id: "files",     iconType: "folder",   label: "Files"          },
    { id: "mods",      iconType: "plug",     label: "Mods / Plugins" },
    { id: "console",   iconType: "terminal", label: "Console"        },
    { id: "backups",   iconType: "backup",   label: "Backup Worlds"  },
    { id: "about",     iconType: "info",     label: "Server About"   },
  ].forEach(item => {
    const btn = el("button", { className: "mc-nav-btn" + (state.mcView === item.id ? " active" : ""), onClick: () => { state.mcView = item.id; scheduleRender(); } });
    btn.appendChild(svgIcon(item.iconType));
    btn.appendChild(document.createTextNode(" " + item.label));
    navWrap.appendChild(btn);
  });
  sb.appendChild(navWrap);

  const qa = el("div", { style: { padding:"14px", marginTop:"auto", borderTop:"1px solid #162016" } });
  qa.appendChild(el("div", { style: { fontSize:"10px", color:"var(--text-muted)", marginBottom:"8px", fontWeight:"700", textTransform:"uppercase", letterSpacing:".08em" } }, "Quick Actions"));

  const restartBtn = el("button", { className: "mc-quick-btn", onClick: () => {
    if (!p.running) {
      const t = getTime();
      state.mcLogs.push({ t, type: "warn", msg: "[Server thread/INFO]: Server is not running. Start it first." });
      state.mcView = "console"; scheduleRender(); return;
    }
    const t = getTime();
    state.mcLogs.push({ t, type: "warn", msg: "[Server thread/INFO]: Restarting server..." });
    state.mcLogs.push({ t, type: "server", msg: "[Server thread/INFO]: Stopping server..." });
    setTimeout(() => {
      const t2 = getTime();
      state.mcLogs.push({ t: t2, type: "server", msg: "[Server thread/INFO]: Starting " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5") + "..." });
      state.mcLogs.push({ t: t2, type: "info", msg: '[Server thread/INFO]: Done! For help, type "help"' });
      trimLogs(state.mcLogs);
      state.mcView = "console"; render();
    }, 1000);
    trimLogs(state.mcLogs);
    state.mcView = "console"; scheduleRender();
  }});
  restartBtn.appendChild(svgIcon("refresh"));
  restartBtn.appendChild(document.createTextNode(" Restart Server"));

  const backupQuickBtn = el("button", { className: "mc-quick-btn secondary", onClick: () => {
    const ts = new Date().toLocaleString();
    const backup = { id: Date.now(), label: "World Backup — " + ts, ts };
    state.mcBackups.unshift(backup);
    const proj = state.projects.find(x => x.id === p.id);
    if (proj) proj._mcBackups = state.mcBackups;
    saveProjects();
    const t = getTime();
    state.mcLogs.push({ t, type: "ok", msg: "[Backup] World backup created: " + ts });
    trimLogs(state.mcLogs);
    if (state.mcView === "console") scheduleRender();
    else { state.mcView = "backups"; scheduleRender(); }
  }});
  backupQuickBtn.appendChild(svgIcon("backup"));
  backupQuickBtn.appendChild(document.createTextNode(" Backup World"));

  qa.appendChild(restartBtn);
  qa.appendChild(backupQuickBtn);
  sb.appendChild(qa);
  dash.appendChild(sb);

  const main = el("div", { className: "mc-main" });
  if (state.mcView === "console") {
    main.style.cssText = "display:flex;flex-direction:column";
    main.appendChild(buildMcConsole(p));
  } else {
    const content = el("div", { className: "mc-content" });
    if (state.mcView === "overview")  buildMcOverview(content, p);
    else if (state.mcView === "files") buildMcFiles(content, p);
    else if (state.mcView === "mods")  buildMcMods(content);
    else if (state.mcView === "backups") buildMcBackups(content, p);
    else if (state.mcView === "about") buildMcAbout(content, p);
    main.appendChild(content);
  }

  dash.appendChild(main);
  frag.appendChild(dash);
  return frag;
}

function buildMcOverview(container, p) {
  const stats = [
    { label: "Status",  html: '<span style="font-size:16px;color:var(--green);font-weight:800">' + (p.running ? "Online" : "Offline") + '</span>', sub: p.running ? "24/7 Uptime" : "Server stopped" },
    { label: "Players", html: '0<span style="font-size:14px;color:var(--text-muted)">/20</span>', sub: "Online now" },
    { label: "Version", html: '<span style="font-size:16px">' + (p.version || "1.21.5") + '</span>', sub: (p.serverType || "Vanilla") + " Edition" },
    { label: "RAM",     html: '0<span style="font-size:14px;color:var(--text-muted)">MB</span>', sub: "Used" },
    { label: "TPS",     html: "20", sub: "Ticks/sec" },
    { label: "Uptime",  html: '<span style="font-size:16px">0m</span>', sub: "Since start" },
  ];
  const grid = el("div", { className: "mc-stats-grid" });
  stats.forEach(s => {
    const card = el("div", { className: "mc-stat" });
    card.appendChild(el("div", { className: "mc-stat-label" }, s.label));
    const val = el("div", { className: "mc-stat-value" });
    val.innerHTML = s.html;
    card.appendChild(val);
    card.appendChild(el("div", { className: "mc-stat-sub" }, s.sub));
    grid.appendChild(card);
  });
  container.appendChild(grid);
  container.appendChild(el("div", { className: "mc-section-title" }, "Server IP"));
  const ipRow = el("div", { style: { background:"#090f09", border:"1px solid #162016", borderRadius:"8px", padding:"14px", marginBottom:"20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"8px" } });
  const ipText = el("span", { style: { fontFamily:"var(--mono)", color:"var(--mc-bright)", fontSize:"15px", fontWeight:"600" } }, p.ip || "play.myserver.net");
  const copyBtn = el("button", { style: { background:"#1c381c", color:"var(--mc-bright)", border:"1px solid #2a5a2a", padding:"6px 13px", borderRadius:"7px", fontSize:"12px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", fontFamily:"var(--font)" }, onClick: () => { if (navigator.clipboard) navigator.clipboard.writeText(p.ip || "play.myserver.net"); copyBtn.lastChild.textContent = "Copied!"; setTimeout(() => { copyBtn.lastChild.textContent = "Copy IP"; }, 1400); } });
  copyBtn.appendChild(svgIcon("copy"));
  copyBtn.appendChild(document.createTextNode("Copy IP"));
  ipRow.appendChild(ipText);
  ipRow.appendChild(copyBtn);
  container.appendChild(ipRow);
  container.appendChild(el("div", { className: "mc-section-title" }, "Online Players"));
  container.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px", background:"#090f09", border:"1px solid #162016", borderRadius:"8px" } }, "No players online."));
}

function buildMcFiles(container, p) {
  const topRow = el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } });
  topRow.appendChild(el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Server Files"));
  const upBtn = el("button", { className: "btn-upload-mod", onClick: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const size = file.size < 1024 ? file.size + " B" : file.size < 1048576 ? (file.size/1024).toFixed(1) + " KB" : (file.size/1048576).toFixed(1) + " MB";
      // Actually read file content if text
      const reader = new FileReader();
      reader.onload = (re) => {
        const content = typeof re.target.result === "string" ? re.target.result : "";
        state.mcFiles.push({ name: file.name, size, type: "doc", content });
        const proj = state.projects.find(x => x.id === (p && p.id));
        if (proj) proj._mcFiles = state.mcFiles;
        saveProjects();
        render();
      };
      reader.readAsText(file);
    };
    input.click();
  }});
  upBtn.appendChild(svgIcon("upload"));
  upBtn.appendChild(document.createTextNode(" Upload File"));
  topRow.appendChild(upBtn);
  container.appendChild(topRow);

  const list = el("div", { className: "files-list" });
  if (state.mcFiles.length === 0) {
    list.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No files yet. Upload files to get started."));
  }
  state.mcFiles.forEach((f, i) => {
    const item = el("div", { className: "file-item" });
    const icEl = svgIcon("doc");
    icEl.style.cssText = "color:var(--mc-bright)";
    item.appendChild(icEl);
    item.appendChild(el("span", { className: "file-item-name" }, f.name));
    item.appendChild(el("span", { className: "file-item-size" }, f.size));
    const actions = el("div", { className: "file-item-actions" });
    const delBtn = el("button", { className: "btn-file-action danger", onClick: () => {
      if (confirm("Delete " + f.name + "?")) {
        state.mcFiles.splice(i, 1);
        const proj = state.projects.find(x => x.id === (p && p.id));
        if (proj) proj._mcFiles = state.mcFiles;
        saveProjects();
        render();
      }
    }});
    delBtn.appendChild(svgIcon("trash"));
    actions.appendChild(delBtn);
    item.appendChild(actions);
    list.appendChild(item);
  });
  container.appendChild(list);

  const addBtn = el("button", { className: "btn-add-file", onClick: () => {
    const name = prompt("File name:");
    if (name && name.trim()) {
      state.mcFiles.push({ name: name.trim(), size: "0 KB", type: "doc", content: "" });
      const proj = state.projects.find(x => x.id === (p && p.id));
      if (proj) proj._mcFiles = state.mcFiles;
      saveProjects();
      render();
    }
  }});
  addBtn.appendChild(svgIcon("plus"));
  addBtn.appendChild(document.createTextNode(" New File"));
  container.appendChild(addBtn);
}

function buildMcMods(container) {
  const topRow = el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } });
  topRow.appendChild(el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Mods / Plugins"));
  const upBtn = el("button", { className: "btn-upload-mod", onClick: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jar";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      state.mcMods.push({ name: file.name.replace(".jar", ""), ver: "1.0.0", active: true });
      const proj = state.projects.find(x => x.id === (state.currentProject && state.currentProject.id));
      if (proj) proj._mcMods = state.mcMods;
      saveProjects();
      render();
    };
    input.click();
  }});
  upBtn.appendChild(svgIcon("upload"));
  upBtn.appendChild(document.createTextNode(" Upload Mod"));
  topRow.appendChild(upBtn);
  container.appendChild(topRow);
  const grid = el("div", { className: "mods-grid" });
  if (state.mcMods.length === 0) {
    grid.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No mods installed yet."));
  }
  state.mcMods.forEach((m, i) => {
    const card = el("div", { className: "mod-card" });
    card.appendChild(el("div", { className: "mod-card-name" }, m.name));
    card.appendChild(el("div", { className: "mod-card-ver" }, "v" + m.ver));
    const mbot = el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"8px" } });
    mbot.appendChild(el("span", { className: "mod-card-status " + (m.active ? "active" : "inactive") }, m.active ? "Active" : "Inactive"));
    mbot.appendChild(el("button", { style: { background:"transparent", color:"var(--text-muted)", border:"none", fontSize:"11px", cursor:"pointer", fontWeight:"700", fontFamily:"var(--font)" }, onClick: () => { state.mcMods[i].active = !state.mcMods[i].active; scheduleRender(); } }, "Toggle"));
    card.appendChild(mbot);
    grid.appendChild(card);
  });
  container.appendChild(grid);
  container.appendChild(el("div", { style: { marginTop:"16px", padding:"14px", background:"#090f09", border:"1px dashed #2a5a2a", borderRadius:"8px", textAlign:"center", color:"var(--text-muted)", fontSize:"12px" } }, "Drop .jar files here or click Upload Mod to add plugins"));
}

function buildMcConsole(p) {
  const wrap = el("div", { className: "mc-console", style: { flex:"1" } });
  const toolbar = el("div", { className: "mc-console-toolbar" });
  toolbar.appendChild(el("span", { style: { fontSize:"10px", fontWeight:"800", color:"var(--mc-bright)", textTransform:"uppercase", letterSpacing:".1em" } }, "Console"));
  const rightTools = el("div", { style: { display:"flex", gap:"8px", alignItems:"center" } });
  const chip = el("div", { className: "status-chip" + (p.running ? "" : " stopped") });
  chip.appendChild(el("div", { className: "status-dot" + (p.running ? "" : " stopped") }));
  chip.appendChild(document.createTextNode(p.running ? " Running" : " Stopped"));
  rightTools.appendChild(chip);
  rightTools.appendChild(el("button", { className: "btn-clear", onClick: () => { state.mcLogs = []; render(); } }, "Clear"));
  toolbar.appendChild(rightTools);
  wrap.appendChild(toolbar);
  const body = el("div", { className: "mc-console-body", style: { flex:"1" } });
  if (state.mcLogs.length === 0) {
    body.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"12px" } }, "Server console output will appear here."));
  }
  state.mcLogs.forEach(l => {
    const line = el("div", { className: "log-line" });
    line.appendChild(el("span", { className: "log-time" }, l.t));
    line.appendChild(el("span", { className: "mc-log-" + l.type }, l.msg));
    body.appendChild(line);
  });
  wrap.appendChild(body);
  const inputRow = el("div", { className: "mc-console-input-row" });
  const cmdInput = el("input", { className: "mc-cmd-input", placeholder: "Type a server command...", value: state.mcCmd });
  cmdInput.oninput = () => { state.mcCmd = cmdInput.value; };
  cmdInput.onkeydown = (ev) => { if (ev.key === "Enter") sendMcCmd(cmdInput.value); };
  inputRow.appendChild(cmdInput);
  inputRow.appendChild(el("button", { className: "btn-send-cmd", onClick: () => sendMcCmd(cmdInput.value) }, "Send"));
  wrap.appendChild(inputRow);
  return wrap;
}

function sendMcCmd(cmd) {
  cmd = (cmd || "").trim();
  if (!cmd) return;
  const t = getTime();
  state.mcLogs.push({ t, type: "server", msg: "[Console] /" + cmd });
  if (cmd.startsWith("say ")) state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: [CONSOLE] " + cmd.slice(4) });
  else if (cmd === "list") state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: There are 0 of a max of 20 players online." });
  else if (cmd === "stop") { state.mcLogs.push({ t, type: "warn", msg: "[Server thread/INFO]: Stopping the server..." }); if (state.currentProject) { state.currentProject.running = false; const proj = state.projects.find(x => x.id === state.currentProject.id); if (proj) proj.running = false; saveProjects(); } }
  else if (cmd === "tps") state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0" });
  else if (cmd === "help") state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: Available commands: list, say <msg>, stop, kick <player>, tps, time set day, weather clear" });
  else if (cmd.startsWith("kick ")) state.mcLogs.push({ t, type: "warn", msg: "[Server thread/INFO]: Kicked " + cmd.slice(5) + " from the game." });
  else if (cmd === "time set day") state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: Set the time to 1000." });
  else if (cmd === "weather clear") state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: Changing to clear weather." });
  else state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: Command executed: /" + cmd });
  trimLogs(state.mcLogs);
  state.mcCmd = "";
  render();
}

function buildMcBackups(container, p) {
  container.appendChild(el("div", { className: "mc-section-title" }, "Backup Worlds"));
  const desc = el("div", { style: { color:"var(--text-muted)", fontSize:"12px", marginBottom:"16px", lineHeight:"1.6" } });
  desc.textContent = "Create backups of your world. Click a backup to restore it — the server will restart automatically.";
  container.appendChild(desc);

  const createBtn = el("button", { className: "btn-upload-mod", style: { marginBottom:"16px" }, onClick: () => {
    const ts = new Date().toLocaleString();
    const backup = { id: Date.now(), label: "World Backup — " + ts, ts };
    state.mcBackups.unshift(backup);
    const proj = state.projects.find(x => x.id === (p && p.id));
    if (proj) { proj._mcBackups = state.mcBackups; }
    saveProjects();
    const t = getTime();
    state.mcLogs.push({ t, type: "ok", msg: "[Backup] World backup created: " + ts });
    scheduleRender();
  }});
  createBtn.appendChild(svgIcon("backup"));
  createBtn.appendChild(document.createTextNode(" Create Backup Now"));
  container.appendChild(createBtn);

  if (state.mcBackups.length === 0) {
    container.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"16px", background:"#090f09", border:"1px solid #162016", borderRadius:"8px", textAlign:"center" } }, "No backups yet. Click the button above to create your first backup."));
    return;
  }

  const list = el("div", { className: "backups-list" });
  state.mcBackups.forEach((b, i) => {
    const row = el("div", { className: "backup-row" });
    const left = el("div", { className: "backup-left" });
    left.appendChild(svgIcon("backup"));
    const info = el("div", { className: "backup-info" });
    info.appendChild(el("div", { className: "backup-label" }, b.label));
    info.appendChild(el("div", { className: "backup-ts" }, b.ts));
    left.appendChild(info);
    row.appendChild(left);

    const revertBtn = el("button", { className: "btn-revert", onClick: () => {
      if (!confirm("Revert to this backup? The server will restart.")) return;
      const t = getTime();
      // Stop server if running
      if (state.currentProject && state.currentProject.running) {
        state.currentProject.running = false;
        const proj = state.projects.find(x => x.id === state.currentProject.id);
        if (proj) proj.running = false;
      }
      state.mcLogs.push({ t, type: "warn", msg: "[Backup] Reverting to backup: " + b.ts });
      state.mcLogs.push({ t, type: "server", msg: "[Server thread/INFO]: Stopping server for world revert..." });
      saveProjects();
      state.mcView = "console";
      render();
      setTimeout(() => {
        const t2 = getTime();
        state.mcLogs.push({ t: t2, type: "ok", msg: "[Backup] World restored from backup: " + b.ts });
        state.mcLogs.push({ t: t2, type: "server", msg: "[Server thread/INFO]: Restarting server with restored world..." });
        if (state.currentProject) state.currentProject.running = true;
        const proj = state.projects.find(x => x.id === (state.currentProject && state.currentProject.id));
        if (proj) proj.running = true;
        saveProjects();
        setTimeout(() => {
          const t3 = getTime();
          state.mcLogs.push({ t: t3, type: "server", msg: "[Server thread/INFO]: Starting " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5") + "..." });
          state.mcLogs.push({ t: t3, type: "info", msg: '[Server thread/INFO]: Done! World restored successfully.' });
          trimLogs(state.mcLogs);
          render();
        }, 1500);
      }, 1200);
    }});
    revertBtn.appendChild(svgIcon("revert"));
    revertBtn.appendChild(document.createTextNode(" Revert to this backup"));
    row.appendChild(revertBtn);

    const delBtn = el("button", { className: "btn-file-action danger", style: { marginLeft:"8px" }, onClick: () => {
      if (confirm("Delete this backup?")) {
        state.mcBackups.splice(i, 1);
        const proj = state.projects.find(x => x.id === (p && p.id));
        if (proj) proj._mcBackups = state.mcBackups;
        saveProjects();
        render();
      }
    }});
    delBtn.appendChild(svgIcon("trash"));
    row.appendChild(delBtn);
    list.appendChild(row);
  });
  container.appendChild(list);
}

function buildMcAbout(container, p) {
  container.appendChild(el("div", { className: "mc-section-title" }, "Server About"));
  container.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", marginBottom:"16px" } }, "Write a description for your server. Choose a font style for your description."));

  // Font selector
  const fontRow = el("div", { style: { display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"12px", alignItems:"center" } });
  fontRow.appendChild(el("span", { style: { fontSize:"11px", color:"var(--text-muted)", fontWeight:"700", textTransform:"uppercase", letterSpacing:".06em" } }, "Font:"));
  FONTS.forEach(f => {
    const btn = el("button", { className: "font-btn" + ((p.serverAboutFont || "") === f.value ? " active" : ""), style: { fontFamily: f.value || "inherit" }, onClick: () => {
      p.serverAboutFont = f.value;
      const proj = state.projects.find(x => x.id === p.id);
      if (proj) proj.serverAboutFont = f.value;
      scheduleRender();
    }}, f.label);
    fontRow.appendChild(btn);
  });
  container.appendChild(fontRow);

  const ta = el("textarea", { className: "about-editor", placeholder: "Write your server description here... (supports plain text)", style: { fontFamily: p.serverAboutFont || "inherit" } });
  ta.value = p.serverAbout || "";
  ta.oninput = () => { p.serverAbout = ta.value; preview.style.fontFamily = p.serverAboutFont || "inherit"; preview.textContent = ta.value || "Your description will appear here..."; };
  container.appendChild(ta);

  const saveBtn = el("button", { className: "btn-upload-mod", style: { marginTop:"10px", marginBottom:"16px" }, onClick: () => {
    p.serverAbout = ta.value;
    const proj = state.projects.find(x => x.id === p.id);
    if (proj) { proj.serverAbout = p.serverAbout; proj.serverAboutFont = p.serverAboutFont; }
    saveProjects();
    saveBtn.textContent = "Saved!";
    setTimeout(() => { saveBtn.innerHTML = ""; saveBtn.appendChild(svgIcon("save")); saveBtn.appendChild(document.createTextNode(" Save Description")); }, 1400);
  }});
  saveBtn.appendChild(svgIcon("save"));
  saveBtn.appendChild(document.createTextNode(" Save Description"));
  container.appendChild(saveBtn);

  container.appendChild(el("div", { className: "mc-section-title" }, "Preview"));
  const preview = el("div", { className: "about-preview", style: { fontFamily: p.serverAboutFont || "inherit" } });
  preview.textContent = p.serverAbout || "Your description will appear here...";
  if (!p.serverAbout) preview.style.color = "var(--text-muted)";
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
