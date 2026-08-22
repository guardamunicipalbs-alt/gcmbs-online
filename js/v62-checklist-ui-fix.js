// GCMBS 10.0.62 — paridade segura do Check-list de Viaturas.
// Atua somente na interface: não cria, exclui ou altera registros por conta própria.

const CHECKLIST_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const CHECKLIST_STATUS_BLOQUEADOS=new Set([
  'MANUTENCAO','MANUTENÇÃO','EM MANUTENCAO','EM MANUTENÇÃO',
  'INDISPONIVEL','INDISPONÍVEL','BAIXADA','INATIVA',
  'FORA DE SERVICO','FORA DE SERVIÇO'
]);
let checklistStatusPorId=new Map();
let checklistCarregando=false;
let checklistScheduled=false;
let checklistValidandoEnvio=false;

function checklistTelaAtiva(){
  const view=document.querySelector('[data-view="checklist"]');
  return !!view && !view.classList.contains('hidden');
}

function checklistMensagem(msg){
  const el=document.getElementById('chkMsg');
  if(el)el.textContent=msg||'';
}

function checklistStatusBloqueado(status){
  return CHECKLIST_STATUS_BLOQUEADOS.has(String(status||'ATIVA').trim().toUpperCase());
}

function checklistFiltrarSelect(){
  const select=document.getElementById('chkViatura');
  if(!select||!checklistStatusPorId.size)return;
  const atual=String(select.value||'');
  let atualBloqueada=false;
  for(const opt of [...select.options]){
    if(!opt.value)continue;
    const status=checklistStatusPorId.get(String(opt.value));
    if(status!==undefined && checklistStatusBloqueado(status)){
      if(String(opt.value)===atual)atualBloqueada=true;
      opt.remove();
    }
  }
  if(atualBloqueada){
    select.value='';
    select.dispatchEvent(new Event('change',{bubbles:true}));
    checklistMensagem('A viatura selecionada não está disponível para check-list operacional.');
  }else if(atual && [...select.options].some(opt=>String(opt.value)===atual)){
    select.value=atual;
  }
}

async function checklistCarregarStatus(){
  if(checklistCarregando)return;
  checklistCarregando=true;
  try{
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(!token)return;
    const r=await fetch(CHECKLIST_API,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({action:'references'}),
      cache:'no-store'
    });
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.message||`Erro ${r.status}`);
    checklistStatusPorId=new Map((body.viaturas||[]).map(v=>[String(v.id),String(v.status||'ATIVA')]));
    checklistFiltrarSelect();
  }catch(e){
    console.warn('[GCMBS][CHECKLIST] Não foi possível validar disponibilidade das viaturas:',e?.message||e);
  }finally{
    checklistCarregando=false;
  }
}

function checklistAgendar(){
  if(checklistScheduled)return;
  checklistScheduled=true;
  requestAnimationFrame(()=>{
    checklistScheduled=false;
    checklistFiltrarSelect();
  });
}

async function checklistValidarEnvio(e){
  const form=e.target?.closest?.('#chkForm');
  if(!form||checklistValidandoEnvio)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  checklistValidandoEnvio=true;
  try{
    await checklistCarregarStatus();
    const select=document.getElementById('chkViatura');
    const id=String(select?.value||'');
    const status=checklistStatusPorId.get(id);
    if(id && status!==undefined && checklistStatusBloqueado(status)){
      select.value='';
      select.dispatchEvent(new Event('change',{bubbles:true}));
      checklistMensagem('Esta viatura está em manutenção/indisponível e não pode receber check-list operacional.');
      return;
    }
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }finally{
    checklistValidandoEnvio=false;
  }
}

function checklistSetup(){
  const select=document.getElementById('chkViatura');
  if(select)new MutationObserver(checklistAgendar).observe(select,{childList:true});
  document.addEventListener('submit',checklistValidarEnvio,true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-module="checklist_viaturas"],#chkNovo,#abrirChecklist')){
      setTimeout(()=>{if(checklistTelaAtiva())checklistCarregarStatus();},0);
    }
  },true);
  if(checklistTelaAtiva())checklistCarregarStatus();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',checklistSetup,{once:true});
else checklistSetup();
