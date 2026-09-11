/* GCMBS V140 — regras de interface Online/App para equipe COMANDANTES.
   - Comando administra permutas, mas nao solicita permuta propria.
   - Comando usa Movimentacao do Comando; nao solicita correcao de banco.
   - Demais GCMs mantem os formularios pessoais.
   Nao altera Desktop nem decisoes administrativas. */
(()=>{'use strict';
if(window.__GCMBS_V140_MOBILE_PERMISSIONS__)return;window.__GCMBS_V140_MOBILE_PERMISSIONS__=true;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
function commandByUi(){
 const cargo=norm(document.getElementById('perfilCargo')?.textContent);
 if(/(^|\s)(COMANDANTE|SUBCOMANDANTE)(\s|$)/.test(cargo))return true;
 const body=norm(document.body?.dataset?.perfil||document.documentElement?.dataset?.perfil||'');
 return /COMANDANTE|SUBCOMANDANTE/.test(body);
}
function commandBySession(){
 try{const raw=localStorage.getItem('gcmbs.mobile.session')||localStorage.getItem('gcmbs.session')||'';if(!raw)return false;const s=JSON.parse(raw);return ['COMANDANTE','SUBCOMANDANTE'].includes(norm(s?.role||s?.cargo||s?.perfil));}catch{return false}
}
function isCommand(){return commandByUi()||commandBySession()}
function ownCorrectionCards(){
 const form=document.getElementById('formBancoCorrecao');const card=form?.closest('.card');
 const mine=document.getElementById('listaCorrecoes')?.closest('.card');return [card,mine].filter(Boolean);
}
function apply(){
 const logged=!document.getElementById('appTela')?.classList.contains('hidden');if(!logged)return;
 const cmd=isCommand();document.documentElement.dataset.gcmbsCommand=cmd?'1':'0';
 const permuta=document.getElementById('permutaCard');if(permuta){permuta.classList.toggle('hidden',cmd);permuta.setAttribute('aria-hidden',cmd?'true':'false');}
 ownCorrectionCards().forEach(el=>{el.classList.toggle('hidden',cmd);el.setAttribute('aria-hidden',cmd?'true':'false')});
 const movement=document.getElementById('bancoComandoMovV133');if(movement){movement.classList.toggle('hidden',!cmd);movement.setAttribute('aria-hidden',cmd?'false':'true')}
}
function boot(){apply();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;apply()})}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});[250,800,1800,4000].forEach(ms=>setTimeout(apply,ms));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
