// GCMBS 10.0.62 — estabilização e paridade Online/App.
// Mantém o Desktop como referência funcional sem alterar dados existentes.

const GCMBS_EDGE_BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const GCMBS_API_CORS=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6-cors';
const GCMBS_API_V6=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6';
const GCMBS_QUADRO_V62=GCMBS_EDGE_BASE+'gcmbs-quadro-v62';
const GCMBS_ACOES_EXCLUSIVAS_CORS=new Set(['entity_catalog','entity_list','entity_mutate','frequency_services']);
let gcmbsPostoEditKey='';

function gcmbsEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// Guarda a chave do registro antes de o app-core abrir o editor.
document.addEventListener('click',e=>{
  const edit=e.target?.closest?.('[data-online-edit]');
  if(edit)gcmbsPostoEditKey=String(edit.dataset.onlineEdit||'');
  if(e.target?.closest?.('#onlineNovo'))gcmbsPostoEditKey='';
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

async function gcmbsApi(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  const r=await fetch(GCMBS_API_CORS,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

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
async function gcmbsCarregarValoresPostoEdicao(host){
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
  if(!novo)dados=await gcmbsCarregarValoresPostoEdicao(host);
  const motor=gcmbsCampo(host,'exige_motorista'),exige=gcmbsCampo(host,'exige_viatura'),viatura=gcmbsCampo(host,'viatura_id');
  if(dados){if(motor)motor.value=Number(dados.exige_motorista||0)?'1':'0';if(exige)exige.value=Number(dados.exige_viatura||0)?'1':'0';if(viatura)viatura.dataset.valorAtual=String(dados.viatura_id??'');}
  if(novo){const ativo=gcmbsCampo(host,'ativo');if(ativo)ativo.value='1';const t=gcmbsCampo(host,'tipo');if(t)t.value='FIXO';if(motor)motor.value='0';if(exige)exige.value='0';if(viatura)viatura.dataset.valorAtual='';}

  await gcmbsPopularViaturasPosto(host,dados?.viatura_id??'');
  const atualiza=()=>{const ex=gcmbsCampo(host,'exige_viatura'),v=gcmbsCampo(host,'viatura_id');if(v)v.disabled=String(ex?.value||'0')!=='1';};
  exige?.addEventListener('change',atualiza);atualiza();

  for(const s of [...host.querySelectorAll('.form-section')])if(!s.querySelector('[data-online-field]'))s.remove();
}

function gcmbsAjustarFormulariosParidade(){
  gcmbsAjustarFormularioGuardas();
  gcmbsAjustarFormularioEquipes();
  void gcmbsAjustarFormularioPostos();
}

if(!window.__gcmbsFormParity){
  window.__gcmbsFormParity=true;
  const proto=window.HTMLDialogElement?.prototype;
  if(proto&&typeof proto.showModal==='function'){
    const nativeShowModal=proto.showModal;
    proto.showModal=function(...args){const r=nativeShowModal.apply(this,args);if(this.id==='onlineEditor')queueMicrotask(gcmbsAjustarFormulariosParidade);return r;};
  }
}

console.info('[GCMBS] proteção anti-loop, baixa pressão e paridade Guardas/Equipes/Postos 13 campos ativas');
