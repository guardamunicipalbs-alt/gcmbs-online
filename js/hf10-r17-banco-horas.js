// GCMBS 10.0.68 - HF10 R17
// Banco de Horas do Comando: filtro por GCM + competencia e visao integral.
// Somente leitura/apresentacao: nao cria, altera ou exclui movimentacoes.
const R17_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const r17Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r17Fmt=v=>{const m=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
const r17Horas=min=>{const n=Math.round(Number(min)||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`;};
let r17Cache=null,r17Busy=false,r17Timer=0,r17SectionObserver=null;

function r17Section(){return document.querySelector('[data-view="banco"]');}
function r17Visivel(){const s=r17Section();return !!s&&!s.classList.contains('hidden');}
function r17Gestor(){return /banco de horas autorizado/i.test(String(document.getElementById('tituloBanco')?.textContent||''));}
function r17Comp(x){return String(x?.competencia||x?.competencia_origem||x?.data_fato||x?.data_evento||x?.created_at||'').slice(0,7);}
function r17Ativo(x){return String(x?.status||'ATIVO').toUpperCase()==='ATIVO';}
function r17Nome(x,data){
  if(x?.nome_guerra||x?.nome_completo)return x.nome_guerra||x.nome_completo;
  const g=(data?.guardas||[]).find(q=>Number(q.id||q.guarda_id)===Number(x?.guarda_id));
  return g?.nome_guerra||g?.nome_completo||`GCM ${x?.guarda_id||''}`;
}
async function r17Load(force=false){
  if(!force&&r17Cache&&Date.now()-r17Cache.ts<30000)return r17Cache.data;
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessao online nao autenticada.');
  const r=await fetch(R17_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'data'}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  r17Cache={ts:Date.now(),data:b};
  return b;
}
function r17EnsureFilter(data){
  const comp=document.getElementById('bhCompetenciaFiltro');
  const toolbar=comp?.closest('.toolbar');
  if(!toolbar||!r17Gestor())return null;
  let wrap=document.getElementById('bhGcmFiltroWrap');
  if(!wrap){
    wrap=document.createElement('label');
    wrap.id='bhGcmFiltroWrap';
    wrap.innerHTML='GCM <select id="bhGcmFiltro"><option value="">Todos os GCMs</option></select>';
    toolbar.appendChild(wrap);
  }
  const select=document.getElementById('bhGcmFiltro');
  if(!select)return null;
  const atual=select.value;
  const nomes=new Map();
  for(const g of data?.guardas||[]){
    const id=Number(g.id||g.guarda_id||0);if(id)nomes.set(id,g.nome_guerra||g.nome_completo||`GCM ${id}`);
  }
  for(const x of data?.banco_horas||[]){
    const id=Number(x.guarda_id||0);if(id&&!nomes.has(id))nomes.set(id,r17Nome(x,data));
  }
  select.innerHTML='<option value="">Todos os GCMs</option>'+[...nomes.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'pt-BR')).map(([id,n])=>`<option value="${id}">${r17Esc(n)}</option>`).join('');
  if([...select.options].some(o=>o.value===atual))select.value=atual;
  return select;
}
function r17Render(data){
  if(!r17Visivel()||!r17Gestor())return;
  const comp=document.getElementById('bhCompetenciaFiltro')?.value||new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);
  const select=r17EnsureFilter(data);
  const gid=Number(select?.value||0);
  const all=(data?.banco_horas||[]).filter(x=>r17Ativo(x)&&r17Comp(x)===comp);
  const rows=all.filter(x=>!gid||Number(x.guarda_id)===gid).sort((a,b)=>String(b.data_fato||'').localeCompare(String(a.data_fato||''))||Number(b.desktop_id||0)-Number(a.desktop_id||0));
  let c50=0,c100=0,debitos=0;
  for(const x of rows){
    const deb=String(x.natureza||'').toUpperCase()==='DEBITO';
    const m=(deb?-1:1)*Number(x.minutos||0);
    if(deb)debitos+=Number(x.minutos||0);
    if(String(x.classe)==='100')c100+=m;else c50+=m;
  }
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&el.textContent!==v)el.textContent=v;};
  set('bh50',r17Horas(c50));set('bh100',r17Horas(c100));set('bhDeb',r17Horas(debitos));set('bhSaldo',r17Horas(c50+c100));
  const list=document.getElementById('listaBanco');if(!list)return;
  const nomeSel=gid?(select?.selectedOptions?.[0]?.textContent||`GCM ${gid}`):'Todos os GCMs';
  const sig=`${comp}|${gid}|${rows.length}|${rows.map(x=>`${x.desktop_id||''}:${x.updated_at||''}`).join(',')}`;
  if(list.querySelector(`[data-hf10-r17-list="${CSS.escape(sig)}"]`))return;
  const items=rows.map(x=>{
    const deb=String(x.natureza||'').toUpperCase()==='DEBITO';
    const nome=r17Nome(x,data);
    const titulo=x.tipo||x.origem||'Movimentacao';
    const motivo=String(x.motivo||'').trim();
    return `<div class="item"><small>${r17Esc(r17Fmt(x.data_fato))} · ${r17Esc(x.classe||'50')}% · ${r17Esc(nome)}</small><strong>${r17Esc(titulo)}</strong>${motivo?`<small>${r17Esc(motivo)}</small>`:''}<span>${deb?'-':'+'}${r17Horas(x.minutos)}</span></div>`;
  }).join('');
  list.innerHTML=`<span hidden data-hf10-r17-list="${r17Esc(sig)}"></span>${items||'<div class="empty">Sem movimentacoes nesta competencia.</div>'}`;
  const card=list.closest('.card');const h=card?.querySelector('h2');if(h)h.textContent='Movimentacoes da competencia';
  let resumo=card?.querySelector('[data-hf10-r17-summary]');
  if(!resumo&&card){resumo=document.createElement('p');resumo.className='muted';resumo.dataset.hf10R17Summary='1';card.insertBefore(resumo,list);}
  if(resumo)resumo.textContent=`${rows.length} movimentacao(oes) · ${nomeSel}`;
}
async function r17Refresh(force=false){
  if(r17Busy||!r17Visivel()||!r17Gestor())return;
  r17Busy=true;
  try{r17Render(await r17Load(force));}
  catch(e){console.warn('[GCMBS] HF10 R17 Banco de Horas:',e?.message||e);}
  finally{r17Busy=false;}
}
function r17Schedule(force=false,delay=120){
  clearTimeout(r17Timer);r17Timer=setTimeout(()=>r17Refresh(force),delay);
}
function r17Attach(){
  const s=r17Section();if(!s)return;
  if(!r17SectionObserver){
    r17SectionObserver=new MutationObserver(()=>{if(r17Visivel())r17Schedule(true,80);});
    r17SectionObserver.observe(s,{attributes:true,attributeFilter:['class']});
  }
  if(r17Visivel())r17Schedule(true,80);
}
document.addEventListener('change',e=>{
  if(e.target?.id==='bhGcmFiltro'){if(r17Cache)r17Render(r17Cache.data);return;}
  if(e.target?.id==='bhCompetenciaFiltro'){if(r17Cache)r17Render(r17Cache.data);r17Schedule(false,80);}
},true);
document.addEventListener('click',e=>{
  if(e.target.closest?.('#mainNav'))setTimeout(r17Attach,120);
  if(e.target.closest?.('#formBancoCorrecao button,[data-cmd-bh-ok],[data-cmd-bh-no]'))r17Schedule(true,1400);
},true);
window.addEventListener('pageshow',()=>setTimeout(r17Attach,100));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r17Attach,{once:true});else r17Attach();
setInterval(()=>{if(r17Visivel())r17Refresh(true);},60000);
console.info('[GCMBS] HF10 R17 Banco de Horas por GCM + competencia ativo');
