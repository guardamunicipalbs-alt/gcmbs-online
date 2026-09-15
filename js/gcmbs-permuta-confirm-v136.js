/* GCMBS HF150 - confirmação segura de Permutas sem reload */
(()=>{
'use strict';

if(window.__GCMBS_PERMUTA_CONFIRM_HF150__) return;
window.__GCMBS_PERMUTA_CONFIRM_HF150__=true;

document.documentElement.dataset.gcmbsPermutaConfirm='HF150';

const GATEWAY =
'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';

const EXTRA_API =
'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68';

const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';

async function post(url,action,payload={}){

  const t=token();

  if(!t){
    throw new Error('Sessão não autenticada. Entre novamente no GCMBS.');
  }

  const r=await fetch(url,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+t
    },
    body:JSON.stringify({
      action,
      ...payload
    }),
    cache:'no-store'
  });

  let b={};

  try{
    b=await r.json();
  }catch{}

  if(!r.ok){
    throw new Error(
      b?.message ||
      ('Erro HTTP '+r.status)
    );
  }

  return b;
}

function cardOf(btn){
  return btn.closest(
    '.record-card,.item,article'
  );
}

function setBusy(card,busy){

  if(!card) return;

  card.querySelectorAll('button').forEach(b=>{
    b.disabled=busy;

    if(busy){
      b.setAttribute('aria-busy','true');
    }else{
      b.removeAttribute('aria-busy');
    }
  });
}

function mensagem(card,titulo,texto,status){

  if(!card) return;

  let box=card.querySelector(
    '[data-gcmbs-permuta-result]'
  );

  if(!box){

    box=document.createElement('div');

    box.setAttribute(
      'data-gcmbs-permuta-result',
      '1'
    );

    box.className='notice';

    box.style.marginTop='10px';

    card.appendChild(box);
  }

  box.innerHTML=
    '<strong>'+titulo+'</strong><br>'+
    '<span></span>';

  box.querySelector('span').textContent=texto||'';

  const pill=card.querySelector('.status-pill');

  if(pill && status){
    pill.textContent=status;
    pill.className='status-pill status-'+
      status.replace(/\s+/g,'_');
  }
}

function fecharAcoes(card){

  card?.querySelectorAll(
    '.request-actions'
  ).forEach(x=>{
    x.style.display='none';
  });
}

async function contraparte(btn,aceitou){

  const id=Number(
    btn.dataset.v58Accept ||
    btn.dataset.v58Reject ||
    0
  );

  if(!id){
    throw new Error('Identificador da permuta inválido.');
  }

  const pergunta=aceitou
    ? 'Confirmar autorização/aceite desta permuta de serviço extra?'
    : 'Recusar esta solicitação de permuta?';

  if(!confirm(pergunta)){
    return false;
  }

  const card=cardOf(btn);

  setBusy(card,true);

  try{

    const r=await post(
      EXTRA_API,
      'accept',
      {
        id,
        aceitou
      }
    );

    if(aceitou){

      mensagem(
        card,
        'Aceite registrado',
        'Sua autorização foi registrada. A solicitação seguirá para análise do Comando.',
        'PENDENTE'
      );

    }else{

      mensagem(
        card,
        'Solicitação recusada',
        'A recusa foi registrada no servidor.',
        'RECUSADA'
      );
    }

    fecharAcoes(card);

    document.dispatchEvent(
      new CustomEvent(
        'gcmbs:permuta-atualizada',
        {
          detail:{
            id,
            etapa:'CONTRAPARTE',
            aceitou,
            resposta:r
          }
        }
      )
    );

    return true;

  }catch(e){

    setBusy(card,false);
    throw e;
  }
}

async function comando(btn,aprovada){

  const id=Number(
    btn.dataset.cmdPmOk ||
    btn.dataset.cmdPmNo ||
    0
  );

  if(!id){
    throw new Error('Identificador da solicitação inválido.');
  }

  let motivo='';

  if(aprovada){

    const valor=prompt(
      'Observação da aprovação (opcional):',
      ''
    );

    if(valor===null){
      return false;
    }

    motivo=valor||'';

  }else{

    const valor=prompt(
      'Informe o motivo da recusa:',
      ''
    );

    if(valor===null){
      return false;
    }

    motivo=String(valor||'').trim();

    if(!motivo){
      alert('O motivo da recusa é obrigatório.');
      return false;
    }
  }

  const card=cardOf(btn);

  setBusy(card,true);

  try{

    const decisao=aprovada
      ? 'APROVADA'
      : 'NEGADA';

    const r=await post(
      GATEWAY,
      'decide_permuta_request',
      {
        id,
        decisao,
        motivo
      }
    );

    mensagem(
      card,
      'Decisão registrada',
      r?.message ||
      (
        aprovada
          ? 'Aprovação registrada e aguardando consolidação operacional.'
          : 'Recusa registrada e aguardando consolidação operacional.'
      ),
      'DECISÃO REGISTRADA'
    );

    fecharAcoes(card);

    card.dataset.gcmbsDecisionPending='1';

    document.dispatchEvent(
      new CustomEvent(
        'gcmbs:permuta-atualizada',
        {
          detail:{
            id,
            etapa:'COMANDO',
            decisao,
            resposta:r
          }
        }
      )
    );

    return true;

  }catch(e){

    setBusy(card,false);
    throw e;
  }
}

/*
  Captura antes dos handlers antigos.
  Assim o V58 não chega ao location.reload().
*/
document.addEventListener(
  'click',
  async e=>{

    const btn=e.target?.closest?.(
      '[data-v58-accept],'+
      '[data-v58-reject],'+
      '[data-cmd-pm-ok],'+
      '[data-cmd-pm-no]'
    );

    if(!btn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(btn.dataset.gcmbsHf150Busy==='1'){
      return;
    }

    btn.dataset.gcmbsHf150Busy='1';

    try{

      if(
        btn.hasAttribute('data-v58-accept') ||
        btn.hasAttribute('data-v58-reject')
      ){

        const ok=
          btn.hasAttribute('data-v58-accept');

        await contraparte(btn,ok);

      }else{

        const ok=
          btn.hasAttribute('data-cmd-pm-ok');

        await comando(btn,ok);
      }

    }catch(err){

      alert(
        err?.message ||
        'Não foi possível registrar a decisão.'
      );

    }finally{

      delete btn.dataset.gcmbsHf150Busy;
    }

  },
  true
);

})();