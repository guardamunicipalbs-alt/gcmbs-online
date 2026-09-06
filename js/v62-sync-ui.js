const BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const QUADRO=BASE+'gcmbs-quadro-v62';
const API=BASE+'gcmbs-communication-gateway-v74';
const REQUEST_SYNC=BASE+'gcmbs-request-sync-v62';

const _fetch=window.fetch.bind(window);

const esc=v=>String(v??'').replace(
  /[&<>"']/g,
  c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c])
);

const hoje=()=>
  new Date().toLocaleDateString(
    'en-CA',
    {timeZone:'America/Fortaleza'}
  );

const fmt=v=>{
  const s=String(v||'').slice(0,10);

  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))
    return s||'-';

  const [a,m,d]=s.split('-');

  return `${d}/${m}/${a}`;
};

const status=x=>
  String(x||'PENDENTE').toUpperCase();

const PEND=new Set([
  'PENDENTE',
  'PENDENTE_DESKTOP',
  'PROCESSADO',
  'AGUARDANDO_ACEITE',
  'DECISAO_PENDENTE_DESKTOP',
  'CANCELAMENTO_PENDENTE',
  'CANCELAMENTO_PENDENTE_DESKTOP',
  'CANCELAMENTO_COMANDO_PENDENTE',
  'ACEITE_PENDENTE_DESKTOP'
]);

/*
 * Somente estes estados exibem decisão administrativa.
 * AGUARDANDO_ACEITE permanece com o outro GCM,
 * conforme o fluxo obrigatório antes do Comando.
 */
const DECISAO_COMANDO=new Set([
  'PENDENTE',
  'PENDENTE_DESKTOP',
  'PROCESSADO',
  'DECISAO_PENDENTE_DESKTOP'
]);

async function api(action,payload={}){

  const token=
    localStorage.getItem('gcmbs.mobile.token');

  const r=await _fetch(
    API,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        ...(token
          ?{Authorization:`Bearer ${token}`}
          :{})
      },
      body:JSON.stringify({
        action,
        ...payload
      }),
      cache:'no-store'
    }
  );

  const b=await r.json().catch(()=>({}));

  if(!r.ok)
    throw new Error(
      b.message||`HTTP ${r.status}`
    );

  return b;
}

async function requestSync(){

  const token=
    localStorage.getItem('gcmbs.mobile.token');

  if(!token)
    throw new Error(
      'Faça login antes de sincronizar.'
    );

  const r=await _fetch(
    REQUEST_SYNC,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${token}`
      },
      body:JSON.stringify({
        action:'request_sync'
      }),
      cache:'no-store'
    }
  );

  const b=await r.json().catch(()=>({}));

  if(!r.ok)
    throw new Error(
      b.message||`HTTP ${r.status}`
    );

  return b;
}

async function syncStatus(){

  const token=
    localStorage.getItem('gcmbs.mobile.token');

  if(!token)
    return null;

  const r=await _fetch(
    QUADRO,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${token}`
      },
      body:JSON.stringify({
        action:'sync_status'
      }),
      cache:'no-store'
    }
  );

  const b=await r.json().catch(()=>({}));

  if(!r.ok)
    throw new Error(
      b.message||`HTTP ${r.status}`
    );

  return b.sincronizacao||{};
}

function gestor(s){

  const role=String(
    s?.role||
    s?.perfil||
    ''
  ).toLowerCase();

  const cargo=String(
    s?.cargo||
    ''
  ).toUpperCase();

  return (
    role==='comandante' ||
    role==='subcomandante' ||
    /SUBCOMANDANTE/.test(cargo) ||
    (
      /COMANDANTE/.test(cargo) &&
      !/SUBCOMANDANTE/.test(cargo)
    )
  );
}

function competenciaReq(r){

  const q=r?.payload||{};

  return String(
    q.competencia_origem||
    q.competencia||
    q.data||
    r.created_at||
    ''
  ).slice(0,7);
}

function competenciaHist(r){

  return String(
    r?.competencia||
    r?.data||
    r?.criado_em||
    ''
  ).slice(0,7);
}

function badge(){

  let e=document.getElementById(
    'syncStatus'
  );

  if(e)
    return e;

  const h=
    document.querySelector('.header-user') ||
    document.querySelector('header');

  if(!h)
    return null;

  e=document.createElement('span');
  e.id='syncStatus';

  e.style.cssText=
    'font-size:11px;' +
    'color:#bbf7d0;' +
    'max-width:340px;' +
    'line-height:1.25';

  h.insertBefore(
    e,
    document.getElementById(
      'headerUsuario'
    ) || h.firstChild
  );

  return e;
}

