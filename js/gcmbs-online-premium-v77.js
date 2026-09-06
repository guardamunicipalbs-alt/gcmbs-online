/* GCMBS ONLINE — Premium Preview v77
   Somente apresentacao. Mantem os mesmos elementos, ids e listeners funcionais. */
(()=>{
  'use strict';
  const html=document.documentElement;
  if(html.dataset.gc77Premium==='1') return;
  html.dataset.gc77Premium='1';
  html.classList.add('gc77-preview');

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  const paths={
    overview:'M4 5h6v6H4z M14 5h6v4h-6z M14 13h6v6h-6z M4 15h6v4H4z',
    users:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M16 12a2.5 2.5 0 1 0 0-5 M3 21a6 6 0 0 1 12 0 M14 16a5 5 0 0 1 7 5',
    clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2',
    alert:'M12 3l9 17H3z M12 9v5 M12 17h.01',
    car:'M4 14l2-5h12l2 5v5h-2 M6 19H4v-5h16v5h-2 M7 17h.01 M17 17h.01 M7 14h10',
    map:'M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13 M12 11a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6',
    shield:'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
    page:'M6 3h9l3 3v15H6z M15 3v4h4 M9 12h6 M9 16h6',
    calendar:'M5 6h14v14H5z M8 3v5 M16 3v5 M5 10h14 M9 14h6',
    swap:'M4 8h13 M14 5l3 3-3 3 M20 16H7 M10 13l-3 3 3 3',
    wallet:'M4 7h16v12H4z M4 10h16 M8 15h3 M15 15h2',
    wrench:'M14 6a4 4 0 0 0 4 4l-8 8-4-4 8-8 M6 18l-2 2',
    fuel:'M7 3h8v18H7z M9 7h4 M15 8h2l2 2v7a2 2 0 0 0 2 2 M7 18h8',
    bell:'M6 17h12 M8 17V10a4 4 0 0 1 8 0v7 M10 20h4',
    check:'M5 4h14v16H5z M8 9l2 2 4-4 M8 15l2 2 4-4',
    sync:'M20 7v5h-5 M4 17v-5h5 M6.1 9A7 7 0 0 1 18 7 M17.9 15A7 7 0 0 1 6 17'
  };
  function icon(name){
    const d=paths[name]||paths.page;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  function iconForLabel(label){
    const s=norm(label);
    if(/quadro|dashboard/.test(s))return'overview';
    if(/guarda|equipe|efetivo|perfil/.test(s))return'users';
    if(/posto/.test(s))return'map';
    if(/permuta|troca/.test(s))return'swap';
    if(/banco|hora/.test(s))return'clock';
    if(/folha|pagamento/.test(s))return'wallet';
    if(/viatura|frota/.test(s))return'car';
    if(/manutenc/.test(s))return'wrench';
    if(/abastec/.test(s))return'fuel';
    if(/escala|evento|feriado|extra/.test(s))return'calendar';
    if(/pendencia|alerta|aviso|notifica/.test(s))return'bell';
    if(/acesso|segur/.test(s))return'shield';
    if(/check/.test(s))return'check';
    return'page';
  }

  function decorateNav(){
    const nav=$('nav.desktop-nav');if(!nav)return;
    $$('.nav-group-body button,.nav-fixed button',nav).forEach(btn=>{
      let label=btn.querySelector('.nav-label');
      if(!label){
        label=$$('span',btn).find(s=>!s.classList.contains('nav-badge')&&!s.classList.contains('nav-icon'))||null;
        if(label)label.classList.add('nav-label');
      }
      const labelText=txt(label?.textContent||btn.textContent);
      let host=btn.querySelector('.nav-icon');
      if(!host){host=document.createElement('span');host.className='nav-icon';btn.prepend(host)}
      const key=iconForLabel(labelText);
      if(host.dataset.gc77Icon!==key){host.innerHTML=icon(key);host.dataset.gc77Icon=key}
      if(!btn.title&&labelText)btn.title=labelText;
    });
    if(matchMedia('(min-width:900px)').matches&&!nav.querySelector('.gc-nav-collapse')){
      const brand=nav.querySelector('.nav-brand')||nav;
      const b=document.createElement('button');b.type='button';b.className='gc-nav-collapse';b.setAttribute('aria-label','Recolher ou expandir menu');b.title='Recolher/expandir menu';
      const collapsed=localStorage.getItem('gcmbs.premium.navCollapsed')==='1';if(collapsed)html.classList.add('gc-nav-collapsed');b.textContent=collapsed?'›':'‹';
      b.addEventListener('click',()=>{const c=html.classList.toggle('gc-nav-collapsed');b.textContent=c?'›':'‹';try{localStorage.setItem('gcmbs.premium.navCollapsed',c?'1':'0')}catch{}});
      brand.appendChild(b);
    }
  }

  function ensureTopbar(){
    const head=$('.app>header'); const brand=head?.querySelector('.brand-head');
    if(!head||!brand) return;
    let ctx=brand.querySelector('.gc77-topbar-context');
    if(!ctx){
      ctx=document.createElement('div');ctx.className='gc77-topbar-context';
      ctx.innerHTML=`<span class="gc77-topbar-icon">${icon('overview')}</span><div class="gc77-topbar-copy"><small>GCMBS · Painel institucional</small><strong>Quadro Operacional</strong></div>`;
      brand.appendChild(ctx);
    }
    const active=$('nav.desktop-nav button.active');
    const label=txt(active?.querySelector('.nav-label')?.textContent||active?.textContent||'Quadro Operacional');
    const strong=ctx.querySelector('strong'); if(strong&&label) strong.textContent=label;
    const user=$('#headerUsuario');
    if(user&&!head.querySelector('.gc77-avatar')){
      const av=document.createElement('span');av.className='gc77-avatar';
      av.textContent=(txt(user.textContent)||'GC').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'GC';
      user.before(av);
    }else if(user){
      const av=head.querySelector('.gc77-avatar');
      const initials=(txt(user.textContent)||'GC').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'GC';
      if(av&&av.textContent!==initials) av.textContent=initials;
    }
  }

  function pageEyebrows(){
    $$('.desktop-page-head,.module-page-head').forEach(head=>{
      const copy=head.firstElementChild;if(!copy||copy.querySelector('.gc77-eyebrow')) return;
      const e=document.createElement('div');e.className='gc77-eyebrow';
      const title=norm(copy.querySelector('h1,h2')?.textContent||'');
      e.textContent=title.includes('quadro operacional')?'Visão operacional':'Gestão institucional';
      copy.prepend(e);
    });
  }

  function dashboardIcon(card){
    if(card.querySelector('.gc77-card-icon')) return;
    const key=card.dataset.quadroDetail||'';const text=norm(card.textContent);
    let name='overview',tone='';
    if(key.startsWith('efetivo.')) name='users';
    if(key.includes('servico')) {name='clock';tone='service'}
    if(key.includes('faltas')||text.includes('afastad')||text.includes('ferias')) {name='alert';tone='attention'}
    if(key.startsWith('viaturas.')) {name='car';tone='fleet'}
    if(key.includes('disponivel')) tone='success';
    if(key.startsWith('postos.')) name='map';
    const host=document.createElement('span');host.className='gc77-card-icon';host.innerHTML=icon(name);card.appendChild(host);
    if(tone)card.dataset.gc77Tone=tone;
  }

  function composeDashboard(){
    const home=$('section[data-view="inicio"]');if(!home)return;
    const sectors=$$(':scope > .dashboard-sector',home);
    if(sectors.length<3)return;
    sectors.forEach(s=>$$('.dashboard-card',s).forEach(dashboardIcon));
    if(!home.querySelector('.gc77-overview-grid')){
      const effective=sectors.find(s=>norm(s.querySelector('h2')?.textContent).includes('efetivo'))||sectors[0];
      const fleet=sectors.find(s=>norm(s.querySelector('h2')?.textContent).includes('viaturas'))||sectors[1];
      if(effective&&fleet){const wrap=document.createElement('div');wrap.className='gc77-overview-grid';effective.before(wrap);wrap.append(effective,fleet)}
    }
    if(!home.querySelector('.gc77-bottom-grid')){
      const remaining=$$(':scope > .dashboard-sector',home);
      const posts=remaining.find(s=>norm(s.querySelector('h2')?.textContent).includes('postos'));
      const notices=$('#quadroAvisosHome',home);
      if(posts&&notices){const wrap=document.createElement('div');wrap.className='gc77-bottom-grid';posts.before(wrap);wrap.append(posts,notices)}
    }
  }

  function decorateTables(){
    $$('table').forEach(table=>{
      if(table.dataset.gc77Table)return;table.dataset.gc77Table='1';
      const headers=$$('thead th',table).map(th=>txt(th.textContent));
      $$('tbody tr',table).forEach(tr=>$$('td',tr).forEach((td,i)=>{if(headers[i]&&!td.dataset.label)td.dataset.label=headers[i]}));
      const p=table.parentElement;if(p&&/^(DIV|SECTION|ARTICLE)$/.test(p.tagName))p.classList.add('gc-table-wrap');
    });
  }

  function decorateModuleCards(){
    $$('.module-card,.record-card,.pending-card').forEach(card=>{
      if(card.dataset.gc77Decorated)return;card.dataset.gc77Decorated='1';
      const status=norm(card.textContent);
      if(/pendente|aguardando|revis/.test(status))card.style.setProperty('--gc77-card-mark','#d28a22');
      else if(/aprovad|ativo|disponivel|concluid/.test(status))card.style.setProperty('--gc77-card-mark','#2d9562');
      else if(/recus|cancelad|inativo|erro/.test(status))card.style.setProperty('--gc77-card-mark','#c45149');
    });
  }

  function activeContext(){
    ensureTopbar();const active=$('nav.desktop-nav button.active');const label=txt(active?.querySelector('.nav-label')?.textContent||active?.textContent||'');const ctx=$('.gc77-topbar-copy strong');if(ctx&&label)ctx.textContent=label;
  }

  function apply(){decorateNav();ensureTopbar();pageEyebrows();composeDashboard();decorateTables();decorateModuleCards();activeContext();}
  let scheduled=false;
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',queue,{passive:true});
})();
