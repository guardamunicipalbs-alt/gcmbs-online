// GCMBS 10.0.68 - HF10 R18
// Frota: estado operacional derivado de manutencoes abertas + sincronizacao manual consolidada.
// Nao altera registros; somente ajusta disponibilidade/apresentacao e usa as rotas oficiais existentes.
const R18_FLEET='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const R18_SYNC='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const R18_QUADRO='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
let r18Fleet=null,r18FleetTs=0,r18Loading=false,r18Frame=0;

const r18Token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
const r18Fmt=v=>{const m=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
async function r18Post(url,body){
  const token=r18Token();if(!token)throw new Error('Faça login antes de continuar.');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(body),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
async function r18LoadFleet(force=false){
  if(!force&&r18Fleet&&Date.now()-r18FleetTs<30000)return r18Fleet;
  if(r18Loading)return r18Fleet;
  r18Loading=true;
  try{r18Fleet=await r18Post(R18_FLEET,{action:'fleet_state'});r18FleetTs=Date.now();return r18Fleet;}
  finally{r18Loading=false;}
}
function r18Map(){return new Map((r18Fleet?.vehicles||[]).map(v=>[String(v.id),v]));}
function r18Titulo(){return String(document.getElementById('onlineTitulo')?.textContent||document.getElementById('onlineEditorTitulo')?.textContent||'').trim();}
function r18PatchOption(opt,v,bloquear){
  if(!opt||!v)return;
  if(!Object.prototype.hasOwnProperty.call(opt.dataset,'r18Original'))opt.dataset.r18Original=opt.textContent||'';
  const active=!!v.em_manutencao,desired=active?`${opt.dataset.r18Original} · EM MANUTENÇÃO`:opt.dataset.r18Original;
  if(opt.textContent!==desired)opt.textContent=desired;
  if(active&&bloquear&&!opt.selected){if(!opt.disabled)opt.disabled=true;opt.dataset.r18Disabled='1';}
  else if(opt.dataset.r18Disabled==='1'){if(opt.disabled)opt.disabled=false;delete opt.dataset.r18Disabled;}
}
function r18PatchSelects(){
  if(!r18Fleet)return;
  const map=r18Map(),titulo=r18Titulo().toUpperCase(),manutencao=/MANUTENÇÃO|MANUTENCAO/.test(titulo);
  document.querySelectorAll('select[data-online-field="viatura_id"]').forEach(sel=>{
    for(const opt of sel.options){const v=map.get(String(opt.value));if(v)r18PatchOption(opt,v,!manutencao);}
  });
  const chk=document.getElementById('chkViatura');
  if(chk)for(const opt of chk.options){const v=map.get(String(opt.value));if(v)r18PatchOption(opt,v,true);}
}
function r18BadgeCard(card,text){
  if(!card)return;
  let el=card.querySelector('[data-hf10-r18-maint]');
  if(!el){el=document.createElement('div');el.dataset.hf10R18Maint='1';el.className='record-warning';card.appendChild(el);}
  if(el.textContent!==text)el.textContent=text;
}
function r18PatchCards(){
  if(!r18Fleet)return;
  const titulo=String(document.getElementById('onlineTitulo')?.textContent||'').trim();
  if(/^Cadastro de Viaturas$/i.test(titulo)){
    const byKey=new Map((r18Fleet.vehicles||[]).map(v=>[String(v.record_key||v.id),v]));
    document.querySelectorAll('#onlineRegistros [data-online-key]').forEach(card=>{
      const old=card.querySelector('[data-hf10-r18-maint]');
      const v=byKey.get(String(card.dataset.onlineKey||''));
      if(v?.em_manutencao){const m=v.manutencao||{};r18BadgeCard(card,`🔧 EM MANUTENÇÃO${m.data_manutencao?' desde '+r18Fmt(m.data_manutencao):''}${m.descricao?' · '+m.descricao:''}`);}
      else old?.remove();
    });
  }else if(/^Manutenção de Viaturas$/i.test(titulo)){
    const ativos=new Map((r18Fleet.vehicles||[]).filter(v=>v.em_manutencao&&v.manutencao?.record_key).map(v=>[String(v.manutencao.record_key),v]));
    document.querySelectorAll('#onlineRegistros [data-online-key]').forEach(card=>{
      const old=card.querySelector('[data-hf10-r18-maint]'),v=ativos.get(String(card.dataset.onlineKey||''));
      if(v)r18BadgeCard(card,`🔧 EM MANUTENÇÃO · ${v.prefixo||v.placa||'Viatura'}`);else old?.remove();
    });
  }
}
function r18PatchSyncVersion(){
  const e=document.getElementById('syncStatus');
  if(e&&/10\.0\.(?:62|68|69)/.test(String(e.title||'')))e.title=String(e.title).replace(/10\.0\.(?:62|68|69)/g,'10.0.85');
}
async function r18AtualizarBadge(){
  const e=document.getElementById('syncStatus');if(!e||!r18Token())return;
  try{
    const b=await r18Post(R18_QUADRO,{action:'sync_status'}),s=b.sincronizacao||{};
    const text=`Última sincronização Desktop ↔ Online/App: ${s.ultima_sincronizacao?new Date(s.ultima_sincronizacao).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}):'não registrada'}${s.desktop_version?' · Desktop '+s.desktop_version:''}`;
    const title=`Pendentes: ${Number(s.pendentes||0)} · Erros recentes: ${Number(s.erros_recentes||0)} · GCMBS Online/App 10.0.85`;
    if(e.textContent!==text)e.textContent=text;if(e.title!==title)e.title=title;
    e.style.color=Number(s.erros_recentes||0)?'#fecaca':Number(s.pendentes||0)?'#fde68a':'#bbf7d0';
  }catch{}
}
async function r18SolicitarSync(btn){
  const old=btn.textContent;btn.disabled=true;btn.textContent='Solicitando...';
  try{
    const r=await r18Post(R18_SYNC,{action:'request_sync'});
    btn.textContent='Solicitação enviada';
    alert(r.message||'Sincronização solicitada ao Desktop.');
    await r18AtualizarBadge();window.dispatchEvent(new Event('gcmbs:v110-refresh'));
    setTimeout(()=>{document.getElementById('quadroData')?.dispatchEvent(new Event('change',{bubbles:true}));r18AtualizarBadge();window.dispatchEvent(new Event('gcmbs:v110-refresh'));btn.textContent=old;btn.disabled=false;},5000);
  }catch(e){alert('Não foi possível solicitar a sincronização: '+(e?.message||e));btn.textContent=old;btn.disabled=false;}
}
function r18BindSync(){
  const canonical=document.getElementById('syncAgoraOnline'),legacy=document.getElementById('onlineSyncNow');
  if(canonical&&legacy)legacy.remove();
  if(canonical&&!canonical.dataset.r18Bound){canonical.dataset.r18Bound='1';canonical.dataset.gcmbsV110Bound='1';canonical.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();r18SolicitarSync(canonical);},true);}
  r18PatchSyncVersion();
  const status=document.getElementById('syncStatus');
  if(status&&!status.dataset.r18Observed){status.dataset.r18Observed='1';new MutationObserver(r18PatchSyncVersion).observe(status,{attributes:true,attributeFilter:['title'],childList:true});}
}
function r18Apply(){r18PatchSelects();r18PatchCards();r18BindSync();}
function r18Schedule(){if(r18Frame)return;r18Frame=requestAnimationFrame(()=>{r18Frame=0;r18Apply();});}
async function r18Refresh(force=false){
  if(!r18Token())return;
  try{await r18LoadFleet(force);r18Apply();}
  catch(e){if(!/permissão|permissao/i.test(String(e?.message||'')))console.warn('[GCMBS] HF10 R18 Frota:',e?.message||e);}
}
const r18Obs=new MutationObserver(r18Schedule);
function r18Init(){
  r18Obs.observe(document.body,{childList:true,subtree:true});
  r18BindSync();r18Refresh(true);
}
document.addEventListener('click',e=>{
  if(e.target.closest?.('#onlineSalvar')&&/MANUTENÇÃO|MANUTENCAO/i.test(r18Titulo()))setTimeout(()=>r18Refresh(true),1000);
  if(e.target.closest?.('#mainNav,[data-online-edit],#onlineNovo,#chkNovo'))setTimeout(()=>r18Refresh(false),120);
},true);
window.addEventListener('pageshow',()=>setTimeout(()=>r18Refresh(true),100));
setInterval(()=>{r18BindSync();r18Refresh(true);},60000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r18Init,{once:true});else r18Init();
console.info('[GCMBS] HF10 R18 Frota/Manutenção e sincronização consolidada ativos');
