// GCMBS 10.0.62 — auditoria do Controle de Acesso.
// Espelha o fluxo funcional do Desktop sem transformar tabelas tecnicas em
// formularios paralelos. Alteracoes de permissao continuam bloqueadas ate existir
// uma rota protegida que sincronize Online/App -> Desktop de forma auditavel.
const ACCESS_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const MODULOS=[
  ['dashboard','Quadro Operacional'],['cadastro_guardas','Guardas'],['justificativas_faltas','Justificativas'],
  ['equipes','Equipes'],['postos','Postos'],['gerador_escala','Gerador'],['escalas','Gerenciar Escalas'],
  ['tipos_escalas','Tipos de Escalas'],['escala_extra_manual','Escala Extra'],['feriados','Feriados'],
  ['permutas','Permutas'],['eventos_extra','Extra por Evento'],['folha_pagamento','Folha de Pagamento'],
  ['banco_horas','Banco de Horas'],['relatorios','Relatórios'],['viaturas','Viaturas'],
  ['manutencao_viaturas','Manutenção'],['abastecimento_viaturas','Abastecimento'],
  ['checklist_viaturas','Check-list Viaturas'],['relatorios_frota','Relatórios Frota'],
  ['ocorrencias','Ocorrências'],['cautelas','Equipamentos/Cautelas'],['cursos','Cursos/Habilitações'],
  ['operacoes_especiais','Ofícios'],['frequencia','Frequência'],['central_pendencias','Pendências'],
  ['controle_acesso','Controle de Acesso'],['imagens_gcm','Imagens da GCM']
];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
let busy=false,cache=null,selectedId='';

