window.AXION = window.AXION || {};
(() => {
  const $=id=>document.getElementById(id); const sel=$('providerId'); if(!sel)return;
  const all=()=>AXION.PROVIDERS;
  const param=new URLSearchParams(location.search).get('provider');
  const render=()=>{sel.innerHTML='';all().forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.label;sel.appendChild(o)});if(param&&all().some(p=>p.id===param))sel.value=param;load();};
  const load=()=>{const p=AXION.getProvider(sel.value);$('providerTitle').textContent=p.label+' API settings';$('providerKey').value=localStorage.getItem(p.keyStorage)||'';$('providerBase').value=localStorage.getItem(p.baseUrlStorage||('axion_baseurl_'+p.id))||p.baseUrl;$('providerModel').value=AXION.settings.customProviderModels?.[p.id] || (p.id===AXION.settings.provider?AXION.settings.model:'');};
  sel.addEventListener('change',load);$('providerSettingsForm').addEventListener('submit',e=>{e.preventDefault();const p=AXION.getProvider(sel.value),base=$('providerBase').value.trim(),model=$('providerModel').value.trim();localStorage.setItem(p.keyStorage,$('providerKey').value.trim());localStorage.setItem(p.baseUrlStorage||('axion_baseurl_'+p.id),base);AXION.settings.customProviderModels=AXION.settings.customProviderModels||{};if(model)AXION.settings.customProviderModels[p.id]=model;if(p.id.startsWith('custom_user_')){const entry=(AXION.settings.customProviders||[]).find(x=>x.id===p.id);if(entry){entry.baseUrl=base;if(model)entry.model=model;}}AXION.saveSettings();AXION.refreshCustomProviders();$('providerSaved').textContent=AXION.settings.lang==='id'?'Tersimpan':'Saved';setTimeout(()=>$('providerSaved').textContent='',1800);});
  render();
})();
