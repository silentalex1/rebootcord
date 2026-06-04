(function() {
  if (window.RebootUI) return;

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap';
  document.head.appendChild(fontLink);

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --rb-font: 'Syne', system-ui, -apple-system, sans-serif;
      --rb-mono: 'IBM Plex Mono', 'Courier New', monospace;
      --rb-bg: #080808;
      --rb-surface: #0f0f0f;
      --rb-surface-2: #141414;
      --rb-surface-3: #1c1c1c;
      --rb-border: #1f1f1f;
      --rb-border-bright: #2d2d2d;
      --rb-text: #f4f4f4;
      --rb-text-dim: #8a8a8a;
      --rb-text-muted: #4a4a4a;
      --rb-accent: #e63946;
      --rb-accent-2: #ff4d57;
      --rb-accent-glow: rgba(230, 57, 70, 0.18);
      --rb-green: #2ec27e;
      --rb-blue: #5865f2;
      --rb-blue-bright: #7289da;
      --rb-radius: 10px;
      --rb-radius-sm: 7px;
      --rb-radius-lg: 16px;
      --rb-shadow: 0 2px 8px rgba(0,0,0,0.5);
      --rb-shadow-md: 0 6px 20px rgba(0,0,0,0.6);
      --rb-shadow-lg: 0 16px 48px rgba(0,0,0,0.8);
      --rb-transition: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .rb-dark {
      background: var(--rb-bg) !important;
      color: var(--rb-text) !important;
      font-family: var(--rb-font) !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .rb-card {
      background: var(--rb-surface);
      border: 1px solid var(--rb-border);
      border-radius: var(--rb-radius);
      padding: 20px 22px;
      color: var(--rb-text);
      box-shadow: var(--rb-shadow);
      transition: border-color var(--rb-transition), box-shadow var(--rb-transition), transform var(--rb-transition);
      position: relative;
      overflow: hidden;
      font-family: var(--rb-font);
    }
    .rb-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
      pointer-events: none;
    }
    .rb-card h1, .rb-card h2, .rb-card h3, .rb-card h4 {
      margin: 0 0 8px;
      color: var(--rb-text);
      font-family: var(--rb-font);
      letter-spacing: -0.02em;
    }
    .rb-card p, .rb-card .rb-desc {
      margin: 0;
      color: var(--rb-text-dim);
      font-size: 13px;
      line-height: 1.65;
    }

    .rb-glass {
      background: rgba(255,255,255,0.025) !important;
      backdrop-filter: blur(14px) saturate(160%);
      -webkit-backdrop-filter: blur(14px) saturate(160%);
      border: 1px solid rgba(255,255,255,0.065) !important;
    }
    .rb-glass-bg {
      background: linear-gradient(135deg, rgba(14,14,14,0.9) 0%, rgba(8,8,8,0.95) 100%);
      backdrop-filter: blur(20px);
    }

    .rb-hover:hover {
      border-color: var(--rb-border-bright) !important;
      box-shadow: var(--rb-shadow-md) !important;
      transform: translateY(-2px);
    }

    .rb-btn {
      background: var(--rb-accent);
      color: #fff;
      padding: 10px 20px;
      border: none;
      border-radius: var(--rb-radius-sm);
      font-weight: 700;
      font-size: 13px;
      font-family: var(--rb-font);
      cursor: pointer;
      transition: background var(--rb-transition), box-shadow var(--rb-transition), transform var(--rb-transition);
      display: inline-flex;
      align-items: center;
      gap: 7px;
      letter-spacing: 0.01em;
      position: relative;
      overflow: hidden;
      text-decoration: none;
    }
    .rb-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
      pointer-events: none;
    }
    .rb-btn:hover {
      background: var(--rb-accent-2);
      box-shadow: 0 0 24px var(--rb-accent-glow);
      transform: translateY(-1px);
    }
    .rb-btn:active { transform: translateY(0) scale(.98); }
    .rb-btn.rb-secondary {
      background: var(--rb-surface-2);
      color: var(--rb-text);
      border: 1px solid var(--rb-border-bright);
    }
    .rb-btn.rb-secondary:hover { background: var(--rb-surface-3); box-shadow: none; }
    .rb-btn.rb-ghost {
      background: transparent;
      color: var(--rb-text-dim);
      border: 1px solid var(--rb-border);
    }
    .rb-btn.rb-ghost:hover { border-color: var(--rb-border-bright); color: var(--rb-text); transform: none; box-shadow: none; }
    .rb-btn.rb-green { background: var(--rb-green); }
    .rb-btn.rb-green:hover { box-shadow: 0 0 20px rgba(46,194,126,0.25); }
    .rb-btn.rb-blue { background: var(--rb-blue); }
    .rb-btn.rb-blue:hover { box-shadow: 0 0 20px rgba(88,101,242,0.25); }
    .rb-btn.rb-sm { padding: 6px 12px; font-size: 11px; }
    .rb-btn.rb-lg { padding: 13px 26px; font-size: 15px; border-radius: var(--rb-radius); }
    .rb-btn.rb-icon { padding: 9px; aspect-ratio: 1; justify-content: center; }

    .rb-input, .rb-textarea, .rb-select {
      background: var(--rb-surface-2);
      border: 1px solid var(--rb-border);
      color: var(--rb-text);
      padding: 10px 14px;
      border-radius: var(--rb-radius-sm);
      font-family: var(--rb-font);
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
      transition: border-color var(--rb-transition), box-shadow var(--rb-transition);
      outline: none;
      -webkit-appearance: none;
    }
    .rb-input:focus, .rb-textarea:focus, .rb-select:focus {
      border-color: var(--rb-accent);
      box-shadow: 0 0 0 3px var(--rb-accent-glow);
    }
    .rb-input::placeholder, .rb-textarea::placeholder { color: var(--rb-text-muted); }
    .rb-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
    .rb-select { cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

    .rb-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--rb-text-muted);
      margin-bottom: 7px;
      font-family: var(--rb-font);
    }

    .rb-form-group { margin-bottom: 16px; }

    .rb-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: var(--rb-surface-3);
      color: var(--rb-text-dim);
      letter-spacing: 0.03em;
      border: 1px solid var(--rb-border);
      font-family: var(--rb-font);
    }
    .rb-badge.rb-success { background: rgba(46,194,126,0.1); color: var(--rb-green); border-color: rgba(46,194,126,0.2); }
    .rb-badge.rb-danger { background: rgba(230,57,70,0.1); color: var(--rb-accent); border-color: rgba(230,57,70,0.2); }
    .rb-badge.rb-info { background: rgba(88,101,242,0.1); color: var(--rb-blue-bright); border-color: rgba(88,101,242,0.2); }
    .rb-badge.rb-warn { background: rgba(255,170,0,0.1); color: #ffa500; border-color: rgba(255,170,0,0.2); }
    .rb-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; display: inline-block; }

    .rb-alert {
      padding: 13px 16px;
      border-radius: var(--rb-radius-sm);
      font-size: 13px;
      line-height: 1.6;
      font-family: var(--rb-font);
    }
    .rb-alert.rb-info { background: rgba(88,101,242,0.08); border: 1px solid rgba(88,101,242,0.2); color: #a0abff; }
    .rb-alert.rb-success { background: rgba(46,194,126,0.08); border: 1px solid rgba(46,194,126,0.2); color: #5de0a4; }
    .rb-alert.rb-danger { background: rgba(230,57,70,0.08); border: 1px solid rgba(230,57,70,0.2); color: #f08080; }
    .rb-alert.rb-warn { background: rgba(255,170,0,0.08); border: 1px solid rgba(255,170,0,0.2); color: #ffc859; }

    .rb-stat {
      background: var(--rb-surface);
      border: 1px solid var(--rb-border);
      border-radius: var(--rb-radius);
      padding: 20px 22px;
      font-family: var(--rb-font);
      position: relative;
      overflow: hidden;
    }
    .rb-stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rb-text-muted); margin-bottom: 8px; }
    .rb-stat-value { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; color: var(--rb-text); line-height: 1; margin-bottom: 6px; }
    .rb-stat-delta { font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; }
    .rb-stat-delta.up { color: var(--rb-green); }
    .rb-stat-delta.down { color: var(--rb-accent); }
    .rb-stat-desc { font-size: 12px; color: var(--rb-text-muted); margin-top: 4px; }

    .rb-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 56px;
      background: rgba(8,8,8,0.92);
      border-bottom: 1px solid var(--rb-border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(16px) saturate(150%);
      -webkit-backdrop-filter: blur(16px) saturate(150%);
      font-family: var(--rb-font);
    }
    .rb-nav-brand { font-weight: 800; font-size: 16px; letter-spacing: -0.03em; color: var(--rb-text); text-decoration: none; }
    .rb-nav-links { display: flex; gap: 2px; align-items: center; }
    .rb-nav-link { padding: 6px 12px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--rb-text-dim); cursor: pointer; transition: all var(--rb-transition); text-decoration: none; display: inline-flex; align-items: center; gap: 5px; }
    .rb-nav-link:hover { color: var(--rb-text); background: var(--rb-surface-2); }
    .rb-nav-link.active { color: var(--rb-text); background: var(--rb-surface-3); }

    .rb-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--rb-font); }
    .rb-table th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--rb-text-muted); border-bottom: 1px solid var(--rb-border); }
    .rb-table td { padding: 12px 14px; color: var(--rb-text); border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
    .rb-table tr:last-child td { border-bottom: none; }
    .rb-table tbody tr:hover td { background: var(--rb-surface-2); }

    .rb-code {
      background: var(--rb-surface-2);
      border: 1px solid var(--rb-border);
      border-radius: var(--rb-radius-sm);
      padding: 14px 16px;
      font-family: var(--rb-mono);
      font-size: 12px;
      color: #c9d1ff;
      white-space: pre-wrap;
      word-break: break-all;
      overflow-x: auto;
      line-height: 1.7;
    }

    .rb-progress { height: 5px; background: var(--rb-surface-3); border-radius: 999px; overflow: hidden; }
    .rb-progress-bar { height: 100%; background: var(--rb-accent); border-radius: 999px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1); background-image: linear-gradient(90deg, var(--rb-accent), var(--rb-accent-2)); }
    .rb-progress-bar.green { background: var(--rb-green); background-image: none; }
    .rb-progress-bar.blue { background: var(--rb-blue); background-image: none; }

    .rb-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--rb-surface-3); border: 1px solid var(--rb-border); display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--rb-text-dim); overflow: hidden; flex-shrink: 0; font-family: var(--rb-font); }
    .rb-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .rb-avatar.lg { width: 52px; height: 52px; font-size: 18px; }
    .rb-avatar.sm { width: 28px; height: 28px; font-size: 11px; }

    .rb-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; font-family: var(--rb-font); }
    .rb-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .rb-status.online .rb-status-dot { background: var(--rb-green); box-shadow: 0 0 7px var(--rb-green); animation: rbpulse 2s infinite; }
    .rb-status.offline .rb-status-dot { background: var(--rb-text-muted); }
    .rb-status.busy .rb-status-dot { background: var(--rb-accent); animation: rbpulse 1.5s infinite; }
    .rb-status.away .rb-status-dot { background: #ffa500; }
    @keyframes rbpulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

    .rb-spinner { width: 20px; height: 20px; border: 2px solid var(--rb-border); border-top-color: var(--rb-accent); border-radius: 50%; animation: rbspin 0.7s linear infinite; }
    .rb-spinner.lg { width: 32px; height: 32px; border-width: 3px; }
    .rb-spinner.sm { width: 14px; height: 14px; }
    @keyframes rbspin { to { transform: rotate(360deg); } }

    .rb-skeleton { background: linear-gradient(90deg, var(--rb-surface-2) 25%, var(--rb-surface-3) 50%, var(--rb-surface-2) 75%); background-size: 300% 100%; animation: rbskel 1.6s infinite; border-radius: var(--rb-radius-sm); }
    @keyframes rbskel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .rb-divider { height: 1px; background: var(--rb-border); margin: 20px 0; border: none; }
    .rb-divider.vertical { height: auto; width: 1px; margin: 0 16px; align-self: stretch; }

    .rb-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .rb-grid-2 { display: grid; gap: 16px; grid-template-columns: repeat(2, 1fr); }
    .rb-grid-3 { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
    .rb-grid-4 { display: grid; gap: 16px; grid-template-columns: repeat(4, 1fr); }

    .rb-row { display: flex; align-items: center; gap: 10px; }
    .rb-row.between { justify-content: space-between; }
    .rb-row.center { justify-content: center; }
    .rb-col { display: flex; flex-direction: column; gap: 8px; }
    .rb-section { padding: 20px 0; border-top: 1px solid var(--rb-border); }
    .rb-section:first-child { border-top: none; padding-top: 0; }

    .rb-anim { transition: all var(--rb-transition); }
    .rb-fade-in { animation: rbfade 0.28s ease forwards; }
    @keyframes rbfade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .rb-slide-in { animation: rbslide 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
    @keyframes rbslide { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
    .rb-pop-in { animation: rbpop 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    @keyframes rbpop { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }

    .rb-gradient-text { background: linear-gradient(135deg, var(--rb-accent), #ff8080); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 800; }
    .rb-gradient-text.green { background: linear-gradient(135deg, var(--rb-green), #7fffbf); }
    .rb-gradient-text.blue { background: linear-gradient(135deg, var(--rb-blue), var(--rb-blue-bright)); }

    .rb-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .rb-layout { display: flex; }
    .rb-dashboard { min-height: 100vh; background: var(--rb-bg); font-family: var(--rb-font); }
    .rb-sidebar { width: 220px; min-height: 100vh; background: var(--rb-surface); border-right: 1px solid var(--rb-border); padding: 20px 12px; flex-shrink: 0; }
    .rb-main { flex: 1; padding: 28px; min-width: 0; }

    .rb-tooltip { position: relative; }
    .rb-tooltip::after { content: attr(data-tip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: var(--rb-surface-2); color: var(--rb-text); font-size: 11px; padding: 5px 9px; border-radius: 6px; white-space: nowrap; border: 1px solid var(--rb-border-bright); pointer-events: none; opacity: 0; transition: opacity 0.15s; z-index: 999; font-family: var(--rb-font); box-shadow: var(--rb-shadow-md); }
    .rb-tooltip:hover::after { opacity: 1; }

    .rb-input, .rb-textarea { background: var(--rb-surface-2); border: 1px solid var(--rb-border); color: var(--rb-text); padding: 10px 14px; border-radius: 8px; font-family: var(--rb-font); font-size: 14px; outline: none; transition: border-color .15s, box-shadow .15s; width: 100%; }
    .rb-input:focus, .rb-textarea:focus { border-color: var(--rb-accent); box-shadow: 0 0 0 3px var(--rb-accent-glow); }
    .rb-textarea { min-height: 90px; resize: vertical; }

    .rb-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.72); display: none; align-items: center; justify-content: center; z-index: 99999; }
    .rb-modal.open { display: flex; }
    .rb-modal-box { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 14px; padding: 22px; width: 100%; max-width: 380px; box-shadow: var(--rb-shadow-lg); }
    .rb-modal-title { font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: -.02em; }
    .rb-modal-desc { color: var(--rb-text-dim); font-size: 13px; margin-bottom: 16px; }

    .rb-feedback-float { position: fixed; bottom: 24px; right: 24px; z-index: 99998; background: var(--rb-accent); color: #fff; border: none; border-radius: 999px; padding: 11px 16px; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 8px 30px rgba(230,57,70,0.35); cursor: pointer; transition: transform .15s, box-shadow .15s; }
    .rb-feedback-float:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(230,57,70,0.5); }

    .rb-feedback-form label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--rb-text-muted); display: block; margin: 10px 0 4px; }
    .rb-feedback-status { margin-top: 12px; font-size: 13px; padding: 8px 12px; border-radius: 6px; }
    .rb-feedback-status.ok { background: rgba(46,194,126,0.15); color: var(--rb-green); }
    .rb-feedback-status.err { background: rgba(230,57,70,0.12); color: var(--rb-accent); }

    @media (max-width: 768px) {
      .rb-grid-2, .rb-grid-3, .rb-grid-4 { grid-template-columns: 1fr; }
      .rb-sidebar { width: 100%; min-height: auto; border-right: none; border-bottom: 1px solid var(--rb-border); }
      .rb-layout { flex-direction: column; }
      .rb-main { padding: 16px; }
      .rb-nav { padding: 0 16px; }
      .rb-feedback-float { bottom: 16px; right: 16px; padding: 10px 14px; }
    }
  `;
  document.head.appendChild(style);

  function autoEnhance(root) {
    root = root || document;

    root.querySelectorAll('.rb-card, [data-rb-card]').forEach(function(el) {
      if (!el.classList.contains('rb-glass')) el.classList.add('rb-glass');
      if (!el.classList.contains('rb-hover')) el.classList.add('rb-hover');
      if (!el.classList.contains('rb-anim')) el.classList.add('rb-anim');
    });

    root.querySelectorAll('.rb-btn, [data-rb-btn]').forEach(function(el) {
      if (!el.classList.contains('rb-anim')) el.classList.add('rb-anim');
    });

    root.querySelectorAll('.rb-scope input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="range"]):not(.rb-input), .rb-scope textarea:not(.rb-textarea), .rb-scope select:not(.rb-select)').forEach(function(el) {
      el.classList.add('rb-input');
    });

    root.querySelectorAll('.rb-scope button:not(.rb-btn):not([data-no-rb])').forEach(function(el) {
      el.classList.add('rb-btn');
      if (!el.classList.contains('rb-secondary') && !el.classList.contains('rb-ghost')) {
        el.classList.add('rb-secondary');
      }
    });

    root.querySelectorAll('.rb-scope table:not(.rb-table)').forEach(function(el) {
      el.classList.add('rb-table');
    });

    root.querySelectorAll('[data-rb-card]').forEach(function(el) {
      el.classList.add('rb-card', 'rb-glass', 'rb-hover', 'rb-anim', 'rb-fade-in');
    });

    root.querySelectorAll('[data-rb-btn]').forEach(function(el) {
      el.classList.add('rb-btn', 'rb-anim');
    });

    root.querySelectorAll('[data-rb-badge]').forEach(function(el) {
      if (el.classList.contains('rb-badge')) return;
      el.classList.add('rb-badge');
      const type = el.getAttribute('data-rb-badge');
      if (type && type !== 'default') el.classList.add('rb-' + type);
    });

    root.querySelectorAll('[data-rb-input]').forEach(function(el) {
      el.classList.add('rb-input');
    });

    root.querySelectorAll('[data-rb-status]').forEach(function(el) {
      if (el.classList.contains('rb-status')) return;
      el.classList.add('rb-status');
      const type = el.getAttribute('data-rb-status');
      if (!el.querySelector('.rb-status-dot')) {
        const dot = document.createElement('span');
        dot.className = 'rb-status-dot';
        el.insertBefore(dot, el.firstChild);
      }
      if (type) el.classList.add(type);
    });

    root.querySelectorAll('[data-rb-progress]').forEach(function(el) {
      if (el.classList.contains('rb-progress')) return;
      el.classList.add('rb-progress');
      const bar = document.createElement('div');
      bar.className = 'rb-progress-bar';
      const val = parseFloat(el.getAttribute('data-rb-progress')) || 0;
      bar.style.width = Math.min(100, Math.max(0, val)) + '%';
      const color = el.getAttribute('data-rb-color');
      if (color) bar.classList.add(color);
      el.innerHTML = '';
      el.appendChild(bar);
    });

    root.querySelectorAll('[data-rb-skeleton]').forEach(function(el) {
      el.classList.add('rb-skeleton');
    });

    root.querySelectorAll('[data-rb-alert]').forEach(function(el) {
      if (el.classList.contains('rb-alert')) return;
      el.classList.add('rb-alert', 'rb-' + (el.getAttribute('data-rb-alert') || 'info'));
    });

    root.querySelectorAll('[data-rb-spinner]').forEach(function(el) {
      if (el.classList.contains('rb-spinner')) return;
      el.classList.add('rb-spinner');
      const size = el.getAttribute('data-rb-spinner');
      if (size && size !== 'default') el.classList.add(size);
    });
  }

  window.RebootUI = {
    version: '2.0.0',
    _inited: false,

    init: function(opts) {
      opts = opts || {};
      this._inited = true;
      if (opts.apiKey) { this._key = opts.apiKey; console.log('[RebootUI v2] Initialized with API key:', opts.apiKey.slice(0, 10) + (opts.apiKey.length > 10 ? '...' : '')); }

      if (opts.dark !== false) document.body.classList.add('rb-dark');
      if (opts.font) document.documentElement.style.setProperty('--rb-font', opts.font);
      if (opts.accent) document.documentElement.style.setProperty('--rb-accent', opts.accent);
      if (opts.bg) document.documentElement.style.setProperty('--rb-bg', opts.bg);
      if (opts.radius) document.documentElement.style.setProperty('--rb-radius', opts.radius);

      const root = opts.root
        ? (typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root)
        : document;

      autoEnhance(root);

      if (opts.watch !== false) {
        let scheduled = false;
        const obs = new MutationObserver(function() {
          if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(function() {
              scheduled = false;
              autoEnhance(root);
            });
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }

      if (opts.feedback) {
        const fb = document.createElement('button');
        fb.className = 'rb-feedback-float';
        fb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Feedback';
        fb.onclick = function(){ window.RebootUI.showFeedback(); };
        document.body.appendChild(fb);
      }

      console.log('[RebootUI v2] Auto styles applied — dashboards, cards, and UI enhanced.');
      return this;
    },

    enhance: function(root) {
      autoEnhance(root ? (typeof root === 'string' ? document.querySelector(root) : root) : document);
      return this;
    },

    createCard: function(config) {
      config = config || {};
      const c = document.createElement('div');
      c.className = 'rb-card rb-glass rb-hover rb-anim rb-fade-in';

      let html = '';
      if (config.icon) html += '<div style="font-size:22px;margin-bottom:10px;line-height:1">' + config.icon + '</div>';
      html += '<div style="font-size:15px;font-weight:800;letter-spacing:-0.02em;margin-bottom:6px;color:var(--rb-text)">' + (config.title || 'Card') + '</div>';
      if (config.description) html += '<p class="rb-desc" style="margin:0;color:var(--rb-text-dim);font-size:13px;line-height:1.65">' + config.description + '</p>';
      if (config.badge) {
        const bt = config.badgeType || 'success';
        html += '<div style="margin-top:12px"><span class="rb-badge rb-' + bt + '">' + config.badge + '</span></div>';
      }
      if (config.stat) {
        html += '<div style="margin-top:14px;font-size:28px;font-weight:800;letter-spacing:-0.04em;color:var(--rb-text)">' + config.stat + '</div>';
      }
      if (config.footer) {
        html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--rb-border);font-size:12px;color:var(--rb-text-muted)">' + config.footer + '</div>';
      }
      if (config.actions && config.actions.length) {
        html += '<div class="rb-row" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--rb-border);gap:8px">';
        config.actions.forEach(function(a) {
          const cls = 'rb-btn rb-sm' + (a.type ? ' rb-' + a.type : '');
          html += '<button class="' + cls + '">' + a.label + '</button>';
        });
        html += '</div>';
      }

      c.innerHTML = html;
      return c;
    },

    createStat: function(config) {
      config = config || {};
      const c = document.createElement('div');
      c.className = 'rb-stat rb-anim rb-fade-in';
      const deltaHtml = config.delta != null
        ? '<div class="rb-stat-delta ' + (config.delta >= 0 ? 'up' : 'down') + '">' + (config.delta >= 0 ? '↑' : '↓') + ' ' + Math.abs(config.delta) + '% vs last period</div>'
        : '';
      c.innerHTML = '<div class="rb-stat-label">' + (config.label || 'Metric') + '</div>' +
        '<div class="rb-stat-value">' + (config.value !== undefined ? config.value : '—') + '</div>' +
        deltaHtml +
        (config.desc ? '<div class="rb-stat-desc">' + config.desc + '</div>' : '');
      return c;
    },

    createNav: function(config) {
      config = config || {};
      const nav = document.createElement('nav');
      nav.className = 'rb-nav rb-fade-in';
      const links = (config.links || []).map(function(l) {
        return '<a class="rb-nav-link' + (l.active ? ' active' : '') + '" href="' + (l.href || '#') + '">' + l.label + '</a>';
      }).join('');
      const right = config.right || '';
      nav.innerHTML = '<span class="rb-nav-brand">' + (config.brand || 'App') + '</span>' +
        '<div class="rb-nav-links">' + links + '</div>' +
        (right ? '<div>' + right + '</div>' : '');
      return nav;
    },

    createBadge: function(label, type) {
      const b = document.createElement('span');
      b.className = 'rb-badge' + (type ? ' rb-' + type : '');
      b.textContent = label;
      return b;
    },

    createAlert: function(message, type) {
      const a = document.createElement('div');
      a.className = 'rb-alert rb-' + (type || 'info') + ' rb-fade-in';
      a.textContent = message;
      return a;
    },

    createProgress: function(value, opts) {
      if (typeof opts === 'string') opts = { color: opts };
      opts = opts || {};
      const wrap = document.createElement('div');
      wrap.className = 'rb-progress';
      const bar = document.createElement('div');
      bar.className = 'rb-progress-bar' + (opts.color ? ' ' + opts.color : '');
      bar.style.width = Math.min(100, Math.max(0, value)) + '%';
      wrap.appendChild(bar);
      if (opts.label) {
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:11px;color:var(--rb-text-muted);margin-top:5px;font-family:var(--rb-font)';
        lbl.textContent = opts.label;
        const w = document.createElement('div');
        w.appendChild(wrap);
        w.appendChild(lbl);
        return w;
      }
      return wrap;
    },

    createSpinner: function(size) {
      const s = document.createElement('div');
      s.className = 'rb-spinner' + (size ? ' ' + size : '');
      return s;
    },

    createAvatar: function(config) {
      config = config || {};
      const a = document.createElement('div');
      a.className = 'rb-avatar' + (config.size ? ' ' + config.size : '');
      if (config.src) {
        a.innerHTML = '<img src="' + config.src + '" alt="' + (config.alt || '') + '">';
      } else {
        a.textContent = (config.initials || config.label || '?').slice(0, 2).toUpperCase();
      }
      if (config.color) a.style.background = config.color;
      return a;
    },

    page: function(opts) {
      opts = opts || {};
      if (opts.dark !== false) document.body.classList.add('rb-dark');
      if (opts.glass) document.body.classList.add('rb-glass-bg');
      if (opts.accent) document.documentElement.style.setProperty('--rb-accent', opts.accent);
      if (opts.font) document.documentElement.style.setProperty('--rb-font', opts.font);
      if (opts.radius) document.documentElement.style.setProperty('--rb-radius', opts.radius);
      if (opts.root) {
        const r = typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root;
        autoEnhance(r);
      }
      return this;
    },

    setTheme: function(vars) {
      Object.keys(vars || {}).forEach(function(k) {
        document.documentElement.style.setProperty('--rb-' + k, vars[k]);
      });
      return this;
    },

    submitFeedback: function(data) {
      const key = (window.RebootUI && window.RebootUI._key) || '';
      if (!key) return Promise.resolve({ success: false, message: 'No API key' });
      return fetch('https://rebootcord.world/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': key },
        body: JSON.stringify(data || {})
      }).then(function(r){ return r.json(); }).catch(function(){ return { success: false }; });
    },

    showFeedback: function(opts) {
      opts = opts || {};
      const key = (window.RebootUI && window.RebootUI._key) || '';
      const modal = document.createElement('div');
      modal.className = 'rb-modal rb-feedback-modal';
      modal.innerHTML = '<div class="rb-modal-box rb-feedback-form">' +
        '<div class="rb-modal-title">Send feedback</div>' +
        '<div class="rb-modal-desc">Your suggestions help improve the experience.</div>' +
        '<label>Type</label>' +
        '<select class="rb-input" id="fb-type"><option value="suggestion">Suggestion</option><option value="bug">Bug report</option><option value="other">Other</option></select>' +
        '<label>Message</label>' +
        '<textarea class="rb-textarea" id="fb-msg" placeholder="What would you like to share?"></textarea>' +
        '<label>Email (optional)</label>' +
        '<input class="rb-input" id="fb-email" placeholder="you@domain.com" />' +
        '<div style="display:flex;gap:8px;margin-top:16px">' +
        '<button class="rb-btn rb-secondary" id="fb-cancel">Cancel</button>' +
        '<button class="rb-btn" id="fb-send">Send</button>' +
        '</div>' +
        '<div id="fb-status" class="rb-feedback-status" style="display:none"></div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.classList.add('open');
      const status = modal.querySelector('#fb-status');
      modal.querySelector('#fb-cancel').onclick = function(){ modal.remove(); };
      modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
      modal.querySelector('#fb-send').onclick = function(){
        const payload = {
          type: modal.querySelector('#fb-type').value,
          message: modal.querySelector('#fb-msg').value,
          email: modal.querySelector('#fb-email').value,
          page: location.pathname
        };
        if (!payload.message || payload.message.trim().length < 3) { status.style.display='block'; status.className='rb-feedback-status err'; status.textContent='Message too short'; return; }
        status.style.display='block'; status.className='rb-feedback-status'; status.textContent='Sending...';
        window.RebootUI.submitFeedback(payload).then(function(res){
          if (res && res.success) {
            status.className='rb-feedback-status ok'; status.textContent='Thanks! Feedback received.';
            setTimeout(function(){ modal.remove(); }, 900);
          } else {
            status.className='rb-feedback-status err'; status.textContent='Failed to send.';
          }
        });
      };
      return modal;
    }
  };

  const doInit = function() {
    if (window.RebootUI && !window.RebootUI._inited) {
      if (document.currentScript && document.currentScript.dataset.autoinit === 'false') return;
      window.RebootUI.init({});
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doInit);
  } else {
    doInit();
  }
})();
