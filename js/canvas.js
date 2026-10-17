/* Command-driven Canvas block with full-screen View All modal. */
window.AXION = window.AXION || {};
AXION.canvas = (() => {
  const id = () => AXION.settings?.lang === 'id';
  const fullScreen = (title, content) => {
    const wrap=document.createElement('div');wrap.className='axion-fullscreen-viewer canvas-fullscreen-viewer';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
    const head=document.createElement('div');head.className='viewer-header';
    const label=document.createElement('div');label.className='viewer-title';label.textContent=title;
    const copy=document.createElement('button');copy.type='button';copy.className='btn btn-ghost btn-sm';copy.textContent=id()?'Salin':'Copy';
    const close=document.createElement('button');close.type='button';close.className='btn btn-ghost btn-sm viewer-close';close.textContent=id()?'Tutup':'Close';
    const body=document.createElement('pre');body.className='viewer-content';body.textContent=content;
    head.append(label,copy,close);wrap.append(head,body);document.body.appendChild(wrap);
    const dispose=()=>wrap.remove();close.addEventListener('click',dispose);wrap.addEventListener('click',e=>{if(e.target===wrap)dispose();});
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(content);}catch(_){const ta=document.createElement('textarea');ta.value=content;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}AXION.ui?.toast(id()?'Canvas disalin.':'Canvas copied.');});
    body.addEventListener('wheel',e=>{if(e.deltaY>0)dispose();},{passive:true});let y=0;body.addEventListener('touchstart',e=>{y=e.touches[0].clientY;},{passive:true});body.addEventListener('touchend',e=>{if(y-e.changedTouches[0].clientY>65)dispose();},{passive:true});
    const esc=e=>{if(e.key==='Escape'){dispose();document.removeEventListener('keydown',esc);}};document.addEventListener('keydown',esc);
  };
  const renderCard = (spec, host) => {
    const title=String(spec.title||'Canvas'),content=String(spec.content||spec.code||spec.text||'');
    if(!host)return null;
    const card=document.createElement('section');card.className='canvas-card';
    const head=document.createElement('div');head.className='canvas-head';
    const label=document.createElement('strong');label.textContent=title;
    const actions=document.createElement('div');actions.className='canvas-actions';
    const copy=document.createElement('button');copy.type='button';copy.className='btn btn-sm btn-ghost';copy.textContent=id()?'Salin':'Copy';
    const view=document.createElement('button');view.type='button';view.className='btn btn-sm btn-primary';view.textContent=id()?'Lihat Semua':'View All';
    actions.append(copy,view);head.append(label,actions);card.appendChild(head);
    const pre=document.createElement('pre');pre.className='canvas-content';const lines=content.split('\n').slice(0,15);while(lines.length<15)lines.push('');pre.textContent=lines.join('\n');card.appendChild(pre);
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(content);}catch(_){const ta=document.createElement('textarea');ta.value=content;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}AXION.ui?.toast(id()?'Canvas disalin.':'Canvas copied.');});
    view.addEventListener('click',()=>fullScreen(title,content));host.appendChild(card);if(host.id==='chat')host.scrollTop=host.scrollHeight;return card;
  };
  const create = spec => {
    spec=typeof spec==='string'?{content:spec}:(spec||{});
    const normalized={title:String(spec.title||'Canvas'),content:String(spec.content||spec.code||spec.text||'')};
    if (AXION.currentOutputHost) { AXION.pendingCanvases=AXION.pendingCanvases||[]; AXION.pendingCanvases.push(normalized); return {queued:true}; }
    const host=document.getElementById('chat')||document.querySelector('.page-container');return renderCard(normalized,host);
  };
  const renderPending = host => { const items=(AXION.pendingCanvases||[]).splice(0); for(const item of items)renderCard(item,host); };
  return {create,fullScreen,renderPending};
})();
