// GCMBS 10.0.67 - HF10 R12
// Recuperação específica do menu Cadastro de Guardas no Online/PWA/App.
// Não altera banco, permissões, payloads nem regras do Desktop.
const HF10_R12='20260824hf10r12';
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let loading=false;

function guardasAtivo(){
  const b=document.querySelector('#mainNav [data-module="cadastro_guardas"].active');
  const v=document.querySelector('[data-view="online"]');
  return !!b && !!v && !v.classList.contains('hidden');
}
function telaNormalResolvida(){
  const card=document.getElementById('onlineRegistrosCard');
  const lista=document.getElementById('onlineRegistros');
  return !!card && !card.classList.contains('hidden') && !!lista && String(lista.textContent||'').trim() && !/carregando|falha ao carregar/i.test(String(lista.textContent||''));
}
async function api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão não autenticada. Entre novamente no GCMBS.');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let body={};try{body=await r.json()}catch{}
  if(!r.ok)throw new Error(body.message||`Erro ${r.status}`);
  return body;
}
function linha(d){
  const nome=d.nome_guerra||d.nome_completo||'GCM';
  const meta=[d.matricula&&`Matrícula ${d.matricula}`,d.cargo,d.equipe,d.status].filter(Boolean).join(' · ');
  const extra=[d.nome_completo&&d.nome_completo!==nome?d.nome_completo:'',d.posto_prioritario&&`Posto prioritário: ${d.posto_prioritario}`,d.categoria_cnh&&`CNH ${d.categoria_cnh}`].filter(Boolean).join(' · ');
  return `<article class="record-card"><div class="record-card-head"><strong>${esc(nome)}</strong><span>${esc(d.status||'')}</span></div><div class="record-meta">${esc(meta||'Cadastro funcional')}</div>${extra?`<div>${esc(extra)}</div>`:''}</article>`;
}
function renderResgate(records){
  const host=document.getElementById('onlineEntidades');
  if(!host)return;
  host.closest('.card')?.classList.remove('hidden');
  document.getElementById('onlineRegistrosCard')?.classList.add('hidden');
  const rows=(records||[]).map(r=>r?.data||{});
  const valid=rows.filter(d=>d&&typeof d==='object');
  host.innerHTML=`<div class="notice module-safe-note"><strong>Cadastro de Guardas · HF10 R12</strong><br>Modo de recuperação ativo. Os dados abaixo vêm da mesma base sincronizada do GCMBS.</div><div class="toolbar"><b>${valid.length} GCM(s)</b><button type="button" class="mini" data-hf10-r12-reload="1">Recarregar Guardas</button></div><div class="record-grid">${valid.map(linha).join('')||'<div class="empty">Nenhum GCM encontrado.</div>'}</div>`;
  delete host.dataset.hf10LoadingSince;
}
async function recuperarGuardas(force=false){
  if(loading||!guardasAtivo())return;
  if(!force&&telaNormalResolvida())return;
  const host=document.getElementById('onlineEntidades');
  const txt=String(host?.textContent||'');
  if(!force && host && !/carregando|falha ao carregar|servidor não respondeu|tempo limite/i.test(txt) && txt.trim())return;
  loading=true;
  try{
    const body=await api('entity_list',{entity:'guardas',limit:500,offset:0});
    if(!guardasAtivo())return;
    if(!force&&telaNormalResolvida())return;
    renderResgate(body.records||[]);
    console.info('[GCMBS] HF10 R12 Guardas recuperado',HF10_R12,(body.records||[]).length);
  }catch(e){
    if(host&&guardasAtivo())host.innerHTML=`<div class="notice"><strong>Falha ao carregar Guardas</strong><br>${esc(e.message||'Erro de comunicação.')}<br><button type="button" class="mini" data-hf10-r12-reload="1" style="margin-top:10px">Tentar novamente</button></div>`;
  }finally{loading=false;}
}
document.addEventListener('click',ev=>{
  const reload=ev.target.closest?.('[data-hf10-r12-reload]');
  if(reload){ev.preventDefault();recuperarGuardas(true);return;}
  const b=ev.target.closest?.('#mainNav [data-module="cadastro_guardas"]');
  if(!b)return;
  setTimeout(()=>recuperarGuardas(false),1200);
  setTimeout(()=>recuperarGuardas(false),3500);
},true);
window.addEventListener('unhandledrejection',()=>{if(guardasAtivo())setTimeout(()=>recuperarGuardas(false),100);});
console.info('[GCMBS] HF10 R12 recuperação do menu Guardas carregada',HF10_R12);
