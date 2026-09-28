'use strict';

(()=>{
  const API=
    'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-scheduled-permuta-v258';

  const token=()=>
    localStorage.getItem('gcmbs.mobile.token')||'';

  const esc=s=>
    String(s??'').replace(
      /[&<>"']/g,
      c=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c])
    );

  const fmt=d=>{
    const s=String(d||'').slice(0,10);

    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))
      return s||'-';

    const [y,m,a]=s.split('-');

    return `${a}/${m}/${y}`;
  };

  const hm=n=>{
    const v=Number(n||0);

    return v
      ?`${Math.floor(v/60)}h${String(v%60).padStart(2,'0')}`
      :'-';
  };

  async function call(action,payload={}){

    const t=token();

    if(!t)
      throw new Error('Sessao nao autenticada.');

    let r;

    try{
      r=await fetch(
        API,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${t}`
          },
          body:JSON.stringify({
            action,
            ...payload
          }),
          cache:'no-store'
        }
      );
    }catch{
      throw new Error(
        'Falha de comunicacao com o servidor.'
      );
    }

    let b={};

    try{b=await r.json()}catch{}

    if(!r.ok)
      throw new Error(
        b.message||
        `Erro ${r.status}`
      );

    return b;
  }


  function ensure(){

    let card=
      document.getElementById(
        'gcmbsAgendadaComandoV275'
      );

    if(card)return card;

    const base=
      document.getElementById('permutaCard');

    if(!base)return null;

    card=document.createElement('section');

    card.id='gcmbsAgendadaComandoV275';
    card.className='card hidden';

    card.innerHTML=`
      <h2>Permutas agendadas — análise do Comando</h2>

      <div class="notice" style="margin-bottom:12px">
        A decisão só é consolidada depois da aplicação pelo Desktop.
        Nenhuma hora é creditada ou debitada no momento da aprovação.
      </div>

      <div data-v275-msg
           style="margin-bottom:10px"></div>

      <div data-v275-list>
        Carregando...
      </div>
    `;

    base.insertAdjacentElement(
      'afterend',
      card
    );

    return card;
  }


  function statusLabel(st){

    const s=String(st||'').toUpperCase();

    const map={
      PENDENTE_COMANDO:'Aguardando decisão do Comando',
      DECISAO_PENDENTE_DESKTOP:'Decisão aguardando Desktop',
      RESERVADA:'Aprovada / reservada',
      NEGADA:'Negada',
      ERRO_DECISAO:'Erro ao aplicar decisão'
    };

    return map[s]||s||'-';
  }


  function detalhe(x){

    const p=x.payload||{};

    const tipo=
      String(
        p.tipo_servico_agendado||
        p.tipo_servico||
        ''
      ).toUpperCase();

    const data=
      p.data_origem||
      p.data||
      '';

    const devedor=
      x.contraparte_nome||
      `GCM #${p.devedor_id||p.contraparte_id||'-'}`;

    const credor=
      x.solicitante_nome||
      `GCM #${p.credor_id||p.solicitante_id||'-'}`;

    const dur=
      Number(p.duracao_minutos||0);

    const turno=
      p.turno_origem||
      p.turno||
      '';

    return `
      <div class="record-meta">
        <b>Serviço inicial:</b>
        ${esc(tipo==='EXTRA'?'Extra':'Ordinário')}
        · ${esc(fmt(data))}
        ${turno?` · Turno ${esc(turno)}`:''}
        ${dur?` · ${esc(hm(dur))}`:''}
      </div>

      <div>
        <b>Quem cobre agora:</b>
        ${esc(credor)}
      </div>

      <div>
        <b>Titular original:</b>
        ${esc(devedor)}
      </div>
    `;
  }


  function render(rows,canDecide){

    const card=ensure();

    if(!card)return;

    if(!canDecide){
      card.classList.add('hidden');
      return;
    }

    card.classList.remove('hidden');

    const host=
      card.querySelector('[data-v275-list]');

    const relevantes=
      (rows||[]).filter(x=>[
        'PENDENTE_COMANDO',
        'DECISAO_PENDENTE_DESKTOP',
        'RESERVADA',
        'NEGADA',
        'ERRO_DECISAO'
      ].includes(
        String(
          x.status_visual||
          x.status||
          ''
        ).toUpperCase()
      ));

    host.innerHTML=
      relevantes.length
        ?relevantes.map(x=>{

          const st=
            String(
              x.status_visual||
              x.status||
              ''
            ).toUpperCase();

          const pode=
            st==='PENDENTE_COMANDO';

          return `
            <article class="record-card"
                     style="margin-bottom:10px">

              <div class="record-card-head">
                <strong>
                  Troca agendada #${Number(x.id)}
                </strong>

                <span class="status-pill">
                  ${esc(statusLabel(st))}
                </span>
              </div>

              ${detalhe(x)}

              ${
                x.decisao_comando_resposta
                  ?`<small>${esc(x.decisao_comando_resposta)}</small>`
                  :''
              }

              ${
                pode
                  ?`
                    <div class="request-actions"
                         style="margin-top:10px">

                      <button class="mini"
                              data-v275-ok="${Number(x.id)}">
                        Aprovar
                      </button>

                      <button class="mini"
                              data-v275-no="${Number(x.id)}">
                        Recusar
                      </button>

                    </div>
                  `
                  :''
              }

            </article>
          `;

        }).join('')
        :'<div class="empty">Nenhuma Permuta Agendada aguardando análise.</div>';


    host.querySelectorAll('[data-v275-ok]')
      .forEach(b=>{

        b.onclick=()=>decidir(
          Number(b.dataset.v275Ok),
          'APROVADA'
        );
      });


    host.querySelectorAll('[data-v275-no]')
      .forEach(b=>{

        b.onclick=()=>decidir(
          Number(b.dataset.v275No),
          'NEGADA'
        );
      });
  }


  async function decidir(id,decisao){

    let motivo='';

    if(decisao==='NEGADA'){

      motivo=
        prompt(
          'Informe o motivo da recusa:',
          ''
        )||'';

      if(!motivo.trim())
        return;

    }else{

      if(!confirm(
        'Aprovar esta Permuta Agendada? '+
        'Nenhuma hora será movimentada imediatamente.'
      ))return;
    }

    const card=ensure();

    const msg=
      card?.querySelector('[data-v275-msg]');

    try{

      if(msg)
        msg.textContent='Registrando decisão...';

      const r=
        await call(
          'command_decide',
          {
            id,
            decisao,
            motivo_decisao:motivo
          }
        );

      if(msg)
        msg.textContent=
          r.message||
          'Decisão registrada.';

      await refresh();

    }catch(e){

      if(msg)
        msg.textContent=e.message;

      alert(e.message);
    }
  }


  async function refresh(){

    if(!token())return;

    try{

      const r=
        await call('list');

      render(
        r.requests||[],
        r.can_decide===true
      );

    }catch(e){

      const card=ensure();

      const msg=
        card?.querySelector('[data-v275-msg]');

      if(msg)
        msg.textContent=e.message;
    }
  }


  function start(){

    ensure();
    refresh();

    setInterval(
      refresh,
      15000
    );
  }


  if(document.readyState==='loading')
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {once:true}
    );
  else
    start();

})();