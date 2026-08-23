// GCMBS HF8 R4 — correção robusta de mojibake UTF-8/Windows-1252 no Online e App.
// Atua somente na apresentação. Não altera banco, payload persistido, IDs ou valores salvos.

const HF8_CP1252=new Map([
  ['€',0x80],['‚',0x82],['ƒ',0x83],['„',0x84],['…',0x85],['†',0x86],['‡',0x87],['ˆ',0x88],['‰',0x89],['Š',0x8A],['‹',0x8B],['Œ',0x8C],['Ž',0x8E],
  ['‘',0x91],['’',0x92],['“',0x93],['”',0x94],['•',0x95],['–',0x96],['—',0x97],['˜',0x98],['™',0x99],['š',0x9A],['›',0x9B],['œ',0x9C],['ž',0x9E],['Ÿ',0x9F]
]);
const HF8_DECODER=new TextDecoder('utf-8',{fatal:true});
const HF8_SUSPEITO=/(?:Ã|Â|â|ð|Å|Æ|Ë|ï¿½|�)/;

// Casos conhecidos que podem sobreviver a uma conversão parcial ou conter várias camadas.
const HF8_FIXOS=new Map([
  ['Ã°Å¸â€œÂ±','📱'],['ðŸ“±','📱'],
  ['Ã¢ËœÂ°','☰'],['â˜°','☰'],
  ['Ã¢â€ Â»','↻'],['â†»','↻'],
  ['Ã¢â‚¬â€œ','–'],['â€“','–'],
  ['Ã¢â‚¬â€','—'],['â€”','—'],
  ['Ã‚Â·','·'],['Â·','·'],
  ['ÃƒÂ¡','á'],['ÃƒÂ ','à'],['ÃƒÂ¢','â'],['ÃƒÂ£','ã'],['ÃƒÂ©','é'],['ÃƒÂª','ê'],['ÃƒÂ­','í'],['ÃƒÂ³','ó'],['ÃƒÂ´','ô'],['ÃƒÂµ','õ'],['ÃƒÂº','ú'],['ÃƒÂ§','ç'],
  ['ÃƒÂ','Á'],['ÃƒÂ€','À'],['ÃƒÂ‚','Â'],['ÃƒÂƒ','Ã'],['Ãƒâ€°','É'],['ÃƒÅ ','Ê'],['ÃƒÂ','Í'],['Ãƒâ€œ','Ó'],['Ãƒâ€','Ô'],['Ãƒâ€¢','Õ'],['ÃƒÅ¡','Ú'],['Ãƒâ€¡','Ç'],
  ['Ã¡','á'],['Ã ','à'],['Ã¢','â'],['Ã£','ã'],['Ã©','é'],['Ãª','ê'],['Ã­','í'],['Ã³','ó'],['Ã´','ô'],['Ãµ','õ'],['Ãº','ú'],['Ã§','ç'],
  ['Âº','º'],['Âª','ª'],['Â°','°'],['Â ',' '],
  ['ðŸ“¢','📢'],['ðŸ‘¤','👤'],['ðŸ””','🔔'],['ðŸš—','🚗'],['ðŸš“','🚓'],['ðŸ“‹','📋'],['ðŸ“Š','📊'],['ðŸ“„','📄'],['ðŸ“…','📅'],['ðŸ”„','🔄'],['ðŸ’¾','💾'],
  ['â†','←'],['â†’','→'],['â†‘','↑'],['â†“','↓'],['âŒ•','⌕'],['â€˜','‘'],['â€™','’'],['â€œ','“'],['â€','”'],['â€¦','…'],['â€¢','•']
]);