async function atualizarBadge(){

  const e=badge();

  if(!e)
    return;

  try{

    const s=await syncStatus();

    if(!s){
      e.textContent=
        'Sincronização: aguardando login';
      return;
    }

    e.textContent=
      `Última sincronização Desktop ↔ Online/App: ${
        s.ultima_sincronizacao
          ?new Date(
              s.ultima_sincronizacao
            ).toLocaleString(
              'pt-BR',
              {
                timeZone:
                  'America/Fortaleza'
              }
            )
          :'não registrada'
      }${
        s.desktop_version
          ?' · Desktop '+s.desktop_version
          :''
      }`;

    e.title=
      `Pendentes: ${Number(
        s.pendentes||0
      )} · Erros recentes: ${Number(
        s.erros_recentes||0
      )} · GCMBS Online/App 10.0.76`;

    e.style.color=
      Number(s.erros_recentes||0)
        ?'#fecaca'
        :Number(s.pendentes||0)
          ?'#fde68a'
          :'#bbf7d0';

  }
  catch(err){

    e.textContent=
      'Sincronização: indisponível';

    e.title=
      err?.message||
      '';

    e.style.color='#fecaca';
  }
}

function corrigirData(){

  const utc=
    new Date().toISOString().slice(0,10);

  const local=hoje();

  for(const id of [
    'quadroData',
    'escalaIni',
    'escalaFim',
    'pmData',
    'bcData',
    'chkData',
    'occData',
    'msgDataServico'
  ]){

    const e=
      document.getElementById(id);

    if(e && e.value===utc)
      e.value=local;
  }

  const q=
    document.getElementById('quadroData');

  if(
    q &&
    q.value!==local &&
    !q.dataset.v62Touched
  ){
    q.value=local;
    q.dispatchEvent(
      new Event(
        'change',
        {bubbles:true}
      )
    );
  }
}

function instalarSync(){

  if(
    document.getElementById(
      'onlineSyncNow'
    )
  )
    return;

  const q=
    document.getElementById(
      'quadroData'
    );

  if(!q)
    return;

  const b=
    document.createElement('button');

  b.id='onlineSyncNow';
  b.className='secondary';
  b.type='button';
  b.textContent='↻ Sincronizar agora';
  b.style.marginLeft='10px';

  q.parentElement?.after(b);

  b.onclick=async()=>{

    const old=b.textContent;

    b.disabled=true;
    b.textContent='Solicitando...';

    try{

      const r=await requestSync();

      b.textContent=
        'Solicitação enviada';

      alert(
        r.message||
        'Sincronização solicitada ao Desktop.'
      );

      setTimeout(
        async()=>{

          try{
            q.dispatchEvent(
              new Event(
                'change',
                {bubbles:true}
              )
            );

            await atualizarBadge();
            await renderPermutasComando();

          }catch{}

          b.textContent=old;
          b.disabled=false;

        },
        5000
      );

    }
    catch(e){

      alert(
        'Não foi possível solicitar a sincronização: '+
        (e.message||e)
      );

      b.textContent=old;
      b.disabled=false;
    }
  };
}

let nomes=new Map();

function nome(id,fallback='GCM'){

  return (
    nomes.get(Number(id)) ||
    `${fallback}${id?' '+id:''}`
  );
}

function acoes(id){

  return `
    <div class="request-actions">
      <button
        class="mini"
        data-v62-ok="${id}">
        Aprovar
      </button>

      <button
        class="mini"
        data-v62-no="${id}">
        Recusar
      </button>

      <button
        class="mini danger-soft"
        data-v62-del="${id}">
        Excluir solicitação
      </button>
    </div>
  `;
}

function cardHist(h,req){

  const st=
    status(req?.status||h.status);

  const sub=
    h.substituido_nome||
    nome(h.substituido_id);

  const sbt=
    h.substituto_nome||
    nome(h.substituto_id);

  const modal=
    String(
      h.modalidade||
      ''
    ).toUpperCase();

  const extra=
    Number(h.servico_extra) ||
    modal.includes('EXTRA');

  const podeDecidir=
    !!req &&
    DECISAO_COMANDO.has(st);

  return `
    <article class="record-card">

      <div class="record-card-head">
        <strong>
          ${esc(sub)} → ${esc(sbt)}
        </strong>

        <span
          class="status-pill status-${esc(st)}">
          ${esc(st)}
        </span>
      </div>

      <div class="record-meta">
        ${esc(fmt(h.data))}
        · Turno ${esc(h.turno||'-')}
        · ${extra
          ?'Serviço extra'
          :'Serviço ordinário'}
        · Desktop #${esc(
          h.id||
          h.desktop_id||
          ''
        )}
      </div>

      ${
        h.motivo
          ?`<div>${esc(h.motivo)}</div>`
          :''
      }

      ${
        h.motivo_decisao
          ?`<small>
              Decisão:
              ${esc(h.motivo_decisao)}
            </small>`
          :''
      }

      ${
        req?.resposta
          ?`<small>
              ${esc(req.resposta)}
            </small>`
          :''
      }

      ${
        podeDecidir
          ?acoes(req.id)
          :''
      }

    </article>
  `;
}

