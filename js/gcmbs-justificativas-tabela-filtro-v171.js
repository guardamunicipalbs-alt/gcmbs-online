/* GCMBS Online V171 — vincula filtros V170 à tabela Desktop V107.
 * Corrige apenas a visualização; não consulta nem altera banco, anexos ou permissões.
 */
(()=>{
  'use strict';
  if(window.__GC_JUST_TABLE_V171__ || window.Capacitor?.isNativePlatform?.() || /^(file|capacitor):/i.test(location.protocol))return;
  window.__GC_JUST_TABLE_V171__=true;

  const $=id=>document.getElementById(id);
  const tableRows=()=>[...document.querySelectorAll('#gc107TableHost .gc107-table tbody tr')];
  let wasActive=false;
  const isActive=()=>{
    const view=document.querySelector('section[data-view="online"]');
    const card=$('onlineRegistrosCard'), panel=$('gc170Panel'), app=$('appTela');
    return !!(view&&card&&panel&&app&&!app.classList.contains('hidden')&&!view.classList.contains('hidden')&&!card.classList.contains('hidden')&&!panel.hidden&&
      /^justificativa de faltas$/i.test(String($('onlineTitulo')?.textContent||'').trim()));
  };
  function restore(){for(const row of tableRows())if(row.style.display==='none')row.style.display='';}
  function syncTable(){
    if(!isActive()){
      if(wasActive)restore();
      wasActive=false;
      return;
    }
    wasActive=true;
    // Enquanto a consulta estiver carregando/indisponível, não exibir seleção antiga como atual.
    if(!/^\d+ justificativa\(s\) filtrada\(s\)/.test(String($('gc170Msg')?.textContent||''))){restore();return;}
    const cards=[...document.querySelectorAll('#onlineRegistros [data-online-key]')];
    const table=tableRows();
    if(!table.length)return;
    const available=new Map(cards.map(card=>[String(card.dataset.onlineKey||'').trim(),card.style.display!=='none']));
    // A tabela V107 usa a primeira célula como a chave original. Não ocultar linhas
    // quando o mapeamento não estiver completo (ex.: reconstrução em andamento).
    if(table.some(row=>!available.has(String(row.cells[0]?.textContent||'').trim())))return;
    for(const row of table){
      const key=String(row.cells[0]?.textContent||'').trim();
      const display=available.get(key)?'':'none';
      if(row.style.display!==display)row.style.display=display;
    }
  }
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#gc170Apply,#gc170Clear,#gc170Refresh')){
      setTimeout(syncTable,0);setTimeout(syncTable,150);
    }
  },true);
  document.addEventListener('input',event=>{
    if(event.target?.id==='onlineFiltro')setTimeout(syncTable,150);
  },true);
  setInterval(syncTable,300);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncTable,{once:true});else syncTable();
  console.info('[GCMBS] V171: tabela V107 sincronizada com filtros V170 (somente leitura)');
})();