async function call(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(ACCESS_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
async function load(){
  const [u,p,g]=await Promise.all([
    call('entity_list',{entity:'usuarios',limit:500,offset:0}),
    call('entity_list',{entity:'permissoes_usuarios',limit:1000,offset:0}),
    call('entity_list',{entity:'guardas',limit:500,offset:0}).catch(()=>({records:[]}))
  ]);
  const users=(u.records||[]).map(r=>r.data||{}).filter(x=>Number(x.id)>0);
  const perms=(p.records||[]).map(r=>r.data||{}).filter(x=>Number(x.usuario_id)>0&&!String(x.modulo||'').startsWith('__'));
  const guardas=(g.records||[]).map(r=>r.data||{}).filter(x=>Number(x.id)>0);
  const cargoByGuarda=new Map(guardas.map(x=>[Number(x.id),String(x.cargo||'')]));
  return {users,perms,cargoByGuarda};
}
function inModule(){return String(document.getElementById('onlineModuloTitulo')?.textContent||'').trim()==='Controle de Acesso';}
function currentEntity(){return document.querySelector('#onlineEntityTabs .module-tab.active')?.dataset.entityTab||'';}
function roleText(r){const x=norm(r);return x==='comandante'?'Comandante':x==='subcomandante'?'Subcomandante':'GCM';}
function levelFor(user,permMap,mod){
  if(norm(user.role)==='comandante')return 'TOTAL';
  return permMap.get(mod)||'SEM';
}
function levelLabel(x){return x==='TOTAL'?'Acesso total':x==='EDICAO'?'Edição':x==='CONSULTA'?'Somente consulta':'Sem acesso';}
function levelClass(x){return x==='TOTAL'||x==='EDICAO'?'edit':x==='CONSULTA'?'read':'none';}
function infoFor(user){
  const role=norm(user.role);
  if(role==='comandante')return '<b>Comandante:</b> acesso total permanente. As permissões não podem ser reduzidas.';
  if(role==='subcomandante')return '<b>Subcomandante:</b> acesso total é o padrão inicial. Somente o Comandante pode reduzir ou restaurar suas permissões.';
  return '<b>GCM:</b> perfil institucional restrito. Edição deve existir somente nos módulos necessários à função.';
}
function normalizeCpf(v){const s=String(v||'').replace(/\D/g,'');return s||'—';}
function renderSelected(){
  if(!cache)return;
  const host=document.getElementById('gcmbsAccessMatrix'),info=document.getElementById('gcmbsAccessInfo');if(!host||!info)return;
  const user=cache.users.find(x=>String(x.id)===String(selectedId))||cache.users[0];if(!user)return;
  selectedId=String(user.id);
  const map=new Map(cache.perms.filter(p=>Number(p.usuario_id)===Number(user.id)).map(p=>[String(p.modulo),String(p.nivel||'CONSULTA').toUpperCase()]));
  info.innerHTML=infoFor(user);
  host.innerHTML=MODULOS.map(([id,nome])=>{const lvl=levelFor(user,map,id);return `<div class="module-card ready" style="min-height:auto"><div><strong>${esc(nome)}</strong><small>${esc(id)}</small></div><span class="level ${levelClass(lvl)}">${esc(levelLabel(lvl))}</span></div>`}).join('');
}
function renderPage(){
  const host=document.getElementById('onlineRegistros');if(!host||!cache)return;
  if(host.dataset.gcmbsAccessReady==='1'){renderSelected();return;}
  const users=cache.users.slice().sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  const headerName=String(document.getElementById('headerUsuario')?.textContent||'').trim().toLowerCase();
  if(!selectedId){const me=users.find(x=>String(x.nome||'').trim().toLowerCase()===headerName);selectedId=String(me?.id||users[0]?.id||'');}
  host.innerHTML=`<section class="card" style="margin:0 0 14px 0"><label><b>Usuário/GCM</b><select id="gcmbsAccessUser">${users.map(u=>`<option value="${esc(u.id)}" ${String(u.id)===selectedId?'selected':''}>${esc(u.nome||u.username||u.cpf||`Usuário ${u.id}`)} · ${esc(roleText(u.role))}${Number(u.ativo)===0?' · INATIVO':''}</option>`).join('')}</select></label><div id="gcmbsAccessInfo" class="notice" style="margin-top:12px"></div></section>
  <section class="card" style="margin:0 0 14px 0"><div class="toolbar"><div><h3>Permissões por módulo</h3><small class="muted">Sem acesso é a ausência de permissão. Somente consulta e Edição são os níveis gravados pelo Desktop; Acesso total é uma regra de perfil do Comandante.</small></div></div><div id="gcmbsAccessMatrix" class="module-grid"></div><div class="notice" style="margin-top:12px"><strong>Edição protegida</strong>A alteração de permissões pelo Online/App permanece desativada nesta auditoria porque ainda não existe uma rota protegida para aplicar a mudança no Desktop e manter a mesma fonte de verdade. Nenhuma permissão será alterada por gravação genérica.</div></section>
  <section class="card" style="margin:0"><h3>Contas</h3><div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">GCM</th><th style="text-align:left">CPF/Login</th><th style="text-align:left">Cargo</th><th style="text-align:left">Perfil</th><th style="text-align:left">Ativo</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.nome||'—')}</td><td>${esc(normalizeCpf(u.cpf||u.usuario||u.username))}</td><td>${esc(cache.cargoByGuarda.get(Number(u.guarda_id))||'—')}</td><td>${esc(roleText(u.role))}</td><td>${Number(u.ativo)===0?'Não':'Sim'}</td></tr>`).join('')}</tbody></table></div></section>`;
  host.dataset.gcmbsAccessReady='1';
  document.getElementById('gcmbsAccessUser')?.addEventListener('change',e=>{selectedId=e.target.value;renderSelected();});
  renderSelected();
}
function setText(id,text){const el=document.getElementById(id);if(el&&el.textContent!==text)el.textContent=text;}
function tuneHeader(){
  setText('onlineModuloDescricao','O Comandante mantém acesso total permanente. O Subcomandante recebe acesso total por padrão e somente o Comandante pode ajustar ou restaurar suas permissões. Os demais GCMs recebem o perfil institucional definido.');
  setText('onlineTitulo','Controle de Acesso');
  setText('onlineDescricao','Permissões por GCM e nível de acesso, conforme a mesma política do Desktop.');
  const filter=document.getElementById('onlineFiltro');if(filter){if(filter.value)filter.value='';if(filter.style.display!=='none')filter.style.display='none';}
  setText('onlineTotal',String(cache?.users?.length||0));
  setText('onlineFiltrados','Usuários e permissões');
}
function hideTechnicalTabs(){
  const tabs=document.getElementById('onlineEntityTabs');if(!tabs)return;
  [...tabs.querySelectorAll('[data-entity-tab]')].forEach(b=>{const d=b.dataset.entityTab==='permissoes_usuarios'?'':'none';if(b.style.display!==d)b.style.display=d;});
  if(!tabs.classList.contains('hidden'))tabs.classList.add('hidden');
}
function restoreOutside(){
  const filter=document.getElementById('onlineFiltro');if(filter&&filter.style.display==='none')filter.style.display='';
}
async function apply(){
  if(!inModule()){restoreOutside();return;}
  hideTechnicalTabs();
  const ent=currentEntity();
  if(ent&&ent!=='permissoes_usuarios'){
    const primary=document.querySelector('#onlineEntityTabs [data-entity-tab="permissoes_usuarios"]');
    if(primary){primary.click();return;}
  }
  if(busy)return;
  busy=true;
  try{
    if(!cache)cache=await load();
    tuneHeader();renderPage();
  }catch(e){const host=document.getElementById('onlineRegistros');if(host&&host.dataset.gcmbsAccessError!=='1'){host.dataset.gcmbsAccessError='1';host.innerHTML=`<div class="empty">${esc(e.message||e)}</div>`;}}
  finally{busy=false;}
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;apply();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
