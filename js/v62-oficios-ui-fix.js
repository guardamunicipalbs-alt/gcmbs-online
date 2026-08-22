// GCMBS 10.0.62 — paridade de Ofícios com o Desktop e proteção contra filtros herdados.
const OFC62_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const ofc62$=id=>document.getElementById(id);
const ofc62Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ofc62Busy=false,ofc62RenderBusy=false,ofc62NeedsFilterClear=false,ofc62WasActive=false,ofc62Records=new Map(),ofc62RecordsLoaded=false,ofc62RecordsLoading=false;

async function ofc62Api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(OFC62_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function ofc62Ativo(){return String(ofc62$('onlineTitulo')?.textContent||'').trim()==='Ofícios';}
function ofc62Campo(nome){return document.querySelector(`[data-online-field="${nome}"]`);}
function ofc62Label(nome){return ofc62Campo(nome)?.closest('label');}
function ofc62TextoLabel(label,texto){
  if(!label)return;const desejado=texto+' ';const txt=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());
  if(txt){if(txt.nodeValue!==desejado)txt.nodeValue=desejado;return;}
  let s=label.querySelector(':scope > span');if(!s){s=document.createElement('span');label.insertBefore(s,label.firstChild);}if(s.textContent!==texto)s.textContent=texto;
}
function ofc62ClearInheritedFilter(){
  if(!ofc62Ativo()||!ofc62NeedsFilterClear)return;ofc62NeedsFilterClear=false;
  const f=ofc62$('onlineFiltro');if(f&&f.value){f.value='';f.dispatchEvent(new Event('input',{bubbles:true}));}
}
function ofc62AjustarDescricao(){
  const nova='Registro e consulta das demandas encaminhadas à instituição.';
  const desc=ofc62$('onlineDescricao');if(desc&&desc.textContent!==nova)desc.textContent=nova;
}
function ofc62RemoverCampoArquivoNome(){
  const campo=ofc62Campo('arquivo_nome');if(!campo)return;const label=campo.closest('label');if(label)label.remove();
}
function ofc62NormalizarEditor(){
  if(!ofc62Ativo())return;const dlg=ofc62$('onlineEditor');if(!dlg?.open)return;
  const titulo=ofc62$('onlineEditorTitulo');if(titulo&&titulo.textContent!=='Novo Ofício')titulo.textContent='Novo Ofício';
  const numero=ofc62Campo('numero_oficio'),data=ofc62Campo('data_demanda'),demanda=ofc62Campo('demanda');
  if(numero&&!numero.required)numero.required=true;if(data&&!data.required)data.required=true;
  const ph='Apresente uma descrição detalhada da demanda, incluindo informações relevantes e eventuais particularidades do evento.';
  if(demanda){if(!demanda.required)demanda.required=true;if(demanda.placeholder!==ph)demanda.placeholder=ph;}
  ofc62TextoLabel(ofc62Label('numero_oficio'),'Número do ofício');
  ofc62TextoLabel(ofc62Label('data_recebimento'),'Data de Recebimento do Ofício');
  ofc62TextoLabel(ofc62Label('instituicao_solicitante'),'Unidade/Instituição Solicitante');
  ofc62TextoLabel(ofc62Label('responsavel_solicitacao'),'Responsável Pela Solicitação');
  ofc62TextoLabel(ofc62Label('cargo_solicitante'),'Cargo que Ocupa');
  ofc62TextoLabel(ofc62Label('telefone_solicitante'),'Telefone do Solicitante ou Instituição');
  ofc62TextoLabel(ofc62Label('horario_termino_previsto'),'Horário Previsto de Término');
  ofc62TextoLabel(ofc62Label('demanda'),'Demanda a ser Atendida');
  ofc62RemoverCampoArquivoNome();
  const campos=ofc62$('onlineCampos');if(campos&&!campos.querySelector('#ofc62Arquivo')){
    const sec=document.createElement('section');sec.className='form-section module-editor-section';sec.dataset.ofc62Upload='1';
    sec.innerHTML='<h3>Arquivo do ofício</h3><div class="form-grid"><label class="full">Upload do Arquivo<input id="ofc62Arquivo" type="file" accept="image/jpeg,image/png,application/pdf"><small>JPG, PNG ou PDF, máximo 15 MB.</small></label></div>';
    campos.appendChild(sec);
  }
}
async function ofc62LerArquivo(){
  const f=ofc62$('ofc62Arquivo')?.files?.[0];if(!f)return{};
  if(!['image/jpeg','image/png','application/pdf'].includes(f.type))throw new Error(`${f.name}: formato não permitido. Use JPG, PNG ou PDF.`);
  if(f.size>15*1024*1024)throw new Error(`${f.name}: máximo 15 MB.`);
  const dados=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Falha ao ler o arquivo do ofício.'));r.readAsDataURL(f);});
  return {arquivo_nome:f.name,arquivo_tipo:f.type,arquivo_dados:dados};
}
function ofc62Valor(nome){return String(ofc62Campo(nome)?.value||'').trim();}
async function ofc62Salvar(e){
  const btn=e.target.closest?.('#onlineSalvar');if(!btn||!ofc62Ativo())return;
  e.preventDefault();e.stopImmediatePropagation();if(ofc62Busy)return;ofc62Busy=true;
  const msg=ofc62$('onlineMsg');if(msg)msg.textContent='Salvando ofício...';
  try{
    ofc62NormalizarEditor();
    const numero=ofc62Valor('numero_oficio'),dataDemanda=ofc62Valor('data_demanda'),demanda=ofc62Valor('demanda');
    if(!numero)throw new Error('Informe o Número do ofício.');
    if(!dataDemanda)throw new Error('Informe a Data da Demanda.');
    if(!demanda)throw new Error('Informe a Demanda a ser Atendida.');
    const d={
      numero_oficio:numero,
      data_recebimento:ofc62Valor('data_recebimento')||null,
      secretaria_municipal:ofc62Valor('secretaria_municipal'),
      outro:ofc62Valor('outro'),
      instituicao_solicitante:ofc62Valor('instituicao_solicitante'),
      responsavel_solicitacao:ofc62Valor('responsavel_solicitacao'),
      cargo_solicitante:ofc62Valor('cargo_solicitante'),
      telefone_solicitante:ofc62Valor('telefone_solicitante'),
      data_demanda:dataDemanda,
      local_demanda:ofc62Valor('local_demanda'),
      horario_inicio:ofc62Valor('horario_inicio'),
      horario_termino_previsto:ofc62Valor('horario_termino_previsto'),
      demanda,
      ...await ofc62LerArquivo()
    };
    await ofc62Api('entity_mutate',{entity:'oficios',record_key:'',operation:'UPSERT',data:d});
    if(msg)msg.textContent='Ofício registrado e enviado para sincronização.';
    ofc62$('onlineEditor')?.close();ofc62Records.clear();ofc62RecordsLoaded=false;
    setTimeout(()=>document.querySelector('#mainNav [data-module="operacoes_especiais"]')?.click(),180);
  }catch(err){if(msg)msg.textContent=err?.message||String(err);}finally{ofc62Busy=false;}
}
function ofc62SrcArquivo(d){
  const raw=String(d?.arquivo_dados||'');if(!raw)return'';if(raw.startsWith('data:'))return raw;
  const tipo=String(d?.arquivo_tipo||'application/octet-stream');return `data:${tipo};base64,${raw}`;
}
function ofc62AbrirArquivo(rec){
  const d=rec?.data||{},src=ofc62SrcArquivo(d);if(!src)return alert('Este ofício não possui arquivo anexado.');
  let dlg=ofc62$('ofc62Viewer');if(!dlg){
    dlg=document.createElement('dialog');dlg.id='ofc62Viewer';dlg.className='module-editor';
    dlg.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px"><strong id="ofc62ViewerTitle">Ofício</strong><button type="button" id="ofc62ViewerClose" class="secondary">Fechar</button></div><div id="ofc62ViewerBody" style="min-height:300px"></div>';
    document.body.appendChild(dlg);ofc62$('ofc62ViewerClose').onclick=()=>dlg.close();
  }
  const titulo=d.arquivo_nome||`Ofício ${d.numero_oficio||''}`.trim();if(ofc62$('ofc62ViewerTitle').textContent!==titulo)ofc62$('ofc62ViewerTitle').textContent=titulo;const body=ofc62$('ofc62ViewerBody');
  body.innerHTML=String(d.arquivo_tipo||'').toLowerCase()==='application/pdf'?`<iframe src="${ofc62Esc(src)}" title="Ofício" style="width:100%;height:min(72vh,760px);border:0"></iframe>`:`<img src="${ofc62Esc(src)}" alt="Ofício" style="display:block;max-width:100%;max-height:72vh;margin:auto">`;
  dlg.showModal();
}
async function ofc62CarregarRecords(){
  if(ofc62RecordsLoading||ofc62RecordsLoaded||!ofc62Ativo())return;ofc62RecordsLoading=true;
  try{const b=await ofc62Api('entity_list',{entity:'oficios',limit:5000,offset:0});ofc62Records=new Map((b.records||[]).map(r=>[String(r.record_key),r]));ofc62RecordsLoaded=true;ofc62AjustarCards();}catch{}finally{ofc62RecordsLoading=false;}
}
function ofc62AjustarCards(){
  if(!ofc62Ativo())return;const host=ofc62$('onlineRegistros');if(!host)return;
  host.querySelectorAll('[data-online-key]').forEach(card=>{
    // O Desktop oferece consulta/visualização do ofício; não expõe edição genérica do registro na listagem.
    card.querySelectorAll('[data-online-edit],[data-online-del]').forEach(b=>b.remove());
    const key=String(card.dataset.onlineKey||''),rec=ofc62Records.get(key);if(!ofc62SrcArquivo(rec?.data))return;
    let actions=card.querySelector('.online-record-actions');if(!actions){actions=document.createElement('div');actions.className='online-record-actions';card.appendChild(actions);}
    if(!actions.querySelector('[data-ofc62-doc]')){const b=document.createElement('button');b.type='button';b.className='mini';b.dataset.ofc62Doc=key;b.textContent='Visualizar arquivo';actions.appendChild(b);}
  });
}
function ofc62Run(){if(!ofc62Ativo())return;ofc62ClearInheritedFilter();ofc62AjustarDescricao();ofc62NormalizarEditor();ofc62AjustarCards();ofc62CarregarRecords();}
function ofc62Install(){
  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('#mainNav [data-module="operacoes_especiais"]');if(nav){ofc62NeedsFilterClear=true;ofc62Records.clear();ofc62RecordsLoaded=false;setTimeout(ofc62Run,450);}
    const doc=e.target.closest?.('[data-ofc62-doc]');if(doc){e.preventDefault();e.stopImmediatePropagation();ofc62AbrirArquivo(ofc62Records.get(String(doc.dataset.ofc62Doc)));return;}
    ofc62Salvar(e);
  },true);
  const root=ofc62$('appTela')||document.body;new MutationObserver(()=>{
    const ativo=ofc62Ativo();if(ativo&&!ofc62WasActive){ofc62NeedsFilterClear=true;ofc62Records.clear();ofc62RecordsLoaded=false;}
    ofc62WasActive=ativo;if(ofc62RenderBusy||!ativo)return;ofc62RenderBusy=true;requestAnimationFrame(()=>{ofc62RenderBusy=false;ofc62Run();});
  }).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open','required']});
  ofc62WasActive=ofc62Ativo();if(ofc62WasActive){ofc62NeedsFilterClear=true;ofc62Run();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ofc62Install,{once:true});else ofc62Install();
