window.AXION = window.AXION || {};
AXION.library = (() => {
  const $ = id => document.getElementById(id);
  const idLang = () => AXION.settings?.lang === 'id';
  const tr = (en, id) => idLang() ? id : en;
  const humanSize = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(2)} MB`;
  const extOf = f => (String(f.name || '').split('.').pop() || '').toLowerCase();
  const isDoc = f => /\.(pdf|docx|txt|md|markdown|rtf|html?|css|js|mjs|cjs|ts|tsx|jsx|json|py|xml|csv|ya?ml|svg|log|ini|cfg|toml|sh|sql|java|kt|c|h|cpp|go|rs)$/i.test(f.name || '') || /^(text\/|application\/(pdf|json|xml|rtf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))/.test(f.mimeType || '');
  const isText = f => /\.(txt|md|markdown|html?|css|js|mjs|cjs|ts|tsx|jsx|json|py|xml|csv|ya?ml|svg|log|ini|cfg|toml|sh|sql|java|kt|c|h|cpp|go|rs|rtf)$/i.test(f.name || '') || /^(text\/|application\/(json|xml|javascript|rtf))/.test(f.mimeType || '');
  const iconFor = f => /\.zip$/i.test(f.name) ? 'ZIP' : (extOf(f) || 'FILE').toUpperCase().slice(0,4);
  const download = (blob, name) => { const u=URL.createObjectURL(blob), a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},1200); };
  const allMeta = async () => AXION.storage.listLibrary();
  const closeMenus = () => document.querySelectorAll('.library-menu-pop').forEach(x=>x.remove());
  const selected = new Set();
  let selectionMode = false;
  const selectedIds = () => [...selected];
  const docxText = async blob => {
    if (typeof JSZip === 'undefined') throw new Error('DOCX viewer needs the ZIP component to be available.');
    const zip = await JSZip.loadAsync(blob); const file = zip.file('word/document.xml');
    if (!file) throw new Error('DOCX document.xml was not found.');
    const xml = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('The DOCX document XML is invalid.');
    return [...xml.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join('')).join('\n');
  };
  const viewFile = async f => {
    if (!isDoc(f)) { AXION.ui.toast(tr('View is available only for document files.','Pratinjau hanya tersedia untuk file dokumen.')); return; }
    let pair; try { pair = await AXION.storage.getLibraryBlob(f.id); } catch (e) { AXION.ui.toast('Preview failed: ' + e.message); return; }
    const url = URL.createObjectURL(pair.blob), wrap = document.createElement('div'); wrap.className = 'axion-modal-wrap library-preview-wrap';
    const modal = document.createElement('div'); modal.className = 'axion-modal library-preview-modal';
    const head = document.createElement('div'); head.className = 'library-preview-head'; const title = document.createElement('h3'); title.textContent = f.name; const close = document.createElement('button'); close.type='button'; close.className='btn btn-ghost btn-sm'; close.textContent=tr('Close','Tutup'); head.append(title,close); modal.appendChild(head);
    let disposed=false; const dispose=()=>{if(disposed)return;disposed=true;URL.revokeObjectURL(url);wrap.remove();document.removeEventListener('keydown',onKey);}; const onKey=e=>{if(e.key==='Escape')dispose();}; close.onclick=dispose; document.addEventListener('keydown',onKey);
    const ext=extOf(f);
    if (f.mimeType?.startsWith('image/') && isDoc(f)) { const img=document.createElement('img');img.src=url;img.alt=f.name;img.className='library-preview-image';modal.appendChild(img); }
    else if (ext==='pdf'||f.mimeType==='application/pdf') { const frame=document.createElement('iframe');frame.src=url;frame.className='library-preview-pdf';frame.title=f.name;modal.appendChild(frame); }
    else if (ext==='docx') { const pre=document.createElement('pre');pre.className='library-preview-text';pre.textContent=tr('Converting DOCX…','Mengonversi DOCX…');modal.appendChild(pre);try{pre.textContent=(await docxText(pair.blob)).slice(0,500000)||tr('(No text content found)','(Tidak ada teks yang ditemukan)');}catch(e){pre.textContent=tr('Could not read DOCX: ','DOCX gagal dibaca: ')+e.message;} }
    else { const pre=document.createElement('pre');pre.className='library-preview-text';pre.textContent=(await pair.blob.text()).slice(0,500000);modal.appendChild(pre); }
    wrap.appendChild(modal);document.body.appendChild(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap)dispose();});
    modal.addEventListener('wheel',e=>{if(e.deltaY>0)dispose();},{passive:true});
    let touchStartY=0;modal.addEventListener('touchstart',e=>{touchStartY=e.touches[0].clientY;},{passive:true});modal.addEventListener('touchend',e=>{if(touchStartY-e.changedTouches[0].clientY>65)dispose();},{passive:true});
  };
  const card = f => {
    const c=document.createElement('article'); c.className='library-card'+(selected.has(f.id)?' is-selected':''); c.dataset.fileId=f.id;
    if(selectionMode){const cb=document.createElement('input');cb.type='checkbox';cb.className='library-selectbox';cb.checked=selected.has(f.id);cb.setAttribute('aria-label',tr('Select file ','Pilih file ')+f.name);cb.onchange=()=>{cb.checked?selected.add(f.id):selected.delete(f.id);render();};c.appendChild(cb);}
    const badge=document.createElement('div');badge.className='library-file-icon';badge.textContent=iconFor(f);c.appendChild(badge);
    const title=document.createElement('div');title.className='library-file-name';title.textContent=f.name;title.title=f.name;c.appendChild(title);
    const meta=document.createElement('div');meta.className='library-file-meta';meta.textContent=`${humanSize(f.size)} · ${f.shared?tr('Shared to chat','Dibagikan ke chat'):tr('Private · File Library','Pribadi · Pustaka File')}`;c.appendChild(meta);
    const path=document.createElement('div');path.className='library-file-path';path.textContent=f.relativePath&&f.relativePath!==f.name?f.relativePath:(f.source||'');c.appendChild(path);
    const actions=document.createElement('div');actions.className='library-file-actions';
    const button=(label,fn,style='btn-ghost')=>{const b=document.createElement('button');b.type='button';b.className='btn btn-sm '+style;b.textContent=label;b.addEventListener('click',fn);actions.appendChild(b);return b;};
    if(isDoc(f))button(tr('View File','Lihat File'),()=>viewFile(f));
    button(tr('Download','Unduh'),async()=>{try{const x=await AXION.storage.getLibraryBlob(f.id);download(x.blob,f.name);}catch(e){AXION.ui.toast('Download failed: '+e.message);}},'btn-primary');
    if(/\.zip$/i.test(f.name))button(tr('Extract ZIP','Ekstrak ZIP'),async()=>{const r=await AXION.terminal.execute({command:'unzip',id:f.id,dest:'library-extracted/'+f.id});AXION.ui.toast(r.text);await render();});
    if(!f.shared)button(tr('Share to chat','Bagikan ke chat'),async()=>{await AXION.storage.markShared(f.id,true);if(AXION.shareLibraryFile)await AXION.shareLibraryFile(f.id);await render();});
    button(tr('Delete','Hapus'),async()=>{if(await AXION.ui.confirm(tr('Delete file?','Hapus file?'),tr('This permanently removes the file from File Library.','File ini akan dihapus permanen dari Pustaka File.'),'',{yes:tr('Delete','Hapus'),no:tr('Cancel','Batal')})){await AXION.storage.deleteLibrary(f.id);selected.delete(f.id);await render();}},'btn-danger');
    c.appendChild(actions); if(selectionMode)c.addEventListener('click',e=>{if(e.target.closest('button,input'))return;selected.has(f.id)?selected.delete(f.id):selected.add(f.id);render();}); return c;
  };
  const matches=(f,q,type)=>{if(q&&!(f.name+' '+(f.relativePath||'')+' '+(f.source||'')).toLowerCase().includes(q))return false;if(type==='zip'&&!/\.zip$/i.test(f.name))return false;if(type==='text'&&!isText(f))return false;if(type==='media'&&!(/^image\//.test(f.mimeType)||/^audio\//.test(f.mimeType)||/^video\//.test(f.mimeType)))return false;return true;};
  const selectedToolbar = async () => {
    const old=$('librarySelectionToolbar');if(old)old.remove();if(!selectionMode)return;
    const bar=document.createElement('div');bar.id='librarySelectionToolbar';bar.className='library-selection-toolbar';
    const label=document.createElement('span');label.textContent=tr(`${selected.size} selected`,` ${selected.size} file dipilih`);bar.appendChild(label);
    const btn=(text,fn,cls='btn-ghost')=>{const b=document.createElement('button');b.type='button';b.className='btn btn-sm '+cls;b.textContent=text;b.onclick=fn;bar.appendChild(b);};
    btn(tr('Delete Selected','Hapus Pilihan'),async()=>{const ids=selectedIds();if(!ids.length)return;const ok=await AXION.ui.confirm(tr('Delete selected files?','Hapus file terpilih?'),tr(`Permanently delete ${ids.length} file(s)?`,`Hapus permanen ${ids.length} file?`),'',{yes:tr('Delete','Hapus'),no:tr('Cancel','Batal')});if(!ok)return;for(const id of ids)await AXION.storage.deleteLibrary(id).catch(()=>{});selected.clear();await render();},'btn-danger');
    btn(tr('Chat With ▾','Chat Dengan ▾'),()=>showChatSubmenu(bar));
    btn(tr('Download Selected','Unduh Pilihan'),async()=>{const ids=selectedIds();if(!ids.length)return;try{if(typeof JSZip!=='undefined'){const zip=new JSZip();for(const id of ids){const x=await AXION.storage.getLibraryBlob(id);const path=String(x.meta.relativePath||x.meta.name).replace(/^\/+|\\/g,'');zip.file(path||x.meta.name,x.blob);}const blob=await zip.generateAsync({type:'blob'});download(blob,'axion-library-selected.zip');}else{for(const id of ids){const x=await AXION.storage.getLibraryBlob(id);download(x.blob,x.meta.name);await new Promise(r=>setTimeout(r,180));}}}catch(e){AXION.ui.toast((idLang()?'Unduhan gagal: ':'Download failed: ')+e.message);}});
    btn(tr('Done','Selesai'),()=>{selectionMode=false;selected.clear();render();});
    $('libraryGrid').parentElement.appendChild(bar);
  };
  const showChatSubmenu = async anchor => {
    closeMenus();const menu=document.createElement('div');menu.className='library-menu-pop library-chat-submenu';menu.style.position='fixed';menu.style.left=Math.min(anchor.getBoundingClientRect().left,innerWidth-230)+'px';menu.style.bottom='74px';
    const add=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{menu.remove();await fn();};menu.appendChild(b);};
    add(tr('New Chat','Chat Baru'),()=>goToChat({newChat:true}));
    let convs=[];try{convs=JSON.parse(localStorage.getItem('axion_conversations')||'[]');}catch(_){}
    if(!convs.length){const p=document.createElement('div');p.style.padding='10px';p.style.color='var(--text-dim)';p.textContent=tr('No saved conversations','Belum ada percakapan tersimpan');menu.appendChild(p);}
    else convs.filter(c=>(c.messages||[]).length).slice(0,30).forEach(c=>add(c.title||tr('Untitled conversation','Percakapan tanpa judul'),()=>goToChat({conversationId:c.id})));
    document.body.appendChild(menu);setTimeout(()=>{const out=e=>{if(!menu.contains(e.target)){menu.remove();document.removeEventListener('pointerdown',out,true);}};document.addEventListener('pointerdown',out,true);},0);
  };
  const goToChat = data => {const ids=selectedIds();if(!ids.length){AXION.ui.toast(tr('Select at least one file.','Pilih setidaknya satu file.'));return;}sessionStorage.setItem('axion_library_chat_selection',JSON.stringify({...data,ids}));location.href='index.html';};
  const menuUI = () => {
    closeMenus();const menu=document.createElement('div');menu.className='library-menu-pop';
    const add=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{menu.remove();fn();};menu.appendChild(b);};
    add(tr('Select Files','Pilih File'),()=>{selectionMode=true;selected.clear();render();});
    add(tr('Clear All Data','Hapus Semua Data'),async()=>{const all=await allMeta();if(!all.length)return;const ok=await AXION.ui.confirm(tr('Clear all Library data?','Hapus semua data Pustaka?'),tr(`This will permanently delete ${all.length} file(s).`,`Ini akan menghapus permanen ${all.length} file.`),'',{yes:tr('Clear All','Hapus Semua'),no:tr('Cancel','Batal')});if(!ok)return;for(const f of all)await AXION.storage.deleteLibrary(f.id).catch(()=>{});selected.clear();await render();});
    const holder=$('libraryMenuHolder');holder.appendChild(menu);const outside=e=>{if(!menu.contains(e.target)&&!holder.contains(e.target)){menu.remove();document.removeEventListener('pointerdown',outside,true);}};setTimeout(()=>document.addEventListener('pointerdown',outside,true),0);
  };
  const render = async () => {
    if(!$('libraryGrid'))return;await AXION.storage.ready;
    const all=await allMeta(),q=($('libraryFilter').value||'').trim().toLowerCase(),type=$('libraryTypeFilter').value;const shown=all.filter(f=>matches(f,q,type));
    selected.forEach(id=>{if(!all.some(f=>f.id===id))selected.delete(id);});$('libraryGrid').innerHTML='';shown.forEach(f=>$('libraryGrid').appendChild(card(f)));
    $('libraryEmpty').classList.toggle('hidden',shown.length>0);$('libraryStatus').textContent=idLang()?`${shown.length} dari ${all.length} file · penyimpanan: ${(await AXION.storage.ready).backend||'lokal'}`:`${shown.length} of ${all.length} files · storage: ${(await AXION.storage.ready).backend||'local'}`;
    const count=$('librarySelectionToolbar');if(selectionMode)await selectedToolbar();else count?.remove();AXION.applyI18n?.();
  };
  const upload = async files => {for(const f of files){try{const rec=await AXION.storage.addLibraryFile(f,{source:'user-upload',shared:false});if(rec.duplicate)AXION.ui.toast(idLang()?`${f.name} sudah ada; duplikat dilewati.`:`${f.name} already exists; duplicate skipped.`);}catch(e){AXION.ui.toast(`Upload failed: ${f.name} — ${e.message}`);}}await render();};
  const pickFiles = async () => {
    const all=await allMeta();if(!all.length){AXION.ui.toast(tr('File Library is empty. Upload a file there first.','Pustaka File kosong. Unggah file terlebih dahulu.'));return [];}
    return new Promise(resolve=>{
      const wrap=document.createElement('div');wrap.className='axion-modal-wrap';const modal=document.createElement('div');modal.className='axion-modal library-picker';
      modal.innerHTML=`<div class="library-preview-head"><h3>${tr('Choose from Library','Pilih dari Pustaka')}</h3><button type="button" class="btn btn-ghost btn-sm" data-close aria-label="${tr('Close','Tutup')}">×</button></div><p>${tr('Select one or more files to attach to chat.','Pilih satu atau beberapa file untuk dilampirkan ke chat.')}</p><div class="library-picker-list"></div><div class="axion-modal-actions"><button type="button" class="btn btn-ghost btn-sm" data-cancel>${tr('Cancel','Batal')}</button><button type="button" class="btn btn-primary btn-sm" data-add>${tr('Attach selected','Lampirkan pilihan')}</button></div>`;
      const list=modal.querySelector('.library-picker-list');all.forEach(f=>{const row=document.createElement('label');row.className='library-picker-row';const cb=document.createElement('input');cb.type='checkbox';cb.value=f.id;const span=document.createElement('span');span.textContent=`${f.name} · ${humanSize(f.size)}`;row.append(cb,span);list.appendChild(row);});
      let doneOnce=false;const done=async yes=>{if(doneOnce)return;doneOnce=true;wrap.remove();if(!yes){resolve([]);return;}const ids=[...list.querySelectorAll('input:checked')].map(x=>x.value),picked=[];for(const id of ids){try{const x=await AXION.storage.getLibraryBlob(id);picked.push({id:x.meta.id,name:x.meta.name,mimeType:x.meta.mimeType,size:x.meta.size,isZip:/\.zip$/i.test(x.meta.name),fileId:x.meta.id,blob:x.blob,fromLibrary:true});}catch(_){}}resolve(picked);};
      modal.querySelector('[data-cancel]').onclick=()=>done(false);modal.querySelector('[data-close]').onclick=()=>done(false);modal.querySelector('[data-add]').onclick=()=>done(true);wrap.appendChild(modal);document.body.appendChild(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap)done(false);});const key=e=>{if(e.key==='Escape'){done(false);document.removeEventListener('keydown',key);}};document.addEventListener('keydown',key);
    });
  };
  document.addEventListener('DOMContentLoaded',()=>{
    if(!$('libraryGrid'))return;
    const topbar=$('libraryUpload')?.parentElement; if(topbar&&!$('libraryMenuHolder')){const holder=document.createElement('div');holder.id='libraryMenuHolder';holder.className='library-top-menu';const b=document.createElement('button');b.type='button';b.className='icon-btn';b.textContent='☰';b.title=tr('Library menu','Menu pustaka');b.setAttribute('aria-label',b.title);b.onclick=menuUI;holder.appendChild(b);topbar.insertBefore(holder,$('libraryUpload'));}
    $('libraryUpload').addEventListener('change',e=>{upload([...e.target.files]);e.target.value='';});$('libraryFilter').addEventListener('input',render);$('libraryTypeFilter').addEventListener('change',render);$('refreshLibrary').addEventListener('click',render);render().catch(e=>{$('libraryStatus').textContent='Library error: '+e.message;});
  });
  return {render,upload,pickFiles,isDocument:isDoc};
})();
