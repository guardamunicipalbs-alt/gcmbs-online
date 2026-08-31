// GCMBS 10.0.68 - HF10 R22
// Escala Extra Manual: criacao multipla, edicao e cancelamento por fluxo protegido.
// O Desktop continua sendo a autoridade final de aplicacao e sincronizacao.
const GCMBS_EXTRA_READ_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const GCMBS_EXTRA_WRITE_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-manual-v68';

const extraEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const extraTitulo=()=>String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
const extraModuloAtivo=()=>/^Escala Extra Manual$/i.test(String(document.getElementById('onlineTitulo')?.textContent||'').trim());
const extraNovo=()=>/^Novo\s+Escala Extra Manual$/i.test(extraTitulo());
const extraEditar=()=>/^Editar\s+Escala Extra Manual$/i.test(extraTitulo());
const extraHost=()=>document.getElementById('onlineCampos');
const extraCampo=n=>extraHost()?.querySelector(`[data-online-field="${n}"]`)||null;
let extraEditingKey='';

async function extraCall(url,action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({action,...payload}),
    cache:'no-store'
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
const extraRead=(action,payload={})=>extraCall(GCMBS_EXTRA_READ_API,action,payload);
const extraWrite=(action,payload={})=>extraCall(GCMBS_EXTRA_WRITE_API,action,payload);

function extraAtivo(g){
  const st=String(g?.status||'ATIVO').toUpperCase();
  const ativo=String(g?.ativo??'1').toUpperCase();
  return ['ATIVO','ATIVA',''].includes(st)&&!['0','FALSE','NAO','NÃO','INATIVO'].includes(ativo);
}
function extraCargoComando(g){return /\b(SUBCOMANDANTE|COMANDANTE)\b/i.test(String(g?.cargo||''));}

async function extraIdsEquipeComando(){
  const ids=new Set();
  try{
    const [eqResp,vincResp]=await Promise.all([
      extraRead('entity_list',{entity:'equipes',limit:500,offset:0}),
      extraRead('entity_list',{entity:'guarda_equipes',limit:3000,offset:0})
    ]);
    const equipes=(eqResp.records||[]).map(r=>r.data||{});
    const eqComando=new Set(equipes.filter(e=>/COMAND/i.test(String(e.nome||''))).map(e=>Number(e.id)).filter(Number.isFinite));
    for(const rec of (vincResp.records||[])){
      const v=rec.data||{};
      if(eqComando.has(Number(v.equipe_id)))ids.add(Number(v.guarda_id));
    }
  }catch(e){console.warn('[GCMBS] R22 vínculo da equipe Comando indisponível para pré-filtro:',e?.message||e);}
  return ids;
}

async function extraCarregarGuardas(){
  try{
    const [grResp,comandoIds]=await Promise.all([
      extraRead('entity_list',{entity:'guardas',limit:5000,offset:0}),
      extraIdsEquipeComando()
    ]);
    const lista=(grResp.records||[]).map(r=>r.data||{});
    return lista.filter(g=>extraAtivo(g)&&!comandoIds.has(Number(g.id))&&!extraCargoComando(g))
      .sort((a,b)=>String(a.nome_guerra||a.nome_completo||'').localeCompare(String(b.nome_guerra||b.nome_completo||''),'pt-BR'));
  }catch(e){
    console.warn('[GCMBS] R22 referências de GCMs indisponíveis:',e?.message||e);
    const sel=extraCampo('guarda_id');
    return [...(sel?.options||[])].filter(o=>o.value).map(o=>({id:Number(o.value),nome_guerra:o.textContent||`GCM ${o.value}`}));
  }
}

function extraSelecionados(){
  return [...document.querySelectorAll('#gcmbsExtraGcms input[data-extra-gcm]:checked')]
    .map(i=>({id:Number(i.value),nome:String(i.dataset.nome||i.closest('label')?.textContent||'GCM').trim()}))
    .filter(x=>Number.isInteger(x.id)&&x.id>0);
}
function extraAtualizarResumo(){
  const n=extraSelecionados().length,e=document.getElementById('gcmbsExtraSelecionados'),hidden=document.getElementById('gcmbsExtraGuardaFallback');
  if(e)e.textContent=`${n} GCM${n===1?'':'s'} selecionado${n===1?'':'s'}`;
  if(hidden)hidden.value=n?String(extraSelecionados()[0].id):'';
}
function extraRemoverStatusNovo(){extraCampo('status')?.closest('label')?.remove();}
function extraBloquearStatusEdicao(){
  const st=extraCampo('status');if(!st)return;
  st.disabled=true;st.title='O status é controlado pelo fluxo de cancelamento para preservar o histórico.';
  const lab=st.closest('label');if(lab&&!lab.querySelector('[data-extra-status-note]'))lab.insertAdjacentHTML('beforeend','<small data-extra-status-note class="muted">Para cancelar, use o botão “Cancelar” na listagem.</small>');
}

async function extraAjustarFormulario(){
  if(!extraNovo()&&!extraEditar())return;
  const host=extraHost();if(!host)return;
  if(extraEditar()){
    extraBloquearStatusEdicao();
    const sel=extraCampo('guarda_id');
    if(sel?.tagName==='SELECT'){
      try{const valid=new Set((await extraCarregarGuardas()).map(g=>String(g.id)));for(const o of [...sel.options])if(o.value&&!valid.has(String(o.value)))o.remove();}catch{}
    }
    return;
  }
  if(document.getElementById('gcmbsExtraGcms'))return;
  const original=extraCampo('guarda_id');if(!original)return;
  extraRemoverStatusNovo();
  const guardas=await extraCarregarGuardas(),lab=original.closest('label');if(!lab)return;
  lab.classList.add('full');
  lab.innerHTML=`<span style="font-weight:700">GCMs</span>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0">
      <button id="gcmbsExtraSelecionarTodos" type="button" class="secondary" style="min-height:34px;padding:0 12px">Selecionar todos</button>
      <button id="gcmbsExtraLimpar" type="button" class="secondary" style="min-height:34px;padding:0 12px">Limpar</button>
      <small id="gcmbsExtraSelecionados" class="muted">0 GCMs selecionados</small>
    </div>
    <div id="gcmbsExtraGcms" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px;max-height:250px;overflow:auto;border:1px solid #dbe4f0;border-radius:10px;padding:10px;background:#fff">
      ${guardas.map(g=>{const id=Number(g.id||0),nome=g.nome_guerra||g.nome_completo||`GCM ${id}`;return `<label style="display:flex;gap:8px;align-items:center;padding:7px 8px;border:1px solid #e5eaf1;border-radius:8px;cursor:pointer"><input type="checkbox" data-extra-gcm="1" data-nome="${extraEsc(nome)}" value="${id}"><span>${extraEsc(nome)}</span></label>`;}).join('')||'<div class="muted">Nenhum GCM elegível disponível.</div>'}
    </div>
    <input id="gcmbsExtraGuardaFallback" data-online-field="guarda_id" type="hidden" value="">
    <small class="muted">O servidor valida GCM ativo, Comando, conflito com serviço ordinário, outra extra, evento e solicitações ainda pendentes. Posto e função permanecem sob autoridade do Desktop.</small>`;
  lab.querySelectorAll('[data-extra-gcm]').forEach(i=>i.addEventListener('change',extraAtualizarResumo));
  lab.querySelector('#gcmbsExtraSelecionarTodos')?.addEventListener('click',()=>{lab.querySelectorAll('[data-extra-gcm]').forEach(i=>i.checked=true);extraAtualizarResumo();});
  lab.querySelector('#gcmbsExtraLimpar')?.addEventListener('click',()=>{lab.querySelectorAll('[data-extra-gcm]').forEach(i=>i.checked=false);extraAtualizarResumo();});
  extraAtualizarResumo();
}

function extraDadosFormulario(){return{
  data:String(extraCampo('data')?.value||''),
  guarda_id:Number(extraCampo('guarda_id')?.value||0),
  horario_inicio:String(extraCampo('horario_inicio')?.value||''),
  horario_fim:String(extraCampo('horario_fim')?.value||''),
  observacao:String(extraCampo('observacao')?.value||'').trim()
};}
function extraSetBusy(btn,busy,texto='Enviando...'){
  if(!btn)return;btn.disabled=busy;
  if(busy){btn.dataset.extraTexto=btn.textContent||'Salvar';btn.textContent=texto;}
  else{btn.textContent=btn.dataset.extraTexto||'Salvar';delete btn.dataset.extraTexto;}
}

async function extraSalvarLote(ev){
  const btn=ev.target?.closest?.('#onlineSalvar');if(!btn||!extraNovo()||!document.getElementById('gcmbsExtraGcms'))return false;
  ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
  const d=extraDadosFormulario(),gcms=extraSelecionados(),msg=document.getElementById('onlineMsg');
  if(!d.data||!d.horario_inicio||!d.horario_fim){if(msg)msg.textContent='Informe data, horário inicial e horário final.';return true;}
  if(!gcms.length){if(msg)msg.textContent='Selecione pelo menos um GCM.';return true;}
  extraSetBusy(btn,true,'Validando...');if(msg)msg.textContent='Validando o lote e enviando somente extras compatíveis ao Desktop...';
  try{
    const r=await extraWrite('create_batch',{data:d.data,horario_inicio:d.horario_inicio,horario_fim:d.horario_fim,observacao:d.observacao,guarda_ids:gcms.map(g=>g.id)});
    const queued=Array.isArray(r.queued)?r.queued:[],rejected=Array.isArray(r.rejected)?r.rejected:[];
    for(const q of queued){const chk=document.querySelector(`#gcmbsExtraGcms input[data-extra-gcm][value="${q.guarda_id}"]`);if(chk)chk.checked=false;}
    extraAtualizarResumo();
    const falhas=rejected.map(x=>`${x.nome||`GCM ${x.guarda_id}`}: ${x.motivo}`).join(' | ');
    if(msg)msg.textContent=`${queued.length} extra(s) enviada(s) ao Desktop.${rejected.length?` ${rejected.length} não enviada(s): ${falhas}`:''}`;
    if(queued.length&&!rejected.length)setTimeout(()=>document.getElementById('onlineEditor')?.close(),1100);
  }catch(e){if(msg)msg.textContent=e?.message||String(e);}
  finally{extraSetBusy(btn,false);}
  return true;
}

async function extraSalvarEdicao(ev){
  const btn=ev.target?.closest?.('#onlineSalvar');if(!btn||!extraEditar()||!extraEditingKey)return false;
  ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
  const d=extraDadosFormulario(),msg=document.getElementById('onlineMsg');
  extraSetBusy(btn,true,'Validando...');if(msg)msg.textContent='Validando alteração da Extra Manual...';
  try{
    const r=await extraWrite('update',{record_key:extraEditingKey,...d});
    if(msg)msg.textContent=r.message||'Alteração enviada ao Desktop.';
    setTimeout(()=>document.getElementById('onlineEditor')?.close(),1100);
  }catch(e){if(msg)msg.textContent=e?.message||String(e);}
  finally{extraSetBusy(btn,false);}
  return true;
}

async function extraCancelar(btn){
  const key=String(btn?.dataset?.onlineDel||'');if(!key)return;
  if(!confirm('Cancelar esta Escala Extra Manual? O registro será preservado no histórico.'))return;
  btn.disabled=true;const old=btn.textContent;btn.textContent='Enviando...';
  try{
    const r=await extraWrite('cancel',{record_key:key});
    btn.textContent='Cancelamento pendente';btn.title=r.message||'Cancelamento enviado ao Desktop.';
    alert(r.message||'Cancelamento enviado ao Desktop.');
  }catch(e){btn.disabled=false;btn.textContent=old;alert(e?.message||String(e));}
}

function extraAjustarLista(){
  if(!extraModuloAtivo())return;
  document.querySelectorAll('[data-online-key]').forEach(card=>{
    const vals=[...card.querySelectorAll('.online-kv b')],statusLabel=vals.find(b=>/^Status$/i.test(String(b.textContent||'').trim())),status=String(statusLabel?.nextElementSibling?.textContent||'').trim().toUpperCase();
    const del=card.querySelector('[data-online-del]'),edit=card.querySelector('[data-online-edit]');
    if(del){del.textContent='Cancelar';del.title='Cancela a extra e preserva o registro histórico.';}
    if(['CANCELADA','CANCELADO','INATIVA','INATIVO'].includes(status)){
      if(del){del.disabled=true;del.textContent='Cancelada';}
      if(edit)edit.disabled=true;
    }
  });
}

function extraCapturaClique(ev){
  if(!extraModuloAtivo()&&!extraNovo()&&!extraEditar())return;
  const edit=ev.target?.closest?.('[data-online-edit]');if(edit&&extraModuloAtivo()){extraEditingKey=String(edit.dataset.onlineEdit||'');return;}
  const novo=ev.target?.closest?.('#onlineNovo');if(novo&&extraModuloAtivo()){extraEditingKey='';setTimeout(()=>void extraAjustarFormulario(),0);return;}
  const del=ev.target?.closest?.('[data-online-del]');if(del&&extraModuloAtivo()){
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();void extraCancelar(del);return;
  }
  if(ev.target?.closest?.('#onlineSalvar')){
    if(extraNovo()){void extraSalvarLote(ev);return;}
    if(extraEditar()){void extraSalvarEdicao(ev);return;}
  }
}

function extraInstalar(){
  document.addEventListener('click',extraCapturaClique,true);
  const dialog=document.getElementById('onlineEditor');
  if(dialog)new MutationObserver(()=>{if(dialog.open)queueMicrotask(()=>void extraAjustarFormulario());}).observe(dialog,{attributes:true,attributeFilter:['open']});
  const root=document.getElementById('appTela')||document.body;
  new MutationObserver(()=>queueMicrotask(extraAjustarLista)).observe(root,{childList:true,subtree:true});
  extraAjustarLista();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',extraInstalar,{once:true});
else extraInstalar();

console.info('[GCMBS] HF10 R22 Escala Extra Manual protegida ativa');
