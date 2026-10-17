/* =========================================================
   AXION AI — Agent loop v2.7.
   v2.7: thinking / steps / final answer are driven by what the
   model actually emits (no forced "thinking" item per iteration).
   - A thinking block appears ONLY when the model streams reasoning.
   - Tool steps appear when tools actually execute.
   - Final answer when no more tools.
   - Source parsing is tolerant (any URL + preceding text = title).
   ========================================================= */
window.AXION = window.AXION || {};
AXION.agents = (() => {
  /* === UPDATE v2.8.1: Tolerant Tool Regex (Case-insensitive, dash & underscore support, extra spaces) === */
  const TOOL_RE = /<<<\s*TOOL:\s*([a-zA-Z_-]+)\s*>>>([\s\S]*?)<<<\s*END\s*>>>/gi;
  const OPEN_TOOL_RE = /<<<\s*TOOL:\s*([a-zA-Z_-]+)\s*>>>/i;
  const SAFETY_CAP = 100;
  const extractTools = (text) => {
    const tools = [];
    let m;
    TOOL_RE.lastIndex = 0;
    while ((m = TOOL_RE.exec(text)) !== null) tools.push({ name: m[1].toLowerCase(), payload: m[2].trim() });
    // Tolerant fallback: an OPEN (unterminated) <<<TOOL:name>>> at the end of output —
    // the model stopped before emitting <<<END>>>. Treat everything after it as payload.
    const stripped = text.replace(TOOL_RE, '');
    const om = OPEN_TOOL_RE.exec(stripped);
    if (om) {
      const payload = stripped.slice(om.index + om[0].length).trim();
      tools.push({ name: om[1].toLowerCase(), payload: payload.slice(0, 32000) });
    }
    return tools;
  };
  const stripTools = (text) => text.replace(TOOL_RE, '').trim();
  /* For LIVE display only: remove closed tool blocks AND any open tool marker + its
     trailing payload, so raw <<<TOOL>>> markup never flashes in the chat. */
  const displayText = (text) => stripTools(String(text || ''))
    .replace(/<<<\s*TOOL:[\s\S]*$/i, '')
    .replace(/<<<\s*END\s*>>>/gi, '')
    .trim();
  const labelOf = (name) => {
    switch (name) {
      case 'search': return AXION.t('toolSearch');
      case 'deepsearch': return 'Searching & scraping web';
      case 'fetch': return AXION.t('toolFetch');
      case 'runjs': return AXION.t('toolRun');
      case 'git': return AXION.t('toolGit');
      case 'context': return AXION.t('toolContext');
      case 'knowledge': return AXION.t('toolKnowledge');
      case 'readfile': return 'Reading file';
      case 'workspace': return AXION.settings?.lang === 'id' ? 'Workspace Lokal' : 'Local Workspace';
      case 'terminal': return 'Internal terminal / OPFS';
      case 'canvas': return 'Creating canvas';
      default: return 'Tool: ' + name;
    }
  };
  /* v2.7 tolerant source extraction: any http(s) URL + its preceding text */
  const parseSources = (toolName, payload, resultText) => {
    try {
      const out = [];
      const seen = new Set();
      const re = /https?:\/\/[^\s)"'<>\]]+/g;
      let m;
      while ((m = re.exec(resultText)) !== null) {
        let url = m[0].replace(/[.,;:!?]+$/, '');
        if (seen.has(url)) continue;
        seen.add(url);
        const before = resultText.slice(Math.max(0, m.index - 120), m.index);
        const lines = before.split('\n');
        let title = (lines[lines.length - 1] || '').replace(/^\s*\d+[\.\)]\s*/, '').replace(/^URL:\s*/i, '').trim();
        if (!title || title.length < 4) title = url.replace(/^https?:\/\//, '').split('/')[0];
        out.push({ title: title.slice(0, 120), url });
        if (out.length >= 8) break;
      }
      return out;
    } catch { return []; }
  };
  const executeTool = async (name, payload, onSources) => {
    let res;
    switch (name) {
      case 'search': res = { ok: true, text: await AXION.search.search(payload) }; break;
      case 'deepsearch': res = { ok: true, text: await AXION.search.deepSearch(payload) }; break;
      case 'fetch': res = { ok: true, text: await AXION.search.fetchPage(payload) }; break;
      case 'runjs': res = AXION.runjs(payload); break;
      case 'context': res = AXION.context.handleTool(payload); break;
      case 'knowledge': {
        if (/[.\/\\]/.test(payload) && payload.length < 200) res = { ok: true, text: AXION.git.readKnowledgeFile(payload) };
        else res = { ok: true, text: AXION.git.searchKnowledge(payload) };
        break;
      }
      case 'readfile': {
        const store = AXION.zipStore || {};
        let found = null;
        for (const convId of Object.keys(store)) {
          for (const zipName of Object.keys(store[convId])) {
            const files = store[convId][zipName];
            const f = Object.keys(files).find(p => p.toLowerCase().includes(payload.toLowerCase()) || p.toLowerCase().endsWith(payload.toLowerCase()));
            if (f) { found = `=== ${zipName} :: ${f} ===\n${String(files[f]).slice(0, 60000)}`; break; }
          }
          if (found) break;
        }
        if (!found && AXION.storage) {
          try {
            const needle = String(payload || '').replace(/^\/+/, '').toLowerCase();
            const metas = await AXION.storage.listLibrary();
            const meta = metas.find(f => f.name.toLowerCase() === needle || String(f.relativePath || '').toLowerCase() === needle || f.name.toLowerCase().includes(needle) || String(f.relativePath || '').toLowerCase().endsWith(needle));
            if (meta) {
              const pair = await AXION.storage.getLibraryBlob(meta.id);
              if (/\.zip$/i.test(meta.name) && typeof JSZip !== 'undefined') {
                const zip = await JSZip.loadAsync(pair.blob);
                const entryName = Object.keys(zip.files).find(k => !zip.files[k].dir && (k.toLowerCase() === needle || k.toLowerCase().endsWith('/' + needle) || k.toLowerCase().includes(needle)));
                if (entryName) { const entry = zip.file(entryName); found = `=== ${meta.name} :: ${entryName} ===\n` + (await entry.async('string')).slice(0, 60000); }
                else found = `ZIP ${meta.name} contains ${Object.keys(zip.files).filter(k => !zip.files[k].dir).slice(0,200).join('\n')}`;
              } else if (/\.docx$/i.test(meta.name)) {
                if (typeof JSZip === 'undefined') found = `DOCX ${meta.name} is stored as a genuine binary file, but automatic DOCX text conversion is unavailable because JSZip did not load.`;
                else { const docx = await JSZip.loadAsync(pair.blob); const doc = docx.file('word/document.xml'); if (!doc) found = `DOCX conversion failed for ${meta.name}: word/document.xml is missing.`; else { const xml = new DOMParser().parseFromString(await doc.async('string'),'application/xml'); if (xml.querySelector('parsererror')) found = `DOCX conversion failed for ${meta.name}: invalid document XML.`; else { const txt=[...xml.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join('')).join('\n'); found=`=== DOCX converted to plain text: ${meta.name} ===\n${txt.slice(0,60000)}`; } } }
              } else if (/^(text\/|application\/(json|xml|javascript|x-yaml))/.test(meta.mimeType) || /\.(txt|md|html?|css|js|json|py|xml|csv|ya?ml|svg|log|ts|tsx|jsx|toml|rtf)$/i.test(meta.name)) found = `=== Library file: ${meta.name} ===\n` + (await pair.blob.text()).slice(0, 60000);
              else found = `File ${meta.name} is available as a native file in File Library (${meta.size} bytes, exact MIME type: ${meta.mimeType}); binary data is not printable as text, but remains downloadable in its original format.`;
            }
          } catch (e) { found = `File read failed: ${e.message}`; }
        }
        if (!found && AXION.workspace?.getFile) { try { const workspaceFile = await AXION.workspace.getFile(String(payload || '').replace(/^\/+/,'')); if (workspaceFile) found = `=== Workspace file: ${workspaceFile.path} ===\n${String(workspaceFile.content).slice(0,60000)}`; } catch(e) { found = `Workspace file read failed: ${e.message}`; } }
        res = { ok: true, text: found || (AXION.git.readKnowledgeFile ? AXION.git.readKnowledgeFile(payload) : 'File was not found in uploaded ZIPs, File Library, OPFS workspace, or knowledge base.') };
        break;
      }
      case 'git': res = await AXION.git.execute(payload); break;
      case 'workspace': res = await (AXION.workspace ? AXION.workspace.execute(payload) : Promise.resolve({ ok: false, text: 'Workspace not available.' })); break;
      case 'terminal': res = await (AXION.terminal ? AXION.terminal.execute(payload) : Promise.resolve({ ok: false, text: 'Internal terminal is unavailable.' })); break;
      case 'canvas': { let spec; try { spec = typeof payload === 'string' ? JSON.parse(payload) : payload; } catch (_) { spec = { title: 'Canvas', content: String(payload || '') }; } if (AXION.canvas) { AXION.canvas.create(spec); res = { ok: true, text: 'Canvas rendered in the chat. The preview shows exactly 15 lines; Copy and View All controls are available.' }; } else res = { ok: false, text: 'Canvas renderer is unavailable.' }; break; }
      case 'tasks': res = await (AXION.tasks ? AXION.tasks.execute(payload) : Promise.resolve({ ok: false, text: 'Persistent task store is unavailable.' })); break;
      default: res = { ok: false, text: `Unknown tool: ${name}` };
    }
    if (onSources && (name === 'search' || name === 'deepsearch' || name === 'fetch') && res && res.text) {
      const srcs = parseSources(name, payload, String(res.text));
      if (srcs.length) onSources(srcs);
    }
    return res;
  };
  /* Main loop — thinking/steps driven by the model's actual output. */
  const run = async (opts) => {
    const { messages, system, thinking, signal, onStep, onChunk, onSources } = opts;
    const hist = messages.slice();
    const showThinking = thinking && thinking !== 'off';
    let n = 0;
    let finalImages = [], finalAudio = null;
    let aborted = false;
    for (let iter = 0; iter < SAFETY_CAP; iter++) {
      if (signal && signal.aborted) { aborted = true; break; }
      let streamText = '', streamThink = '';
      let thinkingN = null;          // created lazily, only if model thinks
      const thinkStart = Date.now();
      let result;
      try {
        result = await AXION.providers.chat({
          providerId: AXION.settings.provider,
          model: AXION.settings.model,
          modelInfo: AXION.currentModelInfo,
          messages: hist,
          system,
          thinking,
          signal,
          onChunk: (t, th, imgs) => {
            streamText = t;
            streamThink = th;
            if (imgs && imgs.length) finalImages = imgs;
            // v2.7: thinking block appears ONLY when reasoning actually arrives
            if (showThinking && th) {
              if (thinkingN === null) {
                n++; thinkingN = n;
                onStep && onStep({ n, type: 'thinking', label: AXION.t('thinking'), status: 'running', detail: th.slice(-200), bodyText: th });
              } else {
                onStep && onStep({ n: thinkingN, type: 'thinking', label: AXION.t('thinking'), status: 'running', detail: th.slice(-200), bodyText: th });
              }
            }
            // Show live text with tool markup stripped (never raw <<<TOOL>>> in chat)
            const disp = displayText(t);
            if (disp) onChunk && onChunk(disp, th);
          },
        });
      } catch (e) {
        if (e.name === 'AbortError') { aborted = true; result = { text: streamText, thinking: streamThink, images: finalImages, audio: finalAudio, aborted: true }; }
        else throw e;
      }
      if (result.images && result.images.length) finalImages = result.images;
      if (result.audio) finalAudio = result.audio;
      const iterThinking = result.thinking || streamThink || '';
      const text = result.text || streamText;
      const durationMs = Date.now() - thinkStart;
      if (thinkingN !== null) {
        onStep && onStep({ n: thinkingN, type: 'thinking', label: AXION.t('thinking'), status: result.aborted ? 'stopped' : 'done', detail: iterThinking ? iterThinking.slice(-200) : '', bodyText: iterThinking, durationMs });
      }
      if (result.aborted) aborted = true;
      const tools = extractTools(text);
      if (!tools.length || aborted) {
        n++;
        onStep && onStep({ n, type: 'step', label: AXION.t('finalAnswer'), status: aborted ? 'stopped' : 'done', detail: '' });
        return { text: stripTools(text), thinking: iterThinking, images: finalImages, audio: finalAudio, aborted, history: hist };
      }
      hist.push({ role: 'assistant', text });
      for (const tool of tools) {
        if (signal && signal.aborted) { aborted = true; break; }
        n++;
        const label = labelOf(tool.name);
        onStep && onStep({ n, type: 'step', label, status: 'running', detail: tool.payload.slice(0, 140), bodyText: '' });
        let res;
        try { res = await executeTool(tool.name, tool.payload, onSources); }
        catch (e) { res = { ok: false, text: 'Tool error: ' + e.message }; }
        onStep && onStep({ n, type: 'step', label, status: res.ok ? 'done' : 'error', detail: String(res.text).slice(0, 220), bodyText: String(res.text).slice(0, 32000) });
        hist.push({
          role: 'user',
          text: `[Tool result: ${tool.name}]\n${String(res.text).slice(0, 32000)}\n\nContinue. If you have enough information, give the final answer (no more <<<TOOL>>> blocks). If you need another tool or must run/test code again, emit it now.`,
        });
      }
      if (aborted) {
        n++;
        onStep && onStep({ n, type: 'step', label: AXION.t('finalAnswer'), status: 'stopped', detail: '' });
        return { text: stripTools(text), thinking: iterThinking, images: finalImages, audio: finalAudio, aborted: true, history: hist };
      }
    }
    n++;
    onStep && onStep({ n, type: 'step', label: AXION.t('finalAnswer'), status: 'error', detail: '(safety limit reached — stopped)' });
    return { text: '(Agent stopped by safety limit. Last partial output may be incomplete.)', thinking: '', images: finalImages, audio: finalAudio, history: hist };
  };
  return { run, extractTools };
})();
