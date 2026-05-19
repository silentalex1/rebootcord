const MC_VERSIONS = [
  "1.21.5","1.21.4","1.21.3","1.21.2","1.21.1","1.21",
  "1.20.6","1.20.5","1.20.4","1.20.3","1.20.2","1.20.1","1.20",
  "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
  "1.18.2","1.18.1","1.18",
  "1.17.1","1.17",
  "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1","1.16",
  "1.15.2","1.15.1","1.15",
  "1.14.4","1.14.3","1.14.2","1.14.1","1.14",
  "1.13.2","1.13.1","1.13",
  "1.12.2","1.12.1","1.12",
  "1.8.9","1.8.8","1.7.10"
];

const BOT_LANGS = [
  "JavaScript","TypeScript","Python","Lua","Java",
  "Go","Rust","Ruby","C#","PHP","Kotlin","Dart"
];

const MC_SERVER_TYPES = ["Vanilla","Paper","Forge","Fabric","Spigot","Purpur"];

const MAX_LOGS = 500;

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
  username: "",
};

let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
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

function iconEl(type, color) {
  const wrap = document.createElement("span");
  wrap.className = "icon";
  if (color) wrap.style.color = color;
  const inner = document.createElement("span");
  inner.className = "icon-" + type;
  wrap.appendChild(inner);
  return wrap;
}

function fileIconEl(type) {
  const map = { jar:"jar", config:"gear", doc:"doc", crown:"crown", list:"list", world:"world", plug:"plug" };
  return iconEl(map[type] || "doc");
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
}

