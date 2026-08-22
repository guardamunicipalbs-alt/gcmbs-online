// GCMBS 10.0.62 — auditoria do Meu Perfil.
// - O historico do perfil pertence somente ao usuario autenticado, mesmo para o Comando.
// - O bloco Android respeita downloads/version.json.available antes de oferecer atualizacao.
// - A identificacao do perfil exibe nome funcional e cargo quando disponiveis.
const PERFIL_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const PERFIL_VERSION_CODE=62;
const PERFIL_VERSION='10.0.62';
const escPerfil=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let perfilBusy=false,perfilRendering=false;

async function perfilCall(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(PERFIL_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function perfilSecao(){return document.querySelector('[data-view="perfil"]');}
function perfilVisivel(){const s=perfilSecao();return !!s&&!s.classList.contains('hidden');}
function dataPerfil(v){
  const d=new Date(v||'');
  if(Number.isNaN(d.getTime())){const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('/'):s;}
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza'}).format(d);
}
function rotuloTipo(tipo){
  const t=String(tipo||'').toUpperCase();
  if(t==='PERMUTA')return 'PERMUTA';
  if(t==='BANCO_HORAS_CORRECAO')return 'BANCO DE HORAS';
  return t.replaceAll('_',' ');
}
function normalizarStatus(v){
  const s=String(v||'PENDENTE').toUpperCase();
  if(['NEGADA','RECUSADA'].includes(s))return 'REPROVADA';
  if(s==='PENDENTE_DESKTOP')return 'PENDENTE';
  return s;
}
function renderIdentidade(session){
  const sec=perfilSecao();if(!sec)return;
  const card=sec.querySelector('.card');if(!card)return;
  const nome=String(session?.nome||'').trim(),cargo=String(session?.cargo||'').trim(),usuario=String(session?.usuario||session?.username||'').trim(),role=String(session?.role||session?.perfil||'gcm').trim();
  perfilRendering=true;
  card.innerHTML=`<h2>Meu perfil</h2>${nome?`<p><b>Nome:</b> ${escPerfil(nome)}</p>`:''}${cargo?`<p><b>Cargo:</b> ${escPerfil(cargo)}</p>`:''}<p><b>Usuário:</b> <span id="perfilUsuario">${escPerfil(usuario)}</span></p><p><b>Perfil:</b> <span id="perfilRole">${escPerfil(role)}</span></p>`;
  setTimeout(()=>{perfilRendering=false;},0);
}
function renderSolicitacoesPessoais(session,data){
  const host=document.getElementById('listaSolicitacoes');if(!host)return;
  const gid=Number(session?.guarda_id||0);
  const permitidos=new Set(['PERMUTA','BANCO_HORAS_CORRECAO']);
  const lista=(data?.action_requests||[])
    .filter(x=>Number(x.guarda_id)===gid)
    .filter(x=>permitidos.has(String(x.tipo||'').toUpperCase()))
    .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  perfilRendering=true;
  host.innerHTML=lista.length?lista.map(x=>`<div class="item" data-gcmbs-perfil-request="1"><small>${escPerfil(dataPerfil(x.created_at))} · ${escPerfil(rotuloTipo(x.tipo))}</small><strong>${escPerfil(normalizarStatus(x.status))}</strong><span>${escPerfil(x.resposta||'Aguardando processamento pelo Desktop.')}</span></div>`).join(''):'<div class="empty" data-gcmbs-perfil-request="1">Nenhuma solicitação pessoal enviada pelo aplicativo.</div>';
  setTimeout(()=>{perfilRendering=false;},0);
}
async function consultarVersaoPublicada(){
  const r=await fetch(`downloads/version.json?ts=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)throw new Error('Informação de atualização ainda não publicada.');
  return r.json();
}
function aplicarEstadoAndroid(v){
  const card=document.getElementById('appAtualizacaoCard');if(!card)return;
  const link=card.querySelector('a.primary, a.secondary');
  const status=document.getElementById('statusAtualizacaoApp');
  const code=Number(v?.versionCode||0),version=String(v?.version||code||'').trim(),disponivel=v?.available===true;
  if(link){
    link.href='instalar.html';
    if(disponivel){link.textContent=code>PERFIL_VERSION_CODE?`Baixar / atualizar para ${version}`:'Baixar / atualizar app';link.classList.add('primary');link.classList.remove('secondary');link.removeAttribute('aria-disabled');}
    else{link.textContent='Ver situação do app Android';link.classList.remove('primary');link.classList.add('secondary');link.setAttribute('aria-disabled','false');}
  }
  if(status){
    if(!disponivel){status.textContent=`Versão ${version||PERFIL_VERSION} cadastrada, mas o APK ainda não foi publicado para instalação.`;return;}
    if(code>PERFIL_VERSION_CODE)status.textContent=`Nova versão ${version} disponível para instalação.`;
    else if(code===PERFIL_VERSION_CODE)status.textContent=`APK ${version||PERFIL_VERSION} publicado e disponível.`;
    else status.textContent=`Este pacote é ${PERFIL_VERSION}; a página de instalação informa ${version||'uma versão anterior'}.`;
  }
}
async function atualizarAndroid(){
  try{aplicarEstadoAndroid(await consultarVersaoPublicada());}
  catch(e){const s=document.getElementById('statusAtualizacaoApp');if(s)s.textContent=e?.message||'Não foi possível verificar a publicação do aplicativo.';}
}
async function carregarPerfilAuditado(){
  if(perfilBusy||!localStorage.getItem('gcmbs.mobile.token'))return;
  perfilBusy=true;
  try{
    const [ss,dd]=await Promise.all([perfilCall('session'),perfilCall('data')]);
    const session=ss?.session||{};
    renderIdentidade(session);
    renderSolicitacoesPessoais(session,dd||{});
    await atualizarAndroid();
  }catch(e){console.warn('[GCMBS] auditoria Meu Perfil:',e?.message||e);}
  finally{perfilBusy=false;}
}

document.addEventListener('click',ev=>{
  const b=ev.target instanceof Element?ev.target.closest('#verificarAtualizacaoApp'):null;
  if(!b)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const s=document.getElementById('statusAtualizacaoApp');if(s)s.textContent='Verificando versão publicada...';
  atualizarAndroid();
},true);
function iniciarPerfilFix(){
  const sec=perfilSecao();if(!sec)return;
  if(!sec.dataset.gcmbsPerfilFix){
    sec.dataset.gcmbsPerfilFix='1';
    new MutationObserver(()=>{if(perfilVisivel())carregarPerfilAuditado();}).observe(sec,{attributes:true,attributeFilter:['class']});
  }
  const host=document.getElementById('listaSolicitacoes');
  if(host&&!host.dataset.gcmbsPerfilObserver){
    host.dataset.gcmbsPerfilObserver='1';
    new MutationObserver(()=>{if(!perfilRendering&&perfilVisivel()&&!host.querySelector('[data-gcmbs-perfil-request="1"]'))carregarPerfilAuditado();}).observe(host,{childList:true});
  }
  if(perfilVisivel())carregarPerfilAuditado();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciarPerfilFix,300),{once:true});else setTimeout(iniciarPerfilFix,300);
