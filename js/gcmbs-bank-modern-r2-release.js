/* GCMBS Banco de Horas: layout de consulta aprovado 27/11/2026.
   Somente apresentacao; nenhuma escrita, recalculo de folha ou mudanca de permissao. */
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const qtd=v=>num(v)===null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const moeda=v=>num(v)===null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const h=m=>{const n=Math.abs(m);return (m<0?'-':'')+Math.floor(n/60)+'h'+String(n%60).padStart(2,'0')};
const date=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10).split('-').reverse().join('/'):String(v||'—');
const comp=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||'').slice(0,7))?String(v).slice(0,7):'';
const dateComp=v=>{const d=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return '';if(d<='2026-09-30'||+d.slice(8)<20)return d.slice(0,7);const x=new Date(d.slice(0,7)+'-01T12:00:00Z');x.setUTCMonth(x.getUTCMonth()+1);return x.toISOString().slice(0,7)};
export const financialComp=r=>comp(r.competencia_pagamento)||comp(r.competencia)||dateComp(r.data_fato);
export function ledgerRows(rows,c,gid){
 const seen=new Map(),out=[];let conflict=false;
 for(const r of rows||[]){
  if(!gid||Number(r.guarda_id)!==gid||financialComp(r)!==c||r.deleted===true||String(r.status||'ATIVO').toUpperCase()!=='ATIVO')continue;
  const m=num(r.minutos),cls=String(r.classe||''),nat=String(r.natureza||'CREDITO').toUpperCase();
  if(m===null||!Number.isSafeInteger(m)||m<0||!['50','100'].includes(cls)||!['CREDITO','DEBITO'].includes(nat)){conflict=true;continue}
  const id=Number(r.desktop_id||r.id||0),sig=[cls,nat,m].join('|');
  if(id>0&&seen.has(id)){if(seen.get(id)!==sig)conflict=true;continue}
  if(id>0)seen.set(id,sig);
  out.push({...r,minutos:m,classe:cls,natureza:nat});
 }
 out.sort((a,b)=>String(a.data_fato||'').localeCompare(String(b.data_fato||''))||Number(a.desktop_id||0)-Number(b.desktop_id||0));
 return {rows:out,conflict,credit50:out.filter(r=>r.classe==='50'&&r.natureza==='CREDITO').reduce((s,r)=>s+r.minutos,0),credit100:out.filter(r=>r.classe==='100'&&r.natureza==='CREDITO').reduce((s,r)=>s+r.minutos,0),debit:out.filter(r=>r.natureza==='DEBITO').reduce((s,r)=>s+r.minutos,0)};
}
export function periodDays(c){
 if(!comp(c))return [];
 const [y,m]=c.split('-').map(Number);
 const first=c==='2026-10'?new Date(Date.UTC(y,m-1,1,12)):c<'2026-10'?new Date(Date.UTC(y,m-1,1,12)):new Date(Date.UTC(y,m-2,20,12));
 const last=c<'2026-10'?new Date(Date.UTC(y,m,0,12)):new Date(Date.UTC(y,m-1,19,12));
 const arr=[];for(let d=first;d<=last;d=new Date(+d+86400000))arr.push(d.toISOString().slice(0,10));return arr;
}
const titleMonth=c=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(c+'-01T12:00:00Z')).toUpperCase();
const monthName=v=>{const n=num(v);return n!==null&&n>=1&&n<=12?new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,n-1,1))).toUpperCase():String(v||'—').toUpperCase()};
const css=[
'section[data-view="banco"].gc-bank-modern{min-width:0}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details)>.gc-bank-legacy{display:none!important}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details)>.gc-bank-top>.grid,section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) #gcmbsCompetenciaIntegralV233{display:none!important}',
'section[data-view="banco"].gc-bank-modern.gc-bank-details #gcBankModern{display:none!important}',
'#gcBankModern{color:#102b4c;background:#f5f8fc;border:1px solid #cddceb;border-radius:12px;padding:10px;display:grid;gap:10px;min-width:0;font:13px/1.4 system-ui,sans-serif}',
'#gcBankModern *{box-sizing:border-box}',
'#gcBankModern .gcb-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:9px 12px;border-radius:8px;background:linear-gradient(110deg,#082c56,#11588c);color:white}',
'#gcBankModern .gcb-head h2{font-size:clamp(15px,1.5vw,22px);margin:0;color:white!important;font-weight:800}',
'#gcBankModern .gcb-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
'#gcBankModern button,.gc-bank-mode{border:1px solid #b6cbe2;border-radius:7px;background:#fff;color:#12385d;padding:6px 9px;font:600 12px system-ui;cursor:pointer}',
'#gcBankModern .gcb-strip{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:5px 0}',
'#gcBankModern .gcb-field{padding:6px 9px;border:1px solid #d4e0ed;border-radius:7px;background:white}',
'#gcBankModern .gcb-vac{background:#fff2ac;border-color:#e5ce61}',
'#gcBankModern .gcb-block{min-width:0;background:white;border:1px solid #cad9e8;border-radius:9px;overflow:hidden}',
'#gcBankModern .gcb-bar{background:linear-gradient(100deg,#092d57,#145d93);color:#fff;font-weight:800;padding:7px 10px;font-size:14px}',
'#gcBankModern .gcb-summary .gcb-bar{background:linear-gradient(100deg,#a51d2c,#c03540)}',
'#gcBankModern .gcb-upper{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}',
'#gcBankModern .gcb-scroll{overflow-x:auto;max-width:100%}',
'#gcBankModern table{width:100%;border-collapse:collapse;margin:0;color:#102b4c;background:white;font-size:12px}',
'#gcBankModern th,#gcBankModern td{border:1px solid #d2dfea;padding:6px 7px;text-align:center;vertical-align:middle}',
'#gcBankModern th{background:#e9f0f8;color:#15375a;font-weight:750}',
'#gcBankModern .gcb-calendar{table-layout:fixed;min-width:560px}',
'#gcBankModern .gcb-calendar th,#gcBankModern .gcb-calendar td{padding:5px 0;font-size:clamp(9px,.7vw,12px)}',
'#gcBankModern .gcb-calendar .worked{background:#c7e8ff;color:#083967;font-weight:800}',
'#gcBankModern .gcb-calendar .gcb-month{background:#d9e9fa}',
'#gcBankModern .gcb-calendar .gcb-prev{border-right:2px solid #6f9dca}',
'#gcBankModern .gcb-summary table{min-width:0!important;width:100%!important;table-layout:fixed;font-size:11px}',
'#gcBankModern .gcb-summary td{font-weight:800;font-size:12px;padding:8px 3px}',
'#gcBankModern .gcb-extras{background:#ffed9a;color:#654c00}',
'#gcBankModern .gcb-other{background:#c1e9fb;color:#12466b}',
'#gcBankModern .gcb-money{background:#e5f3df;color:#245e36}',
'#gcBankModern .gcb-ledger th{background:#123f6c!important;color:white!important;text-align:left}',
'#gcBankModern .gcb-ledger td{text-align:left}',
'#gcBankModern .gcb-ledger td:nth-child(-n+5){text-align:center;white-space:nowrap}',
'#gcBankModern .gcb-ledger tbody tr:nth-child(even){background:#eff4f9}',
'#gcBankModern .gcb-cls{display:inline-block;min-width:45px;padding:3px 7px;border-radius:7px;font-weight:800;background:#cce8ff;color:#124975}',
'#gcBankModern .gcb-cls.c100{background:#d6efc5;color:#265b20}',
'#gcBankModern .gcb-note{font-size:11px;color:#526984;padding:5px 8px}',
'#gcBankModern .gcb-ledger{min-width:680px}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details)>:not(.gc-bank-top):not(#gcBankModern){display:none!important}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) .gc-bank-top>:not(.toolbar):not(:has(#bhCompetenciaFiltro)):not(:has(#gcBankMode)){display:none!important}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) .gc-bank-top .toolbar>:not(label):not(#gcBankMode):not(:has(#bhCompetenciaFiltro)):not(:has(#bhGcmFiltro)):not(:has(#bhGcmFiltroV136)){display:none!important}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) .gc-bank-top{padding:8px 12px!important;margin-bottom:8px!important}',
'#gcBankModern .gcb-summary th{white-space:normal!important;overflow-wrap:anywhere;padding:5px 3px;font-size:11px}',
'#gcBankModern .gcb-summary .gcb-extras{background:#ffed9a!important;color:#654c00!important}',
'#gcBankModern .gcb-summary .gcb-other{background:#c1e9fb!important;color:#12466b!important}',
'#gcBankModern .gcb-summary td.gcb-money{background:#e5f3df!important;color:#245e36!important}',
'#gcBankModern .gcb-summary{order:-1}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) .gc-bank-top #tituloBanco{display:none!important}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) .gc-bank-top div:has(#bh50):not(:has(#bhCompetenciaFiltro)):not(:has(#gcBankMode)){display:none!important}',
'section[data-view="banco"].gc-bank-modern:not(.gc-bank-details) .gc-bank-top .gc-bank-old-tab{display:none!important}',
'#gcBankModern .gcb-calendar{min-width:0!important}',
'#gcBankModern .gcb-calendar .gcb-planned{background:#fff2be;color:#805c04}',
'#gcBankModern .gcb-calendar .gcb-absence{background:#fce0e0;color:#a52525}',
'#gcBankModern .gcb-ledger th,#gcBankModern .gcb-ledger td{padding:5px 7px!important}',
'@media(max-width:600px){#gcBankModern .gcb-summary table{min-width:540px!important}#gcBankModern .gcb-calendar{min-width:520px!important}}',
'@media(max-width:1200px){#gcBankModern .gcb-upper{grid-template-columns:minmax(0,1fr)} }',
'@media(max-width:600px){#gcBankModern{padding:6px} #gcBankModern .gcb-head h2{font-size:15px}}',
'@media print{body.gc-bank-print #mainNav,body.gc-bank-print header,body.gc-bank-print .gc-bank-top,body.gc-bank-print .gcb-actions,body.gc-bank-print .gc-bank-legacy{display:none!important}body.gc-bank-print main{margin:0!important;padding:0!important;width:100%!important}body.gc-bank-print #gcBankModern{display:grid!important;border:none;padding:0;background:white;overflow:visible}body.gc-bank-print #gcBankModern .gcb-upper{grid-template-columns:1fr}body.gc-bank-print #gcBankModern .gcb-scroll{overflow:visible}body.gc-bank-print #gcBankModern table{min-width:0;font-size:10px}body.gc-bank-print #gcBankModern tr{break-inside:avoid}body.gc-bank-print #gcBankModern *{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'
].join('\n');
let lastSession=null,cache=new Map(),seq=0,scope='';
export function clearBankModern(){seq++;scope='';lastSession=null;cache.clear();$('gcBankModern')?.remove();const s=document.querySelector('section[data-view="banco"]');s?.classList.remove('gc-bank-modern','gc-bank-details');}
function downloadCsv(rows,name){const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const out='\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([out],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function install(section){if(!$('gcBankModernCSS')){const style=document.createElement('style');style.id='gcBankModernCSS';style.textContent=css;document.head.appendChild(style)}
 const top=$('tituloBanco')?.closest('.card');if(!top)return null;
 top.classList.add('gc-bank-top');
 for(const card of section.querySelectorAll(':scope > .card'))if(card!==top)card.classList.add('gc-bank-legacy');
 let toggle=$('gcBankMode');if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.id='gcBankMode';toggle.className='gc-bank-mode';toggle.textContent='Conferência e correções';toggle.setAttribute('aria-expanded','false');top.querySelector('.toolbar')?.append(toggle);toggle.addEventListener('click',()=>{const b=section.classList.toggle('gc-bank-details');toggle.textContent=b?'Voltar ao resumo':'Conferência e correções';toggle.setAttribute('aria-expanded',String(b))})}
 let panel=$('gcBankModern');if(!panel){panel=document.createElement('div');panel.id='gcBankModern';top.after(panel)}
 for(const button of top.querySelectorAll('button'))if(/^(Resumo e lançamentos|Filtros avançados e impressão)$/i.test(button.textContent.trim()))button.classList.add('gc-bank-old-tab');
 section.classList.add('gc-bank-modern');return panel;
}
async function getPayroll(provider,c,gid){
 const key=c+'|'+gid;
 const old=cache.get(key);if(old&&Date.now()-old.time<1800000)return old.promise;
 const promise=provider.endpoint('https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-bank-view-r2','bank_view',{competencia:c,guarda_id:gid}).catch(()=>{cache.delete(key);return null});
 cache.set(key,{time:Date.now(),promise});return promise;
}
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\s]+/g,' ').toUpperCase();
export function describeEntry(r){
 const type=clean(r.tipo),origin=clean(r.origem),reason=clean(r.motivo),obs=clean(r.observacao);
 const isExtra=norm(type)==='CREDITO SERVICO EXTRA',manual=norm(origin)==='MANUAL';
 const label=norm(type).includes('ESCALA EXTRA MANUAL')?'Escala Extra Manual':isExtra&&manual?'Serviço extra manual':type||origin||'Movimentação';
 const main=reason&&norm(reason)!==norm(label)&&norm(reason)!==norm(type)?reason:label;
 const notes=[obs,norm(origin)!==norm(type)&&norm(origin)!==norm(main)&&norm(origin)!=='MANUAL'&&norm(origin)!=='ESCALA EXTRA MANUAL'?origin:''].filter(x=>x&&norm(x)!==norm(main)&&norm(x)!==norm(label));
 return {reason:main,obs:[...new Set(notes)].join(' · ')};
}
export function dayMark(d,row,payroll){
 if(row)return {val:String(row.dias?.[d]??(row.emFerias?'':'-')),style:row.dias?.[d]==='X'?'worked':''};
 if(!payroll||payroll.status==='FECHADA')return {val:'·',style:''};
 const f=(payroll.frequency||[]).filter(x=>x.data===d).map(x=>String(x.situacao||'').toUpperCase());
 if(f.includes('PRESENTE'))return {val:'X'+(f.includes('FALTA')?'/F':''),style:'worked'};
 if(f.includes('FALTA'))return {val:'F',style:'gcb-absence'};
 if(f.includes('DISPENSADO'))return {val:'D',style:''};
 if((payroll.schedule||[]).includes(d))return {val:'P',style:'gcb-planned'};
 return {val:'·',style:''};
}
function paint(panel,provider,c,gid,ledger,payroll,loading){
 const g=payroll?.guard||(provider.guardas()||[]).find(x=>Number(x.id||x.guarda_id)===gid)||{};
 const row=Number(payroll?.row?.id)===gid?payroll.row:null;
 const name=row?.nome_completo||g.nome_completo||g.nome_guerra||(gid===Number(provider.session?.guarda_id)?provider.session?.nome:'')||'GCM';
 const war=row?.nome_guerra||g.nome_guerra||ledger.rows[0]?.nome_guerra||name;
 const days=periodDays(c);const state=row?'Folha fechada — valores registrados':loading?'Consultando folha…':payroll?.status==='ABERTA'?'Folha aberta — estimativa bruta, antes de ajustes e limites':payroll?.status==='FECHADA'?'Folha fechada sem registro individual disponível':'Banco de horas — saldo informativo';
 const valid=!ledger.conflict;
 const fifty=row?num(row.horas50):valid?ledger.credit50/60:null;
 const hundred=row?num(row.horas100):valid?ledger.credit100/60:null;
 const total=row?num(row.horasPagaveis):fifty!==null&&hundred!==null?fifty+hundred:null;
 const estimate=(hours,rate)=>hours!==null&&num(rate)!==null?Math.round(hours*Number(rate)*100)/100:null;
 const val50=row?num(row.valor50):estimate(fifty,payroll?.rates?.valor50),val100=row?num(row.valor100):estimate(hundred,payroll?.rates?.valor100),valTotal=row?num(row.valorTotal):val50!==null&&val100!==null?val50+val100:null;
 const absences=row?row.faltas:payroll&&payroll.status!=='FECHADA'&&payroll.frequency?.length?payroll.frequency.filter(x=>String(x.situacao).toUpperCase()==='FALTA').length:null;
 const night=row?.adicionalNoturno??(payroll?.night?String(payroll.night)+(payroll.nightSource==='PREFERENCIA'?' (padrão)':' (ajuste)'):'—');
 const dayGroups=[];for(const d of days){const key=d.slice(0,7);const prev=dayGroups.at(-1);if(prev?.key===key)prev.n++;else dayGroups.push({key,n:1})}
 const stamp=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=k=>stamp.find(x=>x.type===k)?.value;const today=p('year')+'-'+p('month')+'-'+p('day');
 const entries=ledger.rows.map((r,i)=>{const d=describeEntry(r);const obs=[d.obs,r.natureza==='DEBITO'?'DÉBITO':'',String(r.data_fato||'').slice(0,10)>today?'PREVISTO':''].filter(Boolean).join(' · ');return {i:i+1,gcm:war,qt:h((r.natureza==='DEBITO'?-1:1)*r.minutos),cls:r.classe+'%',date:date(r.data_fato),reason:d.reason,obs:obs||'—'}});
 panel.innerHTML='<div class="gcb-head"><h2>Folha de Pagamento / Banco de Horas — '+e(titleMonth(c))+' <small style="font-size:11px;color:white!important">R2</small></h2><div class="gcb-actions"><button type="button" data-gcb-print>Imprimir / PDF</button><button type="button" data-gcb-csv>Excel (CSV)</button></div></div>'+
 '<div class="gcb-strip"><span class="gcb-field"><b>GCM:</b> '+e(name)+'</span><span class="gcb-field"><b>Nome de guerra:</b> '+e(war)+'</span><span class="gcb-field gcb-vac"><b>Mês de férias:</b> '+e(monthName(row?.mes_ferias??g.mes_ferias))+'</span><span class="gcb-field"><b>Competência:</b> '+e(date(days[0]))+' a '+e(date(days.at(-1)))+'</span></div>'+
 '<div class="gcb-upper"><div class="gcb-block"><div class="gcb-bar">Dias trabalhados</div><div class="gcb-scroll"><table class="gcb-calendar"><thead><tr>'+dayGroups.map(x=>'<th class="gcb-month" colspan="'+x.n+'">'+e(titleMonth(x.key))+'</th>').join('')+'</tr><tr>'+days.map(d=>'<th title="'+e(date(d))+'">'+e(d.slice(8))+'</th>').join('')+'</tr></thead><tbody><tr>'+days.map(d=>{const mark=dayMark(d,row,payroll);return '<td class="'+mark.style+'" title="'+e(date(d))+'">'+e(mark.val)+'</td>'}).join('')+'</tr></tbody></table></div><div class="gcb-note">'+(row?'X = registro da folha fechada · - = sem marcação · férias permanecem em branco.':payroll&&payroll.status!=='FECHADA'?'X = presença registrada · P = escala prevista · F = falta registrada · D = dispensado · · = sem informação.':'· = marcação da folha não disponível nesta consulta.')+'</div></div>'+
 '<div class="gcb-block gcb-summary"><div class="gcb-bar">Resumo final</div><div class="gcb-scroll"><table><thead><tr><th class="gcb-extras" colspan="6">EXTRAS</th><th class="gcb-other" colspan="2">OUTROS</th></tr><tr><th>QT 50%</th><th>VALOR 50%</th><th>QT 100%</th><th>VALOR 100%</th><th>QT TOTAL</th><th>VALOR TOTAL</th><th>FALTAS</th><th>ADICIONAL NOTURNO</th></tr></thead><tbody><tr><td>'+qtd(fifty)+'</td><td class="gcb-money">'+moeda(val50)+'</td><td>'+qtd(hundred)+'</td><td class="gcb-money">'+moeda(val100)+'</td><td>'+qtd(total)+'</td><td class="gcb-money">'+moeda(valTotal)+'</td><td>'+qtd(absences)+'</td><td>'+e(night)+'</td></tr></tbody></table></div><div class="gcb-note">'+e(state)+' · Débitos do banco: '+(valid?h(ledger.debit):'—')+' · Saldo: '+(valid?h(ledger.credit50+ledger.credit100-ledger.debit):'—')+'</div></div></div>'+
 '<div class="gcb-block"><div class="gcb-bar">Lançamentos da competência · '+entries.length+' ativos</div><div class="gcb-scroll"><table class="gcb-ledger"><thead><tr><th>Nº</th><th>GCM</th><th>QT/H</th><th>Classe</th><th>Data</th><th>Local / Motivo</th><th>Observações</th></tr></thead><tbody>'+entries.map(x=>'<tr><td>'+x.i+'</td><td>'+e(x.gcm)+'</td><td>'+e(x.qt)+'</td><td><span class="gcb-cls '+(x.cls==='100%'?'c100':'')+'">'+e(x.cls)+'</span></td><td>'+e(x.date)+'</td><td>'+e(x.reason)+'</td><td>'+e(x.obs)+'</td></tr>').join('')+(entries.length?'':'<tr><td colspan="7">Nenhum lançamento ativo nesta competência.</td></tr>')+'</tbody></table></div><div class="gcb-note">'+(ledger.conflict?'ATENÇÃO: há movimentos inválidos ou conflitantes. Confira no histórico original; os totais do banco não foram apresentados. ':'')+'A classe vem do registro, não da data. A folha fechada e o banco de horas podem ter totais diferentes. Excluídos e estornados permanecem na conferência.</div></div>';
 panel.querySelector('[data-gcb-print]').onclick=()=>{document.body.classList.add('gc-bank-print');window.addEventListener('afterprint',()=>document.body.classList.remove('gc-bank-print'),{once:true});window.print();document.body.classList.remove('gc-bank-print')};
 panel.querySelector('[data-gcb-csv]').onclick=()=>downloadCsv([['GCM','Competência','Origem do resumo','QT 50%','Valor 50%','QT 100%','Valor 100%','QT total','Valor total','Faltas','Adicional noturno'],[name,c,state,qtd(fifty),moeda(val50),qtd(hundred),moeda(val100),qtd(total),moeda(valTotal),qtd(absences),night],[],['Nº','GCM','QT/H','Classe','Data','Local / Motivo','Observações'],...entries.map(x=>[x.i,x.gcm,x.qt,x.cls,x.date,x.reason,x.obs])],'GCMBS_Banco_'+c+'.csv');
}
export function renderBankModern(provider){
 const section=document.querySelector('section[data-view="banco"]');if(!section||section.classList.contains('hidden')||!provider.session)return;
 if(lastSession!==provider.session){cache.clear();lastSession=provider.session;seq++}
 const c=comp($('bhCompetenciaFiltro')?.value);if(!c)return;
 let filter=$('bhGcmFiltroV136')||$('bhGcmFiltro');
 if(provider.gestor()&&!filter){const label=document.createElement('label');label.textContent='GCM ';filter=document.createElement('select');filter.id='bhGcmFiltroV136';label.append(filter);$('tituloBanco')?.closest('.toolbar')?.append(label)}
 if(provider.gestor()&&filter){const old=filter.value;const guards=(provider.guardas()||[]).filter(x=>Number(x.id||x.guarda_id)>0);if(filter.options.length<=1&&guards.length){filter.replaceChildren(new Option('Selecione o GCM',''));const seen=new Set();for(const g of guards.slice().sort((a,b)=>String(a.nome_guerra||a.nome_completo).localeCompare(String(b.nome_guerra||b.nome_completo),'pt-BR'))){const id=String(g.id||g.guarda_id);if(!seen.has(id)){seen.add(id);filter.add(new Option(g.nome_guerra||g.nome_completo||'GCM',id))}}filter.value=old||''}if(!filter.value&&Number(provider.session?.guarda_id)>0){const own=String(provider.session.guarda_id);if([...filter.options].some(o=>o.value===own))filter.value=own}}
 const gid=provider.gestor()?Number(String(filter?.value||'').replace(/^id:/,'')):Number(provider.session.guarda_id||0);
 const panel=install(section);if(!panel)return;
 const title=$('tituloBanco');if(title)title.setAttribute('aria-label','Banco de Horas');
 const key=c+'|'+gid;scope=key;const req=++seq;const session=provider.session;
 if(!gid){panel.textContent='Selecione o GCM para visualizar a folha individual e os lançamentos.';return}
 const ledger=ledgerRows(provider.bancoHoras(),c,gid);
 paint(panel,provider,c,gid,ledger,null,true);
 getPayroll(provider,c,gid).then(result=>{if(req===seq&&scope===key&&provider.session===session&&panel.isConnected&&!section.classList.contains('hidden'))paint(panel,provider,c,gid,ledger,result,false)});
}
