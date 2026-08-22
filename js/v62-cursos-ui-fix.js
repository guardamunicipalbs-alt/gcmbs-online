// GCMBS 10.0.62 — paridade de Cursos e Habilitações com o Desktop.
const CUR62_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const cur62$=id=>document.getElementById(id);
const cur62Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cur62Busy=false,cur62RenderBusy=false,cur62NeedsFilterClear=false,cur62WasActive=false,cur62Records=new Map(),cur62RecordsLoading=false,cur62RecordsLoaded=false;

async function cur62Api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(CUR62_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function cur62Ativo(){return String(cur62$('onlineTitulo')?.textContent||'').trim()==='Cursos e Habilitações';}
function cur62Campo(nome){return document.querySelector(`[data-online-field="${nome}"]`);}
function cur62Label(nome){return cur62Campo(nome)?.closest('label');}
function cur62TextoLabel(label,texto){
  if(!label)return;const txt=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());
  if(txt)txt.nodeValue=texto+' ';else{let s=label.querySelector(':scope > span');if(!s){s=document.createElement('span');label.insertBefore(s,label.firstChild);}s.textContent=texto;}
}
function cur62ClearInheritedFilter(){
  if(!cur62Ativo()||!cur62NeedsFilterClear)return;cur62NeedsFilterClear=false;
  const f=cur62$('onlineFiltro');if(f&&f.value){f.value='';f.dispatchEvent(new Event('input',{bubbles:true}));}
}
function cur62AjustarDescricao(){
  const nova='Registro das capacitações e respectivos comprovantes para consulta posterior.';
  const desc=cur62$('onlineDescricao');if(desc)desc.textContent=nova;
  document.querySelectorAll('p').forEach(p=>{if(/Cursos e habilitações dos GCMs, incluindo início, conclusão, validade e comprovantes\./i.test(String(p.textContent||'').trim()))p.textContent=nova;});
}
function cur62FileInput(){return cur62$('onlineEditor')?.querySelector('input[type="file"]')||null;}
function cur62NormalizarEditor(){
  if(!cur62Ativo())return;const dlg=cur62$('onlineEditor');if(!dlg?.open)return;
  const titulo=cur62$('onlineEditorTitulo');if(titulo)titulo.textContent='Novo Curso / Habilitação';
  const guarda=cur62Campo('guarda_id'),curso=cur62Campo('curso');if(guarda)guarda.required=true;if(curso){curso.required=true;curso.placeholder='Informe o curso ou habilitação';}
  cur62TextoLabel(cur62Label('curso'),'Curso / habilitação');cur62TextoLabel(cur62Label('certificado'),'Certificado/Referência');
  const ativo=cur62Campo('ativo');if(ativo){ativo.value='1';const l=cur62Label('ativo');if(l)l.classList.add('hidden');}
  const file=cur62FileInput();if(file){
    file.accept='image/jpeg,image/png,application/pdf';file.removeAttribute('multiple');
    const label=file.closest('label')||file.parentElement;if(label&&!label.dataset.cur62Normalized){label.dataset.cur62Normalized='1';const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());if(text)text.nodeValue='Comprovante (JPG, PNG ou PDF) ';}
    if(!dlg.querySelector('[data-cur62-file-note]')){const note=document.createElement('small');note.dataset.cur62FileNote='1';note.className='muted';note.textContent='Máximo 12 MB. Deixe vazio quando não houver comprovante.';file.insertAdjacentElement('afterend',note);}
  }
}
async function cur62LerArquivo(){
  const file=cur62FileInput()?.files?.[0];if(!file)return{};
  if(!['image/jpeg','image/png','application/pdf'].includes(file.type))throw new Error(`${file.name}: formato não permitido. Use JPG, PNG ou PDF.`);
  if(file.size>12*1024*1024)throw new Error(`${file.name}: máximo 12 MB.`);
  const dados=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Falha ao ler o comprovante.'));r.readAsDataURL(file);});
  return {arquivo_nome:file.name,arquivo_tipo:file.type,arquivo_dados:dados};
}
async function cur62SessaoGuarda(){try{return Number((await cur62Api('session')).session?.guarda_id)||null}catch{return null}}
async function cur62Salvar(e){
  const btn=e.target.closest?.('#onlineSalvar');if(!btn||!cur62Ativo())return;
  e.preventDefault();e.stopImmediatePropagation();if(cur62Busy)return;cur62Busy=true;
  const msg=cur62$('onlineMsg');if(msg)msg.textContent='Salvando curso / habilitação...';
  try{
    cur62NormalizarEditor();
    let guardaId=cur62Campo('guarda_id')?.value?Number(cur62Campo('guarda_id').value):null;if(!guardaId)guardaId=await cur62SessaoGuarda();
    const curso=String(cur62Campo('curso')?.value||'').trim();if(!guardaId)throw new Error('Selecione o GCM.');if(!curso)throw new Error('Informe o curso / habilitação.');
    const d={guarda_id:guardaId,curso,instituicao:String(cur62Campo('instituicao')?.value||'').trim(),data_inicio:String(cur62Campo('data_inicio')?.value||'').trim()||null,data_conclusao:String(cur62Campo('data_conclusao')?.value||'').trim()||null,validade:String(cur62Campo('validade')?.value||'').trim()||null,certificado:String(cur62Campo('certificado')?.value||'').trim(),observacao:String(cur62Campo('observacao')?.value||'').trim(),ativo:1,...await cur62LerArquivo()};
    await cur62Api('entity_mutate',{entity:'cursos_habilitacoes',record_key:'',operation:'UPSERT',data:d});
    if(msg)msg.textContent='Curso / habilitação registrado e enviado para sincronização.';cur62$('onlineEditor')?.close();cur62Records.clear();cur62RecordsLoaded=false;setTimeout(()=>document.querySelector('#mainNav [data-module="cursos"]')?.click(),160);
  }catch(err){if(msg)msg.textContent=err?.message||String(err);}finally{cur62Busy=false;}
}
function cur62RemoverCampoCard(card,nome){
  const alvo=String(nome||'').trim().toLowerCase();card.querySelectorAll('.online-kv b').forEach(b=>{if(String(b.textContent||'').trim().toLowerCase()===alvo){const v=b.nextElementSibling;b.remove();v?.remove();}});
}
function cur62AbrirComprovante(rec){
  const d=rec?.data||{};if(!d.arquivo_dados)return alert('Este curso/habilitação não possui comprovante anexado.');
  let dlg=cur62$('cur62Viewer');if(!dlg){dlg=document.createElement('dialog');dlg.id='cur62Viewer';dlg.className='module-editor';dlg.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px"><strong id="cur62ViewerTitle">Comprovante</strong><button type="button" id="cur62ViewerClose" class="secondary">Fechar</button></div><div id="cur62ViewerBody" style="min-height:300px"></div>';document.body.appendChild(dlg);cur62$('cur62ViewerClose').onclick=()=>dlg.close();}
  cur62$('cur62ViewerTitle').textContent=d.arquivo_nome||'Comprovante';const body=cur62$('cur62ViewerBody');
  body.innerHTML=String(d.arquivo_tipo||'').toLowerCase()==='application/pdf'?`<iframe src="${cur62Esc(d.arquivo_dados)}" title="Comprovante" style="width:100%;height:min(70vh,720px);border:0"></iframe>`:`<img src="${cur62Esc(d.arquivo_dados)}" alt="Comprovante" style="display:block;max-width:100%;max-height:70vh;margin:auto">`;dlg.showModal();
}
async function cur62CarregarRecords(){
  if(cur62RecordsLoading||cur62RecordsLoaded||!cur62Ativo())return;cur62RecordsLoading=true;
  try{const b=await cur62Api('entity_list',{entity:'cursos_habilitacoes',limit:5000,offset:0});cur62Records=new Map((b.records||[]).map(r=>[String(r.record_key),r]));cur62AjustarCards();}catch{}finally{cur62RecordsLoading=false;cur62RecordsLoaded=true;}
}
function cur62AjustarCards(){
  if(!cur62Ativo())return;const host=cur62$('onlineRegistros');if(!host)return;
  host.querySelectorAll('[data-online-key]').forEach(card=>{
    cur62RemoverCampoCard(card,'Ativo');cur62RemoverCampoCard(card,'Documento');cur62RemoverCampoCard(card,'Tipo do documento');cur62RemoverCampoCard(card,'Arquivo');
    card.querySelectorAll('[data-online-edit]').forEach(b=>b.remove());
    const key=String(card.dataset.onlineKey||''),rec=cur62Records.get(key);let actions=card.querySelector('.online-record-actions');
    if(rec?.data?.arquivo_dados){if(!actions){actions=document.createElement('div');actions.className='online-record-actions';card.appendChild(actions);}if(!actions.querySelector('[data-cur62-doc]')){const b=document.createElement('button');b.type='button';b.className='mini';b.dataset.cur62Doc=key;b.textContent='Visualizar comprovante';actions.insertBefore(b,actions.firstChild);}}
  });
}
function cur62Run(){if(!cur62Ativo())return;cur62ClearInheritedFilter();cur62AjustarDescricao();cur62NormalizarEditor();cur62AjustarCards();if(!cur62RecordsLoaded)cur62CarregarRecords();}
function cur62Install(){
  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('#mainNav [data-module="cursos"]');if(nav){cur62NeedsFilterClear=true;cur62Records.clear();cur62RecordsLoaded=false;setTimeout(cur62Run,450);}
    const doc=e.target.closest?.('[data-cur62-doc]');if(doc){e.preventDefault();e.stopImmediatePropagation();cur62AbrirComprovante(cur62Records.get(String(doc.dataset.cur62Doc)));return;}
    cur62Salvar(e);
  },true);
  const root=cur62$('appTela')||document.body;new MutationObserver(()=>{const ativo=cur62Ativo();if(ativo&&!cur62WasActive){cur62NeedsFilterClear=true;cur62Records.clear();cur62RecordsLoaded=false;}cur62WasActive=ativo;if(cur62RenderBusy||!ativo)return;cur62RenderBusy=true;requestAnimationFrame(()=>{cur62RenderBusy=false;cur62Run();});}).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open','disabled','required']});
  cur62WasActive=cur62Ativo();if(cur62WasActive){cur62NeedsFilterClear=true;cur62RecordsLoaded=false;cur62Run();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cur62Install,{once:true});else cur62Install();
