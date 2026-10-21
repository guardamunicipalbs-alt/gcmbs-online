(function gcmbsPermutaUXV302(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=s=>{const v=String(s||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(v)?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:'Data não selecionada';};
  const selected=id=>{const e=$(id),o=e?.selectedOptions?.[0];return e?.value&&o?String(o.textContent||'').trim():'Não selecionado';};
  const service=(data,turno)=>`${date($(data)?.value)} · ${selected(turno)}`;
  const rules={
    ASSUNCAO:{name:'Assumir serviço ordinário',step1:'Escolha o serviço de outro GCM que você irá assumir.',step2:'Não existe serviço em troca nem compensação futura.',accept:'Análise e autorização do Comando.',finance:'Sem crédito de extra por esta modalidade.'},
    CESSAO_EXTRA:{name:'Assumir um serviço extra',step1:'Escolha o Extra Manual ou por Evento que pertence a outro GCM.',step2:'O titular atual deve autorizar sua assunção.',accept:'Aceite do titular + autorização do Comando.',finance:'Crédito do extra segue a assunção aprovada e as regras de apuração.'},
    TROCA_EXTRA:{name:'Troca bilateral de extras',step1:'Selecione primeiro o seu extra.',step2:'Selecione o extra do outro GCM, com a mesma duração.',accept:'Aceite da contraparte + autorização do Comando.',finance:'Cada crédito financeiro permanece com o titular original.'},
    TROCA_ORDINARIO_EXTRA:{name:'Trocar meu ordinário por um extra',step1:'Informe a data e o turno do SEU ordinário.',step2:'Escolha a data e o extra de OUTRO GCM, da mesma duração.',accept:'Aceite do titular do extra + autorização do Comando.',finance:'Troca operacional; o crédito do extra permanece com o titular original.'},
    TROCA_ORDINARIO:{name:'Troca ordinário por ordinário',step1:'Escolha o serviço do OUTRO GCM que você irá tirar.',step2:'Informe o SEU serviço que o outro GCM tirará em troca.',accept:'Aceite da contraparte + autorização do Comando.',finance:'Dois serviços com a mesma duração, sem transferência financeira.'},
    AGENDADA:{name:'Troca agendada / compensação futura',step1:'Escolha a data e o serviço de outro GCM que você cobrirá AGORA.',step2:'A compensação futura ainda não tem data: deverá ser do mesmo tipo e duração.',accept:'Aceite do titular, validação Desktop e aprovação do Comando.',finance:'A obrigação só nasce após frequência confirmada; sem crédito/débito imediato.'}
  };
  const text=(el,s)=>{if(el?.firstChild?.nodeType===Node.TEXT_NODE)el.firstChild.textContent=s;};
  function render(){
    const form=$('formPermuta'),modal=$('pmModalidade'),host=$('pmResumoModalidadeV302');if(!form||!modal||!host)return;
    const mode=modal.value||'ASSUNCAO',r=rules[mode]||rules.ASSUNCAO;
    const tipo=$('pmAgTipoV259')?.value||'ORDINARIO';
    const extra=tipo==='EXTRA';
    const lblData=$('pmData')?.closest('label'),lblSub=$('pmSubstituto')?.closest('label'),lblTurno=$('pmTurno')?.closest('label');
    text(lblData,mode==='TROCA_ORDINARIO_EXTRA'?'Data do MEU ordinário':mode==='TROCA_ORDINARIO'?'Data do serviço do OUTRO GCM':mode==='AGENDADA'?'Data do serviço que assumirei':'Data do serviço ordinário');
    text(lblSub,mode==='TROCA_ORDINARIO'?'GCM titular do serviço que assumirei':mode==='AGENDADA'?'GCM titular do serviço que assumirei':'GCM substituído');
    text(lblTurno,mode==='TROCA_ORDINARIO_EXTRA'?'Turno do MEU ordinário':'Turno do serviço');
    const lMeu=$('pmExtraMeuLabel'),lOut=$('pmExtraOutro')?.closest('label');
    text(lMeu,mode==='TROCA_EXTRA'?'Meu serviço extra':'Seu serviço extra (Manual ou Evento)');
    text(lOut,mode==='TROCA_EXTRA'?'Extra do OUTRO GCM':mode==='AGENDADA'?'Extra que vou assumir AGORA':'Serviço extra do outro GCM (Manual ou Evento)');
    text($('pmDataContrapartida')?.closest('label'),'Data do MEU serviço que será cumprido pelo outro GCM');
    text($('pmTurnoContrapartida')?.closest('label'),'Turno do MEU serviço em contrapartida');
    let s1='',s2='';
    if(mode==='ASSUNCAO'){s1=`${service('pmData','pmTurno')} · ${selected('pmSubstituto')}`;s2='Sem serviço de retorno';}
    else if(mode==='CESSAO_EXTRA'){s1=selected('pmExtraOutro');s2='O titular autoriza a assunção';}
    else if(mode==='TROCA_EXTRA'){s1=selected('pmExtraMeu');s2=selected('pmExtraOutro');}
    else if(mode==='TROCA_ORDINARIO_EXTRA'){s1=service('pmData','pmTurno');s2=`${date($('pmExtraData')?.value)} · ${selected('pmExtraOutro')}`;}
    else if(mode==='TROCA_ORDINARIO'){s1=`${service('pmData','pmTurno')} · ${selected('pmSubstituto')}`;s2=service('pmDataContrapartida','pmTurnoContrapartida');}
    else if(mode==='AGENDADA'){s1=extra?selected('pmExtraOutro'):`${service('pmData','pmTurno')} · ${selected('pmSubstituto')}`;s2='A definir após execução do primeiro serviço';}
    host.innerHTML=`<div class="pmux-title"><strong>${esc(r.name)}</strong><span>Preencha conforme os passos abaixo</span></div>
      <div class="pmux-two">
        <div class="pmux-step"><span class="pmux-number">1</span><div><b>${esc(r.step1)}</b><small>${esc(s1)}</small></div></div>
        <div class="pmux-step"><span class="pmux-number">2</span><div><b>${esc(r.step2)}</b><small>${esc(s2)}</small></div></div>
      </div>
      <p class="pmux-approval"><b>Autorização:</b> ${esc(r.accept)} <span class="pmux-separator">•</span> <b>Horas:</b> ${esc(r.finance)}</p>`;
    host.dataset.modalidade=mode;
  }
  function initialize(){
    const form=$('formPermuta'),modal=$('pmModalidade');if(!form||!modal)return;
    if(!$('pmResumoModalidadeV302')){
      const el=document.createElement('section');el.id='pmResumoModalidadeV302';el.className='full pmux-guide';el.setAttribute('aria-label','Orientações da modalidade de permuta');
      const cfg=$('gcmbsAgCfgV259');(cfg||modal.closest('label'))?.insertAdjacentElement('afterend',el);
    }
    const help=[...form.querySelectorAll('div.notice')].find(x=>/Qual opção usar\?/.test(x.textContent||''));
    if(help&&!$('pmAjudaCompletaV302')){
      const details=document.createElement('details');details.id='pmAjudaCompletaV302';details.className='full pmux-help';
      const sum=document.createElement('summary');sum.textContent='Ver regras completas das 6 modalidades';
      help.insertAdjacentElement('beforebegin',details);details.appendChild(sum);details.appendChild(help);
    }
    const cfg=$('gcmbsAgCfgV259'),host=$('pmResumoModalidadeV302');
    if(cfg&&host&&host.previousElementSibling!==cfg)cfg.insertAdjacentElement('afterend',host);
    if(!form.dataset.pmuxListenersV302){
      form.dataset.pmuxListenersV302='1';
      form.addEventListener('change',()=>queueMicrotask(render));
      form.addEventListener('input',ev=>{if(ev.target?.matches?.('input,select,textarea'))render()});
      for(const id of ['pmSubstituto','pmExtraMeu','pmExtraOutro']){
        const sel=$(id);if(sel)new MutationObserver(()=>render()).observe(sel,{childList:true,subtree:true});
      }
    }
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
  document.addEventListener('change',ev=>{if(ev.target?.id==='pmModalidade'||ev.target?.id==='pmAgTipoV259')queueMicrotask(initialize)},true);
  window.addEventListener('pageshow',()=>setTimeout(initialize,0));
  console.info('[GCMBS V302] Guia de permutas por modalidade carregado.');
})();