function hf8ContarRuido(s){
  const m=String(s||'').match(/(?:Ã|Â|â|ð|Å|Æ|Ë|ï¿½|�)/g);
  return m?m.length:0;
}
function hf8AplicarFixos(s){
  let out=String(s??'');
  for(const [ruim,bom] of HF8_FIXOS)out=out.split(ruim).join(bom);
  return out;
}
function hf8Cp1252ParaBytes(s){
  const bytes=[];
  for(const ch of String(s??'')){
    const cp=ch.codePointAt(0);
    if(cp<=0xFF){bytes.push(cp);continue;}
    const b=HF8_CP1252.get(ch);
    if(b===undefined)return null;
    bytes.push(b);
  }
  return new Uint8Array(bytes);
}
function hf8DecodificarUmaCamada(s){
  const bytes=hf8Cp1252ParaBytes(s);
  if(!bytes)return s;
  try{return HF8_DECODER.decode(bytes);}catch{return s;}
}
function hf8DecodificarTrecho(s){
  let atual=String(s??'');
  for(let i=0;i<6;i++){
    if(!HF8_SUSPEITO.test(atual))break;
    const candidato=hf8DecodificarUmaCamada(atual);
    if(candidato===atual)break;
    // Aceita se reduzir ruído ou se produzir caracteres Unicode inequívocos.
    if(hf8ContarRuido(candidato)<=hf8ContarRuido(atual))atual=candidato;else break;
  }
  return hf8AplicarFixos(atual);
}
function hf8CorrigirTexto(valor){
  let s=String(valor??'');
  if(!HF8_SUSPEITO.test(s))return s.normalize?.('NFC')||s;

  // 1) Desfaz camadas antes de substituir pares. Isso evita transformar
  //    Ã¢â‚¬â€œ em sequências intermediárias inválidas.
  let corrigido=hf8DecodificarTrecho(s);

  // 2) Se a frase mistura texto já correto com um fragmento corrompido,
  //    corrige apenas blocos suspeitos e seus caracteres ASCII adjacentes.
  if(HF8_SUSPEITO.test(corrigido)){
    corrigido=corrigido.replace(/[\u0000-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+/g,trecho=>{
      if(!HF8_SUSPEITO.test(trecho))return trecho;
      return hf8DecodificarTrecho(trecho);
    });
  }

  // 3) Última passagem para resíduos conhecidos.
  corrigido=hf8AplicarFixos(corrigido);
  return corrigido.normalize?.('NFC')||corrigido;
}

function hf8CorrigirNo(no){
  if(!no)return;
  if(no.nodeType===Node.TEXT_NODE){
    const atual=no.nodeValue||'';
    const corrigido=hf8CorrigirTexto(atual);
    if(corrigido!==atual)no.nodeValue=corrigido;
    return;
  }
  if(no.nodeType!==Node.ELEMENT_NODE&&no.nodeType!==Node.DOCUMENT_NODE&&no.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  const el=no;
  if(el.nodeType===Node.ELEMENT_NODE){
    for(const attr of ['title','placeholder','aria-label','data-title','alt']){
      if(!el.hasAttribute?.(attr))continue;
      const atual=el.getAttribute(attr)||'';
      const corrigido=hf8CorrigirTexto(atual);
      if(corrigido!==atual)el.setAttribute(attr,corrigido);
    }
    if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLOptionElement)&&el.value&&HF8_SUSPEITO.test(el.value)){
      el.value=hf8CorrigirTexto(el.value);
    }
  }
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const textos=[];
  while(walker.nextNode())textos.push(walker.currentNode);
  for(const t of textos)hf8CorrigirNo(t);
}
function hf8Aplicar(root=document.body){
  if(root)hf8CorrigirNo(root);
  if(document.title)document.title=hf8CorrigirTexto(document.title);
}

let hf8Pendente=false;
const hf8Observer=new MutationObserver(muts=>{
  if(hf8Pendente)return;
  hf8Pendente=true;
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
  if(document.body)hf8Observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','data-title','alt']});
  document.documentElement.lang='pt-BR';
  // Repassagens cobrem componentes montados após autenticação/sincronização.
  [0,50,200,600,1500,3000].forEach(ms=>setTimeout(()=>hf8Aplicar(),ms));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hf8Iniciar,{once:true});else hf8Iniciar();
window.addEventListener('gcmbs:push-received',()=>setTimeout(()=>hf8Aplicar(),0));
window.addEventListener('pageshow',()=>setTimeout(()=>hf8Aplicar(),0));
window.addEventListener('gcmbs:sync-complete',()=>setTimeout(()=>hf8Aplicar(),0));
window.hf8CorrigirMojibake=hf8CorrigirTexto;
window.hf8AplicarMojibake=hf8Aplicar;
