// GCMBS 10.0.62 — auditoria de Imagens da GCM.
// A tabela imagens_gcm guarda um caminho físico do Desktop. No Online/App esse
// caminho é apenas metadado técnico; a imagem utilizável chega por mobile_branding.
// Não habilitamos escrita genérica porque adicionar/remover imagem exige também
// criar/remover o arquivo físico no Desktop, além de manter principal/finalidade.
const IMG_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const escImg=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finalidadeNome={
  ICONE_APP:'Ícone do aplicativo',
  TELA_LOGIN:'Imagem da tela de login',
  LOGOMARCA:'Logomarca institucional',
  ESCUDO_GCM:'Escudo da GCM',
  BRASAO:'Brasão institucional',
  OUTRA:'Outra imagem institucional'
};
let imgBusy=false,imgCache=null;

async function imgCall(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(IMG_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function emImagensGcm(){return String(document.getElementById('onlineModuloTitulo')?.textContent||'').trim()==='Imagens da GCM';}
function fmtFinalidade(v){const k=String(v||'OUTRA').toUpperCase();return finalidadeNome[k]||String(v||'Imagem institucional').replace(/_/g,' ');}
function statusTexto(v){return Number(v)===0?'Inativa':'Ativa';}
function principalTexto(v){return Number(v)===1?'Principal':'Cadastrada';}
function tipoTexto(v){const t=String(v||'').toLowerCase();if(t==='image/png')return'PNG';if(t==='image/jpeg'||t==='image/jpg')return'JPEG';return v||'Imagem';}

async function carregarImagens(){
  const [r,b]=await Promise.all([
    imgCall('entity_list',{entity:'imagens_gcm',limit:500,offset:0}),
    imgCall('branding').catch(()=>({branding:[]}))
  ]);
  return {records:r.records||[],catalog:r.catalog||{},branding:b.branding||[]};
}
function acharPreview(d){
  const f=String(d.finalidade||'').toUpperCase();
  return (imgCache?.branding||[]).find(x=>String(x.finalidade||'').toUpperCase()===f && String(x.nome||'')===String(d.nome||''))
    ||(imgCache?.branding||[]).find(x=>String(x.finalidade||'').toUpperCase()===f)
    ||(Number(d.principal)===1?(imgCache?.branding||[]).find(x=>x.principal):null)
    ||null;
}
function renderImagemCard(r){
  const d=r.data||{},prev=acharPreview(d),src=prev?.data_url||'';
  return `<article class="card gcmbs-image-card" style="margin:0;display:grid;grid-template-columns:minmax(180px,260px) 1fr;gap:20px;align-items:start">
    <div style="min-height:190px;border:1px solid #d9e2ef;border-radius:14px;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden">
      ${src?`<img src="${escImg(src)}" alt="${escImg(d.nome||'Imagem da GCM')}" style="display:block;max-width:100%;max-height:240px;object-fit:contain">`:'<span class="muted">Pré-visualização não publicada para este registro.</span>'}
    </div>
    <div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><h3 style="margin:0">${escImg(d.nome||'Imagem da GCM')}</h3><span class="badge">${escImg(principalTexto(d.principal))}</span>${Number(d.ativo)===0?'<span class="badge">INATIVA</span>':''}</div>
      <div class="online-kv" style="grid-template-columns:minmax(130px,180px) 1fr">
        <b>Finalidade</b><span>${escImg(fmtFinalidade(d.finalidade))}</span>
        <b>Arquivo</b><span>${escImg(d.arquivo_nome||prev?.arquivo_nome||'—')}</span>
        <b>Formato</b><span>${escImg(tipoTexto(d.arquivo_tipo||prev?.arquivo_tipo))}</span>
        <b>Situação</b><span>${escImg(statusTexto(d.ativo))}</span>
        <b>Uso atual</b><span>${Number(d.principal)===1?'Imagem principal desta finalidade':'Imagem cadastrada'}</span>
      </div>
      <p class="muted" style="margin:14px 0 0">O arquivo visual é sincronizado pelo Desktop e distribuído ao Online/App. O caminho físico do Windows não é exibido porque não é utilizável fora do computador onde o Desktop está instalado.</p>
    </div>
  </article>`;
}
function ajustarCabecalho(){
  const desc=document.getElementById('onlineModuloDescricao');if(desc)desc.textContent='Identidade visual institucional sincronizada entre Desktop, Online e aplicativo Android.';
  const d=document.getElementById('onlineDescricao');if(d)d.textContent='Pré-visualização das imagens realmente publicadas pelo Desktop para uso no sistema.';
  const f=document.getElementById('onlineFiltro');if(f){f.value='';f.style.display='none';}
  const total=document.getElementById('onlineTotal');if(total)total.textContent=String(imgCache?.records?.length||0);
  const filtrados=document.getElementById('onlineFiltrados');if(filtrados)filtrados.textContent='Identidade visual sincronizada';
  const novo=document.getElementById('onlineNovo');if(novo)novo.classList.add('hidden');
}
function renderImagens(){
  const host=document.getElementById('onlineRegistros');if(!host||!imgCache)return;
  const regs=imgCache.records||[];
  host.innerHTML=`<div style="display:grid;gap:14px">${regs.map(renderImagemCard).join('')||'<div class="empty">Nenhuma imagem institucional sincronizada.</div>'}
    <section class="card" style="margin:0">
      <div class="notice"><strong>Cadastro de arquivo protegido</strong>Inclusão, remoção e troca de imagem principal continuam sendo executadas pelo fluxo próprio do Desktop nesta etapa. A réplica Online está deliberadamente somente para visualização, pois uma gravação genérica alteraria a tabela sem criar/remover o arquivo físico correspondente no Desktop.</div>
    </section>
  </div>`;
  host.dataset.gcmbsImagesReady='1';
}
function restaurarFora(){const f=document.getElementById('onlineFiltro');if(f&&f.style.display==='none')f.style.display='';}
async function aplicarImagens(){
  if(!emImagensGcm()){restaurarFora();return;}
  if(imgBusy)return;imgBusy=true;
  try{
    imgCache=await carregarImagens();
    ajustarCabecalho();renderImagens();
  }catch(e){
    const host=document.getElementById('onlineRegistros');
    if(host)host.innerHTML=`<div class="empty">${escImg(e.message||e)}</div>`;
  }finally{imgBusy=false;}
}
let imgScheduled=false;
function imgSchedule(){if(imgScheduled)return;imgScheduled=true;setTimeout(()=>{imgScheduled=false;aplicarImagens();},0);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',imgSchedule,{once:true});else imgSchedule();
new MutationObserver(imgSchedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
