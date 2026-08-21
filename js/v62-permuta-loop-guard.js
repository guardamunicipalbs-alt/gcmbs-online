// GCMBS 10.0.62 — estabilização e paridade Online/App.
// Mantém o Desktop como referência funcional sem alterar dados existentes.

const GCMBS_EDGE_BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const GCMBS_API_CORS=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6-cors';
const GCMBS_API_V6=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6';
const GCMBS_QUADRO_V62=GCMBS_EDGE_BASE+'gcmbs-quadro-v62';
const GCMBS_ACOES_EXCLUSIVAS_CORS=new Set(['entity_catalog','entity_list','entity_mutate','frequency_services']);
let gcmbsPostoEditKey='',gcmbsTipoEscalaEditKey='';

function gcmbsEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// Guarda a chave do registro antes de o app-core abrir o editor.
document.addEventListener('click',e=>{
  const edit=e.target?.closest?.('[data-online-edit]');
  if(edit){
    const key=String(edit.dataset.onlineEdit||'');
    gcmbsPostoEditKey=key;
    gcmbsTipoEscalaEditKey=key;
  }
  if(e.target?.closest?.('#onlineNovo')){
    gcmbsPostoEditKey='';
    gcmbsTipoEscalaEditKey='';
  }
},true);

function gcmbsBloquearObserverRecursivoPermutas(){
  const host=document.getElementById('listaPermutasSolicitadas');
  if(!host)return false;
  if(!host.dataset.v62obs)host.dataset.v62obs='loop-guard';
  return true;
}
if(!gcmbsBloquearObserverRecursivoPermutas()&&document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',gcmbsBloquearObserverRecursivoPermutas,{once:true});
}

if(!window.__gcmbsLowPressureFetch){
  window.__gcmbsLowPressureFetch=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    let destino=url,action='';
    try{if(typeof init?.body==='string')action=String(JSON.parse(init.body||'{}')?.action||'').toLowerCase();}catch{}
    if(url===GCMBS_API_CORS&&action&&!GCMBS_ACOES_EXCLUSIVAS_CORS.has(action))destino=GCMBS_API_V6;
    else if(url===GCMBS_QUADRO_V62&&action==='quadro_operacional')destino=GCMBS_API_V6;
    return nativeFetch(destino,init);
  };
}

if(!window.__gcmbsLowPressureInterval){
  window.__gcmbsLowPressureInterval=true;
  const nativeSetInterval=window.setInterval.bind(window);
  window.setInterval=function(callback,delay,...args){
    const nome=typeof callback==='function'?String(callback.name||''):'';
    if(Number(delay)===15000&&nome==='atualizarBadge')return nativeSetInterval(callback,60000,...args);
    return nativeSetInterval(callback,delay,...args);
  };
}

