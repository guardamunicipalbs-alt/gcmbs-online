/* GCMBS Premium 3D v79 R2 — correções de runtime visual. */
(()=>{
  'use strict';
  const root=document.documentElement;
  if(root.dataset.gc79R2==='1')return;
  root.dataset.gc79R2='1';
  root.classList.add('gc78-premium','gc79-refined');
  root.classList.remove('gc77-preview');
  root.dataset.gc77Premium='1';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
  const strip=v=>txt(v).replace(/[\p{Extended_Pictographic}\u2600-\u27BF]/gu,'').replace(/\s+/g,' ').trim();
  const norm=v=>strip(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const paths={overview:'M4 5h6v6H4z M14 5h6v4h-6z M14 13h6v6h-6z M4 15h6v4H4z',users:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21a6 6 0 0 1 12 0',pin:'M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13 M12 11a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6',calendar:'M5 6h14v14H5z M8 3v5 M16 3v5 M5 10h14',swap:'M4 8h13 M14 5l3 3-3 3 M20 16H7 M10 13l-3 3 3 3',car:'M4 14l2-5h12l2 5v5h-2 M6 19H4v-5h16v5h-2 M7 17h.01 M17 17h.01',bell:'M6 17h12 M8 17V10a4 4 0 0 1 8 0v7 M10 20h4',page:'M6 3h9l3 3v15H6z M15 3v4h4 M9 12h6',shield:'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2',wallet:'M4 7h16v12H4z M4 10h16 M8 15h3'};
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.page}"/></svg>`;
  function iconFor(label){const s=norm(label);if(/quadro|inicio|dashboard/.test(s))return'overview';if(/guarda|equipe|perfil|efetivo/.test(s))return'users';if(/posto/.test(s))return'pin';if(/permuta|troca/.test(s))return'swap';if(/viatura|frota/.test(s))return'car';if(/aviso|pendencia|notifica/.test(s))return'bell';if(/evento|escala|extra|feriado/.test(s))return'calendar';if(/banco|hora/.test(s))return'clock';if(/folha|pagamento/.test(s))return'wallet';if(/acesso|segur/.test(s))return'shield';return'page'}

  function normalizeButton(btn){
    if(!btn)return;
    const badge=btn.querySelector('.nav-badge');
    const currentLabel=btn.querySelector('.nav-label');
    const clean=strip(currentLabel?.textContent||btn.title||btn.textContent)||'Menu';
    const expected=iconFor(clean);
    const currentIcon=btn.querySelector(':scope > .nav-icon');
    const normalized=btn.dataset.gc79R2Nav==='1'&&currentIcon&&currentIcon.dataset.gc79Icon===expected&&currentLabel&&strip(currentLabel.textContent)===clean&&Array.from(btn.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE&&txt(n.textContent)).length===0;
    if(normalized)return;
    const icon=document.createElement('span');icon.className='nav-icon';icon.dataset.gc79Icon=expected;icon.innerHTML=svg(expected);
    const copy=document.createElement('span');copy.className='nav-label';copy.textContent=clean;
    btn.replaceChildren(icon,copy);
    if(badge)btn.appendChild(badge);
    btn.title=clean;
    btn.dataset.gc79R2Nav='1';
  }

  function normalizeNav(){
    const nav=$('#mainNav')||$('nav.desktop-nav');
    if(!nav)return;
    $$('.nav-group-body button,.nav-fixed button',nav).forEach(normalizeButton);
  }

  let navQueued=false;
  function queueNav(){if(navQueued)return;navQueued=true;requestAnimationFrame(()=>{navQueued=false;normalizeNav()})}
  function watchNav(){
    const nav=$('#mainNav')||$('nav.desktop-nav');if(!nav)return;
    normalizeNav();
    const obs=new MutationObserver(muts=>{if(muts.some(m=>m.type==='childList'))queueNav()});
    obs.observe(nav,{subtree:true,childList:true});
  }

  function modalState(){
    const modal=$('#quadroModal');
    const open=!!modal&&!modal.classList.contains('hidden');
    root.classList.toggle('gc79-modal-open',open);
  }
  function watchModal(){
    const modal=$('#quadroModal');if(!modal)return;
    modalState();
    new MutationObserver(modalState).observe(modal,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden')){modal.classList.add('hidden');modalState()}},{passive:true});
  }

  function cleanupLegacy(){
    root.classList.remove('gc77-preview');
    root.dataset.gc77Premium='1';
    $$('link[href*="gcmbs-online-premium-v77"],script[src*="gcmbs-online-premium-v77"]').forEach(x=>x.remove());
    $$('.gc77-topbar-context,.gc77-avatar,.gc77-eyebrow,.gc77-card-icon').forEach(x=>x.remove());
  }

  function start(){cleanupLegacy();normalizeNav();watchNav();watchModal();
    new MutationObserver(()=>{if(root.classList.contains('gc77-preview'))root.classList.remove('gc77-preview')}).observe(root,{attributes:true,attributeFilter:['class']});
    setTimeout(normalizeNav,600);setTimeout(normalizeNav,1800);setTimeout(normalizeNav,3500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
