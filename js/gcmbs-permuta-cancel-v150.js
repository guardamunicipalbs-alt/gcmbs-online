/* GCMBS V154 — cancelamento pós-aprovação pelo Comando; mesmo dia permitido, passado imutável. */
(()=>{'use strict';
if(window.__GCMBS_PERMUTA_CANCEL_V154__)return;window.__GCMBS_PERMUTA_CANCEL_V154__=true;
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const REFS_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{const m=String(d||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(d||'')};
const hoje=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
async function post(action,payload={}){const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessão expirada.');const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});let b={};try{b=await r.json()}catch{}if(!r.ok){const e=new Error(b.message||`Erro ${r.status}`);e.code=b.code||'';throw e}return b;}
function identity(x){return{data:x.data||null,turno:x.turno||null,modalidade:x.modalidade||'ASSUNCAO',substituto_id:Number(x.substituto_id)||null,substituido_id:Number(x.substituido_id)||null,escala_id:Number(x.escala_id)||null,extra_id:Number(x.extra_id)||null,extra_contrapartida_id:Number(x.extra_contrapartida_id)||null,extra_tipo_origem:x.extra_tipo_origem||null,extra_tipo_contrapartida:x.extra_tipo_contrapartida||null};}
async function loadApproved(){const r=await post('entity_list',{entity:'permutas',limit:500,offset:0});return (r.records||[]).map(x=>x.data||{}).filter(x=>String(x.status||'').toUpperCase()==='APROVADA').sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));}
// Os registros espelhados de permutas podem conter apenas IDs do SQLite.
// Resolver os nomes exclusivamente para exibição, sem modificar o payload ou o histórico.
let nomesPromise=null,nomesToken='';
function nomesGuardas(){
  const token=localStorage.getItem('gcmbs.mobile.token')||'';
  if(token!==nomesToken){nomesToken=token;nomesPromise=null;}
  if(!token)return Promise.resolve(new Map());
  if(!nomesPromise)nomesPromise=(async()=>{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);
    try{
      const r=await fetch(REFS_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'references'}),cache:'no-store',signal:ctrl.signal});
      if(!r.ok)throw Error('Falha HTTP '+r.status+' ao consultar referências de guardas.');
      const body=await r.json(),root=body?.references&&typeof body.references==='object'?body.references:body;
      const guardas=Array.isArray(root?.guardas)?root.guardas:[];
      const nomes=new Map();
      for(const g of guardas){
        const id=Number(g?.id||g?.guarda_id),nome=String(g?.nome_guerra||g?.nome_completo||g?.nome||'').trim();
        if(Number.isSafeInteger(id)&&id>0&&nome)nomes.set(id,nome);
      }
      return nomes;
    }finally{clearTimeout(timer);}
  })().catch(e=>{console.warn('[GCMBS] Nomes de guerra indisponíveis; IDs mantidos:',e?.message||e);return new Map();});
  return nomesPromise;
}
function nomeNoCard(nomes,id,registrado){
  const nome=String(registrado||'').trim();
  if(nome&&!/^GCM(?:\s*#?\d+)?$/i.test(nome))return nome;
  return nomes.get(Number(id))||nome||`GCM #${id||'-'}`;
}
function ensure(){const base=$('#listaPermutasGestao'),card=$('#permutaGestaoCard');if(!base||!card||card.classList.contains('hidden'))return null;let wrap=$('#gcmbsPermutasAprovadasV150');if(wrap)return wrap;wrap=document.createElement('section');wrap.id='gcmbsPermutasAprovadasV150';wrap.style.marginTop='18px';wrap.innerHTML='<h3 style="margin:0 0 6px">Permutas aprovadas — cancelamento pelo Comando</h3><p class="record-meta" style="margin:0 0 10px">O Comandante/Subcomandante pode cancelar uma permuta aprovada de hoje ou de data futura. Datas anteriores permanecem históricas e imutáveis.</p><div data-v150-approved-list><div class="empty">Carregando...</div></div>';base.parentElement?.appendChild(wrap);return wrap;}
async function render(){const wrap=ensure();if(!wrap)return;const list=wrap.querySelector('[data-v150-approved-list]');try{const [all,nomes]=await Promise.all([loadApproved(),nomesGuardas()]),h=hoje();const atuais=all.filter(x=>String(x.data||'').slice(0,10)>=h);const html=atuais.length?atuais.map(x=>{const id=Number(x.id||0),sub=nomeNoCard(nomes,x.substituto_id,x.substituto_nome),old=nomeNoCard(nomes,x.substituido_id,x.substituido_nome);return `<article class="record-card"><div class="record-card-head"><strong>Permuta #${id} · ${esc(sub)} ↔ ${esc(old)}</strong><span class="status-pill status-APROVADA">APROVADA</span></div><div class="record-meta">${fmt(x.data)} · Turno ${esc(x.turno||'-')} · ${esc(x.modalidade||'ASSUNCAO')}</div><div class="request-actions"><button class="mini danger-soft" data-v150-cancel-approved="${id}">Cancelar permuta aprovada</button></div></article>`}).join(''):'<div class="empty">Nenhuma permuta aprovada de hoje ou futura disponível para cancelamento.</div>';if(list.innerHTML!==html){list.innerHTML=html;list.querySelectorAll('[data-v150-cancel-approved]').forEach(btn=>btn.addEventListener('click',()=>cancel(btn,all.find(x=>Number(x.id)===Number(btn.dataset.v150CancelApproved)))));}}catch(e){list.innerHTML=`<div class="empty">${esc(e.message||e)}</div>`}}
async function cancel(btn,x){if(!x)return;const motivo=prompt('Informe o motivo do cancelamento da permuta já aprovada:','')||'';if(!motivo.trim())return;if(!confirm('Cancelar esta permuta aprovada? A validação operacional será feita no servidor e o histórico será preservado.'))return;const old=btn.textContent;btn.disabled=true;btn.textContent='Solicitando cancelamento...';try{const r=await post('permuta_admin_cancel_approved',{desktop_id:Number(x.id),motivo,identidade:identity(x)});alert(r.message||'Cancelamento registrado.');window.dispatchEvent(new Event('gcmbs:v110-refresh'));setTimeout(render,800);setTimeout(render,3500);}catch(e){alert(e.message||e);btn.disabled=false;btn.textContent=old;}}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if($('#listaPermutasGestao'))render()},120)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('gcmbs:v110-refresh',()=>setTimeout(render,400));console.info('[GCMBS] V154 cancelamento de permuta ativo no gateway canônico');
})();