// GCMBS 10.0.68 - HF10 R15
// Estabilidade consolidada do Online/PWA/App.
// Foco: evitar travamentos de abas sem alterar banco, payloads, permissões ou regras do Desktop.
const HF10_R15='20260826hf10r15';

// 1) Coalescência global dos MutationObservers: no máximo uma execução por frame.
// Evita cascatas síncronas de observador -> alteração de DOM -> observador.
if(!window.__gcmbsR15ObserverCoalescing && window.MutationObserver){
  window.__gcmbsR15ObserverCoalescing=true;
  const NativeMutationObserver=window.MutationObserver;
  function GcmbsMutationObserver(callback){
    let scheduled=false;
    let pending=[];
    const native=new NativeMutationObserver((mutations,observer)=>{
      if(mutations?.length){
        if(pending.length<1200) pending.push(...mutations);
        else pending=mutations.slice(-200);
      }
      if(scheduled)return;
      scheduled=true;
      const run=()=>{
        scheduled=false;
        const batch=pending;pending=[];
        try{callback(batch,observer)}catch(err){console.error('[GCMBS] observer isolado pelo HF10 R15',err);}
      };
      if(document.hidden)setTimeout(run,32);else requestAnimationFrame(run);
    });
    return native;
  }
  GcmbsMutationObserver.prototype=NativeMutationObserver.prototype;
  try{Object.setPrototypeOf(GcmbsMutationObserver,NativeMutationObserver);}catch{}
  window.MutationObserver=GcmbsMutationObserver;
}

// 2) Proteção específica contra o ciclo encontrado em Ofícios:
// o código legado reapendava cards que já estavam no mesmo container e acordava o observer novamente.
if(!window.__gcmbsR15OficiosAppendGuard){
  window.__gcmbsR15OficiosAppendGuard=true;
  const previousAppendChild=Node.prototype.appendChild;
  Node.prototype.appendChild=function(node){
    try{
      const titulo=String(document.getElementById('onlineTitulo')?.textContent||'').trim();
      if(node&&node.parentNode===this&&this instanceof Element&&this.id==='onlineRegistros'&&node.matches?.('[data-online-key]')&&/^Ofícios$/i.test(titulo))return node;
    }catch{}
    return previousAppendChild.call(this,node);
  };
}

// 3) Pesquisa leve para TODOS os módulos genéricos.
// Intercepta antes do listener legado, que serializava e reconstruía a lista inteira a cada tecla.
let r15SearchFrame=0;
function r15Norm(v){
  const s=String(v??'');
  try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}catch{return s.toLowerCase();}
}
function r15Digits(v){return String(v??'').replace(/\D/g,'');}
function r15CardIndex(card){
  const txt=String(card.textContent||'');
  const sig=`${txt.length}:${card.childElementCount}`;
  if(card.__gcmbsR15SearchSig!==sig){
    card.__gcmbsR15SearchSig=sig;
    card.__gcmbsR15SearchText=r15Norm(txt);
    card.__gcmbsR15SearchDigits=r15Digits(txt);
  }
  return [card.__gcmbsR15SearchText||'',card.__gcmbsR15SearchDigits||''];
}
function r15EnsureEmpty(host){
  let el=host.querySelector('[data-hf10-r15-empty]');
  if(!el){
    el=document.createElement('div');el.className='empty';el.dataset.hf10R15Empty='1';el.textContent='Nenhum registro encontrado para esta pesquisa.';el.hidden=true;host.appendChild(el);
  }
  return el;
}
function r15ApplySearch(){
  r15SearchFrame=0;
  const input=document.getElementById('onlineFiltro');
  const host=document.getElementById('onlineRegistros');
  const card=document.getElementById('onlineRegistrosCard');
  if(!input||!host||!card||card.classList.contains('hidden')||input.style.display==='none')return;
  const cards=[...host.querySelectorAll('[data-online-key]')];
  if(!cards.length)return;
  const raw=String(input.value||'').trim();
  const q=r15Norm(raw),qd=r15Digits(raw);
  let visible=0;
  for(const row of cards){
    const [txt,digits]=r15CardIndex(row);
    const ok=!raw||txt.includes(q)||(qd.length>=3&&digits.includes(qd));
    row.style.display=ok?'':'none';
    if(ok)visible++;
  }
  const empty=r15EnsureEmpty(host);empty.hidden=!raw||visible>0;
  const status=document.getElementById('onlineFiltrados');
  if(status)status.textContent=raw?`${visible} encontrado(s)`:'Todos os registros';
}
function r15ScheduleSearch(){
  if(r15SearchFrame)return;
  r15SearchFrame=requestAnimationFrame(r15ApplySearch);
}
function r15EnsureListObserver(){
  const host=document.getElementById('onlineRegistros');
  if(!host||host.__gcmbsR15ListObserver)return;
  host.__gcmbsR15ListObserver=true;
  new MutationObserver(()=>{
    const input=document.getElementById('onlineFiltro');
    if(String(input?.value||'').trim())r15ScheduleSearch();
  }).observe(host,{childList:true});
}
document.addEventListener('input',ev=>{
  if(ev.target?.id!=='onlineFiltro')return;
  ev.stopImmediatePropagation();
  r15ScheduleSearch();
},true);

