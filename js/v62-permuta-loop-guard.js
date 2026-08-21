// GCMBS 10.0.62 — estabilização de carga Online.
// 1) Impede o observer auto-recursivo de Permutas.
// 2) Evita salto desnecessário por Edge Functions intermediárias quando a API v6
//    já possui exatamente a mesma rota, autenticação e CORS.
// 3) Reduz a atualização do status de sincronização de 15s para 60s.
// 4) Restaura a apresentação do Cadastro de Guardas ao contrato funcional de 24 campos.
// 5) Alinha Equipes aos 6 campos funcionais do Desktop e aos padrões operacionais.
// Não altera dados existentes ou Gerador de Escala.

const GCMBS_EDGE_BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const GCMBS_API_CORS=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6-cors';
const GCMBS_API_V6=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6';
const GCMBS_QUADRO_V62=GCMBS_EDGE_BASE+'gcmbs-quadro-v62';
const GCMBS_ACOES_EXCLUSIVAS_CORS=new Set([
  'entity_catalog',
  'entity_list',
  'entity_mutate',
  'frequency_services'
]);

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
    let destino=url;
    let action='';

    try{
      if(typeof init?.body==='string') action=String(JSON.parse(init.body||'{}')?.action||'').toLowerCase();
    }catch{}

    if(url===GCMBS_API_CORS && action && !GCMBS_ACOES_EXCLUSIVAS_CORS.has(action)){
      destino=GCMBS_API_V6;
    }else if(url===GCMBS_QUADRO_V62 && action==='quadro_operacional'){
      destino=GCMBS_API_V6;
    }

    return nativeFetch(destino,init);
  };
}

if(!window.__gcmbsLowPressureInterval){
  window.__gcmbsLowPressureInterval=true;
  const nativeSetInterval=window.setInterval.bind(window);
  window.setInterval=function(callback,delay,...args){
    const nome=typeof callback==='function'?String(callback.name||''):'';
    if(Number(delay)===15000 && nome==='atualizarBadge'){
      return nativeSetInterval(callback,60000,...args);
    }
    return nativeSetInterval(callback,delay,...args);
  };
}

function gcmbsAjustarFormularioGuardas(){
  const dialog=document.getElementById('onlineEditor');
  const titulo=String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
  const host=document.getElementById('onlineCampos');
  if(!dialog||!host||!dialog.open||!/Cadastro de Guardas/i.test(titulo))return;

  const secoes=[...host.querySelectorAll('.form-section')];
  const grid=(nome)=>secoes.find(s=>String(s.querySelector('h3')?.textContent||'').trim()===nome)?.querySelector('.form-grid')||null;
  const identificacao=grid('Identificação funcional');
  const pessoais=grid('Dados pessoais');
  const cnh=grid('CNH e autorizações');

  const rotulos={rg:'RG',cnh:'Número da CNH',categoria_cnh_validade:'Validade da CNH',pai:'Pai',mae:'Mãe',naturalidade:'Naturalidade',email:'E-mail',telefone:'Telefone'};
  const campo=(nome)=>host.querySelector(`[data-online-field="${nome}"]`);
  const label=(nome)=>campo(nome)?.closest('label')||null;
  const renomear=(nome)=>{
    const el=label(nome);if(!el)return;
    const txt=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
    if(txt)txt.nodeValue=rotulos[nome]||nome;
  };
  const mover=(nome,destino)=>{const el=label(nome);if(el&&destino)destino.appendChild(el);renomear(nome);};

  mover('rg',identificacao);
  for(const nome of ['pai','mae','naturalidade','email','telefone'])mover(nome,pessoais);
  for(const nome of ['cnh','categoria_cnh_validade'])mover(nome,cnh);

  const validade=campo('categoria_cnh_validade');
  if(validade){validade.type='date';validade.value=String(validade.value||'').slice(0,10);}
  const email=campo('email');if(email)email.type='email';
  const telefone=campo('telefone');if(telefone)telefone.type='tel';

  if(/^Novo\s+/i.test(titulo)){
    const status=campo('status');
    if(status&&(!String(status.value||'').trim()||String(status.value).toUpperCase()==='ATIVA'))status.value='ATIVO';
    for(const nome of ['disponivel_escala','pode_noite','pode_24h']){
      const el=campo(nome);if(el&&(!String(el.value||'').trim()||String(el.value)==='0'))el.value='1';
    }
  }

  for(const sec of [...host.querySelectorAll('.form-section')]){
    if(String(sec.querySelector('h3')?.textContent||'').trim()==='Outros dados' && !sec.querySelector('[data-online-field]'))sec.remove();
  }
}

