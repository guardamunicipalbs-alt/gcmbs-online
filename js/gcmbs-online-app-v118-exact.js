/* GCMBS V118 — Online + App reconstruídos no padrão exato do Desktop aprovado. */
(()=>{
'use strict';
if(window.__GCMBS_V118_EXACT__) return;
window.__GCMBS_V118_EXACT__=true;

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
/* V370: hierarquia visual do Quadro no padrao do Desktop. */
const styleId='gcmbs-quadro-desktop-v370';
if(!document.getElementById(styleId)){
 const style=document.createElement('style');style.id=styleId;
 style.textContent=".gc118-main{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}\n.gc118-main>.gc118-hero{grid-column:1/-1;grid-row:1}\n.gc118-main>.gc118-top{grid-column:1;grid-row:2}\n.gc118-main>.gc118-controls{grid-column:2;grid-row:2}\n.gc118-main>.gc118-section,.gc118-main>.gc118-bottom{grid-column:1/-1}\n.gc118-main .gc118-grid.effective{grid-template-columns:repeat(4,minmax(0,1fr))}\n.gc118-main .gc118-grid.fleet{grid-template-columns:repeat(5,minmax(0,1fr))}\n.gc118-main .gc118-bars{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end}\n.gc118-main .gc118-metric{min-width:0}\n.gc118-main .gc118-metric{position:relative;padding-left:52px!important}\n.gc118-main .gc118-metric-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:#e5eefb;color:#1556a9;font-size:18px;font-weight:bold}\n.gc118-main .gc118-metric[data-gc118-id=\"__detalhes_frota__\"] .gc118-metric-value{display:none}\n.gc118-main .gc118-chart{min-width:0;width:100%}\n@media(max-width:1030px){.gc118-main .gc118-grid.fleet{grid-template-columns:repeat(3,minmax(0,1fr))}}\n@media(max-width:720px){.gc118-main{grid-template-columns:minmax(0,1fr)}.gc118-main>.gc118-top,.gc118-main>.gc118-controls{grid-column:1;grid-row:auto}.gc118-main .gc118-grid.effective,.gc118-main .gc118-grid.fleet{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:430px){.gc118-main .gc118-grid.effective,.gc118-main .gc118-grid.fleet{grid-template-columns:1fr}.gc118-main .gc118-bars{gap:3px}}\n/* V380: textos completos em cards de Frota e Efetivo, preservando 5 colunas e responsividade. */\n.gc118-main .gc118-metric{padding-right:10px!important;min-height:72px!important}\n.gc118-main .gc118-metric-label,.gc118-main .gc118-metric small{overflow:visible!important;text-overflow:clip!important;white-space:normal!important;word-break:normal!important;line-height:1.2!important}\n.gc118-main .gc118-grid.fleet .gc118-metric-label{font-size:12px!important}\n.gc118-main .gc118-grid.fleet .gc118-metric small{font-size:10px!important}\n.gc118-main .gc118-grid.fleet .gc118-metric-icon{left:10px!important}\n.gc118-main .gc118-grid.fleet .gc118-metric{padding-left:49px!important}\n";
 document.head.appendChild(style);
}

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=id=>{
  const el=document.getElementById(id);
  if(!el)return 0;
  const m=text(el.textContent).replace(',','.').match(/-?\d+(?:\.\d+)?/);
  return m?Number(m[0]):0;
};
const sourceCard=id=>{
  const e=document.getElementById(id);
  return e&&e.closest('[data-quadro-detail],.dashboard-card,button,.card');
};

let refsCache={postos:null,lastAttempt:0};
let extrasCache={date:'',value:0,a:0,b:0,items:[],busy:false};
const contarGcmsExtras=items=>new Set((Array.isArray(items)?items:[]).map(x=>Number(x.guarda_id)>0?'ID:'+Number(x.guarda_id):'NOME:'+norm(x.nome))).size;

function greeting(){
  const h=new Date().getHours();
  const prefix=h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  const name=text(document.getElementById('perfilNome')?.textContent || document.getElementById('headerUsuario')?.textContent || 'GCMBS')
    .split(/\s+/)[0].toUpperCase();
  return `${prefix}, ${name||'GCMBS'}!`;
}

async function api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão não autenticada.');
  const r=await fetch(API,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
    body:JSON.stringify({action,...payload}),
    cache:'no-store'
  });
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

async function apiExtrasEvento(data){
  const token=localStorage.getItem('gcmbs.mobile.token');

  if(!token){
    throw new Error('Sessão não autenticada.');
  }

  const r=await fetch('https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-extras-v68',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token
    },
    body:JSON.stringify({data:data}),
    cache:'no-store'
  });

  let b={};
  try{b=await r.json()}catch{}

  if(!r.ok){
    throw new Error((b&&b.message)?b.message:('HTTP '+r.status));
  }

  return b;
}
async function loadPostosTotal(){
  if(Number.isFinite(refsCache.postos))return refsCache.postos;
  if(refsCache.lastAttempt&&Date.now()-refsCache.lastAttempt<1800000)return null;
  refsCache.lastAttempt=Date.now();
  try{
    const b=await api('references');
    const refs=b?.references||b||{};
    const list=Array.isArray(refs.postos)?refs.postos:[];
    if(list.length){refsCache.postos=list.length;return list.length}
  }catch(e){console.warn('[GCMBS V118] total de postos:',e?.message||e)}
  return null;
}

