/* =========================================================
   AXION AI — State: settings storage + theme/language
   ========================================================= */
window.AXION = window.AXION || {};

AXION.DEFAULT_SETTINGS = {
  theme: 'dark',            // dark | light
  lang: 'en',               // en | id
  provider: 'google',       // active provider id
  model: 'gemini-2.5-flash',
  thinking: 'medium',       // off|low|medium|high
  enterMode: 'auto',        // auto | send | newline
  gitProvider: 'github',    // github | gitlab | gitea | custom
  gitUsername: '',
  gitBaseUrl: '',           // for custom/gitea
  gitPermission: 'medium',  // low | medium | high
  gitAutoRefresh: true,
  gitRefreshInterval: 300000, // milliseconds; 5 minutes by default
  knowledgeSynced: false,
  allowGps: false,
  tempChat: false,            // temporary chat: toggled from the chat page, session-only (always OFF on load)
  maxIterations: 100, // safety guard only; agent runs until done
  maxOutputTokens: 16384, // per-request output cap
  maxTokens: 32768, // approximate maximum context budget; input token counting is an estimate
  autoContinue: false,
  searchBase: 'https://axion-search.axn.cc.cd',
  searchTimeout: 30000,
  customProviders: [],
  customProviderModels: {},
  customInstructions: '',
  customModel: '',          // per-provider custom model id
  workspaceEnabled: false,  // Local-only workspace + Actions; no remote repository mirroring
  workspaceRepo: '',        // deprecated; always local-only, never mirrored
  workspaceAlways: false,   // v2.6: always-on workspace — AI runs code/search inside it
};

AXION.loadSettings = () => {
  try {
    const raw = localStorage.getItem('axion_settings');
    const s = raw ? JSON.parse(raw) : {};
    AXION.settings = Object.assign({}, AXION.DEFAULT_SETTINGS, s);
    // Workspace storage is local-only; discard stale remote mirror configuration.
    AXION.settings.workspaceRepo = '';
  } catch (e) {
    AXION.settings = Object.assign({}, AXION.DEFAULT_SETTINGS);
  }
  return AXION.settings;
};

AXION.saveSettings = () => {
  localStorage.setItem('axion_settings', JSON.stringify(AXION.settings));
};

AXION.applyTheme = () => {
  const theme = (AXION.settings && AXION.settings.theme) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
};

AXION.setTheme = (t) => { AXION.settings.theme = t === 'light' ? 'light' : 'dark'; AXION.saveSettings(); AXION.applyTheme(); }; 
AXION.setLang = (l) => { AXION.settings.lang = l === 'id' ? 'id' : 'en'; AXION.saveSettings(); AXION.applyI18n && AXION.applyI18n(); document.documentElement.lang = AXION.settings.lang; };

/* Screen-size detection (point 2) */
AXION.screenInfo = () => {
  const w = window.innerWidth, h = window.innerHeight;
  let category = 'desktop';
  if (w < 640) category = 'mobile';
  else if (w < 1024) category = 'tablet';
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  return { width: w, height: h, category, touch, pixelRatio: window.devicePixelRatio || 1 };
};

/* Enter-key behavior: auto-detect mobile/touch -> newline; desktop -> send (point 1) */
AXION.enterShouldSend = () => {
  const mode = (AXION.settings && AXION.settings.enterMode) || 'auto';
  if (mode === 'send') return true;
  if (mode === 'newline') return false;
  // auto: touch/mobile => newline; desktop => send
  return !AXION.screenInfo().touch;
};

AXION.isMobile = () => AXION.screenInfo().category === 'mobile' || AXION.screenInfo().touch;

/* Generic in-page confirm dialog (window.confirm is blocked in many mobile browsers/PWAs).
   AXION.ui.confirm(title, message, detail?) -> Promise<boolean> */
AXION.ui = AXION.ui || {};
AXION.ui.confirm = (title, message, detail, labels) => new Promise((resolve) => {
  if (!document.body) { resolve(window.confirm(message || title)); return; }
  const wrap = document.createElement('div');
  wrap.className = 'axion-modal-wrap';
  wrap.innerHTML = `<div class="axion-modal" role="dialog" aria-modal="true">
    <h3></h3><p class="axion-modal-msg"></p><pre class="axion-modal-detail"></pre>
    <div class="axion-modal-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-r="no"></button>
      <button type="button" class="btn btn-sm" data-r="yes"></button>
    </div></div>`;
  wrap.querySelector('h3').textContent = title || '';
  wrap.querySelector('.axion-modal-msg').textContent = message || '';
  const pre = wrap.querySelector('.axion-modal-detail');
  if (detail) pre.textContent = detail; else pre.remove();
  wrap.querySelector('[data-r="no"]').textContent = (labels && labels.no) || (AXION.t ? AXION.t('deny') : 'Cancel');
  wrap.querySelector('[data-r="yes"]').textContent = (labels && labels.yes) || (AXION.t ? AXION.t('allow') : 'OK');
  const done = (v) => { wrap.remove(); resolve(v); };
  wrap.querySelector('[data-r="yes"]').addEventListener('click', () => done(true));
  wrap.querySelector('[data-r="no"]').addEventListener('click', () => done(false));
  wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
  document.body.appendChild(wrap);
});

/* Small toast */
AXION.ui.toast = (text) => {
  const t = document.createElement('div');
  t.className = 'axion-toast'; t.textContent = text;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 1400);
};

/* Auto-load settings immediately so AXION.settings always exists for later modules */
AXION.loadSettings();
if (AXION.refreshCustomProviders) AXION.refreshCustomProviders();
window.addEventListener('storage', (e) => { if (e.key === 'axion_settings' && e.newValue) { AXION.loadSettings(); if (AXION.refreshCustomProviders) AXION.refreshCustomProviders(); AXION.applyTheme(); AXION.applyI18n && AXION.applyI18n(); } });
window.addEventListener('axion:storage-ready', () => { AXION.loadSettings(); if (AXION.refreshCustomProviders) AXION.refreshCustomProviders(); AXION.applyTheme(); AXION.applyI18n && AXION.applyI18n(); document.documentElement.lang = AXION.settings.lang || 'en'; });
