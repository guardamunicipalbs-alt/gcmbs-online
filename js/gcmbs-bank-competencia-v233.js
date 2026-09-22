/* GCMBS V233 — paridade do Banco de Horas com a competência do Desktop.
   Apenas apresentação: não cria créditos, débitos, transporte nem altera o banco.
   A data do fato serve para identificar PREVISTO, nunca para retirar da competência. */
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const $=id=>document.getElementById(id);
const hojeFortaleza=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const horas=min=>{const n=Math.abs(min);return `${min<0?'-':''}${Math.floor(n/60)}h${String(n%60).padStart(2,'0')}`};

export function calcularCompetenciaIntegral(lancamentos,competencia,guardaId=0,hoje=hojeFortaleza()){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia)))throw new Error('Competência inválida.');
  if(!Array.isArray(lancamentos))throw new Error('Histórico indisponível.');
  const ids=new Set();let credito50=0,credito100=0,debito=0,previstos=0,horasPrevistas=0,quantidade=0;
  for(const r of lancamentos){
    // A competência registrada é a referência contábil; NÃO usar data_fato, mês atual nem data de hoje.
    if(String(r?.competencia||'').slice(0,7)!==competencia)continue;
    if(guardaId&&Number(r.guarda_id)!==guardaId)continue;
    if(String(r.status||'ATIVO').toUpperCase()!=='ATIVO'||r.deleted===true)continue;
    const min=Number(r.minutos),classe=String(r.classe||''),natureza=String(r.natureza||'CREDITO').toUpperCase();
    if(!Number.isSafeInteger(min)||min<0||!['50','100'].includes(classe)||!['CREDITO','DEBITO'].includes(natureza))throw new Error('Movimentação ativa inválida: conferência necessária.');
    const id=Number(r.desktop_id||r.id||0);
    if(Number.isSafeInteger(id)&&id>0){const k=`${Number(r.guarda_id)}:${id}`;if(ids.has(k))continue;ids.add(k)}
    if(natureza==='DEBITO')debito+=min;else if(classe==='100')credito100+=min;else credito50+=min;
    quantidade++;
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(r.data_fato||'').slice(0,10))&&String(r.data_fato).slice(0,10)>hoje){previstos++;horasPrevistas+=min}
  }
  return {credito50,credito100,debito,saldo:credito50+credito100-debito,quantidade,previstos,horasPrevistas};
}

let ultimo=null,assinatura='',pedido=0,carregando=false;
function visivel(){const s=document.querySelector('section[data-view="banco"]');return !!s&&!s.classList.contains('hidden')}
function escopo(){const comp=$('bhCompetenciaFiltro')?.value||'';const a=$('bhGcmFiltro')?.value||$('bhGcmFiltroV136')?.value||'';const g=String(a).startsWith('id:')?Number(String(a).slice(3)):Number(a)||0;return {comp,guarda:g,token:localStorage.getItem('gcmbs.mobile.token')||''}}
function nota(){const el=$('bhSaldo')?.closest('.card');if(!el)return null;let p=$('gcmbsCompetenciaIntegralV233');if(!p){p=document.createElement('p');p.id='gcmbsCompetenciaIntegralV233';p.className='notice';p.style.marginTop='10px';el.appendChild(p)}return p}
function render(){if(!ultimo||!visivel())return;const e=escopo();if(`${e.comp}|${e.guarda}|${e.token}`!==assinatura)return;
  let r;try{r=calcularCompetenciaIntegral(ultimo,e.comp,e.guarda)}catch(err){const p=nota();if(p)p.textContent=`Conferência indisponível: ${err.message}`;return}
  for(const [id,min] of [['bh50',r.credito50],['bh100',r.credito100],['bhDeb',r.debito],['bhSaldo',r.saldo]]){const el=$(id);if(el)el.textContent=horas(min)}
  const p=nota();if(p)p.textContent=`Competência integral ${e.comp}: ${r.quantidade} movimentações ativas contabilizadas, independentemente da data do serviço.${r.previstos?` ${r.previstos} lançamento(s) de serviço futuro incluído(s) (${horas(r.horasPrevistas)}), identificados como PREVISTOS no histórico.`:''} Saldo informativo: não confirma realização do serviço nem pagamento.`;
}
async function atualizar(){if(!visivel())return;const e=escopo();if(!e.token||!/^\d{4}-\d{2}$/.test(e.comp))return;
  const sig=`${e.comp}|${e.guarda}|${e.token}`;if(carregando)return;
  carregando=true;const seq=++pedido;
  try{
    const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${e.token}`},body:JSON.stringify({action:'data'}),cache:'no-store'});
    if(!resp.ok)throw new Error('Dados não disponíveis.');const body=await resp.json();if(!Array.isArray(body.banco_horas))throw new Error('Histórico incompleto.');
    if(seq!==pedido||sig!==`${escopo().comp}|${escopo().guarda}|${escopo().token}`)return;
    // Valide antes de tocar nos indicadores; se a API falhar, não substitua o valor exibido por zero.
    calcularCompetenciaIntegral(body.banco_horas,e.comp,e.guarda);
    ultimo=body.banco_horas;assinatura=sig;render();
  }catch(err){const p=nota();if(p)p.textContent='Não foi possível conferir a competência integral na nuvem. Os valores existentes foram preservados.'}
  finally{carregando=false}
}
function iniciar(){
  const f=$('bhCompetenciaFiltro');if(!f)return;
  document.addEventListener('change',ev=>{if(['bhCompetenciaFiltro','bhGcmFiltro','bhGcmFiltroV136'].includes(ev.target?.id)){pedido++;ultimo=null;setTimeout(atualizar,120)}},true);
  document.addEventListener('click',ev=>{if(ev.target?.closest?.('[data-go="banco"],[data-module="banco_horas"]'))setTimeout(atualizar,350)},true);
  window.addEventListener('gcmbs:v110-refresh',()=>{pedido++;setTimeout(atualizar,350)});
  setInterval(()=>{if(visivel())atualizar()},60000);
  if(visivel())setTimeout(atualizar,250);
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
}
