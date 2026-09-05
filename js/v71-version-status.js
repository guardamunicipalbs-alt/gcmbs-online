// GCMBS 10.0.71 HF12 — status de versão sem confundir Online com APK publicado.
const GCMBS_V71_VERSION_URL='https://guardamunicipalbs-alt.github.io/gcmbs-online/downloads/version.json';
let gcmbsV71PublishedVersion='10.0.70';

async function gcmbsV71ReadPublishedVersion(){
  try{
    const r=await fetch(GCMBS_V71_VERSION_URL+'?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('versão indisponível');
    const v=await r.json();
    gcmbsV71PublishedVersion=String(v.version||v.versionCode||'10.0.70');
    return v;
  }catch{return {version:gcmbsV71PublishedVersion,versionCode:0};}
}
function gcmbsV71PaintVersion(v=gcmbsV71PublishedVersion){
  const label=document.getElementById('onlineVersao');
  if(label)label.textContent=`Online 10.0.71 · Android publicado ${v}`;
  const card=document.getElementById('appAtualizacaoCard');
  if(card){
    const p=card.querySelector('p.muted');
    if(p)p.innerHTML=`Online: <b>10.0.71</b> · APK Android publicado: <b>${String(v).replace(/[&<>"']/g,'')}</b>.`;
  }
}
async function gcmbsV71RefreshVersionStatus(ev){
  if(ev){ev.preventDefault();ev.stopImmediatePropagation();}
  const out=document.getElementById('statusAtualizacaoApp');
  if(out)out.textContent='Consultando a versão Android realmente publicada...';
  const v=await gcmbsV71ReadPublishedVersion();
  gcmbsV71PaintVersion(v.version||gcmbsV71PublishedVersion);
  if(out){
    const code=Number(v.versionCode||0);
    out.innerHTML=code>=71
      ?`APK Android <b>${v.version}</b> publicado e alinhado ao Online 10.0.71.`
      :`Online em <b>10.0.71</b>. APK Android publicado ainda em <b>${v.version||'10.0.70'}</b>; a atualização 10.0.71 só será anunciada após compilação e assinatura reais.`;
  }
}
function gcmbsV71VersionBoot(){
  const btn=document.getElementById('verificarAtualizacaoApp');
  if(btn&&!btn.dataset.v71VersionBound){btn.dataset.v71VersionBound='1';btn.addEventListener('click',gcmbsV71RefreshVersionStatus,true);}
  gcmbsV71RefreshVersionStatus().catch(()=>{});
  let pending=false;
  new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;gcmbsV71PaintVersion();});}).observe(document.documentElement,{childList:true,subtree:true});
  console.info('[GCMBS] status Online 10.0.71 / Android publicado ativo');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gcmbsV71VersionBoot,{once:true});else gcmbsV71VersionBoot();
