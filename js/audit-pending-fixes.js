// GCMBS 10.0.62 — correcoes acumuladas da auditoria funcional Online/Android.
// Este modulo atua somente na camada de interface/fluxos Online e nao altera o Gerador de Escala.
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const APP_VERSION='10.0.62';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoDate=v=>String(v||'').slice(0,10);
const fmt=v=>{const s=isoDate(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s||'—';};
const nativeAndroid=()=>Boolean(window.Capacitor?.isNativePlatform?.()||window.Capacitor?.getPlatform?.()==='android');
let refsCache=null,sessionCache=null;

async function api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
async function refs(force=false){
  if(refsCache&&!force)return refsCache;
  try{refsCache=await api('references');return refsCache;}catch{}
  const out={viaturas:[],guardas:[],postos:[],equipes:[]};
  for(const [entity,key] of [['viaturas','viaturas'],['guardas','guardas'],['postos','postos'],['equipes','equipes']]){
    try{const b=await api('entity_list',{entity,limit:5000,offset:0});out[key]=(b.records||[]).map(x=>x.data||{});}catch{}
  }
  refsCache=out;return out;
}
async function session(){
  if(sessionCache)return sessionCache;
  try{sessionCache=(await api('session')).session||null;}catch{sessionCache=null;}
  return sessionCache;
}
async function entityList(entity,limit=5000){return api('entity_list',{entity,limit,offset:0});}
async function entityMutate(entity,data,record_key=''){return api('entity_mutate',{entity,record_key,operation:'UPSERT',data});}

function injectStyles(){
  if($('gcmbsAuditFixStyles'))return;
  const st=document.createElement('style');st.id='gcmbsAuditFixStyles';st.textContent=`
    #onlineEditor{width:min(960px,calc(100vw - 24px));max-width:min(960px,calc(100vw - 24px));overflow-x:hidden;}
    #onlineEditor .module-editor-card,#onlineEditor .module-editor-fields,#onlineEditor .module-editor-section{min-width:0;max-width:100%;box-sizing:border-box;}
    #onlineEditor .form-grid{min-width:0;grid-template-columns:repeat(2,minmax(0,1fr));}
    #onlineEditor input,#onlineEditor select,#onlineEditor textarea{max-width:100%;min-width:0;box-sizing:border-box;}
    .audit-loading{padding:28px;text-align:center;color:#52627a;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;}
    .audit-error{padding:18px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;color:#991b1b;}
    .audit-file-row{display:grid;gap:6px;margin-top:8px;}
    .audit-occ-file{display:grid;gap:6px;border:1px solid #dbe4f0;border-radius:10px;padding:10px;background:#f8fafc;}
    #chkSituacao[disabled]{opacity:1;color:#0f172a;background:#eef2f7;cursor:not-allowed;}
    @media(max-width:720px){#onlineEditor .form-grid{grid-template-columns:1fr;}#onlineEditor{width:calc(100vw - 12px);max-width:calc(100vw - 12px);}}
  `;document.head.appendChild(st);
}

// UI-01 — identificacao correta da plataforma.
function fixPlatformIdentity(){
  const native=nativeAndroid();
  document.querySelectorAll('.module-kicker').forEach(x=>{if(/GCMBS ONLINE \/ ANDROID/i.test(x.textContent||''))x.textContent=native?'GCMBS ANDROID':'GCMBS ONLINE';});
  const ver=$('onlineVersao');if(ver)ver.textContent=`${native?'Android':'Online'} ${APP_VERSION}`;
}

// SYNC-01 — uma falha momentanea na consulta nao apaga a ultima sincronizacao confirmada.
const LAST_SYNC_KEY='gcmbs.audit.last_sync_text';
let syncGuard=false;
function fixSyncBadge(){
  const e=$('syncStatus');if(!e||syncGuard)return;
  const txt=String(e.textContent||'').trim();
  if(/^Última sincronização/i.test(txt)){sessionStorage.setItem(LAST_SYNC_KEY,txt);return;}
  if(/Sincronização:\s*indisponível/i.test(txt)){
    const last=sessionStorage.getItem(LAST_SYNC_KEY);if(!last)return;
    syncGuard=true;e.textContent=`${last} · atualização do status temporariamente indisponível`;e.style.color='#fde68a';e.title='A última sincronização confirmada foi preservada; apenas a consulta momentânea do status falhou.';queueMicrotask(()=>syncGuard=false);
  }
}

// Autofill indevido em campos de busca.
const touchedSearch=new WeakSet();
function protectSearch(input){
  if(!input||input.dataset.auditSearchProtected)return;input.dataset.auditSearchProtected='1';
  input.setAttribute('autocomplete','off');input.setAttribute('data-lpignore','true');input.setAttribute('data-1p-ignore','true');input.setAttribute('name','gcmbs_search_'+Math.random().toString(36).slice(2));
  input.addEventListener('input',e=>{if(e.isTrusted)touchedSearch.add(input);});
  const clearAuto=()=>{if(touchedSearch.has(input))return;const v=String(input.value||'').replace(/\D/g,'');if(/^\d{11}$/.test(v))input.value='';};
  for(const ms of [0,80,300,900])setTimeout(clearAuto,ms);
}
function fixSearchAutofill(){document.querySelectorAll('#onlineFiltro,.module-search input,input[type="search"]').forEach(protectSearch);}

// UI-02 — booleanos legiveis na listagem generica.
const BOOL_LABELS=new Set(['autorizado viatura','autorizado motocicleta','disponível escala','disponivel escala','pode noite','pode 24h','ativo','ativa','participa do gerador','funcionamento 24h','consertado','exige motorista']);
function normalizeBooleans(){
  document.querySelectorAll('.online-kv b').forEach(b=>{const label=String(b.textContent||'').trim().toLowerCase(),v=b.nextElementSibling;if(!v||!BOOL_LABELS.has(label))return;const raw=String(v.textContent||'').trim().toUpperCase();if(['1','SIM','TRUE'].includes(raw))v.textContent='Sim';else if(['0','NÃO','NAO','FALSE'].includes(raw))v.textContent='Não';});
}

// RF-01 — nao chamar de disponivel aquilo que apenas esta operacionalmente ativo.
function fixFleetReportLabel(){
  const n=$('rfAtivas');if(!n)return;const card=n.closest('.dashboard-card');const span=card?.querySelector('span'),small=card?.querySelector('small');if(span)span.textContent='Ativas operacionais';if(small)small.textContent='Ativas fora de manutenção/baixa';
}

// NAV-01 / RF-02 — limpa conteudo anterior e tenta novamente uma vez em falha transitoria.
const GENERIC_MODULES=new Set(['cadastro_guardas','equipes','postos','tipos_escalas','escala_extra_manual','feriados','eventos_extra','folha_pagamento','viaturas','manutencao_viaturas','abastecimento_viaturas','cautelas','cursos','operacoes_especiais','frequencia','controle_acesso','imagens_gcm']);
const PRIMARY={cadastro_guardas:'guardas',equipes:'equipes',postos:'postos',tipos_escalas:'tipos_escalas',escala_extra_manual:'escalas_extras_manuais',feriados:'feriados',eventos_extra:'eventos_extras',folha_pagamento:'folha_pagamento_config',viaturas:'viaturas',manutencao_viaturas:'manutencao_viaturas',abastecimento_viaturas:'abastecimento_viaturas',cautelas:'equipamentos_cautelas',cursos:'cursos_habilitacoes',operacoes_especiais:'oficios',frequencia:'frequencia_registros',controle_acesso:'permissoes_usuarios',imagens_gcm:'imagens_gcm'};
const EXPECTED={cadastro_guardas:'Cadastro de Guardas',equipes:'Equipes',postos:'Postos Operacionais',tipos_escalas:'Tipos de Escalas',escala_extra_manual:'Escala Extra Manual',feriados:'Feriados',eventos_extra:'Serviço Extra por Evento',folha_pagamento:'Folha de Pagamento',viaturas:'Cadastro de Viaturas',manutencao_viaturas:'Manutenção de Viaturas',abastecimento_viaturas:'Abastecimento',cautelas:'Equipamentos e Cautelas',cursos:'Cursos e Habilitações',operacoes_especiais:'Ofícios',frequencia:'Frequência',controle_acesso:'Controle de Acesso',imagens_gcm:'Imagens da GCM'};
const retrying=new Set();
function clearStaleGeneric(modulo){
  if(!GENERIC_MODULES.has(modulo))return;const ent=$('onlineEntidades'),records=$('onlineRegistrosCard');if(ent)ent.innerHTML='<div class="audit-loading">Carregando módulo...</div>';records?.classList.add('hidden');const f=$('onlineFiltro');if(f&&!touchedSearch.has(f))f.value='';
}
async function recoverGeneric(modulo,button){
  if(!GENERIC_MODULES.has(modulo))return;await new Promise(r=>setTimeout(r,700));
  const expected=EXPECTED[modulo]||'',title=String($('onlineTitulo')?.textContent||'').trim(),entText=String($('onlineEntidades')?.textContent||'');
  const stale=(expected&&title&&title!==expected&&!$('onlineRegistrosCard')?.classList.contains('hidden'))||/Nenhum conjunto de dados online autorizado|Falha temporária/i.test(entText)||/Carregando módulo/i.test(entText);
  if(!stale||retrying.has(modulo))return;
  retrying.add(modulo);
  try{
    const entity=PRIMARY[modulo];if(entity)await entityList(entity,5);
    button?.click();await new Promise(r=>setTimeout(r,900));
    const text2=String($('onlineEntidades')?.textContent||'');
    if(/Nenhum conjunto de dados online autorizado|Falha temporária|Carregando módulo/i.test(text2)){
      const ent=$('onlineEntidades');if(ent)ent.innerHTML='<div class="audit-error"><strong>Não foi possível carregar os dados deste módulo.</strong><br>Os registros não foram tratados como inexistentes nem como falta de permissão. Atualize o módulo para tentar novamente.</div>';
    }
  }catch(e){const ent=$('onlineEntidades');if(ent)ent.innerHTML=`<div class="audit-error"><strong>Não foi possível carregar os dados deste módulo.</strong><br>${esc(e.message||e)}</div>`;}
  finally{setTimeout(()=>retrying.delete(modulo),1500);}
}
function installNavigationFix(){
  document.addEventListener('click',e=>{const b=e.target.closest?.('#mainNav [data-module]');if(!b)return;const modulo=b.dataset.module;if(!GENERIC_MODULES.has(modulo))return;clearStaleGeneric(modulo);recoverGeneric(modulo,b);},true);
}

// Check-list: refs com fallback, historico identificado e situacao automatica.
let checklistBusy=false;
function calcChecklistSituation(){
  const sel=[...document.querySelectorAll('#chkItens select')];if(!sel.length)return;const vals=sel.map(x=>String(x.value||'OK').toUpperCase());let s='APTA';if(vals.includes('NÃO CONFORME'))s='NÃO APTA';else if(vals.includes('ATENÇÃO'))s='APTA COM RESSALVA';const box=$('chkSituacao');if(box){box.value=s;box.disabled=true;box.title='Situação calculada automaticamente pelos itens da inspeção.';}
}
async function loadChecklistHistory(){
  if(checklistBusy)return;checklistBusy=true;try{
    const [b,r]=await Promise.all([entityList('checklist_viaturas',500),refs()]);const vs=new Map((r.viaturas||[]).map(v=>[Number(v.id),v])),gs=new Map((r.guardas||[]).map(g=>[Number(g.id),g]));
    const lista=(b.records||[]).sort((a,z)=>String(z.data?.data||'').localeCompare(String(a.data?.data||''))||String(z.data?.hora||'').localeCompare(String(a.data?.hora||''))).slice(0,40);const host=$('chkLista');if(!host)return;
    const items=[['pneus','Pneus'],['luzes','Luzes'],['sirene','Sirene'],['giroflex','Giroflex'],['freios','Freios'],['oleo','Óleo'],['agua','Água'],['combustivel','Combustível'],['limpeza','Limpeza'],['avarias','Avarias'],['equipamentos','Equipamentos']];
    host.innerHTML=lista.map(rec=>{const d=rec.data||{},v=vs.get(Number(d.viatura_id))||{},g=gs.get(Number(d.guarda_id))||{},nome=[v.prefixo,v.placa].filter(Boolean).join(' · ')||`Viatura #${d.viatura_id||'—'}`,gn=g.nome_guerra||g.nome_completo||'GCM não identificado',probs=items.filter(([k])=>['ATENÇÃO','NÃO CONFORME'].includes(String(d[k]||'').toUpperCase()));return `<article class="record-card"><div class="record-card-head"><strong>${esc(nome)}</strong><span class="status-pill ${probs.length?'warn':'ok'}">${esc(d.situacao||'APTA')}</span></div><div class="record-meta">${esc(fmt(d.data))} ${esc(d.hora||'')} · KM ${esc(d.km??'—')} · Responsável: ${esc(gn)}</div>${probs.length?`<div class="record-warning">${probs.map(([k,l])=>`${l}: ${esc(d[k])}`).join(' · ')}</div>`:'<div class="record-ok">Sem problemas apontados.</div>'}</article>`;}).join('')||'<div class="empty">Nenhum check-list registrado.</div>';
  }catch(e){if($('chkLista'))$('chkLista').innerHTML=`<div class="audit-error">Não foi possível carregar o histórico do check-list: ${esc(e.message||e)}</div>`;}finally{checklistBusy=false;}
}
async function enhanceChecklist(){
  const select=$('chkViatura');if(!select)return;const r=await refs();const vs=r.viaturas||[];
  if(vs.length&&select.options.length<=1)select.innerHTML='<option value="">Selecione...</option>'+vs.map(v=>`<option value="${esc(v.id)}">${esc([v.prefixo,v.placa,v.modelo].filter(Boolean).join(' · '))}</option>`).join('');
  calcChecklistSituation();await loadChecklistHistory();
}
function installChecklistFix(){
  document.addEventListener('change',e=>{if(e.target.closest?.('#chkItens'))calcChecklistSituation();});
  document.addEventListener('click',e=>{if(e.target.closest?.('#chkNovo')||e.target.closest?.('#mainNav [data-module="checklist_viaturas"]'))setTimeout(()=>enhanceChecklist(),350);},true);
}

// Relacao de GCM/viatura/escala usada pela Ocorrencia.
let occBusy=false,occScaleCache=null,occRefsCache=null;
async function occRefs(){return occRefsCache||(occRefsCache=await refs());}
async function occScales(){if(occScaleCache)return occScaleCache;const b=await entityList('escalas',5000);return occScaleCache=(b.records||[]).map(x=>x.data||{});}
function activeScale(d){return !['CANCELADA','EXCLUIDA','INATIVA','SIMULADA'].includes(String(d.status||'ATIVA').toUpperCase());}
function occTurn(){const h=Number(String($('occHora')?.value||'12:00').slice(0,2));return h>=19||h<7?'B':'A';}
function ensureOccurrenceFields(){
  const local=$('occLocal');if(!local)return;
  if(!$('occPosto')){const wrap=document.createElement('label');wrap.innerHTML='Posto<select id="occPosto"><option value="">Selecione...</option></select>';local.closest('label')?.insertAdjacentElement('afterend',wrap);}
  if(!$('occViatura')){const wrap=document.createElement('label');wrap.innerHTML='Viatura<select id="occViatura"><option value="">Selecione...</option></select>';$('occPosto')?.closest('label')?.insertAdjacentElement('afterend',wrap);}
  const addFile=(afterId,id,label)=>{if($(id))return;const after=$(afterId)?.closest('label');if(!after)return;const x=document.createElement('label');x.className='full audit-occ-file';x.innerHTML=`${esc(label)}<input id="${id}" type="file" accept="image/*">`;after.insertAdjacentElement('afterend',x);};
  addFile('occSuspeitos','occSuspeitosFoto','Foto do(s) suspeito(s)');addFile('occVitimas','occVitimasFoto','Foto da(s) vítima(s)');addFile('occTestemunhas','occTestemunhasFoto','Foto da(s) testemunha(s)');addFile('occMateriais','occMaterialFoto','Foto do material apreendido');
  if(!$('occDemaisArquivos')){const after=$('occHistorico')?.closest('label');if(after){const x=document.createElement('label');x.className='full';x.innerHTML='Demais arquivos / links<textarea id="occDemaisArquivos" placeholder="Links ou referências de arquivos já existentes"></textarea>';after.insertAdjacentElement('afterend',x);}}
}
async function populateOccurrenceRefs(){
  ensureOccurrenceFields();const r=await occRefs();const po=$('occPosto'),vi=$('occViatura');if(po){const cur=po.value;po.innerHTML='<option value="">Selecione...</option>'+(r.postos||[]).map(x=>`<option value="${esc(x.nome||'')}">${esc([x.nome,x.tipo].filter(Boolean).join(' · '))}</option>`).join('');if([...po.options].some(o=>o.value===cur))po.value=cur;}if(vi){const cur=vi.value;vi.innerHTML='<option value="">Selecione...</option>'+(r.viaturas||[]).map(x=>`<option value="${esc(x.id)}">${esc([x.prefixo,x.placa,x.modelo].filter(Boolean).join(' · '))}</option>`).join('');if([...vi.options].some(o=>o.value===cur))vi.value=cur;}
}
async function refreshOccurrenceTeam(){
  if(!$('occEquipe'))return;ensureOccurrenceFields();const [r,sc,s]=await Promise.all([occRefs(),occScales(),session()]);const data=$('occData')?.value,turno=occTurn();if(!data)return;
  const valid=sc.filter(d=>activeScale(d)&&isoDate(d.data)===data&&(String(d.turno||'').toUpperCase()===turno||String(d.turno||'').toUpperCase()==='COMPLETO'||Number(d.jornada_24h||0)===1));const ids=new Set(valid.map(d=>Number(d.guarda_id)).filter(Boolean));
  $('occEquipe').innerHTML=(r.guardas||[]).map(g=>`<label class="${ids.has(Number(g.id))?'suggested':''}"><input type="checkbox" class="occ-team" value="${esc(g.id)}" ${ids.has(Number(g.id))?'checked':''}> ${esc(g.nome_guerra||g.nome_completo||'GCM')}</label>`).join('');
  const cond=$('occCondutor');if(cond){cond.innerHTML='<option value="">Selecione...</option>'+(r.guardas||[]).filter(g=>ids.has(Number(g.id))).map(g=>`<option value="${esc(g.id)}">${esc(g.nome_guerra||g.nome_completo||'GCM')}</option>`).join('');}
  const own=valid.find(d=>Number(d.guarda_id)===Number(s?.guarda_id));if(own){const posto=String(own.posto_nome||own.hist_posto_nome||own.posto||'');if(posto&&$('occPosto'))$('occPosto').value=posto;const vname=String(own.viatura||'').toUpperCase();const v=(r.viaturas||[]).find(x=>[x.prefixo,x.placa].some(n=>String(n||'').toUpperCase()===vname));if(v&&$('occViatura'))$('occViatura').value=String(v.id);}
  document.querySelectorAll('.occ-team').forEach(ch=>ch.addEventListener('change',()=>{const checked=new Set([...document.querySelectorAll('.occ-team:checked')].map(x=>Number(x.value)));if(cond){const cur=cond.value;cond.innerHTML='<option value="">Selecione...</option>'+(r.guardas||[]).filter(g=>checked.has(Number(g.id))).map(g=>`<option value="${esc(g.id)}">${esc(g.nome_guerra||g.nome_completo||'GCM')}</option>`).join('');if([...cond.options].some(o=>o.value===cur))cond.value=cur;}}));
}
async function filePayload(id,prefix){const f=$(id)?.files?.[0];if(!f)return{};const b64=await new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res(String(rd.result||'').split(',')[1]||'');rd.onerror=()=>rej(new Error(`Não foi possível ler ${f.name}.`));rd.readAsDataURL(f);});return{[`${prefix}_nome`]:f.name,[`${prefix}_tipo`]:f.type,[`${prefix}_dados`]:b64};}
const OCC_LABELS={data:'Data',hora:'Hora',tipo:'Tipo',posto:'Posto',viatura_id:'Viatura',equipe:'Equipe',responsavel_id:'Responsável',local:'Local',descricao:'Descrição',naturezas:'Naturezas',natureza_outro:'Outra natureza',recebida_via:'Recebida via',recebida_via_outro:'Outro meio',suspeitos_dados:'Suspeitos',vitimas_dados:'Vítimas',testemunhas_dados:'Testemunhas',uso_algemas:'Uso de algemas',justificativa_algemas:'Justificativa das algemas',materiais_apreendidos:'Materiais apreendidos',composicao_equipe:'Composição da equipe',condutor_ocorrencia_id:'Condutor da ocorrência',procedimentos_adotados:'Procedimentos adotados',historico_ocorrencia:'Histórico da ocorrência',demais_arquivos:'Demais arquivos'};
async function occurrenceDisplayValue(k,v){if(k==='viatura_id'){const r=await occRefs();const x=(r.viaturas||[]).find(q=>Number(q.id)===Number(v));return [x?.prefixo,x?.placa].filter(Boolean).join(' · ')||String(v);}if(['responsavel_id','condutor_ocorrencia_id'].includes(k)){const r=await occRefs();const x=(r.guardas||[]).find(q=>Number(q.id)===Number(v));return x?.nome_guerra||x?.nome_completo||String(v);}if(k==='composicao_equipe'){let a=[];try{a=JSON.parse(v||'[]')}catch{}const r=await occRefs();return Array.isArray(a)?a.map(id=>{const x=(r.guardas||[]).find(q=>Number(q.id)===Number(id));return x?.nome_guerra||x?.nome_completo||id;}).join(', '):String(v);}if(k==='naturezas'){try{const a=JSON.parse(v||'[]');if(Array.isArray(a))return a.join(', ');}catch{}}if(/_dados$/.test(k)&&String(v||'').length>300)return '[arquivo/foto preservado]';return String(v??'');}
async function openOccurrence(rec){const d=rec.data||{},keys=Object.keys(d).filter(k=>d[k]!=null&&String(d[k]).trim()!=='');const values=await Promise.all(keys.map(async k=>[k,await occurrenceDisplayValue(k,d[k])]));const title=$('quadroModalTitulo'),meta=$('quadroModalMeta'),list=$('quadroModalLista'),modal=$('quadroModal');if(!modal||!list)return;if(title)title.textContent=`Ocorrência ${d.id||rec.record_key||''}`;if(meta)meta.textContent=`${fmt(d.data)} ${d.hora||''} · ${keys.length} campo(s) registrado(s)`;list.innerHTML=values.map(([k,v])=>`<div class="item"><small>${esc(OCC_LABELS[k]||String(k).replaceAll('_',' '))}</small><strong>${esc(v||'—')}</strong></div>`).join('');modal.classList.remove('hidden');}
async function loadOccurrenceHistory(){
  if(occBusy||!$('occLista'))return;occBusy=true;try{const b=await entityList('ocorrencias_operacionais',500);const rows=(b.records||[]).sort((a,z)=>String(z.data?.data||'').localeCompare(String(a.data?.data||''))||String(z.data?.hora||'').localeCompare(String(a.data?.hora||'')));const host=$('occLista');host.innerHTML=rows.slice(0,100).map((r,i)=>{const d=r.data||{};let n=[];try{n=JSON.parse(d.naturezas||'[]')}catch{}return `<button type="button" class="record-card record-card-button" data-audit-occ="${i}"><div class="record-card-head"><strong>${esc((Array.isArray(n)&&n.join(', '))||d.tipo||'Ocorrência')}</strong><span>${esc(fmt(d.data))} ${esc(d.hora||'')}</span></div><div class="record-meta">${esc(d.local||'Local não informado')} · ${esc(d.recebida_via||'Via não informada')}</div><div>${esc(d.historico_ocorrencia||d.descricao||'')}</div><small class="muted">Clique/toque para ver a ocorrência completa</small></button>`;}).join('')||'<div class="empty">Nenhuma ocorrência registrada.</div>';host.querySelectorAll('[data-audit-occ]').forEach(but=>but.addEventListener('click',()=>openOccurrence(rows[Number(but.dataset.auditOcc)])));}catch(e){$('occLista').innerHTML=`<div class="audit-error"><strong>Falha ao carregar ocorrências.</strong><br>${esc(e.message||e)}<br>Os registros não foram considerados inexistentes.</div>`;}finally{occBusy=false;}
}
async function saveOccurrence(e){
  if(e.target?.id!=='occForm')return;e.preventDefault();e.stopImmediatePropagation();
  const msg=$('occMsg');if(msg)msg.textContent='Salvando ocorrência...';try{
    const s=await session(),naturezas=[...document.querySelectorAll('.occ-nat:checked')].map(x=>x.value),comp=[...document.querySelectorAll('.occ-team:checked')].map(x=>Number(x.value)).filter(Boolean),cond=Number($('occCondutor')?.value||0);
    if(!naturezas.length&&!String($('occNaturezaOutro')?.value||'').trim())throw new Error('Informe ao menos uma natureza da ocorrência.');if(!comp.length)throw new Error('Selecione os membros da equipe.');if(!cond||!comp.includes(cond))throw new Error('O condutor deve fazer parte da equipe.');if($('occAlgemas')?.value==='SIM'&&!String($('occJustAlgemas')?.value||'').trim())throw new Error('Justifique o uso de algemas.');
    const d={data:$('occData').value,hora:$('occHora').value,tipo:naturezas.join(', ')||String($('occNaturezaOutro')?.value||'').trim()||'OUTRO',naturezas:JSON.stringify(naturezas),natureza_outro:String($('occNaturezaOutro')?.value||'').trim(),recebida_via:$('occVia')?.value||'',recebida_via_outro:String($('occViaOutro')?.value||'').trim(),local:String($('occLocal')?.value||'').trim(),posto:$('occPosto')?.value||'',viatura_id:$('occViatura')?.value?Number($('occViatura').value):null,suspeitos_dados:String($('occSuspeitos')?.value||'').trim(),suspeitos_sexo:$('occSuspeitosSexo')?.value||'',suspeitos_sexo_outro:String($('occSuspeitosSexoOutro')?.value||'').trim(),vitimas_dados:String($('occVitimas')?.value||'').trim(),vitimas_sexo:$('occVitimasSexo')?.value||'',vitimas_sexo_outro:String($('occVitimasSexoOutro')?.value||'').trim(),testemunhas_dados:String($('occTestemunhas')?.value||'').trim(),uso_algemas:$('occAlgemas')?.value||'NÃO',justificativa_algemas:String($('occJustAlgemas')?.value||'').trim(),materiais_apreendidos:String($('occMateriais')?.value||'').trim(),composicao_equipe:JSON.stringify(comp),condutor_ocorrencia_id:cond,responsavel_id:Number(s?.guarda_id||0),procedimentos_adotados:String($('occProcedimentos')?.value||'').trim(),historico_ocorrencia:String($('occHistorico')?.value||'').trim(),demais_arquivos:String($('occDemaisArquivos')?.value||'').trim(),criado_em:new Date().toISOString(),...(await filePayload('occSuspeitosFoto','suspeitos_foto')),...(await filePayload('occVitimasFoto','vitimas_foto')),...(await filePayload('occTestemunhasFoto','testemunhas_foto')),...(await filePayload('occMaterialFoto','material_foto'))};
    await entityMutate('ocorrencias_operacionais',d);if(msg)msg.textContent='Ocorrência registrada e enviada para sincronização.';$('occFormCard')?.classList.add('hidden');await loadOccurrenceHistory();
  }catch(err){if(msg)msg.textContent=err.message||String(err);}
}
function installOccurrenceFix(){
  document.addEventListener('submit',saveOccurrence,true);
  document.addEventListener('click',e=>{if(e.target.closest?.('#occNovo')||e.target.closest?.('#mainNav [data-module="ocorrencias"]'))setTimeout(async()=>{await populateOccurrenceRefs();await refreshOccurrenceTeam();await loadOccurrenceHistory();},450);},true);
  document.addEventListener('change',e=>{if(['occData','occHora'].includes(e.target?.id))setTimeout(()=>refreshOccurrenceTeam(),300);});
}

