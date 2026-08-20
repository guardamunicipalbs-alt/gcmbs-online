import './app-core.js';

// Hotfix visual 10.0.62: padroniza datas exibidas no Online em dd/mm/aaaa
// sem alterar valores ISO usados por inputs, API, banco e sincronizacao.
const GCMBS_ISO_DATE_TEST=/\b\d{4}-\d{2}-\d{2}\b/;
const GCMBS_ISO_DATE_RE=/\b(\d{4})-(\d{2})-(\d{2})\b/g;

function gcmbsFormatarDatasTexto(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;
    if(!p)return NodeFilter.FILTER_REJECT;
    if(['SCRIPT','STYLE','TEXTAREA','CODE','PRE'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
    return GCMBS_ISO_DATE_TEST.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    node.nodeValue=(node.nodeValue||'').replace(GCMBS_ISO_DATE_RE,'$3/$2/$1');
  }
}

// Ofícios: exibe somente a competência selecionada e ordena pela data da demanda
// em ordem decrescente. A competência atual é usada como padrão; o histórico
// permanece acessível pelo seletor mensal e nenhum registro é excluído da base.
let gcmbsOficiosCompetenciaSelecionada='';

function gcmbsCompetenciaAtual(){
  return new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}).slice(0,7);
}

function gcmbsDataIsoTexto(v){
  const s=String(v||'').trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}

function gcmbsValorCampoCard(card,rotulos){
  const labels=[...(card?.querySelectorAll('.online-kv b')||[])];
  for(const b of labels){
    const nome=String(b.textContent||'').trim().toLowerCase();
    if(rotulos.some(r=>nome===r)){
      const span=b.nextElementSibling;
      return String(span?.textContent||'').trim();
    }
  }
  return '';
}

function gcmbsRotuloCompetencia(competencia){
  const m=String(competencia||'').match(/^(\d{4})-(\d{2})$/);
  if(!m)return competencia||'';
  const d=new Date(`${m[1]}-${m[2]}-01T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(d);
}

function gcmbsAjustarOficios(){
  const titulo=document.getElementById('onlineTitulo');
  const filtro=document.getElementById('onlineFiltro');
  const wrapExistente=document.getElementById('gcmbsOficiosCompetenciaWrap');
  const emOficios=String(titulo?.textContent||'').trim()==='Ofícios';

  if(!emOficios){
    if(wrapExistente)wrapExistente.remove();
    return;
  }
  if(!filtro)return;

  if(!gcmbsOficiosCompetenciaSelecionada)gcmbsOficiosCompetenciaSelecionada=gcmbsCompetenciaAtual();

  let wrap=wrapExistente;
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='gcmbsOficiosCompetenciaWrap';
    wrap.className='form-grid';
    wrap.style.marginBottom='12px';
    wrap.innerHTML=`<label>Competência<input id="gcmbsOficiosCompetencia" type="month" value="${gcmbsOficiosCompetenciaSelecionada}"></label>`;
    filtro.parentElement?.insertBefore(wrap,filtro);
    const input=wrap.querySelector('#gcmbsOficiosCompetencia');
    input?.addEventListener('change',()=>{
      gcmbsOficiosCompetenciaSelecionada=input.value||gcmbsCompetenciaAtual();
      gcmbsAjustarOficios();
    });
  }else{
    const input=wrap.querySelector('#gcmbsOficiosCompetencia');
    if(input&&input.value!==gcmbsOficiosCompetenciaSelecionada)input.value=gcmbsOficiosCompetenciaSelecionada;
  }

  const host=document.getElementById('onlineRegistros');
  if(!host)return;
  const cards=[...host.querySelectorAll('[data-online-key]')];
  const competencia=gcmbsOficiosCompetenciaSelecionada||gcmbsCompetenciaAtual();

  const info=cards.map((card,idx)=>{
    const demanda=gcmbsDataIsoTexto(gcmbsValorCampoCard(card,['data da demanda']));
    const recebimento=gcmbsDataIsoTexto(gcmbsValorCampoCard(card,['data de recebimento','data do recebimento']));
    const dataRef=demanda||recebimento;
    const numero=gcmbsValorCampoCard(card,['número do ofício','numero do ofício']);
    const dentro=dataRef.slice(0,7)===competencia;
    card.style.display=dentro?'':'none';
    return {card,idx,dentro,dataRef,recebimento,numero};
  });

  const visiveis=info.filter(x=>x.dentro).sort((a,b)=>
    b.dataRef.localeCompare(a.dataRef)||
    b.recebimento.localeCompare(a.recebimento)||
    b.numero.localeCompare(a.numero,'pt-BR',{numeric:true})||
    a.idx-b.idx
  );

  const ordemAtual=[...host.querySelectorAll('[data-online-key]')].filter(x=>x.style.display!=='none');
  const precisaReordenar=visiveis.some((x,i)=>ordemAtual[i]!==x.card);
  if(precisaReordenar){
    for(const x of visiveis)host.appendChild(x.card);
  }

  const total=document.getElementById('onlineTotal');
  if(total&&total.textContent!==String(visiveis.length))total.textContent=String(visiveis.length);

  const filtrados=document.getElementById('onlineFiltrados');
  if(filtrados){
    const q=String(filtro.value||'').trim();
    const rotulo=gcmbsRotuloCompetencia(competencia);
    const texto=q?`${visiveis.length} encontrado(s) · ${rotulo}`:`${visiveis.length} registro(s) · ${rotulo}`;
    if(filtrados.textContent!==texto)filtrados.textContent=texto;
  }
}

let gcmbsUiScheduled=false;
function gcmbsAgendarAjustesVisuais(){
  if(gcmbsUiScheduled)return;
  gcmbsUiScheduled=true;
  queueMicrotask(()=>{
    gcmbsUiScheduled=false;
    gcmbsFormatarDatasTexto(document.body);
    gcmbsAjustarOficios();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gcmbsAgendarAjustesVisuais,{once:true});
else gcmbsAgendarAjustesVisuais();

new MutationObserver(gcmbsAgendarAjustesVisuais).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
