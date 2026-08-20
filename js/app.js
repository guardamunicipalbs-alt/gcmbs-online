import './app-core.js';
import {AuthenticatedProvider} from './data-provider.js';

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

function gcmbsDataAtual(){
  return new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
}

function gcmbsDataIsoTexto(v){
  const s=String(v||'').trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}

function gcmbsDataBr(v){
  const iso=gcmbsDataIsoTexto(v);
  if(!iso)return String(v||'');
  const [a,m,d]=iso.split('-');
  return `${d}/${m}/${a}`;
}

function gcmbsEsc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

// Frequência do Comando/Subcomando: a fonte principal do histórico do dia é a
// escala consolidada. Registro de frequência complementa a escala (falta,
// presença etc.), mas a ausência de lançamento nunca faz um GCM escalado sumir.
let gcmbsFrequenciaProvider=null;
let gcmbsFrequenciaGestor=null;
let gcmbsFrequenciaDataSelecionada='';
let gcmbsFrequenciaDataCarregada='';
let gcmbsFrequenciaLinhas=[];
let gcmbsFrequenciaCarregando=false;
let gcmbsFrequenciaChaveRender='';

async function gcmbsProviderFrequencia(){
  if(gcmbsFrequenciaProvider)return gcmbsFrequenciaProvider;
  const p=new AuthenticatedProvider();
  const body=await p.call('session');
  p.session=body.session||null;
  gcmbsFrequenciaGestor=p.gestor();
  gcmbsFrequenciaProvider=p;
  return p;
}

function gcmbsTipoServicoEscala(d){
  const origem=String(d?.origem||'').toUpperCase();
  return origem.includes('EXTRA')?'EXTRA':'ORDINARIO';
}

function gcmbsHorarioEscala(d){
  const turno=String(d?.turno||'').toUpperCase();
  const posto=String(d?.posto_nome||d?.posto||'').toUpperCase();
  if(turno==='B')return '19:00–07:00';
  if(turno==='A'){
    const fim=String(d?.hist_horario_fim||'');
    if(posto==='CENTRAL'&&fim)return `07:00–${fim}`;
    return '07:00–19:00';
  }
  const ini=String(d?.hist_horario_inicio||d?.horario_inicio||'');
  const fim=String(d?.hist_horario_fim||d?.horario_fim||'');
  return [ini,fim].filter(Boolean).join('–')||'—';
}

function gcmbsSituacaoFrequencia(freq){
  const s=String(freq?.situacao||freq?.status||'').trim().toUpperCase();
  return s||'ESCALADO';
}

