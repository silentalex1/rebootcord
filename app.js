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
  missingPackages: [],
  currentFileTree: [],
  expandedFolders: [],
  searchTerm: "",
  searchInputFocused: false,
  isAdmin: false,
  changelogs: [],
  showChangelogModal: false,
  newChangelogTitle: "",
  newChangelogBody: "",
  generateChangelogLink: false,
  apiKeys: [],
  recentKey: null,
  recentKeyHidden: false,
  justSaved: false,
  apiKeysLoaded: false,
  lastCreatedKey: null,
  sdkInjected: false,
  scrollListenerAdded: false,
  viewChangelogSlug: null,
  showSearchModal: false,
  showAIChat: false,
  aiChatMessages: [],
  aiChatTyping: false,
  isAdmin: false,
  currentFeedbackUser: null,
  showFeedbackManagement: false,
  feedbackChatUsers: []
};

let ws;
let searchTimeout = null;

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
        
        const m1 = data.msg.match(/Missing package: (.+)/);
        if (m1 && m1[1]) {
          const pk = m1[1].trim();
          if (pk && state.missingPackages.indexOf(pk) === -1) state.missingPackages.push(pk);
        }
        const m2 = data.msg.match(/ModuleNotFoundError: No module named '([^']+)'/);
        if (m2 && m2[1]) {
          const pk = m2[1].trim();
          if (pk && state.missingPackages.indexOf(pk) === -1) state.missingPackages.push(pk);
        }
        
        if (state.currentProject && String(state.currentProject.id) === String(data.projectId)) {
          if (data.msg && (data.msg.indexOf("Process exited") !== -1 || data.msg.indexOf("forcefully killed") !== -1 || data.msg.indexOf("stopped manually") !== -1)) {
            const pp = state.projects.find(function(x){ return String(x.id) === String(data.projectId); });
            if (pp) pp.running = false;
            if (state.currentProject) state.currentProject.running = false;
          }
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

function detectDependencies(code, lang) {
  const deps = new Set();
  if (!code) return [];
  if (lang === "Python") {
    const re = /(?:^|[\n;])\s*(?:import\s+([a-zA-Z0-9_.]+)|from\s+([a-zA-Z0-9_.]+)\s+import)/gm;
    let m;
    while ((m = re.exec(code))) {
      let pkg = (m[1] || m[2] || "").split(".")[0].toLowerCase().trim();
      if (pkg && !["os","sys","json","time","random","re","math","datetime","asyncio","pathlib","typing","io","collections","subprocess","threading","socket","abc","argparse","base64","binascii","bisect","builtins","bz2","calendar","cgi","cgitb","chunk","cmd","code","codecs","codeop","colorsys","compileall","concurrent","configparser","contextlib","contextvars","copy","copyreg","crypt","csv","ctypes","curses","dataclasses","dbm","decimal","difflib","dis","distutils","doctest","email","encodings","ensurepip","enum","errno","faulthandler","fcntl","filecmp","fileinput","fnmatch","formatter","fractions","ftplib","functools","gc","getopt","getpass","gettext","glob","graphlib","grp","gzip","hashlib","heapq","hmac","html","http","idlelib","imaplib","imghdr","imp","importlib","inspect","keyword","lib2to3","linecache","locale","logging","lzma","mailbox","mailcap","marshal","mimetypes","mmap","modulefinder","msilib","msvcrt","multiprocessing","netrc","nis","nntplib","ntpath","numbers","opcode","operator","optparse","os","ossaudiodev","parser","pathlib","pdb","pickle","pickletools","pipes","pkgutil","platform","plistlib","poplib","posix","posixpath","pprint","profile","pstats","pty","pwd","py_compile","pyclbr","pydoc","queue","quopri","random","re","readline","reprlib","resource","rlcompleter","runpy","sched","secrets","select","selectors","shelve","shlex","shutil","signal","site","smtpd","smtplib","sndhdr","socket","socketserver","spwd","sqlite3","sre","sre_compile","sre_constants","sre_parse","ssl","stat","statistics","statvfs","string","stringprep","struct","subprocess","sunau","symbol","symtable","sys","sysconfig","syslog","tabnanny","tarfile","telnetlib","tempfile","termios","test","textwrap","threading","time","timeit","tkinter","token","tokenize","trace","traceback","tracemalloc","tty","turtle","turtledemo","types","typing","unicodedata","unittest","urllib","uu","uuid","venv","warnings","wave","weakref","webbrowser","winreg","winsound","wsgiref","xdrlib","xml","xmlrpc","zipapp","zipfile","zipimport","zlib","zoneinfo"].includes(pkg)) {
        if (pkg === "discord") deps.add("discord.py");
        else deps.add(pkg);
      }
    }
  } else if (lang === "JavaScript" || lang === "TypeScript") {
    const re = /(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"]\s+import|import\s+['"]([^'"]+)['"]\s+from)/g;
    let m;
    while ((m = re.exec(code))) {
      let pkg = (m[1] || m[2] || m[3] || "").split("/")[0].trim();
      if (pkg && !["fs","path","http","https","crypto","os","util","child_process","events","stream","net","dgram","dns","url","zlib","querystring","assert","buffer","console","constants","domain","punycode","readline","repl","string_decoder","timers","tls","tty","vm","worker_threads","perf_hooks","async_hooks","trace_events","inspector","wasi","diagnostics_channel"].includes(pkg) && !pkg.startsWith(".") && !pkg.startsWith("@/")) {
        if (pkg === "discord") pkg = "discord.js";
        deps.add(pkg);
      }
    }
  }
  return Array.from(deps);
}

function killProject(p) {
  if (!p) return;
  fetch("/api/projects/" + p.id + "/kill", { method: "POST" }).then(function() {
    p.running = false;
    const proj = state.projects.find(function(x){ return x.id === p.id; });
    if (proj) proj.running = false;
    if (state.currentProject && state.currentProject.id === p.id) state.currentProject.running = false;
    scheduleRender();
  });
}

function restartProject(p) {
  if (!p) return;
  fetch("/api/projects/" + p.id + "/stop", { method: "POST" }).then(function() {
    setTimeout(function() {
      fetch("/api/projects/" + p.id + "/start", { method: "POST" }).then(function() {
        p.running = true;
        const proj = state.projects.find(function(x){ return x.id === p.id; });
        if (proj) proj.running = true;
        if (state.currentProject && state.currentProject.id === p.id) state.currentProject.running = true;
        scheduleRender();
      });
    }, 400);
  });
}

function appendFileTree(listEl, items, p, isMc, lvl) {
  if (!lvl) lvl = 0;
  (items || []).forEach(function(item) {
    const rel = item.rel || item.name;
    const pad = 10 + lvl * 14;
    const row = el("div", { className: "file-item", style: { paddingLeft: pad + "px" } },
      svgIcon(item.isDir ? "folder" : "doc"),
      el("span", { className: "file-item-name" }, item.name),
      el("span", { className: "file-item-size" }, item.isDir ? "Dir" : (item.size + " B")),
      el("div", { className: "file-item-actions" },
        el("button", { className: "btn-file-action danger", onClick: function(e) {
          e.stopPropagation();
          if (confirm("Delete " + rel + "?")) {
            fetch("/api/projects/" + p.id + "/deleteFile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: rel }) }).then(function() {
              fetch("/api/projects/" + p.id + "/dir").then(function(r) { return r.json(); }).then(function(d) {
                if (d.success) {
                  if (isMc) state.mcFiles = d.files;
                  else state.currentFileTree = d.files;
                  scheduleRender();
                }
              });
            });
          }
        } }, svgIcon("trash"))
      )
    );
    if (!item.isDir && !isMc) {
      row.onclick = function() { switchFile(rel); };
      row.style.cursor = "pointer";
    }
    listEl.appendChild(row);
    if (item.isDir && item.children && item.children.length) {
      appendFileTree(listEl, item.children, p, isMc, lvl + 1);
    }
  });
}

function appendBotFileTree(container, items, p, lvl) {
  if (!lvl) lvl = 0;
  (items || []).forEach(function(item) {
    const rel = item.rel || item.name;
    const isExp = state.expandedFolders.indexOf(rel) !== -1;
    const pad = 8 + lvl * 12;
    if (item.isDir) {
      const row = el("div", { className: "sidebar-folder" + (isExp ? " expanded" : ""), style: { paddingLeft: pad + "px" }, onClick: function() {
        const idx = state.expandedFolders.indexOf(rel);
        if (idx !== -1) state.expandedFolders.splice(idx, 1);
        else state.expandedFolders.push(rel);
        scheduleRender();
      } },
        svgIcon("folder"), " " + item.name + "/"
      );
      const delF = el("button", { className: "btn-file-action danger", style: { marginLeft: "auto", padding: "1px 4px", fontSize: "10px" }, onClick: function(e){e.stopPropagation();if(confirm("Delete folder "+rel+"?")){fetch("/api/projects/"+p.id+"/deleteFile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:rel})}).then(function(){fetch("/api/projects/"+p.id+"/dir").then(function(r){return r.json();}).then(function(d){if(d.success){state.currentFileTree=d.files||[];scheduleRender();}});} );}} }, svgIcon("trash"));
      row.appendChild(delF);
      container.appendChild(row);
      if (isExp && item.children) appendBotFileTree(container, item.children, p, lvl + 1);
    } else {
      const isActive = state.editorFile === rel;
      const row = el("div", { className: "sidebar-file discord-file" + (isActive ? " active" : ""), style: { paddingLeft: pad + "px" }, onClick: function() { switchFile(rel); } },
        svgIcon("doc"), " " + item.name
      );
      const del = el("button", { className: "btn-file-action danger", style: { marginLeft: "auto", padding: "1px 4px", fontSize: "10px" }, onClick: function(e){e.stopPropagation();if(confirm("Delete "+rel+"?")){fetch("/api/projects/"+p.id+"/deleteFile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:rel})}).then(function(){fetch("/api/projects/"+p.id+"/dir").then(function(r){return r.json();}).then(function(d){if(d.success){state.currentFileTree=d.files||[];scheduleRender();}});} );}} }, svgIcon("trash"));
      row.appendChild(del);
      container.appendChild(row);
    }
  });
}

function collectFiles(tree, out) {
  if (!out) out = [];
  (tree || []).forEach(function(n) {
    if (n.isDir && n.children) collectFiles(n.children, out);
    else out.push(n);
  });
  return out;
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
      } else if (k === "checked" || k === "disabled" || k === "selected") {
        node[k] = !!v;
      } else if (k === "value" && (tag === "input" || tag === "textarea" || tag === "select")) {
        node.value = v != null ? v : "";
      } else {
        node.setAttribute(k, v);
      }
    });
  }
  children.flat(Infinity).forEach(c => {
    if (c == null) return;
    if (typeof c === "string" || typeof c === "number" || typeof c === "boolean") {
      node.appendChild(document.createTextNode(String(c)));
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
    key: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="17" r="3"/><path d="M14 3l7 7-7 7"/><path d="M9.5 13.5l5-5"/></svg>`,
    home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>`,
    magic: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2v20M15 3v18M9 3v18M4 3v18"/></svg>`,
    endpoint: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="M4.93 4.93l14.14 14.14"/><path d="M19.07 4.93L4.93 19.07"/></svg>`,
    style: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    code: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    ai: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="8" rx="2"/><rect x="8" y="4" width="8" height="4" rx="1"/><line x1="8" y1="14" x2="16" y2="14"/><circle cx="9" cy="11" r="1.5" fill="currentColor"/><circle cx="15" cy="11" r="1.5" fill="currentColor"/><rect x="2" y="6" width="4" height="4" rx="1"/><rect x="18" y="6" width="4" height="4" rx="1"/><line x1="4" y1="10" x2="4" y2="12"/><line x1="20" y1="10" x2="20" y2="12"/></svg>`,
    shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    bolt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  };
  const wrap = document.createElement("span");
  wrap.className = "svg-icon";
  if (color) wrap.style.color = color;
  wrap.innerHTML = icons[type] || icons.doc;
  return wrap;
}

function renderAIChatButton() {
  const btn = el("button", { className: "ai-chat-button", onClick: () => { state.showAIChat = true; scheduleRender(); } },
    el("div", { className: "ai-chat-button-icon" }, svgIcon("ai"))
  );
  return btn;
}

function renderAIChatUI() {
  if (!state.showAIChat) return null;
  
  if (state.showFeedbackManagement) {
    return renderFeedbackManagement();
  }
  
  const overlay = el("div", { className: "ai-chat-overlay", onClick: (e) => { if (e.target === overlay) { state.showAIChat = false; state.showFeedbackManagement = false; scheduleRender(); } } });
  const chatBox = el("div", { className: "ai-chat-box" });
  
  const header = el("div", { className: "ai-chat-header" },
    el("div", { className: "ai-chat-title" }, svgIcon("ai"), " rebootcord helper"),
    el("button", { className: "ai-chat-close", onClick: () => { 
      state.showAIChat = false; 
      state.showFeedbackManagement = false; 
      state.currentFeedbackUser = null; 
      scheduleRender(); 
    } }, "×")
  );
  
  const tabs = el("div", { className: "ai-chat-tabs" },
    el("button", { className: "ai-chat-tab active", onClick: () => { state.showFeedbackManagement = false; scheduleRender(); } }, "Chat"),
    el("button", { className: "ai-chat-tab" + (state.isAdmin ? "" : " ai-hidden"), onClick: () => { state.showFeedbackManagement = true; scheduleRender(); } }, "Users Feedback")
  );
  
  const messagesContainer = el("div", { className: "ai-chat-messages" });
  
  if (state.aiChatMessages.length === 0) {
    const premadeQuestions = el("div", { className: "ai-premade-questions" },
      el("button", { className: "ai-premade-question", onClick: () => sendAIMessage("How do i set up API endpoint") }, "How do i set up API endpoint"),
      el("button", { className: "ai-premade-question", onClick: () => sendAIMessage("is all of this free?") }, "is all of this free?")
    );
    messagesContainer.appendChild(premadeQuestions);
  } else {
    state.aiChatMessages.forEach(msg => {
      const msgDiv = el("div", { className: "ai-message " + (msg.role === 'assistant' ? 'ai-message-assistant' : 'ai-message-user') },
        el("div", { className: "ai-message-content" }, msg.content)
      );
      messagesContainer.appendChild(msgDiv);
    });
  }
  
  if (state.aiChatTyping) {
    const typingDiv = el("div", { className: "ai-message ai-message-assistant ai-message-typing" },
      el("div", { className: "ai-typing-indicator" },
        el("span", { className: "ai-typing-dot" }),
        el("span", { className: "ai-typing-dot" }),
        el("span", { className: "ai-typing-dot" })
      )
    );
    messagesContainer.appendChild(typingDiv);
  }
  
  const inputArea = el("div", { className: "ai-chat-input-area" },
    el("input", { 
      className: "ai-chat-input", 
      placeholder: "Ask about API setup...", 
      onkeydown: (e) => { 
        if (e.key === 'Enter' && e.target.value.trim()) {
          sendAIMessage(e.target.value);
          e.target.value = '';
        }
      } 
    }),
    el("button", { 
      className: "ai-chat-send", 
      onClick: () => {
        const input = document.querySelector('.ai-chat-input');
        if (input && input.value.trim()) {
          sendAIMessage(input.value);
          input.value = '';
        }
      }
    }, svgIcon("code"))
  );
  
  chatBox.appendChild(header);
  chatBox.appendChild(tabs);
  chatBox.appendChild(messagesContainer);
  chatBox.appendChild(inputArea);
  overlay.appendChild(chatBox);
  
  return overlay;
}

function renderFeedbackManagement() {
  const overlay = el("div", { className: "ai-chat-overlay", onClick: (e) => { if (e.target === overlay) { state.showAIChat = false; state.showFeedbackManagement = false; scheduleRender(); } } });
  const chatBox = el("div", { className: "ai-chat-box" });
  
  const header = el("div", { className: "ai-chat-header" },
    el("div", { className: "ai-chat-title" }, svgIcon("ai"), " Users Feedback"),
    el("button", { className: "ai-chat-close", onClick: () => { state.showAIChat = false; state.showFeedbackManagement = false; scheduleRender(); } }, "×")
  );
  
  const tabs = el("div", { className: "ai-chat-tabs" },
    el("button", { className: "ai-chat-tab", onClick: () => { state.showFeedbackManagement = false; scheduleRender(); } }, "Chat"),
    el("button", { className: "ai-chat-tab active" }, "Users Feedback")
  );
  
  const content = el("div", { className: "ai-chat-messages" });
  
  if (state.feedbackChatUsers.length === 0) {
    content.appendChild(el("div", { className: "ai-premade-questions" }, "Loading feedback users..."));
    fetchFeedbackUsers();
  } else {
    const userList = el("div", { className: "ai-user-list" });
    state.feedbackChatUsers.forEach(user => {
      const userItem = el("div", { className: "ai-user-item", onClick: () => { state.currentFeedbackUser = user; scheduleRender(); } },
        el("div", { className: "ai-user-avatar" }, user.username.charAt(0).toUpperCase()),
        el("div", { className: "ai-user-info" },
          el("div", { className: "ai-user-name" }, user.username),
          el("div", { className: "ai-user-time" }, new Date(user.created).toLocaleString())
        )
      );
      userList.appendChild(userItem);
    });
    content.appendChild(userList);
  }
  
  if (state.currentFeedbackUser) {
    return renderFeedbackChat(overlay, chatBox);
  }
  
  chatBox.appendChild(header);
  chatBox.appendChild(tabs);
  chatBox.appendChild(content);
  overlay.appendChild(chatBox);
  
  return overlay;
}

function renderFeedbackChat(overlay, chatBox) {
  const user = state.currentFeedbackUser;
  
  const header = el("div", { className: "ai-chat-header" },
    el("button", { className: "ai-chat-back", onClick: () => { state.currentFeedbackUser = null; scheduleRender(); } }, svgIcon("back")),
    el("div", { className: "ai-chat-title" }, svgIcon("ai"), " " + user.username),
    el("button", { className: "ai-chat-close", onClick: () => { state.showAIChat = false; state.showFeedbackManagement = false; state.currentFeedbackUser = null; scheduleRender(); } }, "×")
  );
  
  const tabs = el("div", { className: "ai-chat-tabs" },
    el("button", { className: "ai-chat-tab active" }, "Chat with " + user.username)
  );
  
  const messagesContainer = el("div", { className: "ai-chat-messages" });
  
  if (user.messages && user.messages.length > 0) {
    user.messages.forEach(msg => {
      const msgDiv = el("div", { className: "ai-message " + (msg.role === 'admin' ? 'ai-message-admin' : 'ai-message-user') },
        el("div", { className: "ai-message-content" }, msg.content)
      );
      messagesContainer.appendChild(msgDiv);
    });
  } else {
    messagesContainer.appendChild(el("div", { className: "ai-premade-questions" }, "No messages yet"));
  }
  
  const inputArea = el("div", { className: "ai-chat-input-area" },
    el("input", { 
      className: "ai-chat-input", 
      placeholder: "Type your reply...", 
      onkeydown: (e) => { 
        if (e.key === 'Enter' && e.target.value.trim()) {
          sendAdminReply(e.target.value);
          e.target.value = '';
        }
      } 
    }),
    el("button", { 
      className: "ai-chat-send", 
      onClick: () => {
        const input = document.querySelector('.ai-chat-input');
        if (input && input.value.trim()) {
          sendAdminReply(input.value);
          input.value = '';
        }
      }
    }, svgIcon("code"))
  );
  
  chatBox.appendChild(header);
  chatBox.appendChild(tabs);
  chatBox.appendChild(messagesContainer);
  chatBox.appendChild(inputArea);
  overlay.appendChild(chatBox);
  
  return overlay;
}

async function fetchFeedbackUsers() {
  try {
    const response = await fetch('/api/v1/feedback-users');
    const data = await response.json();
    if (data.success) {
      state.feedbackChatUsers = data.users;
      scheduleRender();
    }
  } catch (error) {
    console.error('Failed to fetch feedback users:', error);
  }
}

async function sendAdminReply(content) {
  if (!state.currentFeedbackUser) return;
  
  state.currentFeedbackUser.messages.push({ role: 'admin', content, timestamp: new Date().toISOString() });
  
  try {
    await fetch('/api/v1/feedback-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: state.currentFeedbackUser.username,
        message: content,
        adminName: state.username
      })
    });
  } catch (error) {
    console.error('Failed to send admin reply:', error);
  }
  
  scheduleRender();
}

async function sendAIMessage(content) {
  state.aiChatMessages.push({ role: 'user', content });
  state.aiChatTyping = true;
  scheduleRender();
  
  if (content.toLowerCase().includes('free') || content.toLowerCase().includes('cost') || content.toLowerCase().includes('price')) {
    setTimeout(() => {
      state.aiChatMessages.push({ role: 'assistant', content: 'Yes all of this is free, but soon it will be paid so enjoy while the free lasts.' });
      state.aiChatTyping = false;
      scheduleRender();
    }, 500);
  } else {
    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-pro',
          messages: [
            { role: 'system', content: 'You are rebootcord helper, an AI assistant that helps users set up the Reboot Cord API integration. Be friendly, helpful, and concise. When users ask about pricing, say: "Yes all of this is free, but soon it will be paid so enjoy while the free lasts." Provide clear, step-by-step instructions for API setup.' },
            ...state.aiChatMessages,
            { role: 'user', content }
          ]
        })
      });
      
      const data = await response.json();
      const aiContent = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : 'Sorry, I encountered an error.';
      
      state.aiChatMessages.push({ role: 'assistant', content: aiContent });
      state.aiChatTyping = false;
      scheduleRender();
    } catch (error) {
      state.aiChatMessages.push({ role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' });
      state.aiChatTyping = false;
      scheduleRender();
    }
  }
}

function highlightCode(text, type) {
  let html = (text || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isMc = type === 'minecraft';
  const kwColor = isMc ? '#6dbd3d' : '#7289da';
  const strColor = isMc ? '#a8d5a2' : '#9ece6a';
  
  const strings = [];
  html = html.replace(/("[^"]*"|'[^']*'|\`[^`]*\`)/g, (m) => {
    strings.push('<span style="color:' + strColor + '">' + m + '</span>');
    return '__STR' + (strings.length - 1) + '__';
  });
  
  html = html.replace(/\b(import|from|const|let|var|function|async|await|return|if|elif|else|for|while|class|require|def|try|except|catch|pass|True|False|None|null|undefined|new|this)\b/g, '<span style="color:' + kwColor + ';font-weight:bold">$1</span>');
  
  html = html.replace(/__STR(\d+)__/g, (m, p1) => strings[parseInt(p1, 10)]);
  
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
  state.originalCodeContent = state.codeContent;
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

function renderSearchModal() {
  const overlay = el("div", { className: "search-modal-overlay", id: "search-modal-overlay" });
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) { state.showSearchModal = false; scheduleRender(); }
  });
  const box = el("div", { className: "search-modal-box" });
  const inputWrap = el("div", { className: "search-modal-input-wrap" },
    el("span", { className: "search-modal-icon" },
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
    )
  );
  inputWrap.querySelector(".search-modal-icon").innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const inp = el("input", { className: "search-modal-input", placeholder: "Search projects...", type: "text", value: state.searchTerm });
  inp.oninput = function(e) { 
    state.searchTerm = e.target.value; 
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { 
      scheduleRender(); 
    }, 150);
  };
  const kbdHint = el("kbd", { className: "search-modal-esc" }, "esc");
  kbdHint.onclick = function() { state.showSearchModal = false; scheduleRender(); };
  inputWrap.appendChild(inp);
  inputWrap.appendChild(kbdHint);
  box.appendChild(inputWrap);
  const term = (state.searchTerm || "").toLowerCase().trim();
  const filtered = term
    ? state.projects.filter(function(p){ return (p.name||"").toLowerCase().indexOf(term) !== -1 || (p.lang||"").toLowerCase().indexOf(term) !== -1; })
    : state.projects.slice(0, 8);
  if (filtered.length > 0) {
    const results = el("div", { className: "search-modal-results" });
    filtered.forEach(function(p) {
      const isMc = p.type === "minecraft";
      const row = el("div", { className: "search-modal-result-row" },
        el("div", { className: "search-result-icon " + (isMc ? "mc" : "discord") }, svgIcon(isMc ? "pickaxe" : "discord")),
        el("div", { className: "search-result-info" },
          el("div", { className: "search-result-name" }, p.name),
          el("div", { className: "search-result-meta" }, isMc ? (p.serverType + " · " + p.version) : p.lang)
        ),
        el("div", { className: "search-result-status " + (p.running ? "running" : "stopped") }, p.running ? "Running" : "Stopped")
      );
      row.onclick = function() {
        state.showSearchModal = false;
        state.searchTerm = "";
        openProject(p.id);
      };
      results.appendChild(row);
    });
    box.appendChild(results);
  } else if (state.searchTerm) {
    box.appendChild(el("div", { className: "search-modal-empty" }, "No projects match \"" + state.searchTerm + "\""));
  } else {
    box.appendChild(el("div", { className: "search-modal-empty" }, "Start typing to search..."));
  }
  const footer = el("div", { className: "search-modal-footer" },
    el("span", {}, el("kbd", {}, "↵"), " open"),
    el("span", {}, el("kbd", {}, "esc"), " close"),
    el("span", {}, el("kbd", {}, "ctrl+k"), " toggle")
  );
  box.appendChild(footer);
  overlay.appendChild(box);
  requestAnimationFrame(() => { if (inp) inp.focus(); });
  return overlay;
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
  } else if (state.page === "changelogs") {
    frag.appendChild(renderChangelogsPage());
  } else if (state.page === "ourapi") {
    frag.appendChild(renderOurApi());
  }
  app.textContent = "";
  app.appendChild(frag);
  const existing = document.getElementById("search-modal-overlay");
  if (existing) existing.remove();
  if (state.showSearchModal) {
    document.body.appendChild(renderSearchModal());
  }
  document.body.appendChild(renderAIChatButton());
  if (state.showAIChat) {
    document.body.appendChild(renderAIChatUI());
  }
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
    el("div", { className: "nav-logo", style: { cursor: "pointer" }, onClick: function(){ history.pushState(null, "", "/dashboard"); state.page = "projects"; scheduleRender(); } },
      el("span", { className: "nav-logo-r" }, "Reboot"),
      el("span", { className: "nav-logo-t" }, " Cord")
    ),
    el("div", { className: "nav-right" },
      el("span", { className: "nav-user" }, state.username, state.isAdmin ? el("span", { className: "admin-tag" }, "admin") : null),
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
        el("p", {}, "Manage your Discord bots and Minecraft servers"),
        el("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" } }, state.projects.length + " projects • " + (state.projects.filter(function(x){ return x.running; }).length) + " running")
      ),
      el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
        el("input", { className: "search-input", placeholder: "Search project or press ctrl+k", value: state.searchTerm, oninput: function(e){ 
          state.searchTerm = e.target.value; 
          if (searchTimeout) clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => { 
            scheduleRender(); 
          }, 150);
        }, onfocus: function(){ state.showSearchModal = true; scheduleRender(); } }),
        el("button", { className: "btn-changelogs", onClick: function(){ history.pushState(null, "", "/dashboard/changelogs"); state.page = "changelogs"; state.viewChangelogSlug = null; fetchChangelogs(); scheduleRender(); } }, "Changelogs"),
        el("button", { className: "btn-changelogs", onClick: () => { history.pushState(null, "", "/ourapi"); state.page = "ourapi"; scheduleRender(); } }, "Our API"),
        el("button", { className: "btn-new", onClick: () => { state.showNewModal = true; scheduleRender(); } }, 
          svgIcon("plus"), " New Project"
        )
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
    const term = (state.searchTerm || "").toLowerCase().trim();
    const filtered = term ? state.projects.filter(function(p){ return (p.name || "").toLowerCase().indexOf(term) !== -1 || (p.lang || "").toLowerCase().indexOf(term) !== -1 || (p.serverType || "").toLowerCase().indexOf(term) !== -1; }) : state.projects;
    filtered.forEach(p => grid.appendChild(renderProjectCard(p)));
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
  if (isMc && p.ip) tags.appendChild(el("span", { className: "tag discord-tag" }, p.ip));

  const actions = el("div", { className: "card-actions" },
    el("button", { className: "btn-manage", onClick: () => openProject(p.id) }, "Manage"),
    el("button", { 
      className: "btn-card-toggle " + (p.running ? "running" : "stopped"), 
      onClick: (e) => { e.stopPropagation(); toggleRunning(p); } 
    }, svgIcon(p.running ? "stop" : "play"))
  );
  if (p.running) {
    actions.appendChild(el("button", { className: "btn-kill-sm", onClick: (e) => { e.stopPropagation(); if (confirm("Force kill?")) killProject(p); } }, "Kill"));
    actions.appendChild(el("button", { className: "btn-kill-sm", style: { background: "#1f2a3a", color: "#7aa8ff", borderColor: "#2a3f5a" }, onClick: (e) => { e.stopPropagation(); restartProject(p); } }, "Restart"));
  }
  actions.appendChild(el("button", { className: "btn-delete", onClick: () => deleteProject(p.id) }, "Delete"));

  return el("div", { className: "project-card" + (isMc ? " mc" : " discord") },
    el("div", { className: "card-top" },
      el("div", { className: "card-icon " + (isMc ? "mc" : "discord") }, svgIcon(isMc ? "pickaxe" : "discord"))
    ),
    el("div", { className: "card-name" }, p.name),
    tags,
    actions
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
  if (p.type === "minecraft" && !p.port) {
    p.port = 25565 + (state.projects ? state.projects.length : 0);
  }
  state.projects.push(p);
  state.currentProject = p;
  state.newName = ""; state.newMcIp = ""; state.newMcServerType = "Vanilla";
  state.mcView = "overview"; state.mcFiles = []; state.mcMods = []; state.mcBackups = [];
  state.botLogs = []; state.mcLogs = []; state.missingPackages = [];
  state.searchTerm = ""; state.currentFileTree = []; state.expandedFolders = [];
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
  const slug = p.name.toLowerCase().replace(/\s+/g, '-');
  history.pushState(null, '', '/dashboard/' + slug);
  state.currentProject = p;
  state.page = p.type === "minecraft" ? "mc-dashboard" : "bot-dashboard";
  state.mcView = "overview";
  state.mcFiles = p._mcFiles || [];
  state.mcMods = p._mcMods || [];
  state.mcBackups = p._mcBackups || [];
  state.botLogs = []; state.mcLogs = []; state.missingPackages = [];
  state.expandedFolders = [];
  state.currentFileTree = [];
  fetch('/api/projects/' + id + '/dir').then(r => r.json()).then(d => {
    if (d.success) {
      if (p.type === "minecraft") {
        state.mcFiles = d.files;
      } else {
        state.currentFileTree = d.files || [];
        const flat = collectFiles(d.files || []);
        flat.forEach(function(f) {
          if (!f.isDir) {
            const key = f.rel || f.name;
            if (p.files[key] === undefined) p.files[key] = "";
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
  const p = state.projects.find(x => x.id === id);
  if (p && p.running) { fetch("/api/projects/" + id + "/kill", { method: "POST" }); }
  state.projects = state.projects.filter(function(x){ return x.id !== id; });
  if (state.currentProject && state.currentProject.id === id) { state.currentProject = null; state.page = "projects"; }
  saveProjects();
  scheduleRender();
}

function toggleRunning(p) {
  p.running = !p.running;
  const proj = state.projects.find(x => x.id === p.id);
  if (proj) proj.running = p.running;
  if (p.running) {
    fetch(`/api/projects/${p.id}/start`, { method: "POST" }).then(() => scheduleRender());
  } else {
    fetch(`/api/projects/${p.id}/stop`, { method: "POST" }).then(() => scheduleRender());
  }
  scheduleRender();
}

function flashSaveBtn(btn) {
  if (!btn) return;
  const origHTML = btn.innerHTML;
  const origBg = btn.style.background || "";
  btn.innerHTML = "saved!";
  btn.style.background = "var(--green)";
  btn.style.color = "#000";
  setTimeout(() => {
    btn.innerHTML = origHTML;
    btn.style.background = origBg;
    btn.style.color = "";
  }, 1400);
}

function installPkg() {
  const input = document.getElementById("pkgInput");
  const v = input ? input.value.trim() : "";
  if (!v || !ws || !state.currentProject) return;
  ws.send(JSON.stringify({ event: 'install', projectId: state.currentProject.id, pkg: v }));
  if (input) input.value = "";
}

function installAllPkgs() {
  if (!ws || !state.currentProject) return;
  const p = state.currentProject;
  const allCode = Object.values((p.files && typeof p.files === "object") ? p.files : {}).join("\n");
  const pkgs = detectDependencies(allCode, p.lang || "Python");
  ws.send(JSON.stringify({ event: 'installAll', projectId: p.id, pkgs: pkgs }));
  state.missingPackages = [];
  scheduleRender();
}

function fetchChangelogs() {
  fetch("/api/changelogs").then(r => r.json()).then(d => {
    if (d.success) state.changelogs = d.changelogs || [];
    scheduleRender();
  });
}

function toggleLike(id) {
  fetch("/api/changelogs/" + id + "/like", { method: "POST" }).then(() => fetchChangelogs());
}

function postChangelog() {
  const title = (state.newChangelogTitle || "").trim();
  const body = (state.newChangelogBody || "").trim();
  if (!title || !body) return;
  fetch("/api/changelogs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, body: body, generateLink: !!state.generateChangelogLink })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      state.showChangelogModal = false;
      state.newChangelogTitle = "";
      state.newChangelogBody = "";
      state.generateChangelogLink = false;
      fetchChangelogs();
    }
  });
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
      ),
      el("button", { className: "btn-kill-discord", onClick: () => { if (confirm("Force kill the bot?")) killProject(p); } }, "Kill"),
      el("button", { className: "btn-restart-discord", onClick: () => restartProject(p) }, "Restart")
    )
  ));

  const mainFile = getDefaultFilename(p);

  const filesSection = el("div", { className: "sidebar-section" },
    el("div", { className: "sidebar-label discord-label", style: { display: "flex", justifyContent: "space-between", width: "100%" } }, 
      el("span", {}, svgIcon("folder"), " Files"),
      el("button", { className: "btn-clear", style: { margin: "0" }, onClick: () => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => {
          if (d.success) {
            state.currentFileTree = d.files || [];
            const flat = collectFiles(d.files || []);
            flat.forEach(function(f){ if (!f.isDir) { const k = f.rel || f.name; if (p.files[k] === undefined) p.files[k] = ""; } });
            scheduleRender();
          }
        });
      }}, "Refresh")
    )
  );

  const tree = state.currentFileTree && state.currentFileTree.length ? state.currentFileTree : [];
  if (tree.length) {
    appendBotFileTree(filesSection, tree, p, 0);
  } else {
    const keys = Object.keys((p.files && typeof p.files === 'object') ? p.files : {});
    if (!keys.includes(mainFile)) keys.unshift(mainFile);
    keys.forEach(function(fname) {
      const isActive = state.editorFile === fname || (!state.editorFile && fname === mainFile);
      const row = el("div", { className: "sidebar-file discord-file" + (isActive ? " active" : ""), onClick: function(){ switchFile(fname); } }, svgIcon("doc"), " " + fname);
      if (fname === mainFile) row.appendChild(el("span", { className: "file-badge discord-badge" }, "main"));
      filesSection.appendChild(row);
    });
  }

  filesSection.appendChild(el("button", { className: "btn-add-file-small", onClick: () => {
    const name = prompt("New file name or path (e.g. utils.py or cogs/mod.py):");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/touch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        state.currentProject.files = state.currentProject.files || {};
        state.currentProject.files[name.trim()] = "";
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.currentFileTree = d.files || []; switchFile(name.trim()); });
      });
    }
  }}, svgIcon("plus"), " New File"));

  filesSection.appendChild(el("button", { className: "btn-add-file-small", onClick: () => {
    fetch('/api/projects/' + p.id + '/touch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: '.env'}) }).then(() => {
      state.currentProject.files = state.currentProject.files || {};
      if (state.currentProject.files['.env'] === undefined) state.currentProject.files['.env'] = 'BOT_TOKEN=your_token_here\n';
      fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) state.currentFileTree = d.files || []; switchFile('.env'); });
    });
  }}, svgIcon("plus"), " New .env"));

  filesSection.appendChild(el("button", { className: "btn-add-file-small", onClick: () => {
    const name = prompt("New folder name (e.g. cogs):");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/mkdir', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) { state.currentFileTree = d.files || []; scheduleRender(); } });
      });
    }
  }}, svgIcon("plus"), " New Folder"));

  const pkgInput = el("input", { className: "pkg-input discord-input", id: "pkgInput", placeholder: "package name", 'aria-label': 'Package name to install' });
  pkgInput.onkeydown = (ev) => { if (ev.key === "Enter") installPkg(); };

  const allCode = Object.values((p.files && typeof p.files === "object") ? p.files : {}).join("\n");
  const detected = detectDependencies(allCode, p.lang || "Python");
  const hasMultiple = (state.missingPackages && state.missingPackages.length > 0) || detected.length > 1;
  let installAllSection = null;
  if (hasMultiple) {
    const label = state.missingPackages && state.missingPackages.length > 0 ? "Install All Detected" : ("Install All (" + detected.length + ")");
    installAllSection = el("button", { className: "btn-install discord-btn", style: { marginTop: "8px", background: "var(--green)", color: "#000" }, onClick: installAllPkgs }, svgIcon("download"), " " + label);
  }

  const tInput = el("input", { className: "settings-input discord-input", type: "password", id: "tokenInput", placeholder: "Paste your bot token", value: p.botToken || "", 'aria-label': 'Bot token' });
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
    scheduleRender();
  }}, svgIcon("trash"), " Clear Code");

  const revertCodeBtn = el("button", { className: "btn-save-file discord-btn-sm", style: { marginRight: "8px", background: "transparent", border: "1px solid var(--border)" }, onClick: () => {
    state.codeContent = state.originalCodeContent;
    saveCurrentFile();
    scheduleRender();
  }}, svgIcon("revert"), " Revert Code");

  const saveFileBtn = el("button", { className: "btn-save-file discord-btn-sm" }, svgIcon("save"), " Save");
  saveFileBtn.onclick = () => { saveCurrentFile(); state.justSaved = true; scheduleRender(); };

  const isDirty = state.codeContent !== state.originalCodeContent;
  if (isDirty) {
    const dirty = el("span", { style: { color: "var(--green)", fontSize: "11px", marginLeft: "6px" } }, "• unsaved");
    saveFileBtn.appendChild(dirty);
  }
  if (state.justSaved) {
    flashSaveBtn(saveFileBtn);
    state.justSaved = false;
  }

  const ta = el("textarea", { className: "code-editor", spellcheck: "false", wrap: "off" });
  ta.value = state.codeContent || "";
  
  const hl = el("div", { className: "highlight-layer" });
  
  const lineNums = el("div", { className: "line-numbers" });
  
  let editTimeout;
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
    clearTimeout(editTimeout);
    editTimeout = setTimeout(updateEditor, 50);
  };

  const editorWrapper = el("div", { className: "editor-wrapper" }, lineNums, el("div", { className: "code-container" }, hl, ta));

  frag.appendChild(el("div", { className: "dashboard discord-dash" },
    el("div", { className: "sidebar discord-sidebar" },
      el("div", { className: "discord-wave-bg" }),
      filesSection,
      el("div", { className: "sidebar-section" },
        el("div", { className: "sidebar-label discord-label" }, svgIcon("pkg"), " Packages"),
        el("div", { style: { display: "flex", gap: "6px", marginBottom: "8px" } }, 
          pkgInput, 
          el("button", { className: "btn-clear", style: { margin: 0, padding: "4px 6px", background: "#3a1a1a", color: "#ff6b6b", border: "1px solid #5c2a2a", borderRadius: "4px", fontSize: "12px", lineHeight: "1" }, onClick: () => { const i = document.getElementById("pkgInput"); if(i) i.value = ""; } }, svgIcon("trash"))
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
        el("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px" } }, revertCodeBtn, clearCodeBtn, saveFileBtn)
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
      ),
      el("button", { className: "btn-kill", onClick: () => { if (confirm("Force kill the server?")) killProject(p); } }, "Kill"),
      el("button", { className: "btn-restart", onClick: () => restartProject(p) }, "Restart")
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
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) { state.mcFiles = d.files; scheduleRender(); } });
      });
    };
    input.click();
  };

  const refreshBtn = el("button", { className: "btn-upload-mod", style: { background: "transparent", borderColor: "#162016", color: "var(--text-dim)" } }, svgIcon("refresh"), " Refresh");
  refreshBtn.onclick = () => {
    fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) { state.mcFiles = d.files; scheduleRender(); } });
  };

  container.appendChild(el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } },
    el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Server Files"),
    el("div", { style: { display: "flex", gap: "8px" } }, refreshBtn, upBtn)
  ));

  const list = el("div", { className: "files-list" });
  if (!state.mcFiles || state.mcFiles.length === 0) list.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No files yet."));
  appendFileTree(list, state.mcFiles || [], p, true, 0);
  container.appendChild(list);

  container.appendChild(el("button", { className: "btn-add-file", onClick: () => {
    const name = prompt("File name:");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/touch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) { state.mcFiles = d.files; scheduleRender(); } });
      });
    }
  }}, svgIcon("plus"), " New File"));
}

