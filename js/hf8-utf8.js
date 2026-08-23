// GCMBS HF8 — correção visual de mojibake/UTF-8 no Online e no App.
// Corrige somente apresentação; não altera banco, payload persistido nem identificadores.

const HF8_REPLACEMENTS=new Map([
  ['Ã¡','á'],['Ã¢','â'],['Ã£','ã'],['Ã¤','ä'],['Ã©','é'],['Ãª','ê'],['Ã­','í'],['Ã³','ó'],['Ã´','ô'],['Ãµ','õ'],['Ã¶','ö'],['Ãº','ú'],['Ã¼','ü'],['Ã§','ç'],
  ['Ã','Á'],['Ã‚','Â'],['Ãƒ','Ã'],['Ã„','Ä'],['Ã‰','É'],['ÃŠ','Ê'],['Ã','Í'],['Ã“','Ó'],['Ã”','Ô'],['Ã•','Õ'],['Ã–','Ö'],['Ãš','Ú'],['Ãœ','Ü'],['Ã‡','Ç'],
  ['Âº','º'],['Âª','ª'],['Â°','°'],['Â·','·'],['Â ',' '],
  ['â€“','–'],['â€”','—'],['â€˜','‘'],['â€™','’'],['â€œ','“'],['â€','”'],['â€¦','…'],['â€¢','•'],
  ['ï¿½','�']
]);

const HF8_SUSPEITO=/(?:Ã.|Â(?:º|ª|°|·| )|â(?:€“|€”|€˜|€™|€œ|€|€¦|€¢)|ï¿½)/;

function hf8CorrigirTexto(valor){
  let s=String(valor??'');
  if(!HF8_SUSPEITO.test(s))return s;
  for(const [ruim,bom] of HF8_REPLACEMENTS)s=s.split(ruim).join(bom);
  return s;
}

function hf8CorrigirNo(no){
  if(!no)return;
  if(no.nodeType===Node.TEXT_NODE){
    const atual=no.nodeValue||'',corrigido=hf8CorrigirTexto(atual);
    if(corrigido!==atual)no.nodeValue=corrigido;
    return;
  }
  if(no.nodeType!==Node.ELEMENT_NODE)return;
  const el=no;
  for(const attr of ['title','placeholder','aria-label','data-title']){
    if(!el.hasAttribute?.(attr))continue;
    const atual=el.getAttribute(attr)||'',corrigido=hf8CorrigirTexto(atual);
    if(corrigido!==atual)el.setAttribute(attr,corrigido);
  }
  if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.value&&HF8_SUSPEITO.test(el.value)){
    el.value=hf8CorrigirTexto(el.value);
  }
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const textos=[];while(walker.nextNode())textos.push(walker.currentNode);
  for(const t of textos)hf8CorrigirNo(t);
}

function hf8Aplicar(root=document.body){
  if(!root)return;
  hf8CorrigirNo(root);
}

let hf8Pendente=false;
const hf8Observer=new MutationObserver(muts=>{
  if(hf8Pendente)return;
  hf8Pendente=true;
  requestAnimationFrame(()=>{
    hf8Pendente=false;
    for(const m of muts){
      if(m.type==='characterData')hf8CorrigirNo(m.target);
      for(const n of m.addedNodes||[])hf8CorrigirNo(n);
    }
  });
});

function hf8Iniciar(){
  hf8Aplicar();
  if(document.body)hf8Observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.documentElement.lang='pt-BR';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hf8Iniciar,{once:true});
else hf8Iniciar();

window.addEventListener('gcmbs:push-received',()=>setTimeout(()=>hf8Aplicar(),0));
window.hf8CorrigirMojibake=hf8CorrigirTexto;