function gcmbsMontarFrequenciaDia(escalas,freqs,extras,data){
  const rows=[];
  const escalasDia=(escalas||[]).filter(d=>
    gcmbsDataIsoTexto(d?.data)===data &&
    !['CANCELADA','CANCELADO','INATIVA','INATIVO','EXCLUIDA','EXCLUIDO'].includes(String(d?.status||'ATIVA').toUpperCase())
  );
  const frequenciasDia=(freqs||[]).filter(f=>gcmbsDataIsoTexto(f?.data)===data);

  for(const d of escalasDia){
    const tipo=gcmbsTipoServicoEscala(d);
    const refId=Number(d?.id||0);
    const guardaId=Number(d?.guarda_id||0);
    const freq=frequenciasDia.find(f=>
      (refId&&Number(f?.referencia_id||0)===refId) ||
      (guardaId&&Number(f?.guarda_id||0)===guardaId&&String(f?.tipo_servico||'').toUpperCase()===tipo)
    );
    rows.push({
      data,
      guarda_id:guardaId,
      guarda:String(d?.guarda_nome||d?.hist_guarda_nome_guerra||d?.guarda||'GCM'),
      turno:String(d?.turno||'—').toUpperCase(),
      posto:String(d?.posto_nome||d?.hist_posto_nome||d?.posto||'—'),
      viatura:String(d?.viatura||d?.hist_viatura_prefixo||'—'),
      horario:gcmbsHorarioEscala(d),
      tipo_servico:tipo,
      situacao:gcmbsSituacaoFrequencia(freq),
      observacao:String(freq?.observacao||d?.observacao||''),
      tem_frequencia:!!freq,
      origem:'escala'
    });
  }

  // Extras manuais ainda não posicionados em um posto também pertencem ao
  // histórico do dia. Evita que um serviço extra válido desapareça da Frequência.
  const extrasDia=(extras||[]).filter(e=>
    gcmbsDataIsoTexto(e?.data)===data &&
    !['CANCELADA','CANCELADO','INATIVA','INATIVO','EXCLUIDA','EXCLUIDO'].includes(String(e?.status||'ATIVA').toUpperCase())
  );
  for(const e of extrasDia){
    const gid=Number(e?.guarda_id||0);
    const jaRepresentado=rows.some(r=>r.guarda_id===gid&&r.tipo_servico==='EXTRA');
    if(jaRepresentado)continue;
    const freq=frequenciasDia.find(f=>gid&&Number(f?.guarda_id||0)===gid&&String(f?.tipo_servico||'').toUpperCase()==='EXTRA');
    const hi=String(e?.horario_inicio||'');
    const hf=String(e?.horario_fim||'');
    rows.push({
      data,
      guarda_id:gid,
      guarda:String(e?.guarda_nome||e?.guarda||`GCM ${gid||''}`).trim(),
      turno:hi>='19:00'?'B':'A',
      posto:String(e?.posto||'Serviço extra'),
      viatura:'—',
      horario:[hi,hf].filter(Boolean).join('–')||'—',
      tipo_servico:'EXTRA',
      situacao:gcmbsSituacaoFrequencia(freq),
      observacao:String(freq?.observacao||e?.observacao||''),
      tem_frequencia:!!freq,
      origem:'extra_manual'
    });
  }

  return rows.sort((a,b)=>
    String(a.turno).localeCompare(String(b.turno),'pt-BR')||
    String(a.posto).localeCompare(String(b.posto),'pt-BR')||
    String(a.guarda).localeCompare(String(b.guarda),'pt-BR')
  );
}

function gcmbsRenderFrequenciaDia(){
  const host=document.getElementById('onlineRegistros');
  const filtro=document.getElementById('onlineFiltro');
  if(!host||!filtro)return;
  const q=String(filtro.value||'').trim().toLowerCase();
  const list=gcmbsFrequenciaLinhas.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
  const data=gcmbsFrequenciaDataSelecionada||gcmbsDataAtual();
  const renderKey=`${data}|${q}|${list.length}`;
  const jaCustom=host.querySelector('[data-gcmbs-frequencia],[data-gcmbs-frequencia-empty]');
  if(gcmbsFrequenciaChaveRender===renderKey&&jaCustom)return;

  host.innerHTML=list.length?list.map(r=>{
    const tipo=r.tipo_servico==='EXTRA'?'Extra':'Ordinário';
    const situacao=r.tem_frequencia?r.situacao:'ESCALADO';
    const detalheFreq=r.tem_frequencia?'Frequência registrada':'Sem lançamento de frequência';
    return `<div data-gcmbs-frequencia="1" style="border:1px solid #d9e2ef;border-radius:14px;padding:14px 16px;margin-bottom:10px;background:#fff">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div><strong>${gcmbsEsc(r.guarda)}</strong><div style="margin-top:4px">${gcmbsEsc(r.posto)} · Turno ${gcmbsEsc(r.turno)} · ${gcmbsEsc(r.horario)}</div></div>
        <strong>${gcmbsEsc(situacao)}</strong>
      </div>
      <div style="margin-top:7px;font-size:.92em">${gcmbsEsc(tipo)}${r.viatura&&r.viatura!=='—'?` · ${gcmbsEsc(r.viatura)}`:''} · ${gcmbsEsc(detalheFreq)}</div>
      ${r.observacao?`<div style="margin-top:7px">${gcmbsEsc(r.observacao)}</div>`:''}
    </div>`;
  }).join(''):`<div data-gcmbs-frequencia-empty="1" class="empty">Nenhum GCM escalado em ${gcmbsEsc(gcmbsDataBr(data))}.</div>`;

  const total=document.getElementById('onlineTotal');
  if(total)total.textContent=String(list.length);
  const filtrados=document.getElementById('onlineFiltrados');
  if(filtrados)filtrados.textContent=`${list.length} registro(s) · ${gcmbsDataBr(data)}`;
  gcmbsFrequenciaChaveRender=renderKey;
}

