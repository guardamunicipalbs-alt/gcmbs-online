// GCMBS HF8 R2 — correção visual robusta de mojibake/UTF-8 no Online e no App.
// Corrige somente apresentação; não altera banco, payload persistido nem identificadores.

const HF8_REPLACEMENTS=new Map([
  ['Ã¡','á'],['Ã¢','â'],['Ã£','ã'],['Ã¤','ä'],['Ã©','é'],['Ãª','ê'],['Ã­','í'],['Ã³','ó'],['Ã´','ô'],['Ãµ','õ'],['Ã¶','ö'],['Ãº','ú'],['Ã¼','ü'],['Ã§','ç'],
  ['Ã','Á'],['Ã‚','Â'],['Ãƒ','Ã'],['Ã„','Ä'],['Ã‰','É'],['ÃŠ','Ê'],['Ã','Í'],['Ã“','Ó'],['Ã”','Ô'],['Ã•','Õ'],['Ã–','Ö'],['Ãš','Ú'],['Ãœ','Ü'],['Ã‡','Ç'],
  ['Âº','º'],['Âª','ª'],['Â°','°'],['Â·','·'],['Â ',' '],
  ['â€“','–'],['â€”','—'],['â€˜','‘'],['â€™','’'],['â€œ','“'],['â€','”'],['â€¦','…'],['â€¢','•']
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

function hf8CorrigirTexto(valor){
  let s=String(valor??'');
  if(!HF8_SUSPEITO.test(s))return s.normalize?.('NFC')||s;

  // Primeiro corrige os pares mais comuns e seguros.
  for(const [ruim,bom] of HF8_REPLACEMENTS)s=s.split(ruim).join(bom);

  // Depois tenta desfazer até três camadas de UTF-8 interpretado como Windows-1252.
  // Só aceita a conversão quando a quantidade de marcadores de mojibake diminui.
  for(let i=0;i<3;i++){
    if(!HF8_SUSPEITO.test(s))break;
    const candidato=hf8TentarDecodificar(s);
    if(candidato===s)break;
    if(hf8PontuacaoRuim(candidato)>=hf8PontuacaoRuim(s))break;
    s=candidato;
    for(const [ruim,bom] of HF8_REPLACEMENTS)s=s.split(ruim).join(bom);
  }
  return s.normalize?.('NFC')||s;
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
  for(const attr of ['title','placeholder','aria-label','data-title','alt']){
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