function renderLoading() {
  const isMc = state.newType === "minecraft";
  const wrap = el("div", { className: "loading-screen" + (isMc ? " mc" : "") });
  const iconWrap = el("div", { className: "loading-icon-wrap" });
  const ic = el("span", { className: "icon-" + (isMc ? "pickaxe" : "bot"), style: { width:"32px", height:"32px", display:"block" } });
  iconWrap.appendChild(ic);
  wrap.appendChild(iconWrap);
  const bar = el("div", { className: "loading-bar" });
  bar.appendChild(el("div", { className: "loading-bar-fill" + (isMc ? " mc" : "") }));
  wrap.appendChild(bar);
  wrap.appendChild(el("div", { className: "loading-text" }, isMc ? "Setting up your Minecraft server..." : "Starting your bot..."));
  setTimeout(() => {
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

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "button";
  logoutBtn.innerHTML = `
    <svg style="display:none"><filter id="unopaq" x="-20%" y="-20%" width="140%" height="140%"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 9 0"/></filter></svg>
    <span class="text">Logout</span>
    <span class="a l"></span>
    <span class="a r"></span>
    <span class="a t"></span>
    <span class="a b"></span>
    <span class="backdrop"></span>
  `;
  logoutBtn.addEventListener("click", () => { fetch("/logout", { method:"POST" }).finally(() => { window.location.href = "/"; }); });
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
  btnNew.appendChild(iconEl("plus"));
  btnNew.appendChild(document.createTextNode(" New Project"));
  header.appendChild(btnNew);
  page.appendChild(header);
  if (state.projects.length === 0) {
    const empty = el("div", { className: "empty-state" });
    const emptyIcon = el("div", { className: "empty-icon" });
    const folderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    folderSvg.setAttribute("width", "48");
    folderSvg.setAttribute("height", "48");
    folderSvg.setAttribute("viewBox", "0 0 24 24");
    folderSvg.setAttribute("fill", "none");
    folderSvg.setAttribute("stroke", "#3a3a3a");
    folderSvg.setAttribute("stroke-width", "1.5");
    folderSvg.setAttribute("stroke-linecap", "round");
    folderSvg.setAttribute("stroke-linejoin", "round");
    folderSvg.innerHTML = `<path d="M3 7a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 0 12.828 8H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>`;
    emptyIcon.appendChild(folderSvg);
    empty.appendChild(emptyIcon);
    empty.appendChild(el("div", { className: "empty-title" }, "No projects yet"));
    empty.appendChild(el("div", { className: "empty-sub" }, "Create your first Discord bot or Minecraft server to get started."));
    const emptyBtn = el("button", { className: "btn-new", style: { margin:"0 auto" }, onClick: () => { state.showNewModal = true; scheduleRender(); } });
    emptyBtn.appendChild(iconEl("plus"));
    emptyBtn.appendChild(document.createTextNode(" Create Project"));
    empty.appendChild(emptyBtn);
    page.appendChild(empty);
  } else {
    const grid = el("div", { className: "projects-grid" });
    const docFrag = document.createDocumentFragment();
    state.projects.forEach(p => docFrag.appendChild(renderProjectCard(p)));
    grid.appendChild(docFrag);
    page.appendChild(grid);
  }
  frag.appendChild(page);
  if (state.showNewModal) frag.appendChild(renderModal());
  return frag;
}

function renderProjectCard(p) {
  const card = el("div", { className: "project-card" });
  const top = el("div", { className: "card-top" });
  const iconWrap = el("div", { className: "card-icon " + (p.type === "minecraft" ? "mc" : "discord") });
  const ic = el("span", { className: "icon-" + (p.type === "minecraft" ? "pickaxe" : "bot"), style: { width:"22px", height:"22px", display:"block" } });
  iconWrap.appendChild(ic);
  top.appendChild(iconWrap);
  top.appendChild(el("div", { className: "card-dot" + (p.running ? "" : " stopped") }));
  card.appendChild(top);
  card.appendChild(el("div", { className: "card-name" }, p.name));
  const tags = el("div", { className: "card-tags" });
  if (p.type === "minecraft") {
    tags.appendChild(el("span", { className: "tag" }, p.serverType + " " + p.version));
  } else {
    tags.appendChild(el("span", { className: "tag" }, p.lang));
  }
  tags.appendChild(el("span", { className: "tag " + (p.running ? "running" : "stopped") }, p.running ? "Running" : "Stopped"));
  card.appendChild(tags);
  const actions = el("div", { className: "card-actions" });
  const manage = el("button", { className: "btn-manage", onClick: () => openProject(p.id) }, "Manage");
  const del = el("button", { className: "btn-delete", onClick: () => deleteProject(p.id) }, "Delete");
  actions.appendChild(manage);
  actions.appendChild(del);
  card.appendChild(actions);
  return card;
}

function renderModal() {
  const overlay = el("div", { className: "modal-overlay", onClick: (ev) => { if (ev.target === overlay) { state.showNewModal = false; scheduleRender(); } } });
  const modal = el("div", { className: "modal" });
  modal.appendChild(el("h2", {}, "New Project"));
  const isMc = state.newType === "minecraft";
  const tabs = el("div", { className: "modal-type-tabs" });

  const tabDis = el("button", { className: "type-tab" + (!isMc ? " active" : ""), onClick: () => { state.newType = "discord"; scheduleRender(); } });
  const disIconWrap = el("div", { className: "type-tab-icon" });
  disIconWrap.appendChild(el("span", { className: "icon-bot", style: { width:"20px", height:"20px", display:"block" } }));
  tabDis.appendChild(disIconWrap);
  tabDis.appendChild(document.createTextNode("Discord Bot"));

  const tabMc = el("button", { className: "type-tab" + (isMc ? " active" : ""), onClick: () => { state.newType = "minecraft"; scheduleRender(); } });
  const mcIconWrap = el("div", { className: "type-tab-icon" });
  mcIconWrap.appendChild(el("span", { className: "icon-pickaxe", style: { width:"20px", height:"20px", display:"block" } }));
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
      const btn = el("button", { className: "lang-btn" + (t === state.newMcServerType ? " active" : ""), onClick: () => { state.newMcServerType = t; scheduleRender(); } }, t);
      stGrid.appendChild(btn);
    });
    stGroup.appendChild(stGrid);
    modal.appendChild(stGroup);

    const vGroup = el("div", { className: "form-group" });
    vGroup.appendChild(el("label", { className: "form-label" }, "Minecraft Version"));
    const sel = el("select", { className: "form-select" });
    const optFrag = document.createDocumentFragment();
    MC_VERSIONS.forEach(v => {
      const opt = el("option", { value: v }, v);
      if (v === state.newMcVersion) opt.selected = true;
      optFrag.appendChild(opt);
    });
    sel.appendChild(optFrag);
    sel.onchange = () => { state.newMcVersion = sel.value; };
    vGroup.appendChild(sel);
    modal.appendChild(vGroup);

    const ipGroup = el("div", { className: "form-group" });
    ipGroup.appendChild(el("label", { className: "form-label" }, "Server IP / Domain"));
    const ipInput = el("input", { className: "form-input", placeholder: "e.g. play.myserver.net", value: state.newMcIp });
    ipInput.oninput = () => { state.newMcIp = ipInput.value; };
    const ipNote = el("div", { style: { fontSize:"11px", color:"var(--text-muted)", marginTop:"5px" } }, "Players will connect with this address.");
    ipGroup.appendChild(ipInput);
    ipGroup.appendChild(ipNote);
    modal.appendChild(ipGroup);
  } else {
    const lGroup = el("div", { className: "form-group" });
    lGroup.appendChild(el("label", { className: "form-label" }, "Language"));
    const lgrid = el("div", { className: "lang-grid" });
    BOT_LANGS.forEach(lang => {
      const btn = el("button", { className: "lang-btn" + (lang === state.newLang ? " active" : ""), onClick: () => { state.newLang = lang; scheduleRender(); } }, lang);
      lgrid.appendChild(btn);
    });
    lGroup.appendChild(lgrid);
    modal.appendChild(lGroup);
  }

  const actions = el("div", { className: "modal-actions" });
  actions.appendChild(el("button", { className: "btn-cancel", onClick: () => { state.showNewModal = false; scheduleRender(); } }, "Cancel"));
  const createBtn = el("button", { className: "btn-create", id: "createBtn", onClick: createProject }, "Create");
  createBtn.disabled = !state.newName.trim();
  actions.appendChild(createBtn);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}

