// GCMBS 10.0.62 — paridade segura do formulário de Abastecimento.
// Não cria valores automaticamente e não altera/apaga histórico do banco.

const ABAST_ENTITY_ATUAL='abastecimento_viaturas';
const ABAST_ENTITY_LEGADO='abastecimentos_viaturas';
let abastScheduled=false;

function abastEditorAberto(){
  const dlg=document.getElementById('onlineEditor');
  if(!dlg?.open)return false;
  return !!document.querySelector('[data-online-field="data_abastecimento"]') &&
         !!document.querySelector('[data-online-field="litros"]') &&
         !!document.querySelector('[data-online-field="motorista_id"]');
}

function abastOcultarLegado(){
  const tabs=document.getElementById('onlineEntityTabs');
  if(!tabs)return;
  const atual=tabs.querySelector(`[data-entity-tab="${ABAST_ENTITY_ATUAL}"]`);
  const legado=tabs.querySelector(`[data-entity-tab="${ABAST_ENTITY_LEGADO}"]`);
  if(!atual&&!legado)return;
  legado?.remove();
  const visiveis=[...tabs.querySelectorAll('[data-entity-tab]')].filter(x=>!x.hidden&&x.style.display!=='none');
  tabs.classList.toggle('hidden',visiveis.length<=1);
}

function abastAjustarFormulario(){
  if(!abastEditorAberto())return;
  const obrigatorios=['viatura_id','data_abastecimento','litros','motorista_id'];
  for(const nome of obrigatorios){
    const el=document.querySelector(`[data-online-field="${nome}"]`);
    if(!el)continue;
    el.required=true;
    el.setAttribute('aria-required','true');
  }
  const litros=document.querySelector('[data-online-field="litros"]');
  if(litros){litros.inputMode='decimal';litros.step=litros.step||'any';}
}

function abastValidarFormulario(){
  if(!abastEditorAberto())return true;
  const campos=[
    ['viatura_id','Selecione a viatura.'],
    ['data_abastecimento','Informe a data do abastecimento.'],
    ['litros','Informe a quantidade de litros.'],
    ['motorista_id','Selecione o motorista.']
  ];
  for(const [nome,msg] of campos){
    const el=document.querySelector(`[data-online-field="${nome}"]`);
    const v=String(el?.value??'').trim();
    if(!v){
      const out=document.getElementById('onlineMsg');if(out)out.textContent=msg;
      el?.focus();return false;
    }
    if(nome==='litros'&&!Number.isFinite(Number(v))){
      const out=document.getElementById('onlineMsg');if(out)out.textContent='Informe uma quantidade de litros válida.';
      el?.focus();return false;
    }
  }
  const data=String(document.querySelector('[data-online-field="data_abastecimento"]')?.value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){
    const out=document.getElementById('onlineMsg');if(out)out.textContent='Informe uma data de abastecimento válida.';
    document.querySelector('[data-online-field="data_abastecimento"]')?.focus();return false;
  }
  const out=document.getElementById('onlineMsg');if(out)out.textContent='';
  return true;
}

function abastAplicar(){abastOcultarLegado();abastAjustarFormulario();}
function abastSchedule(){if(abastScheduled)return;abastScheduled=true;requestAnimationFrame(()=>{abastScheduled=false;abastAplicar();});}

function abastSetup(){
  abastAplicar();
  const tabs=document.getElementById('onlineEntityTabs');
  if(tabs)new MutationObserver(abastSchedule).observe(tabs,{childList:true,subtree:true});
  const campos=document.getElementById('onlineCampos');
  if(campos)new MutationObserver(abastSchedule).observe(campos,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const salvar=e.target?.closest?.('#onlineSalvar');
    if(salvar&&abastEditorAberto()&&!abastValidarFormulario()){
      e.preventDefault();e.stopImmediatePropagation();
      return;
    }
    if(e.target?.closest?.('[data-module="abastecimento_viaturas"], [data-entity-tab="abastecimento_viaturas"], #onlineNovo'))setTimeout(abastSchedule,0);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',abastSetup,{once:true});
else abastSetup();
