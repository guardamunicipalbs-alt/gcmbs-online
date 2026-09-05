// GCMBS 10.0.75 - Quadro Operacional com efetivo completo.
// O contador e o detalhe A/B representam os mesmos GCMs: ordinarios + extras
// ativos, com cada GCM contado uma unica vez por turno.
const R163_QUADRO_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const R163_EXTRAS_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';

const r163Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r163Fmt=v=>{const m=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
let r163Busy=false;

async function r163Call(url,payload){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
    body:JSON.stringify(payload),
    cache:'no-store'
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

const r163Quadro=data=>r163Call(R163_QUADRO_API,{action:'quadro_operacional',data});
const r163Extras=data=>r163Call(R163_EXTRAS_API,{action:'extras_evento',data});
const r163EhEvento=x=>String(x?.origem||'').toUpperCase()==='EVENTO_EXTRA'||/extra\s+por\s+evento/i.test(String(x?.complemento||''));

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
    const [d,x]=await Promise.all([
      r163Quadro(data),
      r163Extras(data).catch(e=>{console.warn('[GCMBS] HF10 R20 extras dedicados indisponiveis:',e?.message||e);return null;})
    ]);
    const key=turno==='A'?'servicoA':'servicoB';
    const atual=Array.isArray(d?.efetivo?.detalhes?.[key])?d.efetivo.detalhes[key]:[];
    const consolidado=d?.efetivo?.contagemIncluiExtras===true;
    const ord=Number(d?.efetivo?.[turno==='A'?'ordinariosA':'ordinariosB']??(consolidado?0:d?.efetivo?.[key])??0);
    let itens=atual;
    if(!consolidado&&x){
      const diretos=Array.isArray(turno==='A'?x.extrasA:x.extrasB)?(turno==='A'?x.extrasA:x.extrasB):[];
      itens=[...atual.filter(y=>!r163EhEvento(y)),...diretos];
    }
    const extras=Number(d?.efetivo?.[turno==='A'?'extrasA':'extrasB']??Math.max(0,itens.length-ord));
    r163Render(btn.dataset.title||`Serviço ${turno}`,d?.data||data,itens,ord,extras);
  }catch(e){
    console.warn('[GCMBS] HF10 R20 detalhe do Quadro:',e?.message||e);
  }finally{r163Busy=false;}
}

document.addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-quadro-detail="efetivo.servicoA"],[data-quadro-detail="efetivo.servicoB"]');
  if(!btn)return;
  queueMicrotask(()=>r163Abrir(btn));
},false);

// HF10 R17.3: Banco de Horas do Comando por GCM + competencia, com protecao da lista e filtro na analise.
import('./hf10-r17-banco-horas.js?v=20260831hf10r17r3')
  .catch(err=>console.warn('[GCMBS] HF10 R17.3 falha ao carregar Banco de Horas',err));

// HF10 R17.4: garante ocultacao visual dos cards da Analise que nao pertencem ao GCM selecionado.
import('./hf10-r17-4-banco-gestao-filter.js?v=20260831hf10r17r4')
  .catch(err=>console.warn('[GCMBS] HF10 R17.4 falha ao carregar filtro visual da Analise',err));

// HF10 R18: estado operacional da Frota e sincronizacao manual consolidada.
import('./hf10-r18-frota-sync.js?v=100075')
  .catch(err=>console.warn('[GCMBS] HF10 R18 falha ao carregar Frota/Sync',err));

// HF10 R19: logout explicito revoga inclusive sessao lembrada.
import('./hf10-r19-session-security.js?v=20260831hf10r19')
  .catch(err=>console.warn('[GCMBS] HF10 R19 falha ao carregar seguranca de sessao',err));

// HF10 R21D: paridade visual, Equipes/Postos/Tipos e versao; query nova evita cache legado.
import('./hf10-r21-form-parity.js?v=100075')
  .catch(err=>console.warn('[GCMBS] HF10 R21 falha ao carregar paridade visual',err));

console.info('[GCMBS] 10.0.75 Quadro com efetivo completo ativo');
