/* GCMBS Online V368 — consulta de folhas FECHADAS via imagem rasterizada no navegador.
   Nao altera dados, nao oferece abertura, edicao, geracao nem recalculo.
   O desenho usa exclusivamente snapshot original da competencia encerrada pelo Desktop. */
(()=>{
'use strict';
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-folhas-fechadas-read-v368';
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let root=null;
async function call(action,competencia=''){
 const token=localStorage.getItem('gcmbs.mobile.token');
 if(!token)throw Error('Sessão não autenticada.');
 const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,competencia}),cache:'no-store'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.success)throw Error(data.message||'Falha na consulta da Folha');
 return data;
}

/* V389: representar o snapshot fechado COMPLETO em paginas PNG;
   os campos sao exibidos sem recalculo e sem edicao. */
const number=n=>Number(n??0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const safely=s=>String(s??'').replace(/[\u0000-\u001f]/g,' ').slice(0,1000);
const PAGE_W=1560,PAGE_H=1150,MAX_ROWS=18;
function paintPage(folha,part,cols,rows,numberPage){
 const can=document.createElement('canvas');
 can.width=PAGE_W;can.height=PAGE_H;
 const c=can.getContext('2d');
 c.fillStyle='#fff';c.fillRect(0,0,PAGE_W,PAGE_H);
 c.fillStyle='#0d3769';c.fillRect(0,0,PAGE_W,12);
 c.fillStyle='#102d51';c.font='bold 26px Arial';
 c.fillText('GUARDA CIVIL MUNICIPAL DE BREJO SANTO',34,58);
 c.font='bold 19px Arial';
 c.fillText('Folha de Pagamento FECHADA — '+safely(folha.competencia),34,96);
 c.font='15px Arial';
 c.fillText('Página '+numberPage+' • '+part+' • Fechamento: '+safely(folha.fechada_em),34,123,1490);
 c.fillStyle='#e7f1fa';c.fillRect(28,152,1504,48);
 let x=38;
 const size=cols.reduce((v,k)=>v+k[1],0),factor=1490/size;
 c.fillStyle='#183f65';c.font='bold 15px Arial';
 cols.forEach(([head,width])=>{c.fillText(head,x,Math.round(180),width*factor-9);x+=width*factor});
 const line=43,top=208;
 rows.forEach((item,i)=>{
  const y=top+i*line;
  c.fillStyle=i%2?'#ffffff':'#f0f5fa';c.fillRect(28,y,1504,line);
  c.fillStyle='#20344d';c.font='15px Arial';
  let pos=38;
  cols.forEach(([header,width,key,kind])=>{
    const val=item?.[key],v=kind==='money'?money(val):kind==='number'?number(val):kind==='bool'?(val?'SIM':'NÃO'):safely(val);
    c.fillText(v,pos,y+27,width*factor-9);pos+=width*factor;
  });
  c.strokeStyle='#e5eaf0';c.beginPath();c.moveTo(28,y+line);c.lineTo(1532,y+line);c.stroke();
 });
 c.fillStyle='#64748b';c.font='14px Arial';
 c.fillText('Reprodução para consulta do snapshot fechado — não substitui o documento original assinado.',34,1104,1490);
 const img=document.createElement('img');img.src=can.toDataURL('image/png');
 img.alt='Imagem '+part+' — página '+numberPage+' da competência '+folha.competencia;
 img.style.cssText='width:100%;height:auto;border:1px solid #d4e1f0;border-radius:9px;background:#fff;display:block';
 return img;
}
function textPage(folha,title,lines,index){
 const can=document.createElement('canvas');can.width=PAGE_W;can.height=PAGE_H;
 const c=can.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,PAGE_W,PAGE_H);
 c.fillStyle='#0d3769';c.fillRect(0,0,PAGE_W,12);
 c.fillStyle='#132e4f';c.font='bold 27px Arial';c.fillText('GCMBS — '+title,34,60,1490);
 c.font='17px Arial';c.fillText('Competência '+folha.competencia+' • Página '+index+' • Fechada em '+safely(folha.fechada_em),34,100,1490);
 let y=150;c.font='17px Arial';
 for(const line of lines){
  const chunks=[];let rest=safely(line);
  while(rest.length>140){let pos=rest.lastIndexOf(' ',140);if(pos<50)pos=140;chunks.push(rest.slice(0,pos));rest=rest.slice(pos).trim()}
  chunks.push(rest||'—');
  for(const chunk of chunks){if(y>1050)break;c.fillStyle='#273e59';c.fillText(chunk,40,y,1460);y+=27}
  y+=8;
  if(y>1050)break;
 }
 const img=document.createElement('img');img.src=can.toDataURL('image/png');
 img.alt=title+' — página '+index;img.style.cssText='width:100%;height:auto;border:1px solid #d4e1f0;border-radius:9px;background:#fff;display:block';
 return img;
}
function sheet(folha){
 const wrap=document.createElement('div');wrap.style.cssText='display:grid;gap:16px;max-width:100%;min-width:0';
 const status=document.createElement('p');status.textContent='Documentos de consulta: '+folha.quantidade+' registro(s) do fechamento. Valores preservados, sem recálculo.';wrap.appendChild(status);
 if(folha.cabecalho_imagem){
  const image=document.createElement('img');image.src=folha.cabecalho_imagem;
  image.alt='Cabeçalho institucional salvo no fechamento';image.style.cssText='width:100%;max-height:200px;object-fit:contain;object-position:left;background:white;border:1px solid #e2e8f0';
  wrap.appendChild(image);
 }
 const cols=[
  ['Pagamento',[
    ['GCM',280,'nome'],['50% (h)',125,'horas50','number'],['100% (h)',125,'horas100','number'],
    ['Valor 50%',170,'valor50','money'],['Valor 100%',170,'valor100','money'],
    ['Total',185,'valorTotal','money'],['Faltas',115,'faltas','number'],
    ['FJ',100,'faltasJustificadas','number']
  ]],
  ['Apuração e Banco de Horas',[
    ['GCM',250,'nome'],['Apur. 50%',130,'horasApuradas50','number'],
    ['Apur. 100%',130,'horasApuradas100','number'],['Banco 50%',130,'horasBancoOperacional50','number'],
    ['Banco 100%',130,'horasBancoOperacional100','number'],
    ['Receb. 50%',130,'horasBancoRecebidas50','number'],['Receb. 100%',130,'horasBancoRecebidas100','number'],
    ['Realizadas',130,'horasRealizadas','number'],['Pagáveis',130,'horasPagaveis','number']
  ]],
  ['Transportes e Excedentes',[
    ['GCM',235,'nome'],['Transp. 50%',120,'horasTransportadas50','number'],
    ['Transp. 100%',120,'horasTransportadas100','number'],
    ['Limite 50%',120,'horasTransportadasLimite50','number'],
    ['Limite 100%',120,'horasTransportadasLimite100','number'],
    ['Exced. 50%',120,'excedente50','number'],['Exced. 100%',120,'excedente100','number'],
    ['Destino',150,'transportadoPara'],['Destino limite',150,'transportadoLimitePara']
  ]],
  ['Situação e Arredondamentos',[
    ['GCM',245,'nome'],['Situação',135,'status'],
    ['Férias',85,'emFerias','bool'],['Afastado',95,'afastado','bool'],
    ['Noturno',120,'adicionalNoturno'],
    ['Ajuste 50%',130,'ajusteArredondamento50','number'],
    ['Saldo 50%',125,'saldoArredondamento50','number'],
    ['50% mês',120,'horas50Mes','number'],['100% mês',120,'horas100Mes','number']
  ]]
 ];
 const rows=Array.isArray(folha.linhas)?folha.linhas:[];
 let pageNo=0;
 for(const [title,columns] of cols){
  for(let i=0;i<Math.max(rows.length,1);i+=MAX_ROWS){
   pageNo++;
   const part=document.createElement('section');part.style.cssText='display:grid;gap:7px;min-width:0';
   const h=document.createElement('h3');h.textContent=title+' — página '+(Math.floor(i/MAX_ROWS)+1);h.style.margin='8px 0';part.appendChild(h);
   part.appendChild(paintPage(folha,title,columns,rows.slice(i,i+MAX_ROWS),pageNo));wrap.appendChild(part);
  }
 }

 const daily=[];
 for(const r of rows){
  const days=r?.dias&&typeof r.dias==='object'?r.dias:{};
  const pairs=Object.entries(days).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(pairs.length)daily.push('GCM '+safely(r.nome)+': '+pairs.map(([dia,valor])=>String(dia).padStart(2,'0')+'='+safely(valor)).join('  ·  '));
  if(r?.motivoArredondamento50)daily.push('Arredondamento de '+safely(r.nome)+': '+safely(r.motivoArredondamento50));
 }
 if(daily.length){
  const groups=[];let group=[],used=0;
  for(const line of daily){const cost=1+Math.ceil(String(line).length/140);if(used+cost>25&&group.length){groups.push(group);group=[];used=0}group.push(line);used+=cost}
  if(group.length)groups.push(group);
  groups.forEach(g=>wrap.appendChild(textPage(folha,'Dias de serviço e motivos de arredondamento',g,++pageNo)));
 }
 const obs=folha.observacoes||{},sign=folha.assinaturas||{};
 const lines=[];
 if(Object.keys(obs).length){
  for(const [k,label] of [['ferias','Férias'],['faltas','Faltas'],['faltasJustificadas','Faltas justificadas'],['recebidos','Horas recebidas'],['transportados','Horas transportadas'],['transportadosLimite','Transportes por limite'],['arredondamentos','Arredondamentos']]){
   const vals=Array.isArray(obs[k])?obs[k]:[];
   if(!vals.length)continue;
   lines.push(label+':');
   for(const v of vals){
    if(typeof v==='string')lines.push('  • '+v);
    else if(v&&typeof v==='object')lines.push('  • '+Object.entries(v).map(([key,val])=>key+': '+String(val??'')).join(' · '));
   }
  }
  if(obs.status&&Object.keys(obs.status).length){lines.push('Situação dos agentes:');for(const [k,v] of Object.entries(obs.status))lines.push('  • '+k+': '+(Array.isArray(v)?v.join(', '):String(v)))}
 }
 if(Object.keys(sign).length){
  lines.push('Assinaturas registradas no fechamento:');
  for(const [type,detail] of Object.entries(sign))if(detail?.nome)lines.push('  • '+type.toUpperCase()+': '+detail.nome+' — '+(detail.cargo||''));
 }
 if(lines.length){
  const groups=[];let group=[],height=0;
  for(const line of lines){const cost=1+Math.ceil(String(line).length/140);if(height+cost>27&&group.length){groups.push(group);group=[];height=0}group.push(line);height+=cost}
  if(group.length)groups.push(group);
  groups.forEach((g,i)=>wrap.appendChild(textPage(folha,'Observações e assinaturas',g,++pageNo)));
 }
 if(folha.rodape_imagem){
  const im=document.createElement('img');im.src=folha.rodape_imagem;im.alt='Rodapé institucional salvo no fechamento';
  im.style.cssText='width:100%;max-height:150px;object-fit:contain;object-position:left;background:white';wrap.appendChild(im);
 }
 return wrap;
}

