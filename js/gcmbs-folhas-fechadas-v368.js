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
const MONTHS=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
function periodo(comp){
 const m=/^(\d{4})-(\d{2})$/.exec(String(comp||''));
 if(!m)return {label:String(comp||''),dates:[]};
 const year=Number(m[1]),month=Number(m[2]);if(month<1||month>12)return {label:String(comp),dates:[]};
 const dates=[];
 // Os fechamentos anteriores a novembro/2026 ainda usavam competencia mensal.
 // Excecao confirmada: outubro/2026 foi fechado de 01 a 19/10.
 if(year<2026||(year===2026&&month<=10)){
  const last=year===2026&&month===10?19:new Date(Date.UTC(year,month,0)).getUTCDate();
  for(let d=1;d<=last;d++)dates.push({day:d,month,year});
 }else{
  const prevMonth=month===1?12:month-1,prevYear=month===1?year-1:year;
  const last=new Date(Date.UTC(prevYear,prevMonth,0)).getUTCDate();
  for(let d=20;d<=last;d++)dates.push({day:d,month:prevMonth,year:prevYear});
  for(let d=1;d<=19;d++)dates.push({day:d,month,year});
 }
 const first=dates[0],last=dates[dates.length-1];
 const label=first&&last?String(first.day).padStart(2,'0')+'/'+String(first.month).padStart(2,'0')+'/'+first.year+' A '+String(last.day).padStart(2,'0')+'/'+String(last.month).padStart(2,'0')+'/'+last.year:'';
 return {dates,label,month,year};
}
function paint(folha){
 const rows=Array.isArray(folha.linhas)?folha.linhas:[];
 const per=periodo(folha.competencia);
 const cols=per.dates;
 const scale=2, left=16, nameWidth=322,warWidth=112,noWidth=34,dayWidth=27;
 const summaries=[
  {title:'QT 50%',field:'horas50',w:72,type:'number'},
  {title:'VALOR 50%',field:'valor50',w:103,type:'money'},
  {title:'QT 100%',field:'horas100',w:76,type:'number'},
  {title:'VALOR 100%',field:'valor100',w:104,type:'money'},
  {title:'QT TOTAL',field:'horasPagaveis',w:86,type:'number'},
  {title:'VALOR TOTAL',field:'valorTotal',w:106,type:'money'},
  {title:'FALTAS',field:'faltas',w:73,type:'number'},
  {title:'ADIC. NOT.',field:'adicionalNoturno',w:91,type:'text'}
 ];
 const tableWidth=noWidth+nameWidth+warWidth+cols.length*dayWidth+summaries.reduce((a,v)=>a+v.w,0);
 const width=tableWidth+left*2;
 const rowH=23,tableTop=134,bandH=23,headerH=36,bodyY=tableTop+bandH+headerH;
 const extraLines=[];
 const obs=folha.observacoes||{};
 const list=(key,label,transform)=>{
  const arr=Array.isArray(obs[key])?obs[key]:[];
  if(arr.length)extraLines.push(label+': '+arr.map(transform||((x)=>typeof x==='string'?x:(x.nome||''))).filter(Boolean).join('  ·  '));
 };
 list('ferias','OBS. 1 — Férias');
 const statuses=obs.status&&typeof obs.status==='object'?obs.status:{};
 for(const [k,v]of Object.entries(statuses)){
  if(Array.isArray(v)&&v.length)extraLines.push('OBS. 2 — '+String(k)+': '+v.join(', '));
 }
 list('faltasJustificadas','Faltas justificadas',x=>x.nome+' ('+String(x.inicio||'')+(x.fim&&x.fim!==x.inicio?' a '+x.fim:'')+')');
 list('faltas','Faltas',x=>typeof x==='string'?x:String(x.nome||''));
 const notesStart=bodyY+rows.length*rowH+25;
 const height=Math.max(450,notesStart+20+Math.max(3,extraLines.length)*23+31);
 const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
 const c=canvas.getContext('2d');c.scale(scale,scale);c.fillStyle='white';c.fillRect(0,0,width,height);
 const draw=(text,x,y,max,font='10px Georgia',color='#263e5b')=>{
  c.font=font;c.fillStyle=color;c.fillText(String(text??''),x,y,Math.max(max,5));
 };
 c.fillStyle='#e9f2fa';c.fillRect(left,tableTop,tableWidth,bandH+headerH);
 c.strokeStyle='#b9cddd';c.strokeRect(left,tableTop,tableWidth,bandH+headerH+rows.length*rowH);
 draw('FOLHA DE PAGAMENTO — COMPETÊNCIA '+MONTHS[(per.month||1)-1]+' de '+per.year,left+4,31,width-40,'bold 19px Georgia','#071f45');
 draw('PERÍODO: '+per.label,left+4,55,width-40,'bold 13px Georgia','#1c3150');
 draw('DIAS ESCALADOS',left+noWidth+nameWidth+warWidth+7,tableTop+16,cols.length*dayWidth-15,'bold 11px Georgia','#36536c');
 const sumX=left+noWidth+nameWidth+warWidth+cols.length*dayWidth;
 draw('RESUMO FINAL',sumX+7,tableTop+16,width-sumX-20,'bold 11px Georgia','#36536c');
 // Linhas do cabecalho.
 const headers=[['Nº',noWidth],['NOME',nameWidth],['NOME DE GUERRA',warWidth]];
 let x=left;
 for(const [title,w]of headers){draw(title,x+3,tableTop+bandH+22,w-6,'bold 9px Georgia','#254465');x+=w;}
 for(const date of cols){draw(String(date.day).padStart(2,'0'),x+4,tableTop+bandH+22,dayWidth-6,'bold 10px Georgia','#254465');x+=dayWidth;}
 for(const h of summaries){draw(h.title,x+3,tableTop+bandH+22,h.w-5,'bold 9px Georgia','#254465');x+=h.w;}
 // Linhas do efetivo, preenchidas somente com dados do fechamento.
 rows.forEach((r,i)=>{
  const y=bodyY+i*rowH;
  const status=String(r.status||'').toUpperCase();
  const commander=/COMANDANTE/i.test(String(r.cargo||''));
  const away=!!r.afastado||status==='AFASTADO';
  const vacation=!!r.emFerias;
  c.fillStyle=away?'#f93b36':commander?'#1ac8f4':vacation?'#e8f0f7':i%2?'#fff':'#f2f7fb';
  c.fillRect(left,y,tableWidth,rowH);
  draw(String(i+1).padStart(2,'0'),left+3,y+15,noWidth-5,'9px Georgia',away?'#fff':'#35506d');
  draw(r.nome_completo||r.nome,left+noWidth+3,y+15,nameWidth-6,'10px Georgia',away?'#fff':'#17314f');
  draw(r.nome||'',left+noWidth+nameWidth+3,y+15,warWidth-6,'bold 9px Georgia',away?'#fff':'#17314f');
  let dx=left+noWidth+nameWidth+warWidth;
  const marks=r.dias&&typeof r.dias==='object'?r.dias:{};
  cols.forEach(date=>{
   const val=String(marks[String(date.day)]||'').slice(0,3);
   draw(val||'-',dx+8,y+15,dayWidth-10,'10px Georgia',away?'#fff':'#284764');
   dx+=dayWidth;
  });
  for(const sum of summaries){
   if(sum.type==='money'&&!away){c.fillStyle='#9cf18c';c.fillRect(dx,y,sum.w,rowH);}
   const raw=r[sum.field];
   const value=away?'—':sum.type==='money'?num(raw):sum.type==='number'?num(raw):String(raw||'—');
   draw(value,dx+4,y+15,sum.w-7,'bold 9px Georgia',away?'#fff':'#17314f');
   dx+=sum.w;
  }
  c.strokeStyle='#d5e0e9';c.beginPath();c.moveTo(left,y+rowH);c.lineTo(left+tableWidth,y+rowH);c.stroke();
 });
 c.strokeStyle='#ccdce9';let lx=left;
 for(const w of [noWidth,nameWidth,warWidth,...cols.map(()=>dayWidth),...summaries.map(h=>h.w)]){
  c.beginPath();c.moveTo(lx,tableTop+bandH);c.lineTo(lx,bodyY+rows.length*rowH);c.stroke();lx+=w;
 }
 draw('Legenda: X = serviço identificado; F = falta; FJ = falta justificada.',left,notesStart,width-left*2,'10px Georgia','#465b70');
 for(let i=0;i<extraLines.length;i++)draw(extraLines[i],left+4,notesStart+24+i*23,width-left*2-8,'10px Georgia','#455b73');
 draw('Consulta da folha fechada • Sem edição ou recálculo • Documento oficial permanece no Desktop.',left,height-17,width-left*2,'10px Georgia','#526b82');
 const image=document.createElement('img');
 image.alt='Folha de Pagamento fechada '+folha.competencia+' no formato do Desktop';
 image.src=canvas.toDataURL('image/png');
 image.style.cssText='display:block;width:100%;height:auto;background:#fff';
 return image;
}
function renderSheet(folha,container){
 container.replaceChildren();
 if(folha.cabecalho_imagem){
  const head=document.createElement('img');head.src=folha.cabecalho_imagem;
  head.alt='Cabeçalho institucional do fechamento';
  head.style.cssText='display:block;width:100%;max-height:135px;object-fit:contain;background:#fff';
  container.appendChild(head);
 }
 const frame=document.createElement('div');frame.className='gc390-sheet';
 frame.style.cssText='width:100%;max-width:100%;min-width:0;overflow:auto;border:1px solid #cad9e7;border-radius:6px;background:white';
 frame.appendChild(paint(folha));container.appendChild(frame);
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