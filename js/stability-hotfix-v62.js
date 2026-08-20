// GCMBS 10.0.62 — proteção de estabilidade para a camada visual.
// Evita loop de MutationObserver quando Ofícios já está na ordem desejada.
const originalAppendChild=Node.prototype.appendChild;

function tituloAtual(){
  return String(document.getElementById('onlineTitulo')?.textContent||'').trim();
}
function dataIso(v){
  const s=String(v||'').trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
function valorCard(card,rotulos){
  const labels=[...(card?.querySelectorAll('.online-kv b')||[])];
  for(const b of labels){
    const nome=String(b.textContent||'').trim().toLowerCase();
    if(rotulos.some(r=>nome===r))return String(b.nextElementSibling?.textContent||'').trim();
  }
  return '';
}
function ordemOficiosJaCorreta(host){
  const cards=[...host.children].filter(el=>el instanceof HTMLElement&&el.hasAttribute('data-online-key'));
  if(cards.length<2)return true;
  const info=cards.map((card,idx)=>{
    const demanda=dataIso(valorCard(card,['data da demanda']));
    const recebimento=dataIso(valorCard(card,['data de recebimento','data do recebimento']));
    const dataRef=demanda||recebimento;
    const numero=valorCard(card,['número do ofício','numero do ofício']);
    return {card,idx,dataRef,recebimento,numero};
  });
  const esperado=[...info].sort((a,b)=>
    b.dataRef.localeCompare(a.dataRef)||
    b.recebimento.localeCompare(a.recebimento)||
    b.numero.localeCompare(a.numero,'pt-BR',{numeric:true})||
    a.idx-b.idx
  ).map(x=>x.card);
  return esperado.every((card,i)=>cards[i]===card);
}

Node.prototype.appendChild=function(child){
  try{
    const host=this;
    if(
      host instanceof HTMLElement&&host.id==='onlineRegistros'&&
      child instanceof HTMLElement&&child.parentNode===host&&
      child.hasAttribute('data-online-key')&&
      tituloAtual()==='Ofícios'&&
      ordemOficiosJaCorreta(host)
    ){
      return child;
    }
  }catch{}
  return originalAppendChild.call(this,child);
};
