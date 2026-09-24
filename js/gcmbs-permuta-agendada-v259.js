'use strict';

// GCMBS V259 — quinta modalidade de permuta.
// Modulo isolado: somente intercepta a modalidade AGENDADA.
// As quatro modalidades anteriores continuam no app-core sem alteracao de fluxo.
const GATEWAY='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-scheduled-permuta-v258';

const TERM_VERSION='V255-AGENDADA-1';
const TERM_TEXT=[
  'TROCA DE SERVICO AGENDADA / COMPENSACAO FUTURA.',
  'A troca deve ser quitada por servico da mesma natureza e mesma duracao: Ordinario por Ordinario e Extra por Extra.',
  'A aprovacao reserva a operacao, mas nao cria divida de compensacao por si so.',
  'A obrigacao somente nasce depois que o primeiro servico for efetivamente realizado e confirmado pela Frequencia.',
  'Nao ha credito ou debito imediato no Banco de Horas.',
  'Em servico Extra, a titularidade financeira original permanece preservada durante a troca agendada.',
  'A compensacao futura somente sera quitada depois de efetivamente realizada.',
  'Apenas uma forma de liquidacao pode encerrar a obrigacao.'
].join(' ');

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{if(!d)return'';const [y,m,a]=String(d).slice(0,10).split('-');return a&&m&&y?`${a}/${m}/${y}`:String(d||'')};
const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
const nativeApp=()=>!!window.Capacitor;

async function call(url,action,payload={}){
  const t=token();if(!t)throw new Error('Sessão não autenticada.');
  let r;
  try{
    r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  }catch{throw new Error('Falha de comunicação com o servidor. Nenhuma alteração foi confirmada.');}
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

function optionExtra(x){
  const tipo=String(x.extra_tipo||x.tipo||'MANUAL').toUpperCase()==='EVENTO'?'EVENTO':'MANUAL';
  const rot=tipo==='EVENTO'?'Extra por Evento':'Extra Manual';
  const min=Number(x.minutos||x.minutos_extra||0);
  return `<option value="${Number(x.id||x.servico_id||0)}" data-tipo="${tipo}" data-g="${Number(x.guarda_id||0)}" data-minutos="${min}" data-data="${esc(String(x.data||'').slice(0,10))}">${esc(x.nome_guerra||'GCM')} · [${rot}] ${esc(x.descricao||x.evento_nome||'')} · ${fmt(x.data)} · ${esc(x.horario_inicio||'')}–${esc(x.horario_fim||'')} · ${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}</option>`;
}

let extraLoading=false;
async function carregarExtrasAgendados(){
  const sel=$('pmExtraOutro');if(!sel||extraLoading)return;
  extraLoading=true;sel.disabled=true;sel.innerHTML='<option value="">Consultando serviços extras...</option>';
  try{
    const r=await call(GATEWAY,'extra_permuta_candidates');
    const xs=(r.others||[]).slice().sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))||String(a.horario_inicio||'').localeCompare(String(b.horario_inicio||'')));
    sel.innerHTML=xs.length?'<option value="">Selecione o serviço extra que você cobrirá...</option>'+xs.map(optionExtra).join(''):'<option value="">Nenhum serviço extra elegível</option>';
    sel.disabled=!xs.length;
  }catch(e){
    sel.innerHTML='<option value="">Falha ao consultar extras</option>';
    const m=$('pmMsg');if(m){m.textContent=e.message;m.classList.add('error')}
  }finally{extraLoading=false}
}

function termoHtml(){return `<h3>TERMO — TROCA DE SERVIÇO AGENDADA / COMPENSAÇÃO FUTURA</h3><p>${esc(TERM_TEXT)}</p><p><b>Versão do termo:</b> ${esc(TERM_VERSION)}</p>`;}

