import './hf8-utf8.js?v=20260823hf8r4';
import './hf7-paridade.js?v=20260823hf7r3fj';

// Correções de apresentação constatadas na auditoria do app 10.0.62.
// Atua somente na camada visual: não altera banco, payloads ou valores persistidos.
const BOOL_LABELS=new Set([
  'autorizado viatura','autorizado motocicleta','disponível para escala','disponivel para escala',
  'pode noite','pode 24h','ativo','ativa','participa do gerador','consertado'
]);
const TECH_LABEL=/^(id|uuid|hash|sha|sha-?256|payload|token|token sha-?256|origem id|referência id|referencia id|entidade id|usuário id|usuario id|escala id|extra id)$/i;
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const boolText=v=>{
  const s=norm(v);
  if(['1','true','sim','yes'].includes(s))return 'Sim';
  if(['0','false','não','nao','no'].includes(s))return 'Não';
  return null;
};
function corrigirPares(root=document){
  root.querySelectorAll?.('.online-kv').forEach(row=>{
    const label=row.querySelector('b');
    if(!label)return;
    const nome=norm(label.textContent);
    if(TECH_LABEL.test(nome)){row.style.display='none';return;}
    if(!BOOL_LABELS.has(nome))return;
    const valor=label.nextElementSibling;
    if(!valor)return;
    const txt=boolText(valor.textContent);
    if(txt!==null)valor.textContent=txt;
  });
}
function corrigirCampos(root=document){
  root.querySelectorAll?.('label').forEach(label=>{
    const texto=norm([...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ')||label.firstChild?.textContent);
    if(TECH_LABEL.test(texto)){label.style.display='none';return;}
    if(!BOOL_LABELS.has(texto))return;
    const select=label.querySelector('select');
    if(select){
      [...select.options].forEach(o=>{
        if(['1','true'].includes(norm(o.value))||['1','true'].includes(norm(o.textContent)))o.textContent='Sim';
        if(['0','false'].includes(norm(o.value))||['0','false'].includes(norm(o.textContent)))o.textContent='Não';
      });
    }
  });
}
function aplicar(){
  corrigirPares(document);
  corrigirCampos(document);
  window.hf8AplicarMojibake?.(document.body||document.documentElement);
}
let pendente=false;
const obs=new MutationObserver(()=>{
  if(pendente)return;pendente=true;
  requestAnimationFrame(()=>{pendente=false;aplicar();});
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{aplicar();obs.observe(document.body,{childList:true,subtree:true});},{once:true});
else{aplicar();obs.observe(document.body,{childList:true,subtree:true});}
