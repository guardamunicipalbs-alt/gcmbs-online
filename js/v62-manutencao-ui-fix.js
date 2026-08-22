// GCMBS 10.0.62 — paridade segura do formulário de Manutenção de Viaturas.
// Ajusta apenas a interface Online/App; não cria, exclui ou altera registros por conta própria.

const MANUT_ENTITY_ATUAL='manutencao_viaturas';
const MANUT_ENTITY_LEGADO='manutencoes_viaturas';
const MANUT_TIPOS=[
  ['','Selecione...'],
  ['CORRETIVA','Corretiva'],
  ['PREVENTIVA','Preventiva'],
  ['REVISAO','Revisão'],
  ['OUTRA','Outra']
];
let manutScheduled=false;

function manutEditorAberto(){
  const dlg=document.getElementById('onlineEditor');
  if(!dlg?.open)return false;
  return !!document.querySelector('[data-online-field="data_manutencao"]') &&
         !!document.querySelector('[data-online-field="consertado"]');
}

function manutOcultarLegado(){
  const tabs=document.getElementById('onlineEntityTabs');
  if(!tabs)return;
  const atual=tabs.querySelector(`[data-entity-tab="${MANUT_ENTITY_ATUAL}"]`);
  const legado=tabs.querySelector(`[data-entity-tab="${MANUT_ENTITY_LEGADO}"]`);
  if(!atual&&!legado)return;
  legado?.remove();
  const visiveis=[...tabs.querySelectorAll('[data-entity-tab]')].filter(x=>!x.hidden&&x.style.display!=='none');
  tabs.classList.toggle('hidden',visiveis.length<=1);
}

function manutNormalizarTipo(v){
  const original=String(v||'').trim();
  const s=original.toUpperCase();
  if(s==='REVISÃO')return {valor:'REVISAO',historico:''};
  if(MANUT_TIPOS.some(([x])=>x===s))return {valor:s,historico:''};
  return {valor:original,historico:original};
}

function manutTrocarTipoPorSelect(){
  const atual=document.querySelector('[data-online-field="tipo_manutencao"]');
  if(!atual||atual.tagName==='SELECT')return;
  const tipo=manutNormalizarTipo(atual.value);
  const select=document.createElement('select');
  select.dataset.onlineField='tipo_manutencao';
  select.innerHTML=MANUT_TIPOS.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
  if(tipo.historico){
    const opt=document.createElement('option');opt.value=tipo.historico;opt.textContent=tipo.historico+' (valor histórico)';select.appendChild(opt);
  }
  select.value=tipo.valor;
  atual.replaceWith(select);
}

function manutRemoverStatusEditavel(){
  const status=document.querySelector('[data-online-field="status"]');
  if(!status)return;
  status.closest('label')?.remove();
}

function manutStatusInfo(consertado){
  const campos=document.getElementById('onlineCampos');
  if(!campos)return;
  let box=document.getElementById('gcmbsManutStatusInfo');
  if(!box){
    box=document.createElement('div');
    box.id='gcmbsManutStatusInfo';
    box.className='notice full';
    const retorno=document.querySelector('[data-online-field="consertado"]')?.closest('.module-editor-section');
    if(retorno)retorno.insertBefore(box,retorno.children[1]||null);
    else campos.prepend(box);
  }
  box.textContent=consertado
    ? 'Situação calculada: CONCLUÍDA. A viatura deixa o estado de manutenção conforme as regras do Desktop.'
    : 'Situação calculada: EM MANUTENÇÃO. O registro será gravado como ABERTA e a viatura ficará indisponível operacionalmente.';
}

function manutAtualizarRetorno(){
  if(!manutEditorAberto())return;
  const consertado=document.querySelector('[data-online-field="consertado"]');
  const concluida=Number(consertado?.value||0)===1;
  const data=document.querySelector('[data-online-field="data_retorno"]');
  const recebido=document.querySelector('[data-online-field="recebido_por"]');
  for(const el of [data,recebido]){
    if(!el)continue;
    el.disabled=!concluida;
    if(!concluida)el.value='';
    el.closest('label')?.classList.toggle('field-disabled',!concluida);
  }
  manutStatusInfo(concluida);
}

function manutAjustarFormulario(){
  if(!manutEditorAberto())return;
  manutTrocarTipoPorSelect();
  manutRemoverStatusEditavel();
  for(const nome of ['viatura_id','data_manutencao']){
    const el=document.querySelector(`[data-online-field="${nome}"]`);
    if(!el)continue;
    el.required=true;
    el.setAttribute('aria-required','true');
  }
  const consertado=document.querySelector('[data-online-field="consertado"]');
  if(consertado&&!consertado.dataset.gcmbsManutBound){
    consertado.dataset.gcmbsManutBound='1';
    consertado.addEventListener('change',manutAtualizarRetorno);
  }
  manutAtualizarRetorno();
}

function manutValidarFormulario(){
  if(!manutEditorAberto())return true;
  const obrigatorios=[
    ['viatura_id','Selecione a viatura.'],
    ['data_manutencao','Informe a data da manutenção.']
  ];
  for(const [nome,msg] of obrigatorios){
    const el=document.querySelector(`[data-online-field="${nome}"]`);
    if(!String(el?.value||'').trim()){
      const out=document.getElementById('onlineMsg');if(out)out.textContent=msg;
      el?.focus();return false;
    }
  }
  const data=String(document.querySelector('[data-online-field="data_manutencao"]')?.value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){
    const out=document.getElementById('onlineMsg');if(out)out.textContent='Informe uma data da manutenção válida.';
    document.querySelector('[data-online-field="data_manutencao"]')?.focus();return false;
  }
  const out=document.getElementById('onlineMsg');if(out)out.textContent='';
  return true;
}

function manutAplicar(){manutOcultarLegado();manutAjustarFormulario();}
function manutSchedule(){if(manutScheduled)return;manutScheduled=true;requestAnimationFrame(()=>{manutScheduled=false;manutAplicar();});}

function manutSetup(){
  manutAplicar();
  const tabs=document.getElementById('onlineEntityTabs');
  if(tabs)new MutationObserver(manutSchedule).observe(tabs,{childList:true,subtree:true});
  const campos=document.getElementById('onlineCampos');
  if(campos)new MutationObserver(manutSchedule).observe(campos,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-module="manutencao_viaturas"], #abrirManutencao')){
      const filtro=document.getElementById('onlineFiltro');if(filtro)filtro.value='';
    }
    const salvar=e.target?.closest?.('#onlineSalvar');
    if(salvar&&manutEditorAberto()&&!manutValidarFormulario()){
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(e.target?.closest?.('[data-module="manutencao_viaturas"], [data-entity-tab="manutencao_viaturas"], #onlineNovo'))setTimeout(manutSchedule,0);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',manutSetup,{once:true});
else manutSetup();
