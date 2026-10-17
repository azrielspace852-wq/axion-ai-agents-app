/* =========================================================
   AXION AI — local-only workspace + Actions.
   A persistent, private file system living ON the user's device
   (IndexedDB). The AI can read/write/list/search files and RUN
   code ("Actions") directly — local-only. GitHub is an agent/copilot tool and is never workspace storage.
   Tool: <<<TOOL:workspace>>>{"action":"…", …}<<<END>>>
   Actions: list, read, write, delete, move, search, run (JS),
            tree, stats, clear.
   ========================================================= */
window.AXION = window.AXION || {};
AXION.workspace = (() => {
  const enabled = () => !!(AXION.settings && AXION.settings.workspaceEnabled);
  const cleanPath = (p) => AXION.storage.fs.validPath(String(p || '').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/'));
  const allFiles = async () => {
    await AXION.storage.ready;
    const list = (await AXION.storage.fs.list('workspace')).filter(x => x.kind === 'file');
    const out = [];
    for (const x of list) { try { out.push({ path: x.path.replace(/^workspace\/?/, ''), content: await AXION.storage.fs.read(x.path), updated: x.updated || Date.now() }); } catch (_) {} }
    return out;
  };
  const getFile = async (path) => { const p = 'workspace/' + cleanPath(path); try { return { path: cleanPath(path), content: await AXION.storage.fs.read(p), updated: Date.now() }; } catch (_) { return null; } };
  const getTextRange = (text, startLine, endLine) => {
    const lines = String(text || '').split(/\r?\n/);
    const start = Math.max(1, Number(startLine) || 1), end = Math.max(start, Number(endLine) || lines.length);
    return { totalLines: lines.length, startLine: start, endLine: Math.min(end, lines.length), text: lines.slice(start - 1, end).join('\n') };
  };
  const mimeForPath = (path) => ({txt:'text/plain;charset=utf-8',md:'text/markdown;charset=utf-8',json:'application/json;charset=utf-8',html:'text/html;charset=utf-8',htm:'text/html;charset=utf-8',css:'text/css;charset=utf-8',js:'text/javascript;charset=utf-8',mjs:'text/javascript;charset=utf-8',csv:'text/csv;charset=utf-8',xml:'application/xml;charset=utf-8',svg:'image/svg+xml',py:'text/x-python;charset=utf-8',yaml:'text/yaml;charset=utf-8',yml:'text/yaml;charset=utf-8',zip:'application/zip'}[(String(path).split('.').pop()||'').toLowerCase()] || 'application/octet-stream');
  const writeFile = async (path, content) => { await putFile(path, content); return { path: cleanPath(path), chars: String(content ?? '').length }; };
  const deliverToChat = async (path, content) => {
    const normalized = cleanPath(path), mime = mimeForPath(normalized);
    const blob = new Blob([String(content ?? '')], { type: mime });
    const rec = await AXION.storage.addLibraryFile(blob, { name: normalized.split('/').pop(), mimeType: mime, source: 'ai-generated', shared: true, relativePath: normalized, allowDuplicate: true });
    if (AXION.currentOutputHost) {
      AXION.pendingOutputFiles = AXION.pendingOutputFiles || [];
      AXION.pendingOutputFiles.push({ id: rec.id, path: normalized, mime, size: blob.size });
    } else {
      await renderDeliveredArtifacts(document.getElementById('chat'), [{ id: rec.id, path: normalized, mime, size: blob.size }]);
    }
    return rec;
  };
  const renderDeliveredArtifacts = async (host, items) => {
    const usesPendingQueue = !Array.isArray(items);
    const queue = usesPendingQueue ? (AXION.pendingOutputFiles || []) : items;
    if (!host || !queue.length) return;
    const renderedIds = new Set();
    for (const item of queue) {
      try {
        const pair = await AXION.storage.getLibraryBlob(item.id);
        renderedIds.add(item.id);
        const card = document.createElement('div'); card.className = 'artifact-card ai-output-file-card';
        const icon = document.createElement('div'); icon.className = 'artifact-icon'; icon.textContent = (item.path.split('.').pop() || 'FILE').toUpperCase().slice(0,4);
        const info = document.createElement('div'); info.className = 'artifact-info';
        const name = document.createElement('div'); name.className = 'artifact-name'; name.textContent = pair.meta.name;
        const meta = document.createElement('div'); meta.className = 'artifact-meta'; meta.textContent = `${item.path} · ${pair.blob.size} bytes · ${item.mime}`; info.append(name, meta);
        const actions = document.createElement('div'); actions.className = 'artifact-actions';
        const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'btn btn-sm btn-primary'; dl.textContent = AXION.t ? AXION.t('download') : 'Download';
        dl.addEventListener('click', async () => { try { const fresh = await AXION.storage.getLibraryBlob(item.id); AXION.artifacts.downloadBlob(fresh.blob, fresh.meta.name); } catch(e) { AXION.ui.toast('Download failed: ' + e.message); } });
        actions.append(dl); card.append(icon, info, actions); host.appendChild(card);
      } catch (e) { AXION.ui.toast('Artifact could not be displayed: ' + e.message); }
    }
    if (usesPendingQueue) AXION.pendingOutputFiles = (AXION.pendingOutputFiles || []).filter(item => !renderedIds.has(item.id));
    if (host.id === 'chat') host.scrollTop = host.scrollHeight;
  };
  const putFile = async (path, content) => { const p = cleanPath(path); await AXION.storage.fs.write('workspace/' + p, String(content == null ? '' : content)); await AXION.storage.upsertPath('workspace/' + p, { source: 'workspace', name: p.split('/').pop(), shared: false }); };
  const delFile = async (path) => { const p = cleanPath(path); await AXION.storage.fs.remove('workspace/' + p); const meta = await AXION.storage.listLibrary(); for (const f of meta) if (f.storagePath === 'workspace/' + p) await AXION.storage.deleteLibrary(f.id); };
  const reqAsPromise = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  /* Run JS "Action" inside the workspace: files are readable via a
     provided `ws` object; output captured via console.log. */
  const runAction = async (code) => {
    const files = await allFiles();
    const fsMap = {};
    files.forEach(f => { fsMap[f.path] = f.content; });
    const logs = [];
    const sandboxConsole = {
      log: (...a) => logs.push(a.map(x => { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch { return String(x); } }).join(' ')),
      error: (...a) => logs.push('ERROR: ' + a.map(String).join(' ')),
      warn: (...a) => logs.push('WARN: ' + a.map(String).join(' ')),
    };
    const wsApi = {
      read: (p) => fsMap[cleanPath(p)] !== undefined ? fsMap[cleanPath(p)] : null,
      exists: (p) => fsMap[cleanPath(p)] !== undefined,
      list: (prefix) => Object.keys(fsMap).filter(p => !prefix || p.startsWith(cleanPath(prefix))),
      write: (p, c) => { fsMap[cleanPath(p)] = String(c); return true; },
      files: () => Object.keys(fsMap),
    };
    try {
      const fn = new Function('console', 'ws', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'parseInt', 'parseFloat', '"use strict";\n' + code);
      const ret = fn(sandboxConsole, wsApi, JSON, Math, Date, Array, Object, String, Number, parseInt, parseFloat);
      // persist any writes the Action made
      for (const [p, c] of Object.entries(fsMap)) {
        const existing = files.find(f => f.path === p);
        if (!existing || existing.content !== c) await putFile(p, c);
      }
      let out = logs.join('\n');
      if (ret !== undefined) { try { out += (out ? '\n' : '') + '→ ' + (typeof ret === 'object' ? JSON.stringify(ret) : String(ret)); } catch { out += '\n→ [unserializable]'; } }
      return { ok: true, text: out || '(no output)' };
    } catch (e) {
      return { ok: false, text: (logs.join('\n') + (logs.length ? '\n' : '') + 'Runtime error: ' + e.message).trim() };
    }
  };
  /* Execute a workspace tool payload from the AI */
  const execute = async (payload) => {
    if (!enabled()) return { ok: false, text: 'Local workspace is disabled. Ask the user to enable it in Settings → Workspace.' };
    let spec;
    try { spec = typeof payload === 'string' ? JSON.parse(payload.replace(/^```(?:json)?|```$/g, '').trim()) : payload; }
    catch { return { ok: false, text: 'Invalid workspace JSON. Use {"action":"list|read|write|delete|move|search|run|tree|stats","path":"…","content":"…"}.' }; }
    if (!spec || typeof spec !== 'object') return { ok: false, text: 'Workspace payload must be a JSON object.' };
    const action = String(spec.action || '').toLowerCase().trim();
    try {
      switch (action) {
        case 'list': case 'ls': {
          const files = await allFiles();
          const prefix = cleanPath(spec.path || '');
          const shown = files.filter(f => !prefix || f.path.startsWith(prefix + '/') || f.path === prefix);
          if (!shown.length) return { ok: true, text: `Workspace ${prefix ? '"' + prefix + '"' : '(root)'} is empty.` };
          return { ok: true, text: `Workspace files (${shown.length}, prefix "${prefix || '/'}"):\n` + shown.map(f => `- ${f.path} (${new Blob([f.content]).size} B, updated ${new Date(f.updated).toLocaleString()})`).join('\n').slice(0, 40000) };
        }
        case 'tree': {
          const files = await allFiles();
          const dirs = new Set();
          files.forEach(f => {
            const parts = f.path.split('/');
            for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
          });
          return { ok: true, text: `Workspace tree (${files.length} files, ${dirs.size} folders):\n[DIRS]\n${[...dirs].sort().map(d => '  📁 ' + d).join('\n')}\n[FILES]\n${files.map(f => '  📄 ' + f.path).join('\n')}`.slice(0, 50000) };
        }
        case 'read_all': case 'read_many': case 'read_parallel': {
          const paths = Array.isArray(spec.paths) ? spec.paths.map(cleanPath).filter(Boolean) : (await allFiles()).map(f => f.path);
          const results = await Promise.all(paths.map(async p => { const f = await getFile(p); return f ? `=== ${f.path} ===\n${f.content.slice(0, Number(spec.maxCharsPerFile)||30000)}${f.content.length>(Number(spec.maxCharsPerFile)||30000)?'\n…(truncated)':''}` : `=== ${p} ===\nERROR: file not found`; }));
          return { ok: true, text: `Parallel read: ${results.length} file(s).\n\n${results.join('\n\n')}`.slice(0, Number(spec.maxTotalChars)||100000) };
        }
        case 'read_range': case 'read_lines': {
          const p = cleanPath(spec.path); if (!p) return { ok:false, text:'Missing "path".' };
          const f = await getFile(p); if (!f) return { ok:false, text:`File not found: ${p}` };
          const range = getTextRange(f.content, spec.startLine, spec.endLine);
          return { ok:true, text:`=== ${p}:${range.startLine}-${range.endLine} of ${range.totalLines} lines ===\n${range.text}` };
        }
        case 'read_incremental': case 'read_chunk': {
          const p = cleanPath(spec.path); if (!p) return { ok:false, text:'Missing "path".' };
          const f = await getFile(p); if (!f) return { ok:false, text:`File not found: ${p}` };
          const offset = Math.max(0, Number(spec.offset)||0), limit = Math.max(1, Math.min(30000, Number(spec.limit)||8000));
          return { ok:true, text:JSON.stringify({path:p,totalChars:f.content.length,offset,nextOffset:Math.min(f.content.length,offset+limit),done:offset+limit>=f.content.length,content:f.content.slice(offset,offset+limit)}) };
        }
        case 'read': case 'get': {
          const p = cleanPath(spec.path); if (!p) return { ok: false, text: 'Missing "path".' };
          const f = await getFile(p);
          if (!f) { const all = await allFiles(); return { ok: false, text: `File not found: ${p}. Available:\n` + all.map(x => '- ' + x.path).join('\n').slice(0, 6000) }; }
          return { ok: true, text: `=== ${f.path} ===\n${f.content.slice(0, 60000)}${f.content.length > 60000 ? '\n…(truncated, total ' + f.content.length + ' chars)' : ''}` };
        }
        case 'write_many': case 'write_all': case 'write_parallel': {
          if (!Array.isArray(spec.files) || !spec.files.length) return { ok:false, text:'Provide "files": [{"path":"...","content":"..."}, ...].' };
          const results = await Promise.all(spec.files.map(async file => {
            const p = cleanPath(file.path); if (!p) throw new Error('Each batch file requires a valid path.');
            return writeFile(p, file.content !== undefined ? file.content : file.text || '');
          }));
          return { ok:true, text:`Wrote ${results.length} files in parallel:\n`+results.map(x=>`- ${x.path} (${x.chars} chars)`).join('\n') };
        }
        case 'write_range': case 'replace_lines': {
          const p=cleanPath(spec.path); if(!p)return {ok:false,text:'Missing "path".'};
          const f=await getFile(p); if(!f)return {ok:false,text:`File not found: ${p}. Use write to create a new file.`};
          const lines=f.content.split(/\r?\n/), start=Math.max(1,Number(spec.startLine)||1), end=Math.max(start,Number(spec.endLine)||start);
          const replacement=String(spec.content??spec.text??'').split(/\r?\n/);
          lines.splice(start-1,Math.min(end-start+1,Math.max(0,lines.length-start+1)),...replacement);
          await putFile(p,lines.join('\n')); return {ok:true,text:`Updated lines ${start}-${end} in ${p}. File now has ${lines.length} lines.`};
        }
        case 'patch': case 'patch_file': {
          const p=cleanPath(spec.path); if(!p)return {ok:false,text:'Missing "path".'};
          const f=await getFile(p); if(!f)return {ok:false,text:`File not found: ${p}`};
          let next=f.content; const patches=Array.isArray(spec.patches)?spec.patches:[{find:spec.find,replace:spec.replace}];
          let changed=0;
          for(const patch of patches){ if(typeof patch.find!=='string'||!patch.find.length)return {ok:false,text:'Each patch must include a non-empty exact "find" string.'}; const idx=next.indexOf(patch.find); if(idx<0)return {ok:false,text:`Patch aborted: exact match not found in ${p}; no further changes were written.`}; if(patch.all){next=next.split(patch.find).join(String(patch.replace??''));}else{next=next.slice(0,idx)+String(patch.replace??'')+next.slice(idx+patch.find.length);} changed++; }
          await putFile(p,next); return {ok:true,text:`Applied ${changed} exact patch(es) to ${p}.`};
        }
        case 'write': case 'create': case 'update': {
          const p = cleanPath(spec.path); if (!p) return { ok: false, text: 'Missing "path".' };
          const content = spec.content !== undefined ? spec.content : (spec.text !== undefined ? spec.text : '');
          await putFile(p, content);
          return { ok: true, text: `Wrote ${p} (${String(content).length} chars) to local workspace.` };
        }
        case 'deliver': case 'artifact': case 'send_to_chat': {
          const paths=Array.isArray(spec.paths)?spec.paths.map(cleanPath).filter(Boolean):(spec.path?[cleanPath(spec.path)]:[]);
          if(!paths.length)return {ok:false,text:'Provide "path" or "paths" for workspace files to deliver.'};
          const out=[];
          for(const p of paths){const f=await getFile(p);if(!f)return {ok:false,text:`Delivery stopped: ${p} was not found. Previously delivered files remain in chat.`};const rec=await deliverToChat(p,f.content);out.push(`${p} → Library id ${rec.id}, ${f.content.length} chars`);}
          return {ok:true,text:`Delivered ${out.length} workspace file(s) into the current assistant response as downloadable artifacts and saved copies in File Library:\n${out.join('\n')}`};
        }
        case 'delete': case 'rm': {
          const p = cleanPath(spec.path); if (!p) return { ok: false, text: 'Missing "path".' };
          await delFile(p);
          return { ok: true, text: `Deleted ${p}.` };
        }
        case 'move': case 'rename': {
          const from = cleanPath(spec.from || spec.path), to = cleanPath(spec.to);
          if (!from || !to) return { ok: false, text: 'Missing "from" and "to".' };
          const f = await getFile(from); if (!f) return { ok: false, text: `Source not found: ${from}` };
          await putFile(to, f.content); await delFile(from);
          return { ok: true, text: `Moved ${from} → ${to}.` };
        }
        case 'search': case 'grep': {
          const q = String(spec.query || spec.q || spec.term || '').toLowerCase();
          if (!q) return { ok: false, text: 'Missing "query".' };
          const files = await allFiles();
          const hits = [];
          for (const f of files) {
            const idx = f.content.toLowerCase().indexOf(q);
            if (idx >= 0) hits.push(`- ${f.path}: …${f.content.slice(Math.max(0, idx - 50), idx + 150).replace(/\n/g, ' ')}…`);
            if (hits.length >= 15) break;
          }
          return { ok: true, text: hits.length ? `Workspace search for "${q}" (${files.length} files scanned):\n` + hits.join('\n') : `No matches for "${q}" in ${files.length} workspace files.` };
        }
        case 'run': case 'exec': case 'action': {
          const code = spec.code || spec.script || spec.command;
          if (!code) return { ok: false, text: 'Missing "code" (JavaScript to run). Workspace Actions support JS with a `ws` file API + console.log.' };
          const r = await runAction(code);
          return r;
        }
        case 'stats': {
          const files = await allFiles();
          const total = files.reduce((a, f) => a + f.content.length, 0);
          return { ok: true, text: `Workspace stats: ${files.length} files, ${(total / 1024).toFixed(1)} KB stored locally (OPFS with IndexedDB fallback). Remote repository mirroring is disabled.` };
        }
        case 'clear': {
          const files = await allFiles();
          for (const f of files) await delFile(f.path);
          return { ok: true, text: 'Workspace cleared.' };
        }
        default:
          return { ok: false, text: `Unknown workspace action "${action}". Supported: list, tree, read, read_all/read_many, read_range, read_incremental, write, write_many, write_range, patch, deliver, delete, move, search, run, stats, clear.` };
      }
    } catch (e) {
      return { ok: false, text: 'Workspace error: ' + e.message };
    }
  };
  /* UI helper: list files for the workspace panel */
  const listForUI = async () => { try { return await allFiles(); } catch { return []; } };
  /* v2.6 — "suntik script": injected into the system prompt when the
     workspace is enabled (especially always-on). Tells the AI to treat
     the workspace as its live runtime — like a server with the repo
     checked out — so it uses workspace tools directly instead of
     emitting artifact/workflow code fences. */
  const WORKSPACE_SCRIPT = [
    '=== WORKSPACE RUNTIME ACTIVE ===',
    'A local-only workspace is enabled on this device. It is not a GitHub repository or remote server.',
    'RULES (workspace is enabled):',
    '1. For ANY code execution, multi-file project, data processing, or search task, use the <<<TOOL:workspace>>> tool directly (actions: list, tree, read, read_all, read_many, read_range, read_incremental, write, write_many, write_range, patch, deliver, delete, move, search, run, stats).',
    '2. To run code: use {"action":"run","code":"..."}. Inside the code you get a ws object: ws.read(path), ws.write(path, content), ws.list(prefix), ws.exists(path). Capture output with console.log. Write files first, then run, then read results back — iterate like a real engineer.',
    '3. Search inside the workspace is fast and local: use {"action":"search","query":"..."} instead of web search for code/content in the repo.',
    '4. Write project files into the local workspace, verify them, then invoke {"action":"deliver","paths":[...]} to emit downloadable file cards in this response when the user needs the outputs. Do not claim that a file was delivered unless the tool confirms it.',
    '5. DO NOT use workflow/Actions YAML or CI/CD artifacts. Execute code directly via the workspace run action.',
    '6. Prefer the workspace for anything iterative or complex; use web search only for external/live information.',
    '7. After running code, report the console.log output and any files you created/changed (with paths).',
    '8. Writing files is part of your step-by-step work, NOT the final answer. After writing a file, run/test it; if it errors, read it back, correct it, and write it again — iterate until it works. In your final answer, do NOT paste full file contents; summarize the paths you created/changed and the key results.',
    '=== END WORKSPACE RUNTIME ===',
  ].join('\n');
  /* v2.7: injected-script marker (so we can detect an old/foreign script) */
  const SCRIPT_PATH = '.axion/runtime-script.txt';
  const SCRIPT_VERSION = '2.7.0';
  const markerContent = () => `AXION WORKSPACE RUNTIME SCRIPT v${SCRIPT_VERSION}\n\n${WORKSPACE_SCRIPT}`;
  const getScriptStatus = async () => {
    try {
      const f = await getFile(SCRIPT_PATH);
      if (!f) return { exists: false, current: false };
      return { exists: true, current: f.content === markerContent() };
    } catch { return { exists: false, current: false }; }
  };
  const writeScriptMarker = async () => { try { await putFile(SCRIPT_PATH, markerContent()); return true; } catch { return false; } };
  return { execute, enabled, listForUI, getFile, putFile, delFile, allFiles, renderDeliveredArtifacts, WORKSPACE_SCRIPT, getScriptStatus, writeScriptMarker, SCRIPT_PATH };
})();
