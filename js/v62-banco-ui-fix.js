// GCMBS 10.0.62 — correções de apresentação/escopo do Banco de Horas.
// Não altera saldos, regras financeiras ou registros; atua somente na interface.
const BANCO_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const banco$=id=>document.getElementById(id);
const bancoEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bancoFmt=d=>{const s=String(d||'').slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s;};
const bancoHoras=min=>{const n=Number(min||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`;};
const bancoCompAtual=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);
const BANCO_PENDENTES=new Set(['PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP']);
const BANCO_ORIGENS={
  ESCALA_EXTRA_MANUAL:'Escala Extra Manual',
  SERVICO_EXTRA_EVENTO:'Serviço Extra por Evento',
  JUSTIFICATIVA_FALTA_EXTRA:'Justificativa de Falta Extra',
  FREQUENCIA_FALTA_EXTRA:'Falta em Serviço Extra',
  FREQUENCIA_FALTA_EVENTO:'Falta em Evento',
  AJUSTE_MANUAL:'Ajuste Manual',
  TRANSFERENCIA:'Transferência',
  INDENIZACAO:'Indenização',
  PENALIZACAO:'Penalização',
  CANCELAMENTO:'Cancelamento'
};
let bancoCache=null,bancoCacheAt=0,bancoBusy=false,bancoScheduled=false;

function bancoAtivo(){const v=document.querySelector('[data-view="banco"]');return !!v&&!v.classList.contains('hidden');}
async function bancoApi(action){
  const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(BANCO_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
async function bancoContexto(force=false){
  if(!force&&bancoCache&&Date.now()-bancoCacheAt<15000)return bancoCache;
  const [s,d]=await Promise.all([bancoApi('session'),bancoApi('data')]);
  bancoCache={session:s.session||{},requests:Array.isArray(d.action_requests)?d.action_requests:[]};bancoCacheAt=Date.now();return bancoCache;
}
function bancoCompetenciaRegistro(x){const p=x?.payload||{};return String(p.competencia||p.competencia_origem||p.data||x?.data_evento||x?.data_fato||x?.created_at||'').slice(0,7);}
function bancoInjetarEstilo(){
  if(banco$('v62BancoFixStyle'))return;const s=document.createElement('style');s.id='v62BancoFixStyle';s.textContent=`
    #listaCorrecoes .v62-banco-resposta{display:block;margin-top:5px;line-height:1.35;color:#52627a}
    #listaCorrecoes .v62-banco-descricao{display:block;margin-top:2px}
  `;document.head.appendChild(s);
}
function bancoAjustarTitulos(){const h=banco$('listaBanco')?.closest('.card')?.querySelector('h2');if(h&&h.textContent!=='Movimentações da competência')h.textContent='Movimentações da competência';}
function bancoRenderMinhas(ctx){
  const host=banco$('listaCorrecoes');if(!host)return;const comp=banco$('bhCompetenciaFiltro')?.value||bancoCompAtual(),gid=Number(ctx.session?.guarda_id||0);
  const req=ctx.requests.filter(x=>String(x.tipo||'').toUpperCase()==='BANCO_HORAS_CORRECAO'&&bancoCompetenciaRegistro(x)===comp&&Number(x.guarda_id||x.payload?.guarda_id||0)===gid);
  const sig=JSON.stringify(req.map(x=>[x.id,x.status,x.resposta,x.payload?.minutos_solicitados,x.payload?.descricao]));
  const marcado=req.length?host.querySelectorAll('[data-v62-own-request]').length===req.length:!!host.querySelector('[data-v62-own-empty]');
  if(host.dataset.v62BancoOwnSig===sig&&marcado)return;
  host.dataset.v62BancoOwnSig=sig;
  host.innerHTML=req.length?req.map(x=>{const p=x.payload||{},min=Number(p.minutos_solicitados||0),status=String(x.status||'PENDENTE').toUpperCase();return `<div class="item" data-v62-own-request="${bancoEsc(x.id)}"><small>${bancoFmt(String(x.created_at||'').slice(0,10))} · ${bancoEsc(p.data_servico||'')} · ${bancoHoras(min)}</small><strong>${bancoEsc(status)}</strong><span class="v62-banco-descricao">${bancoEsc(p.descricao||'Solicitação de correção')}</span>${x.resposta?`<small class="v62-banco-resposta">${bancoEsc(x.resposta)}</small>`:''}</div>`;}).join(''):'<div class="empty" data-v62-own-empty="1">Nenhuma solicitação de correção enviada por você nesta competência.</div>';
}
function bancoFiltrarAnalise(){
  const host=banco$('listaBancoGestao');if(!host)return;const cards=[...host.querySelectorAll('.record-card')];let restaram=0;
  for(const card of cards){const st=String(card.querySelector('.status-pill')?.textContent||'').trim().toUpperCase();if(st&&!BANCO_PENDENTES.has(st))card.remove();else restaram++;}
  if(restaram===0&&!host.querySelector('[data-v62-banco-pendente-empty]'))host.innerHTML='<div class="empty" data-v62-banco-pendente-empty="1">Nenhuma solicitação pendente de análise.</div>';
}
function bancoHumanizarMovimentacoes(){
  for(const el of document.querySelectorAll('#listaBanco .item > strong')){const k=String(el.textContent||'').trim().toUpperCase();if(BANCO_ORIGENS[k]&&el.textContent!==BANCO_ORIGENS[k])el.textContent=BANCO_ORIGENS[k];}
}
async function bancoAplicar(force=false){
  if(!bancoAtivo()||bancoBusy)return;bancoInjetarEstilo();bancoAjustarTitulos();bancoFiltrarAnalise();bancoHumanizarMovimentacoes();bancoBusy=true;
  try{const ctx=await bancoContexto(force);if(!bancoAtivo())return;bancoRenderMinhas(ctx);bancoAjustarTitulos();bancoFiltrarAnalise();bancoHumanizarMovimentacoes();}
  catch(e){console.warn('[GCMBS] Banco de Horas: correção visual não aplicada:',e?.message||e);}
  finally{bancoBusy=false;}
}
function bancoSchedule(force=false){
  if(force){bancoCache=null;bancoCacheAt=0;}if(bancoScheduled)return;bancoScheduled=true;requestAnimationFrame(()=>{bancoScheduled=false;void bancoAplicar(force);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>bancoSchedule(false),{once:true});else bancoSchedule(false);
document.addEventListener('change',e=>{if(e.target?.id==='bhCompetenciaFiltro')bancoSchedule(true);},true);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-module="banco_horas"]'))setTimeout(()=>bancoSchedule(true),80);if(e.target.closest?.('#bcEnviar,[data-cmd-bh-ok],[data-cmd-bh-no]')){bancoCache=null;bancoCacheAt=0;}},true);
new MutationObserver(()=>bancoSchedule(false)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
