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
  viewChangelogSlug: null
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
  };
  const wrap = document.createElement("span");
  wrap.className = "svg-icon";
  if (color) wrap.style.color = color;
  wrap.innerHTML = icons[type] || icons.doc;
  return wrap;
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
        el("input", { className: "search-input", placeholder: "Search projects...", value: state.searchTerm, oninput: function(e){ state.searchTerm = e.target.value; scheduleRender(); } }),
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
      wrap.appendChild(el("button", { className: "go-back-btn", onClick: () => { history.pushState(null, "", "/changelog"); state.viewChangelogSlug = null; scheduleRender(); } }, "Go Back"));
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
        titleEl.onclick = () => { history.pushState(null, "", "/changelog/" + s); state.viewChangelogSlug = s; scheduleRender(); };
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
  const wrap = el("div", { className: "projects-page", style: "max-width:1100px" });
  const header = el("div", { className: "api-header" },
    el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      el("div", {},
        el("h1", { style: { margin: 0, fontSize: "22px" } }, "Reboot API"),
        el("p", { style: { margin: "4px 0 0", color: "#888", fontSize: "13px" } }, "For developers. Extend the platform with APIs and SDKs.")
      ),
      el("button", { className: "go-back-btn", onClick: () => { history.pushState(null, "", "/dashboard"); state.page = "projects"; scheduleRender(); } }, "Go Back")
    )
  );
  wrap.appendChild(header);
  const container = el("div", { className: "api-container", style: "display:flex; gap:24px; align-items:flex-start" });
  const sidebar = el("div", { className: "api-sidebar", style: "width:190px; flex-shrink:0; padding-right:12px" });
  const main = el("div", { style: "flex:1; max-width:820px" });
  const navItems = [
    { id: "overview", label: "Home Overview" },
    { id: "hosting-magic", label: "Hosting Magic" },
    { id: "api-endpoints", label: "API Endpoints" },
    { id: "sdks-autostyling", label: "SDKs - AutoStyling" },
    { id: "javascript", label: "Javascript" }
  ];
  navItems.forEach((item, idx) => {
    const link = el("div", { style: "padding:8px 0; cursor:pointer; font-size:13px; color:#aaa", onClick: () => {
      const sec = document.getElementById(item.id);
      if (sec) sec.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", "/ourapi/#" + item.id);
    } }, item.label);
    sidebar.appendChild(link);
  });
  // sections
  const sections = [
    { id: "overview", title: "Home Overview", content: () => {
      const d = el("div");
      d.appendChild(el("p", {}, "Create API keys to extend Reboot Cord. Use for custom hosting and tools."));
      const btn = el("button", { className: "btn-new api-btn", onClick: createApiKey }, "Create API Key");
      d.appendChild(el("div", { style: { height: "12px" } }));
      d.appendChild(btn);
      if (state.recentKey) {
        const box = el("div", { style: "margin-top:12px; padding:14px; background:#0a0a0a; border:1px solid #2d2d2d; border-radius:10px" });
        box.appendChild(el("div", { style: "color:#e63946; font-weight:700; font-size:13px; margin-bottom:6px" }, "Copy this key now (shown once):"));
        const disp = state.recentKeyHidden ? "rc_******" : state.recentKey;
        const keyEl = el("div", { style: "font-family:monospace; word-break:break-all; margin:8px 0; color:#fff; background:#111; padding:8px; border-radius:6px; font-size:12px" }, disp);
        box.appendChild(keyEl);
        const acts = el("div", { style: "display:flex; gap:6px; margin-top:4px" });
        const showB = el("button", { className: "btn-cancel", style: "font-size:10px; padding:3px 8px", onClick: () => { state.recentKeyHidden = false; scheduleRender(); } }, "show api key");
        const copyB = el("button", { className: "btn-cancel", style: "font-size:10px; padding:3px 8px", onClick: () => { navigator.clipboard.writeText(state.recentKey); } }, "copy key");
        acts.appendChild(showB);
        acts.appendChild(copyB);
        if (state.recentKeyHidden) {
          const h = el("button", { className: "btn-cancel", style: "font-size:10px; padding:3px 8px", onClick: () => { state.recentKey = null; scheduleRender(); } }, "clear");
          acts.appendChild(h);
        } else {
          const h = el("button", { className: "btn-cancel", style: "font-size:10px; padding:3px 8px", onClick: () => { state.recentKeyHidden = true; scheduleRender(); } }, "hide");
          acts.appendChild(h);
        }
        box.appendChild(acts);
        d.appendChild(box);
      }
      d.appendChild(el("div", { style: "margin-top:18px; font-weight:700; font-size:14px; color:#fff" }, "Your API Keys"));
      if (!state.apiKeys || state.apiKeys.length === 0) {
        d.appendChild(el("div", { style: "color:#888; font-size:12px; margin-top:6px" }, "No keys yet."));
      } else {
        state.apiKeys.forEach(k => {
          const row = el("div", { style: "margin:8px 0; padding:10px; background:#0a0a0a; border:1px solid #222; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:12px" });
          row.appendChild(el("span", { style: "font-family:monospace; color:#888" }, k.masked || "rc_******"));
          const acts = el("div", { style: "display:flex; gap:6px" });
          const showB = el("button", { className: "btn-cancel", style: "font-size:10px; padding:3px 8px", onClick: () => { alert("Full key only shown once at creation for security."); } }, "show api key");
          const isRecent = state.lastCreatedKey && k.id === state.lastCreatedKey.id;
          const copyB = el("button", { className: "btn-cancel", style: "font-size:10px; padding:3px 8px", onClick: () => { const toCopy = (isRecent && state.lastCreatedKey) ? state.lastCreatedKey.key : (k.masked || "rc_******"); navigator.clipboard.writeText(toCopy); } }, "copy key");
          acts.appendChild(showB);
          acts.appendChild(copyB);
          row.appendChild(acts);
          d.appendChild(row);
        });
      }
      return d;
    } },
    { id: "hosting-magic", title: "Hosting Magic", content: () => el("div", { style: "padding:14px; background:#0a0a0a; border:1px solid #222; border-radius:10px" }, el("p", { style: "margin:0; color:#ccc; font-size:13px" }, "Use the deploy endpoint to let the platform host your projects automatically.")) },
    { id: "api-endpoints", title: "API Endpoints", content: () => {
      const d = el("div");
      d.appendChild(el("div", { style: "margin:8px 0; padding:14px; background:#0a0a0a; border:1px solid #222; border-radius:10px" },
        el("div", { style: "font-weight:700; color:#fff; font-size:14px" }, "POST /api/v1/deploy"),
        el("div", { style: "font-size:12px; color:#aaa; margin-top:6px" }, "This api will hook your site project, so that your site will send its calls to the api provided, so you can just sit back and watch the host magic happening in real time.")
      ));
      d.appendChild(el("div", { style: "margin:8px 0; padding:14px; background:#0a0a0a; border:1px solid #222; border-radius:10px" },
        el("div", { style: "font-weight:700; color:#fff; font-size:14px" }, "POST /api/v1/apikeys"),
        el("div", { style: "font-size:12px; color:#aaa; margin-top:6px" }, "Create a new API key for your apps.")
      ));
      return d;
    } },
    { id: "sdks-autostyling", title: "SDKs - AutoStyling", content: () => {
      const d = el("div");
      d.appendChild(el("div", { style: "margin-bottom:12px; padding:12px; background:#0a0a0a; border-radius:8px; border:1px solid #222" },
        el("div", { style: "font-weight:600; margin-bottom:6px; color:#fff" }, "Include this in your site:"),
        (() => { const ta = el("textarea", { className: "api-code", style: "width:100%; height:60px; color:#f4f4f4; background:#0f0f0f" }, '<script src="https://rebootcord.onrender.com/sdk/rebootui.js"></script>'); ta.readOnly = true; ta.onclick = () => { navigator.clipboard.writeText(ta.value); const orig = ta.style.color; ta.style.color = "var(--green)"; setTimeout(() => { ta.style.color = orig; }, 800); }; return ta; })()
      ));
      d.appendChild(el("div", { style: "margin-bottom:12px; padding:12px; background:#0a0a0a; border-radius:8px; border:1px solid #222" },
        el("div", { style: "font-weight:600; margin-bottom:6px; color:#fff" }, "Then init:"),
        (() => { const initTa = el("textarea", { className: "api-code", style: "width:100%; height:50px; color:#f4f4f4; background:#0f0f0f" }, 'RebootUI.init({ apiKey: "YOUR_API_KEY" });'); initTa.readOnly = true; initTa.onclick = () => { navigator.clipboard.writeText(initTa.value); const orig = initTa.style.color; initTa.style.color = "var(--green)"; setTimeout(() => { initTa.style.color = orig; }, 800); }; return initTa; })()
      ));
      d.appendChild(el("div", { style: "margin-bottom:12px; padding:12px; background:#0a0a0a; border-radius:8px; border:1px solid #222" },
        el("div", { style: "font-weight:600; margin-bottom:6px; color:#fff" }, "Example:"),
        (() => { const ex = el("div", { className: "api-code", style: "padding:8px; color:#f4f4f4; background:#0f0f0f; white-space:pre" }, '<div class="user-card">Welcome</div>\n\nBecomes:\n<div class="rb-card rb-glass rb-hover">Welcome</div>'); ex.onclick = () => { navigator.clipboard.writeText(ex.textContent); const orig = ex.style.color; ex.style.color = "var(--green)"; setTimeout(() => { ex.style.color = orig; }, 800); }; return ex; })()
      ));
      d.appendChild(el("div", { style: "margin-bottom:12px; padding:12px; background:#0a0a0a; border-radius:8px; border:1px solid #222" },
        el("div", { style: "font-weight:600; margin-bottom:6px; color:#fff" }, "Or:"),
        (() => { const codeEx = el("textarea", { className: "api-code", style: "width:100%; height:40px; color:#f4f4f4; background:#0f0f0f" }, 'RebootUI.createCard({ title: "Bot", description: "Online" });\nRebootUI.page({ theme: "cyber", glass: true });'); codeEx.readOnly = true; codeEx.onclick = () => { navigator.clipboard.writeText(codeEx.value); const orig = codeEx.style.color; codeEx.style.color = "var(--green)"; setTimeout(() => { codeEx.style.color = orig; }, 800); }; return codeEx; })()
      ));
      d.appendChild(el("p", { style: "font-size:12px; color:#aaa" }, "Auto applies fonts, glass, gradients, buttons, cards, animations, dark, responsive, dashboards."));
      return d;
    } },
    { id: "javascript", title: "Javascript", content: () => el("div", { style: "padding:14px; background:#0a0a0a; border:1px solid #222; border-radius:10px" }, el("p", { style: "margin:0; color:#ccc; font-size:13px" }, "Use the SDK script above for full auto UI polish in JS.")) }
  ];
  sections.forEach(sec => {
    const secEl = el("div", { id: sec.id, className: "api-section", style: "margin-bottom:24px" });
    secEl.appendChild(el("h2", { style: "font-size:16px; margin-bottom:8px" }, sec.title));
    secEl.appendChild(sec.content());
    main.appendChild(secEl);
  });
  container.appendChild(sidebar);
  container.appendChild(main);
  wrap.appendChild(container);
  // scroll hash listener
  setTimeout(() => {
    const onScroll = () => {
      let cur = "";
      sections.forEach(s => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 120) cur = s.id;
      });
      if (cur) {
        history.replaceState(null, "", "/ourapi/#" + cur);
        document.querySelectorAll('.api-sidebar > div').forEach(div => {
          div.classList.toggle('active', div.textContent.toLowerCase().includes(cur.split('-')[0]));
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }, 200);
  frag.appendChild(wrap);
  setTimeout(() => {
    const existing = document.querySelector('script[src*="rebootui.js"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://rebootcord.onrender.com/sdk/rebootui.js";
      s.onload = () => { if (window.RebootUI) { try { const root = document.querySelector(".api-container") || document.body; RebootUI.init({apiKey:"demo", root: root}); const over = document.createElement("style"); over.textContent = ".rb-btn:hover{transform:none!important;filter:none!important} .rb-hover:hover{transform:none!important}"; document.head.appendChild(over); } catch(e){} } };
      document.head.appendChild(s);
    } else if (window.RebootUI) {
      try { const rt = document.querySelector(".api-container") || document.body; RebootUI.init({apiKey:"demo", root: rt}); } catch(e){}
    }
  }, 80);
  if (!state.apiKeysLoaded) {
    fetch("/api/v1/apikeys").then(r => r.json()).then(d => {
      if (d.success) {
        state.apiKeys = d.keys || [];
        state.apiKeysLoaded = true;
        scheduleRender();
      }
    }).catch(() => {});
  }
  return frag;
}

function createApiKey() {
  fetch("/api/v1/apikeys", { method: "POST" }).then(r => r.json()).then(d => {
    if (d.success) {
      state.recentKey = d.key;
      state.recentKeyHidden = false;
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
    el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" } },
      el("h2", { style: { margin: 0 } }, "-- Post a changelog"),
      el("button", { className: "btn-cancel", style: { padding: "2px 6px", fontSize: "16px" }, onClick: () => { state.showChangelogModal = false; scheduleRender(); } }, "×")
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
      el("input", { type: "checkbox", id: "genlink", checked: state.generateChangelogLink, onchange: (e) => { state.generateChangelogLink = e.target.checked; } }),
      el("label", { for: "genlink", style: { fontSize: "12px", color: "#aaa" } }, "generate changelog link")
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
    if (p.startsWith("/changelog/")) {
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
  if (path.indexOf("/changelogs") !== -1) state.page = "changelogs";
  fetch("/api/projects").then(r => r.json()).then(pd => {
    if (pd && pd.projects) state.projects = pd.projects;
    const path = window.location.pathname || '';
    if (path === '/ourapi' || path === '/dashboard/ourapi') {
      state.page = 'ourapi';
    } else if (path === '/changelog' || path.startsWith('/changelog/') || path === '/dashboard/changelogs') {
      state.page = 'changelogs';
      if (path.startsWith('/changelog/')) {
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
