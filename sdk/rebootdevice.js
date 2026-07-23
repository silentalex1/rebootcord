(function() {
  if (window.RebootDevice) return;

  var STYLE_ID = 'rc-device-style';
  var STORE_KEY = 'rc_device_detected_type';
  var REFRESH_KEY = 'rc_device_refreshed';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.rc-device-banner{position:fixed;top:18px;left:50%;transform:translate(-50%,-140%);' +
      'z-index:2147483000;display:flex;align-items:center;gap:12px;padding:12px 18px;' +
      'border-radius:12px;background:linear-gradient(135deg,#123420,#0d2318);' +
      'border:1px solid #1f5c38;box-shadow:0 12px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(46,194,126,0.15);' +
      'font-family:"IBM Plex Mono","Courier New",monospace;color:#e9fff2;font-size:13px;' +
      'transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .4s ease;opacity:0;max-width:92vw;' +
      'pointer-events:auto;box-sizing:border-box;}' +
      '.rc-device-banner.rc-show{transform:translate(-50%,0);opacity:1;}' +
      '.rc-device-banner.rc-hide{transform:translate(-50%,-140%);opacity:0;}' +
      '.rc-device-dot{width:8px;height:8px;border-radius:50%;background:#2ec27e;flex:0 0 auto;' +
      'box-shadow:0 0 0 3px rgba(46,194,126,0.18);animation:rc-pulse 1.4s ease-in-out infinite;}' +
      '@keyframes rc-pulse{0%,100%{opacity:1;}50%{opacity:.35;}}' +
      '.rc-device-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .25s ease;max-width:60vw;}' +
      '.rc-device-text.rc-fade{opacity:0;}' +
      '.rc-device-track{width:64px;height:4px;border-radius:3px;background:rgba(46,194,126,0.18);' +
      'overflow:hidden;flex:0 0 auto;}' +
      '.rc-device-bar{height:100%;width:40%;border-radius:3px;background:#2ec27e;' +
      'animation:rc-load 1.1s ease-in-out infinite;}' +
      '@keyframes rc-load{0%{transform:translateX(-100%);}100%{transform:translateX(260%);}}' +
      '.rc-device-refresh{flex:0 0 auto;border:1px solid #2ec27e;background:rgba(46,194,126,0.12);' +
      'color:#e9fff2;font-family:inherit;font-size:12px;padding:5px 10px;border-radius:8px;' +
      'cursor:pointer;transition:background .15s ease;}' +
      '.rc-device-refresh:hover{background:rgba(46,194,126,0.24);}' +
      '@media (max-width:520px){.rc-device-banner{left:12px;right:12px;transform:translateY(-140%);' +
      'max-width:none;}.rc-device-banner.rc-show{transform:translateY(0);}' +
      '.rc-device-banner.rc-hide{transform:translateY(-140%);}.rc-device-text{max-width:50vw;}}';
    document.head.appendChild(style);
  }

  function getUAData() {
    try {
      if (navigator.userAgentData) return navigator.userAgentData;
    } catch (e) {}
    return null;
  }

  function detectClientSide() {
    var ua = (navigator.userAgent || '').toLowerCase();
    var uaData = getUAData();
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || (navigator.msMaxTouchPoints || 0) > 0;
    var coarsePointer = false;
    try { coarsePointer = window.matchMedia && window.matchMedia('(pointer:coarse)').matches; } catch (e) {}
    var noHover = false;
    try { noHover = window.matchMedia && window.matchMedia('(hover:none)').matches; } catch (e) {}
    var w = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    var h = window.screen && window.screen.height ? window.screen.height : window.innerHeight;
    var minSide = Math.min(w || 0, h || 0);
    var maxSide = Math.max(w || 0, h || 0);
    var type = 'desktop';

    if (uaData && typeof uaData.mobile === 'boolean' && uaData.mobile) {
      type = maxSide >= 900 ? 'tablet' : 'mobile';
    } else if (/ipad/.test(ua) || (/macintosh/.test(ua) && (touch || coarsePointer))) {
      type = 'tablet';
    } else if (/tablet|kindle|silk|playbook|nexus 7|nexus 9|nexus 10/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) {
      type = 'tablet';
    } else if (/android/.test(ua) && /mobile/.test(ua)) {
      type = (minSide && minSide >= 600) ? 'tablet' : 'mobile';
    } else if (/mobi|iphone|ipod|windows phone|blackberry|iemobile|opera mini|fennec/.test(ua)) {
      type = 'mobile';
    } else if (/smart-tv|smarttv|googletv|appletv|hbbtv|netcast|viera|tizen.*tv|web0s|crkey|roku/.test(ua)) {
      type = 'tv';
    } else if (/xbox|playstation|nintendo/.test(ua)) {
      type = 'console';
    } else if (/bot|crawl|spider|slurp|bingpreview|headless|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|ahrefsbot|semrushbot|mj12bot|pingdom|uptimerobot|linkedinbot|embedly|quora link preview|vkshare|w3c_validator/.test(ua)) {
      type = 'bot';
    } else {
      type = 'desktop';
    }

    if (type === 'desktop' && (touch || coarsePointer || noHover)) {
      if (minSide && minSide < 640) type = 'mobile';
      else if (minSide && minSide < 1180) type = 'tablet';
    }

    var os = 'unknown';
    if (uaData && uaData.platform) {
      var plat = String(uaData.platform).toLowerCase();
      if (plat.indexOf('win') !== -1) os = 'windows';
      else if (plat.indexOf('mac') !== -1) os = 'macos';
      else if (plat.indexOf('android') !== -1) os = 'android';
      else if (plat.indexOf('chrome') !== -1) os = 'chromeos';
      else if (plat.indexOf('linux') !== -1) os = 'linux';
    }
    if (os === 'unknown') {
      if (/windows nt/.test(ua)) os = 'windows';
      else if (/mac os x|macintosh/.test(ua)) os = 'macos';
      else if (/android/.test(ua)) os = 'android';
      else if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
      else if (/cros/.test(ua)) os = 'chromeos';
      else if (/linux/.test(ua)) os = 'linux';
    }
    if (os === 'macos' && (touch || coarsePointer) && type !== 'desktop') os = 'ios';

    var brandNames = [];
    if (uaData && Array.isArray(uaData.brands)) {
      brandNames = uaData.brands.map(function(b) { return (b.brand || '').toLowerCase(); });
    }
    function hasBrand(name) { return brandNames.some(function(b) { return b.indexOf(name) !== -1; }); }

    var browser = 'unknown';
    if (hasBrand('microsoft edge') || /edg\//.test(ua)) browser = 'edge';
    else if (/samsungbrowser/.test(ua)) browser = 'samsung';
    else if (/ucbrowser/.test(ua)) browser = 'uc';
    else if (hasBrand('brave') || /brave\//.test(ua)) browser = 'brave';
    else if (hasBrand('vivaldi') || /vivaldi/.test(ua)) browser = 'vivaldi';
    else if (hasBrand('opera') || /opr\/|opera/.test(ua)) browser = 'opera';
    else if (/crios/.test(ua)) browser = 'chrome';
    else if (hasBrand('google chrome') || hasBrand('chromium') || /chrome\//.test(ua)) browser = 'chrome';
    else if (/fxios|firefox/.test(ua)) browser = 'firefox';
    else if (/safari/.test(ua)) browser = 'safari';

    return { type: type, os: os, browser: browser, touch: touch, screenWidth: w || 0, screenHeight: h || 0 };
  }

  function verifyWithServer(apiKey, clientInfo, cb) {
    var base = (window.RebootDevice && window.RebootDevice._base) || 'https://rebootcord.world';
    var qs = '?touch=' + (clientInfo.touch ? '1' : '0') + '&mtp=' + (navigator.maxTouchPoints || 0) + '&w=' + (clientInfo.screenWidth || 0);
    if (typeof fetch !== 'function') { cb(clientInfo); return; }
    fetch(base + '/api/v1/device' + qs, { headers: { 'Authorization': apiKey } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.success) cb({ type: data.type, os: data.os, browser: data.browser });
        else cb(clientInfo);
      })
      .catch(function() { cb(clientInfo); });
  }

  function applyDeviceClass(root, type) {
    var el = root || document.documentElement;
    if (!el) return;
    ['rc-device-mobile', 'rc-device-tablet', 'rc-device-desktop', 'rc-device-tv', 'rc-device-console', 'rc-device-bot'].forEach(function(c) {
      el.classList.remove(c);
    });
    el.classList.add('rc-device-' + type);
    el.setAttribute('data-rc-device', type);
  }

  function label(type) {
    var map = { mobile: 'mobile', tablet: 'tablet', desktop: 'desktop', tv: 'TV', console: 'game console', bot: 'a bot/crawler' };
    return map[type] || type;
  }

  function showBanner(opts, info) {
    try {
      injectStyles();
      var mount = (opts && opts.mount) || document.body;
      if (!mount) return null;

      var banner = document.createElement('div');
      banner.className = 'rc-device-banner';
      var dot = document.createElement('div');
      dot.className = 'rc-device-dot';
      var text = document.createElement('div');
      text.className = 'rc-device-text';
      text.textContent = 'Detecting user device type';
      var track = document.createElement('div');
      track.className = 'rc-device-track';
      var bar = document.createElement('div');
      bar.className = 'rc-device-bar';
      track.appendChild(bar);

      banner.appendChild(dot);
      banner.appendChild(text);
      banner.appendChild(track);
      mount.appendChild(banner);

      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          if (banner.parentNode) banner.classList.add('rc-show');
        });
      });

      var timers = [];
      function swapText(newText) {
        text.classList.add('rc-fade');
        timers.push(setTimeout(function() {
          text.textContent = newText;
          text.classList.remove('rc-fade');
        }, 260));
      }

      var refreshed = false;
      function doRefreshOnce() {
        if (refreshed) return;
        refreshed = true;
        try { sessionStorage.setItem(STORE_KEY, info.type); sessionStorage.setItem(REFRESH_KEY, '1'); } catch (e) {}
        location.reload();
      }

      timers.push(setTimeout(function() {
        if (!banner.parentNode) return;
        swapText('User is on ' + label(info.type));
      }, 900));

      timers.push(setTimeout(function() {
        if (!banner.parentNode) return;
        swapText('Now refresh the page so it fits for ' + label(info.type) + '.');
        if (track.parentNode) track.parentNode.removeChild(track);
        var refreshBtn = document.createElement('button');
        refreshBtn.className = 'rc-device-refresh';
        refreshBtn.textContent = 'Refresh';
        refreshBtn.onclick = doRefreshOnce;
        banner.appendChild(refreshBtn);

        var alreadyRefreshed = false;
        try { alreadyRefreshed = sessionStorage.getItem(REFRESH_KEY) === '1'; } catch (e) {}
        if (opts.autoRefresh !== false && !alreadyRefreshed) {
          timers.push(setTimeout(doRefreshOnce, 2600));
        }
      }, 2000));

      if (typeof opts.onDetected === 'function') {
        timers.push(setTimeout(function() { opts.onDetected(info); }, 900));
      }

      banner._rcTimers = timers;
      return banner;
    } catch (e) {
      if (typeof opts.onDetected === 'function') {
        try { opts.onDetected(info); } catch (e2) {}
      }
      return null;
    }
  }

  function hideBanner(banner) {
    if (!banner) return;
    if (banner._rcTimers) banner._rcTimers.forEach(function(t) { clearTimeout(t); });
    banner.classList.remove('rc-show');
    banner.classList.add('rc-hide');
    setTimeout(function() { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 500);
  }

  var currentInfo = null;
  var currentBanner = null;
  var resizeTimer = null;

  var RebootDevice = {
    _base: 'https://rebootcord.world',
    init: function(opts) {
      opts = opts || {};
      var clientInfo = detectClientSide();
      var applyRoot;
      try { applyRoot = opts.root ? document.querySelector(opts.root) : document.documentElement; } catch (e) { applyRoot = document.documentElement; }

      var finish = function(info) {
        currentInfo = info;
        applyDeviceClass(applyRoot, info.type);
        var stored = null;
        var alreadyRefreshed = false;
        try {
          stored = sessionStorage.getItem(STORE_KEY);
          alreadyRefreshed = sessionStorage.getItem(REFRESH_KEY) === '1';
        } catch (e) {}
        var alreadyKnown = stored === info.type && alreadyRefreshed;
        if (!opts.silent && !alreadyKnown) {
          var run = function() { currentBanner = showBanner(opts, info); };
          if (document.body) run();
          else document.addEventListener('DOMContentLoaded', run, { once: true });
        } else if (typeof opts.onDetected === 'function') {
          opts.onDetected(info);
        }
      };

      var run = function() {
        if (opts.apiKey) verifyWithServer(opts.apiKey, clientInfo, finish);
        else finish(clientInfo);
      };
      if (document.body || document.readyState !== 'loading') run();
      else document.addEventListener('DOMContentLoaded', run, { once: true });

      if (opts.watchResize !== false) {
        window.addEventListener('resize', function() {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function() {
            var info = detectClientSide();
            if (!currentInfo || info.type !== currentInfo.type) {
              currentInfo = info;
              applyDeviceClass(applyRoot, info.type);
              if (typeof opts.onDetected === 'function') opts.onDetected(info);
            }
          }, 250);
        }, { passive: true });
      }
    },
    getDevice: function() { return currentInfo; },
    detect: detectClientSide,
    hide: function() { hideBanner(currentBanner); currentBanner = null; }
  };

  window.RebootDevice = RebootDevice;
})();