async function gcmbsFetchApi(url,action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
async function gcmbsApi(action,payload={}){return gcmbsFetchApi(GCMBS_API_CORS,action,payload);}
async function gcmbsApiDireto(action,payload={}){return gcmbsFetchApi(GCMBS_API_V6,action,payload);}

function gcmbsFormContext(regex){
  const dialog=document.getElementById('onlineEditor');
  const titulo=String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
  const host=document.getElementById('onlineCampos');
  return {dialog,titulo,host,ok:!!(dialog&&host&&dialog.open&&regex.test(titulo))};
}
function gcmbsCampo(host,nome){return host?.querySelector(`[data-online-field="${nome}"]`)||null;}
function gcmbsLabel(host,nome){return gcmbsCampo(host,nome)?.closest('label')||null;}
function gcmbsTrocarRotulo(host,nome,texto){
  const el=gcmbsLabel(host,nome);if(!el)return;
  const txt=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
  if(txt)txt.nodeValue=texto;
}
function gcmbsGrid(host,nome){
  return [...(host?.querySelectorAll('.form-section')||[])].find(s=>String(s.querySelector('h3')?.textContent||'').trim()===nome)?.querySelector('.form-grid')||null;
}
function gcmbsSecao(host,nome){
  let sec=[...(host?.querySelectorAll('.form-section')||[])].find(s=>String(s.querySelector('h3')?.textContent||'').trim()===nome);
  if(!sec){sec=document.createElement('section');sec.className='form-section module-editor-section';sec.innerHTML=`<h3>${gcmbsEsc(nome)}</h3><div class="form-grid"></div>`;host.appendChild(sec);}
  return sec;
}
function gcmbsMoverCampo(host,nome,grid,rotulo){
  const lab=gcmbsLabel(host,nome);if(lab&&grid&&lab.parentElement!==grid)grid.appendChild(lab);
  if(rotulo)gcmbsTrocarRotulo(host,nome,rotulo);
  return gcmbsCampo(host,nome);
}

function gcmbsAjustarFormularioGuardas(){
  const {titulo,host,ok}=gcmbsFormContext(/Cadastro de Guardas/i);if(!ok)return;
  const identificacao=gcmbsGrid(host,'Identificação funcional'),pessoais=gcmbsGrid(host,'Dados pessoais'),cnh=gcmbsGrid(host,'CNH e autorizações');
  const rotulos={rg:'RG',cnh:'Número da CNH',categoria_cnh_validade:'Validade da CNH',pai:'Pai',mae:'Mãe',naturalidade:'Naturalidade',email:'E-mail',telefone:'Telefone'};
  const mover=(nome,destino)=>{const el=gcmbsLabel(host,nome);if(el&&destino)destino.appendChild(el);gcmbsTrocarRotulo(host,nome,rotulos[nome]||nome);};
  mover('rg',identificacao);
  for(const n of ['pai','mae','naturalidade','email','telefone'])mover(n,pessoais);
  for(const n of ['cnh','categoria_cnh_validade'])mover(n,cnh);
  const validade=gcmbsCampo(host,'categoria_cnh_validade');if(validade){validade.type='date';validade.value=String(validade.value||'').slice(0,10);}
  const email=gcmbsCampo(host,'email');if(email)email.type='email';
  const telefone=gcmbsCampo(host,'telefone');if(telefone)telefone.type='tel';
  if(/^Novo\s+/i.test(titulo)){
    const status=gcmbsCampo(host,'status');if(status&&(!String(status.value||'').trim()||String(status.value).toUpperCase()==='ATIVA'))status.value='ATIVO';
    for(const n of ['disponivel_escala','pode_noite','pode_24h']){const el=gcmbsCampo(host,n);if(el&&(!String(el.value||'').trim()||String(el.value)==='0'))el.value='1';}
  }
  for(const s of [...host.querySelectorAll('.form-section')])if(String(s.querySelector('h3')?.textContent||'').trim()==='Outros dados'&&!s.querySelector('[data-online-field]'))s.remove();
}

function gcmbsAjustarFormularioEquipes(){
  const {titulo,host,ok}=gcmbsFormContext(/Equipes/i);if(!ok)return;
  gcmbsLabel(host,'modo_distribuicao')?.remove();
  gcmbsTrocarRotulo(host,'tipo_escala_id','Tipo de Escala');gcmbsTrocarRotulo(host,'turno_inicio','Turno inicial');
  const turno=gcmbsCampo(host,'turno_inicio');
  if(turno&&turno.tagName!=='SELECT'){
    const atual=String(turno.value||'A').toUpperCase(),sel=document.createElement('select');sel.dataset.onlineField='turno_inicio';
    sel.innerHTML=`<option value="A" ${atual!=='B'?'selected':''}>A</option><option value="B" ${atual==='B'?'selected':''}>B</option>`;turno.replaceWith(sel);
  }
  const ciclo=gcmbsCampo(host,'ciclo');if(ciclo){ciclo.min='1';ciclo.step='1';}
  const participa=gcmbsCampo(host,'participa_gerador');
  if(participa){
    const atual=String(participa.value||'1');participa.innerHTML=`<option value="1" ${atual!=='0'?'selected':''}>Não</option><option value="0" ${atual==='0'?'selected':''}>Sim</option>`;
    gcmbsTrocarRotulo(host,'participa_gerador','Equipe de Comando / Comandantes');
    const lab=participa.closest('label');if(lab&&!lab.querySelector('.gcmbs-equipe-comando-ajuda')){const small=document.createElement('small');small.className='gcmbs-equipe-comando-ajuda';small.textContent='Quando Sim, a equipe pode permanecer ativa, mas não participa da geração automática de escala.';lab.appendChild(small);}
  }
  if(/^Novo\s+/i.test(titulo)){
    const ativa=gcmbsCampo(host,'ativa');if(ativa)ativa.value='1';
    const c=gcmbsCampo(host,'ciclo');if(c&&!String(c.value||'').trim())c.value='1';
    const t=gcmbsCampo(host,'turno_inicio');if(t&&!String(t.value||'').trim())t.value='A';
    const p=gcmbsCampo(host,'participa_gerador');if(p)p.value='1';
  }
  for(const s of [...host.querySelectorAll('.form-section')])if(!s.querySelector('[data-online-field]'))s.remove();
}

function gcmbsCriarSelectBool(nome,rotulo,valor='0'){
  const lab=document.createElement('label');lab.append(document.createTextNode(rotulo));
  const sel=document.createElement('select');sel.dataset.onlineField=nome;
  sel.innerHTML=`<option value="0" ${String(valor)!=='1'?'selected':''}>Não</option><option value="1" ${String(valor)==='1'?'selected':''}>Sim</option>`;lab.appendChild(sel);return lab;
}
function gcmbsCriarSelectViatura(valor=''){
  const lab=document.createElement('label');lab.append(document.createTextNode('Viatura vinculada'));
  const sel=document.createElement('select');sel.dataset.onlineField='viatura_id';sel.innerHTML='<option value="">Carregando viaturas...</option>';sel.dataset.valorAtual=String(valor??'');lab.appendChild(sel);return lab;
}
async function gcmbsPopularViaturasPosto(host,valor=''){
  const sel=gcmbsCampo(host,'viatura_id');if(!sel)return;
  try{
    const r=await gcmbsApi('references');const lista=Array.isArray(r.viaturas)?r.viaturas:(r.references?.viaturas||[]);
    const atual=String(valor??sel.dataset.valorAtual??sel.value??'');
    const indisponiveis=new Set(['MANUTENCAO','MANUTENÇÃO','INDISPONIVEL','INDISPONÍVEL','BAIXADA','INATIVA']);
    sel.innerHTML='<option value="">Sem viatura vinculada</option>'+lista.map(v=>{
      const id=String(v.id??''),status=String(v.situacao_operacional||v.status||'ATIVA').toUpperCase(),ind=indisponiveis.has(status)&&id!==atual;
      const nome=[v.prefixo,v.placa,v.modelo].filter(Boolean).join(' · ')||`Viatura ${id}`;
      return `<option value="${gcmbsEsc(id)}" ${id===atual?'selected':''} ${ind?'disabled':''}>${gcmbsEsc(nome)}${status?` — ${gcmbsEsc(status)}`:''}</option>`;
    }).join('');
    if(atual&&[...sel.options].some(o=>o.value===atual))sel.value=atual;
  }catch(e){sel.innerHTML=`<option value="${gcmbsEsc(valor)}">${valor?'Viatura vinculada atual':'Não foi possível carregar viaturas'}</option>`;}
}
async function gcmbsCarregarValoresPostoEdicao(){
  if(!gcmbsPostoEditKey)return null;
  try{
    const b=await gcmbsApi('entity_list',{entity:'postos',limit:500,offset:0});
    const r=(b.records||[]).find(x=>String(x.record_key)===String(gcmbsPostoEditKey));return r?.data||null;
  }catch{return null;}
}
async function gcmbsAjustarFormularioPostos(){
  const {titulo,host,ok}=gcmbsFormContext(/Postos Operacionais/i);if(!ok)return;
  const novo=/^Novo\s+/i.test(titulo);if(novo)gcmbsPostoEditKey='';

  gcmbsTrocarRotulo(host,'quantidade_minima','Efetivo mínimo');gcmbsTrocarRotulo(host,'quantidade_maxima','Efetivo máximo');
  gcmbsTrocarRotulo(host,'horario_inicio','Horário inicial');gcmbsTrocarRotulo(host,'horario_fim','Horário final');gcmbsTrocarRotulo(host,'funcionamento_24h','Funcionamento 24h');

  const tipo=gcmbsCampo(host,'tipo');
  if(tipo&&tipo.tagName!=='SELECT'){
    const atual=String(tipo.value||'FIXO').toUpperCase(),sel=document.createElement('select');sel.dataset.onlineField='tipo';const ops=['FIXO','ADMINISTRATIVO','VIATURA'];if(atual&&!ops.includes(atual))ops.push(atual);
    sel.innerHTML=ops.map(x=>`<option value="${x}" ${x===atual?'selected':''}>${x==='FIXO'?'Posto fixo':x==='ADMINISTRATIVO'?'Administrativo':x==='VIATURA'?'Viatura / posto móvel':x}</option>`).join('');tipo.replaceWith(sel);
  }

  let sec=[...host.querySelectorAll('.form-section')].find(s=>String(s.querySelector('h3')?.textContent||'').trim()==='Recursos operacionais');
  if(!sec){sec=document.createElement('section');sec.className='form-section module-editor-section';sec.innerHTML='<h3>Recursos operacionais</h3><div class="form-grid"></div>';const obs=[...host.querySelectorAll('.form-section')].find(s=>String(s.querySelector('h3')?.textContent||'').trim()==='Observações');if(obs)host.insertBefore(sec,obs);else host.appendChild(sec);}
  const grid=sec.querySelector('.form-grid');

  if(!gcmbsCampo(host,'exige_motorista'))grid.appendChild(gcmbsCriarSelectBool('exige_motorista','Exige motorista','0'));
  if(!gcmbsCampo(host,'exige_viatura'))grid.appendChild(gcmbsCriarSelectBool('exige_viatura','Exige viatura','0'));
  if(!gcmbsCampo(host,'viatura_id'))grid.appendChild(gcmbsCriarSelectViatura(''));

  for(const n of ['exige_motorista','exige_viatura','viatura_id']){const lab=gcmbsLabel(host,n);if(lab&&lab.parentElement!==grid)grid.appendChild(lab);}
  gcmbsTrocarRotulo(host,'exige_motorista','Exige motorista');gcmbsTrocarRotulo(host,'exige_viatura','Exige viatura');gcmbsTrocarRotulo(host,'viatura_id','Viatura vinculada');

  let dados=null;
  if(!novo)dados=await gcmbsCarregarValoresPostoEdicao();
  const motor=gcmbsCampo(host,'exige_motorista'),exige=gcmbsCampo(host,'exige_viatura'),viatura=gcmbsCampo(host,'viatura_id');
  if(dados){if(motor)motor.value=Number(dados.exige_motorista||0)?'1':'0';if(exige)exige.value=Number(dados.exige_viatura||0)?'1':'0';if(viatura)viatura.dataset.valorAtual=String(dados.viatura_id??'');}
  if(novo){const ativo=gcmbsCampo(host,'ativo');if(ativo)ativo.value='1';const t=gcmbsCampo(host,'tipo');if(t)t.value='FIXO';if(motor)motor.value='0';if(exige)exige.value='0';if(viatura)viatura.dataset.valorAtual='';}

  await gcmbsPopularViaturasPosto(host,dados?.viatura_id??'');
  const atualiza=()=>{const ex=gcmbsCampo(host,'exige_viatura'),v=gcmbsCampo(host,'viatura_id');if(v)v.disabled=String(ex?.value||'0')!=='1';};
  exige?.addEventListener('change',atualiza);atualiza();

  for(const s of [...host.querySelectorAll('.form-section')])if(!s.querySelector('[data-online-field]'))s.remove();
}

async function gcmbsCarregarValoresTipoEscalaEdicao(){
  if(!gcmbsTipoEscalaEditKey)return null;
  try{
    // A API principal é usada apenas para recuperar fallbacks legados do próprio registro
    // (descricao / intervalo_inicio / intervalo_fim). Eles não viram campos funcionais.
    const b=await gcmbsApiDireto('entity_list',{entity:'tipos_escalas',limit:500,offset:0});
    const r=(b.records||[]).find(x=>String(x.record_key)===String(gcmbsTipoEscalaEditKey));return r?.data||null;
  }catch{return null;}
}
function gcmbsSelectTipoJornada(host,valor=''){
  const atualEl=gcmbsCampo(host,'tipo_escala');if(!atualEl)return null;
  const atual=String(valor??atualEl.value??'');
  let sel=atualEl;
  if(atualEl.tagName!=='SELECT'){
    sel=document.createElement('select');sel.dataset.onlineField='tipo_escala';atualEl.replaceWith(sel);
  }
  const ops=[
    ['','Selecione...'],['24x72','24x72'],['12x36','12x36'],['5x2','5x2'],['12h','12 horas'],['24h','24 horas'],['Dias úteis','Dias úteis'],['EXPEDIENTE','Expediente'],['outro','Outro']
  ];
  if(atual&&!ops.some(([v])=>v===atual))ops.push([atual,atual]);
  sel.innerHTML=ops.map(([v,l])=>`<option value="${gcmbsEsc(v)}" ${v===atual?'selected':''}>${gcmbsEsc(l)}</option>`).join('');
  return sel;
}
async function gcmbsAjustarFormularioTiposEscalas(){
  const {titulo,host,ok}=gcmbsFormContext(/Tipos de Escalas/i);if(!ok)return;
  const novo=/^Novo\s+/i.test(titulo);if(novo)gcmbsTipoEscalaEditKey='';
  const dados=novo?null:await gcmbsCarregarValoresTipoEscalaEdicao();

  // Contrato funcional Desktop 10.0.62: 11 campos. "jornada" continua interna e
  // será derivada no Desktop a partir de tipo_escala durante a sincronização.
  gcmbsLabel(host,'descricao')?.remove();
  gcmbsLabel(host,'jornada')?.remove();
  for(const n of ['intervalo_inicio','intervalo_fim','cor'])gcmbsLabel(host,n)?.remove();

  const secTipo=gcmbsSecao(host,'Tipo de escala'),secHorario=gcmbsSecao(host,'Horários'),secIntervalos=gcmbsSecao(host,'Intervalos'),secObs=gcmbsSecao(host,'Observações');
  const gTipo=secTipo.querySelector('.form-grid'),gHorario=secHorario.querySelector('.form-grid'),gInt=secIntervalos.querySelector('.form-grid'),gObs=secObs.querySelector('.form-grid');

  const nome=gcmbsMoverCampo(host,'nome',gTipo,'Nome / Sigla');
  const tipo=gcmbsMoverCampo(host,'tipo_escala',gTipo,'Tipo de Jornada');
  const categoria=gcmbsMoverCampo(host,'categoria',gTipo,'Categoria');
  const ativo=gcmbsMoverCampo(host,'ativo',gTipo,'Ativo');
  for(const n of ['hora_inicio','hora_fim'])gcmbsMoverCampo(host,n,gHorario,n==='hora_inicio'?'Horário inicial':'Horário final');
  for(const [n,l] of [['intervalo1_inicio','Intervalo 1 · início'],['intervalo1_fim','Intervalo 1 · fim'],['intervalo2_inicio','Intervalo 2 · início'],['intervalo2_fim','Intervalo 2 · fim']])gcmbsMoverCampo(host,n,gInt,l);
  const observacao=gcmbsMoverCampo(host,'observacao',gObs,'Observações');

  const tipoValor=String(dados?.tipo_escala||dados?.jornada||tipo?.value||'');
  const tipoSel=gcmbsSelectTipoJornada(host,tipoValor);
  if(nome)nome.required=true;if(tipoSel)tipoSel.required=true;if(categoria)categoria.required=true;
  for(const n of ['hora_inicio','hora_fim','intervalo1_inicio','intervalo1_fim','intervalo2_inicio','intervalo2_fim']){
    const el=gcmbsCampo(host,n);if(el){el.type='time';el.value=String(el.value||'').slice(0,5);}
  }
  if(observacao&&observacao.tagName!=='TEXTAREA'){
    const ta=document.createElement('textarea');ta.dataset.onlineField='observacao';ta.value=String(observacao.value||'');observacao.replaceWith(ta);
  }
  const obsLab=gcmbsLabel(host,'observacao');if(obsLab)obsLab.classList.add('full');

  if(dados){
    const vals={
      nome:dados.nome??'',tipo_escala:dados.tipo_escala||dados.jornada||'',categoria:dados.categoria??'',
      ativo:['0','NAO','NÃO','FALSE','INATIVO'].includes(String(dados.ativo??'1').toUpperCase())?'0':'1',
      hora_inicio:dados.hora_inicio??'',hora_fim:dados.hora_fim??'',
      intervalo1_inicio:dados.intervalo1_inicio||dados.intervalo_inicio||'',intervalo1_fim:dados.intervalo1_fim||dados.intervalo_fim||'',
      intervalo2_inicio:dados.intervalo2_inicio||'',intervalo2_fim:dados.intervalo2_fim||'',
      observacao:dados.observacao||dados.descricao||''
    };
    for(const [n,v] of Object.entries(vals)){const el=gcmbsCampo(host,n);if(el)el.value=String(v??'');}
    gcmbsSelectTipoJornada(host,vals.tipo_escala);
  }else{
    if(ativo)ativo.value='1';
    if(tipoSel)tipoSel.value='';
  }

  const controlarIntervalo2=()=>{
    const mostrar=String(gcmbsCampo(host,'tipo_escala')?.value||'').toLowerCase()==='24x72';
    for(const n of ['intervalo2_inicio','intervalo2_fim']){const lab=gcmbsLabel(host,n);if(lab)lab.style.display=mostrar?'':'none';}
  };
  gcmbsCampo(host,'tipo_escala')?.addEventListener('change',controlarIntervalo2);controlarIntervalo2();

  // Reordena seções para seguir o formulário real do Desktop.
  for(const s of [secTipo,secHorario,secIntervalos,secObs])host.appendChild(s);
  for(const s of [...host.querySelectorAll('.form-section')])if(!s.querySelector('[data-online-field]'))s.remove();
}

function gcmbsAjustarFormulariosParidade(){
  gcmbsAjustarFormularioGuardas();
  gcmbsAjustarFormularioEquipes();
  void gcmbsAjustarFormularioPostos();
  void gcmbsAjustarFormularioTiposEscalas();
}

if(!window.__gcmbsFormParity){
  window.__gcmbsFormParity=true;
  const proto=window.HTMLDialogElement?.prototype;
  if(proto&&typeof proto.showModal==='function'){
    const nativeShowModal=proto.showModal;
    proto.showModal=function(...args){const r=nativeShowModal.apply(this,args);if(this.id==='onlineEditor')queueMicrotask(gcmbsAjustarFormulariosParidade);return r;};
  }
}

console.info('[GCMBS] proteção anti-loop, baixa pressão e paridade Guardas/Equipes/Postos/Tipos de Escalas ativas');