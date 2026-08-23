// GCMBS HF8 R3 — correção visual robusta de mojibake/UTF-8 no Online e no App.
// Corrige somente apresentação; não altera banco, payload persistido nem identificadores.

const HF8_REPLACEMENTS=new Map([
  ['Ã¡','á'],['Ã¢','â'],['Ã£','ã'],['Ã¤','ä'],['Ã ','à'],['Ã©','é'],['Ãª','ê'],['Ã¨','è'],['Ã­','í'],['Ã³','ó'],['Ã´','ô'],['Ãµ','õ'],['Ã¶','ö'],['Ãº','ú'],['Ã¼','ü'],['Ã§','ç'],
  ['Ã','Á'],['Ã‚','Â'],['Ãƒ','Ã'],['Ã„','Ä'],['Ã€','À'],['Ã‰','É'],['ÃŠ','Ê'],['Ãˆ','È'],['Ã','Í'],['Ã“','Ó'],['Ã”','Ô'],['Ã•','Õ'],['Ã–','Ö'],['Ãš','Ú'],['Ãœ','Ü'],['Ã‡','Ç'],
  ['Âº','º'],['Âª','ª'],['Â°','°'],['Â·','·'],['Â ',' '],['Â',''],
  ['â€“','–'],['â€”','—'],['â€˜','‘'],['â€™','’'],['â€œ','“'],['â€','”'],['â€¦','…'],['â€¢','•'],['â†','←'],['â†’','→'],['â†‘','↑'],['â†“','↓'],['â†»','↻'],['â˜°','☰'],['âŒ•','⌕'],
  ['ðŸ“±','📱'],['ðŸ“¢','📢'],['ðŸ‘¤','👤'],['ðŸ””','🔔'],['ðŸš—','🚗'],['ðŸš“','🚓'],['ðŸ“‹','📋'],['ðŸ“Š','📊'],['ðŸ“„','📄'],['ðŸ“…','📅'],['ðŸ”„','🔄'],['ðŸ’¾','💾']
]);

const HF8_SUSPEITO=/(?:Ã.|Â.|â.|ð.|ï¿½|�)/;
const HF8_CP1252=new Map([
  ['€',0x80],['‚',0x82],['ƒ',0x83],['„',0x84],['…',0x85],['†',0x86],['‡',0x87],['ˆ',0x88],['‰',0x89],['Š',0x8A],['‹',0x8B],['Œ',0x8C],['Ž',0x8E],
  ['‘',0x91],['’',0x92],['“',0x93],['”',0x94],['•',0x95],['–',0x96],['—',0x97],['˜',0x98],['™',0x99],['š',0x9A],['›',0x9B],['œ',0x9C],['ž',0x9E],['Ÿ',0x9F]
]);
const HF8_DECODER=new TextDecoder('utf-8',{fatal:true});

function hf8PontuacaoRuim(s){
  const m=String(s||'').match(/(?:Ã.|Â.|â.|ð.|ï¿½|�)/g);
  return m?m.length:0;
}
function hf8Cp1252ParaBytes(s){
  const bytes=[];
  for(const ch of s){
    const cp=ch.codePointAt(0);
    if(cp<=0xFF){bytes.push(cp);continue;}
    const b=HF8_CP1252.get(ch);
    if(b===undefined)return null;
    bytes.push(b);
  }
  return new Uint8Array(bytes);
}
function hf8TentarDecodificar(s){
  const bytes=hf8Cp1252ParaBytes(s);
  if(!bytes)return s;
  try{return HF8_DECODER.decode(bytes);}catch{return s;}
}
function hf8AplicarMapa(s){
  for(const [ruim,bom] of HF8_REPLACEMENTS)s=s.split(ruim).join(bom);
  return s;
}
function hf8CorrigirTexto(valor){
  let s=String(valor??'');
  if(!HF8_SUSPEITO.test(s))return s.normalize?.('NFC')||s;
  let anterior='';
  for(let i=0;i<4&&s!==anterior;i++){
    anterior=s;
    s=hf8AplicarMapa(s);
    if(!HF8_SUSPEITO.test(s))break;
    const candidato=hf8TentarDecodificar(s);
    if(candidato!==s&&hf8PontuacaoRuim(candidato)<hf8PontuacaoRuim(s))s=candidato;
  }
  s=hf8AplicarMapa(s);
  return s.normalize?.('NFC')||s;
}
function hf8CorrigirNo(no){
  if(!no)return;
  if(no.nodeType===Node.TEXT_NODE){
    const atual=no.nodeValue||'',corrigido=hf8CorrigirTexto(atual);
    if(corrigido!==atual)no.nodeValue=corrigido;
    return;
  }
  if(no.nodeType!==Node.ELEMENT_NODE&&no.nodeType!==Node.DOCUMENT_NODE&&no.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  const el=no;
  if(el.nodeType===Node.ELEMENT_NODE){
    for(const attr of ['title','placeholder','aria-label','data-title','alt','value']){
      if(!el.hasAttribute?.(attr))continue;
      const atual=el.getAttribute(attr)||'',corrigido=hf8CorrigirTexto(atual);
      if(corrigido!==atual)el.setAttribute(attr,corrigido);
    }
    if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLOptionElement)&&el.value&&HF8_SUSPEITO.test(el.value))el.value=hf8CorrigirTexto(el.value);
  }
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const textos=[];while(walker.nextNode())textos.push(walker.currentNode);
  for(const t of textos)hf8CorrigirNo(t);
}
function hf8Aplicar(root=document.body){if(root)hf8CorrigirNo(root);if(document.title)document.title=hf8CorrigirTexto(document.title);}
let hf8Pendente=false;
const hf8Observer=new MutationObserver(muts=>{
  if(hf8Pendente)return;hf8Pendente=true;
  requestAnimationFrame(()=>{
    hf8Pendente=false;
    for(const m of muts){
      if(m.type==='characterData')hf8CorrigirNo(m.target);
      if(m.type==='attributes')hf8CorrigirNo(m.target);
      for(const n of m.addedNodes||[])hf8CorrigirNo(n);
    }
  });
});
function hf8Iniciar(){
  hf8Aplicar(document.body||document.documentElement);
  if(document.body)hf8Observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','data-title','alt','value']});
  document.documentElement.lang='pt-BR';
  // Defesa adicional para telas renderizadas por rotinas antigas fora do fluxo observado.
  setTimeout(()=>hf8Aplicar(),50);setTimeout(()=>hf8Aplicar(),300);setTimeout(()=>hf8Aplicar(),1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hf8Iniciar,{once:true});else hf8Iniciar();
window.addEventListener('gcmbs:push-received',()=>setTimeout(()=>hf8Aplicar(),0));
window.addEventListener('pageshow',()=>setTimeout(()=>hf8Aplicar(),0));
window.hf8CorrigirMojibake=hf8CorrigirTexto;
