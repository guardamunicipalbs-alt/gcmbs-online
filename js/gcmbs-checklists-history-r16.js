/* Histórico institucional de check-lists — R15. Consulta somente leitura. */
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const labels=['Óleo do motor','Óleo de freio','Líquido de arrefecimento','Água do reservatório','Pneus','Sirene','Intermitente','Farol baixo','Farol alto','Luz de ré','Luz de freio','Pisca-alerta','Rádio','Ar-condicionado','Buzina','Chave de ignição','Pneu sobressalente','Chave de roda','Triângulo','Macaco','Cinto de segurança'];
const nativeLabels={pneus:'Pneus',luzes:'Luzes',sirene:'Sirene',giroflex:'Giroflex',freios:'Freios',oleo:'Óleo',agua:'Água',combustivel:'Combustível',limpeza:'Limpeza',avarias:'Avarias',equipamentos:'Equipamentos'};
function list(v){if(Array.isArray(v))return v;try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return []}}
export function iso(v){
 const s=clean(v);let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/),y,mo,d;
 if(m){[,y,mo,d]=m}else{m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/);if(!m)return '';[,d,mo,y]=m}
 if(+y<2000||+y>2099)return '';
 const z=new Date(Date.UTC(+y,+mo-1,+d));if(z.getUTCFullYear()!==+y||z.getUTCMonth()!==+mo-1||z.getUTCDate()!==+d)return '';
 return z.toISOString().slice(0,10);
}
const date=v=>v?v.split('-').reverse().join('/'):'Data não confirmada';
const clock=v=>clean(v).match(/(?:^|\s)(\d{2}:\d{2}(?::\d{2})?)/)?.[1]||'';
function vehicle(v){const a=clean(v);return a.replace(/\s*-\s*PLACA\s*:?\s*.*$/i,'').trim()||'Viatura não identificada'}
export function normalizeForms(r){
 const original=iso(r.data_checklist),sent=iso(r.enviado_em),issues=[],unverified=[];
 if(norm(r.recebida_limpa)==='NAO')issues.push('Recebida sem limpeza');
 const answers=list(r.itens);
 for(let i=0;i<labels.length;i++){
  const value=clean(answers[i]),n=norm(value);
  if(!value)continue;
  if(/INOPERANTE|SOLICITAR|RUIM|AUSENTE/.test(n))issues.push(labels[i]+': '+value);
  else if(/NAO VERIFICADO/.test(n))unverified.push(labels[i]+': '+value);
  else if(!['NORMAL','BOM','OK'].includes(n))unverified.push(labels[i]+': '+value);
 }
 const obs=clean(r.observacoes);
 return {id:'F:'+r.source_row,source:'Forms',day:original||sent,time:clock(r.enviado_em),invalidDate:!original,originalDate:clean(r.data_checklist),vehicle:vehicle(r.viatura),vehicleFull:clean(r.viatura),driver:clean(r.condutor)||'Não identificado',shift:clean(r.turno),km:clean(r.quilometragem),fuel:clean(r.abastecimento),status:issues.length?'Irregularidade registrada':obs?'Observação registrada':'Sem irregularidade marcada',issues,unverified,obs,previous:[],resolved:[]};
}
export function normalizeDesktop(r){
 const d=r.dados||{},issues=[],unverified=[];
 for(const [k,label] of Object.entries(nativeLabels)){
  const v=clean(d[k]),n=norm(v);if(/ATENCAO|NAO CONFORME|INOPERANTE/.test(n))issues.push(label+': '+v);else if(v&&!['OK','NORMAL','BOM'].includes(n))unverified.push(label+': '+v);
 }
 const previous=list(d.pendencias_anteriores).map(x=>typeof x==='object'?String(nativeLabels[x.item]||x.item||'Item')+': '+clean(x.status):clean(x)).filter(Boolean);
 const resolved=list(d.pendencias_resolvidas).map(x=>typeof x==='object'?String(nativeLabels[x.item]||x.item||'Item'):String(nativeLabels[x]||x)).filter(Boolean);
 return {id:'D:'+r.record_key,source:'Desktop/Online',day:iso(d.data),time:clock(d.hora),invalidDate:!iso(d.data),originalDate:clean(d.data),vehicle:clean(r.prefixo)||('Viatura '+clean(r.viatura_id)),vehicleFull:[r.prefixo,r.placa].filter(Boolean).join(' · ')||('Viatura '+clean(r.viatura_id)),driver:clean(r.condutor)||'Não identificado',shift:'',km:clean(d.km),fuel:clean(d.combustivel),status:clean(d.situacao)||'Situação não registrada',issues,unverified,obs:clean(d.observacao),previous,resolved};
}
export function order(rows){return rows.slice().sort((a,b)=>(b.day+' '+b.time).localeCompare(a.day+' '+a.time)||b.id.localeCompare(a.id,undefined,{numeric:true}))}
const css='#gcChecklistInstitutionalR16.gc-chk-r15{display:block!important;min-width:0}#gcChecklistInstitutionalR16 .ch-r15-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;align-items:end;margin:10px 0}#gcChecklistInstitutionalR16 .ch-r15-filter label{display:grid;gap:4px;font-size:12px;font-weight:600}#gcChecklistInstitutionalR16 .ch-r15-filter input,#gcChecklistInstitutionalR16 .ch-r15-filter select{width:100%;min-width:0}#gcChecklistInstitutionalR16 .ch-r15-summary{display:flex;gap:8px;flex-wrap:wrap;color:#44627e;font-size:12px;margin:8px 0}#gcChecklistInstitutionalR16 .ch-r15-summary span{background:#edf4fb;border:1px solid #d0dfed;border-radius:7px;padding:6px 9px}#gcChecklistInstitutionalR16 .ch-r15-scroll{max-height:clamp(300px,calc(100dvh - 345px),950px);overflow:auto;border:1px solid #d1dfed;border-radius:8px}#gcChecklistInstitutionalR16 .ch-r15-table{width:100%;min-width:780px;border-collapse:separate;border-spacing:0;font-size:12px;table-layout:fixed;height:auto!important}#gcChecklistInstitutionalR16 .ch-r15-table th{position:sticky;top:0;background:#e7eff8!important;color:#15395d!important;z-index:2;text-align:left}#gcChecklistInstitutionalR16 .ch-r15-table :is(td,th){height:auto!important;min-height:0!important;padding:8px!important;vertical-align:top!important;overflow-wrap:anywhere;white-space:normal!important;border-bottom:1px solid #dce6f0}#gcChecklistInstitutionalR16 .ch-r15-table tr:nth-child(even){background:#f6f9fd}#gcChecklistInstitutionalR16 .ch-r15-table small{display:block;color:#547089;margin-top:3px;font-size:11px}#gcChecklistInstitutionalR16 .ch-r15-table .ch-r15-issue{color:#92271c;font-weight:700}#gcChecklistInstitutionalR16 .ch-r15-table .ch-r15-note{color:#5c4b14}#gcChecklistInstitutionalR16 .ch-r15-pager{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0}#gcChecklistInstitutionalR16 .ch-r15-pager button{padding:7px 12px!important}#gcChecklistInstitutionalR16 .ch-r15-pager button:disabled{opacity:.4}#gcChecklistInstitutionalR16 .ch-r15-disclaimer{font-size:11px;color:#536d86;margin:8px 0}';
let version=0;
export function clearChecklistHistory(){version++;const el=$('gcChecklistInstitutionalR16');if(el){el.replaceChildren();el.classList.remove('gc-chk-r15')}}
export async function renderChecklistHistory(provider){
 const host=$('gcChecklistInstitutionalR16');if(!host||!provider.session)return;
 const req=++version,session=provider.session;
 const current=()=>req===version&&provider.session===session&&host.isConnected&&(!provider.isCurrent||provider.isCurrent());
 const old=host.querySelector('[data-ch-source]')?.value||'Forms';
 host.classList.add('gc-chk-r15');
 if(!$('gcChecklistR15CSS')){const style=document.createElement('style');style.id='gcChecklistR15CSS';style.textContent=css;document.head.appendChild(style)}
 host.textContent='Consultando histórico institucional…';
 let payload;try{payload=await provider.endpoint('https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-checklists-history-r15','checklists_history',{})}catch(err){if(current()){host.textContent='Não foi possível consultar o histórico: '+(err.message||'Falha de comunicação.');const retry=document.createElement('button');retry.type='button';retry.textContent='Tentar novamente';retry.onclick=()=>renderChecklistHistory(provider);host.append(document.createElement('br'),retry);}return}
 if(!current())return;
 if(!payload?.ok||!Array.isArray(payload.forms)||!Array.isArray(payload.desktop)){host.textContent='Resposta inválida do histórico.';return}
 const all=order([...payload.forms.map(normalizeForms),...payload.desktop.map(normalizeDesktop)]);
 let page=0;const pageSize=30;
 const sync=payload.ultima_sincronizacao?new Date(payload.ultima_sincronizacao):null;
 const stamp=sync&&Number.isFinite(+sync)?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza'}).format(sync):'Não confirmada';
 host.innerHTML='<div class="ch-r15-summary"><span>Google Forms: <b>'+payload.forms.length+'</b></span><span>Desktop/Online: <b>'+payload.desktop.length+'</b></span><span>Última recepção Forms: <b>'+esc(stamp)+'</b></span></div>'+
 '<div class="ch-r15-filter"><label>Origem<select data-ch-source><option value="Forms">Google Forms</option><option value="Desktop/Online">Desktop / Online</option></select></label><label>Viatura<select data-ch-vehicle><option value="">Todas</option></select></label><label>Condutor<select data-ch-driver><option value="">Todos</option></select></label><label>Data inicial<input type="date" data-ch-start></label><label>Data final<input type="date" data-ch-end></label><label>Situação<select data-ch-status><option value="">Todas</option><option value="issue">Irregularidades / pendências</option><option value="obs">Com observações</option><option value="unverified">Não verificado</option></select></label><button type="button" data-ch-refresh>Atualizar histórico</button></div>'+
 '<div class="ch-r15-disclaimer">Fontes separadas para não duplicar inspeções importadas. Pendências anteriores e resoluções são exibidas conforme registradas; uma inspeção posterior não comprova reparo. Data inválida no formulário é identificada e ordenada pela data de envio.</div><div data-ch-result></div>';
 const get=k=>host.querySelector('[data-ch-'+k+']');
 get('source').value=old;
 function options(){
  const rows=all.filter(r=>r.source===get('source').value);
  for(const key of ['vehicle','driver']){const el=get(key),prior=el.value;el.replaceChildren(new Option(key==='vehicle'?'Todas':'Todos',''));for(const val of [...new Set(rows.map(x=>x[key]))].sort((a,b)=>a.localeCompare(b,'pt-BR')))el.add(new Option(val,val));el.value=[...el.options].some(x=>x.value===prior)?prior:''}
 }
 function paint(){
  if(!current())return;
  const from=get('start').value,to=get('end').value,source=get('source').value,vid=get('vehicle').value,driver=get('driver').value,status=get('status').value;
  const target=get('result');
  if(from&&to&&to<from){target.textContent='Informe um período válido.';return}
  const rows=all.filter(r=>r.source===source&&(!vid||r.vehicle===vid)&&(!driver||r.driver===driver)&&(!from||r.day>=from)&&(!to||r.day&&r.day<=to)&&(!status||(status==='issue'&&(r.issues.length||r.previous.length||/NAO APTA|RESSALVA/.test(norm(r.status))))||(status==='obs'&&r.obs)||(status==='unverified'&&r.unverified.length)));
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages-1);
  const displayed=rows.slice(page*pageSize,(page+1)*pageSize);
  const listHtml=(label,values,cls='')=>values.length?'<div class="'+cls+'"><strong>'+esc(label)+':</strong> '+values.map(esc).join(' · ')+'</div>':'';
  target.innerHTML='<div class="ch-r15-pager"><button type="button" data-ch-prev '+(page===0?'disabled':'')+'>‹ Anterior</button><span>'+rows.length+' registro(s) · Página '+(page+1)+' de '+pages+'</span><button type="button" data-ch-next '+(page>=pages-1?'disabled':'')+'>Próxima ›</button></div>'+
  '<div class="ch-r15-scroll"><table class="ch-r15-table"><colgroup><col style="width:13%"><col style="width:17%"><col style="width:15%"><col style="width:10%"><col style="width:17%"><col style="width:28%"></colgroup><thead><tr><th>Data / hora</th><th>Viatura</th><th>Condutor / turno</th><th>KM</th><th>Situação</th><th>Irregularidades / pendências / observações</th></tr></thead><tbody>'+
  displayed.map(r=>'<tr><td><b>'+esc(date(r.day))+'</b><small>'+esc(r.time)+(r.invalidDate?'<br>Data informada: '+esc(r.originalDate||'ausente')+'<br>Ordem por envio, quando disponível':'')+'</small></td><td><b>'+esc(r.vehicleFull)+'</b><small>'+esc(r.source)+'</small></td><td>'+esc(r.driver)+'<small>'+esc(r.shift)+'</small></td><td>'+esc(r.km||'—')+'</td><td><b class="'+(r.issues.length?'ch-r15-issue':'')+'">'+esc(r.status)+'</b><small>'+esc(r.fuel)+'</small></td><td>'+listHtml('Irregularidades',r.issues,'ch-r15-issue')+listHtml('Não verificado / outras respostas',r.unverified,'ch-r15-note')+listHtml('Pendências anteriores',r.previous,'ch-r15-note')+listHtml('Resoluções informadas',r.resolved)+(r.obs?'<div>'+esc(r.obs)+'</div>':'')+(!r.issues.length&&!r.unverified.length&&!r.previous.length&&!r.resolved.length&&!r.obs?'—':'')+'</td></tr>').join('')+
  (!displayed.length?'<tr><td colspan="6">Nenhum check-list encontrado para os filtros.</td></tr>':'')+'</tbody></table></div>';
  target.querySelector('[data-ch-prev]').onclick=()=>{if(page>0){page--;paint()}};
  target.querySelector('[data-ch-next]').onclick=()=>{if(page<pages-1){page++;paint()}};
 }
 options();paint();
 for(const k of ['source','vehicle','driver','start','end','status'])get(k).addEventListener('change',()=>{page=0;if(k==='source')options();paint()});
 get('refresh').onclick=()=>renderChecklistHistory(provider);
}

