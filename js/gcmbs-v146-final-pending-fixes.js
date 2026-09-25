/* GCMBS V154 R2 — reconciliação defensiva das pendências do Comando sem tempestade de polling. */
(()=>{'use strict';if(window.__GCMBS_V154__)return;window.__GCMBS_V154__=true;
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74',norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(),token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
const final=s=>['PROCESSADO','APROVADA','APROVADO','NEGADA','NEGADO','RECUSADA','RECUSADO','CANCELADA','CANCELADO','SUPERADO','ERRO'].includes(norm(s));
let cachedData=null,lastFetch=0,inFlight=false,domQueued=false;
async function getData(){
  const t=token();if(!t)return null;
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({action:'data'}),cache:'no-store'});
    return r.ok?r.json():null;
  }catch{return null}
}
function identity(r){const p=r?.payload||{};return [Number(r?.guarda_id||p.guarda_id||0),norm(p.competencia),String(p.data_servico||p.data||'').slice(0,10)].join('|')}
function reconcileBank(d){const req=(d?.action_requests||[]).filter(x=>norm(x.tipo)==='BANCO_HORAS_CORRECAO'),dec=(d?.action_requests||[]).filter(x=>norm(x.tipo)==='BANCO_HORAS_DECISAO_COMANDO');const decided=new Set(dec.filter(x=>final(x.status)&&['APROVADA','NEGADA'].includes(norm(x.payload?.decisao))).map(x=>String(x.payload?.request_id||'')));const byIdent=new Set(dec.filter(x=>final(x.status)&&norm(x.payload?.decisao)==='APROVADA').map(identity));document.querySelectorAll('[data-cmd-bh-ok],[data-cmd-bh-no]').forEach(b=>{const card=b.closest('.request-card,.card,article,section,div');if(!card)return;const id=String(b.dataset?.cmdBhOk||b.dataset?.cmdBhNo||card.dataset?.requestId||'');const text=norm(card.textContent);const r=req.find(x=>String(x.id)===id);const done=(id&&decided.has(id))||(r&&byIdent.has(identity(r)));if(done){card.querySelectorAll('[data-cmd-bh-ok],[data-cmd-bh-no]').forEach(x=>x.remove());const badge=card.querySelector('.badge,.status-badge');if(badge&&badge.textContent!=='APROVADA'){badge.textContent='APROVADA';badge.classList.remove('pending','warning');badge.classList.add('success')}card.dataset.v154Reconciled='1'}else if(text.includes('APROVADA')||text.includes('PROCESSADO'))card.querySelectorAll('[data-cmd-bh-ok],[data-cmd-bh-no]').forEach(x=>x.remove())})}
function reconcilePermuta(d){const req=(d?.action_requests||[]).filter(x=>norm(x.tipo)==='PERMUTA');document.querySelectorAll('[data-cmd-pm-ok],[data-cmd-pm-no]').forEach(b=>{const card=b.closest('.request-card,.card,article,section,div');if(!card)return;const id=String(b.dataset.cmdPmOk||b.dataset.cmdPmNo||card.dataset.requestId||'');const r=req.find(x=>String(x.id)===id);if(r&&!final(r.status)){if(b.disabled)b.disabled=false;if(b.hasAttribute('aria-disabled'))b.removeAttribute('aria-disabled');if(b.style.pointerEvents!=='auto')b.style.pointerEvents='auto';if(b.title!=='Decisão disponível no Online/App; validação operacional ocorre no servidor.')b.title='Decisão disponível no Online/App; validação operacional ocorre no servidor.';if(b.dataset.cmdPmOk&&/AGUARDANDO SINCRONIZA/i.test(b.textContent||''))b.textContent='Aprovar';card.dataset.v154OnlineDecision='1'}})}
function version(){document.documentElement.dataset.gcmbsVersion='10.0.154'}
function applyCached(){version();if(!cachedData)return;reconcileBank(cachedData);reconcilePermuta(cachedData)}
async function refresh(force=false){
  version();
  const now=Date.now();
  if(inFlight)return;
  if(!force&&cachedData&&now-lastFetch<30000){applyCached();return}
  inFlight=true;
  try{
    const d=await getData();if(!d)return;
    cachedData=d;lastFetch=Date.now();applyCached();
  }finally{inFlight=false}
}
function boot(){
  refresh(true);
  new MutationObserver(()=>{
    if(domQueued)return;domQueued=true;
    requestAnimationFrame(()=>{domQueued=false;applyCached()});
  }).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{if(!document.hidden)refresh(false)},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();})();