function buildMcAdminFiles(container, p) {
  const refreshBtn = el("button", { className: "btn-upload-mod", style: { background: "transparent", borderColor: "#162016", color: "var(--text-dim)" } }, svgIcon("refresh"), " Refresh");
  refreshBtn.onclick = () => {
    fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) { state.mcFiles = d.files; scheduleRender(); } });
  };

  container.appendChild(el("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", flexWrap:"wrap", gap:"8px" } },
    el("div", { className: "mc-section-title", style: { marginBottom:"0" } }, "Admin Server Files"),
    el("div", { style: { display: "flex", gap: "8px" } }, refreshBtn)
  ));

  const list = el("div", { className: "files-list" });
  if (!state.mcFiles || state.mcFiles.length === 0) list.appendChild(el("div", { style: { color:"var(--text-muted)", fontSize:"12px", padding:"14px" } }, "No directories or files."));
  appendFileTree(list, state.mcFiles || [], p, true, 0);
  container.appendChild(list);

  container.appendChild(el("button", { className: "btn-add-file", style: { background: "var(--surface3)", border: "1px dashed var(--border)" }, onClick: () => {
    const name = prompt("Folder name (e.g. plugins or sub/dir):");
    if (name && name.trim()) {
      fetch('/api/projects/' + p.id + '/mkdir', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: name.trim()}) }).then(() => {
        fetch('/api/projects/' + p.id + '/dir').then(r => r.json()).then(d => { if (d.success) { state.mcFiles = d.files; scheduleRender(); } });
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

  const cmdInput = el("input", { className: "mc-cmd-input", placeholder: "type a server '/' command.", value: state.mcCmd });
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
  let safeCmd = (cmd || "").trim();
  if (!safeCmd || !ws || !state.currentProject) return;
  if (safeCmd.startsWith("/")) safeCmd = safeCmd.slice(1).trim();
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

function renderChangelogsPage() {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderNav());
  if (state.viewChangelogSlug) {
    const ch = (state.changelogs || []).find(function(c) {
      const s = c.slug || c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return s === state.viewChangelogSlug;
    });
    if (ch) {
      const wrap = el("div", { className: "projects-page" });
      wrap.appendChild(el("button", { className: "go-back-btn", onClick: () => { history.pushState(null, "", "/changelogs"); state.viewChangelogSlug = null; scheduleRender(); } }, "Go Back"));
      const t1 = el("h1", { style: { fontSize: "24px" } }, ch.title);
      if (ch.hasLink) { t1.className = "changelog-linked-title"; t1.style.color = "#5865f2"; t1.style.textDecoration = "underline"; }
      wrap.appendChild(t1);
      const bodyDiv = el("div", { className: "ch-body", style: "margin:16px 0; padding:16px; background:#0f0f0f; border:1px solid #222; border-radius:8px" });
      bodyDiv.innerHTML = formatChangelogBody(ch.body);
      wrap.appendChild(bodyDiv);
      wrap.appendChild(el("div", { className: "ch-meta" }, "by ", el("span", { className: "ch-author" }, ch.author), " • " + new Date(ch.ts).toLocaleString()));
      frag.appendChild(wrap);
      return frag;
    }
  }
  const wrap = el("div", { className: "projects-page" });
  const header = el("div", { className: "projects-header" },
    el("div", { className: "projects-title" },
      el("h1", {}, "Changelogs"),
      el("p", {}, "Site updates and changes")
    )
  );
  if (state.isAdmin) {
    header.appendChild(el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
      el("button", { className: "btn-new", style: { background: "var(--green)", color: "#000" }, onClick: () => { state.showChangelogModal = true; state.newChangelogTitle = ""; state.newChangelogBody = ""; scheduleRender(); } }, "+ Post Changelog"),
      el("button", { className: "go-back-btn", onClick: () => { history.pushState(null, "", "/dashboard"); state.viewChangelogSlug = null; state.page = "projects"; scheduleRender(); } }, "Go Back")
    ));
  } else {
    header.appendChild(el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
      el("button", { className: "go-back-btn", onClick: () => { history.pushState(null, "", "/dashboard"); state.viewChangelogSlug = null; state.page = "projects"; scheduleRender(); } }, "Go Back")
    ));
  }
  wrap.appendChild(header);
  const list = el("div", { className: "changelogs-list" });
  if (!state.changelogs || state.changelogs.length === 0) {
    list.appendChild(el("div", { className: "empty-state" }, el("div", { className: "empty-title" }, "No changelogs yet")));
  } else {
    state.changelogs.forEach(function(ch) {
      const likes = ch.likes || [];
      const bodyHtml = formatChangelogBody(ch.body);
      const titleEl = el("div", { className: "ch-title" + (ch.hasLink ? " changelog-linked-title" : "") }, ch.title);
      if (ch.hasLink) {
        const s = ch.slug || ch.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        titleEl.onclick = () => { history.pushState(null, "", "/changelogs/" + s); state.viewChangelogSlug = s; scheduleRender(); };
      }
      const card = el("div", { className: "changelog-card" },
        titleEl,
        el("div", { className: "ch-body" }),
        el("div", { className: "ch-meta" }, "by ", el("span", { className: "ch-author" }, ch.author), " • " + new Date(ch.ts).toLocaleString())
      );
      const bodyDiv = card.querySelector(".ch-body");
      bodyDiv.innerHTML = bodyHtml;
      const heartWrap = el("div", { className: "heart-wrap", style: { marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px" } },
        el("button", { className: "heart-btn", onClick: () => toggleLike(ch.id) }, el("span", { style: "font-size:16px" }, "❤️")),
        el("span", { className: "heart-count" }, likes.length)
      );
      const tip = el("div", { className: "likes-tooltip" }, likes.length ? likes.join(", ") : "No likes yet");
      heartWrap.appendChild(tip);
      card.appendChild(heartWrap);
      if (state.isAdmin) {
        card.addEventListener("contextmenu", function(ev) {
          ev.preventDefault();
          document.querySelectorAll(".ctx-menu").forEach(function(m) { m.remove(); });
          const menu = el("div", { className: "ctx-menu", style: "position:fixed;left:" + ev.pageX + "px;top:" + ev.pageY + "px;background:#0f0f0f;border:1px solid #333;border-radius:6px;padding:2px 0;z-index:99999;min-width:170px;box-shadow:0 6px 20px #000a" });
          const delOpt = el("div", { style: "padding:8px 14px;font-size:12px;color:#ff6b6b;cursor:pointer", onClick: function(e2) {
            e2.stopPropagation();
            menu.remove();
            fetch("/api/changelogs/" + ch.id + "/delete", { method: "POST" }).then(function(r) { return r.json(); }).then(function(dd) {
              if (dd.success) fetchChangelogs();
            }).catch(function(){});
          } }, "delete changelog post");
          menu.appendChild(delOpt);
          document.body.appendChild(menu);
          setTimeout(function() {
            const rem = function(e3) { if (!menu.contains(e3.target)) { menu.remove(); document.removeEventListener("click", rem); } };
            document.addEventListener("click", rem, { once: true });
          }, 10);
        });
      }
      list.appendChild(card);
    });
  }
  wrap.appendChild(list);
  frag.appendChild(wrap);
  if (state.showChangelogModal) frag.appendChild(renderChangelogModal());
  return frag;
}

function renderOurApi() {
  const frag = document.createDocumentFragment();
  frag.appendChild(renderNav());

  const wrap = el("div", { className: "api-page-wrap" });

  const hero = el("div", { className: "api-hero" },
    el("div", { className: "api-hero-inner" },
      el("div", { className: "api-hero-badge" }, "Developer Platform"),
      el("h1", { className: "api-hero-title" }, "Reboot API"),
      el("p", { className: "api-hero-sub" }, "Extend the platform with APIs and SDKs. Build custom tools, auto-deploy projects, and style your sites in seconds."),
      el("button", { className: "api-hero-back", onClick: () => { history.pushState(null, "", "/dashboard"); state.page = "projects"; scheduleRender(); } },
        svgIcon("back"), " Back to Dashboard"
      )
    )
  );
  wrap.appendChild(hero);

  const layout = el("div", { className: "api-layout" });
  const sidebar = el("div", { className: "api-nav-sidebar" });
  const sidebarInner = el("div", { className: "api-nav-sticky" });

  const navItems = [
    { id: "overview", label: "Home Overview", icon: "home" },
    { id: "hosting-magic", label: "Hosting Magic", icon: "magic" },
    { id: "api-endpoints", label: "API Endpoints", icon: "endpoint" },
    { id: "sdks-autostyling", label: "SDK AutoStyling", icon: "style" },
    { id: "javascript", label: "Javascript", icon: "code" },
    { id: "ai-integration", label: "AI Integration", icon: "ai" }
  ];

  const sideLabel = el("div", { className: "api-nav-label" }, "On this page");
  sidebarInner.appendChild(sideLabel);

  navItems.forEach(function(item) {
    const link = el("div", { className: "api-nav-item", "data-id": item.id },
      svgIcon(item.icon),
      el("span", {}, item.label)
    );
    link.onclick = function() {
      const sec = document.getElementById(item.id);
      if (sec) sec.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", "/ourapi/#" + item.id);
    };
    sidebarInner.appendChild(link);
  });
  sidebar.appendChild(sidebarInner);

  const main = el("div", { className: "api-main" });

  const sections = [
    { id: "overview", label: "Home Overview", content: function() {
      const d = el("div", { className: "api-section-body" });
      d.appendChild(el("p", { className: "api-section-desc" }, "Create API keys to extend Reboot Cord. Use for custom hosting and tools."));
      d.appendChild(el("p", { className: "api-section-note" }, "Keys start with rc_live_ but lists and hidden views show rc_****** for security. The copy key button always provides the full key for the latest created entry even when masked. Full key is only available in this session after creation."));

      const keyBtn = el("button", { className: "api-action-btn", onClick: createApiKey },
        svgIcon("key"), " Create API Key"
      );
      d.appendChild(el("div", { style: { marginTop: "16px" } }, keyBtn));

      if (state.recentKey) {
        const box = el("div", { className: "api-key-new-box" });
        box.appendChild(el("div", { className: "api-key-new-label" }, svgIcon("key"), " Copy this key now — shown only once"));
        const disp = state.recentKeyHidden ? "rc_******" : state.recentKey;
        const keyEl = el("div", { className: "api-key-display" }, disp);
        box.appendChild(keyEl);
        const acts = el("div", { className: "api-key-actions" });
        const showB = el("button", { className: "api-mini-btn", onClick: () => { state.recentKeyHidden = false; scheduleRender(); } }, "show key");
        const copyB = el("button", { className: "api-mini-btn primary", onClick: () => { navigator.clipboard.writeText(state.recentKey); const o = copyB.textContent; copyB.textContent = "copied!"; setTimeout(() => { copyB.textContent = o; }, 800); } }, "copy key");
        const hideB = state.recentKeyHidden
          ? el("button", { className: "api-mini-btn", onClick: () => { state.recentKey = null; scheduleRender(); } }, "clear")
          : el("button", { className: "api-mini-btn", onClick: () => { state.recentKeyHidden = true; scheduleRender(); } }, "hide");
        acts.appendChild(showB);
        acts.appendChild(copyB);
        acts.appendChild(hideB);
        box.appendChild(acts);
        d.appendChild(box);
      }

      d.appendChild(el("div", { className: "api-sub-heading" }, "Your API Keys"));
      if (!state.apiKeys || state.apiKeys.length === 0) {
        d.appendChild(el("div", { className: "api-empty-keys" }, "No keys yet. Create one above."));
      } else {
        const keyList = el("div", { className: "api-keys-list" });
        state.apiKeys.forEach(function(k) {
          const isRecent = state.lastCreatedKey && k.id === state.lastCreatedKey.id;
          const row = el("div", { className: "api-key-row" },
            el("span", { className: "api-key-mono" }, k.masked || "rc_******"),
            el("div", { className: "api-key-row-actions" },
              el("button", { className: "api-mini-btn", onClick: () => { alert("Full key only shown once at creation for security."); } }, "show"),
              el("button", { className: "api-mini-btn primary", onClick: function() {
                const toCopy = (isRecent && state.lastCreatedKey) ? state.lastCreatedKey.key : (k.masked || "rc_******");
                navigator.clipboard.writeText(toCopy);
                this.textContent = "copied!";
                setTimeout(() => { this.textContent = "copy"; }, 800);
              } }, "copy")
            )
          );
          keyList.appendChild(row);
        });
        d.appendChild(keyList);
      }
      return d;
    } },
    { id: "hosting-magic", label: "Hosting Magic", content: function() {
      const d = el("div", { className: "api-section-body" });
      d.appendChild(el("p", { className: "api-section-desc" }, "Use the deploy endpoint to let the platform host your projects automatically. Point your site at the API and watch it deploy in real time."));
      const steps = [
        { n: "01", title: "Generate an API key", desc: "Create a key from the Home Overview section. Keep it safe." },
        { n: "02", title: "Call the deploy endpoint", desc: "POST to /api/v1/deploy with your project data and rc_live_ key for auth." },
        { n: "03", title: "Sit back", desc: "The platform handles the rest. Watch logs stream in real time." }
      ];
      const stepsWrap = el("div", { className: "api-steps" });
      steps.forEach(function(s) {
        stepsWrap.appendChild(el("div", { className: "api-step" },
          el("div", { className: "api-step-num" }, s.n),
          el("div", { className: "api-step-body" },
            el("div", { className: "api-step-title" }, s.title),
            el("div", { className: "api-step-desc" }, s.desc)
          )
        ));
      });
      d.appendChild(stepsWrap);
      return d;
    } },
    { id: "api-endpoints", label: "API Endpoints", content: function() {
      const d = el("div", { className: "api-section-body" });
      const endpoints = [
        { method: "POST", path: "/api/v1/deploy", desc: "Hook your site project so it sends calls to the API provided. You can just sit back and watch the host magic happen in real time. Use your rc_live_ key in the request for auth.", params: [{ name: "Authorization", type: "header", desc: "rc_live_xxx" }, { name: "projectId", type: "body", desc: "Your project ID" }] },
        { method: "POST", path: "/api/v1/apikeys", desc: "Create a new API key for your apps. Full key returned once only — use masked rc_****** in lists. Copy button gives full key for recent even when hidden.", params: [{ name: "Authorization", type: "header", desc: "rc_live_xxx" }] },
        { method: "GET", path: "/api/v1/apikeys", desc: "List your API keys. Returns masked versions for security. Use the copy button on the dashboard to get the full key.", params: [{ name: "Authorization", type: "header", desc: "rc_live_xxx" }] },
        { method: "POST", path: "/api/v1/feedback", desc: "Submit user feedback or suggestion from your site or tools. Requires rc_live_ key. Rate limited.", params: [{ name: "Authorization", type: "header", desc: "rc_live_xxx" }, { name: "message", type: "body", desc: "The feedback text" }] }
      ];
      endpoints.forEach(function(ep) {
        const card = el("div", { className: "api-endpoint-card" },
          el("div", { className: "api-endpoint-header" },
            el("span", { className: "api-method " + ep.method.toLowerCase() }, ep.method),
            el("span", { className: "api-path" }, ep.path)
          ),
          el("p", { className: "api-endpoint-desc" }, ep.desc),
          el("div", { className: "api-params" },
            ...ep.params.map(function(p) {
              return el("div", { className: "api-param-row" },
                el("code", { className: "api-param-name" }, p.name),
                el("span", { className: "api-param-type" }, p.type),
                el("span", { className: "api-param-desc" }, p.desc)
              );
            })
          )
        );
        d.appendChild(card);
      });
      return d;
    } },
    { id: "sdks-autostyling", label: "SDK AutoStyling", content: function() {
      const d = el("div", { className: "api-section-body" });
      d.appendChild(el("p", { className: "api-section-desc" }, "Drop in one script tag and your site gets professional, clean UI automatically. Cards, buttons, inputs, animations — all styled instantly."));

      function codeBlock(label, code, lang) {
        const wrap = el("div", { className: "api-code-block" });
        const header = el("div", { className: "api-code-header" },
          el("span", { className: "api-code-lang" }, lang || "html"),
          el("button", { className: "api-code-copy", onClick: function() { navigator.clipboard.writeText(code); this.textContent = "copied!"; setTimeout(() => { this.textContent = "copy"; }, 900); } }, "copy")
        );
        if (label) wrap.appendChild(el("div", { className: "api-code-label" }, label));
        wrap.appendChild(header);
        const pre = el("div", { className: "api-code-pre" }, code);
        wrap.appendChild(pre);
        return wrap;
      }

      d.appendChild(codeBlock("1. Include the script", '<script src="https://rebootcord.world/sdk/rebootui.js"></script>', "html"));
      d.appendChild(codeBlock("2. Initialize", 'RebootUI.init({ apiKey: "YOUR_API_KEY", feedback: true });', "js"));
      d.appendChild(codeBlock("3. Tag your elements", '<div class="user-card">Welcome</div>\n\nBecomes:\n<div class="rb-card rb-glass rb-hover">Welcome</div>', "html"));
      d.appendChild(codeBlock("Or use helpers", 'RebootUI.createCard({ title: "Bot Status", description: "Online", badge: "live" });\nRebootUI.page({ theme: "cyber", glass: true });', "js"));

      const feats = el("div", { className: "api-feature-grid" });
      [
        { icon: "style", label: "Auto fonts", desc: "Syne + IBM Plex Mono applied site-wide" },
        { icon: "doc", label: "Glass morphism", desc: "Beautiful glass cards and surfaces" },
        { icon: "plus", label: "Components", desc: "Cards, buttons, inputs, badges, alerts" },
        { icon: "bolt", label: "Animations", desc: "Smooth fade-in, slide, pulse effects" },
        { icon: "code", label: "Dark mode", desc: "Deep dark theme with accent colors" },
        { icon: "shield", label: "No overrides", desc: "Only affects marked elements, safe to use" }
      ].forEach(function(f) {
        feats.appendChild(el("div", { className: "api-feature-item" },
          el("span", { className: "api-feature-icon" }, svgIcon(f.icon)),
          el("div", {},
            el("div", { className: "api-feature-label" }, f.label),
            el("div", { className: "api-feature-desc" }, f.desc)
          )
        ));
      });
      d.appendChild(el("div", { className: "api-sub-heading", style: { marginTop: "20px" } }, "What you get"));
      d.appendChild(feats);
      return d;
    } },
    { id: "javascript", label: "Javascript", content: function() {
      const d = el("div", { className: "api-section-body" });
      d.appendChild(el("p", { className: "api-section-desc" }, "Full JS API for programmatic control. Call init then use rb- classes, or use helpers like createCard and createStat for clean professional dashboards without any weird side effects on your existing layout."));
      const methods = [
        { name: "RebootUI.init(opts)", desc: "Initialize the SDK. Pass apiKey, accent, font, dark, watch, root, feedback:true for floating suggest button." },
        { name: "RebootUI.enhance(root)", desc: "Manually trigger auto-styling on a specific element or container." },
        { name: "RebootUI.createCard(config)", desc: "Create a styled card element. Pass title, description, badge, actions, footer." },
        { name: "RebootUI.createStat(config)", desc: "Create a stat card with value, label, and delta indicator." },
        { name: "RebootUI.createNav(config)", desc: "Create a styled nav bar with brand and links array." },
        { name: "RebootUI.createBadge(label, type)", desc: "Create a badge: success, danger, info types." },
        { name: "RebootUI.createAlert(msg, type)", desc: "Create an alert: info, success, danger, warn types." },
        { name: "RebootUI.createProgress(value, type)", desc: "Create a progress bar from 0–100." },
        { name: "RebootUI.page(opts)", desc: "Configure page-level options: theme, glass, dark, accent, font, root." },
        { name: "RebootUI.setTheme(vars)", desc: "Override CSS variables: accent, font, bg, border, etc." },
        { name: "RebootUI.submitFeedback(data)", desc: "Send feedback/suggestion using your apiKey. Works from any site after init." },
        { name: "RebootUI.showFeedback(opts)", desc: "Open a ready-made feedback modal. Pass nothing or {type}. Use init({feedback:true}) for auto floating button." }
      ];
      const list = el("div", { className: "api-methods-list" });
      methods.forEach(function(m) {
        list.appendChild(el("div", { className: "api-method-row" },
          el("code", { className: "api-method-name" }, m.name),
          el("div", { className: "api-method-desc" }, m.desc)
        ));
      });
      d.appendChild(list);
      const logBox = el("div", { className: "api-log-box" },
        el("div", { className: "api-log-line" }, "[RebootUI v2] Initialized with API key"),
        el("div", { className: "api-log-line" }, "[RebootUI v2] Auto styles applied — dashboards, cards, and UI enhanced.")
      );
      d.appendChild(el("div", { className: "api-sub-heading", style: { marginTop: "20px" } }, "Console output on init"));
      d.appendChild(logBox);
      return d;
    } },
    { id: "ai-integration", label: "AI Integration", content: function() {
      const d = el("div", { className: "api-section-body" });
      d.appendChild(el("p", { className: "api-section-desc" }, "Access powerful AI capabilities through our Gemini 2.5 Pro proxy. Compatible with OpenAI and Anthropic API formats for seamless integration."));
      
      function codeBlock(label, code, lang) {
        const wrap = el("div", { className: "api-code-block" });
        const header = el("div", { className: "api-code-header" },
          el("span", { className: "api-code-lang" }, lang || "js"),
          el("button", { className: "api-code-copy", onClick: function() { navigator.clipboard.writeText(code); this.textContent = "copied!"; setTimeout(() => { this.textContent = "copy"; }, 900); } }, "copy")
        );
        if (label) wrap.appendChild(el("div", { className: "api-code-label" }, label));
        wrap.appendChild(header);
        const pre = el("div", { className: "api-code-pre" }, code);
        wrap.appendChild(pre);
        return wrap;
      }

      d.appendChild(codeBlock("OpenAI Chat Completions", `fetch('/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
})`, "js"));

      d.appendChild(codeBlock("Anthropic Messages", `fetch('/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
})`, "js"));

      d.appendChild(codeBlock("List Available Models", `fetch('/v1/models')
  .then(r => r.json())
  .then(data => console.log(data))`, "js"));

      d.appendChild(el("div", { className: "api-sub-heading", style: { marginTop: "24px" } }, "Feedback SDK"));

      d.appendChild(el("p", { className: "api-section-desc" }, "Add user feedback and support chat to your projects with the Reboot Feedback SDK. Easy integration for user communication and admin support."));

      d.appendChild(codeBlock("Include Feedback SDK", `<script src="https://rebootcord.world/sdk/rebootfeedback.js"></script>`, "html"));

      d.appendChild(codeBlock("Initialize Feedback", `RebootFeedback.init({
  apiKey: 'YOUR_API_KEY',
  button: true,
  widget: true
});`, "js"));

      d.appendChild(codeBlock("Custom Button", `const btn = RebootFeedback.createButton({
  label: 'Send Feedback',
  small: true
});
document.body.appendChild(btn);`, "js"));

      const endpoints = [
        { method: "GET", path: "/v1/models", desc: "List all available AI models including Gemini 2.5 Pro, Flash, and others." },
        { method: "POST", path: "/v1/chat/completions", desc: "OpenAI-compatible chat completions endpoint. Maps GPT/Claude models to Gemini equivalents." },
        { method: "POST", path: "/v1/messages", desc: "Anthropic-compatible messages endpoint. Maps Claude models to Gemini equivalents." },
        { method: "POST", path: "/api/v1/feedback", desc: "Submit user feedback or support requests. Requires API key. Rate limited." },
        { method: "GET", path: "/api/v1/feedback-users", desc: "Get list of users who sent feedback (admin only). Requires admin access." },
        { method: "POST", path: "/api/v1/feedback-reply", desc: "Reply to user feedback (admin only). Allows admin to respond directly to users." }
      ];

      d.appendChild(el("div", { className: "api-sub-heading", style: { marginTop: "24px" } }, "Available Endpoints"));
      endpoints.forEach(function(ep) {
        const card = el("div", { className: "api-endpoint-card" },
          el("div", { className: "api-endpoint-header" },
            el("span", { className: "api-method " + ep.method.toLowerCase() }, ep.method),
            el("span", { className: "api-path" }, ep.path)
          ),
          el("p", { className: "api-endpoint-desc" }, ep.desc)
        );
        d.appendChild(card);
      });

      const modelMap = [
        { input: "gpt-4o", output: "gemini-2.5-pro" },
        { input: "gpt-4", output: "gemini-2.0-flash" },
        { input: "claude-opus-4-5-20251101", output: "gemini-2.5-pro" },
        { input: "claude-sonnet-4-5-20250929", output: "gemini-2.5-pro" },
        { input: "claude-3-5-sonnet-20241022", output: "gemini-2.5-pro" },
        { input: "gemini-2.5-pro", output: "gemini-2.5-pro" },
        { input: "gemini-2.0-flash", output: "gemini-2.0-flash" },
        { input: "gemini-1.5-pro", output: "gemini-1.5-pro" }
      ];

      d.appendChild(el("div", { className: "api-sub-heading", style: { marginTop: "24px" } }, "Model Mapping"));
      const mapTable = el("div", { className: "api-params" });
      modelMap.forEach(function(m) {
        mapTable.appendChild(el("div", { className: "api-param-row" },
          el("code", { className: "api-param-name" }, m.input),
          el("span", { className: "api-param-type" }, "→"),
          el("span", { className: "api-param-desc" }, m.output)
        ));
      });
      d.appendChild(mapTable);

      const features = el("div", { className: "api-feature-grid" });
      [
        { icon: "ai", label: "Free Access", desc: "No API key required for basic usage" },
        { icon: "bolt", label: "Fast Response", desc: "Optimized for low latency" },
        { icon: "refresh", label: "Compatible", desc: "Works with OpenAI and Anthropic clients" },
        { icon: "shield", label: "Rate Limited", desc: "20 requests per minute per IP" }
      ].forEach(function(f) {
        features.appendChild(el("div", { className: "api-feature-item" },
          el("span", { className: "api-feature-icon" }, svgIcon(f.icon)),
          el("div", {},
            el("div", { className: "api-feature-label" }, f.label),
            el("div", { className: "api-feature-desc" }, f.desc)
          )
        ));
      });
      d.appendChild(el("div", { className: "api-sub-heading", style: { marginTop: "24px" } }, "Features"));
      d.appendChild(features);

      return d;
    } }
  ];

  sections.forEach(function(sec) {
    const secEl = el("div", { id: sec.id, className: "api-section-card" });
    secEl.appendChild(el("div", { className: "api-section-header" },
      el("h2", { className: "api-section-title" }, sec.label)
    ));
    secEl.appendChild(sec.content());
    main.appendChild(secEl);
  });

  layout.appendChild(sidebar);
  layout.appendChild(main);
  wrap.appendChild(layout);
  frag.appendChild(wrap);

  if (!state.scrollListenerAdded) {
    state.scrollListenerAdded = true;
    setTimeout(function() {
      const onScroll = function() {
        let cur = "";
        sections.forEach(function(s) {
          const secEl = document.getElementById(s.id);
          if (secEl && secEl.getBoundingClientRect().top < 140) cur = s.id;
        });
        if (cur) {
          document.querySelectorAll(".api-nav-item").forEach(function(div) {
            const did = div.getAttribute("data-id") || "";
            div.classList.toggle("active", did === cur);
          });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }, 200);
  }

  if (!state.sdkInjected) {
    state.sdkInjected = true;
    setTimeout(function() {
      const existing = document.querySelector('script[src*="rebootui.js"]');
      if (!existing) {
        const s = document.createElement("script");
        s.src = "https://rebootcord.world/sdk/rebootui.js";
        s.onload = function() {
          if (window.RebootUI && !window.RebootUI._inited) {
            try {
              RebootUI.init({ apiKey: "demo" });
              window.RebootUI._inited = true;
            } catch(e) {}
          }
        };
        document.head.appendChild(s);
      } else if (window.RebootUI && !window.RebootUI._inited) {
        try { RebootUI.init({ apiKey: "demo" }); window.RebootUI._inited = true; } catch(e) {}
      }
    }, 80);
  }

  if (!state.apiKeysLoaded) {
    fetch("/api/v1/apikeys").then(function(r) { return r.json(); }).then(function(d) {
      if (d.success) { state.apiKeys = d.keys || []; state.apiKeysLoaded = true; scheduleRender(); }
    }).catch(function() {});
  }

  return frag;
}

function createApiKey() {
  fetch("/api/v1/apikeys", { method: "POST" }).then(r => r.json()).then(d => {
    if (d.success) {
      state.recentKey = d.key;
      state.recentKeyHidden = true;
      state.lastCreatedKey = {id: d.id, key: d.key};
      fetch("/api/v1/apikeys").then(r => r.json()).then(dd => {
        if (dd.success) state.apiKeys = dd.keys || [];
        state.apiKeysLoaded = true;
        scheduleRender();
      });
    }
  }).catch(e => { console.error(e); alert("Failed to create key. Check console."); });
}

function formatChangelogBody(body) {
  if (!body) return "";
  const lines = body.split("\n");
  let html = "";
  let inList = false;
  lines.forEach(function(line) {
    const t = line.trim();
    if (t.startsWith("*") || t.startsWith("+")) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + escapeHtml(t.slice(1).trim()) + "</li>";
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (t) html += "<p>" + escapeHtml(t) + "</p>";
    }
  });
  if (inList) html += "</ul>";
  return html;
}

function escapeHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderChangelogModal() {
  const overlay = el("div", { className: "modal-overlay", onClick: (ev) => { if (ev.target === overlay) { state.showChangelogModal = false; scheduleRender(); } } });
  const modal = el("div", { className: "modal changelog-modal" },
    el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } },
      el("h2", { style: { margin: 0, fontSize: "17px", fontWeight: "800", letterSpacing: "-.02em" } }, "-- Post a changelog"),
      el("button", { className: "modal-close-btn", onClick: () => { state.showChangelogModal = false; scheduleRender(); } }, "×")
    ),
    el("div", { className: "form-group" },
      el("label", { className: "form-label" }, "Enter changelog title name:"),
      el("input", { className: "form-input", value: state.newChangelogTitle, oninput: (e) => { state.newChangelogTitle = e.target.value; } })
    ),
    el("div", { className: "form-group" },
      el("label", { className: "form-label" }, "type what has been changed of the site here:"),
      el("textarea", { className: "about-editor", style: { minHeight: "140px" }, value: state.newChangelogBody, oninput: (e) => { state.newChangelogBody = e.target.value; } })
    ),
    el("div", { className: "form-group", style: { display: "flex", alignItems: "center", gap: "8px" } },
      (() => { const cb = el("input", { type: "checkbox", id: "genlink" }); cb.checked = !!state.generateChangelogLink; cb.onchange = (e) => { state.generateChangelogLink = e.target.checked; }; return cb; })(),
      el("label", { for: "genlink", style: { fontSize: "12px", color: "#aaa", cursor: "pointer" } }, "generate changelog link")
    ),
    el("div", { className: "modal-actions" },
      el("button", { className: "btn-cancel", onClick: () => { state.showChangelogModal = false; scheduleRender(); } }, "Cancel"),
      el("button", { className: "btn-create", onClick: postChangelog }, "Post changelog")
    )
  );
  overlay.appendChild(modal);
  return overlay;
}

document.addEventListener("keydown", function(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    if (state.showSearchModal) {
      state.showSearchModal = false;
    } else {
      state.showSearchModal = true;
      state.searchTerm = "";
    }
    scheduleRender();
    return;
  }
  if (e.key === "Escape" && state.showSearchModal) {
    state.showSearchModal = false;
    scheduleRender();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    if (state.page === "bot-dashboard" && state.currentProject && state.editorFile) {
      e.preventDefault();
      saveCurrentFile();
      state.justSaved = true;
      scheduleRender();
    }
  }
});