// 4) Deduplicação de chamadas caras idênticas enquanto ainda estão em voo.
// Reduz sobreposição entre atualização de 60 s, retorno à aba e abertura de módulo.
if(!window.__gcmbsR15FetchDedupe){
  window.__gcmbsR15FetchDedupe=true;
  const nativeFetch=window.fetch.bind(window);
  const inflight=new Map();
  const expensive=new Set(['data','references','branding','entity_catalog','entity_list','quadro_operacional','sync_status','frequency_services']);
  window.fetch=async function(input,init={}){
    const method=String(init?.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input?.url||input||''));
    let action='',body='';
    if(method==='POST'){
      body=typeof init?.body==='string'?init.body:'';
      try{action=String(JSON.parse(body||'{}')?.action||'').toLowerCase();}catch{}
    }
    if(method==='POST'&&expensive.has(action)){
      const key=`${url}|${body}`;
      let p=inflight.get(key);
      if(!p){
        p=nativeFetch(input,init);
        inflight.set(key,p);
        p.finally(()=>{if(inflight.get(key)===p)inflight.delete(key);}).catch(()=>{});
      }
      const response=await p;
      return response.clone();
    }
    return nativeFetch(input,init);
  };
}

// 5) Evita disparar refresh geral por intervalo e visibilitychange quase ao mesmo tempo.
if(!window.__gcmbsR15RefreshTriggerGuard){
  window.__gcmbsR15RefreshTriggerGuard=true;
  let lastRefreshTrigger=0;
  const nativeSetInterval=window.setInterval.bind(window);
  window.setInterval=function(callback,delay,...args){
    const src=typeof callback==='function'?String(callback):'';
    if(Number(delay)===60000&&src.includes('atualizarAoVivo')){
      const wrapped=(...cbArgs)=>{
        if(document.hidden)return callback(...cbArgs);
        const now=Date.now();
        if(now-lastRefreshTrigger<45000)return;
        lastRefreshTrigger=now;
        return callback(...cbArgs);
      };
      return nativeSetInterval(wrapped,delay,...args);
    }
    return nativeSetInterval(callback,delay,...args);
  };
  const nativeDocAdd=Document.prototype.addEventListener;
  Document.prototype.addEventListener=function(type,listener,options){
    if(this===document&&type==='visibilitychange'&&typeof listener==='function'&&String(listener).includes('atualizarAoVivo')){
      const wrapped=(...args)=>{
        if(document.hidden)return listener.apply(this,args);
        const now=Date.now();
        if(now-lastRefreshTrigger<45000)return;
        lastRefreshTrigger=now;
        return listener.apply(this,args);
      };
      return nativeDocAdd.call(this,type,wrapped,options);
    }
    return nativeDocAdd.call(this,type,listener,options);
  };
}

function r15Stamp(){
  r15EnsureListObserver();
  const v=document.getElementById('onlineVersao');
  if(v)v.textContent='Online/App 10.0.74';
}
function r15Init(){r15Stamp();r15ScheduleSearch();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r15Init,{once:true});else r15Init();
document.addEventListener('click',ev=>{
  if(ev.target.closest?.('#mainNav [data-module]')){
    setTimeout(r15Stamp,0);setTimeout(r15Stamp,350);setTimeout(r15Stamp,1200);
  }
},true);
window.addEventListener('pageshow',()=>setTimeout(r15Init,0));

// HF10 R16.4: carregar o detalhe canônico do Quadro também a partir da camada R15.
// Usa a mesma URL do Service Worker para que o módulo seja avaliado uma única vez.
import('./hf10-r16-3-quadro-modal.js?v=100074')
  .catch(err=>console.warn('[GCMBS] HF10 R16.4 falha ao carregar detalhe do Quadro',err));

console.info('[GCMBS] HF10 R15 estabilidade consolidada carregada',HF10_R15);
