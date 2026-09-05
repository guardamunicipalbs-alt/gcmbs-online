import {AuthenticatedProvider} from './data-provider.js?v=100072';

// GCMBS 10.0.72 — consolidação — fechamento das três pendências históricas:
// 1) permutas pendentes por serviço mais próximo;
// 2) seleção segura de participantes em Serviço Extra por Evento;
// 3) preservação do anexo da Justificativa de Faltas no fluxo de gravação.

const EVENT_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-eventos-hf13';
const ENTITY_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-entity-hf13';
async function post(url,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(payload),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

let currentEventKey='';
let contextSeq=0;
function isEventEditor(){return /SERVIÇO EXTRA POR EVENTO/i.test(String(document.getElementById('onlineEditorTitulo')?.textContent||''));}
function eventFields(){return {
  data:document.querySelector('[data-online-field="data"]')?.value||'',
  horario_inicio:document.querySelector('[data-online-field="horario_inicio"]')?.value||'',
  horario_fim:document.querySelector('[data-online-field="horario_fim"]')?.value||''
};}
function checkedEventIds(){return [...document.querySelectorAll('#hf13EventoParticipantes input[data-hf13-event-gcm]:checked')].map(x=>Number(x.value)).filter(Boolean);}
function refreshSelectedCount(){const el=document.getElementById('hf13EventoSelecionados');if(el)el.textContent=`${checkedEventIds().length} GCM(s) selecionado(s)`;}

async function loadEventParticipants(){
  if(!isEventEditor())return;
  let host=document.getElementById('hf13EventoParticipantes');
  if(!host){
    host=document.createElement('section');host.id='hf13EventoParticipantes';host.className='form-section module-editor-section';
    host.innerHTML=`<h3>Participantes do evento</h3><div class="notice">Selecione somente quem participará deste evento. GCMs inativos, com justificativa de extra ou já designados em outro evento sobreposto não aparecem como opção.</div><div class="toolbar" style="margin:10px 0"><input id="hf13EventoBusca" placeholder="Pesquisar GCM..." style="min-width:220px"><button id="hf13EventoTodos" type="button" class="mini">Selecionar todos elegíveis</button><button id="hf13EventoNenhum" type="button" class="mini">Limpar</button><span id="hf13EventoSelecionados" class="muted"></span></div><div id="hf13EventoLista" class="choice-grid"><span class="muted">Carregando GCMs elegíveis...</span></div>`;
    document.getElementById('onlineCampos')?.appendChild(host);
    document.getElementById('hf13EventoBusca')?.addEventListener('input',renderFilter);
    document.getElementById('hf13EventoTodos')?.addEventListener('click',()=>{document.querySelectorAll('#hf13EventoLista input[data-hf13-event-gcm]').forEach(x=>x.checked=true);refreshSelectedCount();});
    document.getElementById('hf13EventoNenhum')?.addEventListener('click',()=>{document.querySelectorAll('#hf13EventoLista input[data-hf13-event-gcm]').forEach(x=>x.checked=false);refreshSelectedCount();});
    for(const n of ['data','horario_inicio','horario_fim'])document.querySelector(`[data-online-field="${n}"]`)?.addEventListener('change',()=>loadEventParticipants().catch(showEventError));
  }
  const seq=++contextSeq,fields=eventFields(),list=document.getElementById('hf13EventoLista');
  if(list)list.innerHTML='<span class="muted">Atualizando elegibilidade...</span>';
  try{
    const ctx=await post(EVENT_API,{action:'context',record_key:currentEventKey,...fields});if(seq!==contextSeq)return;
    const eligible=(ctx.guards||[]).filter(g=>g.eligible!==false),hidden=(ctx.guards||[]).length-eligible.length;
    if(list){
      list.innerHTML=eligible.map(g=>`<label data-hf13-name="${esc(String(g.nome_guerra||'').toLowerCase())}"><input type="checkbox" data-hf13-event-gcm value="${Number(g.guarda_id)}" ${g.selected?'checked':''}> <b>${esc(g.nome_guerra||`GCM ${g.guarda_id}`)}</b>${g.cargo?` <small>${esc(g.cargo)}</small>`:''}</label>`).join('')||'<span class="muted">Nenhum GCM elegível para o período informado.</span>';
      list.querySelectorAll('input[data-hf13-event-gcm]').forEach(x=>x.addEventListener('change',refreshSelectedCount));
    }
    const notice=host.querySelector('.notice');if(notice)notice.innerHTML=`Selecione quem participará deste evento. <b>${eligible.length}</b> elegível(is)${hidden?` · <b>${hidden}</b> indisponível(is) ocultado(s)`:''}. O Desktop calculará automaticamente apenas os minutos que forem realmente extras.`;
    refreshSelectedCount();renderFilter();host.dataset.loaded='1';
  }catch(e){if(seq!==contextSeq)return;host.dataset.loaded='0';if(list)list.innerHTML=`<span class="error">${esc(e.message)}</span>`;throw e;}
}
function renderFilter(){const q=String(document.getElementById('hf13EventoBusca')?.value||'').trim().toLowerCase();document.querySelectorAll('#hf13EventoLista label[data-hf13-name]').forEach(x=>x.style.display=!q||x.dataset.hf13Name.includes(q)?'':'none');}
function showEventError(e){const m=document.getElementById('onlineMsg');if(m)m.textContent=e?.message||String(e);}

// A gravação genérica continua sendo usada para transportar a solicitação, mas o
// payload de evento recebe guarda_ids. O Desktop HF13 intercepta essa entidade e
// a envia ao MobileProtectedWorkflowService, que aplica todas as regras operacionais.
const oldEntityMutate=AuthenticatedProvider.prototype.entityMutate;
if(oldEntityMutate&&!oldEntityMutate.__gcmbs_hf13){
  const fn=async function(entity,record_key,operation,data,client_change_id=''){
    const ent=String(entity||''),op=String(operation||'UPSERT').toUpperCase();let d=data&&typeof data==='object'?{...data}:data;
    if(ent==='eventos_extras'&&op==='UPSERT'){
      const sec=document.getElementById('hf13EventoParticipantes');
      if(!sec||sec.dataset.loaded!=='1')throw new Error('A lista de participantes do evento ainda não foi carregada. Reabra o evento e tente novamente.');
      const ids=checkedEventIds();if(!ids.length)throw new Error('Selecione ao menos um GCM para o evento.');d={...(d||{}),guarda_ids:ids};
    }
    if(ent==='justificativas_faltas'&&op==='UPSERT'&&d?.arquivo_dados){
      let raw=String(d.arquivo_dados||'');if(raw.length>8*1024*1024)throw new Error('O documento da justificativa excede o limite permitido.');
      if(!d.arquivo_tipo)d.arquivo_tipo='application/octet-stream';
      // O Desktop armazena e visualiza o documento como Data URL, igual ao formulário nativo.
      if(!raw.startsWith('data:'))raw=`data:${d.arquivo_tipo};base64,${raw}`;
      d={...d,arquivo_dados:raw};
    }
    if(['eventos_extras','justificativas_faltas'].includes(ent)){
      return post(ENTITY_API,{action:'entity_mutate',entity:ent,record_key:record_key||'',operation:op,data:d||{},client_change_id});
    }
    return oldEntityMutate.call(this,entity,record_key,operation,d,client_change_id);
  };
  fn.__gcmbs_hf13=true;AuthenticatedProvider.prototype.entityMutate=fn;
}

// Captura qual registro de evento será editado antes do handler do app-core abrir o modal.
document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-online-edit]');if(edit)currentEventKey=String(edit.dataset.onlineEdit||'');
  if(e.target.closest?.('#onlineNovo'))currentEventKey='';
},true);

function maybeInstall(){
  const dlg=document.getElementById('onlineEditor');if(!dlg?.open||!isEventEditor())return;
  loadEventParticipants().catch(showEventError);
}
function watchEditor(){
  const dlg=document.getElementById('onlineEditor');if(!dlg)return;
  const observer=new MutationObserver(m=>{if(m.some(x=>x.type==='attributes'&&x.attributeName==='open')&&dlg.open)queueMicrotask(maybeInstall);});
  observer.observe(dlg,{attributes:true,attributeFilter:['open']});maybeInstall();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchEditor,{once:true});else watchEditor();

console.info('[GCMBS] 10.0.72 — pendências históricas fechadas');
