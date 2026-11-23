/* GCMBS Online V394 - paridade funcional de consulta do Quadro.
 * Referencias: Desktop dashboard.js (17/11), v99-clicks.js e DashboardRepository.
 * Nao grava dados. Consultas autenticadas respeitam a permissao dos endpoints.
 */
(()=>{
 'use strict';
 if(window.__gcmbsQuadroParidadeV394)return;
 window.__gcmbsQuadroParidadeV394=true;
 const ROOT='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
 const q=(s,r=document)=>r.querySelector(s);
 const clean=v=>String(v??'').trim();
 const normal=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase();
 const day=()=>q('.gc118-main .gc118-date')?.value||q('#quadroData')?.value||'';
 const fmt=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):d;
 let serial=0;
 async function remote(slug,body){
   const token=localStorage.getItem('gcmbs.mobile.token');
   if(!token)throw new Error('Sessão expirada. Entre novamente no sistema.');
   const r=await fetch(ROOT+slug,{
     method:'POST',cache:'no-store',
     headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
     body:JSON.stringify(body)
   });
   const result=await r.json().catch(()=>({}));
   if(!r.ok||result.success===false)throw new Error(result.message||result.error||'Falha na consulta: HTTP '+r.status);
   return result;
 }
 const quadro=d=>remote('gcmbs-communication-gateway-v74',{action:'quadro_operacional',data:d}).then(x=>x.data?.efetivo?x.data:x);
 const extras=d=>remote('gcmbs-quadro-extras-v68',{data:d});
 async function permutas(d){
   if(d<'2026-11-18')return [];
   try{
     const x=await remote('gcmbs-permutas-efetivas-read-r14',{data:d});
     return x.ok===true&&Array.isArray(x.alocacoes)?x.alocacoes.filter(row=>normal(row.situacao)==='PERMUTA_APROVADA'):[];
   }catch(e){
     // O endpoint R14 e restrito ao Comando e a datas a partir de 18/11.
     if(/403|permiss/i.test(String(e?.message||'')))return [];
     console.warn('[GCMBS V394] consulta opcional de permutas:',e?.message||e);
     return [];
   }
 }
 function modal(title,date){
   const back=q('#quadroModal'),head=q('#quadroModalTitulo'),meta=q('#quadroModalMeta'),list=q('#quadroModalLista');
   if(!back||!head||!meta||!list)throw new Error('Janela de detalhes indisponível.');
   head.textContent=title;
   meta.textContent='Data de referência: '+fmt(date)+' · Consultando dados operacionais...';
   list.replaceChildren();
   list.style.maxHeight='min(64vh,620px)';
   list.style.overflowY='auto';
   back.classList.remove('hidden');
   q('#quadroModalFechar')?.focus?.();
   return {back,meta,list};
 }
 function line(parent,tag,value,cls){
   const el=document.createElement(tag);
   if(cls)el.className=cls;
   el.textContent=String(value??'');
   parent.appendChild(el);
   return el;
 }
 function panel(parent,title,detail,kind=''){
   const item=document.createElement('article');
   item.className='item gc394-item';
   item.style.cssText='padding:12px 14px;margin-bottom:8px;border:1px solid #d8e5f2;border-radius:11px;background:#f9fcff';
   line(item,'strong',title||'Não identificado');
   if(detail)line(item,'span',detail);
   if(kind)line(item,'small',kind,'gc394-kind');
   parent.appendChild(item);return item;
 }
 function empty(list,message){
   line(list,'div',message||'Nenhum registro encontrado para a data selecionada.','empty');
 }
 function noteMeta(meta,date,total,tail=''){
   meta.textContent='Data de referência: '+fmt(date)+' · '+total+' registro(s) · Espelho Online'+(tail?' · '+tail:'');
 }
 function items(list,rows){
   if(!rows.length){empty(list,'Nenhum registro compõe este indicador na data selecionada.');return}
   for(const row of rows){
     const title=typeof row==='string'?row:clean(row?.nome||row?.nome_guerra||row?.nome_completo||row?.prefixo||row?.placa||'-');
     const detail=typeof row==='string'?'':clean(row?.complemento||row?.descricao||row?.motivo||'');
     panel(list,title,detail);
   }
 }
 function coalesceRow(quad,key){
   const m={
    qAtivos:quad?.efetivo?.detalhes?.ativos,
    qAfastados:quad?.efetivo?.detalhes?.afastados,
    qFerias:quad?.efetivo?.detalhes?.feristas,
    qViaturasTotal:quad?.viaturas?.detalhes?.total,
    qViaturasDisponiveis:quad?.viaturas?.detalhes?.disponivel,
    qViaturasUso:quad?.viaturas?.detalhes?.emUso,
    qViaturasManut:quad?.viaturas?.detalhes?.manutencao,
    qServicoA:quad?.efetivo?.detalhes?.servicoA,
    qServicoB:quad?.efetivo?.detalhes?.servicoB,
    qFaltas:quad?.faltas?.registros
   };
   return Array.isArray(m[key])?m[key]:[];
 }
 function titleOf(key){
   return ({
    qAtivos:'GCMs ativos',qAfastados:'GCMs afastados',
    qFerias:'GCMs em férias',qViaturasTotal:'Frota cadastrada',
    qViaturasDisponiveis:'Viaturas disponíveis',
    qViaturasUso:'Viaturas em uso — por turno',
    qViaturasManut:'Viaturas em manutenção',
    qServicoA:'Serviço A — 07h às 19h',
    qServicoB:'Serviço B — 19h às 07h',
    qFaltas:'Faltas do dia'
   })[key]||'Detalhes do Quadro Operacional';
 }
 function fieldFrom(s,label){
   const match=String(s||'').match(new RegExp('(?:^| · )'+label+':\\s*([^·]+)','i'));
   return match?match[1].trim():'';
 }
 function comparePosto(service,postos){
   const raw=clean(service?.complemento).split(' · ')[0];
   return postos.length===0||postos.some(p=>normal(raw.split(', ').join(' | ')).split(' | ').includes(normal(p)));
 }
 function vehicleRows(list,rows,quad,swaps=[]){
   if(!rows.length){empty(list,'Nenhuma viatura em uso no espelho para a data selecionada.');return}
   const effective={A:coalesceRow(quad,'qServicoA'),B:coalesceRow(quad,'qServicoB')};
   for(const v of rows){
     const item=panel(list,v.nome||'-',v.complemento||'');
     const raw=clean(v.complemento);
     const turnList=fieldFrom(raw,'Turno\\(s\\)').split(',').map(normal).filter(Boolean);
     const posts=fieldFrom(raw,'Posto\\(s\\)').split(',').map(clean).filter(Boolean);
     const names=fieldFrom(raw,'GCM\\(s\\)').split(',').map(clean).filter(Boolean);
     if(!turnList.length)continue;
     const area=document.createElement('div');area.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:8px;margin-top:9px';
     const unmatched=[];
     const per={A:[],B:[]};
     for(const name of names){
       const matches=['A','B'].filter(t=>turnList.includes(t)&&effective[t].some(x=>normal(x.nome)===normal(name)&&comparePosto(x,posts)));
       if(matches.length)for(const t of matches){
         const chosen=swaps.filter(p=>normal(p.guarda_original)===normal(name)&&
           (normal(p.turno)===t||normal(p.turno)==='COMPLETO')&&
           (!p.posto||posts.some(x=>normal(x)===normal(p.posto))));
         const display=chosen.length===1&&clean(chosen[0].guarda_efetivo)?
           clean(chosen[0].guarda_efetivo)+' (substitui '+name+')':name;
         per[t].push(display);
       }
       else if(turnList.length===1&&['A','B'].includes(turnList[0]))per[turnList[0]].push(name);
       else unmatched.push(name);
     }
     for(const turn of ['A','B']){
       if(!turnList.includes(turn))continue;
       const cell=document.createElement('div');cell.style.cssText='border:1px solid #d9e5ef;border-radius:8px;background:#fff;padding:9px';
       line(cell,'strong','Turno '+turn+' · '+(turn==='A'?'07h–19h':'19h–07h'));
       line(cell,'div',per[turn].length?per[turn].join(', '):'Sem GCM confirmado neste turno.');
       area.appendChild(cell);
     }
     item.appendChild(area);
     if(unmatched.length)line(item,'small','Turno não identificado com segurança: '+unmatched.join(', '));
   }
 }
 function permutaDisplay(rows,arr,turn,list){
   const target=arr.filter(p=>normal(p.turno)===turn||normal(p.turno)==='COMPLETO');
   if(!target.length)return;
   const unmatched=[];
   for(const p of target){
     const candidates=rows.filter(x=>normal(x.nome)===normal(p.guarda_original)&&(
       !p.posto||normal(x.complemento).includes(normal(p.posto))
     ));
     if(candidates.length===1){
       candidates[0].nome=clean(p.guarda_efetivo)||candidates[0].nome;
       candidates[0].complemento=clean(candidates[0].complemento)+
          ' · Permuta aprovada: '+clean(p.guarda_original)+' → '+clean(p.guarda_efetivo)+
          (p.protocolo_permutado?' · Protocolo '+clean(p.protocolo_permutado):'');
     }else unmatched.push(p);
   }
   if(unmatched.length){
     const section=document.createElement('section');
     section.style.cssText='padding:10px;margin-top:12px;border-top:1px solid #dce7f2';
     line(section,'strong','Permutas aprovadas com vínculo não conciliado à lista-base');
     for(const p of unmatched)panel(section,clean(p.guarda_original)+' → '+clean(p.guarda_efetivo),
       clean(p.posto)+' · Turno '+clean(p.turno)+' · '+clean(p.protocolo_permutado||''));
     list.appendChild(section);
   }
 }
 async function registeredPosts(date,ctx){
   const [ref,quad]=await Promise.all([remote('gcmbs-communication-gateway-v74',{action:'references'}),quadro(date)]);
   const refs=ref?.references||ref;
   const posts=Array.isArray(refs.postos)?refs.postos:[];
   const coverage=Array.isArray(quad?.postos?.detalhamento)?quad.postos.detalhamento:[];
   noteMeta(ctx.meta,date,posts.length,'Postos cadastrados; '+coverage.length+' coberto(s)');
   if(!posts.length){empty(ctx.list,'Nenhum posto cadastrado retornado pela sincronização.');return}
   for(const p of posts){
     const name=clean(p.nome||p.descricao||p.posto||p.sigla||'Posto');
     const found=coverage.filter(x=>normal(x.nome)===normal(name));
     const desc=['Prioridade '+clean(p.prioridade??p.prioridade_operacional??'-'),
       'Mínimo '+clean(p.quantidade_minima??p.minimo??'-'),
       'Máximo '+clean(p.quantidade_maxima??p.maximo??'-')];
     const item=panel(ctx.list,name,desc.join(' · '));
     if(found.length)for(const x of found)line(item,'small','Cobertura da data: '+clean(x.complemento||'Sim'));
     else line(item,'small','Sem cobertura informada no espelho para a data selecionada.');
   }
 }
 async function detailsFor(key,date,ctx){
   const quad=await quadro(date);
   let rows=coalesceRow(quad,key);
   if(!quad?.efetivo||!quad?.viaturas)throw new Error('Resposta incompleta do Quadro Online.');
   noteMeta(ctx.meta,date,rows.length);
   if(quad.meta?.extras_consulta==='INDISPONIVEL'&&['qServicoA','qServicoB'].includes(key)){
     line(ctx.list,'small','Aviso: a consulta de Extras não foi confirmada. Os totais deste turno podem estar incompletos.');
   }
   if(key==='qViaturasUso'){
     const approved=await permutas(date);
     vehicleRows(ctx.list,rows,quad,approved);
     return;
   }
   if(key==='qServicoA'||key==='qServicoB'){
     const turn=key==='qServicoA'?'A':'B';
     // Não alterar o snapshot; operar somente sobre cópias exibidas.
     rows=rows.map(x=>({...x}));
     const swaps=await permutas(date);
     permutaDisplay(rows,swaps,turn,ctx.list);
     for(const r of rows){
       const nature=normal(r.tipo_servico||r.origem||r.complemento);
       const tipo=nature.includes('EXTRA')?(nature.includes('ORDINARIO')?'ORDINÁRIO + EXTRA':'EXTRA'):'ORDINÁRIO';
       panel(ctx.list,clean(r.nome),clean(r.complemento),tipo);
     }
     if(!rows.length)empty(ctx.list,'Nenhum serviço confirmado neste turno na réplica Online.');
     return;
   }
   items(ctx.list,rows);
 }
 async function extraTurn(turn,date,ctx){
   const data=await extras(date);
   const list=turn==='A'?data.extrasA:data.extrasB;
   if(!Array.isArray(list))throw new Error('Consulta de Extras não retornou lista do turno '+turn+'.');
   const grouped=new Map();
   for(const r of list){
     const name=clean(r.nome||r.nome_guerra||'GCM');
     const k=Number(r.guarda_id)>0?'ID:'+Number(r.guarda_id):normal(name);
     if(!grouped.has(k))grouped.set(k,{name,parts:[]});
     const type=normal(r.origem).includes('EVENTO')?'Evento':normal(r.origem).includes('MANUAL')?'Manual':'Automática';
     const detail=type+' · '+clean(r.complemento||r.descricao||'Extra');
     if(!grouped.get(k).parts.includes(detail))grouped.get(k).parts.push(detail);
   }
   noteMeta(ctx.meta,date,grouped.size,'Turno '+turn+' · '+list.length+' designação(ões)');
   if(!grouped.size){empty(ctx.list,'Nenhuma Extra consta no espelho Online para este turno. A sincronização com o Desktop pode estar pendente.');return}
   for(const p of [...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')))
     panel(ctx.list,p.name,p.parts.join(' · '),'SERVIÇO EXTRA · TURNO '+turn);
 }
 async function open(id){
   const date=day();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
   const key=id==='__extra_a__'?'Extra A':id==='__extra_b__'?'Extra B':id==='__postos_total__'?'Postos cadastrados':titleOf(id);
   const ctx=modal(key,date),current=++serial;
   try{
     if(id==='__extra_a__'||id==='__extra_b__')await extraTurn(id==='__extra_a__'?'A':'B',date,ctx);
     else if(id==='__postos_total__')await registeredPosts(date,ctx);
     else await detailsFor(id,date,ctx);
   }catch(e){
     if(current!==serial)return;
     ctx.meta.textContent='Data de referência: '+fmt(date)+' · Falha de consulta';
     empty(ctx.list,'Não foi possível consultar este indicador: '+clean(e?.message||e));
   }
 }
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&!q('#quadroModal')?.classList.contains('hidden')){
     q('#quadroModal')?.classList.add('hidden');
   }
 },true);
 document.addEventListener('click',e=>{
   const t=e.target;
   const btn=t?.closest?.('.gc118-main button.gc118-metric, .gc118-main button.gc118-bar-col');
   if(!btn||!btn.closest('.gc118-main')||btn.dataset.gc118Id==='__detalhes_frota__')return;
   const key=btn.dataset.gc118Id||btn.dataset.source;
   if(!key)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   open(key).catch(err=>console.warn('[GCMBS V394] detalhe:',err));
 },true);
})();