async function gcmbsAjustarFrequenciaComando(forcar=false){
  const titulo=String(document.getElementById('onlineTitulo')?.textContent||'').trim();
  const wrapAntigo=document.getElementById('gcmbsFrequenciaDiaWrap');
  if(titulo!=='Frequência'){
    if(wrapAntigo)wrapAntigo.remove();
    gcmbsFrequenciaDataCarregada='';
    return;
  }
  const filtro=document.getElementById('onlineFiltro');
  const host=document.getElementById('onlineRegistros');
  if(!filtro||!host||gcmbsFrequenciaCarregando)return;

  try{
    const p=await gcmbsProviderFrequencia();
    if(!gcmbsFrequenciaGestor)return;
    if(!gcmbsFrequenciaDataSelecionada)gcmbsFrequenciaDataSelecionada=gcmbsDataAtual();

    let wrap=wrapAntigo;
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='gcmbsFrequenciaDiaWrap';
      wrap.className='form-grid';
      wrap.style.marginBottom='12px';
      wrap.innerHTML=`<label>Data do histórico<input id="gcmbsFrequenciaData" type="date" value="${gcmbsEsc(gcmbsFrequenciaDataSelecionada)}"></label>`;
      filtro.parentElement?.insertBefore(wrap,filtro);
      const inp=wrap.querySelector('#gcmbsFrequenciaData');
      inp?.addEventListener('change',()=>{
        gcmbsFrequenciaDataSelecionada=inp.value||gcmbsDataAtual();
        gcmbsFrequenciaDataCarregada='';
        gcmbsFrequenciaChaveRender='';
        gcmbsAjustarFrequenciaComando(true);
      });
      if(!filtro.dataset.gcmbsFrequenciaHook){
        filtro.dataset.gcmbsFrequenciaHook='1';
        filtro.addEventListener('input',()=>queueMicrotask(gcmbsRenderFrequenciaDia));
      }
    }

    if(!forcar&&gcmbsFrequenciaDataCarregada===gcmbsFrequenciaDataSelecionada){
      gcmbsRenderFrequenciaDia();
      return;
    }

    gcmbsFrequenciaCarregando=true;
    host.innerHTML='<div class="empty">Carregando histórico completo do dia...</div>';
    const [escResp,freqResp,extraResp]=await Promise.all([
      p.entityList('escalas',5000,0),
      p.entityList('frequencia_registros',1000,0),
      p.entityList('escalas_extras_manuais',1500,0)
    ]);
    const escalas=(escResp.records||[]).map(x=>x.data||{});
    const freqs=(freqResp.records||[]).map(x=>x.data||{});
    const extras=(extraResp.records||[]).map(x=>x.data||{});
    gcmbsFrequenciaLinhas=gcmbsMontarFrequenciaDia(escalas,freqs,extras,gcmbsFrequenciaDataSelecionada);
    gcmbsFrequenciaDataCarregada=gcmbsFrequenciaDataSelecionada;
    gcmbsRenderFrequenciaDia();
  }catch(e){
    gcmbsFrequenciaDataCarregada='';
    host.innerHTML=`<div class="empty">Não foi possível carregar o histórico da frequência: ${gcmbsEsc(e?.message||e)}</div>`;
  }finally{
    gcmbsFrequenciaCarregando=false;
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
    gcmbsAjustarFrequenciaComando();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gcmbsAgendarAjustesVisuais,{once:true});
else gcmbsAgendarAjustesVisuais();

new MutationObserver(gcmbsAgendarAjustesVisuais).observe(document.documentElement,{childList:true,subtree:true,characterData:true});