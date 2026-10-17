/* Internal AXION terminal. No user-facing terminal panel is created. */
window.AXION = window.AXION || {};
AXION.terminal = (() => {
  const root = 'workspace'; let cwd = '';
  const path = value => {
    const raw = String(value || '').replace(/\\/g, '/'); let parts = [root];
    let input = raw;
    if (input === root || input === '/' + root) input = '';
    else if (input.startsWith(root + '/')) input = input.slice(root.length + 1);
    else if (input.startsWith('/' + root + '/')) input = input.slice(root.length + 2);
    else if (!input.startsWith('/')) parts = [root, ...cwd.split('/').filter(Boolean)];
    else input = input.slice(1);
    for (const segment of input.split('/')) { if (!segment || segment === '.') continue; if (segment === '..') { if (parts.length > 1) parts.pop(); continue; } if (segment.includes('\0')) continue; parts.push(segment); }
    return AXION.storage.fs.validPath(parts.join('/'));
  };
  const textResult = (ok, text, extra) => ({ ok, text, ...(extra || {}) });
  const parse = raw => {
    if (raw && typeof raw === 'object') return raw;
    const s = String(raw || '').trim();
    try { return JSON.parse(s); } catch (_) {}
    const m = s.match(/^([a-z]+)(?:\s+([^\n]+))?(?:\n([\s\S]*))?$/i);
    return m ? { command: m[1], path: (m[2] || '').trim(), content: m[3] || '' } : { command: s };
  };
  const execute = async raw => {
    if (!AXION.storage) return textResult(false, 'Storage layer is unavailable.');
    const spec = parse(raw); const cmd = String(spec.command || spec.cmd || spec.action || '').toLowerCase().trim();
    try {
      await AXION.storage.ready;
      if (cmd === 'pwd') return textResult(true, '/' + [root, cwd].filter(Boolean).join('/'));
      if (cmd === 'cd') { const next = String(spec.path || spec.to || '').trim(); if (!next || next === '/') { cwd = ''; return textResult(true, 'Working directory: /workspace'); } const dest = path(next); const all = await AXION.storage.fs.list(dest); if (!all.length && dest !== root) return textResult(false, 'Directory does not exist: ' + dest); cwd = dest.replace(/^workspace\/?/, ''); return textResult(true, 'Working directory: /' + [root,cwd].filter(Boolean).join('/')); }
      if (cmd === 'ls' || cmd === 'list' || cmd === 'tree') { const p = path(spec.path || ''); const all = await AXION.storage.fs.list(p); return textResult(true, all.length ? all.map(x => `${x.kind === 'directory' ? 'DIR ' : 'FILE'} ${x.path} ${x.size == null ? '' : '(' + x.size + ' bytes)'}`).join('\n') : `No files at /${p}`); }
      if (cmd === 'mkdir') { const p = path(spec.path); if (!p) return textResult(false, 'A path is required.'); await AXION.storage.fs.mkdir(p); return textResult(true, 'Created directory ' + p); }
      if (cmd === 'cat' || cmd === 'read') { const p = path(spec.path); return textResult(true, `=== ${p} ===\n` + (await AXION.storage.fs.read(p)).slice(0, 60000)); }
      if (cmd === 'write' || cmd === 'create' || cmd === 'edit') {
        const p = path(spec.path || spec.file); if (!p || p === root) return textResult(false, 'A file path is required.');
        const content = spec.content !== undefined ? spec.content : (spec.text !== undefined ? spec.text : '');
        await AXION.storage.fs.write(p, String(content), spec.mimeType || 'text/plain;charset=utf-8');
        const rec = await AXION.storage.upsertPath(p, { source: 'terminal', name: p.split('/').pop(), shared: false });
        return textResult(true, `Created/updated private Library file ${p} (${new Blob([String(content)]).size} bytes; id ${rec && rec.id || 'stored'}). It remains private until explicitly shared.`);
      }
      if (cmd === 'rm' || cmd === 'delete') {
        const p = path(spec.path); const all = await AXION.storage.listLibrary(); for (const f of all) if (f.storagePath === p || f.storagePath.startsWith(p + '/')) await AXION.storage.deleteLibrary(f.id);
        await AXION.storage.fs.remove(p); return textResult(true, 'Removed ' + p);
      }
      if (cmd === 'mv' || cmd === 'move' || cmd === 'rename') {
        const from = path(spec.from || spec.path), to = path(spec.to); if (!from || !to) return textResult(false, 'Specify from and to paths.');
        await AXION.storage.fs.move(from, to); const all = await AXION.storage.listLibrary(); for (const f of all) if (f.storagePath === from || f.storagePath.startsWith(from + '/')) { const oldPath = f.storagePath; f.storagePath = to + oldPath.slice(from.length); if (oldPath === from) f.name = to.split('/').pop(); f.relativePath = f.storagePath.replace(/^workspace\/?/, ''); await AXION.storage.put('library', f); }
        return textResult(true, `Moved ${from} → ${to}`);
      }
      if (cmd === 'zip') {
        if (typeof JSZip === 'undefined') return textResult(false, 'JSZip is not loaded.');
        const prefix = path(spec.path || ''); const entries = (await AXION.storage.fs.list(prefix)).filter(x => x.kind === 'file'); const zip = new JSZip();
        for (const f of entries) { const blob = await AXION.storage.fs.readBlob(f.path); zip.file(f.path.replace(/^workspace\/?/, ''), blob); }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }); const name = spec.name || ((prefix.split('/').pop() || 'workspace') + '.zip');
        const rec = await AXION.storage.addLibraryFile(new File([blob], name, { type: 'application/zip' }), { source: 'terminal', shared: false, allowDuplicate: true });
        return textResult(true, `Created private ZIP ${name} (${blob.size} bytes) in File Library. ID: ${rec.id}. Use command share with id to explicitly share it.`);
      }
      if (cmd === 'unzip' || cmd === 'extract') {
        if (typeof JSZip === 'undefined') return textResult(false, 'JSZip is not loaded.');
        let pair; if (spec.id) pair = await AXION.storage.getLibraryBlob(spec.id); else { const f = (await AXION.storage.listLibrary()).find(x => x.name === spec.name || x.storagePath === spec.path); if (!f) return textResult(false, 'ZIP not found in Library; provide id or name.'); pair = await AXION.storage.getLibraryBlob(f.id); }
        const zip = await JSZip.loadAsync(pair.blob); let count = 0;
        for (const [name, entry] of Object.entries(zip.files)) { if (entry.dir) continue; const full = path(String(spec.dest || '').replace(/\/$/, '') + '/' + name); const blob = await entry.async('blob'); await AXION.storage.fs.writeBlob(full, blob); await AXION.storage.upsertPath(full, { source: 'zip-extract', name: name.split('/').pop(), relativePath: name, shared: false }); count++; }
        return textResult(true, `Extracted ${count} files into /${[root, spec.dest || ''].filter(Boolean).join('/')}; extracted files remain private in File Library.`);
      }
      if (cmd === 'share' || cmd === 'publish') {
        let rec = spec.id ? await AXION.storage.getLibrary(spec.id) : (await AXION.storage.listLibrary()).find(x => x.name === spec.name || x.storagePath === path(spec.path));
        if (!rec) return textResult(false, 'File not found. Supply its Library id, name, or path.');
        const result = await AXION.storage.markShared(rec.id, true);
        if (AXION.shareLibraryFile) await AXION.shareLibraryFile(result.id);
        return textResult(true, `Explicitly shared ${rec.name}; it has been added to the conversation and is downloadable.`);
      }
      if (cmd === 'stat' || cmd === 'stats') { const all = await AXION.storage.fs.list(root); const files = all.filter(x => x.kind === 'file'); return textResult(true, `${files.length} workspace files, ${files.reduce((a,x)=>a+(x.size||0),0)} bytes. Current directory: /${[root,cwd].filter(Boolean).join('/')}`); }
      return textResult(false, 'Supported internal terminal commands: pwd, cd, ls/tree, mkdir, cat/read, write/create/edit, mv, rm, zip, unzip, share, stats. Use JSON: {"command":"write","path":"src/app.js","content":"..."}.');
    } catch (e) { return textResult(false, `${cmd || 'command'} failed: ${e.message}`); }
  };
  return { execute, get cwd() { return cwd; }, reset: () => { cwd = ''; } };
})();