async function loadExtras(date){
  if(!date)return 0;
  if(extrasCache.date===date&&!extrasCache.busy)return extrasCache.value;
  if(extrasCache.busy)return extrasCache.value;
  extrasCache.busy=true;
  try{
    const b=await apiExtrasEvento(date);
    const all=[
      ...(Array.isArray(b?.extrasA)?b.extrasA:[]),
      ...(Array.isArray(b?.extrasB)?b.extrasB:[])
    ];
    const keys=new Set(all.map(x=>String(x?.guarda_id??x?.id??x?.nome??JSON.stringify(x))));
    extrasCache={date,value:keys.size,a:contarGcmsExtras(b?.extrasA),b:contarGcmsExtras(b?.extrasB),items:all,busy:false};
    return keys.size;
  }catch(e){
    console.warn('[GCMBS V118] extras por evento:',e?.message||e);
    extrasCache={date,value:0,a:0,b:0,items:[],busy:false};
    return 0;
  }
}

function gc118AgruparExtrasEvento(body,turnoFiltro=''){
  const grupos=new Map();
  const adicionar=(turno,item)=>{
    const nome=text(item?.nome||item?.nome_guerra||item?.guarda_nome||'GCM');
    const gid=Number(item?.guarda_id||0);
    const chave=gid>0?'ID:'+gid:'NOME:'+norm(nome);
    if(!chave||chave==='NOME:')return;
    if(!grupos.has(chave))grupos.set(chave,{nome,detalhes:[]});
    const complemento=text(item?.complemento||item?.evento_nome||item?.descricao||'Extra por Evento');
    const detalhe=[`Turno ${turno}`,complemento].filter(Boolean).join(' · ');
    const g=grupos.get(chave);
    if(!g.detalhes.includes(detalhe))g.detalhes.push(detalhe);
  };
  if(!turnoFiltro||turnoFiltro==='A')for(const x of Array.isArray(body?.extrasA)?body.extrasA:[])adicionar('A',x);
  if(!turnoFiltro||turnoFiltro==='B')for(const x of Array.isArray(body?.extrasB)?body.extrasB:[])adicionar('B',x);
  return [...grupos.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}

async function abrirExtrasEvento(data,turno=''){
  const modal=document.getElementById('quadroModal');
  const title=document.getElementById('quadroModalTitulo');
  const meta=document.getElementById('quadroModalMeta');
  const list=document.getElementById('quadroModalLista');
  if(!modal||!title||!meta||!list)return;

  title.textContent=turno?'Extras — Serviço '+turno:'Escalas Extras';
  meta.textContent='Consultando GCMs escalados...';
  list.innerHTML='<div class="empty">Carregando serviços extras por evento...</div>';
  modal.classList.remove('hidden');

  try{
    const body=await apiExtrasEvento(data);
    const grupos=gc118AgruparExtrasEvento(body,turno);
    const designacoes=(Array.isArray(body?.extrasA)?body.extrasA.length:0)+(Array.isArray(body?.extrasB)?body.extrasB.length:0);
    title.textContent=turno?'Extras — Serviço '+turno:'Escalas Extras';
    meta.textContent=`Data de referência: ${data?data.split('-').reverse().join('/'):'-'} · ${grupos.length} GCM(s) · ${designacoes} designação(ões) por turno`;
    list.innerHTML=grupos.length
      ?grupos.map(g=>`<div class="item"><strong>${esc(g.nome)}</strong><span>${g.detalhes.map(esc).join('<br>')}</span></div>`).join('')
      :'<div class="empty">Nenhum GCM está escalado em serviço extra por evento nesta data.</div>';

    const all=[
      ...(Array.isArray(body?.extrasA)?body.extrasA:[]),
      ...(Array.isArray(body?.extrasB)?body.extrasB:[])
    ];
    extrasCache={date:data,value:new Set(all.map(x=>String(x.guarda_id||x.nome))).size,a:contarGcmsExtras(body?.extrasA),b:contarGcmsExtras(body?.extrasB),items:all,busy:false};
    const home=$('section[data-view="inicio"]');
    const main=home?$('.gc118-main',home):null;
    if(main)renderBars(main,grupos.length);
  }catch(e){
    console.warn('[GCMBS V118] detalhe de extras por evento:',e?.message||e);
    meta.textContent=`Data de referência: ${data?data.split('-').reverse().join('/'):'-'}`;
    list.innerHTML=`<div class="empty">Não foi possível carregar os GCMs escalados em extras por evento: ${esc(e?.message||e)}</div>`;
  }
}

function clickSource(id){
  try{sourceCard(id)?.click()}catch(_){}
}
async function abrirRelacaoSimples(title,records,show){
 const modal=document.getElementById('quadroModal'),head=document.getElementById('quadroModalTitulo');
 const meta=document.getElementById('quadroModalMeta'),list=document.getElementById('quadroModalLista');
 if(!modal||!head||!meta||!list)return;
 head.textContent=title;meta.textContent=records.length+' registro(s) · consulta somente leitura';
 list.replaceChildren();
 for(const x of records){
  const item=document.createElement('div');item.className='item';
  const name=document.createElement('strong');name.textContent=String(show(x).name||'');
  const info=document.createElement('span');info.textContent=String(show(x).details||'');
  item.append(name,info);list.appendChild(item);
 }
 if(!records.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nenhum registro disponível.';list.appendChild(empty);}
 modal.classList.remove('hidden');
}
async function abrirPostosCadastrados(){
 try{
  const response=await api('references'),ref=response.references||response;
  const records=Array.isArray(ref.postos)?ref.postos:[];
  await abrirRelacaoSimples('Postos Operacionais — consulta',records,x=>({name:x.nome||x.descricao||'Posto',details:['Prioridade '+(x.prioridade??'-'),'Mínimo '+(x.quantidade_minima??x.minimo??'-'),'Máximo '+(x.quantidade_maxima??x.maximo??'-')].join(' · ')}));
 }catch(e){alert('Não foi possível consultar os postos: '+(e?.message||e));}
}
async function abrirDetalhesFrota(){
 try{
  const response=await api('entity_list',{entity:'viaturas',limit:150,offset:0});
  const records=(Array.isArray(response.records)?response.records:[]).map(x=>x.data||{});
  await abrirRelacaoSimples('Detalhes da Frota — consulta',records,x=>({name:[x.prefixo,x.modelo].filter(Boolean).join(' · '),details:['Placa '+(x.placa||'-'),'Situação '+(x.status||'-'),'Última troca de óleo '+(x.km_ultima_troca_oleo??'-')+' km'].join(' · ')}));
 }catch(e){alert('Não foi possível consultar a frota: '+(e?.message||e));}
}
function createMetric(label,id,sub,cls=''){
 const icons={'GCM ativos':'👮','Afastados':'↪','Em férias':'▣','Postos cadastrados':'♧','Frota total':'🚓','Disponíveis':'✓','Em uso':'◉','Em manutenção':'⚙','Detalhes da Frota':'🔧'};
 const icon=icons[label]||'•';
 const b=document.createElement('button');
 b.type='button';
 b.className=`gc118-metric ${cls}`.trim();
 b.dataset.gc118Id=id||'';
 b.innerHTML=`<span class="gc118-metric-icon" aria-hidden="true">${esc(icon)}</span><span class="gc118-metric-label">${esc(label)}</span><b class="gc118-metric-value">${id==='__detalhes_frota__'?'':0}</b><small>${esc(sub)}</small>`;
 b.addEventListener('click',()=>{
   if(id==='__postos_total__')return abrirPostosCadastrados();
   if(id==='__detalhes_frota__')return abrirDetalhesFrota();
   if(id)return clickSource(id);
 });
 return b;
}


function makeStructure(home){
  let stash=$('.gc118-source-stash',home);
  if(!stash){
    stash=document.createElement('div');
    stash.className='gc118-source-stash';
    stash.setAttribute('aria-hidden','true');

    // preserva tudo como fonte funcional, sem apagar listeners/IDs/dados
    Array.from(home.children).forEach(ch=>{
      if(!ch.classList.contains('gc118-main'))stash.appendChild(ch);
    });
    home.appendChild(stash);
  }

  let main=$('.gc118-main',home);
  if(main)return main;

  main=document.createElement('div');
  main.className='gc118-main';
  main.innerHTML=`
    <div class="gc118-top">
      <div class="gc118-title"><h1>Quadro Operacional</h1><p>Painel institucional e panorama do dia</p></div>
    </div>
    <div class="gc118-controls">
      <label>Data <input class="gc118-date" type="date"></label>
    </div>
    <section class="gc118-hero">
      <div class="gc118-hero-copy">
        <div class="gc118-kicker">GCMBS · PAINEL INSTITUCIONAL</div>
        <h2></h2>
        <p>Panorama operacional da Guarda Civil Municipal de Brejo Santo, com indicadores reais do efetivo, serviços, postos e frota.</p>
        <div class="gc118-gold"></div>
        <em>Disciplina · Serviço · Proteção</em>
      </div>
    </section>
    <section class="gc118-section">
      <div class="gc118-section-head"><strong>Efetivo e Postos</strong><span>Situação operacional</span></div>
      <div class="gc118-grid effective"></div>
    </section>
    <section class="gc118-section">
      <div class="gc118-section-head"><strong>Frota</strong><span>Disponibilidade e manutenção</span></div>
      <div class="gc118-grid fleet"></div>
    </section>
    <div class="gc118-bottom">
      <section class="gc118-chart">
        <div class="gc118-section-head"><strong>Distribuição Operacional</strong><span>Dados da data selecionada</span></div>
        <div class="gc118-bars"></div>
      </section>

    </div>`;
  home.appendChild(main);

  const eff=$('.gc118-grid.effective',main);
  [
    ['GCM ativos','qAtivos','Efetivo cadastrado','', ''],
    ['Afastados','qAfastados','Fora do serviço','red',''],
    ['Em férias','qFerias','Afastamento programado','gold',''],
    ['Postos cadastrados','__postos_total__','Configurações operacionais','green','']
  ].forEach(d=>eff.appendChild(createMetric(...d)));

  const fleet=$('.gc118-grid.fleet',main);
  [
    ['Frota total','qViaturasTotal','Viaturas cadastradas','',''],
    ['Disponíveis','qViaturasDisponiveis','Prontas para emprego','green',''],
    ['Em uso','qViaturasUso','Alocadas na operação','gold','']
  ].forEach(d=>fleet.appendChild(createMetric(...d)));
  // Card de consulta: Cadastro de Viaturas permanece exclusivo do Desktop.
  fleet.appendChild(createMetric('Detalhes da Frota','__detalhes_frota__','Óleo, KM e licenciamento','orange'));
  fleet.appendChild(createMetric('Em manutenção','qViaturasManut','Acompanhamento da frota','red'));


  const date=$('.gc118-date',main), originalDate=document.getElementById('quadroData');
  if(originalDate)date.value=originalDate.value;
  date.addEventListener('change',()=>{
    if(originalDate){
      originalDate.value=date.value;
      originalDate.dispatchEvent(new Event('input',{bubbles:true}));
      originalDate.dispatchEvent(new Event('change',{bubbles:true}));
    }
    extrasCache.date='';
    setTimeout(update,80);
  });



  return main;
}

function cardValue(main,id,value){
  const b=main.querySelector(`.gc118-metric[data-gc118-id="${id}"] .gc118-metric-value`);
  if(b)b.textContent=String(value);
}

function renderBars(main,extras){
  const data=[
    ['Serviço A',n('qServicoA'),'','qServicoA'],
    ['Serviço B',n('qServicoB'),'green','qServicoB'],
    ['Extra A',extrasCache.a||0,'purple','__extra_a__'],
    ['Extra B',extrasCache.b||0,'purple','__extra_b__'],
    ['Faltas',n('qFaltas'),'red','qFaltas']
  ];
  const max=Math.max(1,...data.map(x=>x[1]));
  const box=$('.gc118-bars',main);
  const sig=data.map(x=>x[0]+':'+x[1]).join('|');
  if(box.dataset.sig===sig)return;
  box.dataset.sig=sig;
  box.innerHTML=data.map(([label,v,cls,id])=>`
    <div class="gc118-bar-col" role="button" tabindex="0" data-source="${esc(id)}">
      <b>${v}</b><span class="gc118-bar ${cls}" style="height:${v?Math.max(8,Math.round(v/max*108)):4}px"></span><small>${esc(label)}</small>
    </div>`).join('');
  $$('[data-source]',box).forEach(el=>{
    const fire=e=>{
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if(['__extra_a__','__extra_b__'].includes(el.dataset.source)){
        const data=$('.gc118-date',main)?.value||document.getElementById('quadroData')?.value||'';
        abrirExtrasEvento(data,el.dataset.source==='__extra_a__'?'A':'B');
      }else{
        clickSource(el.dataset.source);
      }
    };
    el.onclick=fire;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){fire(e)}};
  });
}

