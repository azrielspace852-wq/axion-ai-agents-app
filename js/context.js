/* =========================================================
   AXION AI — Device Context (point 5): clock, calendar, GPS,
   screen size — runs on-device in the background.
   ========================================================= */
window.AXION = window.AXION || {};

AXION.context = (() => {
  let gps = null;          // {lat, lon, accuracy, ts}
  let gpsError = null;
  let watchId = null;

  const now = () => {
    const d = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -d.getTimezoneOffset() / 60; // hours
    return {
      iso: d.toISOString(),
      local: d.toLocaleString(),
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString(),
      weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
      timezone: tz,
      utcOffset: (offset >= 0 ? '+' : '') + offset,
      timestampMs: Date.now(),
    };
  };

  const requestGps = () => new Promise((resolve) => {
    if (!navigator.geolocation) { gpsError = 'Geolocation not supported'; resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gps = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, ts: Date.now() };
        gpsError = null;
        resolve(gps);
      },
      (err) => { gpsError = err.message || 'Permission denied'; resolve(null); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });

  const startBackground = () => {
    // Update clock every 30s (lightweight, in background)
    setInterval(() => { /* now() is computed on demand; keep tick alive for listeners */ }, 30000);
    // If user granted GPS, refresh periodically
    if (AXION.settings && AXION.settings.allowGps) {
      requestGps();
      watchId = setInterval(() => requestGps(), 5 * 60 * 1000); // every 5 min
    }
    // React to screen resize (point 2)
    window.addEventListener('resize', () => {
      document.documentElement.setAttribute('data-screen', AXION.screenInfo().category);
    });
    document.documentElement.setAttribute('data-screen', AXION.screenInfo().category);
  };

  /* Snapshot text injected into system prompt (light, no GPS unless granted) */
  const snapshot = (includeGpsIfAvailable) => {
    const n = now();
    const s = AXION.screenInfo();
    let lines = [
      `Current local time: ${n.time} (${n.weekday}, ${n.date})`,
      `Timezone: ${n.timezone} (UTC${n.utcOffset}) · ISO: ${n.iso}`,
      `Device: ${s.category} · screen ${s.width}x${s.height}px · touch:${s.touch} · DPR:${s.pixelRatio}`,
      `Language: ${(AXION.settings && AXION.settings.lang) || 'en'} · Theme: ${(AXION.settings && AXION.settings.theme) || 'dark'}`,
    ];
    if (includeGpsIfAvailable && gps) {
      lines.push(`GPS location (user-granted): lat ${gps.lat.toFixed(5)}, lon ${gps.lon.toFixed(5)} ±${Math.round(gps.accuracy)}m`);
    } else if (includeGpsIfAvailable && gpsError) {
      lines.push(`GPS: not available (${gpsError})`);
    }
    return lines.join('\n');
  };

  /* Tool handler — called by agent loop, returns {result, stepLabel} */
  const handleTool = (payload) => {
    const p = (payload || '').trim().toLowerCase();
    if (p.includes('gps') || p.includes('location')) {
      if (gps) return { ok: true, text: `GPS: lat ${gps.lat.toFixed(5)}, lon ${gps.lon.toFixed(5)} ±${Math.round(gps.accuracy)}m (updated ${new Date(gps.ts).toLocaleTimeString()})` };
      if (AXION.settings && AXION.settings.allowGps) return { ok: true, text: 'GPS refresh requested… ' + (gpsError ? 'Error: ' + gpsError : 'Retrying now.') };
      return { ok: false, text: 'GPS not enabled. User must enable location in Settings.' };
    }
    if (p.includes('screen')) return { ok: true, text: snapshot(false) };
    // default: full time/date context
    return { ok: true, text: snapshot(true) };
  };

  return { now, requestGps, startBackground, snapshot, handleTool, getGps: () => gps };
})();
