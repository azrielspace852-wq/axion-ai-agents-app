/* AXION persistent storage layer v3.
 * Structured state -> IndexedDB. File bytes -> OPFS (with IndexedDB Blob fallback).
 * localStorage remains a small compatibility cache for legacy synchronous modules.
 */
window.AXION = window.AXION || {};
AXION.storage = (() => {
  const DB_NAME = 'axion_ai_storage_v3';
  const DB_VERSION = 2;
  let dbPromise;
  const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error || new Error('IndexedDB request failed')); });
  const open = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB is unavailable')); return; }
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'path' });
        if (!db.objectStoreNames.contains('memory')) db.createObjectStore('memory', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('dirs')) db.createObjectStore('dirs', { keyPath: 'path' });
      };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    return dbPromise;
  };
  const run = async (storeName, mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode); const store = tx.objectStore(storeName); let result;
      try { result = fn(store); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  };
  const get = async (store, key) => request((await open()).transaction(store, 'readonly').objectStore(store).get(key));
  const all = async (store) => request((await open()).transaction(store, 'readonly').objectStore(store).getAll());
  const put = (store, value) => run(store, 'readwrite', s => s.put(value));
  const del = (store, key) => run(store, 'readwrite', s => s.delete(key));
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const validPath = (p) => String(p || '').replace(/\\/g, '/').split('/').filter(s => s && s !== '.' && s !== '..').join('/');
  let opfsRootPromise;
  const opfsRoot = async () => {
    if (!navigator.storage || !navigator.storage.getDirectory) throw new Error('OPFS is unavailable in this browser/origin');
    if (!opfsRootPromise) opfsRootPromise = navigator.storage.getDirectory().then(root => root.getDirectoryHandle('axion-ai', { create: true }));
    return opfsRootPromise;
  };
  const recordFallbackParents = async path => { const parts = validPath(path).split('/').filter(Boolean); parts.pop(); let current = ''; for (const part of parts) { current = current ? current + '/' + part : part; await put('dirs', { path: current, updated: Date.now() }).catch(() => {}); } };
  const dirFor = async (path, create) => {
    const parts = validPath(path).split('/').filter(Boolean); const file = parts.pop(); let dir = await opfsRoot();
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: !!create });
    return { dir, file };
  };
  const writeBlob = async (path, blob) => {
    path = validPath(path); if (!path) throw new Error('File path is empty');
    try {
      const { dir, file } = await dirFor(path, true); const h = await dir.getFileHandle(file, { create: true }); const w = await h.createWritable(); await w.write(blob); await w.close();
      await del('blobs', path).catch(() => {}); return { backend: 'opfs', path };
    } catch (e) {
      await recordFallbackParents(path); await put('blobs', { path, blob, updated: Date.now() }); return { backend: 'indexeddb-fallback', path, warning: e.message };
    }
  };
  const readBlob = async (path) => {
    path = validPath(path);
    try { const { dir, file } = await dirFor(path, false); const h = await dir.getFileHandle(file); return await h.getFile(); }
    catch (e) { const rec = await get('blobs', path); if (rec && rec.blob) return rec.blob; throw e; }
  };
  const readText = async (path) => (await readBlob(path)).text();
  const removePath = async (path) => {
    path = validPath(path); if (!path) return false; let removed = false;
    try { const { dir, file } = await dirFor(path, false); await dir.removeEntry(file, { recursive: true }); removed = true; } catch (_) { try { const { dir, file } = await dirFor(path, false); await dir.removeEntry(file); removed = true; } catch (_) {} }
    const blobs = await all('blobs'); for (const item of blobs) if (item.path === path || item.path.startsWith(path + '/')) { await del('blobs', item.path).catch(() => {}); removed = true; }
    const dirs = await all('dirs'); for (const item of dirs) if (item.path === path || item.path.startsWith(path + '/')) { await del('dirs', item.path).catch(() => {}); removed = true; }
    return removed;
  };
  const listPath = async (prefix = '') => {
    prefix = validPath(prefix); const out = [];
    const walk = async (dir, base) => {
      for await (const [name, h] of dir.entries()) {
        const path = base ? base + '/' + name : name;
        if (h.kind === 'directory') { if (!out.some(y => y.path === path)) out.push({ path, kind: 'directory' }); await walk(h, path); }
        else { const f = await h.getFile(); if (!out.some(y => y.path === path)) out.push({ path, kind: 'file', size: f.size, type: f.type, updated: f.lastModified }); }
      }
    };
    try { await walk(await opfsRoot(), ''); } catch (_) {}
    const fallback = await all('blobs');
    fallback.forEach(x => { if (!out.some(y => y.path === x.path)) out.push({ path: x.path, kind: 'file', size: x.blob.size, type: x.blob.type, updated: x.updated, fallback: true }); });
    const dirs = await all('dirs'); dirs.forEach(x => { if (!out.some(y => y.path === x.path)) out.push({ path: x.path, kind: 'directory', updated: x.updated, fallback: true }); });
    return out.filter(x => !prefix || x.path === prefix || x.path.startsWith(prefix.replace(/\/$/, '') + '/')).sort((a,b) => a.path.localeCompare(b.path));
  };
  const mkdir = async (path) => {
    const p = validPath(path); if (!p) return; let d;
    try { d = await opfsRoot(); for (const part of p.split('/')) d = await d.getDirectoryHandle(part, { create: true }); }
    catch (_) { let current = ''; for (const part of p.split('/')) { current = current ? current + '/' + part : part; await put('dirs', { path: current, updated: Date.now() }); } }
  };
  const movePath = async (from, to) => {
    from = validPath(from); to = validPath(to); if (!from || !to || from === to || to.startsWith(from + '/')) throw new Error('Invalid move target');
    const entries = await listPath(from); const self = entries.find(x => x.path === from);
    if (self && self.kind === 'directory') {
      await mkdir(to);
      for (const entry of entries.filter(x => x.path !== from).sort((a,b) => a.path.length - b.path.length)) {
        const dest = to + entry.path.slice(from.length);
        if (entry.kind === 'directory') await mkdir(dest);
        else await writeBlob(dest, await readBlob(entry.path));
      }
      await removePath(from); return { from, to, directory: true, count: entries.length - 1 };
    }
    const b = await readBlob(from); await writeBlob(to, b); await removePath(from); return { from, to, directory: false };
  };
  const fs = { validPath, write: async (p, content, type) => writeBlob(p, content instanceof Blob ? content : new Blob([String(content ?? '')], { type: type || 'text/plain;charset=utf-8' })), writeBlob, read: readText, readBlob, remove: removePath, list: listPath, mkdir, move: movePath };
  const now = () => Date.now();
  const fileKey = (meta) => [meta.name, meta.size, meta.lastModified || 0, meta.type || ''].join('|');
  const addLibraryFile = async (file, opts = {}) => {
    const name = String(opts.name || file.name || 'file').split(/[\\/]/).pop(); const size = Number(file.size || 0);
    const entries = await all('library');
    if (!opts.allowDuplicate) { const dupe = entries.find(x => x.fingerprint === fileKey({ name, size, lastModified: opts.lastModified || file.lastModified, type: opts.mimeType || file.type })); if (dupe) return { ...dupe, duplicate: true }; }
    const id = opts.id || ('f_' + (crypto.randomUUID ? crypto.randomUUID() : now().toString(36) + Math.random().toString(36).slice(2)));
    const path = opts.storagePath || ('library/files/' + id);
    const blob = file instanceof Blob ? file : new Blob([file], { type: opts.mimeType || 'application/octet-stream' });
    const backend = await writeBlob(path, blob);
    const record = { id, name, mimeType: opts.mimeType || blob.type || 'application/octet-stream', size: blob.size, createdAt: opts.createdAt || now(), updatedAt: now(), storagePath: path, source: opts.source || 'upload', shared: !!opts.shared, folder: opts.folder || '', relativePath: opts.relativePath || name, fingerprint: fileKey({ name, size: blob.size, lastModified: opts.lastModified || blob.lastModified, type: opts.mimeType || blob.type }), backend: backend.backend, ...(opts.conversationId ? { conversationId: opts.conversationId } : {}) };
    await put('library', record); return record;
  };
  const upsertPath = async (path, opts = {}) => {
    path = validPath(path); const entries = await all('library'); const name = opts.name || path.split('/').pop();
    let rec = entries.find(x => x.storagePath === path);
    let blob; try { blob = await readBlob(path); } catch (_) { return null; }
    rec = { ...(rec || {}), id: rec ? rec.id : ('f_' + now().toString(36) + Math.random().toString(36).slice(2,7)), name, mimeType: opts.mimeType || blob.type || 'application/octet-stream', size: blob.size, createdAt: rec ? rec.createdAt : now(), updatedAt: now(), storagePath: path, source: opts.source || 'terminal', shared: opts.shared !== undefined ? !!opts.shared : (rec ? rec.shared : false), folder: opts.folder || '', relativePath: opts.relativePath || path.replace(/^workspace\/?/, ''), fingerprint: fileKey({ name, size: blob.size, lastModified: blob.lastModified, type: opts.mimeType || blob.type }) };
    await put('library', rec); return rec;
  };
  const listLibrary = async () => (await all('library')).sort((a,b) => b.updatedAt - a.updatedAt);
  const getLibrary = (id) => get('library', id);
  const deleteLibrary = async (id) => { const x = await getLibrary(id); if (!x) return false; await removePath(x.storagePath); await del('library', id); return true; };
  const getLibraryBlob = async (id) => { const x = await getLibrary(id); if (!x) throw new Error('File not found in Library'); return { meta: x, blob: await readBlob(x.storagePath) }; };
  const markShared = async (id, shared = true) => { const x = await getLibrary(id); if (!x) throw new Error('File not found'); x.shared = shared; x.updatedAt = now(); await put('library', x); return x; };
  const saveTask = (task) => put('tasks', { ...task, updatedAt: now() });
  const listTasks = () => all('tasks');
  const saveMemory = (summary) => put('memory', { id: 'conversation-summary', summary: String(summary || ''), updatedAt: now() });
  const getMemory = async () => (await get('memory', 'conversation-summary')) || { summary: '', updatedAt: 0 };
  const saveValue = (key, value) => put('kv', { key, value, updatedAt: now() });
  const getValue = async (key) => { const r = await get('kv', key); return r ? r.value : undefined; };
  const dumpValues = async () => all('kv');

  // Keep the legacy sync cache working, while mirroring every structured AXION key into IndexedDB.
  const ls = window.localStorage; const nativeSet = ls.setItem.bind(ls); const nativeRemove = ls.removeItem.bind(ls);
  const tracked = key => /^axion_/i.test(String(key));
  try {
    ls.setItem = function (key, value) { nativeSet(key, value); if (tracked(key)) saveValue(String(key), String(value)).catch(() => {}); };
    ls.removeItem = function (key) { nativeRemove(key); if (tracked(key)) del('kv', String(key)).catch(() => {}); };
  } catch (_) {}
  const ready = (async () => {
    try {
      await open();
      const old = [];
      for (let i=0; i<ls.length; i++) { const k = ls.key(i); if (k && tracked(k)) old.push([k, ls.getItem(k)]); }
      // Migrate any legacy localStorage values not yet present, then restore IndexedDB as the authoritative source.
      for (const [key, value] of old) if (await getValue(key) === undefined) await saveValue(key, value);
      const durable = await all('kv');
      for (const entry of durable) if (tracked(entry.key) && entry.value !== undefined) { try { nativeSet(entry.key, String(entry.value)); } catch (_) {} }
      window.dispatchEvent(new CustomEvent('axion:storage-ready', { detail: { backend: navigator.storage && navigator.storage.getDirectory ? 'OPFS + IndexedDB' : 'IndexedDB fallback' } }));
      return { ok: true, backend: navigator.storage && navigator.storage.getDirectory ? 'OPFS + IndexedDB' : 'IndexedDB fallback' };
    } catch (e) { return { ok: false, error: e.message, backend: 'localStorage fallback' }; }
  })();
  return { ready, fs, addLibraryFile, upsertPath, listLibrary, getLibrary, deleteLibrary, getLibraryBlob, markShared, saveTask, listTasks, saveMemory, getMemory, saveValue, getValue, dumpValues, get, all, put, del, writeBlob, readBlob, readText, removePath, now };
})();