function cardReq(r){

  const q=r.payload||{};
  const st=status(r.status);

  const sol=
    r.nome_guerra||
    nome(r.guarda_id);

  const sub=
    nome(q.substituido_id);

  const modalidade=
    String(
      q.modalidade||
      ''
    ).toUpperCase();

  const tipo=
    modalidade==='TROCA_EXTRA'
      ?'Troca bilateral de extras'
      :modalidade==='CESSAO_EXTRA'
        ?'Assunção de serviço extra'
        :Number(q.servico_extra)
          ?'Serviço extra'
          :'Serviço ordinário';

  const podeDecidir=
    DECISAO_COMANDO.has(st);

  return `
    <article class="record-card">

      <div class="record-card-head">
        <strong>
          ${esc(sol)} · ${esc(sub)}
        </strong>

        <span
          class="status-pill status-${esc(st)}">
          ${esc(st)}
        </span>
      </div>

      <div class="record-meta">
        ${esc(fmt(q.data))}
        · Turno ${esc(q.turno||'-')}
        · ${esc(tipo)}
        · Online #${r.id}
      </div>

      ${
        q.observacao
          ?`<div>
              ${esc(q.observacao)}
            </div>`
          :''
      }

      ${
        r.resposta
          ?`<small>
              ${esc(r.resposta)}
            </small>`
          :''
      }

      ${
        podeDecidir
          ?acoes(r.id)
          :''
      }

    </article>
  `;
}

async function decidir(id,dec){

  let motivo='';

  if(dec==='NEGADA'){

    motivo=
      prompt(
        'Informe o motivo da recusa:',
        ''
      )||'';

    if(!motivo.trim())
      return;

  }
  else{

    motivo=
      prompt(
        'Observação da aprovação (opcional):',
        ''
      )||'';
  }

  await api(
    'decide_permuta_request',
    {
      id,
      decisao:dec,
      motivo
    }
  );

  await renderPermutasComando();
}

async function excluir(id){

  const motivo=
    prompt(
      'Informe o motivo da exclusão administrativa:',
      'Solicitação registrada de forma equivocada'
    )||'';

  if(!motivo.trim())
    return;

  await api(
    'admin_delete_permuta_request',
    {
      id,
      motivo
    }
  );

  await renderPermutasComando();
}

let renderizando=false;

