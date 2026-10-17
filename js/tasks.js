/* Persistent internal task list, stored in IndexedDB across sessions. */
window.AXION = window.AXION || {};
AXION.tasks = (() => {
  const execute = async payload => {
    let s=payload; if(typeof s==='string'){try{s=JSON.parse(s)}catch(_){s={action:'add',title:s}}}
    const action=String(s.action||'list').toLowerCase(); const current=await AXION.storage.listTasks();
    if(action==='list')return {ok:true,text:current.length?current.map(t=>`[${t.status}] ${t.id}: ${t.title}${t.notes?' — '+t.notes:''}`).join('\n'):'No persistent tasks.'};
    if(action==='add'||action==='create') {const task={id:s.id||'task_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),title:String(s.title||s.name||'Untitled task'),notes:String(s.notes||''),status:s.status||'todo',createdAt:Date.now()};await AXION.storage.saveTask(task);return {ok:true,text:`Task created: ${task.id} — ${task.title}`};}
    if(action==='update'||action==='complete'||action==='delete'||action==='remove') {const id=String(s.id||'');const t=current.find(x=>x.id===id);if(!t)return {ok:false,text:'Task id not found: '+id};if(action==='delete'||action==='remove'){await AXION.storage.del('tasks',id);return {ok:true,text:'Task removed: '+id};}t.status=action==='complete'?'done':String(s.status||t.status);if(s.title!==undefined)t.title=String(s.title);if(s.notes!==undefined)t.notes=String(s.notes);await AXION.storage.saveTask(t);return {ok:true,text:`Task updated: ${t.id} [${t.status}] ${t.title}`};}
    return {ok:false,text:'Task actions: list, add {title,notes}, update {id,status,title,notes}, complete {id}, delete {id}.'};
  };
  return { execute, list:()=>AXION.storage.listTasks() };
})();
