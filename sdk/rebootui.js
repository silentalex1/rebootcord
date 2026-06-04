(function() {
  if (window.RebootUI) return;
  const style = document.createElement('style');
  style.textContent = `
    :root { --rb-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; --rb-bg: #0a0a0a; --rb-surface: #111113; --rb-border: #252529; --rb-text: #f5f5f7; --rb-text-dim: #a1a1aa; --rb-accent: #e63946; --rb-accent-2: #ff4d57; }
    .rb-dark, .rb-scope { font-family: var(--rb-font); color: var(--rb-text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
    .rb-card { background: var(--rb-surface); border: 1px solid var(--rb-border); border-radius: 10px; padding: 18px 20px; color: var(--rb-text); box-shadow: 0 1px 2px rgba(0,0,0,0.25); transition: border-color .15s, box-shadow .15s; }
    .rb-glass { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05); }
    .rb-hover:hover { border-color: #3a3a3e; box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    .rb-btn { background: var(--rb-accent); color: #fff; padding: 9px 16px; border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: background .1s, transform .1s; display: inline-flex; align-items: center; gap: 6px; }
    .rb-btn:hover { background: var(--rb-accent-2); }
    .rb-btn:active { transform: translateY(1px); }
    .rb-btn.rb-secondary { background: transparent; color: var(--rb-text); border: 1px solid var(--rb-border); }
    .rb-btn.rb-secondary:hover { background: #1a1a1d; border-color: #333; }
    .rb-input, .rb-textarea, .rb-select { background: #0c0c0e; border: 1px solid var(--rb-border); color: var(--rb-text); padding: 10px 12px; border-radius: 8px; font-family: inherit; width: 100%; box-sizing: border-box; font-size: 13px; }
    .rb-input:focus, .rb-textarea:focus, .rb-select:focus { border-color: var(--rb-accent); outline: none; box-shadow: 0 0 0 3px rgba(230,57,70,0.12); }
    .rb-dashboard { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .rb-loading { position: relative; }
    .rb-loading::after { content: ''; position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; border: 2px solid var(--rb-border); border-top-color: var(--rb-accent); border-radius: 50%; animation: rbspin 0.9s linear infinite; }
    @keyframes rbspin { to { transform: rotate(360deg); } }
    .rb-dark { background: var(--rb-bg); color: var(--rb-text); }
    .rb-anim { transition: all .2s cubic-bezier(0.4,0,0.2,1); }
    .rb-gradient { background: linear-gradient(135deg, var(--rb-accent), var(--rb-accent-2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 600; }
    .rb-card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: var(--rb-text); }
    .rb-card p, .rb-card .rb-desc { margin: 0; color: var(--rb-text-dim); font-size: 13px; }
    .rb-row { display: flex; gap: 10px; align-items: center; }
    .rb-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #1f1f23; color: var(--rb-text-dim); }
    .rb-section { padding: 14px 0; border-top: 1px solid var(--rb-border); }
    .rb-section:first-child { border-top: none; padding-top: 0; }
    .rb-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .rb-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .rb-btn:focus { outline: 2px solid #fff3; outline-offset: 2px; }
    .rb-card + .rb-card { margin-top: 12px; }
  `;
  document.head.appendChild(style);

  function autoEnhance(root) {
    root = root || document;
    root.querySelectorAll('.rb-scope .rb-btn, .rb-btn, [data-rb-btn]').forEach(el => { if (!el.classList.contains('rb-anim')) el.classList.add('rb-anim'); });
    root.querySelectorAll('.rb-scope .rb-card, .rb-card, [data-rb-card]').forEach(el => {
      if (!el.classList.contains('rb-glass')) el.classList.add('rb-glass', 'rb-anim');
      if (!el.classList.contains('rb-hover') && el.classList.contains('rb-card')) el.classList.add('rb-hover');
    });
    root.querySelectorAll('.rb-scope input:not(.rb-input), .rb-scope textarea:not(.rb-textarea), .rb-scope select, [data-rb-input]').forEach(el => el.classList.add('rb-input'));
  }

  window.RebootUI = {
    init: function(opts) {
      opts = opts || {};
      if (opts.apiKey) {
        console.log('[RebootUI] Initialized with API key');
      }
      document.body.classList.add('rb-dark');
      const root = opts.root ? (typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root) : document;
      autoEnhance(root);
      const obs = new MutationObserver(function() { autoEnhance(root); });
      obs.observe(document.body, {childList: true, subtree: true});
      console.log('[RebootUI] Auto styles applied. Dashboards and UI enhanced.');
    },
    enhance: function(root) {
      autoEnhance(root || document);
    },
    createCard: function(config) {
      config = config || {};
      const c = document.createElement('div');
      c.className = 'rb-card rb-glass rb-anim';
      if (config.hover !== false) c.classList.add('rb-hover');
      let html = '<h3>' + (config.title || 'Card') + '</h3>';
      if (config.description) html += '<p class="rb-desc">' + config.description + '</p>';
      if (config.badge) html += '<span class="rb-badge" style="margin-top:8px;display:inline-block">' + config.badge + '</span>';
      if (config.footer) html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--rb-border);font-size:12px;color:var(--rb-text-dim)">' + config.footer + '</div>';
      c.innerHTML = html;
      return c;
    },
    page: function(opts) {
      opts = opts || {};
      if (opts.theme) document.body.dataset.rbTheme = opts.theme;
      if (opts.glass) document.body.classList.add('rb-glass-bg');
      if (opts.animations !== false) document.body.classList.add('rb-anim');
      if (opts.dark !== false) document.body.classList.add('rb-dark');
      if (opts.root) autoEnhance(opts.root);
    }
  };

  if (document.currentScript && document.currentScript.dataset.autoinit !== 'false') {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RebootUI && !window.RebootUI._inited) {
        window.RebootUI.init({});
        window.RebootUI._inited = true;
      }
    });
  }
})();
