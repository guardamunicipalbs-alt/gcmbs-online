/*
 * GCMBS 10.0.76 — runtime do Design System Institucional
 * Exclusivamente apresentação/semântica visual. Não intercepta regras de negócio.
 */
(()=>{
  'use strict';
  const VERSION='10.0.76';
  const ROOT=document.documentElement;
  if(ROOT.dataset.gcDesignSystem==='76') return;
  ROOT.dataset.gcDesignSystem='76';
  ROOT.classList.add('gcmbs-ds');

  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>text(v).normalize?.('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()||text(v).toLowerCase();
  const safe=fn=>{try{return fn()}catch(e){console.warn('[GCMBS DS]',e);return null}};

  // Ícones vetoriais leves e consistentes, sem biblioteca externa.
  const ICONS={
    dashboard:'M4 4h6v6H4z M14 4h6v4h-6z M14 12h6v8h-6z M4 14h6v6H4z',
    cadastro_guardas:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M5 21a7 7 0 0 1 14 0',
    equipes:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M16 12a2.5 2.5 0 1 0 0-5 M3 21a6 6 0 0 1 12 0 M14 16a5 5 0 0 1 7 5',
    postos:'M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13 M12 11a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6',
    escalas:'M5 5h14v15H5z M8 3v4 M16 3v4 M5 9h14 M8 13h3 M13 13h3 M8 17h3',
    gerador_escala:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    escala_extra_manual:'M12 5v14 M5 12h14',
    eventos_extra:'M5 6h14v14H5z M8 3v5 M16 3v5 M5 10h14 M9 14h6',
    feriados:'M5 6h14v14H5z M8 3v5 M16 3v5 M5 10h14 M9 14l1.5 1.5L15 12',
    permutas:'M4 8h13 M14 5l3 3-3 3 M20 16H7 M10 13l-3 3 3 3',
    folha_pagamento:'M4 7h16v12H4z M4 10h16 M8 15h3 M15 15h2',
    banco_horas:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2',
    relatorios:'M6 3h9l3 3v15H6z M15 3v4h4 M9 11h6 M9 15h6 M9 19h4',
    viaturas:'M4 14l2-5h12l2 5v5h-2 M6 19H4v-5h16v5h-2 M7 17h.01 M17 17h.01 M7 14h10',
    manutencao_viaturas:'M14 6a4 4 0 0 0 4 4l-8 8-4-4 8-8 M6 18l-2 2',
    abastecimento_viaturas:'M7 3h8v18H7z M9 7h4 M15 8h2l2 2v7a2 2 0 0 0 2 2 M7 18h8',
    checklist_viaturas:'M5 4h14v16H5z M8 9l2 2 4-4 M8 15l2 2 4-4',
    relatorios_frota:'M6 3h9l3 3v15H6z M9 16h6 M8 11h8 M15 3v4h4',
    ocorrencias:'M7 4h10v17H7z M9 4V2h6v2 M10 9h4 M10 13h4 M10 17h3',
    cautelas:'M5 8h14v12H5z M9 8V5h6v3 M9 13h6',
    cursos:'M4 5h7a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4z M20 5h-7a3 3 0 0 0-3 3',
    operacoes_especiais:'M3 6h18v12H3z M3 7l9 7 9-7',
    frequencia:'M5 4h14v16H5z M8 8h8 M8 12h5 M8 16h3 M15 15l1.5 1.5L19 13',
    central_pendencias:'M12 3l9 17H3z M12 9v5 M12 17h.01',
    controle_acesso:'M7 11h10v10H7z M9 11V8a3 3 0 0 1 6 0v3 M12 15v2',
    imagens_gcm:'M4 5h16v14H4z M7 15l3-3 3 3 2-2 3 3 M9 9h.01'
  };
  const aliases={guardas:'cadastro_guardas',escala:'escalas',escala_extra:'escala_extra_manual',eventos:'eventos_extra',banco:'banco_horas',manutencao:'manutencao_viaturas',abastecimento:'abastecimento_viaturas',checklist:'checklist_viaturas',pendencias:'central_pendencias'};
  function svgIcon(key){key=aliases[key]||key;const d=ICONS[key];if(!d)return null;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');for(const part of d.split(' M').map((x,i)=>i?`M${x}`:x)){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',part);svg.appendChild(path)}return svg;}
  function decorateIcons(root=document){
    qsa('nav.desktop-nav button[data-module],button.btn[data-modulo],button[data-module].btn',root).forEach(btn=>{
      const key=btn.dataset.module||btn.dataset.modulo;if(!key)return;let host=btn.querySelector('.nav-icon,.icon');if(!host){host=document.createElement('span');host.className=btn.closest('nav.desktop-nav')?'nav-icon':'icon';btn.prepend(host)}
      const icon=svgIcon(key);if(icon&&host.dataset.gcIcon!==key){host.replaceChildren(icon);host.dataset.gcIcon=key;}
    });
  }


  function decorateStructure(root=document){
    qsa('main',root).forEach(el=>el.classList.add('gc-main'));
    qsa('.desktop-page-head,.module-page-head',root).forEach(el=>el.classList.add('gc-page-header'));
    qsa('.card',root).forEach(el=>el.classList.add('gc-card'));
    qsa('.dashboard-cards',root).forEach(el=>el.classList.add('gc-stat-grid'));
    qsa('.dashboard-card',root).forEach(el=>el.classList.add('stat-card'));
    qsa('.form-actions,.online-toolbar,.toolbar,.request-actions',root).forEach(el=>el.classList.add('gc-action-bar'));
    qsa('.empty',root).forEach(el=>el.classList.add('gc-empty'));
    qsa('dialog',root).forEach(el=>el.classList.add('gc-dialog'));
    qsa('.module-editor-card,.quadro-modal-card',root).forEach(el=>el.classList.add('gc-modal-card'));
  }

  const dangerWords=['excluir','remover','apagar','cancelar registro','estornar','reprovar','recusar','negar'];
  const successWords=['aprovar','concluir','finalizar'];
  const primaryWords=['confirmar','salvar','registrar','criar','adicionar','publicar','enviar'];
  const warningWords=['revisar','analisar','corrigir','ajustar','reabrir'];
  const neutralWords=['visualizar','detalhes','ver ','consultar','imprimir','baixar','voltar','fechar'];
  function decorateButtons(root=document){
    qsa('button,a.primary,a.secondary',root).forEach(btn=>{
      if(btn.closest('nav.desktop-nav')) return;
      btn.classList.add('gc-btn');
      const t=norm(btn.textContent||btn.getAttribute('aria-label')||'');
      if(btn.classList.contains('primary')) btn.classList.add('gc-btn-primary');
      else if(btn.classList.contains('danger')||btn.classList.contains('danger-soft')||dangerWords.some(w=>t.includes(w))) btn.classList.add('gc-btn-danger');
      else if(successWords.some(w=>t.startsWith(w)||t===w)) btn.classList.add('gc-btn-success');
      else if(primaryWords.some(w=>t.startsWith(w)||t===w)) btn.classList.add('gc-btn-primary');
      else if(warningWords.some(w=>t.includes(w))) btn.classList.add('gc-btn-warning');
      else if(neutralWords.some(w=>t.includes(w))||btn.classList.contains('secondary')||btn.classList.contains('mini')) btn.classList.add('gc-btn-secondary');
      else btn.classList.add('gc-btn-neutral');
    });
  }

  function requiredFields(root=document){
    qsa('input[required],select[required],textarea[required]',root).forEach(input=>{
      const label=input.closest('label'); if(label) label.classList.add('gc-required');
    });
  }

  const statusMap=[
    [/^(ativo|ativa|disponivel|disponível|aprovado|aprovada|ok|concluido|concluído|aberta|aberto)$/,'gc-status-active'],
    [/^(pendente|aguardando|em analise|em análise|revisao|revisão)$/,'gc-status-pending'],
    [/^(recusado|recusada|reprovado|reprovada|cancelado|cancelada|inativo|inativa|erro|fechada|fechado)$/,'gc-status-danger'],
    [/^(extra|ordinario|ordinário|evento|em servico|em serviço)$/,'gc-status-info'],
    [/^(ferias|férias|afastado|afastada|folga)$/,'gc-status-purple'],
    [/^(em manutencao|em manutenção|baixada|baixado|indisponivel|indisponível)$/,'gc-status-maintenance']
  ];
  function statusClass(v){const t=norm(v);for(const [rx,cls] of statusMap)if(rx.test(t))return cls;return'';}
  function classifyStatus(el){
    if(!el||el.dataset.gcStatusDone) return;
    const cls=statusClass(el.textContent);if(cls){el.classList.add('gc-badge',cls);el.dataset.gcStatusDone='1';}
  }
  function decorateStatuses(root=document){
    qsa('.badge,.status-pill,.level,[data-status]',root).forEach(classifyStatus);
    qsa('table',root).forEach(table=>{
      const headers=qsa('thead th',table).map(th=>norm(th.textContent));
      if(!headers.length)return;
      headers.forEach((h,i)=>{
        if(!/(status|situacao|situação|tipo|estado)/.test(h))return;
        qsa('tbody tr',table).forEach(tr=>{
          const td=qsa('td',tr)[i]; if(!td||!text(td.textContent))return;
          const cls=statusClass(td.textContent);if(cls)td.classList.add('gc-status-cell',cls.replace('gc-status-','gc-cell-'));
        });
      });
    });
  }

  function decorateTables(root=document){
    qsa('table',root).forEach(table=>{
      if(table.dataset.gcTableDone)return;
      table.dataset.gcTableDone='1';
      table.classList.add('gc-data-table');
      const headers=qsa('thead th',table).map(th=>text(th.textContent));
      qsa('tbody tr',table).forEach(tr=>qsa('td',tr).forEach((td,i)=>{if(headers[i]&&!td.dataset.label)td.dataset.label=headers[i]}));
      const host=table.parentElement;
      if(host&&/^(DIV|SECTION|ARTICLE)$/i.test(host.tagName))host.classList.add('gc-table-wrap');
      if(headers.length>=5&&!table.classList.contains('report-matrix'))table.classList.add('gc-card-table');
    });
  }

  function decorateAlerts(root=document){
    qsa('.notice,.record-warning,.audit-error,.request-message',root).forEach(el=>{
      el.classList.add('gc-alert'); const t=norm(el.textContent);
      if(/erro|falha|recus|reprov|cancelad/.test(t))el.classList.add('gc-alert-danger');
      else if(/atencao|atenção|aviso|pendente|vencid|revis/.test(t))el.classList.add('gc-alert-warning');
      else if(/sucesso|concluid|aprovad|salvo|registrado/.test(t))el.classList.add('gc-alert-success');
    });
  }

  function decorateNav(){
    const nav=qs('nav.desktop-nav'); if(!nav||nav.dataset.gcDsNav)return;
    nav.dataset.gcDsNav='1';
    qsa('button',nav).forEach(btn=>{
      const raw=btn.childNodes?.[0]?.textContent||'';
      if(text(raw)&&!btn.querySelector('.nav-icon')){
        const m=text(raw).match(/^([^\p{L}\p{N}]*)/u);const icon=m?.[1]?.trim();
        if(icon){const span=document.createElement('span');span.className='nav-icon';span.textContent=icon;btn.childNodes[0].textContent=raw.replace(icon,'');btn.prepend(span)}
      }
      if(!btn.title){const label=text(btn.querySelector('.nav-label')?.textContent||btn.querySelector('span:not(.nav-icon):not(.nav-badge)')?.textContent||btn.textContent);if(label)btn.title=label}
    });
    if(matchMedia('(min-width:900px)').matches){
      const brand=qs('.nav-brand',nav)||nav;
      const toggle=document.createElement('button');toggle.type='button';toggle.className='gc-nav-collapse';toggle.setAttribute('aria-label','Recolher ou expandir menu');toggle.title='Recolher/expandir menu';toggle.textContent='‹';
      const stored=localStorage.getItem('gcmbs.ds.navCollapsed')==='1';if(stored){ROOT.classList.add('gc-nav-collapsed');toggle.textContent='›'}
      toggle.addEventListener('click',()=>{const c=ROOT.classList.toggle('gc-nav-collapsed');toggle.textContent=c?'›':'‹';safe(()=>localStorage.setItem('gcmbs.ds.navCollapsed',c?'1':'0'))});
      brand.appendChild(toggle);
    }
  }

  function normalizeVersion(root=document){
    qsa('#onlineVersao,[data-gcmbs-version]',root).forEach(el=>{if(/online|app|10\.0\./i.test(el.textContent||''))el.textContent=`Online/App ${VERSION}`});
    const card=qs('#appAtualizacaoCard',root);if(card)card.innerHTML=card.innerHTML.replace(/10\.0\.\d+/g,VERSION);
  }

  function accessibility(root=document){
    qsa('input,select,textarea',root).forEach(el=>{
      if(!el.getAttribute('aria-label')&&!el.closest('label')){
        const ph=el.getAttribute('placeholder');if(ph)el.setAttribute('aria-label',ph);
      }
    });
  }

  function decorate(root=document){
    decorateStructure(root);decorateIcons(root);decorateButtons(root);requiredFields(root);decorateStatuses(root);decorateTables(root);decorateAlerts(root);normalizeVersion(root);accessibility(root);
    if(root===document||root.ownerDocument===document)decorateNav();
  }

  let frame=0;
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;decorate(document)})};
  const boot=()=>{
    decorate(document);
    const obs=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes?.length||m.type==='attributes'))schedule()});
    obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    window.addEventListener('pageshow',schedule);
    document.addEventListener('gcmbs:view-changed',schedule);
    console.info('[GCMBS] Design System Institucional 10.0.76 ativo');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
