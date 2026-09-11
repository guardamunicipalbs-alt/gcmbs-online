/* GCMBS V148 — decisão de permutas confiável no Online/App. */
(()=>{
'use strict';
if(window.__GCMBS_PERMUTA_FLOW_V148__)return;
window.__GCMBS_PERMUTA_FLOW_V148__=true;

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
const $=s=>document.querySelector(s);

function toast(message,type='success'){
  let box=document.getElementById('gcmbsPermutaToastV148');
  if(!box){
    box=document.createElement('div');
    box.id='gcmbsPermutaToastV148';
    box.setAttribute('role','status');
    box.style.cssText='position:fixed;z-index:2147483647;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,620px);padding:14px 18px;border-radius:14px;box-shadow:0 14px 38px rgba(15,23,42,.28);font:600 14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;transition:.2s;';
    document.body.appendChild(box);
  }
  box.textContent=message;
  box.style.background=type==='error'?'#7f1d1d':type==='warning'?'#78350f':'#0f5132';
  box.style.color='#fff';
  box.style.display='block';
  clearTimeout(window.__GCMBS_PERMUTA_TOAST_TIMER__);
  window.__GCMBS_PERMUTA_TOAST_TIMER__=setTimeout(()=>{box.style.display='none'},6500);
}

async function call(action,payload={}){
  const t=token();
  if(!t)throw new Error('Sessão expirada. Entre novamente no GCMBS.');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok){const e=new Error(b.message||`Erro ${r.status}`);e.status=r.status;e.code=b.code||'';throw e;}
  return b;
}

function busy(btn,text='Processando...'){
  if(!btn)return()=>{};
  const old=btn.textContent;
  btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent=text;
  return()=>{if(document.body.contains(btn)){btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent=old;}};
}
function markCard(btn,message){
  const card=btn?.closest?.('.record-card,.request-card,.item,article');
  if(!card)return;
  card.querySelectorAll('button').forEach(x=>{x.disabled=true;x.setAttribute('aria-disabled','true')});
  let n=card.querySelector('[data-v148-result]');
  if(!n){n=document.createElement('div');n.dataset.v148Result='1';n.className='record-warning';n.style.marginTop='10px';card.appendChild(n);}
  n.textContent=message;
}
function refresh(){
  window.dispatchEvent(new Event('gcmbs:v110-refresh'));
  setTimeout(()=>window.dispatchEvent(new Event('gcmbs:v110-refresh')),1800);
  setTimeout(()=>window.dispatchEvent(new Event('gcmbs:v110-refresh')),5000);
}

async function decideRequest(btn,decision){
  const id=Number(btn.dataset.cmdPmOk||btn.dataset.cmdPmNo||0);if(!id)return;
  let motivo='';
  if(decision==='APROVADA'){
    if(!confirm('Aprovar esta permuta? A decisão será registrada e a identidade do serviço será conferida antes da consolidação.'))return;
    motivo=prompt('Observação da aprovação (opcional):','')||'';
  }else{
    motivo=prompt('Informe o motivo da recusa da permuta:','')||'';
    if(!motivo.trim())return void toast('O motivo da recusa é obrigatório.','warning');
  }
  const restore=busy(btn,decision==='APROVADA'?'Aprovando...':'Recusando...');
  try{
    const r=await call('decide_permuta_request',{id,decisao:decision,motivo});
    const msg=r.message||(decision==='APROVADA'?'Aprovação registrada pelo Comando.':'Recusa registrada pelo Comando.');
    markCard(btn,msg);toast(msg);refresh();
  }catch(e){
    if(Number(e.status)===409&&/já|consolid|decis/i.test(String(e.message||''))){toast('Esta permuta já foi consolidada. Atualizando a tela...','warning');refresh();}
    else{restore();toast(e.message||'Não foi possível registrar a decisão.','error');}
  }
}

async function deleteRequest(btn){
  const id=Number(btn.dataset.cmdPmDel||0);if(!id)return;
  const motivo=prompt('Informe o motivo da exclusão/cancelamento administrativo:','Solicitação registrada de forma equivocada')||'';
  if(!motivo.trim())return;
  if(!confirm('Retirar esta solicitação da fila? O histórico administrativo será preservado.'))return;
  const restore=busy(btn,'Excluindo...');
  try{
    const r=await call('admin_delete_permuta_request',{id,motivo});
    const msg=r.message||'Exclusão administrativa registrada. O histórico foi preservado.';
    markCard(btn,msg);toast(msg);refresh();
  }catch(e){restore();toast(e.message||'Não foi possível excluir a solicitação.','error');}
}

async function decideMirror(btn,decision){
  const id=Number(btn.dataset.cmdMirrorOk||btn.dataset.cmdMirrorNo||0);if(!id)return;
  let motivo='';
  if(decision==='APROVADA'){
    if(!confirm('Aprovar esta permuta já confirmada na réplica operacional?'))return;
  }else{
    motivo=prompt('Informe o motivo da recusa da permuta:','')||'';
    if(!motivo.trim())return void toast('O motivo da recusa é obrigatório.','warning');
  }
  const restore=busy(btn,decision==='APROVADA'?'Aprovando...':'Recusando...');
  try{
    const r=await call('permuta_admin_decide_mirror',{desktop_id:id,decisao:decision,motivo});
    const msg=r.message||(decision==='APROVADA'?'Aprovação registrada.':'Recusa registrada.');
    markCard(btn,msg);toast(msg);refresh();
  }catch(e){
    if(Number(e.status)===409&&/já|consolid|decis/i.test(String(e.message||''))){toast('Esta permuta já foi consolidada. Atualizando a tela...','warning');refresh();}
    else{restore();toast(e.message||'Não foi possível registrar a decisão.','error');}
  }
}

// Captura antes dos handlers antigos. Evita o fluxo em que o diálogo fecha e a tela
// volta sem uma confirmação visível da decisão.
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('[data-cmd-pm-ok],[data-cmd-pm-no],[data-cmd-pm-del],[data-cmd-mirror-ok],[data-cmd-mirror-no]');
  if(!btn||btn.disabled)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(btn.matches('[data-cmd-pm-ok]'))return void decideRequest(btn,'APROVADA');
  if(btn.matches('[data-cmd-pm-no]'))return void decideRequest(btn,'NEGADA');
  if(btn.matches('[data-cmd-pm-del]'))return void deleteRequest(btn);
  if(btn.matches('[data-cmd-mirror-ok]'))return void decideMirror(btn,'APROVADA');
  if(btn.matches('[data-cmd-mirror-no]'))return void decideMirror(btn,'NEGADA');
},true);

// Quando a reconciliação concluir, a própria tela é atualizada sem sair do módulo.
window.addEventListener('gcmbs:v110-refreshed',()=>{
  const view=$('[data-view="permutas"]');
  if(view&&!view.classList.contains('hidden'))document.documentElement.dataset.gcmbsPermutasV148='ativo';
});

console.info('[GCMBS] V148 fluxo de permutas ativo');
})();