function garantirUi(){
  const form=$('formPermuta'),modal=$('pmModalidade');if(!form||!modal)return false;
  if(![...modal.options].some(o=>o.value==='AGENDADA')){
    const op=document.createElement('option');op.value='AGENDADA';op.textContent='Troca de serviço agendada / compensação futura';modal.appendChild(op);
  }
  if(!$('gcmbsAgCfgV259')){
    const box=document.createElement('div');box.id='gcmbsAgCfgV259';box.className='full hidden';
    box.innerHTML=`<div class="notice"><b>Troca de serviço agendada:</b> você cobre agora um serviço de outro GCM. Se o primeiro serviço for efetivamente cumprido e confirmado pela Frequência, o titular original ficará obrigado a compensar depois com serviço do <b>mesmo tipo e mesma duração</b>. Não existe crédito ou débito imediato no Banco de Horas.</div><label style="display:grid;gap:6px;margin-top:10px">Tipo do serviço inicial<select id="pmAgTipoV259"><option value="ORDINARIO">Serviço ordinário</option><option value="EXTRA">Serviço extra</option></select></label>`;
    const label=modal.closest('label');(label||form.firstElementChild)?.insertAdjacentElement('afterend',box);
  }
  let termo=$('gcmbsAgTermV259');
  if(!termo){
    termo=document.createElement('div');termo.id='gcmbsAgTermV259';termo.className='full responsibility-term hidden';termo.innerHTML=termoHtml();
    const generico=[...form.querySelectorAll('.responsibility-term')].find(x=>x.id!=='gcmbsAgTermV259');
    if(generico)generico.insertAdjacentElement('beforebegin',termo);else form.appendChild(termo);
  }
  const aviso=[...document.querySelectorAll('#permutaCard .notice')].find(x=>/Acompanhamento da troca agendada V256/i.test(x.textContent||''));
  if(aviso)aviso.innerHTML='<b>Troca agendada V259 liberada:</b> a solicitação e o aceite do outro GCM são registrados na nuvem, revalidados pelo Desktop e somente depois seguem para decisão do Comando. Nenhuma escala ou hora é alterada antes da aprovação do Comando.';
  const orient=[...form.querySelectorAll('.notice')].find(x=>/Qual opção usar/i.test(x.textContent||''));
  if(orient&&!/compensação futura/i.test(orient.textContent||''))orient.insertAdjacentHTML('beforeend','<br><b>Troca agendada / compensação futura:</b> você cobre um serviço agora e, somente se houver Frequência efetiva, nasce obrigação futura de compensação do mesmo tipo e duração.');
  if(!$('gcmbsAgCloudCardV259')){
    const card=document.createElement('div');card.id='gcmbsAgCloudCardV259';card.className='card';
    card.innerHTML=`<div class="toolbar"><div><h2>Troca agendada — solicitações em trânsito</h2><p class="muted">Aqui aparecem solicitações antes da consolidação pelo Desktop. Após a importação, passam para o histórico sincronizado acima.</p></div><button id="gcmbsAgRefreshV259" class="mini" type="button">Atualizar</button></div><div id="gcmbsAgCloudListV259" class="list"><div class="empty">Nenhuma solicitação em trânsito.</div></div>`;
    const hist=$('listaPermutasSolicitadas')?.closest('.card');if(hist)hist.insertAdjacentElement('afterend',card);
  }
  return true;
}

function aplicarModo(){
  if(!garantirUi())return;
  const modal=$('pmModalidade'),ag=modal?.value==='AGENDADA',cfg=$('gcmbsAgCfgV259'),term=$('gcmbsAgTermV259');
  const generic=[...$('formPermuta').querySelectorAll('.responsibility-term')].find(x=>x.id!=='gcmbsAgTermV259');
  if(cfg)cfg.classList.toggle('hidden',!ag);if(term)term.classList.toggle('hidden',!ag);if(generic)generic.classList.toggle('hidden',ag);
  const checkLabel=$('pmTermo')?.closest('label'),strong=checkLabel?.querySelector('b');
  if(strong)strong.textContent=ag?'LI E CONCORDO COM O TERMO DA TROCA AGENDADA / COMPENSAÇÃO FUTURA.':'CONCORDO COM OS TERMOS.';
  if(!ag)return;
  const tipo=$('pmAgTipoV259')?.value||'ORDINARIO',ord=tipo==='ORDINARIO',extra=tipo==='EXTRA';
  document.querySelectorAll('.pm-ordinary').forEach(x=>x.classList.toggle('hidden',!ord));
  document.querySelectorAll('.pm-assuncao').forEach(x=>x.classList.toggle('hidden',!ord));
  document.querySelectorAll('.pm-extra').forEach(x=>x.classList.toggle('hidden',!extra));
  document.querySelectorAll('.pm-mista').forEach(x=>x.classList.add('hidden'));
  $('pmExtraMeuLabel')?.classList.add('hidden');$('pmExtraDataLabel')?.classList.add('hidden');
  const aviso=$('pmTrocaAviso');
  if(extra&&aviso){aviso.classList.remove('hidden');aviso.innerHTML='<b>Regra da troca agendada por Extra:</b> você executará o Extra selecionado, mas o crédito financeiro original permanece com o titular. Se a Frequência confirmar sua execução, o titular ficará devendo posteriormente um Extra de mesma duração. A classe financeira original não é transferida.';}
  if(extra)carregarExtrasAgendados();else{const data=$('pmData');if(data?.value)data.dispatchEvent(new Event('change',{bubbles:true}));}
}

