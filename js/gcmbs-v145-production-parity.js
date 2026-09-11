/* GCMBS V145 — paridade de produção Online/App sem alterar regras operacionais. */
(()=>{'use strict';
if(window.__GCMBS_V145_PRODUCTION_PARITY__)return;window.__GCMBS_V145_PRODUCTION_PARITY__=true;
const VERSION='10.0.145';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const isCommand=()=>/COMANDANTE|SUBCOMANDANTE/.test(norm(document.getElementById('perfilCargo')?.textContent||document.body?.dataset?.perfil||''));
const finalStatus=s=>['APROVADA','RECUSADA','REPROVADA','NEGADA','CANCELADA','CONCLUIDA','EXCLUIDA'].includes(norm(s));
function versionLabels(){
 document.querySelectorAll('[id*=Versao],[class*=version],[class*=versao]').forEach(el=>{if(/10\.0\.85|ONLINE\s*[·:-]?\s*10\.0\.85/i.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/10\.0\.85/g,VERSION)});
 const appCard=document.getElementById('appAtualizacaoCard');if(appCard)appCard.innerHTML=appCard.innerHTML.replace(/10\.0\.85/g,VERSION);
 document.querySelectorAll('body *').forEach(el=>{if(el.children.length)return;const t=el.textContent||'';if(t.length<160&&/Online\s*[·:-]\s*10\.0\.85/i.test(t))el.textContent=t.replace(/10\.0\.85/g,VERSION)});
}
function titleCard(el){return norm(el?.querySelector('h1,h2,h3,strong')?.textContent||'')}
function bankOrder(){
 if(!isCommand())return;
 const view=document.querySelector('[data-view="banco"]');if(!view)return;
 const cards=[...view.querySelectorAll(':scope > .card, :scope > section.card, .card')];
 const cmd=document.getElementById('bancoComandoMovV133')||cards.find(c=>titleCard(c).includes('MOVIMENTACAO DO COMANDO'));
 const req=document.getElementById('bancoGestaoCard')||cards.find(c=>titleCard(c).includes('SOLICITACOES DE CORRECAO')||titleCard(c).includes('CORRECOES'));
 const mov=document.getElementById('listaBanco')?.closest('.card')||cards.find(c=>titleCard(c).includes('MOVIMENTACOES DA COMPETENCIA'));
 const parent=cmd?.parentNode||req?.parentNode||mov?.parentNode;
 if(parent&&cmd&&req&&mov&&cmd.parentNode===parent&&req.parentNode===parent&&mov.parentNode===parent){parent.insertBefore(cmd,req);parent.insertBefore(req,mov)}
 const personal=document.getElementById('formBancoCorrecao')?.closest('.card');if(personal)personal.classList.add('hidden');
 if(req){const h=req.querySelector('h1,h2,h3');if(h)h.textContent='Solicitações de correção';}
}
function splitBankRequests(){
 if(!isCommand())return;const host=document.getElementById('listaBancoGestao');if(!host)return;
 const cards=[...host.children].filter(x=>x.matches('article,.record-card,.item'));if(!cards.length)return;
 let hist=document.getElementById('gcmbsBankHistoryV145');if(!hist){hist=document.createElement('details');hist.id='gcmbsBankHistoryV145';hist.className='card';hist.style.marginTop='12px';hist.innerHTML='<summary style="cursor:pointer;font-weight:700">Histórico de solicitações concluídas</summary><div data-v145-history style="margin-top:12px"></div>';host.parentNode.insertBefore(hist,host.nextSibling)}
 const hh=hist.querySelector('[data-v145-history]');hh.innerHTML='';let pending=0;
 cards.forEach(c=>{const pill=c.querySelector('.status-pill');const st=norm(pill?.textContent||'');if(finalStatus(st)){hh.appendChild(c)}else pending++});
 hist.classList.toggle('hidden',!hh.children.length);
 const h=host.closest('.card')?.querySelector('h1,h2,h3');if(h)h.textContent=`Solicitações de correção — pendentes (${pending})`;
}
function commandPendingBadge(){
 if(!isCommand())return;const box=document.getElementById('gcmbsCommandPendingV143');if(!box)return;const badge=box.querySelector('.badge');if(badge){const n=Number(badge.textContent||0);badge.title=n?`${n} item(ns) aguardando avaliação do Comando`:'Nenhuma pendência';}
}
function audit(){versionLabels();bankOrder();splitBankRequests();commandPendingBadge();document.documentElement.dataset.gcmbsVersion=VERSION;}
function boot(){audit();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;audit()})}).observe(document.documentElement,{childList:true,subtree:true});setInterval(audit,10000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
