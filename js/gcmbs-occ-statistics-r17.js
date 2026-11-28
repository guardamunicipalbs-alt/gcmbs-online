/* Estatísticas de ocorrências R17 — consulta agregada e autenticada. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const br=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const year=()=>new Intl.DateTimeFormat('pt-BR',{year:'numeric',timeZone:'America/Fortaleza'}).format(new Date());
const n=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR'):'—';
const month=v=>{const d=new Date(v+'-01T12:00:00Z');return Number.isFinite(+d)?new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(d):v};
const css='#occStatsR17{min-width:0}#occStatsR17[hidden]{display:none!important}#occStatsR17 .os-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}#occStatsR17 .os-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;align-items:end;margin:12px 0}#occStatsR17 .os-filters label{display:grid;gap:4px;font-size:12px;font-weight:650}#occStatsR17 .os-filters :is(input,select){width:100%;min-width:0}#occStatsR17 .os-actions{display:flex;gap:6px;flex-wrap:wrap}#occStatsR17 .os-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:8px;margin:10px 0}#occStatsR17 .os-kpi{background:#edf4fb;border:1px solid #cdddec;border-radius:10px;padding:12px}#occStatsR17 .os-kpi strong{display:block;font-size:26px;color:#165cae}#occStatsR17 .os-kpi small{display:block;color:#536d86;font-size:11px}#occStatsR17 .os-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px}#occStatsR17 .os-chart{border:1px solid #d5e1ed;border-radius:10px;padding:12px;min-width:0}#occStatsR17 .os-chart h3{font-size:14px;margin:0 0 10px;color:#153b62}#occStatsR17 .os-bar{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(50px,1fr) 32px;gap:6px;align-items:center;font-size:11px;margin:6px 0}#occStatsR17 .os-bar span{overflow-wrap:anywhere}#occStatsR17 .os-track{height:9px;border-radius:8px;background:#e4edf6;overflow:hidden}#occStatsR17 .os-fill{height:100%;background:#2468b4;border-radius:8px}#occStatsR17 .os-bar b{text-align:right}#occStatsR17 .os-note{font-size:11px;color:#536d86;margin:7px 0;line-height:1.5}#occStatsR17 .os-quality{margin-top:12px}#occStatsR17 .os-quality table{width:100%;height:auto!important;border-collapse:collapse;font-size:12px}#occStatsR17 .os-quality :is(td,th){padding:7px!important;height:auto!important;min-height:0!important;text-align:left}#occStatsR17 .os-quality td:last-child{text-align:right}';
let serial=0,session='',opened=false;
function clear(){serial++;opened=false;session='';const p=$('occStatsR17');if(p){p.hidden=true;$('occStatsResultsR17')?.replaceChildren();}const b=$('occStatsBtnR17');if(b)b.setAttribute('aria-expanded','false');}
function current(seq,t){return seq===serial&&t===token()&&opened&&!$('appTela')?.classList.contains('hidden')}
function bars(title,data,label=x=>x){const a=Array.isArray(data)?data:[],max=Math.max(1,...a.map(x=>Number(x.n)||0));return '<section class="os-chart"><h3>'+e(title)+'</h3>'+(a.length?a.map(x=>'<div class="os-bar"><span>'+e(label(x.label))+'</span><div class="os-track" aria-hidden="true"><div class="os-fill" style="width:'+Math.max(0,Math.min(100,100*(Number(x.n)||0)/max))+'%"></div></div><b>'+e(n(x.n))+'</b></div>').join(''):'<p class="os-note">Sem registros no período.</p>')+'</section>'}
function show(p){
 const target=$('occStatsResultsR17'),options=$('occStatsNatureR17'),prev=options.value;
 options.replaceChildren(new Option('Todas',''));for(const x of p.opcoes_natureza||[])options.add(new Option(x,x));if([...options.options].some(x=>x.value===prev))options.value=prev;
 const a=p.algemas||[],confirmed=a.find(x=>x.label==='SIM')?.n||0;
 const kpis=[['Ocorrências no período',p.total,'Uma por registro ativo'],['Base geral',p.total_base,'Todos os períodos'],['Uso de algemas: SIM',confirmed,'Somente resposta explícita'],['Procedimentos preenchidos',p.procedimentos,'Campo registrado, não desfecho']];
 target.innerHTML='<div class="os-note">Cobertura da base: '+e(br(p.primeira))+' a '+e(br(p.ultima))+' · Consulta em '+e(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza'}).format(new Date(p.consultado_em)))+' · Atualiza conforme os registros chegam ao Online.</div><div class="os-kpis">'+kpis.map(([l,v,d])=>'<div class="os-kpi">'+e(l)+'<strong>'+e(n(v))+'</strong><small>'+e(d)+'</small></div>').join('')+'</div>'+
 '<div class="os-charts">'+bars('Ocorrências por mês',p.meses,month)+bars('Naturezas registradas',p.naturezas)+bars('Meio de recebimento',p.vias)+bars('Uso de algemas',p.algemas)+'</div>'+
 '<p class="os-note">Uma ocorrência pode conter várias naturezas; a soma das categorias pode ultrapassar o total de ocorrências. Naturezas livres não padronizadas aparecem em Outras naturezas; meios livres aparecem em Outros meios.</p>'+
 '<section class="os-chart os-quality"><h3>Qualidade dos registros e produção</h3><table><thead><tr><th>Indicador</th><th>Quantidade</th></tr></thead><tbody>'+
 [['Procedimentos adotados preenchidos',p.procedimentos],['Campo materiais apreendidos preenchido (não confirma apreensão)',p.campo_materiais],['Campo resultado preenchido',p.resultados],['Data inválida ou ausente na base',p.sem_data_base]].map(([l,v])=>'<tr><td>'+e(l)+'</td><td>'+e(n(v))+'</td></tr>').join('')+'</tbody></table><p class="os-note">Prisões efetivas, conduções de acusados, conduções de vítimas e apreensões confirmadas não são estimadas por palavras do relato. Esses desfechos requerem classificação validada. Meses sem registros recebidos não significam ausência de ocorrências.</p></section>';
}
async function load(){
 const t=token(),seq=++serial,target=$('occStatsResultsR17');
 if(!opened||!t||!target)return;
 const inicio=$('occStatsStartR17').value,fim=$('occStatsEndR17').value,natureza=$('occStatsNatureR17').value;
 if(inicio&&fim&&inicio>fim){target.textContent='Informe um período válido.';return;}
 target.textContent='Consultando estatísticas…';
 try{
  const r=await fetch('https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'ocorrencias_estatisticas',inicio,fim,natureza}),cache:'no-store'});
  let p={};try{p=await r.json()}catch{}
  if(!current(seq,t))return;
  if(!r.ok||!p.ok)throw Error(p.message||'HTTP '+r.status);
  show(p);
 }catch(err){if(current(seq,t))target.textContent='Não foi possível consultar: '+(err.message||'Falha de comunicação.');}
}
function open(){const t=token();if(!t)return;const panel=$('occStatsR17');if(!panel)return;if(opened&&session===t){clear();return;}
 clear();session=t;opened=true;panel.hidden=false;$('occStatsBtnR17').setAttribute('aria-expanded','true');$('occStatsStartR17').value=year()+'-01-01';$('occStatsEndR17').value=year()+'-12-31';$('occStatsNatureR17').replaceChildren(new Option('Todas',''));load();}
function boot(){
 const p=$('occStatsR17'),b=$('occStatsBtnR17');if(!p||!b)return;
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 b.addEventListener('click',open);$('occStatsCloseR17').addEventListener('click',clear);
 $('occStatsRefreshR17').addEventListener('click',load);
 $('occStatsAllR17').addEventListener('click',()=>{$('occStatsStartR17').value='';$('occStatsEndR17').value='';$('occStatsNatureR17').value='';load()});
 $('occStatsYearR17').addEventListener('click',()=>{$('occStatsStartR17').value=year()+'-01-01';$('occStatsEndR17').value=year()+'-12-31';load()});
 for(const id of ['occStatsStartR17','occStatsEndR17','occStatsNatureR17'])$(id).addEventListener('change',load);
 $('occNovo')?.addEventListener('click',clear);
 const app=$('appTela');if(app)new MutationObserver(()=>{if(app.classList.contains('hidden')||session&&session!==token())clear()}).observe(app,{attributes:true,attributeFilter:['class','style']});
 const section=document.querySelector('section[data-view="ocorrencias"]');if(section)new MutationObserver(()=>{if(section.classList.contains('hidden'))clear()}).observe(section,{attributes:true,attributeFilter:['class']});
 window.addEventListener('storage',x=>{if(x.key==='gcmbs.mobile.token'||x.key===null)clear()});
 window.addEventListener('pageshow',()=>{if(session&&session!==token())clear()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();