window.addEventListener("popstate", function() {
  const p = window.location.pathname || "";
  if (p.indexOf("/changelogs") !== -1 || p === "/changelog" || p.startsWith("/changelog/")) {
    state.page = "changelogs";
    if (p.startsWith("/changelogs/")) {
      state.viewChangelogSlug = p.split("/changelogs/")[1];
    } else if (p.startsWith("/changelog/")) {
      state.viewChangelogSlug = p.split("/changelog/")[1];
    } else {
      state.viewChangelogSlug = null;
    }
    fetchChangelogs();
  } else if (p === "/ourapi") {
    state.page = "ourapi";
  } else if (state.page === "changelogs" || state.page === "ourapi") {
    state.page = "projects";
    state.viewChangelogSlug = null;
  }
  render();
});

fetch("/api/me").then(r => r.json()).then(d => {
  if (!d.loggedIn) { window.location.href = "/"; return; }
  state.username = d.username;
  state.isAdmin = !!d.isAdmin;
  const path = window.location.pathname || "";
  if (path.indexOf("/changelogs") !== -1 || path.indexOf("/changelog") !== -1) state.page = "changelogs";
  if (path.startsWith("/changelogs/")) {
    state.viewChangelogSlug = path.split("/changelogs/")[1];
  } else if (path.startsWith("/changelog/")) {
    state.viewChangelogSlug = path.split("/changelog/")[1];
  }
  fetch("/api/projects").then(r => r.json()).then(pd => {
    if (pd && pd.projects) state.projects = pd.projects;
    const path = window.location.pathname || '';
    if (path === '/ourapi' || path === '/dashboard/ourapi') {
      state.page = 'ourapi';
    } else if (path === '/changelog' || path.startsWith('/changelog/') || path === '/changelogs' || path.startsWith('/changelogs/') || path === '/dashboard/changelogs') {
      state.page = 'changelogs';
      if (path.startsWith('/changelogs/')) {
        state.viewChangelogSlug = path.split('/changelogs/')[1];
      } else if (path.startsWith('/changelog/')) {
        state.viewChangelogSlug = path.split('/changelog/')[1];
      } else {
        state.viewChangelogSlug = null;
      }
    } else if (path.startsWith('/dashboard/')) {
      const slug = path.split('/dashboard/')[1];
      const proj = state.projects.find(pr => pr.name.toLowerCase().replace(/\s+/g, '-') === slug);
      if (proj) {
        state.currentProject = proj;
        state.page = proj.type === 'minecraft' ? 'mc-dashboard' : 'bot-dashboard';
      }
    }
    if (state.page === "changelogs") fetchChangelogs();
    render();
  }).catch(() => render());
}).catch(() => render());
