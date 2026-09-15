/* GCMBS V149 - consolidação final Quadro: ordinários + extras por evento */
(()=>{
'use strict';

if(window.__GCMBS_QUADRO_CONTAGEM_V149__) return;
window.__GCMBS_QUADRO_CONTAGEM_V149__=true;

const QUADRO_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const EXTRAS_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-extras-v68';

const norm=v=>String(v??'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/\s+/g,' ')
  .trim()
  .toUpperCase();

const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';

async function post(url,body){
  const t=token();
  if(!t) throw new Error('Sessão não autenticada.');

  const r=await fetch(url,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+t
    },
    body:JSON.stringify(body),
    cache:'no-store'
  });

  let b={};
  try{b=await r.json()}catch{}

  if(!r.ok){
    throw new Error((b&&b.message)?b.message:('HTTP '+r.status));
  }

  return b;
}

function nomes(lista){
  const s=new Set();

  for(const x of Array.isArray(lista)?lista:[]){
    const n=norm(x?.nome);
    if(n) s.add(n);
  }

  return s;
}

function extraKey(x){
  const id=Number(x?.guarda_id||0);
  if(id) return 'ID:'+id;

  const n=norm(x?.nome);
  return n?'NOME:'+n:'';
}

let expected=null;
let busy=false;
let lastDate='';
let lastFetch=0;

function aplicar(){
  if(!expected) return;

  const a=document.getElementById('qServicoA');
  const b=document.getElementById('qServicoB');
  const e=document.getElementById('qExtras');

  if(a && a.textContent!==String(expected.a)){
    a.textContent=String(expected.a);
  }

  if(b && b.textContent!==String(expected.b)){
    b.textContent=String(expected.b);
  }

  if(e && e.textContent!==String(expected.extras)){
    e.textContent=String(expected.extras);
  }

  document.documentElement.dataset.gcmbsQuadroA=String(expected.a);
  document.documentElement.dataset.gcmbsQuadroB=String(expected.b);
  document.documentElement.dataset.gcmbsQuadroExtras=String(expected.extras);
}

async function atualizar(force=false){

  const campo=document.getElementById('quadroData');
  const data=campo?.value||'';

  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
  if(busy) return;

  const agora=Date.now();

  if(!force && data===lastDate && agora-lastFetch<12000){
    aplicar();
    return;
  }

  busy=true;

  try{

    const [q,x]=await Promise.all([
      post(QUADRO_API,{
        action:'quadro_operacional',
        data:data
      }),
      post(EXTRAS_API,{
        data:data
      })
    ]);

    const ordA=Array.isArray(q?.efetivo?.detalhes?.servicoA)
      ? q.efetivo.detalhes.servicoA
      : [];

    const ordB=Array.isArray(q?.efetivo?.detalhes?.servicoB)
      ? q.efetivo.detalhes.servicoB
      : [];

    const extA=Array.isArray(x?.extrasA)?x.extrasA:[];
    const extB=Array.isArray(x?.extrasB)?x.extrasB:[];

    const nomesA=nomes(ordA);
    const nomesB=nomes(ordB);

    for(const item of extA){
      const n=norm(item?.nome);
      if(n) nomesA.add(n);
    }

    for(const item of extB){
      const n=norm(item?.nome);
      if(n) nomesB.add(n);
    }

    const todosExtras=new Set();

    for(const item of [...extA,...extB]){
      const k=extraKey(item);
      if(k) todosExtras.add(k);
    }

    expected={
      a:nomesA.size || Number(q?.efetivo?.servicoA||0),
      b:nomesB.size || Number(q?.efetivo?.servicoB||0),
      extras:todosExtras.size
    };

    lastDate=data;
    lastFetch=Date.now();

    aplicar();

    document.dispatchEvent(
      new CustomEvent('gcmbs:quadro-contagem-v149',{
        detail:{
          data:data,
          servicoA:expected.a,
          servicoB:expected.b,
          extras:expected.extras
        }
      })
    );

  }catch(e){
    console.warn(
      '[GCMBS V149] Não foi possível consolidar o Quadro:',
      e?.message||e
    );
  }finally{
    busy=false;
  }
}

function iniciar(){

  setTimeout(()=>atualizar(true),600);

  document.addEventListener('change',e=>{
    if(e.target?.id==='quadroData'){
      setTimeout(()=>atualizar(true),100);
    }
  },true);

  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('button,a');
    if(!el) return;

    if(/SINCRONIZAR AGORA/i.test(norm(el.textContent))){
      setTimeout(()=>atualizar(true),900);
    }
  },true);

  setInterval(()=>{
    aplicar();
    atualizar(false);
  },3000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',iniciar,{once:true});
}else{
  iniciar();
}

})();