let cloudRows=[],cloudLoading=false,lastLoad=0;
function statusLabel(s){const x=String(s||'').toUpperCase();return ({AGUARDANDO_ACEITE:'AGUARDANDO ACEITE',PENDENTE_DESKTOP:'AGUARDANDO DESKTOP',ERRO:'ERRO DE VALIDAÇÃO',RECUSADA:'RECUSADA',CANCELADA:'CANCELADA'})[x]||x.replaceAll('_',' ');}
function duracao(min){const n=Number(min||0);return n?`${Math.floor(n/60)}h${String(n%60).padStart(2,'0')}`:'-'}

function renderCloud(){
  garantirUi();const host=$('gcmbsAgCloudListV259');if(!host)return;
  const me=Number(JSON.parse(localStorage.getItem('gcmbs.mobile.session')||'null')?.guarda_id||0);
  const rows=cloudRows.filter(x=>String(x.status||'').toUpperCase()!=='PROCESSADO');
  if(!rows.length){host.innerHTML='<div class="empty">Nenhuma solicitação de troca agendada em trânsito.</div>';return}
  host.innerHTML=rows.map(x=>{
    const p=x.payload||{},st=String(x.status||'').toUpperCase(),tipo=String(p.tipo_servico_agendado||p.tipo_servico||'ORDINARIO').toUpperCase();
    const solicitante=x.solicitante_nome||`GCM #${x.guarda_id||'-'}`,contraparte=x.contraparte_nome||`GCM #${p.contraparte_id||'-'}`,data=String(p.data_origem||p.data||'').slice(0,10);
    const detalhe=tipo==='EXTRA'?`${fmt(data)} · Extra ${esc(p.extra_tipo_origem||p.extra_tipo||'')} · ${duracao(p.duracao_minutos)}`:`${fmt(data)} · Turno ${esc(p.turno_origem||p.turno||'-')} · ${duracao(p.duracao_minutos)}`;
    const isContra=Number(p.contraparte_id||0)===me,isSol=Number(x.guarda_id||0)===me,aceitar=isContra&&st==='AGUARDANDO_ACEITE',cancelar=isSol&&st==='AGUARDANDO_ACEITE';
    const termo=aceitar?`<div class="responsibility-term"><h3>TERMO PARA ACEITE</h3><p>${esc(TERM_TEXT)}</p><label class="check"><input type="checkbox" data-ag-term="${x.id}"> <b>LI E CONCORDO COM O TERMO DA COMPENSAÇÃO AGENDADA.</b></label></div>`:'';
    const actions=aceitar?`<div class="request-actions"><button class="mini" type="button" data-ag-accept="${x.id}">Aceitar</button><button class="mini" type="button" data-ag-reject="${x.id}">Recusar</button></div>`:cancelar?`<div class="request-actions"><button class="mini danger-soft" type="button" data-ag-cancel="${x.id}">Cancelar solicitação</button></div>`:'';
    return `<article class="record-card"><div class="record-card-head"><strong>Troca agendada · ${tipo==='EXTRA'?'Extra':'Ordinário'}</strong><span class="status-pill status-${esc(st)}">${esc(statusLabel(st))}</span></div><div class="record-meta"><b>Quem cobrirá agora:</b> ${esc(solicitante)} · <b>Titular do serviço:</b> ${esc(contraparte)}</div><div class="record-meta">${detalhe}</div><div class="record-warning">Mesmo tipo + mesma duração. Nenhuma movimentação imediata no Banco de Horas. A obrigação futura só nasce com Frequência efetiva.</div>${p.observacao?`<div>${esc(p.observacao)}</div>`:''}${x.resposta?`<small>${esc(x.resposta)}</small>`:''}${termo}${actions}</article>`;
  }).join('');
  host.querySelectorAll('[data-ag-accept]').forEach(b=>b.addEventListener('click',()=>responder(Number(b.dataset.agAccept),true)));
  host.querySelectorAll('[data-ag-reject]').forEach(b=>b.addEventListener('click',()=>responder(Number(b.dataset.agReject),false)));
  host.querySelectorAll('[data-ag-cancel]').forEach(b=>b.addEventListener('click',()=>cancelar(Number(b.dataset.agCancel))));
}

