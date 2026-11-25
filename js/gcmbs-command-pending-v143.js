/* GCMBS V143 — Central de Pendências do Comando + organização Banco de Horas. */
(()=>{'use strict';
if(window.__GCMBS_V143_COMMAND_PENDING__)return;window.__GCMBS_V143_COMMAND_PENDING__=true;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const $=id=>document.getElementById(id);
function isCommand(){const c=norm($('perfilCargo')?.textContent||document.body?.dataset?.perfil||'');return /COMANDANTE|SUBCOMANDANTE/.test(c)}
function bankOrder(){if(!isCommand())return;const cards=[...document.querySelectorAll('[data-view="banco"] .card,#bancoGestaoCard .card,#bancoGestaoCard')];const byTitle=t=>cards.find(c=>norm(c.querySelector('h1,h2,h3')?.textContent).includes(norm(t)));const cmd=$('bancoComandoMovV133')||byTitle('Movimentação do Comando'),req=byTitle('Solicitações de correção'),mov=byTitle('Movimentações da competência');if(cmd&&req&&cmd.parentNode===req.parentNode)req.parentNode.insertBefore(cmd,req);if(req&&mov&&req.parentNode===mov.parentNode)mov.parentNode.insertBefore(req,mov);document.querySelectorAll('[data-view="banco"] .card').forEach(c=>{const h=norm(c.querySelector('h1,h2,h3')?.textContent);if(h==='SOLICITAR CORRECAO')c.classList.add('hidden')})}
function guardClicks(){if(document.documentElement.dataset.gcmbsV143ClickGuard)return;document.documentElement.dataset.gcmbsV143ClickGuard='1';document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-cmd-pm-ok],[data-cmd-pm-no],[data-cmd-pm-del],[data-cmd-mirror-ok],[data-cmd-mirror-no],[data-cmd-bh-ok],[data-cmd-bh-no]');if(!b||b.disabled)return;queueMicrotask(()=>{b.disabled=true;b.setAttribute('aria-busy','true');setTimeout(()=>{if(document.body.contains(b)){b.disabled=false;b.removeAttribute('aria-busy')}},15000)})},true)}
function boot(){guardClicks();bankOrder();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;bankOrder()})}).observe(document.documentElement,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