function gcmbsAjustarFormularioEquipes(){
  const dialog=document.getElementById('onlineEditor');
  const titulo=String(document.getElementById('onlineEditorTitulo')?.textContent||'').trim();
  const host=document.getElementById('onlineCampos');
  if(!dialog||!host||!dialog.open||!(/Equipes/i.test(titulo)))return;

  const campo=(nome)=>host.querySelector(`[data-online-field="${nome}"]`);
  const label=(nome)=>campo(nome)?.closest('label')||null;
  const trocarRotulo=(nome,texto)=>{
    const el=label(nome);if(!el)return;
    const txt=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
    if(txt)txt.nodeValue=texto;
  };

  // modo_distribuicao é configuração interna do Desktop (MESMA_EQUIPE), não campo funcional.
  label('modo_distribuicao')?.remove();

  trocarRotulo('tipo_escala_id','Tipo de Escala');
  trocarRotulo('turno_inicio','Turno inicial');

  const turno=campo('turno_inicio');
  if(turno && turno.tagName!=='SELECT'){
    const atual=String(turno.value||'A').toUpperCase();
    const sel=document.createElement('select');
    sel.dataset.onlineField='turno_inicio';
    sel.innerHTML=`<option value="A" ${atual!=='B'?'selected':''}>A</option><option value="B" ${atual==='B'?'selected':''}>B</option>`;
    turno.replaceWith(sel);
  }

  const ciclo=campo('ciclo');
  if(ciclo){ciclo.min='1';ciclo.step='1';}

  const participa=campo('participa_gerador');
  if(participa){
    const atual=String(participa.value||'1');
    participa.innerHTML=`<option value="1" ${atual!=='0'?'selected':''}>Não</option><option value="0" ${atual==='0'?'selected':''}>Sim</option>`;
    trocarRotulo('participa_gerador','Equipe de Comando / Comandantes');
    const lab=participa.closest('label');
    if(lab&&!lab.querySelector('.gcmbs-equipe-comando-ajuda')){
      const small=document.createElement('small');
      small.className='gcmbs-equipe-comando-ajuda';
      small.textContent='Quando Sim, a equipe pode permanecer ativa, mas não participa da geração automática de escala.';
      lab.appendChild(small);
    }
  }

  if(/^Novo\s+/i.test(titulo)){
    const ativa=campo('ativa');if(ativa)ativa.value='1';
    const c=campo('ciclo');if(c&&!String(c.value||'').trim())c.value='1';
    const t=host.querySelector('[data-online-field="turno_inicio"]');if(t&&!String(t.value||'').trim())t.value='A';
    const p=campo('participa_gerador');if(p)p.value='1';
  }

  for(const sec of [...host.querySelectorAll('.form-section')]){
    if(!sec.querySelector('[data-online-field]'))sec.remove();
  }
}

function gcmbsAjustarFormulariosParidade(){
  gcmbsAjustarFormularioGuardas();
  gcmbsAjustarFormularioEquipes();
}

if(!window.__gcmbsFormParity){
  window.__gcmbsFormParity=true;
  const proto=window.HTMLDialogElement?.prototype;
  if(proto&&typeof proto.showModal==='function'){
    const nativeShowModal=proto.showModal;
    proto.showModal=function(...args){
      const r=nativeShowModal.apply(this,args);
      if(this.id==='onlineEditor')queueMicrotask(gcmbsAjustarFormulariosParidade);
      return r;
    };
  }
}

console.info('[GCMBS] proteção anti-loop, baixa pressão e paridade Guardas/Equipes ativas');