// Editor generico: titulos corretos, arquivos existentes e validacoes de Cautelas.
function currentOnlineTitle(){return String($('onlineTitulo')?.textContent||'').trim();}
function removeTechnicalFileInputs(){for(const n of ['arquivo_nome','arquivo_tipo','arquivo_dados'])document.querySelector(`[data-online-field="${n}"]`)?.closest('label')?.remove();}
function setHiddenField(name,value){let x=document.querySelector(`[data-audit-hidden="${name}"]`);if(!x){x=document.createElement('input');x.type='hidden';x.dataset.onlineField=name;x.dataset.auditHidden=name;$('onlineCampos')?.appendChild(x);}x.value=value??'';}
function injectGenericFile(kind){
  const campos=$('onlineCampos');if(!campos)return;removeTechnicalFileInputs();if($('auditGenericFile'))return;const label=document.createElement('label');label.className='full audit-file-row';label.innerHTML=`${kind==='oficio'?'Arquivo do ofício (JPG, PNG ou PDF)':'Comprovante do curso / habilitação'}<input id="auditGenericFile" type="file" ${kind==='oficio'?'accept="image/jpeg,image/png,application/pdf"':'accept="image/*,application/pdf"'}><small>${kind==='oficio'?'Máximo 15 MB. Deixe vazio para preservar o arquivo já existente.':'Deixe vazio para preservar o comprovante já existente.'}</small>`;campos.appendChild(label);$('auditGenericFile').addEventListener('change',async()=>{const f=$('auditGenericFile')?.files?.[0];if(!f)return;if(kind==='oficio'&&f.size>15*1024*1024){$('auditGenericFile').value='';return alert('O arquivo do ofício deve ter no máximo 15 MB.');}const b64=await new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>res(String(rd.result||'').split(',')[1]||'');rd.onerror=()=>rej(new Error('Não foi possível ler o arquivo.'));rd.readAsDataURL(f);});setHiddenField('arquivo_nome',f.name);setHiddenField('arquivo_tipo',f.type);setHiddenField('arquivo_dados',b64);});
}
function replaceCautionStatus(){const old=document.querySelector('[data-online-field="situacao"]');if(!old||old.tagName==='SELECT')return;const cur=String(old.value||'CAUTELADO').toUpperCase(),s=document.createElement('select');s.dataset.onlineField='situacao';const vals=[...new Set(['CAUTELADO','DEVOLVIDO',...(cur&&!['CAUTELADO','DEVOLVIDO'].includes(cur)?[cur]:[])])];s.innerHTML=vals.map(v=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(v)}</option>`).join('');old.replaceWith(s);}
function configureCautionResponsibility(){const mod=document.querySelector('[data-online-field="modalidade_uso"]'),g=document.querySelector('[data-online-field="guarda_id"]'),v=document.querySelector('[data-online-field="viatura_id"]');if(!mod)return;const apply=()=>{const m=String(mod.value||'INDIVIDUAL').toUpperCase();if(g){g.disabled=m==='VIATURA';g.required=m==='INDIVIDUAL';if(g.disabled)g.value='';}if(v){v.disabled=m==='INDIVIDUAL';v.required=m==='VIATURA';if(v.disabled)v.value='';}};mod.onchange=apply;apply();}
function enhanceGenericEditor(){
  const dlg=$('onlineEditor');if(!dlg?.open)return;const t=currentOnlineTitle(),title=$('onlineEditorTitulo');
  if(t==='Equipamentos e Cautelas'){if(title)title.textContent=/^Editar/i.test(title.textContent||'')?'Editar Cautela':'Nova Cautela';replaceCautionStatus();configureCautionResponsibility();}
  if(t==='Cursos e Habilitações'){if(title)title.textContent=/^Editar/i.test(title.textContent||'')?'Editar Curso / Habilitação':'Novo Curso / Habilitação';injectGenericFile('curso');}
  if(t==='Ofícios'){if(title)title.textContent=/^Editar/i.test(title.textContent||'')?'Editar Ofício':'Novo Ofício';injectGenericFile('oficio');}
}
function validateGenericSave(e){if(!e.target.closest?.('#onlineSalvar')||currentOnlineTitle()!=='Equipamentos e Cautelas')return;const m=String(document.querySelector('[data-online-field="modalidade_uso"]')?.value||'INDIVIDUAL').toUpperCase(),g=document.querySelector('[data-online-field="guarda_id"]')?.value,v=document.querySelector('[data-online-field="viatura_id"]')?.value;if(m==='INDIVIDUAL'&&!g){e.preventDefault();e.stopImmediatePropagation();alert('Na cautela individual, selecione o GCM responsável.');}else if(m==='VIATURA'&&!v){e.preventDefault();e.stopImmediatePropagation();alert('Na cautela vinculada à viatura, selecione a viatura responsável.');}}
function installGenericEditorFix(){document.addEventListener('click',validateGenericSave,true);}

function runVisualFixes(){injectStyles();fixPlatformIdentity();fixSyncBadge();fixSearchAutofill();normalizeBooleans();fixFleetReportLabel();enhanceGenericEditor();}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;runVisualFixes();});}
function boot(){
  injectStyles();installNavigationFix();installChecklistFix();installOccurrenceFix();installGenericEditorFix();runVisualFixes();
  const root=$('appTela')||document.body;new MutationObserver(schedule).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
  const sync=$('syncStatus');if(sync)new MutationObserver(fixSyncBadge).observe(sync,{childList:true,characterData:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
