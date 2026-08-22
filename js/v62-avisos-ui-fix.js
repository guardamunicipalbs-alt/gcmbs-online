// GCMBS 10.0.62 — auditoria do Quadro de Avisos.
// 1) "Notificações pessoais" mostra apenas notificações do próprio usuário,
//    sem misturar o histórico administrativo global do Comando.
// 2) Avisos institucionais ficam no bloco próprio "Avisos ativos" e não são
//    duplicados em "Notificações pessoais".
// 3) O datetime-local de "Exibir até" é enviado com o fuso America/Fortaleza
//    (-03:00), evitando expiração três horas antes do horário escolhido.
const AVISOS_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const escAviso=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let avisoBusy=false,avisoCache=null,avisoRendering=false;

async function avisoCall(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(AVISOS_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function avisoSecao(){return document.querySelector('[data-view="avisos"]');}
function avisoVisivel(){const s=avisoSecao();return !!s&&!s.classList.contains('hidden');}
function isoFortalezaLocal(v){
  const s=String(v||'').trim();if(!s)return null;
  if(/[zZ]$|[+-]\d\d:\d\d$/.test(s))return new Date(s).toISOString();
  const normal=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)?`${s}:00`:s;
  const d=new Date(`${normal}-03:00`);if(Number.isNaN(d.getTime()))throw new Error('Horário final inválido.');
  return d.toISOString();
}
function dataBr(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v).slice(0,10).split('-').reverse().join('/');return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza'}).format(d);}
function dataHoraBr(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'}).format(d);}
function competenciaNotificacao(x){
  const ev=String(x?.data_evento||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(ev))return ev.slice(0,7);
  const d=new Date(x?.created_at||'');if(Number.isNaN(d.getTime()))return String(x?.created_at||'').slice(0,7);
  return d.toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);
}
function notificacoesPessoais(){
  const comp=document.getElementById('avisosCompetenciaFiltro')?.value||new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);
  const vistos=new Set();
  return (avisoCache?.notifications||[])
    .filter(x=>String(x.tipo||'').toUpperCase()!=='AVISO_INSTITUCIONAL')
    .filter(x=>competenciaNotificacao(x)===comp)
    .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))
    .filter(x=>{const k=[x.tipo,x.referencia_tipo,x.referencia_id,x.titulo,x.mensagem,x.data_evento].map(v=>String(v??'')).join('|');if(vistos.has(k))return false;vistos.add(k);return true;});
}
function renderPessoais(){
  const host=document.getElementById('listaAvisos');if(!host||!avisoCache)return;
  avisoRendering=true;
  try{
    const lista=notificacoesPessoais();
    host.innerHTML=lista.length?lista.map(x=>`<article data-gcmbs-personal-render="1" data-notificacao-id="${Number(x.id)||0}" data-nao-lida="${x.lida_em?'0':'1'}" style="border:1px solid #dbe4f0;border-radius:12px;padding:12px;margin-bottom:10px;background:#fff;cursor:${x.lida_em?'default':'pointer'}"><small style="color:#64748b">${escAviso(dataBr(x.data_evento||x.created_at))}${x.lida_em?'':' · NÃO LIDA'}</small><strong style="display:block;margin-top:4px">${escAviso(x.titulo||'Notificação')}</strong><div style="margin-top:4px">${escAviso(x.mensagem||'')}</div></article>`).join(''):'<div data-gcmbs-personal-render="1" class="empty">Nenhuma notificação pessoal nesta competência.</div>';
    host.querySelectorAll('[data-notificacao-id][data-nao-lida="1"]').forEach(el=>el.addEventListener('click',async()=>{try{await avisoCall('mark_notification_read',{id:Number(el.dataset.notificacaoId)});el.dataset.naoLida='0';el.style.cursor='default';const sm=el.querySelector('small');if(sm)sm.textContent=sm.textContent.replace(' · NÃO LIDA','');const x=avisoCache.notifications?.find(n=>Number(n.id)===Number(el.dataset.notificacaoId));if(x)x.lida_em=new Date().toISOString();renderBadge();}catch{}}));
    renderBadge();
  }finally{setTimeout(()=>{avisoRendering=false;},0);}
}
function renderBadge(){
  const badge=document.getElementById('navAvisosBadge');if(!badge)return;
  const n=notificacoesPessoais().filter(x=>!x.lida_em).length;
  badge.textContent=n?String(n):'';badge.classList.toggle('hidden',!n);
}
function renderAtivos(){
  const host=document.getElementById('listaAvisosInstitucionais');if(!host||!avisoCache)return;
  const lista=avisoCache.institutional_notices||[];
  host.innerHTML=lista.length?lista.map(x=>{const nivel=String(x.nivel||'NORMAL').toUpperCase();return `<article class="notice-board-item ${escAviso(nivel)}"><small><span class="notice-priority">${escAviso(nivel)}</span> · publicado ${escAviso(dataHoraBr(x.created_at||x.inicio_em))}${x.fim_em?` · até ${escAviso(dataHoraBr(x.fim_em))}`:''}</small><strong>${escAviso(x.titulo||'Comunicado')}</strong><p>${escAviso(x.mensagem||'')}</p>${x.criado_por_nome?`<small>Publicado por ${escAviso(x.criado_por_nome)}</small>`:''}</article>`}).join(''):'<div class="empty">Nenhum aviso institucional ativo.</div>';
}
async function carregarAvisos(){
  if(!localStorage.getItem('gcmbs.mobile.token'))return;
  try{avisoCache=await avisoCall('data');renderPessoais();renderAtivos();}catch(e){console.warn('[GCMBS] auditoria Quadro de Avisos:',e?.message||e);}
}
function ajustarFormulario(){
  const fim=document.getElementById('msgFim');if(fim&&fim.parentElement&&!fim.parentElement.querySelector('[data-gcmbs-fuso]')){const s=document.createElement('small');s.dataset.gcmbsFuso='1';s.className='muted';s.textContent=' Horário local de Brejo Santo (America/Fortaleza).';fim.parentElement.appendChild(s);}
}
async function publicarAvisoAuditado(form){
  if(avisoBusy)return;avisoBusy=true;
  const retorno=document.getElementById('msgComandoRetorno'),btn=form.querySelector('button[type="submit"]');
  if(btn)btn.disabled=true;if(retorno){retorno.className='full request-message';retorno.textContent='Publicando...';}
  try{
    const destino=document.getElementById('msgDestino')?.value||'TODOS';
    const fimRaw=document.getElementById('msgFim')?.value||'';
    const fim=fimRaw?isoFortalezaLocal(fimRaw):null;
    if(fim&&new Date(fim).getTime()<=Date.now())throw new Error('O horário de exibição final deve estar no futuro.');
    const ids=[...(document.getElementById('msgGcms')?.selectedOptions||[])].map(o=>Number(o.value)).filter(Boolean);
    const message={titulo:document.getElementById('msgTitulo')?.value||'',mensagem:document.getElementById('msgConteudo')?.value||'',nivel:document.getElementById('msgNivel')?.value||'NORMAL',fim_em:fim,destino,data_servico:document.getElementById('msgDataServico')?.value||null,guarda_ids:ids};
    const r=await avisoCall('send_message',{message});
    if(retorno){retorno.textContent=`Aviso publicado para ${r.enviadas||0} destinatário(s).`;retorno.classList.add('success');}
    const titulo=document.getElementById('msgTitulo'),conteudo=document.getElementById('msgConteudo'),fimEl=document.getElementById('msgFim'),nivel=document.getElementById('msgNivel');
    if(titulo)titulo.value='';if(conteudo)conteudo.value='';if(fimEl)fimEl.value='';if(nivel)nivel.value='NORMAL';
    await carregarAvisos();
    document.dispatchEvent(new Event('visibilitychange'));
  }catch(e){if(retorno){retorno.textContent=e.message||String(e);retorno.classList.add('error');}}
  finally{avisoBusy=false;if(btn)btn.disabled=false;}
}

