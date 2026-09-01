import './v62-permuta-loop-guard.js?v=100067';
import './app-core.js?v=20260901hf10r25';

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

// Frequência do Comando: espelha o controle do Desktop e grava online imediatamente.
const GCMBS_FREQUENCIA_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-frequency-v62';
let gcmbsFreqRows=[],gcmbsFreqCanEdit=false,gcmbsFreqLoading=false,gcmbsFreqLoadedKey='',gcmbsFreqTimer=null;
const gcmbsFreqDirty=new Set();
async function gcmbsFreqCall(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(GCMBS_FREQUENCIA_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
function gcmbsFreqControls(){return document.getElementById('gcmbsFrequenciaDesktopLike');}
function gcmbsFreqEnsureControls(){
  const host=document.getElementById('onlineRegistros'),filtro=document.getElementById('onlineFiltro');if(!host||!filtro)return null;
  let wrap=gcmbsFreqControls();if(wrap)return wrap;
  filtro.style.display='none';
  wrap=document.createElement('div');wrap.id='gcmbsFrequenciaDesktopLike';wrap.style.cssText='margin:0 0 14px 0;padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#fff';
  const hoje=gcmbsDataAtual();
  wrap.innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,minmax(150px,1fr)) minmax(150px,190px);gap:10px;align-items:end">
    <label style="display:grid;gap:6px;font-size:13px">Data inicial<input id="gcmbsFreqIni" type="date" value="${hoje}" style="min-height:42px"></label>
    <label style="display:grid;gap:6px;font-size:13px">Data final<input id="gcmbsFreqFim" type="date" value="${hoje}" style="min-height:42px"></label>
    <label style="display:grid;gap:6px;font-size:13px">Tipo<select id="gcmbsFreqTipo" style="min-height:42px"><option value="TODOS">Todos</option><option value="ORDINARIO">Ordinário</option><option value="EXTRA">Extra</option></select></label>
    <label style="display:grid;gap:6px;font-size:13px">GCM<select id="gcmbsFreqGcm" style="min-height:42px"><option value="TODOS">Todos os GCMs</option></select></label>
    <button id="gcmbsFreqAtualizar" type="button" style="min-height:42px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer">Atualizar</button>
  </div>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px"><button id="gcmbsFreqImprimir" type="button" style="min-height:38px;padding:0 22px;border:1px solid #9aa9bd;border-radius:9px;background:#64748b;color:#fff;font-weight:700">Imprimir</button><span id="gcmbsFreqStatus" style="font-size:13px;color:#52627a">Controle online sincronizado com o Desktop.</span></div>`;
  host.parentElement?.insertBefore(wrap,host);
  wrap.querySelector('#gcmbsFreqAtualizar')?.addEventListener('click',()=>gcmbsFreqLoad(true));
  wrap.querySelector('#gcmbsFreqImprimir')?.addEventListener('click',()=>window.print());
  wrap.querySelector('#gcmbsFreqTipo')?.addEventListener('change',gcmbsFreqRender);
  wrap.querySelector('#gcmbsFreqGcm')?.addEventListener('change',gcmbsFreqRender);
  for(const id of ['gcmbsFreqIni','gcmbsFreqFim'])wrap.querySelector('#'+id)?.addEventListener('change',()=>{gcmbsFreqLoadedKey='';});
  if(!gcmbsFreqTimer)gcmbsFreqTimer=setInterval(()=>{if(String(document.getElementById('onlineTitulo')?.textContent||'').trim()==='Frequência'&&!gcmbsFreqDirty.size&&!gcmbsFreqLoading)gcmbsFreqLoad(true,true);},60000);
  return wrap;
}
function gcmbsFreqFiltered(){
  const tipo=document.getElementById('gcmbsFreqTipo')?.value||'TODOS',gcm=document.getElementById('gcmbsFreqGcm')?.value||'TODOS';
  return gcmbsFreqRows.filter(r=>(tipo==='TODOS'||r.tipo_servico===tipo)&&(gcm==='TODOS'||String(r.guarda_id)===gcm));
}
function gcmbsFreqOptionsGcm(){
  const s=document.getElementById('gcmbsFreqGcm');if(!s)return;const atual=s.value||'TODOS';
  const map=new Map();for(const r of gcmbsFreqRows)map.set(String(r.guarda_id),r.gcm);
  s.innerHTML='<option value="TODOS">Todos os GCMs</option>'+[...map].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'pt-BR')).map(([id,n])=>`<option value="${gcmbsEsc(id)}">${gcmbsEsc(n)}</option>`).join('');
  s.value=[...s.options].some(o=>o.value===atual)?atual:'TODOS';
}
function gcmbsFreqRender(){
  const host=document.getElementById('onlineRegistros');if(!host||!gcmbsFreqControls())return;
  const list=gcmbsFreqFiltered();
  const rowsHtml=list.map(r=>{const uid=gcmbsEsc(r.uid);const bloqueada=!!r.situacao_bloqueada||!gcmbsFreqCanEdit;const situacao=String(r.situacao||'PRESENTE').toUpperCase();return `<tr data-gcmbs-freq-row="${uid}">
    <td>${gcmbsEsc(gcmbsDataBr(r.data))}</td><td><strong>${gcmbsEsc(r.gcm)}</strong></td><td>${r.tipo_servico==='EXTRA'?'EXTRA':'ORDINÁRIO'}</td><td>${gcmbsEsc(r.turno)}</td><td>${gcmbsEsc(r.referencia)}</td>
    <td><select data-freq-field="situacao" ${bloqueada?'disabled':''} style="min-width:172px;min-height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px"><option value="PRESENTE" ${situacao==='PRESENTE'?'selected':''}>PRESENTE</option><option value="FALTA" ${situacao==='FALTA'?'selected':''}>FALTA</option><option value="FALTA JUSTIFICADA" ${situacao==='FALTA JUSTIFICADA'?'selected':''}>FALTA JUSTIFICADA</option><option value="ATRASO" ${situacao==='ATRASO'?'selected':''}>ATRASO</option><option value="DISPENSADO" ${situacao==='DISPENSADO'?'selected':''}>DISPENSADO</option></select></td>
    <td style="min-width:210px">${gcmbsEsc(r.justificativa||'-')}</td><td><input data-freq-field="observacao" value="${gcmbsEsc(r.observacao||'')}" ${!gcmbsFreqCanEdit?'disabled':''} style="min-width:160px;min-height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px"></td>
    <td><button data-freq-save="1" ${!gcmbsFreqCanEdit?'disabled':''} style="min-height:38px;padding:0 15px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer">Salvar</button></td></tr>`;}).join('');
  host.innerHTML=`<div data-gcmbs-frequencia-controle="1" style="overflow-x:auto;border:1px solid #dbe4f0;border-radius:12px;background:#fff"><table style="width:100%;border-collapse:collapse;min-width:1080px"><thead><tr style="background:#f8fafc;text-align:left"><th>Data</th><th>GCM</th><th>Serviço</th><th>Turno</th><th>Referência</th><th>Situação</th><th>Justificativa</th><th>Observação</th><th>Ação</th></tr></thead><tbody>${rowsHtml||`<tr><td colspan="9" style="padding:30px;text-align:center">Nenhum GCM escalado no período selecionado.</td></tr>`}</tbody></table></div>`;
  host.querySelectorAll('th,td').forEach(el=>el.style.cssText+=';padding:10px;border-bottom:1px solid #e5eaf1;vertical-align:middle;font-size:13px');
  host.querySelectorAll('[data-freq-field]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>gcmbsFreqDirty.add(el.closest('tr')?.dataset.gcmbsFreqRow||'')));
  host.querySelectorAll('[data-freq-save]').forEach(btn=>btn.addEventListener('click',()=>gcmbsFreqSave(btn.closest('tr'))));
  const total=document.getElementById('onlineTotal');if(total)total.textContent=String(list.length);
  const filtrados=document.getElementById('onlineFiltrados');if(filtrados){const ini=document.getElementById('gcmbsFreqIni')?.value||'',fim=document.getElementById('gcmbsFreqFim')?.value||'';filtrados.textContent=`${list.length} registro(s) · ${gcmbsDataBr(ini)}${fim&&fim!==ini?' a '+gcmbsDataBr(fim):''}`;}
}
async function gcmbsFreqSave(tr){
  if(!tr)return;const uid=tr.dataset.gcmbsFreqRow,row=gcmbsFreqRows.find(x=>x.uid===uid);if(!row)return;
  const btn=tr.querySelector('[data-freq-save]'),status=document.getElementById('gcmbsFreqStatus');const original=btn.textContent;btn.disabled=true;btn.textContent='Salvando...';
  try{
    const situacao=tr.querySelector('[data-freq-field="situacao"]')?.value||row.situacao||'PRESENTE';const observacao=tr.querySelector('[data-freq-field="observacao"]')?.value||'';
    const r=await gcmbsFreqCall('save',{registro:{source_entity:row.source_entity,source_record_key:row.source_record_key,situacao,observacao}});
    row.situacao=r.registro?.situacao||situacao;row.observacao=r.registro?.observacao||observacao;row.frequency_record_key=r.record_key||row.frequency_record_key;gcmbsFreqDirty.delete(uid);
    if(status){status.textContent='Salvo online agora · aguardando/consolidando sincronização do Desktop.';status.style.color='#15803d';}
    btn.textContent='Salvo';setTimeout(()=>{btn.textContent='Salvar';btn.disabled=!gcmbsFreqCanEdit;},1200);
  }catch(e){if(status){status.textContent=e.message||'Falha ao salvar frequência.';status.style.color='#b91c1c';}btn.textContent=original;btn.disabled=false;}
}
async function gcmbsFreqLoad(force=false,silent=false){
  const wrap=gcmbsFreqEnsureControls();if(!wrap||gcmbsFreqLoading)return;
  const ini=document.getElementById('gcmbsFreqIni')?.value||gcmbsDataAtual(),fim=document.getElementById('gcmbsFreqFim')?.value||ini,key=`${ini}|${fim}`;
  if(!force&&gcmbsFreqLoadedKey===key&&document.querySelector('[data-gcmbs-frequencia-controle]'))return;
  gcmbsFreqLoading=true;const st=document.getElementById('gcmbsFreqStatus');if(st&&!silent){st.textContent='Atualizando frequência operacional...';st.style.color='#52627a';}
  try{const b=await gcmbsFreqCall('list',{data_inicial:ini,data_final:fim});gcmbsFreqRows=b.rows||[];gcmbsFreqCanEdit=!!b.can_edit;gcmbsFreqLoadedKey=key;gcmbsFreqOptionsGcm();gcmbsFreqRender();if(st){st.textContent=`Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · gravação online em tempo real.`;st.style.color='#15803d';}}
  catch(e){const host=document.getElementById('onlineRegistros');if(host)host.innerHTML=`<div data-gcmbs-frequencia-controle="1" style="padding:22px;text-align:center;color:#b91c1c">${gcmbsEsc(e.message||'Falha ao carregar frequência.')}</div>`;if(st){st.textContent=e.message||'Falha ao carregar frequência.';st.style.color='#b91c1c';}}
  finally{gcmbsFreqLoading=false;}
}
function gcmbsAjustarFrequenciaComando(){
  const titulo=String(document.getElementById('onlineTitulo')?.textContent||'').trim(),wrap=gcmbsFreqControls(),filtro=document.getElementById('onlineFiltro');
  if(titulo!=='Frequência'){if(wrap)wrap.remove();if(filtro)filtro.style.display='';gcmbsFreqLoadedKey='';gcmbsFreqDirty.clear();return;}
  gcmbsFreqEnsureControls();
  if(!document.querySelector('[data-gcmbs-frequencia-controle]'))gcmbsFreqLoadedKey='';
  gcmbsFreqLoad(false);
}

let gcmbsUiScheduled=false;
function gcmbsAgendarAjustesVisuais(){if(gcmbsUiScheduled)return;gcmbsUiScheduled=true;queueMicrotask(()=>{gcmbsUiScheduled=false;gcmbsFormatarDatasTexto(document.body);gcmbsAjustarOficios();gcmbsAjustarFrequenciaComando();});}
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
  ['eventos','Eventos / Serviço Extra por Evento'],['eventos_extras','Eventos / Serviço Extra por Evento'],['folha','Folha de Pagamento'],['folha_pagamento','Folha de Pagamento'],
  ['banco_horas','Banco de Horas'],['relatorios','Relatórios'],['viaturas','Cadastro de Viaturas'],['permutas','Permutas'],['abastecimento','Abastecimento'],
  ['manutencao_viaturas','Manutenção de Viaturas'],['checklist','Check-list de Viaturas'],['relatorios_frota','Relatórios da Frota'],['ocorrencias','Ocorrências / Produção'],
  ['ocorrencias_operacionais','Ocorrências / Produção'],['equipamentos','Equipamentos e Cautelas'],['cursos','Cursos e Habilitações'],['oficios','Ofícios'],
  ['frequencia','Frequência'],['central_pendencias','Central de Pendências'],['controle_acesso','Controle de Acesso'],['imagens','Imagens da GCM'],['avisos','Quadro de Avisos']
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