function createProject() {
  if (!state.newName.trim()) return;
  const id = Date.now();
  const p = {
    id,
    name:       state.newName.trim(),
    type:       state.newType,
    lang:       state.newLang,
    version:    state.newMcVersion,
    serverType: state.newMcServerType,
    ip:         state.newMcIp || (state.newName.toLowerCase().replace(/\s+/g, "-") + ".rebootcord.io"),
    running:    true,
  };
  state.projects.push(p);
  state.currentProject = p;
  state.newName    = "";
  state.newMcIp    = "";
  state.newMcServerType = "Vanilla";
  state.mcView     = "overview";
  state.mcFiles    = [];
  state.mcMods     = [];
  state.mcLogs     = [];
  state.botLogs    = [];
  state.codeContent = "";
  state.editorFile  = p.type === "discord" ? (p.lang === "Python" ? "main.py" : p.lang === "JavaScript" || p.lang === "TypeScript" ? "index.js" : "main.js") : "";
  state.loading    = true;
  render();
}

function openProject(id) {
  state.currentProject = state.projects.find(p => p.id === id);
  state.page     = state.currentProject.type === "minecraft" ? "mc-dashboard" : "bot-dashboard";
  state.mcView   = "overview";
  state.mcFiles  = state.currentProject._mcFiles || [];
  state.mcMods   = state.currentProject._mcMods  || [];
  render();
}

function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  state.projects = state.projects.filter(p => p.id !== id);
  render();
}

