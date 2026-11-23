/* GCMBS ONLINE V390 — Folha fechada simples, em formato de folha do Desktop.
 * Somente leitura do snapshot fechado, sem recalculo/edicao.
 * Tela propria: evita misturar cabecalhos e editores de outros modulos.
 */
(()=>{
'use strict';
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-folhas-fechadas-read-v368';
const $=s=>document.querySelector(s);
let root=null,sequence=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
const num=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const onlyText=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,160);
const visible=()=>root&&!root.classList.contains('hidden');
async function api(action,competencia=''){
 const token=localStorage.getItem('gcmbs.mobile.token');
 if(!token)throw Error('Sessão expirada. Faça login novamente.');
 const response=await fetch(API,{method:'POST',cache:'no-store',headers:{
  'Content-Type':'application/json','Authorization':'Bearer '+token
 },body:JSON.stringify({action,competencia})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.success)throw Error(data.message||'Falha ao consultar folha fechada.');
 return data;
}
function baseCanvas(folha){
 const rows=Array.isArray(folha.linhas)?folha.linhas:[];
 const days=31,nameWidth=232,dayWidth=31,summaryWidths=[82,82,96,96,110,122,72,65];
 const totalWidth=nameWidth+days*dayWidth+summaryWidths.reduce((a,b)=>a+b,0)+50;
 const lineHeight=36,top=200,bottom=170;
 const can=document.createElement('canvas');
 can.width=totalWidth;
 can.height=Math.max(590,top+rows.length*lineHeight+bottom);
 const ctx=can.getContext('2d');
 const c=ctx;
 c.fillStyle='#fff';c.fillRect(0,0,can.width,can.height);
 c.fillStyle='#133968';c.fillRect(0,0,can.width,12);
 c.fillStyle='#18334f';
 c.font='bold 27px Arial';
 c.fillText('GUARDA CIVIL MUNICIPAL DE BREJO SANTO',28,58);
 c.font='bold 23px Arial';c.fillText('FOLHA DE PAGAMENTO',28,100);
 c.font='16px Arial';
 c.fillText('Competência '+onlyText(folha.competencia)+'   •   FECHADA',28,132);
 c.font='14px Arial';c.fillStyle='#536b83';
 c.fillText('Informações preservadas do fechamento do Desktop • consulta somente leitura',28,155);
 const left=25,headY=top-38,contentWidth=can.width-50;
 c.fillStyle='#dbe9f8';c.fillRect(left,headY,contentWidth,38);
 const defs=[['H 50%',summaryWidths[0],'horas50','number'],['H 100%',summaryWidths[1],'horas100','number'],
 ['Realiz.',summaryWidths[2],'horasRealizadas','number'],['Pagáveis',summaryWidths[3],'horasPagaveis','number'],
 ['Exced.',summaryWidths[4],'excedente','number'],['Valor total',summaryWidths[5],'valorTotal','money'],
 ['Faltas',summaryWidths[6],'faltas','number'],['FJ',summaryWidths[7],'faltasJustificadas','number']];
 c.font='bold 13px Arial';c.fillStyle='#244565';
 c.fillText('GCM',left+7,headY+24,nameWidth-12);
 for(let i=1;i<=days;i++){
   const dx=left+nameWidth+(i-1)*dayWidth;
   c.fillText(String(i).padStart(2,'0'),dx+6,headY+24,dayWidth-4);
 }
 let px=left+nameWidth+days*dayWidth;
 for(const [title,w]of defs){c.fillText(title,px+5,headY+24,w-6);px+=w;}
 for(let i=0;i<rows.length;i++){
   const row=rows[i],y=top+i*lineHeight;
   c.fillStyle=i%2?'#ffffff':'#f4f8fc';c.fillRect(left,y,contentWidth,lineHeight);
   c.strokeStyle='#e1e9f2';c.beginPath();c.moveTo(left,y+lineHeight);c.lineTo(left+contentWidth,y+lineHeight);c.stroke();
   c.font='bold 14px Arial';c.fillStyle='#203d5c';
   c.fillText(onlyText(row.nome),left+7,y+23,nameWidth-15);
   c.font='13px Arial';c.fillStyle='#1f3d5e';
   const marked=row.dias&&typeof row.dias==='object'?row.dias:{};
   for(let day=1;day<=days;day++){
      const val=onlyText(marked[String(day)]||'');
      if(val)c.fillText(val,left+nameWidth+(day-1)*dayWidth+5,y+23,dayWidth-8);
   }
   let x=left+nameWidth+days*dayWidth;
   for(const [title,w,k,kind] of defs){
     const val=kind==='money'?money(row[k]):num(row[k]);
     c.fillText(val,x+5,y+23,w-7);x+=w;
   }
 }
 const y=top+rows.length*lineHeight+27;
 c.font='14px Arial';c.fillStyle='#51677e';
 c.fillText(rows.length+' GCM(s) • marcações diárias e valores registrados na competência fechada.',28,y,can.width-60);
 c.fillText('Documento de consulta gerado a partir do snapshot fechado, não é a impressão original assinada do Desktop.',28,y+27,can.width-60);
 const sign=folha.assinaturas||{};
 const names=[sign.comandante,sign.subcomandante].filter(x=>x?.nome);
 if(names.length){
  c.font='bold 15px Arial';c.fillStyle='#1d3552';
  names.forEach((a,i)=>{
   const x=30+i*650,yy=y+90;
   c.strokeStyle='#8098ad';c.beginPath();c.moveTo(x,yy);c.lineTo(x+520,yy);c.stroke();
   c.fillText(onlyText(a.nome),x+4,yy+23,515);
   c.font='13px Arial';c.fillText(onlyText(a.cargo),x+4,yy+41,515);c.font='bold 15px Arial';
  });
 }
 const img=document.createElement('img');
 img.alt='Folha de Pagamento fechada, competência '+folha.competencia;
 img.src=can.toDataURL('image/png');
 img.style.cssText='display:block;width:100%;height:auto;border:1px solid #c7d8e9;border-radius:8px;background:#fff';
 return img;
}
function renderSheet(folha,container){
 container.replaceChildren();
 const intro=document.createElement('p');
 intro.textContent='Folha '+folha.competencia+' · Fechada · '+(folha.quantidade||0)+' GCM(s)';
 intro.style.cssText='margin:0;color:#45617b;font-size:13px;font-weight:600';
 container.appendChild(intro);
 if(folha.cabecalho_imagem){
  const image=document.createElement('img');
  image.src=folha.cabecalho_imagem;
  image.alt='Cabeçalho institucional registrado no fechamento';
  image.style.cssText='width:100%;max-height:110px;object-fit:contain;object-position:left;background:white';
  container.appendChild(image);
 }
 const sheet=document.createElement('div');
 sheet.className='gc390-sheet';
 sheet.style.cssText='width:100%;max-width:100%;min-width:0;overflow:auto';
 sheet.appendChild(baseCanvas(folha));
 container.appendChild(sheet);
 const label=document.createElement('p');
 label.textContent='Visualização da folha fechada conforme os registros do Desktop. A gestão e a impressão oficial permanecem exclusivamente no Desktop.';
 label.style.cssText='font-size:12px;color:#627a92;margin:0';
 container.appendChild(label);
}
function close(){
 if(root)root.classList.add('hidden');
}
window.gcmbsFecharFolhasFechadas=close;
async function open(){
 const view=$('#gcmbsFolhaFechadaView');
 if(!view){alert('Visualizador da Folha não encontrado.');return;}
 root=view;
 document.querySelectorAll('#appTela main > section[data-view]').forEach(el=>el.classList.toggle('hidden',el!==view));
 document.querySelectorAll('#mainNav [data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module==='folha_pagamento'));
 root.classList.remove('hidden');
 root.replaceChildren();
 root.style.cssText='min-width:0;width:100%;box-sizing:border-box;padding:12px 14px 24px';
 const toolbar=document.createElement('div');
 toolbar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px';
 const title=document.createElement('h2');title.textContent='Folha de Pagamento';title.style.margin='0';
 const back=document.createElement('button');back.type='button';back.className='secondary';back.textContent='Voltar ao Quadro Operacional';
 back.addEventListener('click',()=>{close();const btn=document.querySelector('#mainNav [data-module="quadro_operacional"]');if(btn)btn.click();else{document.querySelectorAll('#appTela main > section[data-view]').forEach(el=>el.classList.toggle('hidden',el.dataset.view!=='inicio'));}});
 toolbar.append(title,back);root.appendChild(toolbar);
 const controls=document.createElement('div');
 controls.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 12px';
 const label=document.createElement('label');label.textContent='Competência fechada  ';label.style.fontWeight='600';
 const select=document.createElement('select');select.setAttribute('aria-label','Competência fechada');select.style.cssText='min-width:170px;padding:9px';
 label.appendChild(select);controls.appendChild(label);root.appendChild(controls);
 const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='color:#59738b;font-size:12px;margin:4px 0 12px';root.appendChild(status);
 const container=document.createElement('div');container.style.cssText='display:grid;gap:10px;min-width:0';root.appendChild(container);
 async function show(comp){
  const request=++sequence;
  status.textContent='Carregando a folha fechada...';
  container.replaceChildren();
  try{
   const data=await api('get',comp);
   if(request!==sequence||!visible())return;
   renderSheet(data.folha,container);
   status.textContent='Consulta somente leitura — nenhuma alteração ou recálculo.';
  }catch(e){if(request===sequence)status.textContent=e.message||'Falha ao carregar a folha.';}
 }
 select.addEventListener('change',()=>show(select.value));
 try{
  const list=await api('list');
  if(!visible())return;
  const items=Array.isArray(list.competencias)?list.competencias:[];
  for(const item of items){const opt=document.createElement('option');opt.value=item.competencia;opt.textContent=item.competencia;select.appendChild(opt);}
  if(!items.length){status.textContent='Nenhuma competência fechada disponível.';return;}
  await show(items[0].competencia);
 }catch(e){status.textContent=e.message||'Falha ao consultar competências.';}
}
window.gcmbsAbrirFolhasFechadas=open;
})();