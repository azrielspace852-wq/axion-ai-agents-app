/* =========================================================
   AXION AI — Git integration & Knowledge base (v2.4)

   ROOT CAUSES FIXED (v2.4):
   1. AI sends  {"repo":"owner/name"}  → old code read spec.owner (undefined)
      and called /repos/undefined/... Now owner/repo are normalised from
      "owner/name", full_name, or a repo URL; owner defaults to the saved
      username, then to the token's own login.
   2. Branch hard-coded to "main" → fails on "master"/custom defaults.
      Now the repo's real default_branch is looked up and cached.
   3. GitHub paths were encoded with %2F (encodeURIComponent on the whole
      path) → 404 for nested files. Now encoded per segment (GitLab keeps
      its required %2F form).
   4. atob() returns Latin-1 → UTF-8 files were garbled. Proper UTF-8 decode.
   5. Token with trailing space/newline → "Failed to fetch". Now trimmed.
   6. Content-Type on GET + extra headers forced CORS preflights. Removed.
   7. Gitea needs "Authorization: token …". Handled per provider.
   8. confirm() is blocked in many mobile/PWA browsers → denied silently.
      Replaced by an in-page modal (confirm() only as last resort).
   9. Errors were opaque. Every failure now says WHY and what to check.
   10. Knowledge sync used codeload.github.com (no CORS) + proxy → failed.
      Now: Git Trees API + raw.githubusercontent.com (both CORS-enabled),
      ZIP as fallback.
   Token stays only in localStorage on this device.
   ========================================================= */
window.AXION = window.AXION || {};

