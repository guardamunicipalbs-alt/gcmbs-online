/* GCMBS V118 — Online + App reconstruídos no padrão exato do Desktop aprovado. */
(()=>{
'use strict';
if(window.__GCMBS_V118_EXACT__) return;
window.__GCMBS_V118_EXACT__=true;

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
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

let refsCache={postos:null};
let extrasCache={date:'',value:0,busy:false};

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

async function loadPostosTotal(){
  if(Number.isFinite(refsCache.postos))return refsCache.postos;
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
    const b=await api('extras_evento',{data:date});
    const all=[
      ...(Array.isArray(b?.extrasA)?b.extrasA:[]),
      ...(Array.isArray(b?.extrasB)?b.extrasB:[])
    ];
    const keys=new Set(all.map(x=>String(x?.guarda_id??x?.id??x?.nome??JSON.stringify(x))));
    extrasCache={date,value:keys.size,busy:false};
    return keys.size;
  }catch(e){
    console.warn('[GCMBS V118] extras por evento:',e?.message||e);
    extrasCache={date,value:0,busy:false};
    return 0;
  }
}

function clickSource(id){
  try{sourceCard(id)?.click()}catch(_){}
}
function clickModule(moduleId,label){
  try{
    const b=document.querySelector(`#mainNav [data-module="${moduleId}"]`);
    if(b)return b.click();
    const candidates=$$('#mainNav button');
    const hit=candidates.find(x=>norm(x.textContent).includes(norm(label)));
    if(hit)hit.click();
  }catch(_){}
}

function createMetric(label,id,sub,cls='',moduleId=''){
  const b=document.createElement('button');
  b.type='button';
  b.className=`gc118-metric ${cls}`.trim();
  b.dataset.gc118Id=id||'';
  b.dataset.gc118Module=moduleId||'';
  b.innerHTML=`<span class="gc118-metric-label">${esc(label)}</span><b class="gc118-metric-value">0</b><small>${esc(sub)}</small>`;
  b.addEventListener('click',()=>{
    if(moduleId)return clickModule(moduleId,label);
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
    <div class="gc118-related">
      <span class="gc118-related-label">Acesso relacionado:</span>
      <button class="gc118-quick" type="button" data-module="cadastro_guardas">Guardas</button>
      <button class="gc118-quick" type="button" data-module="equipes">Equipes</button>
      <button class="gc118-quick" type="button" data-module="postos">Postos</button>
      <button class="gc118-quick" type="button" data-module="gerador_escala">Gerar escala</button>
    </div>
    <div class="gc118-controls">
      <label>Data <input class="gc118-date" type="date"></label>
      <button class="gc118-sync primary" type="button">↻ Sincronizar agora</button>
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
      <section class="gc118-notices">
        <div class="gc118-section-head"><strong>📢 Quadro de Avisos</strong><span>Institucional</span></div>
        <div class="gc118-notice-body"></div>
        <div class="gc118-notice-actions"></div>
      </section>
    </div>`;
  home.appendChild(main);

  const eff=$('.gc118-grid.effective',main);
  [
    ['GCM ativos','qAtivos','Efetivo cadastrado','', ''],
    ['Afastados','qAfastados','Fora do serviço','red',''],
    ['Em férias','qFerias','Afastamento programado','gold',''],
    ['Postos cadastrados','__postos_total__','Configurações operacionais','green','postos']
  ].forEach(d=>eff.appendChild(createMetric(...d)));

  const fleet=$('.gc118-grid.fleet',main);
  [
    ['Frota total','qViaturasTotal','Viaturas cadastradas','',''],
    ['Disponíveis','qViaturasDisponiveis','Prontas para emprego','green',''],
    ['Em uso','qViaturasUso','Alocadas na operação','gold',''],
    ['Indisponíveis','qViaturasBaixadas','Fora de operação','orange',''],
    ['Em manutenção','qViaturasManut','Acompanhamento da frota','red','']
  ].forEach(d=>fleet.appendChild(createMetric(...d)));

  $$('.gc118-quick',main).forEach(b=>b.addEventListener('click',()=>clickModule(b.dataset.module,b.textContent)));

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

  $('.gc118-sync',main).addEventListener('click',()=>{
    const btn=document.getElementById('syncAgoraOnline');
    if(btn)btn.click();
    else document.getElementById('quadroData')?.dispatchEvent(new Event('change',{bubbles:true}));
    refsCache.postos=null;extrasCache.date='';
    setTimeout(update,250);
  });

  // Usa os elementos reais do Quadro de Avisos para preservar o mecanismo atual.
  const list=document.getElementById('avisosHomeLista');
  const noticeBody=$('.gc118-notice-body',main);
  if(list)noticeBody.appendChild(list);
  else noticeBody.innerHTML='<div class="notice">Nenhum aviso institucional ativo.</div>';

  const originalNoticeButton=document.querySelector('#quadroAvisosHome [data-go="avisos"]');
  const actions=$('.gc118-notice-actions',main);
  if(originalNoticeButton){
    originalNoticeButton.textContent='Ver todos os avisos';
    originalNoticeButton.className='secondary';
    actions.appendChild(originalNoticeButton);
  }else{
    const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent='Abrir Quadro de Avisos';
    btn.onclick=()=>document.querySelector('#mainNav [data-go="avisos"]')?.click();
    actions.appendChild(btn);
  }

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
    ['Extras',extras,'purple','__extras__'],
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
    const fire=()=>{
      if(el.dataset.source==='__extras__')clickModule('eventos_extra','Eventos');
      else clickSource(el.dataset.source);
    };
    el.onclick=fire;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fire()}};
  });
}

async function update(){
  const home=$('section[data-view="inicio"]');
  if(!home||!document.getElementById('qAtivos'))return false;
  home.classList.add('gc118-home');
  document.documentElement.classList.add('gc118-exact');

  const main=makeStructure(home);
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
setInterval(run,3500);

console.info('[GCMBS] V118 Online/App no padrão exato do Desktop ativo');
})();