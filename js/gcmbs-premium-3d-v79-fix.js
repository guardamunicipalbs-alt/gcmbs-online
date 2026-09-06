/* GCMBS Premium 3D v79 — limpeza de heranças v77 e composição do dashboard aprovado. */
(()=>{
  'use strict';
  const root=document.documentElement;
  if(root.dataset.gc79Refined==='1')return;
  root.dataset.gc79Refined='1';
  root.classList.add('gc78-premium','gc79-refined');
  root.classList.remove('gc77-preview');
  root.dataset.gc77Premium='1';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const strip=v=>txt(v).replace(/[\p{Extended_Pictographic}\u2600-\u27BF]/gu,'').replace(/\s+/g,' ').trim();
  const paths={overview:'M4 5h6v6H4z M14 5h6v4h-6z M14 13h6v6h-6z M4 15h6v4H4z',users:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21a6 6 0 0 1 12 0',pin:'M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13 M12 11a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6',calendar:'M5 6h14v14H5z M8 3v5 M16 3v5 M5 10h14',swap:'M4 8h13 M14 5l3 3-3 3 M20 16H7 M10 13l-3 3 3 3',car:'M4 14l2-5h12l2 5v5h-2 M6 19H4v-5h16v5h-2 M7 17h.01 M17 17h.01',bell:'M6 17h12 M8 17V10a4 4 0 0 1 8 0v7 M10 20h4',page:'M6 3h9l3 3v15H6z M15 3v4h4 M9 12h6',shield:'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2',wallet:'M4 7h16v12H4z M4 10h16 M8 15h3'};
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.page}"/></svg>`;
  function iconFor(label){const s=norm(label);if(/quadro|inicio|dashboard/.test(s))return'overview';if(/guarda|equipe|perfil|efetivo/.test(s))return'users';if(/posto/.test(s))return'pin';if(/permuta|troca/.test(s))return'swap';if(/viatura|frota/.test(s))return'car';if(/aviso|pendencia|notifica/.test(s))return'bell';if(/evento|escala|extra|feriado/.test(s))return'calendar';if(/banco|hora/.test(s))return'clock';if(/folha|pagamento/.test(s))return'wallet';if(/acesso|segur/.test(s))return'shield';return'page'}
  function unwrap(el){if(!el||!el.parentNode)return;while(el.firstChild)el.parentNode.insertBefore(el.firstChild,el);el.remove()}
  function cleanupLegacy(){
    root.classList.remove('gc77-preview');root.dataset.gc77Premium='1';
    $$('link[href*="gcmbs-online-premium-v77"],script[src*="gcmbs-online-premium-v77"]').forEach(x=>x.remove());
    $$('.gc77-topbar-context,.gc77-avatar,.gc77-eyebrow,.gc77-card-icon').forEach(x=>x.remove());
    $$('.gc77-overview-grid,.gc77-bottom-grid').forEach(unwrap);
    $$('[data-gc77-tone]').forEach(x=>x.removeAttribute('data-gc77-tone'));
    const crest=$('.gc78-brand-crest img');if(crest)crest.src='brasao-gcmbs.png';
  }
  function normalizeNav(){
    const nav=$('nav.desktop-nav');if(!nav)return;
    $$('.nav-group-body button,.nav-fixed button',nav).forEach(btn=>{
      const badge=btn.querySelector('.nav-badge');if(badge)badge.remove();
      const clone=btn.cloneNode(true);$$('.nav-badge,.nav-icon',clone).forEach(x=>x.remove());
      let label=strip(btn.querySelector('.nav-label')?.textContent||clone.textContent||btn.title||'');
      if(!label)label=strip(btn.title)||'Menu';
      const icon=document.createElement('span');icon.className='nav-icon';icon.innerHTML=svg(iconFor(label));
      const copy=document.createElement('span');copy.className='nav-label';copy.textContent=label;
      btn.replaceChildren(icon,copy);if(badge)btn.appendChild(badge);btn.title=label;
    });
  }
  function card(id){const el=$(id);return el&&el.closest('.dashboard-card')}
  function sector(name){return $$('.dashboard-sector').find(s=>norm(s.querySelector('h2')?.textContent).includes(name))||null}
  function compose(){
    const home=$('section[data-view="inicio"]');if(!home)return;
    const hero=$(':scope > .card.hero',home);if(!hero)return;
    let kpi=home.querySelector('.gc79-kpi-strip');
    if(!kpi){kpi=document.createElement('div');kpi.className='gc79-kpi-strip';hero.after(kpi)}
    ['#qAtivos','#qServicoA','#qServicoB','#qViaturasDisponiveis','#qViaturasTotal','#qPostos'].map(card).filter(Boolean).forEach(c=>{c.classList.add('gc79-kpi-card');kpi.appendChild(c)});
    let analytics=home.querySelector('.gc78-analytics-grid');if(analytics)kpi.after(analytics);
    const eff=sector('efetivo'),fleet=sector('viaturas'),posts=sector('postos');
    let details=home.querySelector('.gc79-details-grid');
    if(!details){details=document.createElement('div');details.className='gc79-details-grid';(analytics||kpi).after(details)}
    if(eff&&eff.parentElement!==details)details.appendChild(eff);
    if(fleet&&fleet.parentElement!==details)details.appendChild(fleet);
    const notice=$('#qAviso');if(notice&&!notice.classList.contains('gc79-alert-slot')){notice.classList.add('gc79-alert-slot');details.appendChild(notice)}
    if(posts)posts.classList.add('gc79-hidden-section');
    const avisos=$('#quadroAvisosHome');if(avisos&&avisos.previousElementSibling!==details)details.after(avisos);
  }
  function ensureTopbar(){const ctx=$('.gc78-topbar-context');if(ctx)ctx.style.display='flex'}
  function apply(){cleanupLegacy();normalizeNav();compose();ensureTopbar()}
  let scheduled=false;const queue=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  const obs=new MutationObserver(queue);obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  setTimeout(()=>{apply();obs.disconnect();new MutationObserver(()=>{root.classList.remove('gc77-preview')}).observe(root,{attributes:true,attributeFilter:['class']})},1800);
})();
