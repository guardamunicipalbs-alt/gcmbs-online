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
function text(ctx,s,x,y,max=500){ctx.fillText(String(s??''),x,y,max);}
function sheet(snapshot){
 const rows=snapshot.linhas||[];
 const w=1460,lineHeight=44,top=194;
 const canvas=document.createElement('canvas');
 canvas.width=w;canvas.height=Math.max(480,top+Math.max(1,rows.length)*lineHeight+135);
 const c=canvas.getContext('2d');
 c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
 c.fillStyle='#122946';c.fillRect(0,0,w,14);
 c.font='700 26px Arial, sans-serif';text(c,'GUARDA CIVIL MUNICIPAL DE BREJO SANTO',38,58,w-60);
 c.font='20px Arial, sans-serif';text(c,'Folha de Pagamento Fechada — '+String(snapshot.competencia||''),38,97,w-60);
 c.font='15px Arial, sans-serif';text(c,'Documento visual gerado a partir do snapshot fechado no Desktop em '+String(snapshot.fechada_em||''),38,130,w-60);
 c.font='bold 17px Arial, sans-serif';
 c.fillStyle='#e6eef8';c.fillRect(28,top-36,w-56,40);
 c.fillStyle='#122946';
 const xs=[40,500,662,812,962,1112,1280];
 const head=['GCM','Horas 50%','Horas 100%','Valor 50%','Valor 100%','Total','Faltas'];
 head.forEach((h,i)=>text(c,h,xs[i],top-11,i===0?445:145));
 rows.forEach((r,i)=>{
  let y=top+i*lineHeight;
  c.fillStyle=i%2?'#fff':'#f4f7fb';c.fillRect(28,y,w-56,lineHeight);
  c.strokeStyle='#dbe5f0';c.beginPath();c.moveTo(28,y+lineHeight);c.lineTo(w-28,y+lineHeight);c.stroke();
  c.fillStyle='#1a2d49';c.font=i===0?'bold 16px Arial':'16px Arial';
  const vals=[r.nome,r.horas50,r.horas100,money(r.valor50),money(r.valor100),money(r.valorTotal),r.faltas];
  vals.forEach((v,j)=>text(c,v,xs[j],y+28,j===0?445:145));
 });
 const foot=top+Math.max(1,rows.length)*lineHeight+38;
 c.font='14px Arial';c.fillStyle='#64748b';
 text(c,'Representação de consulta, somente leitura — '+rows.length+' registro(s). Os valores são do fechamento gravado no Desktop.',38,foot,w-70);
 const img=document.createElement('img');
 img.src=canvas.toDataURL('image/png');img.alt='Imagem da Folha de Pagamento fechada — '+snapshot.competencia;
 img.style.cssText='width:100%;height:auto;border:1px solid #cbd5e1;border-radius:8px;background:white';
 return img;
}
function close(){
 const view=document.querySelector('section[data-view="online"]');
 if(!view)return;
 const area=document.getElementById('gcmbs-folhas-fechadas-v368');
 if(area)area.hidden=true;
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