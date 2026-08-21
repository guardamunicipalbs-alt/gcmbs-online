// GCMBS 10.0.62 — estabilização de carga Online.
// 1) Impede o observer auto-recursivo de Permutas.
// 2) Evita salto desnecessário por Edge Functions intermediárias quando a API v6
//    já possui exatamente a mesma rota, autenticação e CORS.
// 3) Reduz a atualização do status de sincronização de 15s para 60s.
// 4) Restaura Cadastro de Guardas ao contrato funcional de 24 campos.
// 5) Alinha Equipes aos 6 campos funcionais do Desktop.
// 6) Alinha Postos Operacionais aos 13 campos funcionais do Desktop.
// Não altera dados existentes ou Gerador de Escala.

const GCMBS_EDGE_BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const GCMBS_API_CORS=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6-cors';
const GCMBS_API_V6=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6';
const GCMBS_QUADRO_V62=GCMBS_EDGE_BASE+'gcmbs-quadro-v62';
const GCMBS_ACOES_EXCLUSIVAS_CORS=new Set(['entity_catalog','entity_list','entity_mutate','frequency_services']);

function gcmbsBloquearObserverRecursivoPermutas(){
  const host=document.getElementById('listaPermutasSolicitadas');
  if(!host)return false;
  if(!host.dataset.v62obs)host.dataset.v62obs='loop-guard';
  return true;
}
if(!gcmbsBloquearObserverRecursivoPermutas() && document.readyState==='loading'){
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

function gcmbsAjustarFormularioGuardas(){
  const dialog=document.getElementById('onlineEditor');
  const titulo=String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
  const host=document.getElementById('onlineCampos');
  if(!dialog||!host||!dialog.open||!/Cadastro de Guardas/i.test(titulo))return;
  const secoes=[...host.querySelectorAll('.form-section')];
  const grid=nome=>secoes.find(s=>String(s.querySelector('h3')?.textContent||'').trim()===nome)?.querySelector('.form-grid')||null;
  const identificacao=grid('Identificação funcional'),pessoais=grid('Dados pessoais'),cnh=grid('CNH e autorizações');
  const rotulos={rg:'RG',cnh:'Número da CNH',categoria_cnh_validade:'Validade da CNH',pai:'Pai',mae:'Mãe',naturalidade:'Naturalidade',email:'E-mail',telefone:'Telefone'};
  const campo=nome=>host.querySelector(`[data-online-field="${nome}"]`);
  const label=nome=>campo(nome)?.closest('label')||null;
  const renomear=nome=>{const el=label(nome);if(!el)return;const txt=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());if(txt)txt.nodeValue=rotulos[nome]||nome;};
  const mover=(nome,destino)=>{const el=label(nome);if(el&&destino)destino.appendChild(el);renomear(nome);};
  mover('rg',identificacao);
  for(const nome of ['pai','mae','naturalidade','email','telefone'])mover(nome,pessoais);
  for(const nome of ['cnh','categoria_cnh_validade'])mover(nome,cnh);
  const validade=campo('categoria_cnh_validade');if(validade){validade.type='date';validade.value=String(validade.value||'').slice(0,10);}
  const email=campo('email');if(email)email.type='email';
  const telefone=campo('telefone');if(telefone)telefone.type='tel';
  if(/^Novo\s+/i.test(titulo)){
    const status=campo('status');if(status&&(!String(status.value||'').trim()||String(status.value).toUpperCase()==='ATIVA'))status.value='ATIVO';
    for(const nome of ['disponivel_escala','pode_noite','pode_24h']){const el=campo(nome);if(el&&(!String(el.value||'').trim()||String(el.value)==='0'))el.value='1';}
  }
  for(const sec of [...host.querySelectorAll('.form-section')])if(String(sec.querySelector('h3')?.textContent||'').trim()==='Outros dados'&&!sec.querySelector('[data-online-field]'))sec.remove();
}

function gcmbsAjustarFormularioEquipes(){
  const dialog=document.getElementById('onlineEditor');
  const titulo=String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
  const host=document.getElementById('onlineCampos');
  if(!dialog||!host||!dialog.open||!/Equipes/i.test(titulo))return;
  const campo=nome=>host.querySelector(`[data-online-field="${nome}"]`);
  const label=nome=>campo(nome)?.closest('label')||null;
  const trocarRotulo=(nome,texto)=>{const el=label(nome);if(!el)return;const txt=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());if(txt)txt.nodeValue=texto;};
  label('modo_distribuicao')?.remove();
  trocarRotulo('tipo_escala_id','Tipo de Escala');trocarRotulo('turno_inicio','Turno inicial');
  const turno=campo('turno_inicio');
  if(turno&&turno.tagName!=='SELECT'){
    const atual=String(turno.value||'A').toUpperCase(),sel=document.createElement('select');sel.dataset.onlineField='turno_inicio';
    sel.innerHTML=`<option value="A" ${atual!=='B'?'selected':''}>A</option><option value="B" ${atual==='B'?'selected':''}>B</option>`;turno.replaceWith(sel);
  }
  const ciclo=campo('ciclo');if(ciclo){ciclo.min='1';ciclo.step='1';}
  const participa=campo('participa_gerador');
  if(participa){
    const atual=String(participa.value||'1');participa.innerHTML=`<option value="1" ${atual!=='0'?'selected':''}>Não</option><option value="0" ${atual==='0'?'selected':''}>Sim</option>`;
    trocarRotulo('participa_gerador','Equipe de Comando / Comandantes');
    const lab=participa.closest('label');if(lab&&!lab.querySelector('.gcmbs-equipe-comando-ajuda')){const small=document.createElement('small');small.className='gcmbs-equipe-comando-ajuda';small.textContent='Quando Sim, a equipe pode permanecer ativa, mas não participa da geração automática de escala.';lab.appendChild(small);}
  }
  if(/^Novo\s+/i.test(titulo)){
    const ativa=campo('ativa');if(ativa)ativa.value='1';
    const c=campo('ciclo');if(c&&!String(c.value||'').trim())c.value='1';
    const t=host.querySelector('[data-online-field="turno_inicio"]');if(t&&!String(t.value||'').trim())t.value='A';
    const p=campo('participa_gerador');if(p)p.value='1';
  }
  for(const sec of [...host.querySelectorAll('.form-section')])if(!sec.querySelector('[data-online-field]'))sec.remove();
}

