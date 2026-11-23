/* GCMBS Online V364: visualizacao segura de Extras por turno.
 * So leitura; preserva Gerador, Folha, Android suspenso e Modelo B.
 */
(()=>{
'use strict';
if(window.__GCMBS_EXTRAS_TURNOS_V364__)return;
window.__GCMBS_EXTRAS_TURNOS_V364__=true;
const BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const AUTH=BASE+'gcmbs-communication-gateway-v74';
const EVENTOS=BASE+'gcmbs-quadro-extras-v68';
const JANELA=1800000;
const cache=new Map();
const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const extra=x=>normal(x?.tipo_servico)==='EXTRA'||normal(x?.origem).includes('EXTRA')||/\bEXTRA\b/.test(normal(x?.complemento));
const identity=x=>Number(x?.guarda_id)>0?'ID:'+Number(x.guarda_id):'NOME:'+normal(x?.nome);
async function post(url,data,token){
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data),cache:'no-store'});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.message||'Erro HTTP '+res.status);
 return body;
}
function join(auto,eventos){
 const found=new Map();
 for(const r of auto){if(!extra(r))continue;const key=identity(r)+'|AUTO';if(!found.has(key))found.set(key,{...r,tipo:'Extra automatica'});}
 for(const r of eventos){const key=identity(r)+'|EVENTO|'+String(r.evento_id||r.complemento||'');if(!found.has(key))found.set(key,{...r,tipo:'Extra por evento'});}
 return [...found.values()].sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}
async function query(day,token){
 const key=day+'|'+token,record=cache.get(key);
 if(record&&Date.now()-record.time<JANELA)return record.data;
 const [q,e]=await Promise.all([
  post(AUTH,{action:'quadro_operacional',data:day},token),
  post(EVENTOS,{data:day},token)
 ]);
 if(!q?.efetivo?.detalhes||!Array.isArray(e?.extrasA)||!Array.isArray(e?.extrasB))throw Error('Resposta incompleta: conferencia necessaria');
 const data={
  A:join(q.efetivo.detalhes.servicoA||[],e.extrasA),
  B:join(q.efetivo.detalhes.servicoB||[],e.extrasB)
 };
 cache.set(key,{time:Date.now(),data});
 if(cache.size>12)cache.delete(cache.keys().next().value);
 return data;
}
function setup(){
 const day=document.getElementById('quadroData');
 const sector=document.querySelector('section[data-view="inicio"] .dashboard-sector');
 if(!day||!sector||document.getElementById('gc364-buttons'))return;
 const bar=document.createElement('div');bar.id='gc364-buttons';bar.className='toolbar';bar.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin-top:14px';
 const label=document.createElement('strong');label.textContent='Escalas Extras por turno';bar.appendChild(label);
 const dialog=document.createElement('dialog');dialog.id='gc364-dialog';dialog.style.cssText='border:1px solid #cbd5e1;border-radius:14px;max-width:min(94vw,680px);width:100%;max-height:82vh;padding:20px;background:#fff;color:#14243b';
 const top=document.createElement('div');top.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
 const title=document.createElement('h2');title.style.margin='0';
 const close=document.createElement('button');close.textContent='Fechar';close.type='button';close.className='secondary';close.onclick=()=>dialog.close();
 top.append(title,close);
 const status=document.createElement('p');status.className='muted';status.setAttribute('role','status');
 const list=document.createElement('div');list.style.cssText='display:grid;gap:9px;max-height:60vh;overflow:auto';
 dialog.append(top,status,list);document.body.appendChild(dialog);
 async function show(turn){
  const date=day.value;
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return;
  title.textContent='Extras '+turn+' - '+date.split('-').reverse().join('/');
  list.replaceChildren();status.textContent='Consultando...';dialog.showModal();
  const token=localStorage.getItem('gcmbs.mobile.token')||'';
  if(!token){status.textContent='Sessao nao autenticada.';return;}
  try{
   const data=await query(date,token);
   if(!dialog.open||day.value!==date)return;
   const entries=data[turn];
   status.textContent=entries.length+' Extra(s) identificadas nas fontes disponiveis. Consulta com cache de 30 minutos.';
   if(!entries.length){const empty=document.createElement('p');empty.textContent='Nenhuma Extra identificada neste turno.';list.appendChild(empty);}
   for(const x of entries){
    const item=document.createElement('div');item.style.cssText='border:1px solid #e2e8f0;border-radius:9px;padding:11px;display:grid;gap:4px';
    const name=document.createElement('strong');name.textContent=String(x.nome||'GCM sem nome');
    const origin=document.createElement('small');origin.textContent=String(x.tipo);
    const detail=document.createElement('span');detail.textContent=String(x.complemento||'');
    item.append(name,origin,detail);list.appendChild(item);
   }
  }catch(error){status.textContent='Consulta indisponivel: '+String(error?.message||error)+'. Nenhum dado foi alterado.';}
 }
 for(const turn of ['A','B']){
  const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent='Extras '+turn;
  button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>show(turn));bar.appendChild(button);
 }
 sector.appendChild(bar);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();