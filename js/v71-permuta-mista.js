// GCMBS 10.0.71 — permuta operacional ordinário ↔ extra.
// Camada compatível com o app-core 10.0.70. Mantém as modalidades antigas intactas.
const GCMBS_V71_MIXED_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mixed-permuta-v71';
const GCMBS_V71_DATA_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const $v71=id=>document.getElementById(id);
const escV71=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

async function callV71(url,payload){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão não autenticada ou expirada.');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(payload),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
async function mixedV71(action,payload={}){return callV71(GCMBS_V71_MIXED_API,{action,...payload});}
async function dataV71(){return callV71(GCMBS_V71_DATA_API,{action:'data'});}
async function extrasV71(){
  const token=localStorage.getItem('gcmbs.mobile.token');
  const r=await fetch('https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action:'candidates'}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
function ensureMixedUiV71(){
  const form=$v71('formPermuta'),sel=$v71('pmModalidade');if(!form||!sel)return false;
  if(![...sel.options].some(o=>o.value==='TROCA_ORDINARIO_EXTRA')){
    const o=document.createElement('option');o.value='TROCA_ORDINARIO_EXTRA';o.textContent='Trocar meu ordinário por um extra';sel.appendChild(o);
  }
  if(!$v71('v71PermutaAjuda')){
    const box=document.createElement('div');box.id='v71PermutaAjuda';box.className='full notice';
    box.innerHTML='<b>Qual opção usar?</b><br><b>Assumir serviço ordinário:</b> você substitui outro GCM no ordinário.<br><b>Assumir um serviço extra:</b> a responsabilidade operacional e financeira acompanha a assunção aprovada.<br><b>Troca bilateral de extras:</b> muda quem executa; os créditos financeiros originais permanecem com seus titulares.<br><b>Ordinário ↔ extra:</b> você executa o extra do outro GCM e ele executa seu ordinário, <b>sem transferência, compensação ou recálculo de 50%/100%</b>.';
    sel.closest('label')?.after(box);
  }
  if(!$v71('pmExtraData')){
    const lab=document.createElement('label');lab.id='pmExtraDataLabelV71';lab.className='full hidden';lab.innerHTML='Data do serviço extra que deseja receber<input id="pmExtraData" type="date">';
    ($v71('pmExtraOutro')?.closest('label')||$v71('pmExtraMeu')?.closest('label'))?.before(lab);
    $v71('pmExtraData')?.addEventListener('change',()=>renderMixedExtrasV71().catch(showMixedErrorV71));
  }
  if(!$v71('v71MixedNotice')){
    const n=document.createElement('div');n.id='v71MixedNotice';n.className='full notice hidden';n.innerHTML='<b>Troca operacional e financeiramente neutra.</b> O crédito do serviço extra continua pertencendo ao titular financeiro original. A classificação 50%/100% e a quantidade de horas não são transferidas para o GCM que passará a executar o extra.';
    ($v71('pmExtraOutro')?.closest('label')||$v71('pmObs')?.closest('label'))?.after(n);
  }
  return true;
}
let extraCacheV71=[];
async function renderMixedExtrasV71(){
  const modalidade=$v71('pmModalidade')?.value;if(modalidade!=='TROCA_ORDINARIO_EXTRA')return;
  const data=$v71('pmExtraData')?.value||'',out=$v71('pmExtraOutro');if(!out)return;
  if(!extraCacheV71.length){const c=await extrasV71();extraCacheV71=Array.isArray(c.others)?c.others:[];}
  const list=extraCacheV71.filter(x=>data&&String(x.data||'').slice(0,10)===data);
  out.innerHTML=list.length?'<option value="">Selecione o serviço extra...</option>'+list.map(x=>{const tipo=String(x.extra_tipo||'MANUAL').toUpperCase(),desc=`${x.nome_guerra||'GCM'} · ${x.tipo_rotulo||tipo} · ${x.descricao||''} · ${x.horario_inicio||''}–${x.horario_fim||''}`;return `<option value="${Number(x.id||x.servico_id)}" data-tipo="${escV71(tipo)}" data-g="${Number(x.guarda_id||0)}" data-data="${escV71(String(x.data||'').slice(0,10))}">${escV71(desc)}</option>`}).join(''):'<option value="">Nenhum serviço extra elegível nesta data</option>';
}
function applyMixedModeV71(){
  if(!ensureMixedUiV71())return;
  const mixed=$v71('pmModalidade')?.value==='TROCA_ORDINARIO_EXTRA';
  const extraLabels=[$v71('pmExtraMeu')?.closest('label'),$v71('pmExtraOutro')?.closest('label')].filter(Boolean);
  if(mixed){
    document.querySelectorAll('.pm-normal').forEach(x=>x.classList.remove('hidden'));
    extraLabels.forEach(x=>x.classList.remove('hidden'));
    $v71('pmExtraMeu')?.closest('label')?.classList.add('hidden');
    $v71('pmExtraDataLabelV71')?.classList.remove('hidden');$v71('v71MixedNotice')?.classList.remove('hidden');
    renderMixedExtrasV71().catch(showMixedErrorV71);
  }else{
    $v71('pmExtraDataLabelV71')?.classList.add('hidden');$v71('v71MixedNotice')?.classList.add('hidden');
  }
}
function showMixedErrorV71(e){const m=$v71('pmMsg');if(m){m.textContent=e?.message||String(e);m.classList.add('error');}}
async function submitMixedV71(ev){
  if($v71('pmModalidade')?.value!=='TROCA_ORDINARIO_EXTRA')return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const msg=$v71('pmMsg');if(msg){msg.className='full request-message';msg.textContent='Enviando troca operacional...';}
  try{
    if(!$v71('pmTermo')?.checked)throw new Error('Leia e aceite o termo de responsabilidade.');
    const opt=$v71('pmExtraOutro')?.selectedOptions?.[0],dataExtra=$v71('pmExtraData')?.value||'';
    const request={modalidade:'TROCA_ORDINARIO_EXTRA',data:$v71('pmData')?.value||'',turno:$v71('pmTurno')?.value||'',extra_data:dataExtra,extra_id:Number(opt?.value||0),extra_tipo:opt?.dataset.tipo||'MANUAL',extra_guarda_id:Number(opt?.dataset.g||0),observacao:$v71('pmObs')?.value||'',concordou_termo:true};
    if(!request.data||!request.turno)throw new Error('Selecione a data e o turno do seu serviço ordinário.');
    if(!dataExtra||!request.extra_id||String(opt?.dataset.data||'')!==dataExtra)throw new Error('Selecione um serviço extra ativo da data informada.');
    const r=await mixedV71('request_mixed_swap',{request});
    if(msg){msg.textContent=r.message||'Troca enviada. Aguardando aceite do titular do extra e análise do Comando.';msg.classList.add('success');}
    $v71('pmTermo').checked=false;$v71('pmObs').value='';
    setTimeout(()=>location.reload(),900);
  }catch(e){showMixedErrorV71(e);}
}
async function mixedRequestByIdV71(id){
  const d=await dataV71(),req=(d.action_requests||[]).find(x=>Number(x.id)===Number(id));
  return req&&String(req?.payload?.modalidade||'').toUpperCase()==='TROCA_ORDINARIO_EXTRA'?req:null;
}
async function captureMixedActionsV71(ev){
  const accept=ev.target.closest?.('[data-pm-accept],[data-pm-reject]');
  const command=ev.target.closest?.('[data-cmd-pm-ok],[data-cmd-pm-no]');
  const target=accept||command;if(!target)return;
  const id=Number(target.dataset.pmAccept||target.dataset.pmReject||target.dataset.cmdPmOk||target.dataset.cmdPmNo||0);if(!id)return;
  let req;try{req=await mixedRequestByIdV71(id);}catch{return;}if(!req)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  if(accept){
    const aceitou=!!target.dataset.pmAccept;if(!confirm(aceitou?'Autorizar a troca ordinário ↔ extra sem transferência financeira?':'Recusar esta troca ordinário ↔ extra?'))return;
    try{await mixedV71('accept_mixed',{id,aceitou});location.reload();}catch(e){alert(e.message);}
    return;
  }
  if(target.dataset.cmdPmOk&&Number(req.payload?.aceite_contraparte)!==1){alert('O titular do serviço extra ainda não autorizou a troca. A aprovação do Comando permanece bloqueada.');return;}
  // Após o aceite, a decisão do Comando segue o fluxo já existente para o Desktop consolidar.
  target.click();
}
function markMixedCardsV71(){
  dataV71().then(d=>{
    const mixed=new Map((d.action_requests||[]).filter(x=>String(x?.payload?.modalidade||'').toUpperCase()==='TROCA_ORDINARIO_EXTRA').map(x=>[Number(x.id),x]));
    document.querySelectorAll('[data-cmd-pm-ok],[data-pm-accept]').forEach(b=>{const id=Number(b.dataset.cmdPmOk||b.dataset.pmAccept||0),r=mixed.get(id);if(!r)return;const card=b.closest('.record-card,.item');if(card&&!card.querySelector('.v71-mixed-badge')){const n=document.createElement('div');n.className='record-warning v71-mixed-badge';n.textContent='Troca ordinário ↔ extra · financeiro neutro: crédito do extra preservado com o titular original.';card.appendChild(n);}if(b.dataset.cmdPmOk&&Number(r.payload?.aceite_contraparte)!==1){b.disabled=true;b.title='Aguardando aceite do titular do extra';}});
  }).catch(()=>{});
}
function bootV71(){
  ensureMixedUiV71();
  $v71('pmModalidade')?.addEventListener('change',()=>setTimeout(applyMixedModeV71,0));
  $v71('formPermuta')?.addEventListener('submit',submitMixedV71,true);
  document.addEventListener('click',captureMixedActionsV71,true);
  applyMixedModeV71();markMixedCardsV71();
  let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;ensureMixedUiV71();markMixedCardsV71();});}).observe(document.documentElement,{childList:true,subtree:true});
  console.info('[GCMBS] HF12 10.0.71 — permuta ordinário ↔ extra ativa');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootV71,{once:true});else bootV71();
