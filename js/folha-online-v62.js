// GCMBS 10.0.62 — Folha de Pagamento Online/App com regras consolidadas no servidor.
// Consulta funciona pela réplica; gravações só são habilitadas após o Desktop publicar writable=true.
const FOLHA_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-folha-v62';
const MAIN_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const f$=id=>document.getElementById(id);
const fEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fNum=v=>Number(v||0);
const fMoney=v=>fNum(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fHoras=v=>`${fNum(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}h`;
const fCompAtual=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);
const fMesRotulo=c=>{const m=String(c||'').match(/^(\d{4})-(\d{2})$/);return m?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(`${m[1]}-${m[2]}-01T12:00:00`)):c||'';};
let folhaBusy=false,folhaLoaded='',folhaData=null,folhaWrite=null,folhaTimer=null,folhaScheduled=false;

function fToken(){return localStorage.getItem('gcmbs.mobile.token')||'';}
async function fPost(url,body){
  const token=fToken();if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
async function fApi(action,payload={}){return fPost(FOLHA_API,{action,...payload});}
async function fCatalog(){
  const b=await fPost(MAIN_API,{action:'entity_catalog'}),m=new Map((b.entities||[]).map(x=>[x.entity,!!x.writable]));
  return {
    config:!!m.get('folha_pagamento_config')&&!!m.get('folha_pagamento_parametros'),
    ajustes:!!m.get('folha_pagamento_ajustes'),
    preferencias:!!m.get('folha_pagamento_preferencias'),
    raw:m
  };
}
const isFolha=()=>String(f$('onlineTitulo')?.textContent||'').trim()==='Folha de Pagamento';
function injectFolhaStyle(){
  if(f$('folhaV62Style'))return;const s=document.createElement('style');s.id='folhaV62Style';s.textContent=`
  #folhaV62Root{display:grid;gap:14px}.folha-toolbar{display:grid;grid-template-columns:minmax(180px,240px) auto auto 1fr;gap:10px;align-items:end;padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}.folha-toolbar label{display:grid;gap:6px;font-size:13px}.folha-toolbar input{min-height:42px}.folha-btn{min-height:42px;padding:0 18px;border:0;border-radius:10px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer}.folha-btn.secondary{background:#64748b}.folha-btn:disabled{opacity:.5;cursor:not-allowed}.folha-notice{padding:12px 14px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#1e3a8a}.folha-notice.warn{border-color:#fde68a;background:#fffbeb;color:#92400e}.folha-config{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr)) auto;gap:10px;align-items:end;padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}.folha-config label{display:grid;gap:6px;font-size:13px}.folha-config input{min-height:42px}.folha-metrics{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:10px}.folha-metric{padding:13px;border:1px solid #dbe4f0;border-radius:12px;background:#fff}.folha-metric span{display:block;color:#64748b;font-size:12px}.folha-metric b{display:block;margin-top:5px;font-size:19px}.folha-table-wrap{overflow:auto;border:1px solid #dbe4f0;border-radius:12px;background:#fff}.folha-table{border-collapse:collapse;min-width:1500px;width:max-content}.folha-table th,.folha-table td{padding:8px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:12px;white-space:nowrap;text-align:center}.folha-table th{background:#f8fafc;position:sticky;top:0;z-index:2}.folha-table th:first-child,.folha-table td:first-child{position:sticky;left:0;background:#fff;text-align:left;z-index:1;min-width:160px}.folha-table th:first-child{background:#f8fafc;z-index:3}.folha-dia{min-width:30px}.folha-x{font-weight:800}.folha-f{color:#b91c1c;font-weight:800}.folha-fj{color:#92400e;font-weight:800}.folha-adic{min-height:34px;border:1px solid #cbd5e1;border-radius:7px;background:#fff}.folha-section{padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}.folha-section h3{margin:0 0 10px}.folha-list{display:grid;gap:6px;font-size:13px}.folha-list div{padding:8px 10px;border-radius:8px;background:#f8fafc}.folha-save-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.folha-status{font-size:13px;color:#52627a}@media(max-width:800px){.folha-toolbar{grid-template-columns:1fr 1fr}.folha-config{grid-template-columns:1fr}.folha-metrics{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(s);
}
function fDiaClass(v){const x=String(v||'').toUpperCase();return x==='X'?'folha-x':x==='F'?'folha-f':x==='FJ'?'folha-fj':'';}
function fObsHtml(o={}){
  const blocos=[];
  if((o.ferias||[]).length)blocos.push(`<div><b>Férias:</b> ${fEsc(o.ferias.join(', '))}</div>`);
  if((o.faltas||[]).length)blocos.push(`<div><b>Faltas:</b> ${o.faltas.map(x=>`${fEsc(x.nome)} (${fEsc(x.quantidade)})`).join(' · ')}</div>`);
  if((o.faltasJustificadas||[]).length)blocos.push(`<div><b>Faltas justificadas:</b> ${o.faltasJustificadas.map(x=>`${fEsc(x.nome)} (${fEsc(x.quantidade)})`).join(' · ')}</div>`);
  if((o.transportados||[]).length)blocos.push(`<div><b>Horas transportadas:</b> ${o.transportados.map(x=>`${fEsc(x.nome)} — 50% ${fHoras(x.h50)} / 100% ${fHoras(x.h100)} → ${fEsc(x.destino)}`).join(' · ')}</div>`);
  if((o.recebidos||[]).length)blocos.push(`<div><b>Horas recebidas:</b> ${o.recebidos.map(x=>`${fEsc(x.nome)} — 50% ${fHoras(x.h50)} / 100% ${fHoras(x.h100)}`).join(' · ')}</div>`);
  for(const [st,nomes] of Object.entries(o.status||{}))if((nomes||[]).length)blocos.push(`<div><b>${fEsc(st)}:</b> ${fEsc(nomes.join(', '))}</div>`);
  return blocos.join('')||'<div>Nenhuma observação especial na competência.</div>';
}
function fTotals(s=[]){return s.reduce((a,x)=>{a.h50+=fNum(x.horas50);a.h100+=fNum(x.horas100);a.real+=fNum(x.horasRealizadas);a.pay+=fNum(x.horasPagaveis);a.exc+=fNum(x.excedente);a.val+=fNum(x.valorTotal);return a;},{h50:0,h100:0,real:0,pay:0,exc:0,val:0});}
function fReadyText(canEdit){
  if(!canEdit)return 'Perfil com consulta: alterações da Folha não estão autorizadas para este usuário.';
  if(folhaWrite?.config&&folhaWrite?.ajustes)return 'Edição protegida liberada pelo Desktop. Alterações serão enviadas para sincronização e auditoria.';
  return 'Consulta operacional ativa. A edição será liberada automaticamente após o Desktop aplicar o patch P0 e publicar o novo catálogo seguro.';
}
function renderFolha(data,canEdit){
  const root=f$('folhaV62Root');if(!root)return;folhaData=data;const cfg=data.config||{},serv=data.servidores||[],t=fTotals(serv),dias=Array.from({length:Number(data.diasMes||31)},(_,i)=>i+1),editCfg=!!canEdit&&!!folhaWrite?.config,editAj=!!canEdit&&!!folhaWrite?.ajustes;
  const linhas=serv.map(g=>`<tr><td><strong>${fEsc(g.nome_guerra||g.nome_completo||'GCM')}</strong>${g.comando?'<br><small>Grupo Comandantes</small>':''}</td><td>${fEsc(g.status||'ATIVO')}</td>${dias.map(d=>{const v=g.dias?.[d]||'';return `<td class="${fDiaClass(v)}">${fEsc(v)}</td>`}).join('')}<td>${fHoras(g.horas50)}</td><td>${fHoras(g.horas100)}</td><td>${fHoras(g.horasRealizadas)}</td><td>${fHoras(g.horasPagaveis)}</td><td>${fHoras(g.excedente)}</td><td>${fMoney(g.valorTotal)}</td><td><select class="folha-adic" data-folha-adic="${fEsc(g.id)}" ${editAj&&!g.adicionalBloqueado?'':'disabled'}><option value="SIM" ${String(g.adicionalNoturno).toUpperCase()==='SIM'?'selected':''}>SIM</option><option value="NAO" ${String(g.adicionalNoturno).toUpperCase()!=='SIM'?'selected':''}>NÃO</option></select>${g.adicionalBloqueado?'<br><small>bloqueado</small>':''}</td></tr>`).join('')||'<tr><td colspan="40">Nenhum servidor encontrado.</td></tr>';
  root.innerHTML=`
    <div class="folha-notice ${editCfg&&editAj?'':'warn'}"><strong>Folha de Pagamento · ${fEsc(fMesRotulo(cfg.competencia||fCompAtual()))}</strong><br>${fEsc(fReadyText(canEdit))}</div>
    <div class="folha-config">
      <label>Valor hora 50%<input id="folhaValor50" type="number" min="0" step="0.01" value="${fEsc(cfg.valor_50??0)}" ${editCfg?'':'disabled'}></label>
      <label>Valor hora 100%<input id="folhaValor100" type="number" min="0" step="0.01" value="${fEsc(cfg.valor_100??0)}" ${editCfg?'':'disabled'}></label>
      <label>Limite máximo de horas<input id="folhaMaxHoras" type="number" min="0" step="0.5" value="${fEsc(cfg.max_horas??0)}" ${editCfg?'':'disabled'}></label>
      <button id="folhaSalvarConfig" class="folha-btn" type="button" ${editCfg?'':'disabled'}>Salvar parâmetros</button>
    </div>
    <div class="folha-metrics">
      <div class="folha-metric"><span>Servidores</span><b>${serv.length}</b></div><div class="folha-metric"><span>Horas 50%</span><b>${fHoras(t.h50)}</b></div><div class="folha-metric"><span>Horas 100%</span><b>${fHoras(t.h100)}</b></div><div class="folha-metric"><span>Pagáveis</span><b>${fHoras(t.pay)}</b></div><div class="folha-metric"><span>Excedente</span><b>${fHoras(t.exc)}</b></div><div class="folha-metric"><span>Valor total</span><b>${fMoney(t.val)}</b></div>
    </div>
    <div class="folha-save-row"><button id="folhaSalvarAjustes" class="folha-btn" type="button" ${editAj?'':'disabled'}>Salvar adicional noturno</button><span id="folhaStatus" class="folha-status">Relatório calculado pela réplica sincronizada do Desktop.</span></div>
    <div class="folha-table-wrap"><table class="folha-table"><thead><tr><th>GCM</th><th>Status</th>${dias.map(d=>`<th class="folha-dia">${d}</th>`).join('')}<th>50%</th><th>100%</th><th>Realizadas</th><th>Pagáveis</th><th>Excedente</th><th>Valor</th><th>Adic. noturno</th></tr></thead><tbody>
    ${linhas}
    </tbody></table></div>
    <div class="folha-section"><h3>Observações da competência</h3><div class="folha-list">${fObsHtml(data.observacoes||{})}</div></div>
  `;
  f$('folhaSalvarConfig')?.addEventListener('click',saveFolhaConfig);f$('folhaSalvarAjustes')?.addEventListener('click',saveFolhaAjustes);
  const total=f$('onlineTotal');if(total)total.textContent=String(serv.length);const vis=f$('onlineFiltrados');if(vis)vis.textContent=`${serv.length} servidor(es) · ${fMesRotulo(cfg.competencia||'')}`;
}
async function saveFolhaConfig(){
  const st=f$('folhaStatus'),b=f$('folhaSalvarConfig');if(!folhaData||!b)return;const old=b.textContent;b.disabled=true;b.textContent='Salvando...';
  try{const competencia=f$('folhaCompetencia')?.value||folhaData.config?.competencia||fCompAtual();await fApi('save_config',{config:{competencia,valor_50:fNum(f$('folhaValor50')?.value),valor_100:fNum(f$('folhaValor100')?.value),max_horas:fNum(f$('folhaMaxHoras')?.value)}});if(st){st.textContent='Parâmetros enviados ao Desktop para consolidação.';st.style.color='#15803d';}await loadFolha(true);}
  catch(e){if(st){st.textContent=e.message||'Falha ao salvar parâmetros.';st.style.color='#b91c1c';}}
  finally{b.disabled=false;b.textContent=old;}
}
async function saveFolhaAjustes(){
  const st=f$('folhaStatus'),b=f$('folhaSalvarAjustes');if(!folhaData||!b)return;const old=b.textContent;b.disabled=true;b.textContent='Salvando...';
  try{const competencia=f$('folhaCompetencia')?.value||folhaData.config?.competencia||fCompAtual(),itens=[...document.querySelectorAll('[data-folha-adic]')].filter(x=>!x.disabled).map(x=>({guarda_id:Number(x.dataset.folhaAdic),adicional_noturno:x.value}));await fApi('save_adjustments',{competencia,itens});if(st){st.textContent='Ajustes enviados ao Desktop para consolidação.';st.style.color='#15803d';}await loadFolha(true);}
  catch(e){if(st){st.textContent=e.message||'Falha ao salvar ajustes.';st.style.color='#b91c1c';}}
  finally{b.disabled=false;b.textContent=old;}
}
function ensureFolhaRoot(){
  if(!isFolha())return null;injectFolhaStyle();const host=f$('onlineRegistros'),filtro=f$('onlineFiltro'),novo=f$('onlineNovo'),tabs=f$('onlineEntityTabs');if(!host)return null;if(filtro)filtro.parentElement.style.display='none';if(novo)novo.classList.add('hidden');if(tabs)tabs.classList.add('hidden');let root=f$('folhaV62Root');if(!root){host.innerHTML='';root=document.createElement('div');root.id='folhaV62Root';host.appendChild(root);root.innerHTML='<div class="folha-notice">Carregando Folha de Pagamento...</div>';}
  let bar=f$('folhaV62Toolbar');if(!bar){bar=document.createElement('div');bar.id='folhaV62Toolbar';bar.className='folha-toolbar';bar.innerHTML=`<label>Competência<input id="folhaCompetencia" type="month" value="${fCompAtual()}"></label><button id="folhaAtualizar" class="folha-btn" type="button">Atualizar</button><button id="folhaImprimir" class="folha-btn secondary" type="button">Imprimir</button><span class="folha-status">Mesma competência da Folha Desktop.</span>`;host.parentElement?.insertBefore(bar,host);bar.querySelector('#folhaAtualizar')?.addEventListener('click',()=>loadFolha(true));bar.querySelector('#folhaImprimir')?.addEventListener('click',()=>window.print());bar.querySelector('#folhaCompetencia')?.addEventListener('change',()=>{folhaLoaded='';loadFolha(true);});}
  return root;
}
function cleanupFolha(){const bar=f$('folhaV62Toolbar');if(bar)bar.remove();const filtro=f$('onlineFiltro');if(filtro?.parentElement)filtro.parentElement.style.display='';folhaLoaded='';folhaData=null;}
async function loadFolha(force=false,silent=false){
  const root=ensureFolhaRoot();if(!root||folhaBusy)return;const comp=f$('folhaCompetencia')?.value||fCompAtual();if(!force&&folhaLoaded===comp&&folhaData)return;folhaBusy=true;if(!silent)root.innerHTML='<div class="folha-notice">Calculando Folha de Pagamento...</div>';
  try{folhaWrite=await fCatalog();const b=await fApi('report',{competencia:comp});folhaLoaded=comp;renderFolha(b.data||{},!!b.can_edit);}
  catch(e){root.innerHTML=`<div class="folha-notice warn"><strong>Não foi possível carregar a Folha.</strong><br>${fEsc(e.message||e)}</div>`;}
  finally{folhaBusy=false;}
}
function adjustFolha(){
  if(folhaScheduled)return;folhaScheduled=true;queueMicrotask(()=>{folhaScheduled=false;if(!isFolha()){cleanupFolha();return;}ensureFolhaRoot();if(!folhaData)loadFolha(false);if(!folhaTimer)folhaTimer=setInterval(async()=>{if(!isFolha()||folhaBusy)return;try{const before=JSON.stringify(folhaWrite||{});folhaWrite=await fCatalog();if(JSON.stringify(folhaWrite||{})!==before)await loadFolha(true,true);}catch{}},20000);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',adjustFolha,{once:true});else adjustFolha();
new MutationObserver(adjustFolha).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
