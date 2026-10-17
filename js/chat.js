/* =========================================================
   AXION AI — Chat UI v2.6 (Claude-inspired clean layout).
   v2.6:
   - Minimal topbar; provider/model/thinking moved into a
     popover opened from the model pill in the composer.
   - Circular send button (right of composer) becomes a STOP
     button while the AI is running (force abort).
   - New-chat button appears ONLY after a conversation started.
   - Empty state: AXION mark + time-based greeting (no clutter).
   - Export chat (.md), Continue-generating button.
   - All icons are inline SVG (no emoji).
   ========================================================= */
window.AXION = window.AXION || {};
AXION.zipStore = {};
AXION.currentModelInfo = null;
(() => {
  const chatEl = document.getElementById('chat');
  if (!chatEl) return; // chat page only
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');
  const filePreview = document.getElementById('filePreview');
  const providerSelect = document.getElementById('providerSelect');
  const modelSelect = document.getElementById('modelSelect');
  const thinkingLevels = document.getElementById('thinkingLevels');
  const modelPill = document.getElementById('modelPill');
  const modelPillLabel = document.getElementById('modelPillLabel');
  const modelPopover = document.getElementById('modelPopover');
  const newChatBtn = document.getElementById('newChatBtn');
  const newChatBtnTop = document.getElementById('newChatBtnTop');
  const workspaceBtn = document.getElementById('workspaceBtn');
  const exportChatBtn = document.getElementById('exportChatBtn');
  const historyList = document.getElementById('historyList');
  const hintEl = document.getElementById('enterHint');
  let conversations = [];
  let activeConvId = null;
  let isSending = false;
  let abortController = null;
  let attachedFiles = [];
  let pendingEditIndex = null;
  let streamBuf = '';
  let currentSources = [];
  let liveModels = [];   // live-fetched model list (for accurate thinking/image flags)
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const getConv = () => conversations.find(c => c.id === activeConvId);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name) => AXION.icon ? AXION.icon(name) : '';
  /* ---------- Conversations ---------- */
  const isTempChat = () => !!(AXION.settings && AXION.settings.tempChat);
  let stashedConversations = null;
  const sanitizeForStorage = (value) => JSON.parse(JSON.stringify(value, (key, v) => {
    if (key === 'data' && typeof v === 'string' && v.length > 256) return '';
    return v;
  }));
  const saveConversations = () => {
    if (isTempChat()) return;
    try { const durable = JSON.stringify(sanitizeForStorage(conversations)); localStorage.setItem('axion_conversations', durable); if (AXION.storage) AXION.storage.saveValue('axion_conversations', durable).catch(() => {}); } catch (e) { console.warn('Conversation storage failed:', e); }
    if (AXION.memory && conversations.some(c => (c.messages || []).length >= 4)) AXION.memory.summarize(conversations).catch(() => {});
  };
  const estimateTokens = (v) => Math.ceil(String(v || '').length / 4);
  const estimateContextTokens = (history, text = '', files = []) => {
    let chars = String(text || '').length; let fileTokens = 0;
    for (const msg of (history || [])) {
      chars += String(msg.text || msg.content || '').length;
      for (const part of (msg.parts || [])) {
        chars += String(part.text || '').length;
        if (part.inlineData) fileTokens += /^image\//i.test(part.inlineData.mimeType || '') ? 1500 : 512;
        if (part.attachmentId && !part.inlineData) fileTokens += 256;
      }
    }
    for (const file of (files || [])) { chars += String(file.name || '').length; fileTokens += /^image\//i.test(file.mimeType || '') ? 1500 : Math.min(2048, Math.ceil(Number(file.size || 0) / 16384)); }
    return Math.ceil(chars / 4) + fileTokens;
  };
  const updateTokenCounter = () => {
    const el = document.getElementById('tokenCounter'); if (!el) return;
    const conv = getConv(); let hist = (conv && conv.history) || []; if (pendingEditIndex !== null && conv) { const hi = historyIndexForMessage(conv, pendingEditIndex); if (hi >= 0) hist = hist.slice(0, hi); } const inputTokens = estimateContextTokens(hist, inputEl.value, attachedFiles || []);
    const max = Number(AXION.settings.maxTokens || 32768);
    el.textContent = AXION.settings.lang === 'id' ? `~${inputTokens.toLocaleString()} / ${max.toLocaleString()} token konteks masuk (perkiraan)` : `~${inputTokens.toLocaleString()} / ${max.toLocaleString()} input-context tokens (estimated)`;
    el.classList.toggle('token-warning', inputTokens > max * 0.8);
  };
  const bytesToBase64 = async (blob) => { const buf = await blob.arrayBuffer(); let binary=''; const bytes=new Uint8Array(buf); const chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk)); return btoa(binary); };
  const restoreHistoryAttachments = async (history) => {
    const copy = JSON.parse(JSON.stringify(history || []));
    for (const msg of copy) for (const part of (msg.parts || [])) {
      if (part.attachmentId && part.inlineData && !part.inlineData.data && AXION.storage) {
        try { const saved = await AXION.storage.getLibraryBlob(part.attachmentId); part.inlineData.data = await bytesToBase64(saved.blob); part.inlineData.mimeType = saved.meta.mimeType || part.inlineData.mimeType; } catch (_) {}
      }
    }
    return copy;
  }
  const loadConversations = () => {
    if (isTempChat()) { conversations = []; }
    else {
      try { const raw = localStorage.getItem('axion_conversations'); conversations = raw ? JSON.parse(raw) : []; }
      catch { conversations = []; }
    }
    if (!Array.isArray(conversations)) conversations = [];
    conversations.forEach(c => { if (!Array.isArray(c.messages)) c.messages = []; if (!Array.isArray(c.history)) c.history = []; });
    // Always open an empty draft. Reuse one if it already exists; never pile up empty chats.
    const empty = conversations.find(c => (c.messages || []).length === 0);
    if (empty) activeConvId = empty.id;
    else { createConversation(AXION.t('newChat')); if (!isTempChat()) saveConversations(); }
  };
  function createConversation(title) {
    const conv = { id: uid(), title, messages: [], history: [] };
    conversations.unshift(conv);
    activeConvId = conv.id;
    return conv;
  }
  /* v2.7: New-chat button visible only when a conversation started;
     temporary-chat button visible only when NO conversation started.
     They share the topbar and alternate. */
  const updateTopbarVisibility = () => {
    const conv = getConv();
    const hasMessages = !!(conv && conv.messages.length);
    if (newChatBtnTop) newChatBtnTop.classList.toggle('hidden', !hasMessages);
    const tb = document.getElementById('tempChatBtn');
    if (tb) tb.classList.toggle('hidden', hasMessages);
    if (workspaceBtn) workspaceBtn.classList.toggle('hidden', !(AXION.settings && AXION.settings.workspaceEnabled));
  };
  let historyActionMenu = null;
  const closeHistoryMenu = () => { if (historyActionMenu) { historyActionMenu.remove(); historyActionMenu = null; } };
  const removeConversation = (id) => {
    conversations = conversations.filter(x => x.id !== id);
    if (activeConvId === id) activeConvId = null;
    if (!conversations.length) createConversation(AXION.t('newChat'));
    else if (!activeConvId) activeConvId = conversations.find(c => !(c.messages||[]).length)?.id || conversations[0].id;
    saveConversations(); renderHistory(); renderChat();
  };
  const showHistoryMenu = (c, x, y) => {
    closeHistoryMenu();
    const menu = document.createElement('div'); menu.className = 'history-menu'; menu.setAttribute('role','menu');
    const make = (label, action, danger=false) => { const b=document.createElement('button'); b.type='button'; b.textContent=label; if(danger)b.style.color='var(--danger)'; b.onclick=async()=>{closeHistoryMenu(); await action();}; menu.appendChild(b); };
    const isId = AXION.settings.lang === 'id';
    make(c.pinned ? (isId?'Lepas Sematan':'Unpin Conversation') : (isId?'Sematkan Percakapan':'Pin Conversation'), async()=>{c.pinned=!c.pinned;saveConversations();renderHistory();});
    make(isId?'Duplikat Percakapan':'Duplicate Conversation', async()=>{const clone=JSON.parse(JSON.stringify(c));clone.id=uid();clone.title=(c.title||AXION.t('newChat'))+(isId?' (Salinan)':' (Copy)');clone.pinned=false;conversations.unshift(clone);activeConvId=clone.id;saveConversations();renderHistory();renderChat();});
    make(isId?'Hapus Percakapan':'Delete Conversation', async()=>{if(await AXION.ui.confirm(AXION.t('deleteConvTitle'), '"'+c.title+'"', '', {yes:AXION.t('delete'),no:AXION.t('cancel')||'Cancel'})) removeConversation(c.id);}, true);
    menu.style.left=Math.max(8,Math.min(Number(x)||8,window.innerWidth-205))+'px';
    menu.style.top=Math.max(8,Math.min(Number(y)||8,window.innerHeight-155))+'px';
    document.body.appendChild(menu);historyActionMenu=menu;
    setTimeout(()=>{const outside=e=>{if(historyActionMenu&&!historyActionMenu.contains(e.target)){document.removeEventListener('pointerdown',outside,true);closeHistoryMenu();}};document.addEventListener('pointerdown',outside,true);},0);
  };
  const renderHistory = () => {
    if (!historyList) return;
    closeHistoryMenu(); historyList.querySelectorAll('.history-item').forEach(t => t.remove());
    const ordered=conversations.slice().sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
    ordered.forEach(c => {
      const item=document.createElement('div'); item.className='history-item'+(c.id===activeConvId?' active':'')+(c.pinned?' is-pinned':'');
      const title=document.createElement('span');title.className='history-title';title.textContent=c.title||AXION.t('newChat');
      const close=document.createElement('span');close.className='history-close';close.title=AXION.t('delete');close.textContent='×';item.append(title,close);
      item.addEventListener('click',e=>{
        if (lpTriggered) { e.preventDefault(); e.stopPropagation(); lpTriggered=false; return; }
        if(e.target===close){removeConversation(c.id);return;}
        activeConvId=c.id;renderHistory();renderChat();
        const sb=document.getElementById('sidebar');if(sb&&window.innerWidth<900)sb.classList.remove('open');
      });
      let lpTimer=null,lpTriggered=false;
      const lpStart=e=>{if(e.target===close)return;lpTriggered=false;lpTimer=setTimeout(()=>{lpTriggered=true;showHistoryMenu(c,e.clientX||12,e.clientY||100);},520);};
      const lpEnd=()=>{if(lpTimer){clearTimeout(lpTimer);lpTimer=null;}};
      item.addEventListener('pointerdown',lpStart);item.addEventListener('pointerup',lpEnd);item.addEventListener('pointerleave',lpEnd);item.addEventListener('pointercancel',lpEnd);item.addEventListener('contextmenu',e=>e.preventDefault());
      historyList.appendChild(item);
    });
  };
  /* ---------- Markdown ---------- */
  const renderMarkdown = (text) => {
    if (typeof marked !== 'undefined') {
      let raw = marked.parse(text || '');
      if (typeof DOMPurify !== 'undefined') raw = DOMPurify.sanitize(raw);
      return raw;
    }
    return '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
  };
  /* ---------- Search source balls ---------- */
  let srcPopover = null;
  const closeSrcPopover = () => { if (srcPopover) { srcPopover.remove(); srcPopover = null; } };
  const addSearchBalls = (mainEl, sources) => {
    if (!sources || !sources.length) return;
    const bar = document.createElement('div');
    bar.className = 'search-balls';
    bar.title = sources.length + ' sources used';
    sources.slice(0, 6).forEach((s, i) => {
      const dot = document.createElement('span');
      dot.className = 'search-ball';
      dot.style.animationDelay = (i * 0.08) + 's';
      dot.title = s.title + '\n' + s.url;
      try { dot.textContent = new URL(s.url).hostname.replace(/^www\./, ''); } catch (_) { dot.textContent = 'Source ' + (i + 1); }
      bar.appendChild(dot);
    });
    if (sources.length > 6) {
      const more = document.createElement('span');
      more.className = 'search-ball-more';
      more.textContent = '+' + (sources.length - 6);
      bar.appendChild(more);
    }
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSrcPopover();
      const pop = document.createElement('div');
      pop.className = 'src-popover';
      pop.innerHTML = `<div class="src-pop-title">${sources.length} ${AXION.t('sourcesUsed') || 'sources used'}</div>`;
      sources.slice(0, 12).forEach(s => {
        const a = document.createElement('a');
        a.className = 'src-pop-item';
        a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = `<span class="src-pop-host">${esc((s.url.replace(/^https?:\/\//, '').split('/')[0] || '').slice(0, 40))}</span><span class="src-pop-t">${esc(s.title)}</span>`;
        pop.appendChild(a);
      });
      document.body.appendChild(pop);
      const r = bar.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 320)) + 'px';
      pop.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      srcPopover = pop;
      setTimeout(() => {
        const off = (ev) => { if (srcPopover && !srcPopover.contains(ev.target) && ev.target !== bar) { document.removeEventListener('pointerdown', off, true); closeSrcPopover(); } };
        document.addEventListener('pointerdown', off, true);
      }, 50);
    });
    mainEl.appendChild(bar);
  };
  /* ---------- User message ---------- */
  const attachmentDownload = async (id, fallbackName) => {
    try { const pair = await AXION.storage.getLibraryBlob(id); const url = URL.createObjectURL(pair.blob); const a = document.createElement('a'); a.href = url; a.download = pair.meta.name || fallbackName || 'download'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); }
    catch (e) { AXION.ui.toast('Attachment unavailable: ' + e.message); }
  };
  const appendAttachmentCards = (host, names, ids, compact = false) => {
    if (!host || !names || !names.length) return;
    const wrap = document.createElement('div'); wrap.className = 'msg-attachment-cards' + (compact ? ' attachment-cards-compact' : '');
    names.forEach((name, i) => {
      const id = ids && ids[i]; const card = document.createElement('div'); card.className = 'msg-attachment-card';
      const icon = document.createElement('span'); icon.className = 'attachment-file-icon'; icon.textContent = /\.zip$/i.test(name) ? 'ZIP' : (name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);
      const title = document.createElement('span'); title.className = 'attachment-file-name'; title.textContent = name; title.title = name;
      card.append(icon, title);
      if (id) { const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'attachment-download'; dl.title = 'Download attachment'; dl.setAttribute('aria-label', 'Download ' + name); dl.textContent = '↓'; dl.addEventListener('click', () => attachmentDownload(id, name)); card.appendChild(dl); }
      wrap.appendChild(card);
    });
    host.appendChild(wrap);
  };
  const addUserMessage = (text, files, msgIdx, edited, messageObj) => {
    const stack=document.createElement('div');stack.className='msg msg-user-stack';
    const msg=messageObj||(getConv()&&getConv().messages[msgIdx])||{};
    appendAttachmentCards(stack,files||msg.files||[],msg.attachmentRefs||[],false);
    const div=document.createElement('div');div.className='msg-user';
    const textEl=document.createElement('div');textEl.className='msg-text';textEl.textContent=text;
    if(edited){const b=document.createElement('span');b.className='edited-badge';b.textContent=' (edited)';textEl.appendChild(b);}
    div.appendChild(textEl);
    if(msgIdx!==undefined){
      const actions=document.createElement('div');actions.className='msg-actions';
      const copyBtn=document.createElement('button');copyBtn.className='msg-action';copyBtn.type='button';copyBtn.title='Copy';copyBtn.innerHTML=ic('copy');copyBtn.addEventListener('click',()=>copyText(text,copyBtn));
      const editBtn=document.createElement('button');editBtn.className='msg-action';editBtn.type='button';editBtn.title='Edit message';editBtn.innerHTML=ic('edit');editBtn.addEventListener('click',()=>startEditUserMessage(div,textEl,msgIdx,files||[]));
      const repeatBtn=document.createElement('button');repeatBtn.className='msg-action';repeatBtn.type='button';repeatBtn.title='Retry from this message';repeatBtn.textContent='↻';repeatBtn.addEventListener('click',()=>repeatUserMessage(msgIdx));
      actions.append(copyBtn,editBtn,repeatBtn);div.appendChild(actions);appendRevisionControls(div,msg,msgIdx);
    }
    attachLongPress(div,()=>text,textEl,{role:'user',onEdit:()=>startEditUserMessage(div,textEl,msgIdx,files||[]),onRepeat:()=>repeatUserMessage(msgIdx)});
    stack.appendChild(div);chatEl.appendChild(stack);return div;
  };
  const historyIndexForMessage = (conv, msgIdx) => {
    let ordinal = -1;
    for (let i = 0; i <= msgIdx; i++) if (conv.messages[i] && conv.messages[i].role === 'user' && !conv.messages[i].system) ordinal++;
    if (ordinal < 0) return -1;
    let seen = -1;
    for (let i = 0; i < (conv.history || []).length; i++) if (conv.history[i].role === 'user' && !conv.history[i].internal) { seen++; if (seen === ordinal) return i; }
    return -1;
  };
  const startEditUserMessage = async (msgDiv, textEl, msgIdx, files) => {
    if (isSending && abortController) { try { abortController.abort(); } catch (_) {} setSending(false); abortController = null; isSending = false; }
    const conv = getConv(), msg = conv && conv.messages[msgIdx]; if (!msg || isSending) return;
    pendingEditIndex = msgIdx; inputEl.value = msg.content || ''; attachedFiles = [];
    const ids = msg.attachmentRefs || [];
    for (const id of ids) { try { const saved = await AXION.storage.getLibraryBlob(id); attachedFiles.push({ id: saved.meta.id, fileId: saved.meta.id, name: saved.meta.name, mimeType: saved.meta.mimeType, size: saved.meta.size, blob: saved.blob, isZip: /\.zip$/i.test(saved.meta.name), fromLibrary: true }); } catch (_) {} }
    if (!ids.length) { const hi = historyIndexForMessage(conv, msgIdx); const h = hi >= 0 && conv.history[hi]; let legacyIndex = 0; for (const part of (h && h.parts) || []) { if (part.inlineData && part.inlineData.data) { const fname = (msg.files || [])[legacyIndex] || `attachment-${legacyIndex + 1}`; attachedFiles.push({ name: fname, mimeType: part.inlineData.mimeType || 'application/octet-stream', data: part.inlineData.data, isZip: /\.zip$/i.test(fname) }); legacyIndex++; } } }
    renderFilePreview(); updateTokenCounter(); autoResize(); inputEl.focus(); inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    AXION.ui.toast(AXION.settings.lang === 'id' ? 'Pesan dimuat ke kolom input. Hapus atau ganti lampiran, lalu kirim untuk merevisi.' : 'Message loaded into the composer. Remove or replace attachments, then send to revise.');
  };
  const snapshotMessages = messages => messages.map(m => { const x = {}; for (const [k, v] of Object.entries(m)) if (!['revisions', 'snapshot', 'assistantAlternates'].includes(k)) x[k] = v; if (Array.isArray(m.revisions)) x.revisions = m.revisions.map(r => ({ content: r.content, files: (r.files || []).slice(), attachmentRefs: (r.attachmentRefs || []).slice(), thinking: r.thinking, sources: r.sources, steps: r.steps, snapshot: null })); return x; });
  const snapshotRevisionState = (conv, userMsgIdx) => {
    for (let i = userMsgIdx; i >= 0; i--) { const m = conv.messages[i]; if (m && m.role === 'user' && !m.system) { m.revisions = m.revisions || [{ content: m.content, files: m.files || [], attachmentRefs: m.attachmentRefs || [], snapshot: null }]; const rev = m.revisions[m.revisionIndex || 0]; if (rev) rev.snapshot = { messages: snapshotMessages(conv.messages), history: sanitizeForStorage(conv.history) }; break; } }
    const a = conv.messages[conv.messages.length - 1]; if (a && a.role === 'assistant' && a.revisions) { const r = a.revisions[a.revisionIndex || 0]; if (r) r.snapshot = { messages: snapshotMessages(conv.messages), history: sanitizeForStorage(conv.history) }; }
  };
  const extractDocxText = async (blob) => {
    if (typeof JSZip === 'undefined') throw new Error('DOCX reader is unavailable because JSZip did not load.');
    const zip=await JSZip.loadAsync(blob);const doc=zip.file('word/document.xml');if(!doc)throw new Error('DOCX archive has no word/document.xml.');
    const xml=await doc.async('string'), parsed=new DOMParser().parseFromString(xml,'application/xml');
    if(parsed.querySelector('parsererror'))throw new Error('DOCX document XML is malformed.');
    const paragraphs=[...parsed.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join('')).filter(Boolean);
    return paragraphs.join('\n').slice(0,180000);
  };
  const fileTypeLabel = (f) => {
    const ext=(String(f.name||'').match(/\.([^.]+)$/)||[])[1]||'no extension';
    return `File: ${f.name}; extension: .${ext.toLowerCase()}; exact MIME/media type: ${f.mimeType||'application/octet-stream'}; size: ${Number(f.size||f.blob?.size||0)} bytes.`;
  };
  const buildUserParts = async (newText, fileObjs) => {
    const parts = [{ text: newText || 'Please inspect the attached file(s).' }];
    for (const f of fileObjs) {
      const id = f.fileId || f.id || null;
      parts.push({ text: '[ATTACHMENT FORMAT METADATA] ' + fileTypeLabel(f) + ' Preserve the native file type; do not assume it is plain text.', ...(id ? { attachmentId:id } : {}) });
      if (/\.docx$/i.test(f.name || '')) {
        let blob=f.blob;
        if(!blob && id) { try { blob=(await AXION.storage.getLibraryBlob(id)).blob; } catch(_) {} }
        try {
          const docText=await extractDocxText(blob);
          parts.push({ text:`[DOCX converted automatically to plain text from ${f.name}]\n${docText}` , ...(id ? {attachmentId:id}: {}) });
        } catch(e) { parts.push({ text:`[DOCX conversion failed for ${f.name}: ${e.message}. Do not claim to have read its contents.]`, ...(id ? {attachmentId:id}: {}) }); }
        continue;
      }
      if (f.isZip) {
        const paths = f.paths || [];
        parts.push({ text: `[ZIP attached: ${f.name}]\nStructure (paths preserved):\n${paths.map(x => '  - ' + x).join('\n')}\nUse <<<TOOL:readfile>>>path<<<END>>> to read a specific file.`, ...(id ? { attachmentId: id } : {}) });
      } else {
        let data = f.data || '';
        if (!data && f.blob) data = await bytesToBase64(f.blob);
        if (!data && id) { try { data = await bytesToBase64((await AXION.storage.getLibraryBlob(id)).blob); } catch (_) {} }
        parts.push({ inlineData: { mimeType: f.mimeType || 'application/octet-stream', data }, ...(id ? { attachmentId: id } : {}) });
      }
    }
    return parts;
  };
  const applyEditAndRegenerate = async (msgIdx, newText, fileObjs) => {
    const conv = getConv(); if (!conv || isSending) return; const msg = conv.messages[msgIdx]; if (!msg) return;
    const oldRevIndex = Math.max(0, msg.revisionIndex || 0);
    if (!msg.revisions) msg.revisions = [{ content: msg.content, files: (msg.files || []).slice(), attachmentRefs: (msg.attachmentRefs || []).slice(), snapshot: { messages: snapshotMessages(conv.messages), history: sanitizeForStorage(conv.history) } }];
    else if (!msg.revisions[oldRevIndex].snapshot) msg.revisions[oldRevIndex].snapshot = { messages: snapshotMessages(conv.messages), history: sanitizeForStorage(conv.history) };
    const ids = fileObjs.map(f => f.fileId || f.id).filter(Boolean);
    const next = { content: newText, files: fileObjs.map(f => f.name), attachmentRefs: ids, snapshot: null };
    msg.revisions = msg.revisions.slice(0, oldRevIndex + 1); msg.revisions.push(next); msg.revisionIndex = msg.revisions.length - 1; msg.content = newText; msg.files = next.files; msg.attachmentRefs = ids; msg.edited = true;
    conv.messages = conv.messages.slice(0, msgIdx + 1);
    const histIndex = historyIndexForMessage({ ...conv, messages: snapshotMessages(conv.messages.concat([])) }, msgIdx);
    // Message indexes include assistant replies; locate the matching user turn in history before truncating.
    const realHistIndex = histIndex >= 0 ? histIndex : historyIndexForMessage(conv, msgIdx);
    if (realHistIndex >= 0) conv.history = conv.history.slice(0, realHistIndex);
    conv.history.push({ role: 'user', parts: await buildUserParts(newText, fileObjs) });
    for (const id of ids) await AXION.storage.markShared(id, true).catch(() => {});
    attachedFiles = []; pendingEditIndex = null; inputEl.value = ''; renderFilePreview(); autoResize(); updateTokenCounter(); saveConversations(); renderChat(); await generateFromHistory();
  };
  const switchRevision = (msgIdx, delta) => {
    const conv = getConv(); if (!conv || isSending) return; const msg = conv.messages[msgIdx]; if (!msg) return;
    msg.revisions = msg.revisions || [{ content: msg.content, snapshot: null }]; const current = Math.max(0, Math.min(msg.revisions.length - 1, msg.revisionIndex || 0)); const nextIndex = Math.max(0, Math.min(msg.revisions.length - 1, current + delta)); if (nextIndex === current) return;
    const revisions = msg.revisions, rev = revisions[nextIndex];
    if (rev.snapshot) { conv.messages = snapshotMessages(rev.snapshot.messages).map(x => ({ ...x })); conv.history = JSON.parse(JSON.stringify(rev.snapshot.history || [])); const restored = conv.messages[msgIdx] || {}; restored.revisions = revisions; restored.revisionIndex = nextIndex; restored.content = rev.content; if (rev.files) restored.files = rev.files; if (rev.attachmentRefs) restored.attachmentRefs = rev.attachmentRefs; conv.messages[msgIdx] = restored; }
    else { msg.revisionIndex = nextIndex; msg.content = rev.content; if (rev.files) msg.files = rev.files; if (rev.attachmentRefs) msg.attachmentRefs = rev.attachmentRefs; conv.messages = conv.messages.slice(0, msgIdx + 1); const hi = historyIndexForMessage(conv, msgIdx); if (hi >= 0) conv.history = conv.history.slice(0, hi + 1); }
    saveConversations(); renderChat();
  };
  const appendRevisionControls = (host, msg, msgIdx) => {
    if (!host || !msg) return; const control = document.createElement('div'); control.className = 'revision-control';
    const revisions = msg.revisions || [{ content: msg.content }]; const current = Math.max(0, Math.min(revisions.length - 1, msg.revisionIndex || 0));
    const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'revision-arrow'; prev.textContent = '‹'; prev.disabled = current <= 0; prev.title = 'Previous revision'; prev.addEventListener('click', () => switchRevision(msgIdx, -1));
    const count = document.createElement('span'); count.className = 'revision-count'; count.textContent = `<${current + 1}/${revisions.length}>`;
    const next = document.createElement('button'); next.type = 'button'; next.className = 'revision-arrow'; next.textContent = '›'; next.disabled = current >= revisions.length - 1; next.title = 'Next revision'; next.addEventListener('click', () => switchRevision(msgIdx, 1));
    control.append(prev, count, next); host.appendChild(control);
  };
  const regenerateLast = () => {
    if (isSending) return;
    const conv = getConv();
    if (!conv || !conv.messages.length) return;
    if (conv.messages[conv.messages.length - 1].role !== 'assistant') return;
    const previousAssistant = conv.messages[conv.messages.length - 1];
    conv.pendingAssistantRevisions = (previousAssistant.revisions && previousAssistant.revisions.length ? previousAssistant.revisions : [{ content: previousAssistant.content, thinking: previousAssistant.thinking, sources: previousAssistant.sources, steps: previousAssistant.steps, snapshot: null }]).slice();
    conv.messages.pop();
    for (let i = conv.history.length - 1; i >= 0; i--) {
      if (conv.history[i].role === 'assistant' || conv.history[i].role === 'model') {
        conv.history.splice(i, 1); break;
      }
    }
    saveConversations();
    renderChat();
    generateFromHistory();
  };
  /* v2.7: Repeat (ulangi) a user message — truncate to that message and re-run */
  const repeatUserMessage = (msgIdx) => {
    if (isSending) return; const conv = getConv(); if (!conv) return;
    const histIndex = historyIndexForMessage(conv, msgIdx); if (histIndex < 0) return;
    conv.messages = conv.messages.slice(0, msgIdx + 1); conv.history = conv.history.slice(0, histIndex + 1);
    saveConversations(); renderChat(); generateFromHistory();
  };
  /* v2.6: Continue generating — append a "continue" turn and run again */
  const continueLast = () => {
    if (isSending) return;
    const conv = getConv();
    if (!conv || !conv.messages.length) return;
    conv.history.push({ role: 'user', parts: [{ text: 'Continue your previous answer exactly where you stopped. Do not repeat what you already wrote. If you already finished, say so briefly.' }] });
    conv.messages.push({ role: 'user', content: AXION.t('continueGen') || 'Continue generating…', system: true });
    saveConversations();
    renderChat();
    generateFromHistory();
  };
  /* ---------- Generation core ---------- */
  /* v2.7: detect truncation — long output that ends mid-sentence */
  const looksTruncated = (t) => {
    if (!t || t.length < 400) return false;
    const maxChars = (AXION.settings.maxOutputTokens || 16384) * 2.2; // rough char estimate
    if (t.length < maxChars * 0.65) return false;
    const trimmed = t.trim();
    if (/```\s*$/.test(trimmed)) return false; // ends in closed code fence
    return !/[.!?)"'`>\]}]\s*$/.test(trimmed);
  };
  const runGeneration = async (contentEl, stepsEl, mainEl) => {
    const conv = getConv();
    currentSources = [];
    AXION.pendingCanvases = [];
    AXION.pendingOutputFiles = [];
    let fullText = '';
    let finalImages = [], finalAudio = null;
    let aborted = false;
    let continueCount = 0;
    let lastThinking = '';
    let liveUsage = null;
    const updateOutputUsage = (text, final = false) => {
      if (!liveUsage) { liveUsage = document.createElement('div'); liveUsage.className = 'token-usage'; liveUsage.setAttribute('aria-live', 'polite'); mainEl.appendChild(liveUsage); }
      const count = estimateTokens(text);
      const cap = Number(AXION.settings.maxOutputTokens || 16384);
      liveUsage.classList.toggle('token-warning', !final && count > cap * 0.8);
      liveUsage.textContent = AXION.settings.lang === 'id' ? `~${count.toLocaleString()} token output ${final ? '(perkiraan akhir)' : '(perkiraan langsung)'}` : `~${count.toLocaleString()} output tokens ${final ? '(final estimate)' : '(live estimate)'}`;
    };
    const stepMap = new Map();   // capture steps (dedup by key) so they persist after reload
    let analyzeEl = addStep(stepsEl, { n: '_analyze', type: 'step', label: AXION.t('analyzing') || 'Analyzing request', status: 'running', detail: '' });
    const markAnalyzeDone = () => { if (analyzeEl) { const st = analyzeEl.querySelector('.tl-status'); if (st) st.className = 'tl-status done'; analyzeEl = null; } };
    while (true) {
      streamBuf = '';
      abortController = new AbortController();
      let result = null;
      try {
        AXION.currentOutputHost = contentEl;
        if (AXION.storage && AXION.storage.getMemory) { try { const memory = await AXION.storage.getMemory(); window.__axionMemorySummary = memory.summary || ''; } catch (_) {} }
        result = await AXION.agents.run({
          messages: await restoreHistoryAttachments(conv.history),
          system: AXION.buildSystemPrompt(),
          thinking: AXION.settings.thinking,
          signal: abortController.signal,
          onStep: (s) => { stepMap.set(String(s.n), s); markAnalyzeDone(); addStep(stepsEl, s); },
          onChunk: (t) => {
            if (t) { markAnalyzeDone(); streamBuf = t; updateOutputUsage(fullText + t); contentEl.innerHTML = renderMarkdown(fullText + t); chatEl.scrollTop = chatEl.scrollHeight; }
          },
          onSources: (srcs) => {
            const seen = new Set(currentSources.map(s => s.url));
            srcs.forEach(s => { if (!seen.has(s.url)) { currentSources.push(s); seen.add(s.url); } });
            const existing = mainEl.querySelector('.search-balls');
            if (existing) existing.remove();
            addSearchBalls(mainEl, currentSources);
          },
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          result = { text: streamBuf, thinking: '', images: [], audio: null, aborted: true };
        } else {
          // Provider error: remove the empty bot bubble, show error, KEEP the user message (retry works).
          const wrap = contentEl.closest('.msg-bot');
          if (wrap) wrap.remove();
          addErrorMessage(AXION.t('errorProvider') + ': ' + err.message);
          saveConversations();
          delete AXION.currentOutputHost;
          return null;
        }
      }
      if (AXION.currentOutputHost === contentEl) delete AXION.currentOutputHost;
      const chunkText = (result && result.text) ? result.text : streamBuf;
      fullText += chunkText;
      if (result && result.images && result.images.length) finalImages = result.images;
      if (result && result.audio) finalAudio = result.audio;
      if (result && result.thinking) lastThinking += result.thinking;
      renderFinalContent(contentEl, fullText, finalImages, finalAudio);
      if (AXION.canvas?.renderPending) AXION.canvas.renderPending(contentEl);
      if (AXION.workspace?.renderDeliveredArtifacts) await AXION.workspace.renderDeliveredArtifacts(contentEl);
      if (result && result.aborted) { aborted = true; break; }
      // Preserve the FULL agent history (tool calls + tool results) so the AI
      // remembers its own tool usage on the next turn — tools keep working mid-chat.
      if (result && result.history) conv.history = result.history.slice();
      conv.history.push({ role: 'assistant', text: chunkText });
      // v2.7: process must not stop — if output looks truncated, auto-continue
      if (AXION.settings.autoContinue && continueCount < 8 && looksTruncated(fullText)) {
        continueCount++;
        addStep(stepsEl, { n: 'cont' + continueCount, type: 'step', label: 'Continuing answer…', status: 'done', detail: '', bodyText: '' });
        conv.history.push({ role: 'user', internal: true, parts: [{ text: 'Continue the unfinished response without repeating prior text. The current response tail is:\n' + fullText.slice(-12000) + '\nContinue directly from the last point and finish the task.' }] });
        continue;
      }
      break;
    }
    if (aborted) {
      const note = document.createElement('div'); note.className = 'stopped-note';
      note.textContent = AXION.t('stoppedNote') || 'Generation stopped — partial output shown above.'; contentEl.appendChild(note);
    } else if (AXION.settings.autoContinue && continueCount >= 8 && looksTruncated(fullText)) {
      const note = document.createElement('div'); note.className = 'stopped-note';
      note.textContent = AXION.settings.lang === 'id' ? 'Jawaban mungkin belum lengkap: batas lanjutan otomatis tercapai.' : 'This response may be incomplete: the automatic continuation safety limit was reached.'; contentEl.appendChild(note);
    }
    addBotFooter(contentEl, fullText);
    AXION.pendingCanvases = [];
    AXION.pendingOutputFiles = [];
    if (currentSources.length) {
      const existing = mainEl.querySelector('.search-balls');
      if (existing) existing.remove();
      addSearchBalls(mainEl, currentSources);
    }
    const savedSteps = [...stepMap.values()].filter(s => String(s.n) !== '_analyze' && (s.type !== 'thinking' || s.bodyText));
    const assistantMsg = { role: 'assistant', content: fullText, thinking: lastThinking, sources: currentSources.slice(0, 12), steps: savedSteps, outputTokenEstimate: estimateTokens(fullText) };
    if (conv.pendingAssistantRevisions && conv.pendingAssistantRevisions.length) {
      assistantMsg.revisions = conv.pendingAssistantRevisions.concat([{ content: fullText, thinking: lastThinking, sources: currentSources.slice(0,12), steps: savedSteps, snapshot: null }]);
      assistantMsg.revisionIndex = assistantMsg.revisions.length - 1; delete conv.pendingAssistantRevisions;
    } else { assistantMsg.revisions = [{ content: fullText, thinking: lastThinking, sources: currentSources.slice(0,12), steps: savedSteps, snapshot: null }]; assistantMsg.revisionIndex = 0; }
    conv.messages.push(assistantMsg);
    const latestUserIdx = conv.messages.map((m,i)=>m.role==='user'&&!m.system?i:-1).filter(i=>i>=0).pop();
    if (latestUserIdx !== undefined) snapshotRevisionState(conv, latestUserIdx);
    const stepGroup = stepsEl.closest('.step-by-step'); if (stepGroup) { stepGroup.open = false; const sm=stepGroup.querySelector('summary'); if(sm) sm.textContent = 'Step by step ▶'; }
    updateOutputUsage(fullText, true);
    appendRevisionControls(contentEl.parentElement, assistantMsg, conv.messages.length - 1);
    saveConversations(); updateTopbarVisibility();
    return { text: fullText, images: finalImages, audio: finalAudio, aborted };
  };
  const generateFromHistory = async () => {
    const conv = getConv();
    if (!conv) return;
    const { main, steps, content } = createBotMessage();
    setSending(true);
    await runGeneration(content, steps, main);
    setSending(false);
    abortController = null;
    chatEl.scrollTop = chatEl.scrollHeight;
  };
  const addBotFooter = (contentEl, rawText) => {
    const footer = document.createElement('div');
    footer.className = 'bot-footer';
    const mk = (icon, label, fn) => {
      const b = document.createElement('button');
      b.className = 'btn btn-sm btn-ghost'; b.type = 'button';
      b.innerHTML = ic(icon) + ' ' + label;
      b.addEventListener('click', fn);
      footer.appendChild(b);
    };
    mk('copy', 'Copy', () => copyText(rawText || contentEl.innerText, footer.querySelector('button')));
    mk('regen', 'Regenerate', regenerateLast);
    mk('play', 'Continue', continueLast);
    contentEl.parentElement.appendChild(footer);
    attachLongPress(contentEl.parentElement, () => rawText || contentEl.innerText, contentEl, { role: 'bot', onRegen: regenerateLast });
  };
  const copyText = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    AXION.ui.toast('Copied');
  };
  /* ---------- Long-press context menu (SVG icons) ---------- */
  let ctxEl = null, selModeEl = null;
  const closeCtxMenu = () => { if (ctxEl) { ctxEl.remove(); ctxEl = null; } };
  const exitSelectMode = () => {
    if (selModeEl) { selModeEl.classList.remove('sel-mode'); selModeEl = null; }
    const sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();
  };
  const enterSelectMode = (msgEl, targetEl) => {
    exitSelectMode();
    selModeEl = msgEl;
    msgEl.classList.add('sel-mode');
    const range = document.createRange();
    range.selectNodeContents(targetEl);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    setTimeout(() => {
      const off = (e) => {
        if (selModeEl && selModeEl.contains(e.target)) return;
        document.removeEventListener('pointerdown', off, true);
        exitSelectMode();
      };
      document.addEventListener('pointerdown', off, true);
    }, 250);
  };
  const showCtxMenu = (x, y, msgEl, getText, targetEl, extras) => {
    closeCtxMenu();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    const mk = (icon, label, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ctx-item';
      b.innerHTML = `<span class="ctx-icon">${ic(icon)}</span><span>${esc(label)}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); closeCtxMenu(); fn(); });
      menu.appendChild(b);
    };
    mk('copy', AXION.t('copyAll'), async () => { await copyText(getText()); });
    mk('select', AXION.t('selectText'), () => enterSelectMode(msgEl, targetEl));
    if (extras && extras.role === 'user' && extras.onEdit) mk('edit', AXION.t('edit') || 'Edit', () => extras.onEdit());
    if (extras && extras.role === 'user' && extras.onRepeat) mk('regen', AXION.t('repeat') || 'Repeat', () => extras.onRepeat());
    if (extras && extras.role === 'bot' && extras.onRegen) mk('regen', AXION.t('regenerate') || 'Regenerate', () => extras.onRegen());
    document.body.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8)) + 'px';
    const above = y - h - 14;
    menu.style.top = (above > 8 ? above : Math.min(y + 14, window.innerHeight - h - 8)) + 'px';
    ctxEl = menu;
    setTimeout(() => {
      const off = (e) => { if (ctxEl && ctxEl.contains(e.target)) return; document.removeEventListener('pointerdown', off, true); closeCtxMenu(); };
      document.addEventListener('pointerdown', off, true);
    }, 50);
  };
  const attachLongPress = (msgEl, getText, targetEl, extras) => {
    const LONG_MS = 480, MOVE_TOL = 10;
    let timer = null, sx = 0, sy = 0, fired = false;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    msgEl.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      if (e.target.closest('button, a, textarea, input, summary, .artifact-card, .edit-bar, .search-balls, .src-popover')) return;
      if (msgEl.classList.contains('sel-mode')) return;
      fired = false; sx = e.clientX; sy = e.clientY;
      cancel();
      timer = setTimeout(() => {
        timer = null; fired = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* ignore */ } }
        showCtxMenu(sx, sy, msgEl, getText, targetEl, extras);
      }, LONG_MS);
    });
    msgEl.addEventListener('pointermove', (e) => {
      if (timer && (Math.abs(e.clientX - sx) > MOVE_TOL || Math.abs(e.clientY - sy) > MOVE_TOL)) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => msgEl.addEventListener(ev, cancel));
    msgEl.addEventListener('contextmenu', (e) => {
      if (msgEl.classList.contains('sel-mode')) return;
      if (fired || e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) e.preventDefault();
    });
    msgEl.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
  };
  const addErrorMessage = (text) => {
    const div = document.createElement('div');
    div.className = 'msg msg-error';
    div.textContent = text;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  };
  /* ---------- Bot message ---------- */
  const createBotMessage = () => {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-bot';
    const avatar = document.createElement('div');
    avatar.className = 'bot-avatar';
    avatar.setAttribute('aria-label','AXION neural indicator');
    avatar.innerHTML = '<span class="neural-indicator" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="neural-edge" d="M5 6 12 4 19 7 18 17 11 20 5 15 5 6 M5 6 18 17 M12 4 11 20 M19 7 5 15" fill="none"/><circle class="neural-node" cx="5" cy="6" r="2"/><circle class="neural-node" cx="12" cy="4" r="2"/><circle class="neural-node" cx="19" cy="7" r="2"/><circle class="neural-node" cx="18" cy="17" r="2"/><circle class="neural-node" cx="11" cy="20" r="2"/><circle class="neural-node" cx="5" cy="15" r="2"/></svg></span>';
    const main = document.createElement('div');
    main.className = 'bot-main';
    const stepGroup = document.createElement('details');
    stepGroup.className = 'step-by-step'; stepGroup.open = true;
    const stepSummary = document.createElement('summary'); stepSummary.textContent = 'Step by step ▶'; stepGroup.appendChild(stepSummary);
    const timeline = document.createElement('div'); timeline.className = 'agent-timeline'; stepGroup.appendChild(timeline);
    const content = document.createElement('div'); content.className = 'md';
    main.appendChild(stepGroup); main.appendChild(content);
    wrap.appendChild(avatar);
    wrap.appendChild(main);
    chatEl.appendChild(wrap);
    return { wrap, steps: timeline, content, main };
  };
  const addStep = (timelineEl, step) => {
    let el = timelineEl.querySelector(`[data-tl="${step.n}"]`);
    const isThinking = step.type === 'thinking';
    if (!el) {
      el = document.createElement('details');
      el.className = isThinking ? 'tl-thinking' : 'tl-step';
      el.setAttribute('data-tl', step.n);
      el.open = isThinking;
      el.innerHTML = `<summary>
        <span class="tl-bullet">${isThinking ? '✦' : '•'}</span>
        <span class="tl-status ${step.status}"></span>
        <span class="tl-label">${esc(step.label)}</span>
        <span class="tl-duration"></span>
        <span class="tl-detail">${esc(step.detail || '')}</span>
      </summary><div class="tl-body"></div>`;
      timelineEl.appendChild(el);
    }
    const status = el.querySelector('.tl-status');
    if (status) status.className = 'tl-status ' + (step.status || '');
    const detail = el.querySelector('.tl-detail');
    if (detail && step.detail !== undefined) detail.textContent = step.detail;
    const body = el.querySelector('.tl-body');
    if (body && step.bodyText) body.textContent = step.bodyText;
    const durEl = el.querySelector('.tl-duration');
    if (isThinking && durEl && step.durationMs && step.status !== 'running') {
      durEl.textContent = '· ' + (step.durationMs / 1000).toFixed(1) + 's';
    }
    if (step.status === 'running') { const group = timelineEl.closest('.step-by-step'); if (group) group.open = true; }
    if (step.status === 'done' || step.status === 'stopped') { const remaining = timelineEl.querySelector('.tl-status.running'); if (!remaining) { const group = timelineEl.closest('.step-by-step'); if (group) { group.open = false; const summary = group.querySelector('summary'); if (summary) summary.textContent = 'Step by step ▶'; } } }
    if (isThinking && step.status === 'running') { el.open = true; }
    if (isThinking && (step.status === 'done' || step.status === 'stopped')) {
      if (!step.bodyText) el.remove();
      else { el.open = false; el.classList.add('tl-done'); }
    }
    chatEl.scrollTop = chatEl.scrollHeight;
    return el;
  };
  const renderFinalContent = (contentEl, text, images, audio) => {
    contentEl.innerHTML = renderMarkdown(text);
    const segments = AXION.artifacts.parse(text);
    if (segments.some(s => s.type === 'artifact')) {
      contentEl.innerHTML = '';
      for (const seg of segments) {
        if (seg.type === 'text') {
          const div = document.createElement('div');
          div.className = 'md';
          div.innerHTML = renderMarkdown(seg.content);
          contentEl.appendChild(div);
        } else {
          const card = AXION.artifacts.createCard(seg, (artifact, editable) => openArtifactPanel(artifact, editable));
          contentEl.appendChild(card);
        }
      }
    }
    if (images && images.length) {
      const wrap = document.createElement('div');
      wrap.className = 'image-wrap';
      for (const img of images) {
        const im = document.createElement('img');
        im.src = `data:${img.mimeType};base64,${img.data}`;
        wrap.appendChild(im);
      }
      contentEl.appendChild(wrap);
    }
    if (audio) {
      const player = document.createElement('audio');
      player.controls = true;
      player.src = `data:${audio.mimeType};base64,${audio.data}`;
      const note = document.createElement('div');
      note.className = 'audio-note';
      note.innerHTML = ic('bolt') + ' ' + AXION.t('ttsNote');
      contentEl.appendChild(note);
      contentEl.appendChild(player);
    }
    if (typeof hljs !== 'undefined') contentEl.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
  };
  const openArtifactPanel = (artifact, editable) => {
    const panel = document.getElementById('artifactPanel');
    document.getElementById('artifactName').textContent = artifact.filename;
    const body = document.getElementById('artifactBody');
    body.innerHTML = '';
    const ext = AXION.artifacts.extOf(artifact.filename);
    if (ext === 'html' || ext === 'htm' || ext === 'svg') {
      const iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-scripts';
      iframe.srcdoc = artifact.content;
      body.appendChild(iframe);
    } else if (ext === 'md' || ext === 'markdown') {
      const div = document.createElement('div');
      div.className = 'md';
      div.innerHTML = renderMarkdown(artifact.content);
      body.appendChild(div);
    } else {
      const pre = document.createElement('pre');
      pre.textContent = artifact.content;
      body.appendChild(pre);
    }
    panel.classList.add('open','is-fullscreen');
    const closePanel=()=>panel.classList.remove('open','is-fullscreen');
    document.getElementById('artifactClose').onclick=closePanel;
    document.getElementById('artifactDownload').onclick=()=>AXION.artifacts.downloadBlob(new Blob([artifact.content],{type:({html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',json:'application/json',md:'text/markdown',svg:'image/svg+xml'}[ext]||'text/plain')+';charset=utf-8'}),artifact.filename);
    const bodyTouch={startY:0};
    body.onwheel=e=>{if(e.deltaY>0)closePanel();};
    body.ontouchstart=e=>{bodyTouch.startY=e.touches[0].clientY;};
    body.ontouchend=e=>{if(bodyTouch.startY-e.changedTouches[0].clientY>65)closePanel();};
  };
  /* ---------- Provider / model (now inside popover) ---------- */
  const updateModelPill = () => {
    if (!modelPillLabel) return;
    const p = AXION.getProvider(AXION.settings.provider);
    const m = p.models.find(x => x.id === AXION.settings.model);
    modelPillLabel.textContent = (m ? m.label : AXION.settings.model) + (AXION.settings.thinking !== 'off' ? ' · ' + AXION.t(AXION.settings.thinking) : '');
  };
  const populateProviders = () => {
    providerSelect.innerHTML = '';
    AXION.PROVIDERS.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.label;
      providerSelect.appendChild(o);
    });
    providerSelect.value = AXION.settings.provider;
  };
  const populateModels = async () => {
    const p = AXION.getProvider(AXION.settings.provider);
    modelSelect.innerHTML = '';
    let models = p.models.slice();
    const live = await AXION.providers.fetchModels(p.id);
    liveModels = live && live.length ? live : [];
    if (live && live.length) {
      models = live;
      const note = document.createElement('option');
      note.disabled = true; note.textContent = '— ' + AXION.t('modelsFetched') + ' —';
      modelSelect.appendChild(note);
    }
    for (const m of models) {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label + (m.ctx ? ` (${m.ctx})` : '');
      modelSelect.appendChild(o);
    }
    if (AXION.settings.customModel) {
      const o = document.createElement('option');
      o.value = AXION.settings.customModel;
      o.textContent = AXION.settings.customModel + ' (custom)';
      modelSelect.appendChild(o);
    }
    if ([...modelSelect.options].some(o => o.value === AXION.settings.model)) {
      modelSelect.value = AXION.settings.model;
    } else {
      AXION.settings.model = modelSelect.value;
      AXION.saveSettings();
    }
    updateCurrentModelInfo();
    updateModelPill();
  };
  const updateCurrentModelInfo = () => {
    const p = AXION.getProvider(AXION.settings.provider);
    const id = modelSelect.value || AXION.settings.model;
    const all = (liveModels && liveModels.length ? liveModels : []).concat(p.models);
    AXION.currentModelInfo = all.find(m => m.id === id) || { id, label: id, thinking: false, image: false, audio: false };
  };
  providerSelect && providerSelect.addEventListener('change', () => {
    AXION.settings.provider = providerSelect.value;
    const p = AXION.getProvider(providerSelect.value);
    AXION.settings.model = p.models[0].id;
    AXION.saveSettings();
    populateModels();
  });
  modelSelect && modelSelect.addEventListener('change', () => {
    AXION.settings.model = modelSelect.value;
    AXION.saveSettings();
    updateCurrentModelInfo();
    updateModelPill();
  });
  /* Model popover toggle */
  if (modelPill && modelPopover) {
    modelPill.addEventListener('click', (e) => {
      e.stopPropagation();
      modelPopover.classList.toggle('hidden');
      if (!modelPopover.classList.contains('hidden')) {
        // Keep popover fully inside the viewport (flip right/down if it would overflow)
        modelPopover.style.left = ''; modelPopover.style.right = ''; modelPopover.style.bottom = ''; modelPopover.style.top = '';
        requestAnimationFrame(() => {
          const r = modelPopover.getBoundingClientRect();
          if (r.right > window.innerWidth - 8) { modelPopover.style.left = 'auto'; modelPopover.style.right = '0'; }
          if (r.top < 8) { modelPopover.style.bottom = 'auto'; modelPopover.style.top = 'calc(100% + 10px)'; }
        });
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!modelPopover.classList.contains('hidden') && !modelPopover.contains(e.target) && e.target !== modelPill && !modelPill.contains(e.target)) {
        modelPopover.classList.add('hidden');
      }
    });
  }
  const renderThinkingLevels = () => {
    thinkingLevels.innerHTML = '';
    AXION.THINKING_LEVELS.forEach(lv => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = AXION.t(lv);
      b.dataset.level = lv;
      if (AXION.settings.thinking === lv) b.classList.add('active');
      b.addEventListener('click', () => {
        AXION.settings.thinking = lv; AXION.saveSettings(); renderThinkingLevels(); updateModelPill();
      });
      thinkingLevels.appendChild(b);
    });
  };
  /* ---------- Attach files / File Library ---------- */
  const addAttachedFiles = (items) => {
    const known = new Set(attachedFiles.map(f => f.fileId || f.id).filter(Boolean));
    for (const item of items) { const id = item.fileId || item.id; if (id && known.has(id)) continue; attachedFiles.push(item); if (id) known.add(id); }
    renderFilePreview(); updateTokenCounter();
  };
  const processZipAttachment = async (meta, blob) => {
    const paths = [];
    if (typeof JSZip === 'undefined') return paths;
    const zip = await JSZip.loadAsync(blob); const fileMap = {};
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const safeName = name.replace(/\\/g, '/').split('/').filter(x => x && x !== '.' && x !== '..').join('/'); if (!safeName) continue;
      paths.push(safeName);
      try {
        const entryBlob = await entry.async('blob');
        const target = AXION.storage.fs.validPath(`uploads/${meta.id}/${safeName}`);
        await AXION.storage.fs.writeBlob(target, entryBlob);
        await AXION.storage.upsertPath(target, { source: 'zip-extract', name: safeName.split('/').pop(), relativePath: safeName, shared: false, mimeType: entryBlob.type || 'application/octet-stream' });
        if (/\.(txt|md|html?|css|js|json|py|xml|csv|ya?ml|svg|log|ts|tsx|jsx|toml)$/i.test(safeName)) fileMap[safeName] = (await entryBlob.text()).slice(0, 60000);
        else fileMap[safeName] = `[binary file: ${entryBlob.size} bytes]`;
      } catch (e) { fileMap[safeName] = `[could not extract: ${e.message}]`; }
    }
    const conv = getConv() || { id: 'pending' }; if (!AXION.zipStore[conv.id]) AXION.zipStore[conv.id] = {}; AXION.zipStore[conv.id][meta.name] = fileMap;
    return paths;
  };
  const acceptDeviceFiles = async (files) => {
    for (const file of files) {
      try {
        const stored = await AXION.storage.addLibraryFile(file, { source: 'user-upload', shared: false });
        if (stored.duplicate) { AXION.ui.toast(`${file.name} already exists in File Library; using the existing file.`); }
        const pair = await AXION.storage.getLibraryBlob(stored.id); const isZip = /\.zip$/i.test(stored.name);
        const item = { id: stored.id, fileId: stored.id, name: stored.name, mimeType: stored.mimeType, size: stored.size, blob: pair.blob, isZip, fromLibrary: false, paths: [] };
        if (isZip) { try { item.paths = await processZipAttachment(stored, pair.blob); } catch (e) { AXION.ui.toast(`ZIP extraction failed: ${e.message}`); } }
        addAttachedFiles([item]);
      } catch (e) { AXION.ui.toast(`Attachment failed: ${file.name} — ${e.message}`); }
    }
  };
  const chooseAttachmentSource = async () => {
    const wrap = document.createElement('div'); wrap.className = 'axion-modal-wrap';
    const modal = document.createElement('div'); modal.className = 'axion-modal attach-source-modal';
    modal.innerHTML = `<h3>${AXION.settings.lang === 'id' ? 'Tambahkan lampiran' : 'Add attachments'}</h3><button type="button" class="btn btn-ghost" data-library>📁 ${AXION.settings.lang === 'id' ? 'Pilih dari Pustaka' : 'Choose from Library'}</button><button type="button" class="btn btn-ghost" data-device>📄 ${AXION.settings.lang === 'id' ? 'Pilih dari Perangkat' : 'Choose from Device'}</button><button type="button" class="btn btn-ghost btn-sm" data-cancel>${AXION.settings.lang === 'id' ? 'Batal' : 'Cancel'}</button>`;
    const close = () => wrap.remove();
    modal.querySelector('[data-cancel]').onclick = close;
    modal.querySelector('[data-device]').onclick = () => { close(); if (fileInput) fileInput.click(); };
    modal.querySelector('[data-library]').onclick = async () => { close(); try { const selected = await AXION.library.pickFiles(); for (const f of selected) { if (f.isZip) { try { f.paths = await processZipAttachment({ id: f.id, name: f.name }, f.blob); } catch (_) {} } } addAttachedFiles(selected); } catch (e) { AXION.ui.toast('Library selection failed: ' + e.message); } };
    wrap.appendChild(modal); document.body.appendChild(wrap); wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  };
  attachBtn && attachBtn.addEventListener('click', chooseAttachmentSource);
  fileInput && fileInput.addEventListener('change', async () => { await acceptDeviceFiles([...fileInput.files]); fileInput.value = ''; });
  const renderFilePreview = () => {
    if (!filePreview) return; filePreview.innerHTML = '';
    attachedFiles.forEach((f, i) => {
      const card = document.createElement('div'); card.className = 'composer-attachment-card';
      const icon = document.createElement('span'); icon.className = 'attachment-file-icon'; icon.textContent = f.isZip ? 'ZIP' : (f.name.split('.').pop() || 'FILE').toUpperCase().slice(0,4);
      const name = document.createElement('span'); name.className = 'attachment-file-name'; name.textContent = f.name; name.title = f.name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'chip-rm'; remove.title = 'Remove attachment'; remove.textContent = '×'; remove.addEventListener('click', () => { attachedFiles.splice(i, 1); renderFilePreview(); updateTokenCounter(); });
      card.append(icon, name, remove); filePreview.appendChild(card);
    });
  };
  /* ---------- Send / Stop ---------- */
  const setSending = (state) => {
    isSending = state;
    sendBtn && sendBtn.classList.toggle('hidden', state);
    stopBtn && stopBtn.classList.toggle('hidden', !state);
  };
  const autoResize = () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  };
  const sendMessage = async () => {
    hideRepoSuggest?.();
    if (isSending) return;
    let text = inputEl.value.trim();
    if (text.startsWith('/canvas')) {
      const rawRest = text.slice('/canvas'.length);
      const rest = rawRest.replace(/^\s+/, '');
      const startsWithNewline = /^\s*\n/.test(rawRest);
      const split = rest.indexOf('\n');
      let title = 'Canvas'; let content = rest;
      if (!startsWithNewline && split >= 0) { title = rest.slice(0, split).trim() || 'Canvas'; content = rest.slice(split + 1); }
      else if (startsWithNewline) content = rawRest.replace(/^\s*\n/, '');
      else if (!rest) content = '';
      AXION.canvas?.create({ title, content }); inputEl.value = ''; autoResize(); pendingEditIndex = null; updateTokenCounter(); return;
    }
    const conv = getConv(); if (!conv) return;
    if (pendingEditIndex !== null) { await applyEditAndRegenerate(pendingEditIndex, text, attachedFiles.slice()); return; }
    if (!text && !attachedFiles.length) return;
    if (!text) text = AXION.settings.lang === 'id' ? 'Periksa lampiran berikut.' : 'Please inspect the attached file(s).';
    const estimatedInput = estimateContextTokens(conv.history || [], text, attachedFiles);
    const maxTokens = Number(AXION.settings.maxTokens || 32768);
    if (estimatedInput > maxTokens) { AXION.ui.toast((AXION.settings.lang === 'id' ? 'Perkiraan token input melewati batas. Kurangi konteks atau tingkatkan Max Token di Pengaturan. ' : 'Estimated input tokens exceed Max Token. Reduce context or increase Max Token in Settings. ') + `~${estimatedInput}/${maxTokens}`); return; }
    const userMsgIdx = conv.messages.length; const fileObjs = attachedFiles.slice();
    AXION.currentTurnGitMentions = [...new Set([...text.matchAll(/(?:^|\s)@([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)/g)].map(m=>m[1].replace(/^\/+|\/+$/g,'')))];
    const fileNames = fileObjs.map(f => f.name), attachmentRefs = fileObjs.map(f => f.fileId || f.id).filter(Boolean);
    const parts = await buildUserParts(text, fileObjs);
    for (const id of attachmentRefs) await AXION.storage.markShared(id, true).catch(() => {});
    conv.history.push({ role: 'user', parts });
    const msg = { role: 'user', content: text, files: fileNames, attachmentRefs, revisions: [{ content: text, files: fileNames.slice(), attachmentRefs: attachmentRefs.slice(), snapshot: null }], revisionIndex: 0 };
    conv.messages.push(msg);
    addUserMessage(text, fileNames, userMsgIdx, false, msg);
    localStorage.setItem('axion_welcome_dismissed', '1');
    attachedFiles = []; pendingEditIndex = null; renderFilePreview(); inputEl.value = ''; autoResize(); updateTokenCounter();
    if (conv.messages.filter(m => m.role === 'user' && !m.system).length === 1) { conv.title = text.slice(0, 30) || fileNames[0] || AXION.t('newChat'); renderHistory(); }
    updateTopbarVisibility(); saveConversations();
    const { main, steps, content } = createBotMessage(); setSending(true);
    try { await runGeneration(content, steps, main); } catch (e) { addErrorMessage('Generation failed: ' + (e.message || e)); } finally { setSending(false); abortController = null; delete AXION.currentTurnGitMentions; delete AXION.currentOutputHost; chatEl.scrollTop = chatEl.scrollHeight; updateTokenCounter(); updateQuickScroll?.(); }
  };
  sendBtn && sendBtn.addEventListener('click', sendMessage);
  stopBtn && stopBtn.addEventListener('click', () => { if (abortController) { try { abortController.abort(); } catch { /* ignore */ } } AXION.ui.toast(AXION.t('stopping') || 'Stopping…'); });
  inputEl && inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && AXION.enterShouldSend()) { e.preventDefault(); sendMessage(); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage(); } });
  let repoSuggestCache = [], repoRefreshTimer = null, repoSuggestRequest = false;
  const repoSuggest = document.getElementById('gitRepoSuggest');
  const hideRepoSuggest = () => { if (repoSuggest) { repoSuggest.classList.add('hidden'); repoSuggest.innerHTML=''; } };
  const refreshRepoCache = async (showErrors=false) => {
    if (!AXION.git?.listRepositories || !(AXION.settings?.gitUsername||'').trim() || !localStorage.getItem('axion_git_token')) return [];
    try { repoSuggestCache = await AXION.git.listRepositories(); return repoSuggestCache; }
    catch(e) { if(showErrors) AXION.ui.toast((AXION.settings.lang==='id'?'Gagal memuat repositori: ':'Failed to load repositories: ')+e.message); return repoSuggestCache; }
  };
  const showRepoSuggest = async () => {
    if (!repoSuggest || !inputEl) return;
    const caret=inputEl.selectionStart ?? inputEl.value.length, before=inputEl.value.slice(0,caret);
    const match=before.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
    if(!match){hideRepoSuggest();return;}
    if(!(AXION.settings?.gitUsername||'').trim()||!localStorage.getItem('axion_git_token')){
      repoSuggest.innerHTML='';const p=document.createElement('div');p.style.padding='12px';p.textContent=AXION.settings.lang==='id'?'Atur GitHub Username dan Personal Access Token di Settings untuk memilih repositori.':'Configure GitHub Username and Personal Access Token in Settings to choose a repository.';repoSuggest.appendChild(p);repoSuggest.classList.remove('hidden');return;
    }
    const needle=match[1].toLowerCase();let repos=repoSuggestCache;
    if(!repos.length && !repoSuggestRequest){repoSuggestRequest=true;repos=await refreshRepoCache(true);repoSuggestRequest=false;} else if(!repos.length){return;}
    if(!repos.length){repoSuggest.innerHTML='';const p=document.createElement('div');p.style.padding='12px';p.textContent=AXION.settings.lang==='id'?'Tidak ada repositori yang tersedia.':'No repositories available.';repoSuggest.appendChild(p);repoSuggest.classList.remove('hidden');return;}
    const filtered=repos.filter(r=>(r.full_name+' '+r.name).toLowerCase().includes(needle)).slice(0,30);repoSuggest.innerHTML='';
    if(!filtered.length){const p=document.createElement('div');p.style.padding='12px';p.textContent=AXION.settings.lang==='id'?'Repositori tidak ditemukan.':'No matching repositories.';repoSuggest.appendChild(p);repoSuggest.classList.remove('hidden');return;}
    filtered.forEach(repo=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');const name=document.createElement('span');name.textContent='@'+repo.full_name;const small=document.createElement('small');small.textContent=(repo.private?(AXION.settings.lang==='id'?'Pribadi':'Private'):(AXION.settings.lang==='id'?'Publik':'Public'))+(repo.description?' · '+repo.description:'');b.append(name,small);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{const current=inputEl.selectionStart??inputEl.value.length;const beforeNow=inputEl.value.slice(0,current),afterNow=inputEl.value.slice(current);const token=beforeNow.match(/(?:^|\s)@[A-Za-z0-9_.-]*$/);if(token){const start=beforeNow.length-token[0].length+(token[0].startsWith(' ')?1:0);inputEl.value=inputEl.value.slice(0,start)+'@'+repo.full_name+' '+afterNow;const pos=start+repo.full_name.length+2;inputEl.focus();inputEl.setSelectionRange(pos,pos);}else{inputEl.value+=' @'+repo.full_name+' ';inputEl.focus();}hideRepoSuggest();autoResize();updateTokenCounter();};repoSuggest.appendChild(b);});repoSuggest.classList.remove('hidden');
  };
  inputEl && inputEl.addEventListener('input', () => { autoResize(); updateTokenCounter(); showRepoSuggest().catch(()=>hideRepoSuggest()); });
  inputEl && inputEl.addEventListener('keydown',e=>{if(e.key==='Escape')hideRepoSuggest();else if(e.key==='ArrowDown'&&repoSuggest&&!repoSuggest.classList.contains('hidden')){e.preventDefault();repoSuggest.querySelector('button')?.focus();}});
  const startRepoAutoRefresh = () => {
    if (repoRefreshTimer) clearInterval(repoRefreshTimer);
    if (AXION.settings?.gitAutoRefresh === false || !AXION.settings?.gitUsername || !localStorage.getItem('axion_git_token')) return;
    refreshRepoCache(false);
    const interval=Math.max(30000,Math.min(3600000,Number(AXION.settings.gitRefreshInterval)||300000));
    repoRefreshTimer=setInterval(()=>{if(AXION.settings?.gitAutoRefresh!==false)refreshRepoCache(false);},interval);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startRepoAutoRefresh,{once:true}); else setTimeout(startRepoAutoRefresh,0);
  /* ---------- New chat ---------- */
  const startNewChat = () => {
    saveConversations();
    const empty=conversations.find(c => !(c.messages||[]).length);
    if(empty) activeConvId=empty.id; else createConversation(AXION.t('newChat'));
    saveConversations(); renderHistory(); renderChat();
    const sb = document.getElementById('sidebar');
    if (sb && window.innerWidth < 900) sb.classList.remove('open');
  };
  newChatBtn && newChatBtn.addEventListener('click', startNewChat);
  newChatBtnTop && newChatBtnTop.addEventListener('click', startNewChat);
  /* ---------- Export chat (.md) ---------- */
  exportChatBtn && exportChatBtn.addEventListener('click', () => {
    const conv = getConv();
    if (!conv || !conv.messages.length) { AXION.ui.toast('Nothing to export'); return; }
    let md = `# ${conv.title}\n\nExported from AXION AI · ${new Date().toLocaleString()}\n\n---\n\n`;
    conv.messages.forEach(m => {
      md += `## ${m.role === 'user' ? 'You' : 'AXION AI'}\n\n${m.content}\n\n`;
    });
    AXION.artifacts.downloadText(md, (conv.title || 'axion-chat').replace(/[^\w\-]+/g, '_').slice(0, 40) + '.md');
  });
  /* ---------- Temporary chat toggle ---------- */
  const tempBtn = document.getElementById('tempChatBtn');
  const updateTempUI = () => {
    const on = isTempChat();
    const tb = document.getElementById('tempBadge');
    if (tb) tb.classList.toggle('hidden', !on);
    if (tempBtn) { tempBtn.classList.toggle('active', on); tempBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  };
  const setTempChat = async (on) => {
    if (on === isTempChat() || isSending) return;
    if (on) {
      saveConversations();
      stashedConversations = conversations;
      AXION.settings.tempChat = true;
      conversations = [];
      createConversation(AXION.t('newChat'));
      AXION.ui.toast(AXION.t('tempOnMsg'));
    } else {
      const hasContent = conversations.some(c => c.messages.length);
      if (hasContent && !(await AXION.ui.confirm(AXION.t('tempDiscardTitle'), AXION.t('tempDiscardMsg'), '', { yes: AXION.t('leave') }))) return;
      AXION.settings.tempChat = false;
      conversations = stashedConversations || [];
      stashedConversations = null;
      if (!conversations.length) { try { const raw = localStorage.getItem('axion_conversations'); conversations = raw ? JSON.parse(raw) : []; } catch { conversations = []; } }
      if (!conversations.length) createConversation(AXION.t('newChat'));
      activeConvId = conversations[0].id;
      AXION.ui.toast(AXION.t('tempOffMsg'));
    }
    updateTempUI(); renderHistory(); renderChat();
  };
  tempBtn && tempBtn.addEventListener('click', () => setTempChat(!isTempChat()));
  /* ---------- Workspace viewer ---------- */
  const openWorkspacePanel = async () => {
    if (!AXION.workspace || !AXION.workspace.enabled()) {
      AXION.ui.toast(AXION.t('workspaceEnableHint') || 'Enable Workspace in Settings first');
      return;
    }
    const files = await AXION.workspace.listForUI();
    const wrap = document.createElement('div');
    wrap.className = 'axion-modal-wrap';
    const modal = document.createElement('div');
    modal.className = 'axion-modal ws-modal';
    modal.innerHTML = `<h3>${ic('folder')} ${AXION.t('workspace') || 'Workspace (Local / Private)'}</h3>
      <div class="ws-list"></div>
      <div class="axion-modal-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>Close</button></div>`;
    const list = modal.querySelector('.ws-list');
    if (!files.length) list.innerHTML = '<p class="ws-empty">' + (AXION.t('wsEmpty') || 'Workspace is empty. The AI can create files here with the workspace tool.') + '</p>';
    files.forEach(f => {
      const row = document.createElement('div');
      row.className = 'ws-row';
      const kb = Math.round(new Blob([f.content]).size / 102.4) / 10;
      row.innerHTML = `<span class="ws-path">${esc(f.path)}</span><span class="ws-size">${kb} KB</span>`;
      row.addEventListener('click', () => {
        const existing = modal.querySelector('.ws-preview');
        if (existing) existing.remove();
        const pre = document.createElement('pre');
        pre.className = 'ws-preview';
        pre.textContent = String(f.content).slice(0, 8000);
        modal.insertBefore(pre, modal.querySelector('.axion-modal-actions'));
      });
      list.appendChild(row);
    });
    wrap.appendChild(modal);
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    modal.querySelector('[data-close]').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  };
  workspaceBtn && workspaceBtn.addEventListener('click', openWorkspacePanel);
  /* ---------- Greeting (empty state) ---------- */
  const greeting = () => {
    const h = new Date().getHours();
    const id = (AXION.settings && AXION.settings.lang) === 'id';
    let part;
    if (h < 11) part = id ? 'Selamat pagi' : 'Good morning';
    else if (h < 15) part = id ? 'Selamat siang' : 'Good afternoon';
    else if (h < 19) part = id ? 'Selamat sore' : 'Good evening';
    else part = id ? 'Selamat malam' : 'Good evening';
    return part + (id ? ', apa yang bisa saya bantu?' : ', how can I help you?');
  };
  /* ---------- Render full chat ---------- */
  const renderChat = () => {
    if (!chatEl) return;
    chatEl.innerHTML = '';
    const conv = getConv();
    if (!conv) return;
    if (!conv.messages.length && localStorage.getItem('axion_welcome_dismissed') !== '1') {
      const w = document.createElement('div');
      w.className = 'welcome';
      w.innerHTML = `<div class="welcome-logo">AX</div><h2>${esc(greeting())}</h2>` +
        (isTempChat() ? `<p class="welcome-temp">${esc(AXION.t('tempWelcome'))}</p>` : '');
      chatEl.appendChild(w);
    }
    conv.messages.forEach((msg, idx) => {
      if (msg.role === 'user' && msg.system) {
        const note = document.createElement('div');
        note.className = 'msg-system';
        note.textContent = msg.content;
        chatEl.appendChild(note);
      } else if (msg.role === 'user') {
        addUserMessage(msg.content, msg.files, idx, msg.edited, msg);
      } else {
        const { main, content, steps } = createBotMessage();
        // Restore saved thinking + tool steps so they survive reload (like ChatGPT/Claude)
        if (msg.steps && msg.steps.length) msg.steps.forEach(s => addStep(steps, s));
        else if (msg.thinking) addStep(steps, { n: 'savedthink', type: 'thinking', label: AXION.t('thinking'), status: 'done', bodyText: msg.thinking });
        renderFinalContent(content, msg.content, null, null);
        addBotFooter(content, msg.content);
        appendRevisionControls(main, msg, idx);
        if (msg.outputTokenEstimate) { const usage=document.createElement('div'); usage.className='token-usage'; usage.textContent=AXION.settings.lang==='id'?`~${Number(msg.outputTokenEstimate).toLocaleString()} token output (perkiraan)`:`~${Number(msg.outputTokenEstimate).toLocaleString()} output tokens (estimated)`; main.appendChild(usage); }
        if (msg.sources && msg.sources.length) addSearchBalls(main, msg.sources);
      }
    });
    updateTopbarVisibility();
    chatEl.scrollTop = chatEl.scrollHeight;
  };
  AXION.shareLibraryFile = async (id) => {
    const conv = getConv(); if (!conv || !AXION.storage) return false;
    if (conv.messages.some(m => m.role === 'user' && (m.attachmentRefs || []).includes(id))) return true;
    const pair = await AXION.storage.getLibraryBlob(id); await AXION.storage.markShared(id, true);
    const msg = { role: 'user', content: (AXION.settings.lang === 'id' ? 'Lampiran dibagikan: ' : 'Shared attachment: ') + pair.meta.name, files: [pair.meta.name], attachmentRefs: [id], sharedFile: true, revisions: [{ content: (AXION.settings.lang === 'id' ? 'Lampiran dibagikan: ' : 'Shared attachment: ') + pair.meta.name, files: [pair.meta.name], attachmentRefs: [id], snapshot: null }], revisionIndex: 0 };
    conv.history.push({ role: 'user', parts: [{ text: msg.content, attachmentId: id }] }); conv.messages.push(msg); saveConversations(); renderChat(); return true;
  };

  /* ---------- Init ---------- */
  AXION.settings.tempChat = false;
  loadConversations();
  populateProviders();
  populateModels();
  renderThinkingLevels();
  renderHistory();
  renderChat();
  const consumeLibraryChatSelection = async () => {
    let raw=null;try{raw=sessionStorage.getItem('axion_library_chat_selection');}catch(_){} if(!raw||!AXION.storage)return;
    try {
      const selection=JSON.parse(raw);sessionStorage.removeItem('axion_library_chat_selection');
      if(selection.newChat){const empty=conversations.find(c=>!(c.messages||[]).length);if(empty)activeConvId=empty.id;else createConversation(AXION.t('newChat'));}
      else if(selection.conversationId&&conversations.some(c=>c.id===selection.conversationId)) activeConvId=selection.conversationId;
      else if(selection.conversationId){const stored=(()=>{try{return JSON.parse(localStorage.getItem('axion_conversations')||'[]')}catch(_){return []}})();const found=stored.find(c=>c.id===selection.conversationId);if(found){conversations=conversations.filter(c=>c.id!==found.id);conversations.unshift(found);activeConvId=found.id;}}
      const picked=[];for(const id of selection.ids||[]){try{const pair=await AXION.storage.getLibraryBlob(id);picked.push({id:pair.meta.id,fileId:pair.meta.id,name:pair.meta.name,mimeType:pair.meta.mimeType,size:pair.meta.size,blob:pair.blob,isZip:/\.zip$/i.test(pair.meta.name),fromLibrary:true});}catch(e){AXION.ui.toast('Could not attach file '+id+': '+e.message)}}
      addAttachedFiles(picked);saveConversations();renderHistory();renderChat();if(picked.length)AXION.ui.toast(AXION.settings.lang==='id'?`${picked.length} file dilampirkan ke kolom input.`:`${picked.length} file(s) attached to the composer.`);
    } catch(e){AXION.ui.toast('Library selection restore failed: '+e.message);}
  };
  AXION.storage?.ready?.then(async () => { try { const durable = await AXION.storage.getValue('axion_conversations'); if (durable && !isTempChat()) { localStorage.setItem('axion_conversations', durable); loadConversations(); renderHistory(); renderChat(); updateTokenCounter(); } } catch (_) {} await consumeLibraryChatSelection(); });
  const scrollTopBtn=document.getElementById('scrollToTop'), scrollBottomBtn=document.getElementById('scrollToBottom');
  const updateQuickScroll=()=>{if(!scrollTopBtn||!scrollBottomBtn)return;const top=chatEl.scrollTop<=12, bottom=chatEl.scrollTop+chatEl.clientHeight>=chatEl.scrollHeight-18;scrollTopBtn.classList.toggle('hidden',top);scrollBottomBtn.classList.toggle('hidden',bottom);};
  scrollTopBtn?.addEventListener('click',()=>chatEl.scrollTo({top:0,behavior:'smooth'}));scrollBottomBtn?.addEventListener('click',()=>chatEl.scrollTo({top:chatEl.scrollHeight,behavior:'smooth'}));chatEl.addEventListener('scroll',updateQuickScroll,{passive:true});new ResizeObserver(updateQuickScroll).observe(chatEl);updateQuickScroll();
  updateEnterHint();
  window.addEventListener('resize', updateEnterHint);
  updateTempUI();
  updateModelPill();
  updateTopbarVisibility();
  updateTokenCounter();
})();