function gcmbsAjustarFormularioPostos(){
  const dialog=document.getElementById('onlineEditor');
  const titulo=String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
  const host=document.getElementById('onlineCampos');
  if(!dialog||!host||!dialog.open||!/Postos Operacionais/i.test(titulo))return;
  const campo=nome=>host.querySelector(`[data-online-field="${nome}"]`);
  const label=nome=>campo(nome)?.closest('label')||null;
  const trocarRotulo=(nome,texto)=>{const el=label(nome);if(!el)return;const txt=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());if(txt)txt.nodeValue=texto;};

  trocarRotulo('quantidade_minima','Efetivo mínimo');trocarRotulo('quantidade_maxima','Efetivo máximo');
  trocarRotulo('horario_inicio','Horário inicial');trocarRotulo('horario_fim','Horário final');
  trocarRotulo('funcionamento_24h','Funcionamento 24h');trocarRotulo('exige_motorista','Exige motorista');
  trocarRotulo('exige_viatura','Exige viatura');trocarRotulo('viatura_id','Viatura vinculada');

  const tipo=campo('tipo');
  if(tipo&&tipo.tagName!=='SELECT'){
    const atual=String(tipo.value||'FIXO').toUpperCase(),sel=document.createElement('select');sel.dataset.onlineField='tipo';
    const opcoes=['FIXO','ADMINISTRATIVO','VIATURA'];
    if(atual&&!opcoes.includes(atual))opcoes.push(atual);
    sel.innerHTML=opcoes.map(x=>`<option value="${x}" ${x===atual?'selected':''}>${x==='FIXO'?'Posto fixo':x==='ADMINISTRATIVO'?'Administrativo':x==='VIATURA'?'Viatura / posto móvel':x}</option>`).join('');
    tipo.replaceWith(sel);
  }

  const exigeViatura=campo('exige_viatura');
  if(exigeViatura&&exigeViatura.tagName!=='SELECT'){
    const atual=['1','SIM','TRUE'].includes(String(exigeViatura.value||'0').toUpperCase()),sel=document.createElement('select');sel.dataset.onlineField='exige_viatura';
    sel.innerHTML=`<option value="0" ${!atual?'selected':''}>Não</option><option value="1" ${atual?'selected':''}>Sim</option>`;exigeViatura.replaceWith(sel);
  }

  let sec=[...host.querySelectorAll('.form-section')].find(s=>String(s.querySelector('h3')?.textContent||'').trim()==='Recursos operacionais');
  if(!sec){
    sec=document.createElement('section');sec.className='form-section';sec.innerHTML='<h3>Recursos operacionais</h3><div class="form-grid"></div>';
    const obs=[...host.querySelectorAll('.form-section')].find(s=>String(s.querySelector('h3')?.textContent||'').trim()==='Observações');
    if(obs)host.insertBefore(sec,obs);else host.appendChild(sec);
  }
  const grid=sec.querySelector('.form-grid');
  for(const nome of ['exige_motorista','exige_viatura','viatura_id']){const el=label(nome);if(el)grid.appendChild(el);}

  const atualizaViatura=()=>{const ex=host.querySelector('[data-online-field="exige_viatura"]'),v=campo('viatura_id');if(v)v.disabled=String(ex?.value||'0')!=='1';};
  host.querySelector('[data-online-field="exige_viatura"]')?.addEventListener('change',atualizaViatura);atualizaViatura();

  if(/^Novo\s+/i.test(titulo)){
    const ativo=campo('ativo');if(ativo)ativo.value='1';
    const t=host.querySelector('[data-online-field="tipo"]');if(t)t.value='FIXO';
    const em=campo('exige_motorista');if(em)em.value='0';
    const ev=host.querySelector('[data-online-field="exige_viatura"]');if(ev)ev.value='0';
    atualizaViatura();
  }
  for(const secao of [...host.querySelectorAll('.form-section')])if(!secao.querySelector('[data-online-field]'))secao.remove();
}

function gcmbsAjustarFormulariosParidade(){
  gcmbsAjustarFormularioGuardas();
  gcmbsAjustarFormularioEquipes();
  gcmbsAjustarFormularioPostos();
}

if(!window.__gcmbsFormParity){
  window.__gcmbsFormParity=true;
  const proto=window.HTMLDialogElement?.prototype;
  if(proto&&typeof proto.showModal==='function'){
    const nativeShowModal=proto.showModal;
    proto.showModal=function(...args){const r=nativeShowModal.apply(this,args);if(this.id==='onlineEditor')queueMicrotask(gcmbsAjustarFormulariosParidade);return r;};
  }
}

console.info('[GCMBS] proteção anti-loop, baixa pressão e paridade Guardas/Equipes/Postos ativas');
