(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\s]+/g,' ').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const titleMap={
    'cadastro guardas':'Cadastro de Guardas',
    'cadastro_guardas':'Cadastro de Guardas',
    'guardas':'Guardas',
    'equipes':'Equipes',
    'postos operacionais':'Postos Operacionais',
    'postos_operacionais':'Postos Operacionais',
    'tipos de escalas':'Tipos de Escalas',
    'tipos_escala':'Tipos de Escalas',
    'escala extra':'Escala Extra',
    'escala_extra':'Escala Extra',
    'controle acesso':'Controle de Acesso',
    'controle_acesso':'Controle de Acesso',
    'justificativas faltas':'Justificativa de Faltas',
    'justificativas_faltas':'Justificativa de Faltas'
  };

  function patchFriendlyTitles(){
    const targets=$$('#onlineTitulo,.desktop-page-head h1,.desktop-page-head h2,[data-view] h1:first-child,[data-view] h2:first-child');
    targets.forEach(el=>{
      const k=norm(text(el));
      if(titleMap[k]) el.textContent=titleMap[k];
    });
  }

  function contextInfo(){
    const raw=[
      text($('#onlineTitulo')),
      text($('.desktop-page-head h1')),
      text($('.desktop-page-head h2')),
      text(document.querySelector('[data-view] h1')),
      text(document.querySelector('[data-view] h2')),
      text(document.querySelector('h1')),
      text(document.querySelector('h2'))
    ].filter(Boolean).join(' | ');
    const n=norm(raw);
    return {
      title: raw,
      norm: n,
      guardas: /cadastro guardas|guardas cadastrados|cadastro de guardas|guardas/.test(n),
      equipes: /equipes/.test(n),
      postos: /postos operacionais|postos/.test(n),
      tipos: /tipos de escalas|tipos escala/.test(n),
      justificativas: /justificativa de faltas|justificativas de faltas/.test(n)
    };
  }

  function activeView(){
    const views=$$('[data-view]');
    for(const v of views){
      const style=getComputedStyle(v);
      if(style.display!=='none' && !v.classList.contains('hidden') && !v.hidden) return v;
    }
    return document.querySelector('main')||document.body;
  }

  function hasFormControls(el){return !!el && $$('input,select,textarea',el).length>=2}
  function hasActionButtons(el){return /(salvar|novo|limpar|editar|excluir|cancelar)/i.test(text(el))}
  function isRecordsHost(el){return !!el && (el.id==='onlineRegistrosCard' || !!$('#onlineRegistros',el) || !!$('table',el) || $$('[data-online-key]',el).length>0)}

  function findFormCard(view){
    const direct=$('#onlineFormularioCard',view);
    if(direct) return direct;
    const all=$$('section,article,div',view);
    return all.find(el=>{
      if(isRecordsHost(el)) return false;
      if(!hasFormControls(el)) return false;
      return hasActionButtons(el);
    }) || null;
  }

  function findRecordsCard(view){
    const direct=$('#onlineRegistrosCard',view);
    if(direct) return direct;
    const reg=$('#onlineRegistros',view);
    if(reg) return reg.closest('section,article,div') || reg;
    const table=$('table',view);
    if(table) return table.closest('section,article,div') || table;
    const card=$$('[data-online-key]',view)[0];
    return card ? (card.closest('section,article,div') || card.parentElement || card) : null;
  }

  function ensureSectionHead(card,title,subtitle,kind){
    if(!card) return;
    let head=$('.gc104-section-head',card);
    if(!head){
      head=document.createElement('div');
      head.className='gc104-section-head';
      head.innerHTML=`<div><h2>${esc(title)}</h2><p>${esc(subtitle||'')}</p></div><div class="gc104-list-tools"></div>`;
      card.insertBefore(head,card.firstChild);
    }else{
      $('h2',head)?.replaceChildren(document.createTextNode(title));
      const p=$('p',head); if(p) p.textContent=subtitle||'';
    }
    card.dataset.gc104Kind=kind||'';
  }

  function moveSearchIntoList(view,listCard){
    if(!listCard) return;
    const tools=$('.gc104-list-tools',listCard) || (()=>{ const d=document.createElement('div'); d.className='gc104-list-tools'; listCard.insertBefore(d,listCard.firstChild); return d;})();
    const candidates=$$('input[type="search"],input[placeholder*="Pesquisar"],input[placeholder*="pesquisar"]',view)
      .filter(el=>!tools.contains(el));
    const search=candidates.find(el=>!listCard.contains(el) || !el.closest('.gc104-list-tools')) || candidates[0];
    if(search){
      let host=search.closest('label,div,section,article')||search;
      if(host.closest('.gc104-form-card')) return;
      if(host.parentElement!==tools){ tools.prepend(host); }
    }
  }

  function hideRedundantSummary(view,formCard,listCard){
    $$(':scope > section,:scope > article,:scope > div',view).forEach(el=>{
      if(el===formCard || el===listCard) return;
      if(el.contains(formCard) || el.contains(listCard)) return;
      if(hasFormControls(el) || isRecordsHost(el)) return;
      const t=norm(text(el));
      if(/registros|visualizacao|todos os registros|online 10\.0|edicao/.test(t)) el.classList.add('gc104-hide');
    });
  }

  function collectSummaryCards(view,listCard,info){
    if(!info.guardas) return;
    if($('.gc104-summary-strip',view)) return;
    const raw=[];
    $$('section,article,div',view).forEach(el=>{
      if(el===listCard || el.contains(listCard)) return;
      const t=norm(text(el));
      if(/registros/.test(t) && /visualizacao|todos os registros/.test(t)) raw.push(el);
    });
    if(!raw.length) return;
    const strip=document.createElement('div');
    strip.className='gc104-summary-strip';
    strip.innerHTML=`<div class="gc104-summary-box"><span>Registros</span><b>${esc(readMetric(raw,'registros')||'')}</b></div>`+
      `<div class="gc104-summary-box"><span>Visualização</span><b style="font-size:18px;line-height:1.2">${esc(readMetric(raw,'visualizacao')||'Todos os registros')}</b></div>`;
    listCard.parentElement?.insertBefore(strip,listCard);
    raw.forEach(el=>el.classList.add('gc104-hide'));
  }

  function readMetric(nodes,key){
    const target=nodes.map(text).join(' ');
    if(key==='registros'){
      const m=target.match(/registros\s*(\d+)/i)||target.match(/(\d+)\s*registros/i); return m?m[1]:'';
    }
    if(key==='visualizacao'){
      const m=target.match(/visualiza(?:c|ç)ao\s*([^0-9].+)/i)||target.match(/todos os registros/i); return m?m[1].trim():'Todos os registros';
    }
    return '';
  }

  function fieldByLabel(card,labels){
    const want=labels.map(norm);
    const all=$$('label,strong,b,span,div,td,th,small,p',card);
    for(const el of all){
      const t=norm(text(el)).replace(/:$/,'');
      if(!t || !want.includes(t)) continue;
      let sib=el.nextElementSibling;
      while(sib && !text(sib)) sib=sib.nextElementSibling;
      if(sib && norm(text(sib))!==t) return text(sib);
      const kids=el.parentElement ? Array.from(el.parentElement.children) : [];
      const idx=kids.indexOf(el);
      for(let i=idx+1;i<kids.length;i++){
        const val=text(kids[i]);
        if(val && norm(val)!==t) return val;
      }
      const m=text(el.parentElement).match(/^[^:]{2,40}:\s*(.+)$/);
      if(m) return m[1].trim();
    }
    return '';
  }

  function ensureSourceNote(listCard){
    if($('.gc104-record-note',listCard)) return;
    const note=document.createElement('div');
    note.className='gc104-record-note';
    note.textContent='Organização visual no padrão do Desktop: formulário acima e listagem abaixo. Os botões da tabela continuam abrindo as ações originais do cadastro.';
    listCard.insertBefore(note, $('.gc104-table-wrap',listCard) || $('#onlineRegistros',listCard) || listCard.children[1] || null);
  }

  function buildGuardTable(listCard){
    if(!listCard || $('.gc104-table-wrap',listCard)) return;
    const recordsRoot=$('#onlineRegistros',listCard) || listCard;
    const cards=$$('[data-online-key]',recordsRoot);
    if(!cards.length) return;
    const tableWrap=document.createElement('div');
    tableWrap.className='gc104-table-wrap';
    const table=document.createElement('table');
    table.className='gc104-data-table';
    table.innerHTML='<thead><tr><th>ID</th><th>Nome de guerra</th><th>Nome completo</th><th>Matrícula</th><th>CPF</th><th>Status</th><th>Ações</th></tr></thead><tbody></tbody>';
    const tbody=$('tbody',table);
    cards.forEach((card,idx)=>{
      const data={
        id: card.dataset.onlineKey || fieldByLabel(card,['id']) || String(idx+1),
        nomeGuerra: fieldByLabel(card,['nome de guerra','nome guerra','gcm']) || fieldByLabel(card,['nome']) || '',
        nome: fieldByLabel(card,['nome completo']) || '',
        matricula: fieldByLabel(card,['matricula']) || '',
        cpf: fieldByLabel(card,['cpf']) || '',
        status: fieldByLabel(card,['status']) || ''
      };
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="gc104-col-id">${esc(data.id)}</td><td>${esc(data.nomeGuerra)}</td><td>${esc(data.nome)}</td><td>${esc(data.matricula)}</td><td>${esc(data.cpf)}</td><td class="gc104-col-status">${esc(data.status)}</td><td class="gc104-col-actions"><div class="gc104-inline-actions"></div></td>`;
      const actions=$('.gc104-inline-actions',tr);
      const edit=$$('[data-online-edit],button,a',card).find(b=>/editar|abrir|acessar/i.test(text(b)));
      const del=$$('[data-online-del],button,a',card).find(b=>/excluir/i.test(text(b)));
      if(edit){
        const b=document.createElement('button'); b.type='button'; b.className='gc104-action-edit'; b.textContent=/acessar/i.test(text(edit))?'Acessar':'Editar'; b.onclick=ev=>{ev.preventDefault();edit.click()}; actions.appendChild(b);
        tr.addEventListener('dblclick',ev=>{ if(!ev.target.closest('button')) edit.click(); });
      }
      if(del){
        const b=document.createElement('button'); b.type='button'; b.className='gc104-action-del'; b.textContent='Excluir'; b.onclick=ev=>{ev.preventDefault();del.click()}; actions.appendChild(b);
      }
      tbody.appendChild(tr);
    });
    recordsRoot.classList.add('gc104-hidden-source');
    listCard.appendChild(tableWrap);
    tableWrap.appendChild(table);
    ensureSourceNote(listCard);
  }

  function styleGenericRecordCards(listCard){
    if(!listCard) return;
    const cards=$$('[data-online-key]',listCard);
    if(!cards.length) return;
    cards.forEach(card=>card.classList.add('gc104-keep-record-card'));
  }

  function organizeCadastro(){
    patchFriendlyTitles();
    const info=contextInfo();
    const isCadastro=info.guardas || info.equipes || info.postos || info.tipos || info.justificativas;
    document.body.classList.toggle('gc104-cadastro-on',isCadastro);
    if(!isCadastro) return;

    const view=activeView();
    if(!view) return;
    const formCard=findFormCard(view);
    const listCard=findRecordsCard(view);
    if(!(formCard||listCard)) return;
    view.classList.add('gc104-cadastro-layout');
    if(formCard) formCard.classList.add('gc104-form-card');
    if(listCard) listCard.classList.add('gc104-list-card');

    if(formCard){
      const formTitle=info.justificativas ? 'Registrar / editar' : 'Formulário de cadastro';
      const sub=info.justificativas ? 'Preencha os campos acima e salve a operação.' : 'Área de preenchimento e edição no mesmo padrão do Desktop.';
      ensureSectionHead(formCard, formTitle, sub, 'form');
    }
    if(listCard){
      const title=info.guardas?'Guardas cadastrados':info.equipes?'Equipes cadastradas':info.postos?'Postos cadastrados':info.tipos?'Tipos cadastrados':'Registros cadastrados';
      const sub='Listagem organizada abaixo do formulário, com ações à direita.';
      ensureSectionHead(listCard, title, sub, 'list');
      moveSearchIntoList(view,listCard);
      if(info.guardas) buildGuardTable(listCard); else styleGenericRecordCards(listCard);
      collectSummaryCards(view,listCard,info);
    }
    if(formCard && listCard && formCard.nextElementSibling!==listCard) formCard.insertAdjacentElement('afterend',listCard);
    hideRedundantSummary(view,formCard,listCard);
  }

  function tick(){ organizeCadastro(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick,{once:true}); else tick();
  [120,450,1200,2200].forEach(ms=>setTimeout(tick,ms));
  let timer=0;
  new MutationObserver(()=>{ clearTimeout(timer); timer=setTimeout(tick,70); }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  console.info('[GCMBS] Paridade V104 de cadastros Online/App ativa');
})();