function close(){
 const view=document.querySelector('section[data-view="online"]');
 if(!view)return;
 const area=document.getElementById('gcmbs-folhas-fechadas-v368');
 if(area){area.hidden=true;area.style.display='none';}
 view.removeAttribute('data-gc389-payroll-active');
 Array.from(view.children).filter(x=>x.dataset.gc368Suppressed).forEach(x=>{x.hidden=false;delete x.dataset.gc368Suppressed;});
}
window.gcmbsFecharFolhasFechadas=close;
async function open(){
 const view=document.querySelector('section[data-view="online"]');
 if(!view){alert('Tela de consulta indisponível.');return;}
 document.querySelectorAll('main > section[data-view]').forEach(x=>x.classList.toggle('hidden',x!==view));
 root=document.getElementById('gcmbs-folhas-fechadas-v368');
 if(!root){
  root=document.createElement('section');root.id='gcmbs-folhas-fechadas-v368';
  root.style.cssText='display:grid;gap:14px;padding:16px;border:1px solid #cbd5e1;border-radius:16px;background:#fff';
  view.appendChild(root);
 }
 Array.from(view.children).filter(el=>el!==root).forEach(el=>{el.hidden=true;el.dataset.gc368Suppressed='1';});
 root.hidden=false;
 root.style.display='grid';
 view.dataset.gc389PayrollActive='1';
 root.replaceChildren();
 const head=document.createElement('div');head.style.cssText='display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap';
 const title=document.createElement('h2');title.textContent='Folhas de Pagamento — fechadas';head.appendChild(title);
 const back=document.createElement('button');back.type='button';back.textContent='Voltar ao Quadro Operacional';back.className='secondary';
 back.onclick=()=>{close();document.querySelectorAll('main > section[data-view]').forEach(x=>x.classList.toggle('hidden',x.dataset.view!=='inicio'));};
 head.appendChild(back);root.appendChild(head);
 const message=document.createElement('p');message.textContent='Somente imagens geradas a partir de folhas efetivamente fechadas. Nenhuma edição ou recálculo permitido.';
 root.appendChild(message);
 const selector=document.createElement('select');selector.setAttribute('aria-label','Competência fechada');selector.style.cssText='max-width:320px;padding:10px';
 root.appendChild(selector);
 const status=document.createElement('p');status.setAttribute('role','status');root.appendChild(status);
 const display=document.createElement('div');display.style.cssText='overflow:auto';root.appendChild(display);
 async function show(comp){
  status.textContent='Carregando imagem da folha fechada...';display.replaceChildren();
  try{
   const data=await call('get',comp);const image=sheet(data.folha);
   display.appendChild(image);status.textContent='Competência '+comp+' — documento fechado, somente visualização.';
  }catch(e){status.textContent=e.message||'Consulta indisponível.';}
 }
 selector.onchange=()=>show(selector.value);
 status.textContent='Consultando competências fechadas...';
 try{
  const data=await call('list'),items=data.competencias||[];
  if(!items.length){status.textContent='Nenhuma folha fechada disponível.';return;}
  items.forEach(x=>{const opt=document.createElement('option');opt.value=x.competencia;opt.textContent=x.competencia+' — fechada';selector.appendChild(opt);});
  await show(items[0].competencia);
 }catch(e){status.textContent=e.message||'Não foi possível consultar as folhas.';}
}
window.gcmbsAbrirFolhasFechadas=open;
})();