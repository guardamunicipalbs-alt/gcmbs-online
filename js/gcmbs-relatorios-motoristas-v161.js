/* GCMBS Online HF161: o campo motorista da replica identifica o condutor da
   composicao e pode se repetir em todas as linhas. Nunca usar sua mera presenca
   como indicador de que todos os integrantes sao motoristas. Somente exibicao. */
(()=>{
  'use strict';
  if(window.__GCMBS_RELATORIOS_MOTORISTAS_V161__)return;
  window.__GCMBS_RELATORIOS_MOTORISTAS_V161__=true;

  const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
  const txt=x=>String(x??'').trim();
  const nome=x=>txt(x.nome_guerra||x.hist_guarda_nome_guerra||x.guarda_nome||x.guarda||'GCM');
  const posto=x=>txt(x.posto_nome||x.hist_posto_nome||x.posto);
  const data=x=>txt(x.data).slice(0,10);
  const iso=v=>{const s=txt(v),m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:s.slice(0,10)};
  const chave=(dia,nm,po)=>`${dia}\u0000${norm(nm)}\u0000${norm(po)}`;
  const afirmativo=v=>v===true||v===1||['1','SIM','TRUE','YES','S'].includes(norm(v));
  const sinalizadores=new Set(['1','SIM','TRUE','YES','S','NAO','FALSE','NO','N','0','MOTORISTA']);

  function motoristaIndividual(x){
    const mid=Number(x.motorista_id||x.hist_motorista_id||0),gid=Number(x.guarda_id||x.hist_guarda_id||0);
    if(mid>0)return gid>0&&gid===mid;
    const identificacao=norm(x.motorista_nome_guerra||x.motorista_nome||x.motorista||x.hist_motorista_nome_guerra||'');
    if(identificacao&&!sinalizadores.has(identificacao)){
      return [nome(x),x.nome_guerra,x.hist_guarda_nome_guerra,x.guarda_nome,x.guarda]
        .some(n=>n&&norm(n)===identificacao);
    }
    const flag=x.eh_motorista??x.is_motorista??x.motorista_flag;
    return afirmativo(flag);
  }

  let registros=null,carregando=false,pendente=false;
  function visivel(){const s=document.querySelector('main > section[data-view="relatorios"]');return s&&!s.classList.contains('hidden');}
  async function carregar(){
    if(carregando||!visivel())return;
    const token=localStorage.getItem('gcmbs.mobile.token');if(!token)return;
    carregando=true;
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'relatorio_escalas'}),cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const body=await r.json();
      if(!Array.isArray(body.escalas))throw new Error('Relatorio de escalas sem lista valida');
      registros=body.escalas;
      aplicar();
    }catch(e){console.warn('[GCMBS HF161] nao foi possivel validar motoristas; relatorio preservado',e);}
    finally{carregando=false;}
  }
  function aplicar(){
    if(!registros||!visivel())return;
    const host=document.getElementById('relatoriosLista');if(!host)return;
    const cards=host.querySelectorAll('article.record-card');if(!cards.length)return;
    const mapa=new Map();
    for(const item of registros){
      const k=chave(data(item),nome(item),posto(item));
      if(!mapa.has(k))mapa.set(k,[]);
      mapa.get(k).push(motoristaIndividual(item));
    }
    for(const card of cards){
      const dia=iso(card.querySelector('.record-card-head span')?.textContent);
      const nm=card.querySelector('.record-card-head strong')?.textContent;
      const po=txt(card.querySelector('.record-meta')?.textContent).split(' · ')[0];
      const matches=mapa.get(chave(dia,nm,po));
      if(!matches?.length)continue; // Nunca alterar um card sem correspondencia verificavel.
      const deveExibir=matches.shift()===true;
      const conteudo=card.querySelector('.record-meta')?.nextElementSibling;
      if(!conteudo)continue;
      const etiquetas=[...conteudo.querySelectorAll('.tag-driver')];
      if(deveExibir){
        if(!etiquetas.length){const badge=document.createElement('span');badge.className='tag-driver';badge.textContent='MOTORISTA';conteudo.prepend(badge,document.createTextNode(' '));}
      }else{
        for(const badge of etiquetas)badge.remove();
      }
    }
  }
  function agendar(){
    if(pendente)return;
    pendente=true;
    queueMicrotask(()=>{pendente=false;if(visivel()){if(registros)aplicar();else carregar();}});
  }
  function iniciar(){
    const host=document.getElementById('relatoriosLista');
    if(host)new MutationObserver(agendar).observe(host,{childList:true,subtree:true});
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-go="relatorios"],[data-module="relatorios"]'))setTimeout(()=>{agendar();carregar();},200);
      if(e.target.closest?.('#relatoriosAtualizar'))setTimeout(carregar,350);
    },true);
    document.addEventListener('change',e=>{if(e.target.closest?.('section[data-view="relatorios"]'))agendar();},true);
    agendar();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
})();