// GCMBS 10.0.68 - HF10 R16.3
// Quadro Operacional: ao abrir Serviço A/B, recarrega o detalhe canônico
// para exibir ordinários + extras do turno, sem alterar o contador dos cards.
const R163_QUADRO_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-v62';

const r163Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r163Fmt=v=>{const m=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
let r163Busy=false;

async function r163Quadro(data){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(R163_QUADRO_API,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
    body:JSON.stringify({action:'quadro_operacional',data}),
    cache:'no-store'
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

function r163Render(titulo,data,itens,ord,extras){
  const modal=document.getElementById('quadroModal');
  const title=document.getElementById('quadroModalTitulo');
  const meta=document.getElementById('quadroModalMeta');
  const list=document.getElementById('quadroModalLista');
  if(!modal||!title||!meta||!list)return;
  title.textContent=titulo;
  const partes=[`Data de referência: ${r163Fmt(data)}`,`${itens.length} registro(s)`];
  if(Number.isFinite(ord)&&Number.isFinite(extras))partes.push(`${ord} ordinário(s) + ${extras} extra(s)`);
  meta.textContent=partes.join(' · ');
  list.innerHTML=itens.length?itens.map(x=>`<div class="item"><strong>${r163Esc(x?.nome||'-')}</strong><span>${r163Esc(x?.complemento||'')}</span></div>`).join(''):'<div class="empty">Nenhum registro compõe este indicador na data selecionada.</div>';
  modal.classList.remove('hidden');
}

async function r163Abrir(btn){
  if(r163Busy)return;
  const caminho=String(btn?.dataset?.quadroDetail||'');
  const turno=caminho==='efetivo.servicoA'?'A':caminho==='efetivo.servicoB'?'B':'';
  if(!turno)return;
  const data=document.getElementById('quadroData')?.value||new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
  r163Busy=true;
  try{
    const d=await r163Quadro(data);
    const key=turno==='A'?'servicoA':'servicoB';
    const itens=Array.isArray(d?.efetivo?.detalhes?.[key])?d.efetivo.detalhes[key]:[];
    const ord=Number(d?.efetivo?.[key]||0);
    const extras=Number(turno==='A'?d?.efetivo?.extrasEventoA:d?.efetivo?.extrasEventoB)||0;
    r163Render(btn.dataset.title||`Serviço ${turno}`,d?.data||data,itens,ord,extras);
  }catch(e){
    console.warn('[GCMBS] HF10 R16.3 detalhe do Quadro:',e?.message||e);
  }finally{r163Busy=false;}
}

document.addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-quadro-detail="efetivo.servicoA"],[data-quadro-detail="efetivo.servicoB"]');
  if(!btn)return;
  // O listener original abre imediatamente. Esta camada substitui o conteúdo
  // em seguida pela resposta canônica R16.3, sem impedir o comportamento padrão.
  queueMicrotask(()=>r163Abrir(btn));
},false);

console.info('[GCMBS] HF10 R16.3 modal do Quadro ativo');