async function update(){
  const home=$('section[data-view="inicio"]');
  if(!home||!document.getElementById('qAtivos'))return false;
  home.classList.add('gc118-home');
  document.documentElement.classList.add('gc118-exact');

  const main=makeStructure(home);
  const syncStatus=document.getElementById('gc365-status');
  const titleRow=$('.gc118-top',main);
  if(syncStatus&&titleRow&&!titleRow.contains(syncStatus))titleRow.appendChild(syncStatus);
  const date=$('.gc118-date',main);
  const originalDate=document.getElementById('quadroData');
  if(originalDate&&document.activeElement!==date&&date.value!==originalDate.value)date.value=originalDate.value;

  const heroTitle=$('.gc118-hero h2',main);
  if(heroTitle)heroTitle.textContent=greeting();

  ['qAtivos','qAfastados','qFerias','qViaturasTotal','qViaturasDisponiveis','qViaturasUso','qViaturasBaixadas','qViaturasManut']
    .forEach(id=>cardValue(main,id,n(id)));

  const totalPostos=await loadPostosTotal();
  const postoValue=Number.isFinite(totalPostos)?totalPostos:n('qPostos');
  cardValue(main,'__postos_total__',postoValue);

  const extras=await loadExtras(date?.value||originalDate?.value||'');
  renderBars(main,extras);

  // qualquer camada antiga criada depois é mantida invisível pela regra de filhos diretos.
  return true;
}

let busy=false,queued=false;
async function run(){
  if(busy){queued=true;return}
  busy=true;
  try{await update()}catch(e){console.warn('[GCMBS V118]',e)}
  finally{
    busy=false;
    if(queued){queued=false;setTimeout(run,50)}
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
else run();

[120,350,700,1200,2200,4000].forEach(ms=>setTimeout(run,ms));
let timer=0;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(run,90);
}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(run,1800000);

console.info('[GCMBS] V118 Online/App no padrão exato do Desktop ativo');
})();