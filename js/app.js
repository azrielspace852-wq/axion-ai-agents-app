/* =========================================================
   AXION AI — App bootstrap (shared by all pages).
   Loads settings, applies theme + i18n, starts background
   device context (clock/GPS/screen), nav active state.
   ========================================================= */
window.AXION = window.AXION || {};

(() => {
  const bootStartedAt = performance.now();
  const splash = document.createElement('div');
  splash.className = 'splash-screen'; splash.setAttribute('role','status'); splash.setAttribute('aria-label','AXION AI initializing');
  splash.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:14px"><div class="brand-logo" style="width:54px;height:54px;font-size:20px">AX</div><strong>AXION AI</strong><span style="width:60px;height:3px;border-radius:999px;background:var(--border);overflow:hidden"><span style="display:block;width:55%;height:100%;background:var(--primary);animation:splashProgress .8s ease-in-out infinite alternate"></span></span></div>';
  document.documentElement.style.setProperty('--splash-progress-animation','');
  document.body.appendChild(splash);
  const splashMinMs = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 320 : 160;
  const hideSplash = () => { const elapsed=performance.now()-bootStartedAt; setTimeout(()=>{splash.style.opacity='0';setTimeout(()=>splash.remove(),220);},Math.max(0,splashMinMs-elapsed)); };
  Promise.race([Promise.resolve(AXION.storage?.ready).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,650))]).finally(hideSplash);
  AXION.loadSettings();
  AXION.applyTheme();
  AXION.applyI18n();
  document.documentElement.lang = AXION.settings.lang || 'en';
  // v2.6: inject inline SVG icons into every <span class="ic" data-icon="name">
  if (AXION.icon) {
    document.querySelectorAll('.ic[data-icon]').forEach(el => {
      el.innerHTML = AXION.icon(el.getAttribute('data-icon'));
    });
  }
  if (AXION.context && AXION.context.startBackground) AXION.context.startBackground();

  // Knowledge repo: syncs silently in the background as needed (point 3).
  // No UI, no errors shown — the AI uses it on demand.
  try {
    if (AXION.git && AXION.git.knowledgeStats) {
      const stats = AXION.git.knowledgeStats();
      const stale = !stats.updated || (Date.now() - new Date(stats.updated).getTime()) > 24 * 3600 * 1000;
      if (stale) {
        setTimeout(() => { AXION.git.syncKnowledge && AXION.git.syncKnowledge(AXION.APP.knowledgeRepo).catch(() => {}); }, 4000);
      }
    }
  } catch (e) { /* silent */ }

  // If GPS was previously allowed, refresh on load
  if (AXION.settings.allowGps && AXION.context && AXION.context.requestGps) AXION.context.requestGps();

  // Mark active nav link
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href === page || (page === '' && href === 'index.html')) a.classList.add('active');
  });


  // First-visit and 15-day recurring donation prompt.
  const maybeDonationPrompt = async () => {
    const key = 'axion_donate_prompt_last';
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    if (last && Date.now() - last < 15 * 24 * 60 * 60 * 1000) return;
    setTimeout(async () => {
      if (!document.body) return;
      const id = AXION.settings.lang === 'id';
      const accepted = await AXION.ui.confirm(
        id ? 'Dukung pengembangan AXION AI' : 'Support AXION AI',
        id ? 'Donasi sesuai keinginan Anda untuk membantu developer membeli kopi ☕' : 'Donate as you wish, to help the developer buy coffee ☕',
        '',
        { no: id ? 'Tidak, terima kasih' : 'No thanks', yes: id ? 'Donasi sekarang' : 'Donate now' }
      );
      localStorage.setItem(key, String(Date.now()));
      if (accepted) {
        if (/settings\.html$/i.test(location.pathname)) { location.hash = 'supportSection'; document.getElementById('supportSection')?.scrollIntoView({ behavior: 'smooth' }); }
        else location.href = 'settings.html#supportSection';
      }
    }, 1400);
  };
  maybeDonationPrompt();

  // Mobile sidebar: hamburger button, backdrop tap, and SWIPE from the left screen edge.
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    const narrow = () => window.innerWidth <= 900;
    const sbWidth = () => sidebar.offsetWidth || 240;
    const setOpen = (open) => {
      sidebar.style.transition = ''; sidebar.style.transform = '';
      backdrop.style.transition = ''; backdrop.style.opacity = '';
      sidebar.classList.toggle('open', open);
    };
    // keep the backdrop in sync no matter who toggles the class (chat.js closes it after picking a chat)
    const syncBackdrop = () => backdrop.classList.toggle('show', sidebar.classList.contains('open') && narrow());
    new MutationObserver(syncBackdrop).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', syncBackdrop);

    menuBtn && menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!sidebar.classList.contains('open')); });
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) setOpen(false);
    });

    // --- Edge swipe (left → right opens, right → left closes), finger-following ---
    const EDGE = 32;           // px from the left edge where an opening swipe may start
    let g = null;
    const panelOpen = () => { const p = document.getElementById('artifactPanel'); return p && p.classList.contains('open'); };

    document.addEventListener('touchstart', (e) => {
      if (!narrow() || e.touches.length !== 1 || panelOpen()) { g = null; return; }
      const t = e.touches[0];
      const open = sidebar.classList.contains('open');
      if (!open && t.clientX > EDGE) { g = null; return; }
      g = { x: t.clientX, y: t.clientY, open, dragging: false, pos: open ? 0 : -sbWidth(), t0: Date.now(), lastX: t.clientX };
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.dragging) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }   // vertical scroll
        if (Math.abs(dx) < 10) return;
        if ((!g.open && dx < 0) || (g.open && dx > 0)) { g = null; return; }          // wrong direction
        g.dragging = true;
        sidebar.style.transition = 'none'; backdrop.style.transition = 'none';
        backdrop.classList.add('show');
      }
      e.preventDefault();
      const w = sbWidth();
      const base = g.open ? 0 : -w;
      g.pos = Math.max(-w, Math.min(0, base + dx));
      g.lastX = t.clientX;
      sidebar.style.transform = `translateX(${g.pos}px)`;
      backdrop.style.opacity = String((g.pos + w) / w);
    }, { passive: false });

    const endSwipe = () => {
      if (!g) return;
      const wasDragging = g.dragging, w = sbWidth();
      const fast = Math.abs(g.lastX - g.x) / Math.max(1, Date.now() - g.t0) > 0.5;     // quick flick
      const dirOpen = g.lastX > g.x;
      const open = fast ? dirOpen : g.pos > -w / 2;
      g = null;
      if (wasDragging) { sidebar.classList.toggle('open', open); setOpen(open); syncBackdrop(); }
    };
    document.addEventListener('touchend', endSwipe);
    document.addEventListener('touchcancel', endSwipe);
  }

  // Quick theme toggle in topbar (both pages)
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      AXION.setTheme(AXION.settings.theme === 'dark' ? 'light' : 'dark');
      themeToggle.textContent = AXION.settings.theme === 'dark' ? '☀' : '☾';
    });
    themeToggle.textContent = AXION.settings.theme === 'dark' ? '☀' : '☾';
  }
})();