AXION.git = (() => {
  const KNOWLEDGE_KEY = 'axion_knowledge_v1';
  let knowledge = { files: {}, updated: null };

  const loadKnowledge = () => {
    try { const raw = localStorage.getItem(KNOWLEDGE_KEY); if (raw) knowledge = JSON.parse(raw); }
    catch (e) { knowledge = { files: {}, updated: null }; }
  };
  const saveKnowledge = () => {
    try { localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledge)); } catch (e) { /* quota */ }
  };

  /* ---------- UTF-8 helpers ---------- */
  const b64decodeUtf8 = (b64) => {
    const bin = atob(String(b64 || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  };
  const b64encodeUtf8 = (str) => {
    const bytes = new TextEncoder().encode(str || '');
    let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };

  /* ---------- Knowledge repo sync ---------- */
  const parseRepoUrl = (url) => {
    const m = String(url || '').match(/github\.com\/([^\/]+)\/([^\/\s#?]+?)(\.git)?\/?$/);
    return m ? { owner: m[1], repo: m[2] } : null;
  };
  const TEXT_EXT = /\.(md|txt|json|js|ts|py|html|css|csv|yaml|yml|xml|log|ini|cfg|toml|sh)$/i;

  const pool = async (items, limit, worker) => {
    const out = []; let i = 0;
    const run = async () => { while (i < items.length) { const k = i++; out[k] = await worker(items[k]).catch(() => null); } };
    await Promise.all(Array.from({ length: limit }, run));
    return out;
  };

  const syncViaTree = async (info) => {
    let lastErr = null;
    for (const br of ['main', 'master']) {
      try {
        const res = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}/git/trees/${br}?recursive=1`,
          { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) { lastErr = new Error(`tree ${br}: HTTP ${res.status}`); continue; }
        const data = await res.json();
        let entries = (data.tree || []).filter(e => e.type === 'blob' && TEXT_EXT.test(e.path) && (e.size || 0) < 200000);
        entries.sort((a, b) => (/\.md$/i.test(b.path) ? 1 : 0) - (/\.md$/i.test(a.path) ? 1 : 0));
        entries = entries.slice(0, 150);
        const texts = await pool(entries, 8, async (e) => {
          const r = await fetch(`https://raw.githubusercontent.com/${info.owner}/${info.repo}/${br}/${e.path.split('/').map(encodeURIComponent).join('/')}`,
            { signal: AbortSignal.timeout(15000) });
          if (!r.ok) throw new Error('raw ' + r.status);
          return r.text();
        });
        const files = {};
        entries.forEach((e, k) => { if (texts[k] != null) files[e.path] = texts[k]; });
        if (!Object.keys(files).length) { lastErr = new Error('no readable text files'); continue; }
        return { files, branch: br };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('tree sync failed');
  };

  const syncViaZip = async (info) => {
    if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
    let blob = null, used = null;
    for (const br of ['main', 'master']) {
      const url = `https://codeload.github.com/${info.owner}/${info.repo}/zip/refs/heads/${br}`;
      const tries = [url, 'https://corsproxy.io/?url=' + encodeURIComponent(url), 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)];
      for (const t of tries) {
        try { const r = await fetch(t, { signal: AbortSignal.timeout(25000) }); if (r.ok) { blob = await r.blob(); used = br; break; } } catch { /* next */ }
      }
      if (blob) break;
    }
    if (!blob) throw new Error('zip download failed (CORS/network)');
    const z = await JSZip.loadAsync(blob);
    const files = {}; let count = 0;
    const prefixRe = new RegExp('^' + info.repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-' + used + '/');
    for (const [path, entry] of Object.entries(z.files)) {
      if (entry.dir) continue;
      const cleanPath = path.replace(prefixRe, '');
      if (!TEXT_EXT.test(cleanPath)) continue;
      const content = await entry.async('string');
      if (content.length > 200000) continue;
      files[cleanPath] = content;
      if (++count > 300) break;
    }
    return { files, branch: used };
  };

  const syncKnowledge = async (repoUrl) => {
    const info = parseRepoUrl(repoUrl || AXION.APP.knowledgeRepo);
    if (!info) throw new Error('Unsupported repo URL (GitHub only for auto-sync).');
    let r, err1 = null;
    try { r = await syncViaTree(info); } catch (e) { err1 = e; }
    if (!r) {
      try { r = await syncViaZip(info); }
      catch (e2) { throw new Error(`Could not sync knowledge repo. Tree API: ${err1 && err1.message}. ZIP: ${e2.message}. (Repo must be public; GitHub API allows 60 requests/hour without a token.)`); }
    }
    knowledge = { files: r.files, updated: new Date().toISOString(), repo: repoUrl, branch: r.branch };
    saveKnowledge();
    AXION.settings.knowledgeSynced = true;
    AXION.saveSettings();
    return { fileCount: Object.keys(r.files).length, branch: r.branch };
  };

  const searchKnowledge = (query) => {
    const q = (query || '').toLowerCase();
    const paths = Object.keys(knowledge.files);
    if (!paths.length) return 'Knowledge base empty. Sync the knowledge repo in Settings first.';
    const exact = paths.find(p => p.toLowerCase().includes(q) && q.length > 2);
    if (exact) return `=== ${exact} ===\n${knowledge.files[exact].slice(0, 32000)}`;
    const hits = [];
    const terms = q.split(/\s+/).filter(Boolean);
    for (const p of paths) {
      const content = knowledge.files[p].toLowerCase();
      let score = 0;
      for (const t of terms) if (content.includes(t)) score++;
      if (score > 0) hits.push({ path: p, score, preview: knowledge.files[p].slice(0, 400) });
    }
    hits.sort((a, b) => b.score - a.score);
    if (!hits.length) return `No matches in knowledge base (${paths.length} files indexed). Files:\n` + paths.slice(0, 50).join('\n');
    return `Knowledge base matches for "${query}" (${paths.length} files indexed):\n\n` +
      hits.slice(0, 5).map(h => `--- ${h.path} (score ${h.score}) ---\n${h.preview}...`).join('\n\n');
  };

  const readKnowledgeFile = (path) => {
    const found = Object.keys(knowledge.files).find(p => p.toLowerCase().endsWith(path.toLowerCase()) || p.toLowerCase().includes(path.toLowerCase()));
    if (!found) return `File not found: ${path}. Available files:\n` + Object.keys(knowledge.files).slice(0, 100).join('\n');
    return `=== ${found} ===\n${knowledge.files[found].slice(0, 60000)}`;
  };

  /* ---------- User git REST API ---------- */
  const provider = () => AXION.settings.gitProvider || 'github';
  const isGithub = () => provider() === 'github';
  const isGitlab = () => provider() === 'gitlab';
  const apiBase = () => {
    const custom = (AXION.settings.gitBaseUrl || '').trim().replace(/\/+$/, '');
    if (isGitlab()) return custom || 'https://gitlab.com/api/v4';
    if (provider() === 'gitea' || provider() === 'custom') return custom;
    return custom || 'https://api.github.com';
  };
  // Trim: a trailing space/newline in the token makes fetch throw "Failed to fetch"
  const token = () => (localStorage.getItem('axion_git_token') || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');

  const authHeaders = () => {
    const t = token();
    const h = { Accept: isGithub() ? 'application/vnd.github+json' : 'application/json' };
    if (t) h.Authorization = (provider() === 'gitea') ? 'token ' + t : 'Bearer ' + t;
    return h;
  };

  const HINTS = {
    401: 'Token invalid, expired or lacks access. Create a new token and paste it in Settings → Git.',
    403: 'Forbidden: token scope too small (needs "repo" / "contents:write"), SSO authorisation missing, or API rate limit hit.',
    404: 'Not found: wrong owner/repo/branch/path — or the repo is private and the token cannot see it.',
    409: 'Conflict: file changed remotely (stale sha) or branch/ref problem.',
    422: 'Rejected: invalid input, or the file/repo/branch already exists.',
  };

  const api = async (method, path, body) => {
    const base = apiBase();
    if (!base) throw new Error('No Base URL configured for this git provider (Settings → Git → Base URL).');
    const opt = { method, headers: authHeaders() };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(base + path, opt); }
    catch (e) {
      throw new Error(`Network/CORS error calling ${base}. Check internet, the Base URL, and that the server allows browser (CORS) requests${isGithub() ? '' : ' — self-hosted servers must enable CORS'}. (${e.message})`);
    }
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 1500) }; }
    if (!res.ok) {
      const msg = (json && (json.message || json.error || json.raw)) || '';
      throw new Error(`Git API ${res.status} ${method} ${path.split('?')[0]}: ${String(msg).slice(0, 300)} — ${HINTS[res.status] || ''}`.trim());
    }
    return json;
  };

  /* Encode a repo file path correctly for each provider */
  const encPath = (p) => isGitlab() ? encodeURIComponent(p) : String(p).split('/').map(encodeURIComponent).join('/');
  const projId = (o, r) => encodeURIComponent(`${o}/${r}`);

  /* ---------- Spec normalisation ---------- */
  let whoamiCache = null;
  const whoami = async () => {
    if (whoamiCache) return whoamiCache;
    const u = await api('GET', isGitlab() ? '/user' : '/user');
    whoamiCache = u.login || u.username || '';
    return whoamiCache;
  };

  const normalizeSpec = async (spec) => {
    const s = { ...spec };
    s.action = String(s.action || '').toLowerCase().trim();
    // aliases the model tends to use
    s.path = s.path || s.file || s.filepath || s.file_path || s.filename || s.dir || '';
    if (s.content === undefined) s.content = s.text !== undefined ? s.text : (s.contents !== undefined ? s.contents : s.body);
    s.branch = s.branch || s.ref;
    s.message = s.message || s.commit_message || s.msg || 'Update via AXION AI';
    // owner / repo from "owner/name", full_name, or URL
    let repoStr = s.repo || s.repository || s.full_name || s.project || '';
    if (/^https?:\/\//i.test(repoStr)) { const m = repoStr.match(/^https?:\/\/[^\/]+\/(.+?)(\.git)?\/?$/); if (m) repoStr = m[1]; }
    if (repoStr.includes('/')) { const parts = repoStr.split('/'); s.repo = parts.pop(); s.owner = s.owner || parts.join('/'); }
    else if (repoStr) s.repo = repoStr;
    if (s.name && !s.repo && s.action !== 'create_repo') s.repo = s.name;
    if (!s.owner && s.repo) s.owner = (AXION.settings.gitUsername || '').trim() || await whoami();
    return s;
  };

  const needRepo = (s) => {
    if (!s.owner || !s.repo) throw new Error('Missing repo. Provide {"repo":"owner/name"} (or "owner" and "repo").');
  };

  const defaultBranchCache = {};
  const defaultBranch = async (s) => {
    const key = s.owner + '/' + s.repo;
    if (defaultBranchCache[key]) return defaultBranchCache[key];
    const d = await api('GET', isGitlab() ? `/projects/${projId(s.owner, s.repo)}` : `/repos/${s.owner}/${s.repo}`);
    return (defaultBranchCache[key] = d.default_branch || 'main');
  };
  const branchOf = async (s) => s.branch || await defaultBranch(s);

  /* ---------- Permission gate ---------- */
  const WRITE_ACTIONS = new Set(['create_repo', 'update_file', 'create_file', 'delete_file', 'create_branch', 'push', 'commit_files', 'create_issue', 'create_pull_request', 'delete_repo', 'add_collaborator', 'merge_pr', 'close_issue', 'create_pr']);

  const checkPermission = (action) => {
    const level = AXION.settings.gitPermission || 'medium';
    if (!WRITE_ACTIONS.has(action)) return { allow: true, mode: 'read' };
    if (level === 'low') return { allow: false, reason: AXION.t('permissionLowBlocked') };
    if (level === 'high') return { allow: true, mode: 'auto' };
    return { allow: null, mode: 'ask' };
  };

  /* In-page confirmation modal (confirm() is blocked on many mobile browsers) */
  const askUser = (message, detail) => AXION.ui.confirm(AXION.t('confirmAction'), message, detail);

  const describe = (s) => {
    const copy = { ...s };
    if (typeof copy.content === 'string' && copy.content.length > 300) copy.content = copy.content.slice(0, 300) + `… (${s.content.length} chars)`;
    if (Array.isArray(copy.files)) copy.files = copy.files.map(f => ({ path: f.path, bytes: String(f.content || '').length }));
    return JSON.stringify(copy, null, 2).slice(0, 1200);
  };

  /* ---------- Actions ---------- */
  const listDir = async (s, branch) => {
    if (isGitlab()) {
      const d = await api('GET', `/projects/${projId(s.owner, s.repo)}/repository/tree?ref=${encodeURIComponent(branch)}&per_page=100${s.path ? '&path=' + encodeURIComponent(s.path) : ''}`);
      return d.map(x => `- ${x.type} ${x.path}`).join('\n');
    }
    const d = await api('GET', `/repos/${s.owner}/${s.repo}/contents/${s.path ? encPath(s.path) : ''}?ref=${encodeURIComponent(branch)}`);
    return (Array.isArray(d) ? d : [d]).map(x => `- ${x.type} ${x.path}${x.size ? ' (' + x.size + ' B)' : ''}`).join('\n');
  };

  const getFileText = async (s, branch) => {
    if (isGitlab()) {
      const d = await api('GET', `/projects/${projId(s.owner, s.repo)}/repository/files/${encPath(s.path)}?ref=${encodeURIComponent(branch)}`);
      return { text: b64decodeUtf8(d.content), sha: d.blob_id || d.content_sha256 || '', path: d.file_path };
    }
    const d = await api('GET', `/repos/${s.owner}/${s.repo}/contents/${encPath(s.path)}?ref=${encodeURIComponent(branch)}`);
    if (Array.isArray(d)) return { dir: d };
    let text = d.content ? b64decodeUtf8(d.content) : '';
    if (!text && d.download_url) { const r = await fetch(d.download_url); if (r.ok) text = await r.text(); } // >1 MB files
    return { text, sha: d.sha, path: d.path };
  };

  const writeFile = async (s, branch) => {
    const body = { message: s.message, content: b64encodeUtf8(s.content == null ? '' : String(s.content)), branch };
    if (isGitlab()) {
      const url = `/projects/${projId(s.owner, s.repo)}/repository/files/${encPath(s.path)}`;
      let exists = true;
      try { await api('GET', `${url}?ref=${encodeURIComponent(branch)}`); } catch { exists = false; }
      body.encoding = 'base64';
      await api(exists ? 'PUT' : 'POST', url, body);
      return `File ${exists ? 'updated' : 'created'}: ${s.path} on ${branch}`;
    }
    try {
      const ex = await api('GET', `/repos/${s.owner}/${s.repo}/contents/${encPath(s.path)}?ref=${encodeURIComponent(branch)}`);
      if (ex && ex.sha) body.sha = ex.sha;
    } catch { /* new file */ }
    const d = await api('PUT', `/repos/${s.owner}/${s.repo}/contents/${encPath(s.path)}`, body);
    return `File ${body.sha ? 'updated' : 'created'}: ${(d.content && d.content.path) || s.path} on ${branch} (commit ${d.commit && d.commit.sha ? d.commit.sha.slice(0, 8) : '?'})`;
  };

  const run = async (s) => {
    switch (s.action) {
      case 'whoami': case 'get_user': {
        const u = await api('GET', '/user');
        return `Authenticated as: ${u.login || u.username}${u.name ? ' (' + u.name + ')' : ''}`;
      }
      case 'list_repos': {
        if (isGithub()) {
          const d = await api('GET', '/user/repos?per_page=100&sort=updated');
          return 'Repositories:\n' + d.map(r => `- ${r.full_name} (${r.private ? 'private' : 'public'}, default: ${r.default_branch}, ${r.language || 'n/a'}) ${r.description || ''}`).join('\n');
        }
        if (isGitlab()) {
          const d = await api('GET', '/projects?membership=true&per_page=100&order_by=last_activity_at');
          return 'Projects:\n' + d.map(p => `- ${p.path_with_namespace} (${p.visibility}, default: ${p.default_branch})`).join('\n');
        }
        const d = await api('GET', '/user/repos?limit=50');
        return 'Repositories:\n' + (d.data || d).map(r => `- ${r.full_name} (${r.private ? 'private' : 'public'}, default: ${r.default_branch})`).join('\n');
      }
      case 'get_repo': {
        needRepo(s);
        const d = await api('GET', isGitlab() ? `/projects/${projId(s.owner, s.repo)}` : `/repos/${s.owner}/${s.repo}`);
        return `Repo: ${d.full_name || d.path_with_namespace}\nDefault branch: ${d.default_branch}\nVisibility: ${d.private === undefined ? d.visibility : (d.private ? 'private' : 'public')}\nDescription: ${d.description || '-'}\nURL: ${d.html_url || d.web_url}`;
      }
      case 'list_files': case 'list_dir': case 'ls': {
        needRepo(s);
        const br = await branchOf(s);
        return `Directory "${s.path || '/'}" @ ${br}:\n` + await listDir(s, br);
      }
      case 'get_file': case 'read_file': {
        needRepo(s);
        if (!s.path) throw new Error('Missing "path".');
        const br = await branchOf(s);
        const f = await getFileText(s, br);
        if (f.dir) return `Directory ${s.path}:\n` + f.dir.map(x => `- ${x.type} ${x.path}`).join('\n');
        return `=== ${f.path} @ ${br} (${f.sha ? f.sha.slice(0, 8) : ''}) ===\n${f.text.slice(0, 60000)}${f.text.length > 60000 ? '\n…(truncated)' : ''}`;
      }
      case 'create_file': case 'update_file': {
        needRepo(s);
        if (!s.path) throw new Error('Missing "path".');
        return await writeFile(s, await branchOf(s));
      }
      case 'push': case 'commit_files': {
        needRepo(s);
        const files = Array.isArray(s.files) ? s.files : [];
        if (!files.length) throw new Error('Missing "files":[{"path":"…","content":"…"}].');
        const br = await branchOf(s);
        const out = [];
        for (const f of files) out.push(await writeFile({ ...s, path: f.path, content: f.content, message: f.message || s.message }, br));
        return out.join('\n');
      }
      case 'delete_file': {
        needRepo(s);
        const br = await branchOf(s);
        if (isGitlab()) {
          await api('DELETE', `/projects/${projId(s.owner, s.repo)}/repository/files/${encPath(s.path)}`, { branch: br, commit_message: s.message });
        } else {
          const f = await getFileText(s, br);
          await api('DELETE', `/repos/${s.owner}/${s.repo}/contents/${encPath(s.path)}`, { message: s.message, sha: f.sha, branch: br });
        }
        return `File deleted: ${s.path} on ${br}`;
      }
      case 'create_repo': {
        const name = s.name || s.repo;
        if (!name) throw new Error('Missing "name".');
        const priv = s.private !== undefined ? !!s.private : true;
        if (isGithub()) {
          const d = await api('POST', '/user/repos', { name, private: priv, description: s.description || '', auto_init: true });
          return `Repository created: ${d.full_name} — ${d.html_url} (default branch ${d.default_branch || 'main'})`;
        }
        if (isGitlab()) {
          const d = await api('POST', '/projects', { name, visibility: priv ? 'private' : 'public', description: s.description || '', initialize_with_readme: true });
          return `Project created: ${d.path_with_namespace} — ${d.web_url}`;
        }
        const d = await api('POST', '/user/repos', { name, private: priv, description: s.description || '', auto_init: true });
        return `Repository created: ${d.full_name} — ${d.html_url}`;
      }
      case 'list_branches': {
        needRepo(s);
        const d = await api('GET', isGitlab() ? `/projects/${projId(s.owner, s.repo)}/repository/branches?per_page=50` : `/repos/${s.owner}/${s.repo}/branches?per_page=50`);
        return 'Branches:\n' + d.map(b => `- ${b.name}${b.protected ? ' (protected)' : ''}`).join('\n');
      }
      case 'create_branch': {
        needRepo(s);
        const name = s.name || s.new_branch;
        if (!name) throw new Error('Missing "name" (new branch name).');
        const from = s.from || s.base || await defaultBranch(s);
        if (isGitlab()) {
          await api('POST', `/projects/${projId(s.owner, s.repo)}/repository/branches?branch=${encodeURIComponent(name)}&ref=${encodeURIComponent(from)}`);
        } else if (isGithub()) {
          const ref = await api('GET', `/repos/${s.owner}/${s.repo}/git/ref/heads/${encPath(from)}`);
          await api('POST', `/repos/${s.owner}/${s.repo}/git/refs`, { ref: 'refs/heads/' + name, sha: ref.object.sha });
        } else {
          await api('POST', `/repos/${s.owner}/${s.repo}/branches`, { new_branch_name: name, old_branch_name: from });
        }
        return `Branch created: ${name} (from ${from})`;
      }
      case 'list_commits': {
        needRepo(s);
        const br = await branchOf(s);
        const d = await api('GET', isGitlab() ? `/projects/${projId(s.owner, s.repo)}/repository/commits?ref_name=${encodeURIComponent(br)}&per_page=15` : `/repos/${s.owner}/${s.repo}/commits?sha=${encodeURIComponent(br)}&per_page=15`);
        return `Recent commits on ${br}:\n` + d.map(c => `- ${(c.sha || c.id || '').slice(0, 8)} ${(c.commit ? c.commit.message : c.title || '').split('\n')[0]}`).join('\n');
      }
      case 'add_collaborator': {
        needRepo(s);
        const username = String(s.username || s.collaborator || s.user || '').trim();
        if (!username) throw new Error('Provide username/collaborator for add_collaborator.');
        if (isGithub()) await api('PUT', `/repos/${s.owner}/${s.repo}/collaborators/${encodeURIComponent(username)}`, { permission: s.permission || 'push' });
        else if (isGitlab()) throw new Error('GitLab add_collaborator requires a numeric user_id; this browser agent does not guess IDs. Use the GitLab UI or provide a supported user_id operation.');
        else await api('PUT', `/repos/${s.owner}/${s.repo}/collaborators/${encodeURIComponent(username)}`, { permission: s.permission || 'write' });
        return `Collaborator invitation/access granted to ${username} on ${s.owner}/${s.repo}.`;
      }
      case 'close_issue': {
        needRepo(s); const number = Number(s.issue_number || s.issue || s.number);
        if (!Number.isInteger(number) || number < 1) throw new Error('Provide a valid issue_number.');
        if (isGitlab()) await api('PUT', `/projects/${projId(s.owner,s.repo)}/issues/${number}`, { state_event: 'close' });
        else await api('PATCH', `/repos/${s.owner}/${s.repo}/issues/${number}`, { state: 'closed' });
        return `Closed issue #${number} on ${s.owner}/${s.repo}.`;
      }
      case 'merge_pr': {
        needRepo(s); const number = Number(s.pull_number || s.pr_number || s.number);
        if (!Number.isInteger(number) || number < 1) throw new Error('Provide a valid pull_number/pr_number.');
        if (isGitlab()) await api('PUT', `/projects/${projId(s.owner,s.repo)}/merge_requests/${number}/merge`, { squash: !!s.squash });
        else await api('PUT', `/repos/${s.owner}/${s.repo}/pulls/${number}/merge`, { merge_method: s.merge_method || 'merge', commit_title: s.commit_title || undefined, commit_message: s.message || undefined });
        return `Merged pull/merge request #${number} on ${s.owner}/${s.repo}.`;
      }
      case 'create_issue': {
        needRepo(s);
        const title = s.title; if (!title) throw new Error('Missing "title".');
        const d = isGitlab()
          ? await api('POST', `/projects/${projId(s.owner, s.repo)}/issues`, { title, description: s.body || s.description || '' })
          : await api('POST', `/repos/${s.owner}/${s.repo}/issues`, { title, body: s.body || s.description || '' });
        return `Issue created: ${d.html_url || d.web_url}`;
      }
      /* ---------- v2.5 expanded repository access ---------- */
      case 'get_tree': case 'list_all_files': {
        needRepo(s);
        const br = await branchOf(s);
        if (isGitlab()) {
          // GitLab: paginate tree recursively
          let all = [], page = 1;
          while (page <= 10) {
            const d = await api('GET', `/projects/${projId(s.owner, s.repo)}/repository/tree?ref=${encodeURIComponent(br)}&recursive=true&per_page=100&page=${page}`);
            if (!d.length) break;
            all = all.concat(d); page++;
          }
          return `Full tree @ ${br} (${all.length} entries):\n` + all.map(x => `- ${x.type} ${x.path}`).join('\n').slice(0, 30000);
        }
        const d = await api('GET', `/repos/${s.owner}/${s.repo}/git/trees/${encodeURIComponent(br)}?recursive=1`);
        const tree = (d.tree || []).filter(x => x.type === 'blob');
        return `Full tree @ ${br} (${tree.length} files, truncated to 600):\n` + tree.slice(0, 600).map(x => `- ${x.path} (${x.size} B)`).join('\n');
      }
      case 'search_code': {
        needRepo(s);
        const q = s.query || s.q || s.term; if (!q) throw new Error('Missing "query".');
        if (isGithub()) {
          const d = await api('GET', `/search/code?q=${encodeURIComponent(q + ' repo:' + s.owner + '/' + s.repo)}&per_page=10`);
          const items = d.items || [];
          if (!items.length) return `No code matches "${q}" in ${s.owner}/${s.repo}.`;
          return `Code search matches for "${q}" (${d.total_count || items.length} total):\n` +
            items.map(it => `- ${it.path} (${(it.text_matches && it.text_matches[0] && it.text_matches[0].fragment) || ''})`).join('\n').slice(0, 15000);
        }
        // GitLab / others: fall back to grep via raw tree (client-side)
        const br = await branchOf(s);
        const tree = isGitlab()
          ? await api('GET', `/projects/${projId(s.owner, s.repo)}/repository/tree?ref=${encodeURIComponent(br)}&recursive=true&per_page=100`)
          : (await api('GET', `/repos/${s.owner}/${s.repo}/git/trees/${encodeURIComponent(br)}?recursive=1`)).tree || [];
        const files = (tree || []).filter(x => x.type === 'blob' && /\.(js|ts|py|md|txt|json|html|css|java|go|rs|c|cpp|sh|yml|yaml)$/i.test(x.path)).slice(0, 40);
        const hits = [];
        const needle = q.toLowerCase();
        for (const f of files) {
          try {
            const content = (await getFileText({ ...s, path: f.path }, br)).text;
            const idx = content.toLowerCase().indexOf(needle);
            if (idx >= 0) hits.push(`- ${f.path}: …${content.slice(Math.max(0, idx - 40), idx + 120)}…`);
            if (hits.length >= 10) break;
          } catch { /* skip */ }
        }
        return hits.length ? `Code search matches for "${q}":\n` + hits.join('\n') : `No code matches "${q}" (scanned ${files.length} text files).`;
      }
      case 'get_readme': {
        needRepo(s);
        const br = await branchOf(s);
        try {
          const d = isGitlab()
            ? await api('GET', `/projects/${projId(s.owner, s.repo)}/repository/files/README.md?ref=${encodeURIComponent(br)}`)
            : await api('GET', `/repos/${s.owner}/${s.repo}/readme?ref=${encodeURIComponent(br)}`);
          const text = d.content ? b64decodeUtf8(d.content) : '';
          return `=== README @ ${br} ===\n${text.slice(0, 32000)}`;
        } catch { return 'No README found.'; }
      }
      case 'list_issues': {
        needRepo(s);
        const state = s.state || 'open';
        const d = isGitlab()
          ? await api('GET', `/projects/${projId(s.owner, s.repo)}/issues?state=${state}&per_page=20`)
          : await api('GET', `/repos/${s.owner}/${s.repo}/issues?state=${state}&per_page=20`);
        if (!d.length) return `No ${state} issues.`;
        return `Issues (${state}):\n` + d.map(i => `- #${i.iid || i.number} ${i.title} ${i.state} (${(i.updated_at || '').slice(0, 10)})`).join('\n');
      }
      case 'get_issue': {
        needRepo(s);
        const num = s.number || s.iid || s.id; if (!num) throw new Error('Missing "number".');
        const d = isGitlab()
          ? await api('GET', `/projects/${projId(s.owner, s.repo)}/issues/${num}`)
          : await api('GET', `/repos/${s.owner}/${s.repo}/issues/${num}`);
        return `#${d.iid || d.number} ${d.title} [${d.state}]\n${(d.description || d.body || '').slice(0, 8000)}`;
      }
      case 'list_pulls': case 'list_prs': {
        needRepo(s);
        const state = s.state || 'open';
        if (isGitlab()) {
          const d = await api('GET', `/projects/${projId(s.owner, s.repo)}/merge_requests?state=${state}&per_page=20`);
          return `Merge requests (${state}):\n` + d.map(m => `!${m.iid} ${m.title} [${m.state}] ${m.source_branch}→${m.target_branch}`).join('\n');
        }
        const d = await api('GET', `/repos/${s.owner}/${s.repo}/pulls?state=${state}&per_page=20`);
        if (!d.length) return `No ${state} pull requests.`;
        return `Pull requests (${state}):\n` + d.map(p => `#${p.number} ${p.title} [${p.state}] ${p.head && p.head.ref}→${p.base && p.base.ref}`).join('\n');
      }
      case 'create_pull_request': case 'create_pr': {
        needRepo(s);
        const title = s.title; if (!title) throw new Error('Missing "title".');
        const head = s.head || s.source; const base = s.base || s.target || (await defaultBranch(s));
        if (!head) throw new Error('Missing "head" (source branch).');
        if (isGitlab()) {
          const d = await api('POST', `/projects/${projId(s.owner, s.repo)}/merge_requests`, { title, source_branch: head, target_branch: base, description: s.body || '' });
          return `Merge request created: !${d.iid} — ${d.web_url}`;
        }
        const d = await api('POST', `/repos/${s.owner}/${s.repo}/pulls`, { title, head, base, body: s.body || '' });
        return `Pull request created: #${d.number} — ${d.html_url}`;
      }
      case 'list_commits_full': case 'get_commit': {
        needRepo(s);
        const br = await branchOf(s);
        const sha = s.sha || s.ref;
        if (sha) {
          const d = isGitlab()
            ? await api('GET', `/projects/${projId(s.owner, s.repo)}/repository/commits/${encodeURIComponent(sha)}`)
            : await api('GET', `/repos/${s.owner}/${s.repo}/commits/${encodeURIComponent(sha)}`);
          return `Commit ${(d.sha || d.id || '').slice(0, 10)} by ${(d.committer_name || (d.commit && d.commit.author && d.commit.author.name) || '?')} @ ${d.committed_date || (d.commit && d.commit.author && d.commit.author.date) || ''}\n${d.message || (d.commit && d.commit.message) || ''}`.slice(0, 6000);
        }
        const d = await api('GET', isGitlab() ? `/projects/${projId(s.owner, s.repo)}/repository/commits?ref_name=${encodeURIComponent(br)}&per_page=30` : `/repos/${s.owner}/${s.repo}/commits?sha=${encodeURIComponent(br)}&per_page=30`);
        return `Recent commits on ${br}:\n` + d.map(c => `- ${(c.sha || c.id || '').slice(0, 8)} ${(c.commit ? c.commit.message : c.title || '').split('\n')[0]} (${(c.committer_name || (c.commit && c.commit.author && d.commit.author.name) || '').slice(0, 20)})`).join('\n');
      }
      case 'list_tags': case 'list_releases': {
        needRepo(s);
        const d = await api('GET', isGitlab() ? `/projects/${projId(s.owner, s.repo)}/repository/tags?per_page=20` : `/repos/${s.owner}/${s.repo}/tags?per_page=20`);
        if (!d.length) return 'No tags.';
        return 'Tags:\n' + d.map(t => `- ${t.name}${t.commit ? ' @ ' + (t.commit.sha || t.commit.id || '').slice(0, 8) : ''}`).join('\n');
      }
      case 'delete_repo': {
        needRepo(s);
        if (isGithub()) await api('DELETE', `/repos/${s.owner}/${s.repo}`);
        else if (isGitlab()) await api('DELETE', `/projects/${projId(s.owner, s.repo)}`);
        else await api('DELETE', `/repos/${s.owner}/${s.repo}`);
        return `Repository deleted: ${s.owner}/${s.repo}`;
      }
      default:
        return null;
    }
  };

  const SUPPORTED = 'whoami, list_repos, get_repo, list_files, get_file, create_file, update_file, push (files[]), delete_file, create_repo, delete_repo, list_branches, create_branch, list_commits, list_commits_full, get_commit, create_issue, list_issues, get_issue, list_pulls, create_pull_request, get_tree/list_all_files, search_code, get_readme, list_tags';

  /* Execute a git action described by JSON payload from the AI tool */
  const execute = async (payload) => {
    let spec;
    try { spec = typeof payload === 'string' ? JSON.parse(payload.replace(/^```(?:json)?|```$/g, '').trim()) : payload; }
    catch { return { ok: false, text: 'Invalid git JSON (must be a single JSON object). Got: ' + String(payload).slice(0, 200) }; }
    if (!spec || typeof spec !== 'object') return { ok: false, text: 'Git payload must be a JSON object like {"action":"list_repos"}.' };
    if (!(AXION.settings.gitUsername || '').trim() || !token()) return { ok: false, text: 'Git agent is disabled until both GitHub Username and Personal Access Token are configured in Settings → Git integration.' };

    let s;
    try { s = await normalizeSpec(spec); }
    catch (e) { return { ok: false, text: 'Git error: ' + e.message }; }

    const mentions = Array.isArray(AXION.currentTurnGitMentions) ? AXION.currentTurnGitMentions.map(x => String(x).toLowerCase()) : [];
    if (s.action !== 'list_repos') {
      if (s.action === 'create_repo') {
        const wanted = String(s.name || s.repo || '').toLowerCase();
        if (!wanted || !mentions.some(m => m === wanted || (m.includes('/') && m.split('/').pop() === wanted))) return { ok: false, text: 'Creating a repository requires an explicit @new-repository-name mention in the current user message.' };
      } else {
        if (!s.repo) return { ok: false, text: 'Repository actions require the user to select or type an explicit @repo-name mention in the current message. Without that mention, only list_repos is allowed.' };
        const canonical = `${s.owner || ''}/${s.repo}`.toLowerCase();
        const repoName = String(s.repo).toLowerCase();
        const matched = mentions.some(m => m.includes('/') ? m === canonical : m === repoName);
        if (!matched) return { ok: false, text: `Blocked: ${s.owner ? s.owner + '/' : ''}${s.repo} was not explicitly mentioned with @ in the current user message. Ask the user to select the repository from the @ menu or include @${s.owner ? s.owner + '/' : ''}${s.repo}.` };
      }
    }
    const perm = checkPermission(s.action);
    if (perm.allow === false) return { ok: false, text: perm.reason };
    if (WRITE_ACTIONS.has(s.action)) {
      const granted = await AXION.ui.confirm(
        'Allow repository changes?',
        `AI proposes ${s.action}${s.repo ? ' on ' + (s.owner ? s.owner + '/' : '') + s.repo : ''}. No repository change will be sent without your approval.`,
        describe(s),
        { yes: 'Allow', no: 'Dismiss' }
      );
      if (!granted) return { ok: false, text: 'User dismissed the proposed repository changes. No changes were applied.' };
    }

    try {
      const text = await run(s);
      if (text === null) return { ok: false, text: `Unknown git action: "${s.action}". Supported: ${SUPPORTED}.` };
      return { ok: true, text };
    } catch (e) {
      return { ok: false, text: 'Git error: ' + e.message };
    }
  };


  const listRepositories = async () => {
    const username = String(AXION.settings.gitUsername || '').trim();
    if (!username || !token()) throw new Error('Git agent is disabled until both GitHub Username and Personal Access Token are configured in Settings.');
    let data;
    if (isGithub()) data = await api('GET', '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
    else if (isGitlab()) data = await api('GET', '/projects?membership=true&per_page=100&order_by=updated_at');
    else data = await api('GET', '/user/repos?limit=100&sort=updated');
    const rows = Array.isArray(data) ? data : (data.repositories || data.items || []);
    return rows.map(r => ({
      name: String(r.name || r.path || ''), full_name: String(r.full_name || r.path_with_namespace || (r.owner?.login || r.owner?.username ? `${r.owner.login || r.owner.username}/${r.name || r.path}` : r.name || r.path || '')),
      private: !!(r.private || r.visibility === 'private'), description: String(r.description || ''), url: String(r.html_url || r.web_url || r.clone_url || '')
    })).filter(r => r.name && r.full_name).sort((a,b) => a.full_name.localeCompare(b.full_name));
  };

  /* Settings → "Test connection" */
  const testConnection = async () => {
    if (!(AXION.settings.gitUsername || '').trim() || !token()) return { ok: false, text: 'Git agent requires both GitHub Username and Personal Access Token. Add both in Settings and save first.' };
    whoamiCache = null;
    try {
      const res = await fetch(apiBase() + '/user', { headers: authHeaders() });
      const scopes = res.headers.get('x-oauth-scopes');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, text: `HTTP ${res.status}: ${(json.message || json.error || '')} — ${HINTS[res.status] || ''}` };
      return { ok: true, text: `Connected as ${json.login || json.username}${scopes ? ' · scopes: ' + scopes : ''}` };
    } catch (e) {
      return { ok: false, text: `Network/CORS error: ${e.message}. Check internet and Base URL${isGithub() ? '' : ' (self-hosted needs CORS enabled)'}.` };
    }
  };

  loadKnowledge();
  return { syncKnowledge, searchKnowledge, readKnowledgeFile, execute, checkPermission, listRepositories, testConnection, knowledgeStats: () => ({ files: Object.keys(knowledge.files).length, updated: knowledge.updated }) };
})();
