// GCMBS 10.0.62 — paridade do módulo Ocorrências / Produção com o Desktop.
// Intercepta o envio antes das implementações legadas para impedir campos divergentes.
const OCC62_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const occ62$=id=>document.getElementById(id);
const occ62Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const occ62Iso=v=>String(v||'').slice(0,10);
const occ62Fmt=v=>{const s=occ62Iso(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
const OCC62_IMG_TYPES=new Set(['image/jpeg','image/png']);
const OCC62_OTHER_TYPES=new Set(['image/jpeg','image/png','application/pdf']);
const OCC62_MAX_FILE=12*1024*1024;
const OCC62_MAX_OTHER=5;
const OCC62_BAD_SCALE=new Set(['CANCELADA','CANCELADO','EXCLUIDA','EXCLUÍDA','INATIVA','INATIVO','SIMULADA','SIMULADO']);
let occ62Refs=null,occ62Session=null,occ62Scales=null,occ62Rows=[],occ62ViewRows=[],occ62HistoryBusy=false,occ62TeamBusy=false,occ62HistoryRendering=false;

async function occ62Api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(OCC62_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
async function occ62GetRefs(force=false){
  if(occ62Refs&&!force)return occ62Refs;
  try{occ62Refs=await occ62Api('references');}catch{occ62Refs={guardas:[],viaturas:[],postos:[]};}
  return occ62Refs||{guardas:[],viaturas:[],postos:[]};
}
async function occ62GetSession(){if(occ62Session)return occ62Session;try{occ62Session=(await occ62Api('session')).session||null;}catch{occ62Session=null;}return occ62Session;}
async function occ62Entity(entity,limit=5000){return occ62Api('entity_list',{entity,limit,offset:0});}
async function occ62GetScales(force=false){
  if(occ62Scales&&!force)return occ62Scales;
  try{const b=await occ62Entity('escalas',5000);occ62Scales=(b.records||[]).map(r=>r.data||{});}catch{occ62Scales=[];}
  return occ62Scales;
}
function occ62ViewActive(){const v=document.querySelector('[data-view="ocorrencias"]');return !!v&&!v.classList.contains('hidden');}
function occ62Turno(){const h=Number(String(occ62$('occHora')?.value||'12:00').slice(0,2));return h>=19||h<7?'B':'A';}
function occ62ScaleActive(d){return !OCC62_BAD_SCALE.has(String(d?.status||'ATIVA').trim().toUpperCase());}
function occ62ScaleMatches(d,data,turno){
  if(!occ62ScaleActive(d)||occ62Iso(d.data)!==data)return false;
  const t=String(d.turno||'').trim().toUpperCase();
  // IMPORTANTE: jornada_24h não significa que uma linha do turno A também
  // pertence ao turno B. Quando o Desktop grava A/B separados, o turno é soberano.
  if(t)return t===turno||t==='COMPLETO';
  const hi=String(d.horario_inicio||d.hist_horario_inicio||'').slice(0,5),hf=String(d.horario_fim||d.hist_horario_fim||'').slice(0,5);
  if(!hi||!hf)return false;
  if(hi===hf)return true;
  const min=s=>{const [h,m]=s.split(':').map(Number);return h*60+(m||0);},ag=Number(String(occ62$('occHora')?.value||'12:00').slice(0,2))*60+Number(String(occ62$('occHora')?.value||'12:00').slice(3,5)||0),a=min(hi),b=min(hf);
  return a<b?(ag>=a&&ag<b):(ag>=a||ag<b);
}
function occ62RemoveExtraFields(){
  for(const id of ['occPosto','occViatura'])occ62$(id)?.closest('label')?.remove();
}
function occ62EnsurePhoto(afterId,id,label){
  let input=occ62$(id);
  if(!input){
    const after=occ62$(afterId)?.closest('label');if(!after)return;
    const wrap=document.createElement('label');wrap.className='full audit-occ-file occ62-file';wrap.innerHTML=`${occ62Esc(label)}<input id="${id}" type="file" accept="image/jpeg,image/png"><small>JPG ou PNG · máximo 12 MB.</small>`;after.insertAdjacentElement('afterend',wrap);input=occ62$(id);
  }
  if(input){input.type='file';input.accept='image/jpeg,image/png';input.multiple=false;const lab=input.closest('label');lab?.classList.add('occ62-file');let sm=lab?.querySelector('small');if(!sm&&lab){sm=document.createElement('small');lab.appendChild(sm);}if(sm)sm.textContent='JPG ou PNG · máximo 12 MB.';}
}
function occ62EnsureOtherFiles(){
  let el=occ62$('occDemaisArquivos');
  if(el&&el.tagName!=='INPUT'){
    const old=el,lab=old.closest('label'),input=document.createElement('input');input.id='occDemaisArquivos';input.type='file';input.multiple=true;input.accept='image/jpeg,image/png,application/pdf';old.replaceWith(input);el=input;
    if(lab){for(const n of [...lab.childNodes])if(n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim()){n.nodeValue='Demais arquivos ';break;}let sm=lab.querySelector('small');if(!sm){sm=document.createElement('small');lab.appendChild(sm);}sm.textContent='JPG, PNG ou PDF · até 5 arquivos · máximo 12 MB cada.';}
  }
  if(!el){
    const after=occ62$('occHistorico')?.closest('label');if(!after)return;
    const lab=document.createElement('label');lab.className='full occ62-file';lab.innerHTML='Demais arquivos<input id="occDemaisArquivos" type="file" multiple accept="image/jpeg,image/png,application/pdf"><small>JPG, PNG ou PDF · até 5 arquivos · máximo 12 MB cada.</small>';after.insertAdjacentElement('afterend',lab);el=occ62$('occDemaisArquivos');
  }
  if(el){el.type='file';el.multiple=true;el.accept='image/jpeg,image/png,application/pdf';}
}
function occ62EnsureAlgemasNotice(){
  if(occ62$('occ62AlgemasNotice')||!occ62$('occAlgemas'))return;
  const lab=occ62$('occAlgemas').closest('label'),n=document.createElement('div');n.id='occ62AlgemasNotice';n.className='full notice';n.innerHTML='<strong>Súmula Vinculante 11 do STF</strong><br>O uso de algemas é excepcional e deve ser justificado por escrito nas hipóteses de resistência, fundado receio de fuga ou perigo à integridade física própria ou alheia, conforme a regra adotada no formulário Desktop.';lab?.insertAdjacentElement('afterend',n);
}
function occ62EnsureHistoryFilters(){
  const host=occ62$('occLista');if(!host||occ62$('occ62HistoryFilters'))return;
  const box=document.createElement('div');box.id='occ62HistoryFilters';box.className='report-filters';box.style.marginBottom='12px';box.innerHTML='<label>Data inicial<input id="occ62Inicio" type="date"></label><label>Data final<input id="occ62Fim" type="date"></label><button id="occ62Filtrar" class="primary" type="button">Filtrar</button><button id="occ62Limpar" class="secondary" type="button">Limpar filtros</button><span id="occ62HistoryCount" class="muted"></span>';
  host.parentElement?.insertBefore(box,host);
  occ62$('occ62Filtrar')?.addEventListener('click',occ62RenderHistory);
  occ62$('occ62Limpar')?.addEventListener('click',()=>{if(occ62$('occ62Inicio'))occ62$('occ62Inicio').value='';if(occ62$('occ62Fim'))occ62$('occ62Fim').value='';occ62RenderHistory();});
}
function occ62NormalizeForm(){
  if(!occ62$('occForm'))return;
  occ62RemoveExtraFields();
  occ62EnsurePhoto('occSuspeitos','occSuspeitosFoto','Documentação do(s) suspeito(s) (foto)');
  occ62EnsurePhoto('occVitimas','occVitimasFoto','Documentação da(s) vítima(s) (foto)');
  occ62EnsurePhoto('occTestemunhas','occTestemunhasFoto','Documentação da(s) testemunha(s) (foto)');
  occ62EnsurePhoto('occMateriais','occMaterialFoto','Material apreendido (foto)');
  occ62EnsureOtherFiles();occ62EnsureAlgemasNotice();occ62EnsureHistoryFilters();
}
function occ62GuardaName(id,refs=occ62Refs||{}){const n=Number(id),g=(refs.guardas||[]).find(x=>Number(x.id||x.guarda_id)===n);return g?.nome_guerra||g?.nome_completo||`GCM ${id}`;}
async function occ62RefreshTeam(){
  if(occ62TeamBusy||!occ62$('occEquipe'))return;const data=occ62$('occData')?.value||'',hora=occ62$('occHora')?.value||'';if(!data||!hora)return;
  occ62TeamBusy=true;try{
    const [refs,sc,s]=await Promise.all([occ62GetRefs(),occ62GetScales(),occ62GetSession()]),turno=occ62Turno();
    const ids=new Set(sc.filter(d=>occ62ScaleMatches(d,data,turno)).map(d=>Number(d.guarda_id)).filter(Boolean));
    const guardas=(refs.guardas||[]).slice().sort((a,b)=>String(a.nome_guerra||a.nome_completo||'').localeCompare(String(b.nome_guerra||b.nome_completo||''),'pt-BR'));
    const host=occ62$('occEquipe');if(!host)return;
    host.innerHTML=guardas.map(g=>`<label class="${ids.has(Number(g.id))?'suggested':''}"><input type="checkbox" class="occ-team" data-occ62-team="1" value="${occ62Esc(g.id)}" ${ids.has(Number(g.id))?'checked':''}> ${occ62Esc(g.nome_guerra||g.nome_completo||'GCM')}</label>`).join('');
    const updateCond=()=>{const checked=new Set([...document.querySelectorAll('.occ-team:checked')].map(x=>Number(x.value))),cond=occ62$('occCondutor');if(!cond)return;const cur=cond.value;cond.innerHTML='<option value="">Selecione...</option>'+guardas.filter(g=>checked.has(Number(g.id))).map(g=>`<option value="${occ62Esc(g.id)}">${occ62Esc(g.nome_guerra||g.nome_completo||'GCM')}</option>`).join('');if([...cond.options].some(o=>o.value===cur))cond.value=cur;else if(checked.has(Number(s?.guarda_id)))cond.value=String(s.guarda_id);};
    host.querySelectorAll('.occ-team').forEach(x=>x.addEventListener('change',updateCond));updateCond();
  }catch(e){console.warn('[GCMBS][OCORRENCIAS] Falha ao pré-selecionar equipe:',e?.message||e);}finally{occ62TeamBusy=false;}
}
function occ62ReadDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(new Error(`Não foi possível ler ${file.name}.`));r.readAsDataURL(file);});}
async function occ62SingleFile(id,prefix){
  const f=occ62$(id)?.files?.[0];if(!f)return{};
  if(!OCC62_IMG_TYPES.has(f.type))throw new Error(`${f.name}: formato não permitido. Use JPG ou PNG.`);
  if(f.size>OCC62_MAX_FILE)throw new Error(`${f.name}: máximo 12 MB.`);
  return {[`${prefix}_nome`]:f.name,[`${prefix}_tipo`]:f.type,[`${prefix}_dados`]:await occ62ReadDataUrl(f)};
}
async function occ62OtherFiles(){
  const fs=[...(occ62$('occDemaisArquivos')?.files||[])];if(fs.length>OCC62_MAX_OTHER)throw new Error('Selecione no máximo 5 arquivos em Demais arquivos.');
  const out=[];for(const f of fs){if(!OCC62_OTHER_TYPES.has(f.type))throw new Error(`${f.name}: formato não permitido. Use JPG, PNG ou PDF.`);if(f.size>OCC62_MAX_FILE)throw new Error(`${f.name}: máximo 12 MB.`);out.push({nome:f.name,tipo:f.type,dados:await occ62ReadDataUrl(f)});}return out;
}
async function occ62Save(e){
  if(e.target?.id!=='occForm')return;
  // Listener registrado antes das implementações antigas: este contrato é o soberano.
  e.preventDefault();e.stopImmediatePropagation();
  const msg=occ62$('occMsg');if(msg)msg.textContent='Salvando ocorrência...';
  try{
    occ62NormalizeForm();
    const data=occ62$('occData')?.value||'',hora=occ62$('occHora')?.value||'',naturezas=[...document.querySelectorAll('.occ-nat:checked')].map(x=>x.value),outro=String(occ62$('occNaturezaOutro')?.value||'').trim(),comp=[...new Set([...document.querySelectorAll('.occ-team:checked')].map(x=>Number(x.value)).filter(Boolean))],cond=Number(occ62$('occCondutor')?.value||0),s=await occ62GetSession();
    if(!data)throw new Error('Informe a data da ocorrência.');if(!hora)throw new Error('Informe a hora da ocorrência.');if(!naturezas.length&&!outro)throw new Error('Informe ao menos uma natureza da ocorrência.');if(!comp.length)throw new Error('Selecione os membros da equipe.');if(!cond||!comp.includes(cond))throw new Error('O condutor deve fazer parte da equipe.');if(occ62$('occAlgemas')?.value==='SIM'&&!String(occ62$('occJustAlgemas')?.value||'').trim())throw new Error('Justifique o uso de algemas.');
    const demais=await occ62OtherFiles();
    const d={
      data,hora,tipo:naturezas.join(', ')||outro||'OUTRO',naturezas:JSON.stringify(naturezas),natureza_outro:outro,
      recebida_via:occ62$('occVia')?.value||'',recebida_via_outro:String(occ62$('occViaOutro')?.value||'').trim(),local:String(occ62$('occLocal')?.value||'').trim(),
      suspeitos_dados:String(occ62$('occSuspeitos')?.value||'').trim(),suspeitos_sexo:occ62$('occSuspeitosSexo')?.value||'',suspeitos_sexo_outro:String(occ62$('occSuspeitosSexoOutro')?.value||'').trim(),
      vitimas_dados:String(occ62$('occVitimas')?.value||'').trim(),vitimas_sexo:occ62$('occVitimasSexo')?.value||'',vitimas_sexo_outro:String(occ62$('occVitimasSexoOutro')?.value||'').trim(),
      testemunhas_dados:String(occ62$('occTestemunhas')?.value||'').trim(),uso_algemas:occ62$('occAlgemas')?.value||'NÃO',justificativa_algemas:String(occ62$('occJustAlgemas')?.value||'').trim(),
      materiais_apreendidos:String(occ62$('occMateriais')?.value||'').trim(),composicao_equipe:JSON.stringify(comp),condutor_ocorrencia_id:cond,responsavel_id:Number(s?.guarda_id||0)||null,
      procedimentos_adotados:String(occ62$('occProcedimentos')?.value||'').trim(),historico_ocorrencia:String(occ62$('occHistorico')?.value||'').trim(),demais_arquivos:JSON.stringify(demais),criado_em:new Date().toISOString(),
      ...(await occ62SingleFile('occSuspeitosFoto','suspeitos_foto')),...(await occ62SingleFile('occVitimasFoto','vitimas_foto')),...(await occ62SingleFile('occTestemunhasFoto','testemunhas_foto')),...(await occ62SingleFile('occMaterialFoto','material_foto'))
    };
    await occ62Api('entity_mutate',{entity:'ocorrencias_operacionais',record_key:'',operation:'UPSERT',data:d});
    if(msg)msg.textContent='Ocorrência registrada e enviada para sincronização.';occ62$('occFormCard')?.classList.add('hidden');occ62Scales=null;await occ62LoadHistory(true);
  }catch(err){if(msg)msg.textContent=err?.message||String(err);}
}
const OCC62_LABELS={id:'ID',data:'Data',hora:'Hora',tipo:'Natureza / tipo',naturezas:'Naturezas',natureza_outro:'Outra natureza',recebida_via:'Ocorrência recebida via',recebida_via_outro:'Outro meio',local:'Local',posto:'Posto',viatura_id:'Viatura',equipe:'Equipe',responsavel_id:'Responsável pelo registro',descricao:'Descrição',resultado:'Resultado',suspeitos_dados:'Dados do(s) suspeito(s)',suspeitos_sexo:'Sexo do(s) suspeito(s)',suspeitos_sexo_outro:'Descrição / outro — suspeito(s)',vitimas_dados:'Dados da(s) vítima(s)',vitimas_sexo:'Sexo da(s) vítima(s)',vitimas_sexo_outro:'Descrição / outro — vítima(s)',testemunhas_dados:'Dados da(s) testemunha(s)',uso_algemas:'Uso de algemas',justificativa_algemas:'Justificativa para uso de algemas',materiais_apreendidos:'Materiais apreendidos',composicao_equipe:'Composição da equipe',condutor_ocorrencia_id:'Condutor da ocorrência',procedimentos_adotados:'Procedimentos adotados',historico_ocorrencia:'Histórico da ocorrência',demais_arquivos:'Demais arquivos',criado_em:'Registrado em'};
const OCC62_FILE_FIELDS=new Set(['suspeitos_foto_nome','suspeitos_foto_tipo','suspeitos_foto_dados','vitimas_foto_nome','vitimas_foto_tipo','vitimas_foto_dados','testemunhas_foto_nome','testemunhas_foto_tipo','testemunhas_foto_dados','material_foto_nome','material_foto_tipo','material_foto_dados']);
function occ62ParseArray(v){if(Array.isArray(v))return v;try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[];}catch{return[];}}
async function occ62DisplayValue(k,v,refs){
  if(k==='viatura_id'){const x=(refs.viaturas||[]).find(q=>Number(q.id)===Number(v));return [x?.prefixo,x?.placa].filter(Boolean).join(' · ')||String(v);}
  if(['responsavel_id','condutor_ocorrencia_id'].includes(k))return occ62GuardaName(v,refs);
  if(k==='composicao_equipe'){const ids=[...new Set(occ62ParseArray(v).map(Number).filter(Boolean))];return ids.map(id=>occ62GuardaName(id,refs)).join(', ');}
  if(k==='naturezas'){const a=occ62ParseArray(v);return a.join(', ')||String(v||'');}
  if(k==='criado_em'){const s=String(v||'');return s?`${occ62Fmt(s)}${s.includes('T')?' '+s.slice(11,19):''}`:'';}
  return String(v??'');
}
function occ62DataSrc(tipo,dados){const d=String(dados||'');if(!d)return'';if(/^data:/i.test(d))return d;if(/^image\/(jpeg|png)$/i.test(String(tipo||'')))return `data:${tipo};base64,${d}`;if(String(tipo)==='application/pdf')return `data:application/pdf;base64,${d}`;return'';}
function occ62Attachment(nome,tipo,dados){
  const src=occ62DataSrc(tipo,dados),n=occ62Esc(nome||'Arquivo');if(!src)return nome?`<div class="occ62-attachment"><strong>${n}</strong><small>Arquivo registrado sem conteúdo binário disponível nesta réplica.</small></div>`:'';
  if(/^image\//i.test(String(tipo||'')))return `<div class="occ62-attachment"><strong>${n}</strong><img src="${src}" alt="${n}"></div>`;
  if(String(tipo)==='application/pdf')return `<div class="occ62-attachment"><strong>${n}</strong><a href="${src}" target="_blank" rel="noopener">Abrir PDF</a></div>`;
  return `<div class="occ62-attachment"><strong>${n}</strong></div>`;
}
function occ62OtherAttachments(raw){
  const txt=String(raw||'').trim();if(!txt||txt==='[]')return'';
  try{const a=JSON.parse(txt);if(Array.isArray(a))return a.map(x=>occ62Attachment(x?.nome,x?.tipo,x?.dados)).join('');}catch{}
  const urls=txt.match(/https?:\/\/[^\s,]+/g)||[];if(urls.length)return `<div class="occ62-links">${urls.map((u,i)=>`<a href="${occ62Esc(u)}" target="_blank" rel="noopener">Arquivo / link ${i+1}</a>`).join('')}</div>`;
  return `<div class="item"><small>Demais arquivos / referências</small><strong>${occ62Esc(txt)}</strong></div>`;
}
async function occ62Open(rec){
  const d=rec?.data||{},refs=await occ62GetRefs(),modal=occ62$('quadroModal'),list=occ62$('quadroModalLista');if(!modal||!list)return;
  if(occ62$('quadroModalTitulo'))occ62$('quadroModalTitulo').textContent=`Ocorrência ${d.id||rec.record_key||''}`;
  if(occ62$('quadroModalMeta'))occ62$('quadroModalMeta').textContent=`${occ62Fmt(d.data)} ${d.hora||''} · visualização completa`;
  const order=['data','hora','tipo','naturezas','natureza_outro','recebida_via','recebida_via_outro','local','posto','viatura_id','equipe','responsavel_id','suspeitos_dados','suspeitos_sexo','suspeitos_sexo_outro','vitimas_dados','vitimas_sexo','vitimas_sexo_outro','testemunhas_dados','uso_algemas','justificativa_algemas','materiais_apreendidos','composicao_equipe','condutor_ocorrencia_id','procedimentos_adotados','historico_ocorrencia','descricao','resultado','criado_em'];
  const used=new Set(),items=[];for(const k of order){if(d[k]==null||String(d[k]).trim()==='')continue;used.add(k);items.push(`<div class="item"><small>${occ62Esc(OCC62_LABELS[k]||k)}</small><strong>${occ62Esc(await occ62DisplayValue(k,d[k],refs)||'—')}</strong></div>`);}
  const skip=new Set([...used,...OCC62_FILE_FIELDS,'demais_arquivos']);for(const k of Object.keys(d)){if(skip.has(k)||d[k]==null||String(d[k]).trim()==='')continue;items.push(`<div class="item"><small>${occ62Esc(OCC62_LABELS[k]||String(k).replaceAll('_',' '))}</small><strong>${occ62Esc(await occ62DisplayValue(k,d[k],refs)||'—')}</strong></div>`);}
  const fotos=[['Documentação do(s) suspeito(s)',d.suspeitos_foto_nome,d.suspeitos_foto_tipo,d.suspeitos_foto_dados],['Documentação da(s) vítima(s)',d.vitimas_foto_nome,d.vitimas_foto_tipo,d.vitimas_foto_dados],['Documentação da(s) testemunha(s)',d.testemunhas_foto_nome,d.testemunhas_foto_tipo,d.testemunhas_foto_dados],['Material apreendido',d.material_foto_nome,d.material_foto_tipo,d.material_foto_dados]].map(([t,n,ty,da])=>da||n?`<section class="occ62-file-section"><h3>${occ62Esc(t)}</h3>${occ62Attachment(n,ty,da)}</section>`:'').join('');
  const demais=occ62OtherAttachments(d.demais_arquivos);list.innerHTML=`<div class="occ62-detail-grid">${items.join('')}</div>${fotos}${demais?`<section class="occ62-file-section"><h3>Demais arquivos</h3>${demais}</section>`:''}`;modal.classList.remove('hidden');
}
async function occ62LoadHistory(force=false){
  if(occ62HistoryBusy||!occ62$('occLista'))return;occ62HistoryBusy=true;try{if(force||!occ62Rows.length){const b=await occ62Entity('ocorrencias_operacionais',5000);occ62Rows=(b.records||[]).sort((a,z)=>String(z.data?.data||'').localeCompare(String(a.data?.data||''))||String(z.data?.hora||'').localeCompare(String(a.data?.hora||'')));}occ62RenderHistory();}catch(e){if(occ62$('occLista'))occ62$('occLista').innerHTML=`<div class="audit-error"><strong>Falha ao carregar ocorrências.</strong><br>${occ62Esc(e?.message||e)}<br>Os registros não foram tratados como inexistentes.</div>`;}finally{occ62HistoryBusy=false;}
}
async function occ62RenderHistory(){
  const host=occ62$('occLista');if(!host)return;occ62EnsureHistoryFilters();const ini=occ62$('occ62Inicio')?.value||'',fim=occ62$('occ62Fim')?.value||'',refs=await occ62GetRefs();occ62ViewRows=occ62Rows.filter(r=>{const d=occ62Iso(r.data?.data);return (!ini||d>=ini)&&(!fim||d<=fim);});
  occ62HistoryRendering=true;host.innerHTML=occ62ViewRows.map((r,i)=>{const d=r.data||{},n=occ62ParseArray(d.naturezas),cond=d.condutor_ocorrencia_id?occ62GuardaName(d.condutor_ocorrencia_id,refs):'';return `<button type="button" class="record-card record-card-button" data-occ62-open="${i}"><div class="record-card-head"><strong>${occ62Esc(n.join(', ')||d.tipo||'Ocorrência')}</strong><span>${occ62Esc(occ62Fmt(d.data))} ${occ62Esc(d.hora||'')}</span></div><div class="record-meta">${occ62Esc(d.local||'Local não informado')} · ${occ62Esc(d.recebida_via||'Via não informada')}${cond?` · Condutor: ${occ62Esc(cond)}`:''}</div><div>${occ62Esc(d.historico_ocorrencia||d.descricao||'')}</div><small class="muted">Clique/toque para ver a ocorrência completa</small></button>`;}).join('')||'<div class="empty">Nenhuma ocorrência encontrada para o período informado.</div>';occ62HistoryRendering=false;if(occ62$('occ62HistoryCount'))occ62$('occ62HistoryCount').textContent=`${occ62ViewRows.length} ocorrência(ões)`;
}
function occ62InjectStyle(){if(occ62$('occ62Style'))return;const st=document.createElement('style');st.id='occ62Style';st.textContent='.occ62-file small{display:block;margin-top:4px;color:#64748b}.occ62-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.occ62-file-section{margin-top:14px;padding-top:12px;border-top:1px solid #dbe4f0}.occ62-file-section h3{margin:0 0 8px}.occ62-attachment{display:grid;gap:8px;padding:10px;border:1px solid #dbe4f0;border-radius:10px;background:#f8fafc}.occ62-attachment img{display:block;max-width:100%;max-height:520px;object-fit:contain;border-radius:8px;background:#fff}.occ62-links{display:grid;gap:6px}.occ62-links a,.occ62-attachment a{overflow-wrap:anywhere}@media(max-width:720px){.occ62-detail-grid{grid-template-columns:1fr}}';document.head.appendChild(st);}
function occ62ScheduleEnhance(delay=700){setTimeout(async()=>{if(!occ62ViewActive())return;occ62NormalizeForm();await occ62RefreshTeam();await occ62LoadHistory(true);},delay);}
function occ62Install(){
  occ62InjectStyle();
  // Capture é deliberado: impede o saver antigo de gravar Posto/Viatura ou anexos em formato divergente.
  document.addEventListener('submit',occ62Save,true);
  document.addEventListener('click',e=>{const open=e.target.closest?.('[data-occ62-open]');if(open){e.preventDefault();e.stopPropagation();occ62Open(occ62ViewRows[Number(open.dataset.occ62Open)]);return;}if(e.target.closest?.('#occNovo')||e.target.closest?.('#mainNav [data-module="ocorrencias"]'))occ62ScheduleEnhance(800);},true);
  document.addEventListener('change',e=>{if(['occData','occHora'].includes(e.target?.id))setTimeout(()=>occ62RefreshTeam(),520);});
  const root=document.body;new MutationObserver(()=>{if(!occ62ViewActive())return;occ62NormalizeForm();const team=occ62$('occEquipe');if(team&&team.querySelector('.occ-team')&&!team.querySelector('[data-occ62-team]')&&!occ62TeamBusy)setTimeout(()=>occ62RefreshTeam(),120);const h=occ62$('occLista');if(h&&!occ62HistoryRendering&&h.children.length&&!h.querySelector('[data-occ62-open]')&&!occ62HistoryBusy)setTimeout(()=>occ62LoadHistory(false),100);}).observe(root,{childList:true,subtree:true});
  if(occ62ViewActive())occ62ScheduleEnhance(300);
}
// Este módulo é importado pelo catálogo antes do núcleo da aplicação.
// Assim o listener capture de submit é registrado antes das implementações antigas.
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',occ62Install,{once:true});else occ62Install();