// Entrada independente: não depende do renderizador legado nem de um objeto global.
const tokenNow=()=>localStorage.getItem('gcmbs.mobile.token')||'';
let activeToken='',activeProvider=null,loaded=false,scheduled=false;
function invalidate(){clearChecklistHistory();activeToken='';activeProvider=null;loaded=false;}
function activate(force=false){
 const section=document.querySelector('section[data-view="checklist"]'),app=$('appTela'),host=$('gcChecklistInstitutionalR16'),token=tokenNow();
 if(!host||!section||!app)return;
 if(token!==activeToken){invalidate();if(token){activeToken=token;const captured=token;activeProvider={session:{},isCurrent:()=>tokenNow()===captured,endpoint:async(url,action,payload)=>{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+captured,'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),cache:'no-store'});let body={};try{body=await response.json()}catch{}if(!response.ok)throw Error(response.status===401?'Sessão expirada. Entre novamente.':response.status===403?'Sem permissão de consulta.':'HTTP '+response.status);return body;}}}}
 if(!token||app.classList.contains('hidden')){if(loaded)invalidate();return;}
 if(section.classList.contains('hidden'))return;
 if(!activeProvider||loaded&&!force)return;
 loaded=true;renderChecklistHistory(activeProvider).catch(err=>{if(activeProvider?.isCurrent())host.textContent='Falha na apresentação do histórico. '+(err.message||'')});
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;activate()})}
function boot(){
 const app=$('appTela'),section=document.querySelector('section[data-view="checklist"]');
 for(const el of [app,section])if(el)new MutationObserver(schedule).observe(el,{attributes:true,attributeFilter:['class','style']});
 window.addEventListener('storage',e=>{if(e.key==='gcmbs.mobile.token'||e.key===null){invalidate();schedule()}});
 window.addEventListener('pageshow',schedule);
 window.addEventListener('gcmbs:checklist-history-refresh',()=>activate(true));
 document.addEventListener('click',schedule,true);
 activate();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
