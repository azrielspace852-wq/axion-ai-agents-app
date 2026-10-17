/* Local memory summaries and IndexedDB task tracking. Summaries are generated on-device. */
window.AXION = window.AXION || {};
AXION.memory = (() => {
  const summarize = async conversations => {
    await AXION.storage.ready;
    const all=[];
    (conversations||[]).slice(0,30).forEach(c=>{
      const msgs=(c.messages||[]).filter(m=>!m.system);
      if(!msgs.length)return;
      const latest=msgs.slice(-8).map(m=>`${m.role==='user'?'User':'AXION'}: ${String(m.content||'').replace(/\s+/g,' ').slice(0,260)}`);
      all.push(`Conversation: ${String(c.title||'Untitled').slice(0,100)}\n${latest.join('\n')}`);
    });
    const summary=all.join('\n\n').slice(-10000);
    if(summary) { await AXION.storage.saveMemory(summary); window.__axionMemorySummary=summary; }
    return summary;
  };
  const load = async () => { try { const m=await AXION.storage.getMemory(); window.__axionMemorySummary=m.summary||''; return m; } catch (_) { return {summary:'',updatedAt:0}; } };
  AXION.storage.ready.then(() => load()).catch(() => {});
  return { summarize, load };
})();
