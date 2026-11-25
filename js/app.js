import './communication-workflows-v74.js?v=100420-r2';

// GCMBS V293 - economia de invocações Edge Functions.
// Mantém ações manuais/imediatas, mas alonga apenas os dois timers automáticos conhecidos
// (atualização global e frequência) de 60 segundos para 30 minutos.
// Temporizadores especificos sao configurados diretamente em cada modulo.
await import('./app-core.js?v=100420-r2');

// Hotfix visual 10.0.62: datas visiveis em dd/mm/aaaa, preservando ISO em inputs/API.
const GCMBS_ISO_DATE_TEST=/\b\d{4}-\d{2}-\d{2}\b/;
const GCMBS_ISO_DATE_RE=/\b(\d{4})-(\d{2})-(\d{2})\b/g;
function gcmbsFormatarDatasTexto(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;if(!p)return NodeFilter.FILTER_REJECT;
    if(['SCRIPT','STYLE','TEXTAREA','CODE','PRE','INPUT','SELECT'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
    return GCMBS_ISO_DATE_TEST.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes)node.nodeValue=(node.nodeValue||'').replace(GCMBS_ISO_DATE_RE,'$3/$2/$1');
}
const gcmbsEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
function gcmbsDataAtual(){return new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});}
function gcmbsDataIsoTexto(v){const s=String(v||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';}
function gcmbsDataBr(v){const iso=gcmbsDataIsoTexto(v);if(!iso)return String(v||'');const [a,m,d]=iso.split('-');return `${d}/${m}/${a}`;}
function gcmbsCompetenciaAtual(){return gcmbsDataAtual().slice(0,7);}
function gcmbsRotuloCompetencia(c){const m=String(c||'').match(/^(\d{4})-(\d{2})$/);if(!m)return c||'';return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(`${m[1]}-${m[2]}-01T12:00:00`));}
function gcmbsValorCampoCard(card,rotulos){const labels=[...(card?.querySelectorAll('.online-kv b')||[])];for(const b of labels){const nome=String(b.textContent||'').trim().toLowerCase();if(rotulos.some(r=>nome===r))return String(b.nextElementSibling?.textContent||'').trim();}return '';}

// Ofícios: somente a competência escolhida, em ordem decrescente da data da demanda.
let gcmbsOficiosCompetenciaSelecionada='';
function gcmbsAjustarOficios(){
  const titulo=document.getElementById('onlineTitulo'),filtro=document.getElementById('onlineFiltro');
  const wrapExistente=document.getElementById('gcmbsOficiosCompetenciaWrap');
  if(String(titulo?.textContent||'').trim()!=='Ofícios'){if(wrapExistente)wrapExistente.remove();return;}
  if(!filtro)return;
  if(!gcmbsOficiosCompetenciaSelecionada)gcmbsOficiosCompetenciaSelecionada=gcmbsCompetenciaAtual();
  let wrap=wrapExistente;
  if(!wrap){
    wrap=document.createElement('div');wrap.id='gcmbsOficiosCompetenciaWrap';wrap.className='form-grid';wrap.style.marginBottom='12px';
    wrap.innerHTML=`<label>Competência<input id="gcmbsOficiosCompetencia" type="month" value="${gcmbsOficiosCompetenciaSelecionada}"></label>`;
    filtro.parentElement?.insertBefore(wrap,filtro);
    wrap.querySelector('#gcmbsOficiosCompetencia')?.addEventListener('change',e=>{gcmbsOficiosCompetenciaSelecionada=e.target.value||gcmbsCompetenciaAtual();gcmbsAjustarOficios();});
  }
  const input=wrap.querySelector('#gcmbsOficiosCompetencia');if(input&&input.value!==gcmbsOficiosCompetenciaSelecionada)input.value=gcmbsOficiosCompetenciaSelecionada;
  const host=document.getElementById('onlineRegistros');if(!host)return;
  const cards=[...host.querySelectorAll('[data-online-key]')],competencia=gcmbsOficiosCompetenciaSelecionada;
  const info=cards.map((card,idx)=>{const demanda=gcmbsDataIsoTexto(gcmbsValorCampoCard(card,['data da demanda']));const recebimento=gcmbsDataIsoTexto(gcmbsValorCampoCard(card,['data de recebimento','data do recebimento']));const dataRef=demanda||recebimento;const numero=gcmbsValorCampoCard(card,['número do ofício','numero do ofício']);const dentro=dataRef.slice(0,7)===competencia;card.style.display=dentro?'':'none';return{card,idx,dentro,dataRef,recebimento,numero};});
  const visiveis=info.filter(x=>x.dentro).sort((a,b)=>b.dataRef.localeCompare(a.dataRef)||b.recebimento.localeCompare(a.recebimento)||b.numero.localeCompare(a.numero,'pt-BR',{numeric:true})||a.idx-b.idx);
  for(const x of visiveis)host.appendChild(x.card);
  const total=document.getElementById('onlineTotal');if(total)total.textContent=String(visiveis.length);
  const filtrados=document.getElementById('onlineFiltrados');if(filtrados){const q=String(filtro.value||'').trim();filtrados.textContent=`${visiveis.length} ${q?'encontrado(s)':'registro(s)'} · ${gcmbsRotuloCompetencia(competencia)}`;}
}

let gcmbsUiScheduled=false;
function gcmbsAgendarAjustesVisuais(){if(gcmbsUiScheduled)return;gcmbsUiScheduled=true;queueMicrotask(()=>{gcmbsUiScheduled=false;gcmbsFormatarDatasTexto(document.body);gcmbsAjustarOficios();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gcmbsAgendarAjustesVisuais,{once:true});else gcmbsAgendarAjustesVisuais();
new MutationObserver(gcmbsAgendarAjustesVisuais).observe(document.documentElement,{childList:true,subtree:true,characterData:true});

// Auditoria visual 22/08/2026: impede exposição de valores e rótulos técnicos do banco na UI.
// Atua apenas na camada de apresentação; não altera payloads, inputs, selects ou dados persistidos.
const GCMBS_ROTULOS_UI=new Map([
  ['rg','RG'],['cnh','CNH'],['autorizado viatura','Autorizado a dirigir viatura'],['autorizado motocicleta','Autorizado a conduzir motocicleta'],
  ['disponivel escala','Disponível para escala'],['pode noite','Pode trabalhar à noite'],['pode 24h','Pode cumprir serviço de 24h'],
  ['tipo escala id','Tipo de Escala'],['turno inicio','Turno inicial'],['funcionamento 24h','Funcionamento 24h'],
  ['valor 50','Valor da hora 50%'],['valor 100','Valor da hora 100%'],['max horas','Máximo de horas'],
  ['participa gerador','Participa do gerador'],['exige viatura','Exige viatura'],['exige motorista','Exige motorista']
]);
const GCMBS_BOOLEANOS_UI=new Set([
  'autorizado a dirigir viatura','autorizado a conduzir motocicleta','disponível para escala','pode trabalhar à noite','pode cumprir serviço de 24h',
  'ativo','ativa','participa do gerador','funcionamento 24h','exige viatura','exige motorista'
]);
const GCMBS_MODULOS_UI=new Map([
  ['dashboard','Quadro Operacional'],['guardas','Cadastro de Guardas'],['equipes','Equipes'],['postos','Postos Operacionais'],['tipos_escalas','Tipos de Escalas'],
  ['escala_extra','Escala Extra'],['escalas_extras_manuais','Escala Extra Manual'],['feriados','Feriados'],['justificativas_faltas','Justificativa de Faltas'],

  ['banco_horas','Banco de Horas'],['relatorios','Relatórios'],['viaturas','Cadastro de Viaturas'],['permutas','Permutas'],['abastecimento','Abastecimento'],
  ['manutencao_viaturas','Manutenção de Viaturas'],['checklist','Check-list de Viaturas'],['relatorios_frota','Relatórios da Frota'],['ocorrencias','Ocorrências / Produção'],
  ['ocorrencias_operacionais','Ocorrências / Produção'],['equipamentos','Equipamentos e Cautelas'],['oficios','Ofícios'],
  ['controle_acesso','Controle de Acesso']
]);
const GCMBS_CODIGOS_TEXTO=new Map([
  ['ESCALA_EXTRA_MANUAL','Escala extra manual'],['MESMA_EQUIPE','Mesma equipe'],['ORDINARIO','Ordinário'],['EDICAO','Edição'],['CONSULTA','Consulta']
]);
function gcmbsNormalizarRotuloTexto(v){
  const s=String(v||'').trim();const k=s.toLocaleLowerCase('pt-BR');return GCMBS_ROTULOS_UI.get(k)||s;
}
function gcmbsValorBooleanoUi(v){
  const s=String(v??'').trim().toUpperCase();
  if(['1','SIM','TRUE','ATIVO','ATIVA'].includes(s))return 'Sim';
  if(['0','NAO','NÃO','FALSE','INATIVO','INATIVA'].includes(s))return 'Não';
  return null;
}
function gcmbsAjustarCardsTecnicos(){
  document.querySelectorAll('.online-kv').forEach(kv=>{
    const filhos=[...kv.children];
    for(let i=0;i<filhos.length-1;i++){
      const b=filhos[i];if(b.tagName!=='B')continue;const valor=b.nextElementSibling;if(!valor)continue;
      const original=String(b.textContent||'').trim();
      if(/(?:^|\s)(?:id|uuid|record key|dedupe key|payload|hash)$/i.test(original)){b.style.display='none';valor.style.display='none';continue;}
      const rotulo=gcmbsNormalizarRotuloTexto(original);if(rotulo!==original)b.textContent=rotulo;
      const chave=rotulo.toLocaleLowerCase('pt-BR');
      if(GCMBS_BOOLEANOS_UI.has(chave)){const x=gcmbsValorBooleanoUi(valor.textContent);if(x)valor.textContent=x;}
      if(chave==='módulo'||chave==='modulo'){
        const atual=String(valor.textContent||'').trim();const amigavel=GCMBS_MODULOS_UI.get(atual.toLowerCase());if(amigavel)valor.textContent=amigavel;
      }
      if(chave==='nível'||chave==='nivel'){
        const atual=String(valor.textContent||'').trim().toUpperCase();if(atual==='EDICAO'||atual==='EDIÇÃO')valor.textContent='Edição';else if(atual==='CONSULTA')valor.textContent='Consulta';
      }
    }
  });
}
function gcmbsAjustarRotulosFormulario(){
  const host=document.getElementById('onlineEditor');if(!host)return;
  host.querySelectorAll('label').forEach(label=>{
    const n=[...label.childNodes].find(x=>x.nodeType===Node.TEXT_NODE&&String(x.nodeValue||'').trim());if(!n)return;
    const atual=String(n.nodeValue||'').trim(),novo=gcmbsNormalizarRotuloTexto(atual);if(novo!==atual)n.nodeValue=novo;
  });
}
function gcmbsAjustarCodigosVisiveis(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','CODE','PRE','INPUT','SELECT','OPTION'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
    const s=String(node.nodeValue||'');return [...GCMBS_CODIGOS_TEXTO.keys()].some(k=>s.includes(k))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){let s=String(node.nodeValue||'');for(const [cod,rot] of GCMBS_CODIGOS_TEXTO)s=s.replaceAll(cod,rot);if(s!==node.nodeValue)node.nodeValue=s;}
}
let gcmbsAuditoriaUiAgendada=false;
function gcmbsAplicarAuditoriaUi(){
  if(gcmbsAuditoriaUiAgendada)return;gcmbsAuditoriaUiAgendada=true;
  queueMicrotask(()=>{gcmbsAuditoriaUiAgendada=false;gcmbsAjustarCardsTecnicos();gcmbsAjustarRotulosFormulario();gcmbsAjustarCodigosVisiveis(document.body);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gcmbsAplicarAuditoriaUi,{once:true});else gcmbsAplicarAuditoriaUi();
new MutationObserver(gcmbsAplicarAuditoriaUi).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
