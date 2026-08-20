import './app-core.js';

// Hotfix visual 10.0.62: padroniza datas exibidas no Online em dd/mm/aaaa
// sem alterar valores ISO usados por inputs, API, banco e sincronizacao.
const GCMBS_ISO_DATE_TEST=/\b\d{4}-\d{2}-\d{2}\b/;
const GCMBS_ISO_DATE_RE=/\b(\d{4})-(\d{2})-(\d{2})\b/g;

function gcmbsFormatarDatasTexto(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;
    if(!p)return NodeFilter.FILTER_REJECT;
    if(['SCRIPT','STYLE','TEXTAREA','CODE','PRE'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
    return GCMBS_ISO_DATE_TEST.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    node.nodeValue=(node.nodeValue||'').replace(GCMBS_ISO_DATE_RE,'$3/$2/$1');
  }
}

let gcmbsDateFormatScheduled=false;
function gcmbsAgendarFormatacaoDatas(){
  if(gcmbsDateFormatScheduled)return;
  gcmbsDateFormatScheduled=true;
  queueMicrotask(()=>{
    gcmbsDateFormatScheduled=false;
    gcmbsFormatarDatasTexto(document.body);
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',gcmbsAgendarFormatacaoDatas,{once:true});
else gcmbsAgendarFormatacaoDatas();

new MutationObserver(gcmbsAgendarFormatacaoDatas).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