async function refreshCloud(force=false){
  if(cloudLoading||!token())return;if(!force&&Date.now()-lastLoad<15000)return;cloudLoading=true;
  try{const r=await call(API,'list');cloudRows=r.requests||[];lastLoad=Date.now();renderCloud();}
  catch(e){const host=$('gcmbsAgCloudListV259');if(host)host.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
  finally{cloudLoading=false}
}
async function responder(id,aceitou){
  if(aceitou&&!document.querySelector(`[data-ag-term="${id}"]`)?.checked){alert('Marque a confirmação de leitura do termo antes de aceitar.');return;}
  if(!confirm(aceitou?'Confirmar o aceite desta troca agendada?':'Recusar esta troca agendada?'))return;
  try{await call(API,'accept',{id,aceitou,concordou_termo:aceitou});await refreshCloud(true);}catch(e){alert(e.message)}
}
async function cancelar(id){if(!confirm('Cancelar esta solicitação antes do aceite do outro GCM?'))return;try{await call(API,'cancel',{id});await refreshCloud(true)}catch(e){alert(e.message)}}

async function enviarAgendada(ev){
  const modal=$('pmModalidade');if(modal?.value!=='AGENDADA')return;ev.preventDefault();ev.stopImmediatePropagation();
  const msg=$('pmMsg'),btn=$('pmEnviar'),tipo=$('pmAgTipoV259')?.value||'ORDINARIO';
  if(msg){msg.className='full request-message';msg.textContent='Enviando troca agendada...'}if(btn)btn.disabled=true;
  try{
    if(!$('pmTermo')?.checked)throw new Error('Leia e confirme o termo específico da troca agendada.');
    let request={tipo_servico_agendado:tipo,concordou_termo:true,observacao:$('pmObs')?.value||'',origem_cliente:nativeApp()?'APP_ANDROID':'ONLINE'};
    if(tipo==='ORDINARIO'){request.data=$('pmData')?.value||'';request.turno=$('pmTurno')?.value||'A';request.substituido_id=Number($('pmSubstituto')?.value||0);if(!request.data||!request.substituido_id)throw new Error('Informe data, turno e o GCM titular do serviço ordinário.');}
    else{const op=$('pmExtraOutro')?.selectedOptions?.[0];request.extra_id=Number(op?.value||0);request.extra_tipo=op?.dataset?.tipo||'MANUAL';if(!request.extra_id)throw new Error('Selecione o serviço extra que você cobrirá.');}
    const r=await call(API,'request',{request});
    if(msg){msg.textContent=`${r.message||'Troca agendada enviada.'}${r.request?.id?' · protocolo #'+r.request.id:''}`;msg.classList.add('success')}
    if($('pmData'))$('pmData').value='';if($('pmSubstituto'))$('pmSubstituto').value='';if($('pmExtraOutro'))$('pmExtraOutro').value='';if($('pmObs'))$('pmObs').value='';if($('pmTermo'))$('pmTermo').checked=false;
    modal.value='ASSUNCAO';modal.dispatchEvent(new Event('change',{bubbles:true}));await refreshCloud(true);
  }catch(e){if(msg){msg.textContent=e.message;msg.classList.add('error')}}finally{if(btn)btn.disabled=false}
}

function boot(){
  if(!garantirUi()){setTimeout(boot,300);return}
  const form=$('formPermuta'),modal=$('pmModalidade'),agTipo=$('pmAgTipoV259');
  form.addEventListener('submit',enviarAgendada,true);
  modal.addEventListener('change',()=>queueMicrotask(aplicarModo));
  agTipo?.addEventListener('change',aplicarModo);
  $('gcmbsAgRefreshV259')?.addEventListener('click',()=>refreshCloud(true));
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="permutas"]'))setTimeout(()=>refreshCloud(true),250)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCloud(true)});
  window.addEventListener('gcmbs:v110-refreshed',()=>refreshCloud(true));
  aplicarModo();refreshCloud(true);
  setInterval(()=>{const sec=document.querySelector('section[data-view="permutas"]');if(sec&&!sec.classList.contains('hidden'))refreshCloud(false);},30000);
  console.info('[GCMBS V259] Troca agendada / compensacao futura liberada com fluxo protegido.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
