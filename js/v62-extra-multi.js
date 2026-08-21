// GCMBS 10.0.62 — paridade funcional da Escala Extra Manual.
// O Desktop continua sendo a autoridade para validar cada GCM selecionado.

const GCMBS_EXTRA_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const GCMBS_EXTRA_ENTITY='escalas_extras_manuais';

const extraEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const extraTitulo=()=>String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
const extraNovo=()=>/^Novo\s+Escala Extra Manual$/i.test(extraTitulo());
const extraHost=()=>document.getElementById('onlineCampos');
const extraCampo=n=>extraHost()?.querySelector(`[data-online-field="${n}"]`)||null;

async function extraApi(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(GCMBS_EXTRA_API,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({action,...payload}),
    cache:'no-store'
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

function extraAtivo(g){
  const st=String(g?.status||'ATIVO').toUpperCase();
  const ativo=String(g?.ativo??'1').toUpperCase();
  return ['ATIVO','ATIVA',''].includes(st)&&!['0','FALSE','NAO','NÃO','INATIVO'].includes(ativo);
}
function extraCargoComando(g){
  return /\b(SUBCOMANDANTE|COMANDANTE)\b/i.test(String(g?.cargo||''));
}

async function extraIdsEquipeComando(){
  const ids=new Set();
  try{
    const [eqResp,vincResp]=await Promise.all([
      extraApi('entity_list',{entity:'equipes',limit:500,offset:0}),
      extraApi('entity_list',{entity:'guarda_equipes',limit:3000,offset:0})
    ]);
    const equipes=(eqResp.records||[]).map(r=>r.data||{});
    const eqComando=new Set(
      equipes.filter(e=>/COMAND/i.test(String(e.nome||''))).map(e=>Number(e.id)).filter(Number.isFinite)
    );
    for(const rec of (vincResp.records||[])){
      const v=rec.data||{};
      if(eqComando.has(Number(v.equipe_id)))ids.add(Number(v.guarda_id));
    }
  }catch(e){
    console.warn('[GCMBS] vínculo da equipe Comando indisponível para pré-filtro:',e?.message||e);
  }
  return ids;
}

async function extraCarregarGuardas(){
  try{
    const [r,comandoIds]=await Promise.all([extraApi('references'),extraIdsEquipeComando()]);
    const lista=Array.isArray(r.guardas)?r.guardas:(r.references?.guardas||[]);
    return lista.filter(g=>extraAtivo(g)&&!comandoIds.has(Number(g.id))&&!extraCargoComando(g))
      .sort((a,b)=>String(a.nome_guerra||a.nome_completo||'').localeCompare(String(b.nome_guerra||b.nome_completo||''),'pt-BR'));
  }catch{
    const sel=extraCampo('guarda_id');
    return [...(sel?.options||[])]
      .filter(o=>o.value&&!/\b(SUBCOMANDANTE|COMANDANTE)\b/i.test(String(o.textContent||'')))
      .map(o=>({id:Number(o.value),nome_guerra:o.textContent||`GCM ${o.value}`}));
  }
}

function extraSelecionados(){
  return [...document.querySelectorAll('#gcmbsExtraGcms input[data-extra-gcm]:checked')]
    .map(i=>({id:Number(i.value),nome:String(i.dataset.nome||i.closest('label')?.textContent||'GCM').trim()}))
    .filter(x=>Number.isInteger(x.id)&&x.id>0);
}

function extraAtualizarResumo(){
  const n=extraSelecionados().length;
  const e=document.getElementById('gcmbsExtraSelecionados');
  if(e)e.textContent=`${n} GCM${n===1?'':'s'} selecionado${n===1?'':'s'}`;
  const hidden=document.getElementById('gcmbsExtraGuardaFallback');
  if(hidden)hidden.value=n?String(extraSelecionados()[0].id):'';
}

async function extraAjustarFormulario(){
  if(!extraNovo())return;
  const host=extraHost();if(!host||host.dataset.extraMulti==='1')return;
  const original=extraCampo('guarda_id');if(!original)return;
  host.dataset.extraMulti='1';

  const guardas=await extraCarregarGuardas();
  const lab=original.closest('label');if(!lab)return;
  lab.classList.add('full');
  lab.innerHTML=`<span style="font-weight:700">GCMs</span>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0">
      <button id="gcmbsExtraSelecionarTodos" type="button" class="secondary" style="min-height:34px;padding:0 12px">Selecionar todos</button>
      <button id="gcmbsExtraLimpar" type="button" class="secondary" style="min-height:34px;padding:0 12px">Limpar</button>
      <small id="gcmbsExtraSelecionados" class="muted">0 GCMs selecionados</small>
    </div>
    <div id="gcmbsExtraGcms" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px;max-height:250px;overflow:auto;border:1px solid #dbe4f0;border-radius:10px;padding:10px;background:#fff">
      ${guardas.map(g=>{const id=Number(g.id||0),nome=g.nome_guerra||g.nome_completo||`GCM ${id}`;return `<label style="display:flex;gap:8px;align-items:center;padding:7px 8px;border:1px solid #e5eaf1;border-radius:8px;cursor:pointer"><input type="checkbox" data-extra-gcm="1" data-nome="${extraEsc(nome)}" value="${id}"><span>${extraEsc(nome)}</span></label>`;}).join('')||'<div class="muted">Nenhum GCM elegível disponível na referência online.</div>'}
    </div>
    <input id="gcmbsExtraGuardaFallback" data-online-field="guarda_id" type="hidden" value="">
    <small class="muted">Integrantes da equipe de Comando não são exibidos. Cada inclusão será validada individualmente pelo Desktop; posto e função de motorista continuam automáticos.</small>`;

  lab.querySelectorAll('[data-extra-gcm]').forEach(i=>i.addEventListener('change',extraAtualizarResumo));
  lab.querySelector('#gcmbsExtraSelecionarTodos')?.addEventListener('click',()=>{lab.querySelectorAll('[data-extra-gcm]').forEach(i=>i.checked=true);extraAtualizarResumo();});
  lab.querySelector('#gcmbsExtraLimpar')?.addEventListener('click',()=>{lab.querySelectorAll('[data-extra-gcm]').forEach(i=>i.checked=false);extraAtualizarResumo();});
  extraAtualizarResumo();
}

async function extraSalvarLote(ev){
  const btn=ev.target?.closest?.('#onlineSalvar');
  if(!btn||!extraNovo()||!document.getElementById('gcmbsExtraGcms'))return;

  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();

  const data=String(extraCampo('data')?.value||'');
  const inicio=String(extraCampo('horario_inicio')?.value||'');
  const fim=String(extraCampo('horario_fim')?.value||'');
  const observacao=String(extraCampo('observacao')?.value||'').trim();
  const gcms=extraSelecionados();
  const msg=document.getElementById('onlineMsg');

  if(!data||!inicio||!fim){if(msg)msg.textContent='Informe data, horário inicial e horário final.';return;}
  if(!gcms.length){if(msg)msg.textContent='Selecione pelo menos um GCM.';return;}

  const texto=btn.textContent;btn.disabled=true;btn.textContent='Enviando...';
  if(msg)msg.textContent='Enviando GCMs selecionados para validação do Desktop...';
  let ok=0;const falhas=[];

  for(const g of gcms){
    try{
      await extraApi('entity_mutate',{
        entity:GCMBS_EXTRA_ENTITY,
        record_key:'',
        operation:'UPSERT',
        data:{data,guarda_id:g.id,horario_inicio:inicio,horario_fim:fim,observacao},
        client_change_id:`extra-lote-${Date.now()}-${g.id}-${Math.random().toString(36).slice(2,8)}`
      });
      ok++;
      const chk=document.querySelector(`#gcmbsExtraGcms input[data-extra-gcm][value="${g.id}"]`);if(chk)chk.checked=false;
    }catch(e){falhas.push(`${g.nome}: ${e?.message||e}`);}
  }

  extraAtualizarResumo();
  btn.disabled=false;btn.textContent=texto;
  if(falhas.length){
    if(msg)msg.textContent=`${ok} inclusão(ões) enviada(s). ${falhas.length} falha(s): ${falhas.join(' | ')}`;
    return;
  }

  if(msg)msg.textContent=`${ok} GCM(s) enviado(s). O Desktop validará cada inclusão no próximo ciclo de sincronização.`;
  setTimeout(()=>{try{document.getElementById('onlineEditor')?.close();}catch{}},900);
}

function extraInstalar(){
  document.addEventListener('click',extraSalvarLote,true);
  const dialog=document.getElementById('onlineEditor');
  if(dialog)new MutationObserver(()=>{if(dialog.open)queueMicrotask(()=>void extraAjustarFormulario());}).observe(dialog,{attributes:true,attributeFilter:['open']});
  document.addEventListener('click',e=>{if(e.target?.closest?.('#onlineNovo'))setTimeout(()=>void extraAjustarFormulario(),0);},true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',extraInstalar,{once:true});
else extraInstalar();

console.info('[GCMBS] Escala Extra Manual com seleção múltipla e pré-filtro de Comando ativa');