async function renderPermutasComando(){

  const host=
    document.getElementById(
      'listaPermutasSolicitadas'
    );

  const compEl=
    document.getElementById(
      'pmCompetenciaFiltro'
    );

  if(
    !host ||
    !compEl ||
    renderizando
  )
    return;

  renderizando=true;

  try{

    const [
      sess,
      data,
      refs,
      mirror
    ]=await Promise.all([
      api('session'),
      api('data'),
      api('references')
        .catch(()=>({
          guardas:[]
        })),
      api(
        'entity_list',
        {
          entity:'permutas',
          limit:500,
          offset:0
        }
      )
    ]);

    const s=
      sess.session||
      {};

    if(!gestor(s))
      return;

    nomes=new Map(
      (refs.guardas||[]).map(
        g=>[
          Number(g.id),
          g.nome_guerra||
          g.nome_completo||
          `GCM ${g.id}`
        ]
      )
    );

    const comp=
      compEl.value||
      hoje().slice(0,7);

    const hist=
      (mirror.records||[])
        .map(x=>x.data||{})
        .filter(
          x=>
            competenciaHist(x)===comp
        );

    const req=
      (data.action_requests||[])
        .filter(
          x=>
            String(
              x.tipo||
              ''
            ).toUpperCase()==='PERMUTA' &&
            competenciaReq(x)===comp
        );

    const byDesktop=
      new Map(
        req
          .filter(
            x=>
              x.desktop_referencia_id!=null
          )
          .map(
            x=>[
              String(
                x.desktop_referencia_id
              ),
              x
            ]
          )
      );

    const histIds=
      new Set(
        hist.map(
          x=>
            String(
              x.id??
              x.desktop_id??
              ''
            )
        )
      );

    const itens=[];

    for(const h of hist){

      const r=
        byDesktop.get(
          String(
            h.id??
            h.desktop_id??
            ''
          )
        );

      itens.push({
        pend:
          PEND.has(
            status(
              r?.status||
              h.status
            )
          ),
        date:String(
          h.data||
          ''
        ),
        html:cardHist(h,r)
      });
    }

    for(const r of req){

      if(
        r.desktop_referencia_id!=null &&
        histIds.has(
          String(
            r.desktop_referencia_id
          )
        )
      )
        continue;

      itens.push({
        pend:
          PEND.has(
            status(r.status)
          ),
        date:String(
          r.payload?.data||
          r.created_at||
          ''
        ),
        html:cardReq(r)
      });
    }

    itens.sort(
      (a,b)=>
        Number(b.pend)-
        Number(a.pend) ||
        b.date.localeCompare(a.date)
    );

    const pend=
      itens.filter(x=>x.pend);

    const anal=
      itens.filter(x=>!x.pend);

    const title=
      document.getElementById(
        'pmListaTitulo'
      ) ||
      [
        ...document.querySelectorAll(
          'h2,h3,strong'
        )
      ].find(
        x=>
          /Minhas solicitações de permuta|Consulta.*permutas/i
            .test(
              x.textContent||
              ''
            )
      );

    if(title)
      title.textContent=
        'Consulta de permutas — Comando/Subcomando';

    host.innerHTML=
      `
        <div class="notice">
          <b>${itens.length}</b>
          permuta(s) em ${esc(comp)}
          · <b>${pend.length}</b>
          aguardando fluxo/análise
          · <b>${anal.length}</b>
          analisada(s)/histórica(s).
          Consulta sem filtro por GCM ou status.
        </div>
      ` +
      (
        pend.length
          ?`
            <h3>
              Aguardando análise / conclusão
            </h3>
            ${pend
              .map(x=>x.html)
              .join('')}
          `
          :`
            <div class="empty">
              Nenhuma permuta pendente
              nesta competência.
            </div>
          `
      ) +
      (
        anal.length
          ?`
            <h3 style="margin-top:18px">
              Analisadas / histórico
            </h3>
            ${anal
              .map(x=>x.html)
              .join('')}
          `
          :''
      );

    host
      .querySelectorAll(
        '[data-v62-ok]'
      )
      .forEach(
        b=>
          b.onclick=()=>
            decidir(
              Number(
                b.dataset.v62Ok
              ),
              'APROVADA'
            )
      );

    host
      .querySelectorAll(
        '[data-v62-no]'
      )
      .forEach(
        b=>
          b.onclick=()=>
            decidir(
              Number(
                b.dataset.v62No
              ),
              'NEGADA'
            )
      );

    host
      .querySelectorAll(
        '[data-v62-del]'
      )
      .forEach(
        b=>
          b.onclick=()=>
            excluir(
              Number(
                b.dataset.v62Del
              )
            )
      );

    document
      .getElementById(
        'permutaGestaoCard'
      )
      ?.classList.add('hidden');

  }
  catch(e){

    console.warn(
      '[GCMBS] permutas v62:',
      e
    );

  }
  finally{

    renderizando=false;
  }
}

function instalarPermutas(){

  const comp=
    document.getElementById(
      'pmCompetenciaFiltro'
    );

  const host=
    document.getElementById(
      'listaPermutasSolicitadas'
    );

  if(!comp || !host)
    return;

  if(!comp.dataset.v62){

    comp.dataset.v62='1';

    comp.addEventListener(
      'change',
      ()=>
        setTimeout(
          renderPermutasComando,
          50
        )
    );
  }

  if(!host.dataset.v62obs){

    host.dataset.v62obs='1';

    new MutationObserver(
      ()=>{
        if(!renderizando)
          setTimeout(
            renderPermutasComando,
            80
          );
      }
    ).observe(
      host,
      {
        childList:true
      }
    );
  }

  setTimeout(
    renderPermutasComando,
    50
  );
}

function aplicar(){

  corrigirData();
  instalarSync();
  instalarPermutas();
}

window.addEventListener(
  'DOMContentLoaded',
  ()=>{
    atualizarBadge();
    setInterval(
      atualizarBadge,
      15000
    );
    setTimeout(aplicar,100);
    setTimeout(aplicar,800);
  }
);

document.addEventListener(
  'click',
  e=>{

    const t=
      e.target instanceof Element
        ?e.target
        :null;

    if(t?.closest('#occNovo'))
      setTimeout(
        ()=>{
          const x=
            document.getElementById(
              'occData'
            );
          if(x)
            x.value=hoje();
        },
        20
      );

    if(t?.closest('#chkNovo'))
      setTimeout(
        ()=>{
          const x=
            document.getElementById(
              'chkData'
            );
          if(x)
            x.value=hoje();
        },
        20
      );

  },
  true
);

window.addEventListener(
  'gcmbs:sync-refresh',
  atualizarBadge
);

console.info(
  '[GCMBS] consolidação Online/App 10.0.76 ativa'
);
