(function() {
  if (window.RebootUI) return;
  const style = document.createElement('style');
  style.textContent = `
    :root { --rb-font: 'Syne', system-ui, sans-serif; --rb-bg: #080808; --rb-surface: #0f0f0f; --rb-border: #2d2d2d; --rb-text: #f4f4f4; --rb-accent: #e63946; }
    body { font-family: var(--rb-font); background: var(--rb-bg); color: var(--rb-text); margin:0; }
    .rb-card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 12px; padding: 16px; color: var(--rb-text); transition: transform .2s, box-shadow .2s; }
    .rb-glass { background: rgba(255,255,255,0.06); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
    .rb-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
    .rb-btn { background: var(--rb-accent); color: white; padding: 10px 18px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: .15s; display: inline-flex; align-items: center; gap: 6px; }
    .rb-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
    .rb-input, .rb-textarea { background: var(--rb-surface); border: 1px solid var(--rb-border); color: var(--rb-text); padding: 10px; border-radius: 8px; font-family: inherit; width: 100%; box-sizing: border-box; }
    .rb-input:focus, .rb-textarea:focus { border-color: var(--rb-accent); outline: none; }
    .rb-dashboard { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .rb-loading { position: relative; }
    .rb-loading::after { content: ''; position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 3px solid var(--rb-border); border-top-color: var(--rb-accent); border-radius: 50%; animation: rbspin 1s linear infinite; }
    @keyframes rbspin { to { transform: rotate(360deg); } }
    .rb-dark { background: var(--rb-bg); color: var(--rb-text); }
    .rb-anim { transition: all .3s cubic-bezier(0.4,0,0.2,1); }
    .rb-gradient { background: linear-gradient(135deg, #e63946, #ff8a80); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  `;
  document.head.appendChild(style);

  function autoEnhance() {
    document.querySelectorAll('button:not(.rb-btn)').forEach(el => el.classList.add('rb-btn', 'rb-anim'));
    document.querySelectorAll('div[class*="card"], div[class*="user-card"], .dashboard, [class*="panel"]').forEach(el => {
      if (!el.classList.contains('rb-card')) {
        el.classList.add('rb-card', 'rb-glass', 'rb-hover', 'rb-anim');
      }
    });
    document.querySelectorAll('input:not(.rb-input), textarea:not(.rb-textarea), select').forEach(el => el.classList.add('rb-input'));
  }

  window.RebootUI = {
    init: function(opts) {
      if (opts && opts.apiKey) {
        console.log('[RebootUI] Initialized with API key');
      }
      document.body.classList.add('rb-dark');
      autoEnhance();
      // Apply modern fonts etc already in css
      const obs = new MutationObserver(autoEnhance);
      obs.observe(document.body, {childList: true, subtree: true});
      console.log('[RebootUI] Auto styles applied. Dashboards and UI enhanced.');
    },
    createCard: function(config) {
      const c = document.createElement('div');
      c.className = 'rb-card rb-glass rb-hover rb-anim';
      c.innerHTML = `
        <div style="font-weight:700; font-size:15px; margin-bottom:6px;">${config.title || 'Card'}</div>
        <div style="color:#aaa; font-size:13px;">${config.description || ''}</div>
        ${config.aesthetic ? '<div style="margin-top:8px; font-size:11px; opacity:.7;">✨ Polished</div>' : ''}
      `;
      return c;
    },
    page: function(opts) {
      if (opts && opts.theme) document.body.dataset.rbTheme = opts.theme;
      if (opts && opts.glass) document.body.classList.add('rb-glass-bg');
      if (opts && opts.animations !== false) document.body.classList.add('rb-anim');
      console.log('[RebootUI] Page configured:', opts);
    }
  };

  // Auto init if script loaded with data
  if (document.currentScript && document.currentScript.dataset.autoinit !== 'false') {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RebootUI && !window.RebootUI._inited) {
        window.RebootUI.init({});
        window.RebootUI._inited = true;
      }
    });
  }
})();