document.addEventListener('submit',ev=>{
  const form=ev.target;if(!(form instanceof HTMLFormElement)||form.id!=='formMensagemComando')return;
  ev.preventDefault();ev.stopImmediatePropagation();publicarAvisoAuditado(form);
},true);
function iniciarAvisosFix(){
  ajustarFormulario();
  const filtro=document.getElementById('avisosCompetenciaFiltro');if(filtro&&!filtro.dataset.gcmbsAvisosFix){filtro.dataset.gcmbsAvisosFix='1';filtro.addEventListener('change',()=>{if(avisoCache)renderPessoais();});}
  const sec=avisoSecao();if(sec&&!sec.dataset.gcmbsAvisosFix){sec.dataset.gcmbsAvisosFix='1';new MutationObserver(()=>{if(avisoVisivel()){ajustarFormulario();carregarAvisos();}}).observe(sec,{attributes:true,attributeFilter:['class']});}
  const host=document.getElementById('listaAvisos');if(host&&!host.dataset.gcmbsAvisosObserver){host.dataset.gcmbsAvisosObserver='1';new MutationObserver(()=>{if(!avisoRendering&&avisoVisivel()&&!host.querySelector('[data-gcmbs-personal-render="1"]'))carregarAvisos();}).observe(host,{childList:true});}
  if(avisoVisivel())carregarAvisos();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciarAvisosFix,300),{once:true});else setTimeout(iniciarAvisosFix,300);
