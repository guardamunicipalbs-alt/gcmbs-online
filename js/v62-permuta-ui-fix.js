// GCMBS 10.0.62 — correcoes seguras de interface/reconciliacao de Permutas.
// Nao altera registros, decisoes ou referencias no banco. O Desktop continua sendo a fonte consolidada.
const PM_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const pm$=id=>document.getElementById(id);
const pmEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pmFmt=d=>{const s=String(d||'').slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s||'-';};
const PM_TERMINAIS=new Set(['APROVADA','REPROVADA','RECUSADA','NEGADA','CANCELADA','CANCELADO','ERRO']);
let pmBusy=false,pmScheduled=false,pmCache=null,pmCacheAt=0;

function pmAtivo(){const v=document.querySelector('[data-view="permutas"]');return !!v&&!v.classList.contains('hidden');}
function pmGestor(s={}){const r=String(s.role||s.perfil||'').toLowerCase(),c=String(s.cargo||'').toUpperCase();return r==='comandante'||r==='subcomandante'||/\b(COMANDANTE|SUBCOMANDANTE)\b/.test(c);}
function pmComp(){return pm$('pmCompetenciaFiltro')?.value||new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);}
function pmCompReq(x){const q=x?.payload||{};return String(q.competencia_origem||q.data||x?.created_at||'').slice(0,7);}
function pmCompMirror(x){const d=x?.data||x||{};return String(d.competencia_origem||d.data||'').slice(0,7);}
function pmNomeMap(refs={}){return new Map((refs.guardas||[]).map(g=>[Number(g.id),String(g.nome_guerra||g.nome_completo||`GCM ${g.id}`)]));}
function pmNome(m,id){return m.get(Number(id))||`GCM ${id||'-'}`;}
function pmStatus(v){const s=String(v||'PENDENTE').toUpperCase();return s==='NEGADA'?'REPROVADA':s;}

