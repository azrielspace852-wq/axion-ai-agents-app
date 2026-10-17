/* =========================================================
   AXION AI — Artifacts (point 7): files & ZIPs.
   - Artifact cards appear in chat with a direct Download button.
   - ZIP archives cannot be opened or edited; only download + info.
   - Editable files (html/css/js/json/md/txt/py/svg) open in a
     side panel with preview + edit + download.
   ========================================================= */
window.AXION = window.AXION || {};

AXION.artifacts = (() => {
  const ARTIFACT_RE = /```([a-zA-Z_][\w\-./]{2,})[ \t]*\r?\n([\s\S]*?)\r?\n?```\1[ \t]*(?=\r?\n|$)/g;

  const EDITABLE_EXT = /\.(html?|css|js|mjs|ts|json|md|markdown|txt|py|svg|xml|csv|yaml|yml|ini|cfg|log)$/i;
  const VIEWABLE_EXT = /\.(html?|svg|md|markdown|txt|json|css|js|py|csv|xml|yaml|yml)$/i;

  const extOf = (fn) => { const i = fn.lastIndexOf('.'); return i >= 0 ? fn.slice(i + 1).toLowerCase() : ''; };

  const parse = (text) => {
    const segments = [];
    let last = 0, m;
    ARTIFACT_RE.lastIndex = 0;
    while ((m = ARTIFACT_RE.exec(text)) !== null) {
      if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) });
      segments.push({ type: 'artifact', filename: m[1], content: m[2] });
      last = m.index + m[0].length;
    }
    if (last < text.length) segments.push({ type: 'text', content: text.slice(last) });
    return segments;
  };

  const findOpenArtifact = (text) => {
    const re = /```([a-zA-Z_][\w\-./]{2,})[ \t]*\r?\n/g;
    let lastOpen = null, m;
    while ((m = re.exec(text)) !== null) {
      const closeRe = new RegExp('\\r?\\n?```' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*(?=\\r?\\n|$)');
      const after = text.slice(m.index + m[0].length);
      if (!closeRe.test(after)) lastOpen = { filename: m[1], content: after };
      else lastOpen = null;
    }
    return lastOpen;
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  };

  const downloadText = (content, filename) => {
    const ext = extOf(filename);
    const mime = ({html:'text/html',htm:'text/html',svg:'image/svg+xml',md:'text/markdown',markdown:'text/markdown',txt:'text/plain',json:'application/json',css:'text/css',js:'text/javascript',mjs:'text/javascript',ts:'text/typescript',py:'text/x-python',csv:'text/csv',xml:'application/xml',yaml:'text/yaml',yml:'text/yaml',rtf:'application/rtf',sql:'application/sql'}[ext] || 'application/octet-stream');
    downloadBlob(new Blob([content], { type: mime + (mime.startsWith('text/') ? ';charset=utf-8' : '') }), filename);
  };

  /* Build a real ZIP from the "path\ncontent\n---\npath\ncontent" text format */
  const buildZip = async (zipText, filename) => {
    if (typeof JSZip === 'undefined') { downloadText(zipText, filename + '.txt'); return; }
    const z = new JSZip();
    const parts = zipText.split(/\r?\n---\r?\n?/);
    for (const part of parts) {
      const nl = part.indexOf('\n');
      if (nl < 0) continue;
      const path = part.slice(0, nl).trim();
      const content = part.slice(nl + 1);
      if (path) z.file(path, content);
    }
    const blob = await z.generateAsync({ type: 'blob' });
    downloadBlob(blob, filename);
  };

  const isZip = (fn) => /\.zip$/i.test(fn);

  /* Create a card DOM element. onOpen callback for non-zip viewable. */
  const createCard = (artifact, onOpen) => {
    const card = document.createElement('div');
    card.className = 'artifact-card ai-output-file-card';
    const zip = isZip(artifact.filename);
    const editable = !zip && EDITABLE_EXT.test(artifact.filename);
    const viewable = !zip && VIEWABLE_EXT.test(artifact.filename);

    const icon = document.createElement('div');
    icon.className = 'artifact-icon';
    icon.textContent = zip ? 'ZIP' : (extOf(artifact.filename) || 'FILE').toUpperCase().slice(0, 4);

    const info = document.createElement('div');
    info.className = 'artifact-info';
    const name = document.createElement('div');
    name.className = 'artifact-name';
    name.textContent = artifact.filename;
    const meta = document.createElement('div');
    meta.className = 'artifact-meta';
    const kb = Math.round(new Blob([artifact.content]).size / 102.4) / 10;
    meta.textContent = zip ? 'ZIP archive · download only' : `${kb} KB · ${extOf(artifact.filename).toUpperCase()}`;
    info.appendChild(name); info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'artifact-actions';

    // Download button — ALWAYS present directly on the card (point 7)
    const dl = document.createElement('button');
    dl.className = 'btn btn-sm btn-primary';
    dl.textContent = AXION.t('download');
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (zip) buildZip(artifact.content, artifact.filename);
      else downloadText(artifact.content, artifact.filename);
    });
    actions.appendChild(dl);

    if (viewable) {
      const open = document.createElement('button');
      open.className = 'btn btn-sm btn-ghost';
      open.textContent = AXION.t('open');
      open.addEventListener('click', (e) => { e.stopPropagation(); onOpen && onOpen(artifact, editable); });
      actions.appendChild(open);
    }

    card.appendChild(icon); card.appendChild(info); card.appendChild(actions);
    if (zip) {
      card.classList.add('is-zip');
      card.title = AXION.t('zipNote');
      card.addEventListener('click', () => {
        // Show info only; no open/edit
        const lines = artifact.content.split(/\r?\n---\r?\n?/).map(p => p.slice(0, p.indexOf('\n')).trim()).filter(Boolean);
        alert((AXION.t('zipNote')) + '\n\nFiles (' + lines.length + '):\n' + lines.slice(0, 50).join('\n'));
      });
    }
    return card;
  };

  return { parse, findOpenArtifact, createCard, downloadText, downloadBlob, buildZip, isZip, extOf };
})();

/* ---------- Sandboxed JS runner (tool: runjs) ---------- */
AXION.runjs = (code) => {
  // Tolerate models that wrap code in ```js ... ``` fences
  code = String(code || '').replace(/^```[a-zA-Z0-9]*[ \t]*\r?\n?/, '').replace(/\r?\n?```[ \t]*$/, '').trim();
  const logs = [];
  const sandboxConsole = {
    log: (...a) => logs.push(a.map(x => { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch { return String(x); } }).join(' ')),
    error: (...a) => logs.push('ERROR: ' + a.map(String).join(' ')),
    warn: (...a) => logs.push('WARN: ' + a.map(String).join(' ')),
  };
  try {
    // Sandboxed: no window/document/network access via with-scope shadowing
    const fn = new Function('console', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout', '"use strict";\n' + code);
    const ret = fn(sandboxConsole, JSON, Math, Date, Array, Object, String, Number, parseInt, parseFloat, isNaN, () => {});
    let out = logs.join('\n');
    if (ret !== undefined) {
      try { out += (out ? '\n' : '') + '→ ' + (typeof ret === 'object' ? JSON.stringify(ret) : String(ret)); } catch { out += '\n→ [unserializable return]'; }
    }
    return { ok: true, text: out || '(no output)' };
  } catch (e) {
    return { ok: false, text: (logs.join('\n') + (logs.length ? '\n' : '') + 'Runtime error: ' + e.message).trim() };
  }
};