function renderBotDashboard() {
  const p = state.currentProject || {};
  const frag = document.createDocumentFragment();

  const dnav = el("nav", { className: "dash-nav" });
  const backBtn = el("button", { className: "btn-back", onClick: () => { state.page = "projects"; render(); } });
  backBtn.appendChild(iconEl("back"));
  backBtn.appendChild(document.createTextNode(" Back"));
  dnav.appendChild(backBtn);
  dnav.appendChild(el("span", { className: "dash-project-name" }, p.name || "Bot Project"));
  const langTag = el("span", { className: "tag", style: { fontSize:"11px" } }, p.lang || "");
  dnav.appendChild(langTag);

  const dtags = el("div", { className: "dash-tags" });
  const chip = el("div", { className: "status-chip" });
  chip.appendChild(el("div", { className: "status-dot" }));
  chip.appendChild(document.createTextNode(" Running"));
  dtags.appendChild(chip);
  const stopBtn = el("button", { className: "btn-stop", onClick: () => alert("Bot stopped.") });
  stopBtn.appendChild(el("span", { className: "icon-stop" }));
  stopBtn.appendChild(document.createTextNode(" Stop"));
  dtags.appendChild(stopBtn);
  dnav.appendChild(dtags);
  frag.appendChild(dnav);

  const dash = el("div", { className: "dashboard" });
  const sb = el("div", { className: "sidebar" });

  const filesSection = el("div", { className: "sidebar-section" });
  const filesLbl = el("div", { className: "sidebar-label" });
  filesLbl.appendChild(iconEl("folder"));
  filesLbl.appendChild(document.createTextNode(" Files"));
  filesSection.appendChild(filesLbl);

  const ext = p.lang === "Python" ? "py" : p.lang === "JavaScript" || p.lang === "TypeScript" ? "js" : p.lang === "Ruby" ? "rb" : p.lang === "Go" ? "go" : p.lang === "Rust" ? "rs" : p.lang === "Java" || p.lang === "Kotlin" ? "java" : "js";
  const mainFile = "main." + ext;
  [
    { name: mainFile, icon: "doc", badge: "main", active: true },
    { name: "requirements." + (p.lang === "Python" ? "txt" : "json"), icon: "list" },
    { name: "config.json", icon: "gear" },
  ].forEach(f => {
    const row = el("div", { className: "sidebar-file" + (f.active ? " active" : ""), onClick: () => { state.editorFile = f.name; scheduleRender(); } });
    const ic = el("span", { className: "icon-" + f.icon, style: { width:"14px", height:"14px", display:"inline-block", flexShrink:"0" } });
    row.appendChild(ic);
    row.appendChild(document.createTextNode(" " + f.name));
    if (f.badge) {
      const badge = el("span", { className: "file-badge" }, f.badge);
      row.appendChild(badge);
    }
    filesSection.appendChild(row);
  });
  sb.appendChild(filesSection);

  const pkgSection = el("div", { className: "sidebar-section" });
  const pkgLbl = el("div", { className: "sidebar-label" });
  pkgLbl.appendChild(iconEl("pkg"));
  pkgLbl.appendChild(document.createTextNode(" Packages"));
  pkgSection.appendChild(pkgLbl);
  const pkgInput = el("input", { className: "pkg-input", id: "pkgInput", placeholder: "package name" });
  pkgSection.appendChild(pkgInput);
  const installBtn = el("button", { className: "btn-install", onClick: installPkg });
  installBtn.appendChild(iconEl("download"));
  installBtn.appendChild(document.createTextNode(" Install"));
  pkgSection.appendChild(installBtn);
  sb.appendChild(pkgSection);

  const settingsSection = el("div", { className: "sidebar-section" });
  const settingsLbl = el("div", { className: "sidebar-label" });
  settingsLbl.appendChild(iconEl("gear"));
  settingsLbl.appendChild(document.createTextNode(" Settings"));
  settingsSection.appendChild(settingsLbl);

  const tokenField = el("div", { className: "settings-field" });
  tokenField.appendChild(el("label", {}, "Bot Token"));
  const tRow = el("div", { className: "settings-row" });
  const tInput = el("input", { className: "settings-input", type: "password", id: "tokenInput", placeholder: "Paste your bot token" });
  const tSaveBtn = el("button", { className: "btn-save", onClick: () => { const v = document.getElementById("tokenInput").value; if (v) alert("Token saved!"); } });
  tSaveBtn.appendChild(iconEl("save"));
  tRow.appendChild(tInput);
  tRow.appendChild(tSaveBtn);
  tokenField.appendChild(tRow);
  settingsSection.appendChild(tokenField);

  const autoField = el("div", { className: "settings-field", style: { display:"flex", alignItems:"center", gap:"8px" } });
  const autoCheck = el("input", { type: "checkbox", id: "autoRestart", style: { accentColor:"var(--red)" } });
  const autoLbl = el("label", { htmlFor: "autoRestart", style: { fontSize:"12px", color:"var(--text-dim)" } }, "Auto-restart on crash");
  autoField.appendChild(autoCheck);
  autoField.appendChild(autoLbl);
  settingsSection.appendChild(autoField);
  sb.appendChild(settingsSection);
  dash.appendChild(sb);

  const main = el("div", { className: "main-area" });
  const toolbar = el("div", { className: "editor-toolbar" });
  toolbar.appendChild(el("span", { className: "editor-filename" }, state.editorFile || mainFile));
  const saveFileBtn = el("button", { className: "btn-save-file", onClick: () => alert("File saved!") });
  saveFileBtn.appendChild(iconEl("save"));
  saveFileBtn.appendChild(document.createTextNode(" Save"));
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
  const panel = el("div", { className: "console-panel" });
  const toolbar = el("div", { className: "console-toolbar" });
  toolbar.appendChild(el("span", { className: "console-label" }, "Console"));
  const controls = el("div", { className: "console-controls" });
  const clearBtn = el("button", { className: "btn-clear", onClick: () => { state.botLogs = []; render(); } }, "Clear");
  controls.appendChild(clearBtn);
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

function renderMcDashboard() {
  const p = state.currentProject || {};
  const frag = document.createDocumentFragment();

  const dnav = el("nav", { className: "dash-nav", style: { borderBottomColor:"#162016" } });
  const backBtn = el("button", { className: "btn-back", onClick: () => { state.page = "projects"; render(); } });
  backBtn.appendChild(iconEl("back"));
  backBtn.appendChild(document.createTextNode(" Back"));
  dnav.appendChild(backBtn);
  dnav.appendChild(el("span", { className: "dash-project-name" }, p.name || "Minecraft Server"));

  const dtags = el("div", { className: "dash-tags" });
  const chip = el("div", { className: "status-chip" });
  chip.appendChild(el("div", { className: "status-dot" }));
  chip.appendChild(document.createTextNode(" Running"));
  dtags.appendChild(chip);
  const stopBtn = el("button", { className: "btn-stop", onClick: () => alert("Server stopping...") });
  stopBtn.appendChild(el("span", { className: "icon-stop" }));
  stopBtn.appendChild(document.createTextNode(" Stop"));
  dtags.appendChild(stopBtn);
  dnav.appendChild(dtags);
  frag.appendChild(dnav);

  const dash = el("div", { className: "dashboard", style: { background:"#050e05" } });
  const sb = el("div", { className: "mc-sidebar" });

  const hdr = el("div", { className: "mc-header-section" });
  hdr.appendChild(el("div", { className: "mc-server-name" }, p.name || "Minecraft Server"));
  hdr.appendChild(el("div", { className: "mc-server-ip" }, p.ip || "play.server.net"));
  const vtag = el("span", { className: "mc-version-tag" });
  vtag.appendChild(el("span", { className: "icon-cube", style: { width:"12px", height:"12px", display:"inline-block" } }));
  vtag.appendChild(document.createTextNode(" " + (p.serverType || "Vanilla") + " " + (p.version || "1.21.5")));
  hdr.appendChild(vtag);
  sb.appendChild(hdr);

  const navWrap = el("div", { style: { padding:"8px 0" } });
  [
    { id: "overview", iconType: "chart",    label: "Overview"       },
    { id: "files",    iconType: "folder",   label: "Files"          },
    { id: "mods",     iconType: "plug",     label: "Mods / Plugins" },
    { id: "console",  iconType: "terminal", label: "Console"        },
  ].forEach(item => {
    const btn = el("button", { className: "mc-nav-btn" + (state.mcView === item.id ? " active" : ""), onClick: () => { state.mcView = item.id; scheduleRender(); } });
    btn.appendChild(el("span", { className: "icon-" + item.iconType, style: { width:"16px", height:"16px", display:"inline-block" } }));
    btn.appendChild(document.createTextNode(" " + item.label));
    navWrap.appendChild(btn);
  });
  sb.appendChild(navWrap);

  const qa = el("div", { style: { padding:"14px", marginTop:"auto", borderTop:"1px solid #162016" } });
  const qaLbl = el("div", { style: { fontSize:"10px", color:"var(--text-muted)", marginBottom:"8px", fontWeight:"700", textTransform:"uppercase", letterSpacing:".08em" } }, "Quick Actions");
  qa.appendChild(qaLbl);

  const restartBtn = el("button", { style: { width:"100%", background:"#1c381c", color:"var(--mc-bright)", border:"none", padding:"8px", borderRadius:"7px", fontSize:"12px", fontWeight:"700", cursor:"pointer", marginBottom:"6px", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", fontFamily:"var(--font)" }, onClick: () => { state.mcLogs.push({ t: getTime(), type: "server", msg: "[Server thread/INFO]: Restarting server..." }); trimLogs(state.mcLogs); scheduleRender(); } });
  restartBtn.appendChild(iconEl("refresh"));
  restartBtn.appendChild(document.createTextNode(" Restart Server"));

  const backupBtn = el("button", { style: { width:"100%", background:"#1a1a1a", color:"var(--text-dim)", border:"none", padding:"8px", borderRadius:"7px", fontSize:"12px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", fontFamily:"var(--font)" }, onClick: () => alert("World backup created!") });
  backupBtn.appendChild(iconEl("save"));
  backupBtn.appendChild(document.createTextNode(" Backup World"));

  qa.appendChild(restartBtn);
  qa.appendChild(backupBtn);
  sb.appendChild(qa);
  dash.appendChild(sb);

  const main = el("div", { className: "mc-main" });
  if (state.mcView === "console") {
    main.style.cssText = "display:flex;flex-direction:column";
    main.appendChild(buildMcConsole(p));
  } else {
    const content = el("div", { className: "mc-content" });
    if (state.mcView === "overview")     buildMcOverview(content, p);
    else if (state.mcView === "files")   buildMcFiles(content);
    else if (state.mcView === "mods")    buildMcMods(content);
    main.appendChild(content);
  }

  dash.appendChild(main);
  frag.appendChild(dash);
  return frag;
}

function buildMcOverview(container, p) {
  const stats = [
    { label: "Status",  html: '<span style="font-size:16px;color:var(--green);font-weight:800">Online</span>', sub: "24/7 Uptime" },
    { label: "Players", html: '0<span style="font-size:14px;color:var(--text-muted)">/20</span>',              sub: "Online now"  },
    { label: "Version", html: '<span style="font-size:16px">' + (p.version || "1.21.5") + '</span>',           sub: (p.serverType || "Vanilla") + " Edition" },
    { label: "RAM",     html: '0<span style="font-size:14px;color:var(--text-muted)">MB</span>',               sub: "Used"        },
    { label: "TPS",     html: "20",                                                                             sub: "Ticks/sec"   },
    { label: "Uptime",  html: '<span style="font-size:16px">0m</span>',                                        sub: "Since start" },
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
  copyBtn.appendChild(iconEl("copy"));
  copyBtn.appendChild(document.createTextNode("Copy IP"));
  ipRow.appendChild(ipText);
  ipRow.appendChild(copyBtn);
  container.appendChild(ipRow);

  container.appendChild(el("div", { className: "mc-section-title" }, "Online Players"));
  container.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px", background:"#090f09", border:"1px solid #162016", borderRadius:"8px" } }, "No players online."));
}

function buildMcFiles(container) {
  const topRow = el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } });
  const title = el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Server Files");
  topRow.appendChild(title);
  const upBtn = el("button", { className: "btn-upload-mod", onClick: () => alert("Upload file dialog would open here.") });
  upBtn.appendChild(iconEl("upload"));
  upBtn.appendChild(document.createTextNode(" Upload File"));
  topRow.appendChild(upBtn);
  container.appendChild(topRow);

  const list = el("div", { className: "files-list" });
  if (state.mcFiles.length === 0) {
    list.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No files yet. Upload files to get started."));
  }
  state.mcFiles.forEach((f, i) => {
    const item = el("div", { className: "file-item" });
    const icEl = fileIconEl(f.type || "doc");
    icEl.style.cssText = "width:18px;height:18px;color:var(--mc-bright)";
    item.appendChild(icEl);
    item.appendChild(el("span", { className: "file-item-name" }, f.name));
    item.appendChild(el("span", { className: "file-item-size" }, f.size));
    const actions = el("div", { className: "file-item-actions" });
    const delBtn = el("button", { className: "btn-file-action danger", onClick: () => { if (confirm("Delete " + f.name + "?")) { state.mcFiles.splice(i, 1); render(); } } });
    delBtn.appendChild(iconEl("trash"));
    actions.appendChild(delBtn);
    item.appendChild(actions);
    list.appendChild(item);
  });
  container.appendChild(list);

  const addBtn = el("button", { className: "btn-add-file", onClick: () => { const name = prompt("File name:"); if (name) { state.mcFiles.push({ name, size: "0 KB", type: "doc" }); render(); } } });
  addBtn.appendChild(iconEl("plus"));
  addBtn.appendChild(document.createTextNode(" New File"));
  container.appendChild(addBtn);
}

function buildMcMods(container) {
  const topRow = el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } });
  const title = el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Mods / Plugins");
  topRow.appendChild(title);
  const upBtn = el("button", { className: "btn-upload-mod", onClick: () => alert("Upload .jar mod dialog would open here.") });
  upBtn.appendChild(iconEl("upload"));
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
    const toggleBtn = el("button", { style: { background:"transparent", color:"var(--text-muted)", border:"none", fontSize:"11px", cursor:"pointer", fontWeight:"700", fontFamily:"var(--font)" }, onClick: () => { state.mcMods[i].active = !state.mcMods[i].active; scheduleRender(); } }, "Toggle");
    mbot.appendChild(toggleBtn);
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
  const chip = el("div", { className: "status-chip" });
  chip.appendChild(el("div", { className: "status-dot" }));
  chip.appendChild(document.createTextNode(" Running"));
  rightTools.appendChild(chip);
  const clearBtn = el("button", { className: "btn-clear", onClick: () => { state.mcLogs = []; render(); } }, "Clear");
  rightTools.appendChild(clearBtn);
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
  const sendBtn = el("button", { className: "btn-send-cmd", onClick: () => sendMcCmd(cmdInput.value) }, "Send");
  inputRow.appendChild(cmdInput);
  inputRow.appendChild(sendBtn);
  wrap.appendChild(inputRow);
  return wrap;
}

function sendMcCmd(cmd) {
  cmd = (cmd || "").trim();
  if (!cmd) return;
  const t = getTime();
  state.mcLogs.push({ t, type: "server", msg: "[Console] /" + cmd });
  if (cmd.startsWith("say ")) {
    state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: [CONSOLE] " + cmd.slice(4) });
  } else if (cmd === "list") {
    state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: There are 0 of a max of 20 players online." });
  } else if (cmd === "stop") {
    state.mcLogs.push({ t, type: "warn", msg: "[Server thread/INFO]: Stopping the server..." });
  } else if (cmd === "tps") {
    state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0" });
  } else if (cmd === "help") {
    state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: Available commands: list, say <msg>, stop, kick <player>, tps, time set day, weather clear" });
  } else {
    state.mcLogs.push({ t, type: "info", msg: "[Server thread/INFO]: Command executed: /" + cmd });
  }
  trimLogs(state.mcLogs);
  state.mcCmd = "";
  render();
}


fetch("/api/me").then(r => r.json()).then(d => {
  if (!d.loggedIn) { window.location.href = "/"; return; }
  state.username = d.username;
  render();
}).catch(() => render());