async function pmCall(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessao online nao autenticada.');
  const r=await fetch(PM_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
async function pmContexto(force=false){
  if(!force&&pmCache&&Date.now()-pmCacheAt<10000)return pmCache;
  const [s,d,e,refs]=await Promise.all([
    pmCall('session'),pmCall('data'),pmCall('entity_list',{entity:'permutas',limit:500,offset:0}),pmCall('references')
  ]);
  pmCache={session:s.session||{},requests:Array.isArray(d.action_requests)?d.action_requests:[],mirrors:Array.isArray(e.records)?e.records:[],refs};pmCacheAt=Date.now();return pmCache;
}
function pmMirrorId(r){const d=r?.data||{};return String(d.id??r?.record_key??'');}
function pmMesmoValor(a,b){return String(a??'')===String(b??'');}
function pmMirrorConfere(req,mirror){
  if(!req||!mirror||!req.desktop_referencia_id)return false;
  const q=req.payload||{},d=mirror.data||{};
  if(String(req.desktop_referencia_id)!==pmMirrorId(mirror))return false;
  const testes=[['data',q.data,d.data],['turno',String(q.turno||'').toUpperCase(),String(d.turno||'').toUpperCase()],['substituido',q.substituido_id,d.substituido_id],['substituto',q.substituto_id,d.substituto_id]];
  return testes.every(([,a,b])=>a==null||a===''||pmMesmoValor(a,b));
}
function pmEncontrarMirror(req,mirrors){return mirrors.find(m=>pmMirrorConfere(req,m))||null;}
function pmFase(st){
  const s=pmStatus(st);
  if(s==='AGUARDANDO_ACEITE')return 'Aguardando autorizacao/aceite do outro GCM.';
  if(s==='PENDENTE_DESKTOP')return 'Aguardando recebimento pelo Desktop.';
  if(s==='PROCESSADO'||s==='PENDENTE')return 'Recebida e aguardando decisao do Comando.';
  if(s==='DECISAO_PENDENTE_DESKTOP')return 'Decisao registrada e aguardando confirmacao do Desktop.';
  if(s==='CANCELAMENTO_PENDENTE'||s==='CANCELAMENTO_PENDENTE_DESKTOP'||s==='CANCELAMENTO_COMANDO_PENDENTE')return 'Cancelamento registrado e aguardando sincronizacao.';
  if(s==='CANCELADA'||s==='CANCELADO')return 'Solicitacao cancelada/encerrada.';
  if(s==='REPROVADA'||s==='RECUSADA')return 'Solicitacao encerrada sem aprovacao.';
  if(s==='APROVADA')return 'Solicitacao aprovada e consolidada.';
  if(s==='ERRO')return 'Solicitacao nao consolidada por erro de validacao.';
  return 'Situacao registrada no sistema.';
}
function pmRotuloModalidade(q={}){const m=String(q.modalidade||'ASSUNCAO').toUpperCase();if(m==='TROCA_EXTRA')return'Troca bilateral de extras';if(m==='CESSAO_EXTRA')return'Assuncao de servico extra';return'Assuncao de servico ordinario';}

function pmAjustarAssuncaoExtra(){
  const modo=pm$('pmModalidade'),meu=pm$('pmExtraMeu'),outro=pm$('pmExtraOutro');if(!modo||!meu||!outro)return;
  const meuLab=meu.closest('label'),outroLab=outro.closest('label');if(meuLab&&!meuLab.id)meuLab.id='pmExtraMeuLabel';
  const m=String(modo.value||'ASSUNCAO').toUpperCase();
  if(m==='CESSAO_EXTRA'){
    meuLab?.classList.add('hidden');outroLab?.classList.remove('hidden');
    if(outroLab){const t=[...outroLab.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());if(t)t.nodeValue='Servico extra do outro GCM que deseja assumir';}
  }else if(m==='TROCA_EXTRA'){
    meuLab?.classList.remove('hidden');outroLab?.classList.remove('hidden');
  }
}

function pmRenderGestor(ctx){
  const host=pm$('listaPermutasSolicitadas');if(!host||!pmGestor(ctx.session))return;
  const comp=pmComp(),nomes=pmNomeMap(ctx.refs),mirrors=ctx.mirrors.filter(m=>pmCompMirror(m)===comp);
  const reqs=ctx.requests.filter(x=>String(x.tipo||'').toUpperCase()==='PERMUTA'&&pmCompReq(x)===comp);
  const pareados=new Set();
  for(const r of reqs){const m=pmEncontrarMirror(r,mirrors);if(m)pareados.add(Number(r.id));}
  const itens=[];
  for(const m of mirrors){
    const d=m.data||{},st=pmStatus(d.status),subto=pmNome(nomes,d.substituto_id),sub=pmNome(nomes,d.substituido_id),extra=Number(d.servico_extra||0)===1||String(d.modalidade||'').toUpperCase().includes('EXTRA');
    itens.push({ord:String(d.data||d.solicitado_em||''),html:`<article class="record-card" data-v62-pm-mirror="${pmEsc(pmMirrorId(m))}"><div class="record-card-head"><strong>${pmEsc(subto)} ↔ ${pmEsc(sub)}</strong><span class="status-pill status-${pmEsc(st)}">${pmEsc(st)}</span></div><div class="record-meta">${pmFmt(d.data)} · Turno ${pmEsc(d.turno||'-')} · ${extra?'Servico extra':'Servico ordinario'}</div>${d.observacao?`<div>${pmEsc(d.observacao)}</div>`:''}${d.motivo_decisao?`<small>Decisao: ${pmEsc(d.motivo_decisao)}</small>`:''}</article>`});
  }
  for(const r of reqs.filter(x=>!pareados.has(Number(x.id)))){
    const q=r.payload||{},refTem=!!r.desktop_referencia_id,refExiste=refTem&&ctx.mirrors.some(m=>pmMirrorId(m)===String(r.desktop_referencia_id)),refValida=!!pmEncontrarMirror(r,ctx.mirrors),colisao=refTem&&refExiste&&!refValida;
    const raw=pmStatus(r.status_original||r.status),st=colisao?raw:pmStatus(r.status),sol=r.nome_guerra||pmNome(nomes,r.guarda_id),sub=pmNome(nomes,q.substituido_id),terminal=PM_TERMINAIS.has(st);
    const detalhe=colisao?'Referencia historica do Desktop nao corresponde a data/turno/participantes desta solicitacao. Historico preservado para auditoria.':(r.resposta||pmFase(st));
    const fase=terminal?pmFase(st):pmFase(st);
    itens.push({ord:String(q.data||r.created_at||''),html:`<article class="record-card" data-v62-pm-request="${pmEsc(r.id)}"><div class="record-card-head"><strong>${pmEsc(sol)} — solicitacao online</strong><span class="status-pill status-${pmEsc(st)}">${pmEsc(st)}</span></div><div class="record-meta">${pmFmt(q.data)} · Turno ${pmEsc(q.turno||'-')} · ${pmEsc(pmRotuloModalidade(q))}</div><div>${pmEsc(sub)} · ${pmEsc(fase)}</div>${detalhe&&detalhe!==fase?`<small>${pmEsc(detalhe)}</small>`:''}${colisao?'<div class="record-warning"><b>Auditoria:</b> esta solicitacao nao foi associada ao registro Desktop de mesmo numero porque os participantes nao conferem.</div>':''}</article>`});
  }
  itens.sort((a,b)=>b.ord.localeCompare(a.ord));
  const sig=JSON.stringify([comp,...reqs.map(r=>[r.id,r.status,r.status_original,r.desktop_referencia_id]),...mirrors.map(m=>[pmMirrorId(m),m.data?.status,m.data?.data,m.data?.substituido_id,m.data?.substituto_id])]);
  if(host.dataset.v62PmSig===sig&&host.querySelector('[data-v62-pm-audit]'))return;
  host.dataset.v62PmSig=sig;host.innerHTML=`<div data-v62-pm-audit="1" style="display:contents">${itens.map(x=>x.html).join('')||'<div class="empty">Nenhuma permuta encontrada nesta competencia.</div>'}</div>`;
  const titulo=host.closest('.card')?.querySelector('h2');if(titulo)titulo.textContent='Permutas da competencia — consulta do Comando/Subcomando';
}

function pmCorrigirGestao(ctx){
  const host=pm$('listaPermutasGestao');if(!host||!pmGestor(ctx.session))return;
  const reqs=ctx.requests.filter(x=>String(x.tipo||'').toUpperCase()==='PERMUTA'&&pmCompReq(x)===pmComp()),cards=[...host.querySelectorAll('.record-card')];
  if(cards.length!==reqs.length)return;
  reqs.forEach((r,i)=>{
    if(!r.desktop_referencia_id)return;const existe=ctx.mirrors.some(m=>pmMirrorId(m)===String(r.desktop_referencia_id)),valida=!!pmEncontrarMirror(r,ctx.mirrors);if(!existe||valida)return;
    const card=cards[i],st=pmStatus(r.status_original||r.status),pill=card.querySelector('.status-pill');if(pill){pill.textContent=st;pill.className=`status-pill status-${st}`;}
    card.querySelectorAll('small').forEach(x=>x.remove());
    let w=card.querySelector('[data-v62-pm-collision]');if(!w){w=document.createElement('div');w.dataset.v62PmCollision='1';w.className='record-warning';card.appendChild(w);}w.innerHTML='<b>Auditoria:</b> referencia Desktop inconsistente; o status exibido foi restaurado ao estado proprio desta solicitacao.';
  });
}

async function pmAplicar(force=false){
  pmAjustarAssuncaoExtra();if(!pmAtivo()||pmBusy)return;pmBusy=true;
  try{const ctx=await pmContexto(force);if(!pmAtivo())return;pmRenderGestor(ctx);pmCorrigirGestao(ctx);pmAjustarAssuncaoExtra();}
  catch(e){console.warn('[GCMBS] Permutas: correcao visual de auditoria nao aplicada:',e?.message||e);}
  finally{pmBusy=false;}
}
function pmSchedule(force=false){if(force){pmCache=null;pmCacheAt=0;}if(pmScheduled)return;pmScheduled=true;requestAnimationFrame(()=>{pmScheduled=false;void pmAplicar(force);});}
function pmSetup(){
  pmAjustarAssuncaoExtra();
  pm$('pmModalidade')?.addEventListener('change',()=>setTimeout(()=>{pmAjustarAssuncaoExtra();pmSchedule(false);},0));
  pm$('pmCompetenciaFiltro')?.addEventListener('change',()=>pmSchedule(true));
  const h=pm$('listaPermutasSolicitadas');if(h)new MutationObserver(()=>pmSchedule(false)).observe(h,{childList:true,subtree:true});
  const g=pm$('listaPermutasGestao');if(g)new MutationObserver(()=>pmSchedule(false)).observe(g,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-module="permutas"]'))setTimeout(()=>pmSchedule(true),80);},true);
  pmSchedule(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pmSetup,{once:true});else pmSetup();
