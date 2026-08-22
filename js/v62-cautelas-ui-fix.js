// GCMBS 10.0.62 — paridade de Equipamentos e Cautelas com o Desktop.
const CAUT62_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const caut62$=id=>document.getElementById(id);
const caut62Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const caut62Hoje=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
let caut62Busy=false,caut62RenderBusy=false;

async function caut62Api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(CAUT62_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function caut62Ativo(){return String(caut62$('onlineTitulo')?.textContent||'').trim()==='Equipamentos e Cautelas';}
function caut62Campo(nome){return document.querySelector(`[data-online-field="${nome}"]`);}
function caut62Label(nome){return caut62Campo(nome)?.closest('label');}
function caut62TextoLabel(label,texto){
  if(!label)return;const txt=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());if(txt)txt.nodeValue=texto+' ';else{let s=label.querySelector(':scope > span');if(!s){s=document.createElement('span');label.insertBefore(s,label.firstChild);}s.textContent=texto;}
}
function caut62ClearInheritedFilter(){
  if(!caut62Ativo())return;const f=caut62$('onlineFiltro');if(f&&f.value){f.value='';f.dispatchEvent(new Event('input',{bubbles:true}));}
}
function caut62NormalizarEditor(){
  if(!caut62Ativo())return;const dlg=caut62$('onlineEditor');if(!dlg?.open)return;
  const titulo=caut62$('onlineEditorTitulo');if(titulo)titulo.textContent='Nova Cautela';
  const equipamento=caut62Campo('equipamento');if(equipamento){equipamento.required=true;equipamento.placeholder='Informe o equipamento';}
  const modalidade=caut62Campo('modalidade_uso');if(modalidade){
    const atual=String(modalidade.value||'INDIVIDUAL').toUpperCase();
    modalidade.innerHTML='<option value="INDIVIDUAL">Individual</option><option value="COMUM">Uso comum / compartilhado</option>';
    modalidade.value=atual==='COMUM'?'COMUM':'INDIVIDUAL';
  }
  const guarda=caut62Campo('guarda_id'),viatura=caut62Campo('viatura_id');
  if(guarda){guarda.disabled=false;guarda.required=false;}if(viatura){viatura.disabled=false;viatura.required=false;}
  const entrega=caut62Campo('data_entrega');if(entrega&&!entrega.value)entrega.value=caut62Hoje();
  const situacao=caut62Campo('situacao');if(situacao){situacao.value='CAUTELADO';situacao.disabled=true;caut62Label('situacao')?.classList.add('hidden');}
  const devolucao=caut62Campo('data_devolucao');if(devolucao){devolucao.value='';devolucao.disabled=true;caut62Label('data_devolucao')?.classList.add('hidden');}
  caut62TextoLabel(caut62Label('patrimonio'),'Patrimônio/Série');
  caut62TextoLabel(caut62Label('data_entrega'),'Data de entrega');
  if(!caut62$('caut62ResponsabilidadeInfo')){
    const sec=guarda?.closest('.form-section')||guarda?.closest('section');
    if(sec){const p=document.createElement('p');p.id='caut62ResponsabilidadeInfo';p.className='muted';p.textContent='Vincule ao GCM e/ou à viatura conforme o equipamento. A modalidade de uso é Individual ou Uso comum / compartilhado, como no Desktop.';sec.querySelector('h3')?.insertAdjacentElement('afterend',p);}
  }
  const desc=caut62$('onlineDescricao');if(desc)desc.textContent='Controle de equipamentos vinculados a GCMs ou viaturas.';
}
function caut62SituacaoDoCard(card){
  const labels=[...card.querySelectorAll('.online-kv b')];for(const b of labels){if(String(b.textContent||'').trim().toLowerCase()==='situação')return String(b.nextElementSibling?.textContent||'').trim().toUpperCase();}return'';
}
function caut62AjustarAcoes(){
  if(!caut62Ativo())return;const host=caut62$('onlineRegistros');if(!host)return;
  host.querySelectorAll('[data-online-key]').forEach(card=>{
    card.querySelectorAll('[data-online-edit],[data-online-del]').forEach(b=>b.remove());
    const situacao=caut62SituacaoDoCard(card);if(situacao==='DEVOLVIDO')return;
    let actions=card.querySelector('.online-record-actions');if(!actions){actions=document.createElement('div');actions.className='online-record-actions';card.appendChild(actions);}
    if(!actions.querySelector('[data-caut62-return]')){const b=document.createElement('button');b.type='button';b.className='mini';b.dataset.caut62Return=card.dataset.onlineKey;b.textContent='Devolver';actions.appendChild(b);}
  });
}
async function caut62Salvar(e){
  const b=e.target.closest?.('#onlineSalvar');if(!b||!caut62Ativo())return;
  e.preventDefault();e.stopImmediatePropagation();if(caut62Busy)return;caut62Busy=true;
  const msg=caut62$('onlineMsg');if(msg)msg.textContent='Salvando cautela...';
  try{
    caut62NormalizarEditor();const equipamento=String(caut62Campo('equipamento')?.value||'').trim();if(!equipamento)throw new Error('Informe o equipamento.');
    const modalidade=String(caut62Campo('modalidade_uso')?.value||'INDIVIDUAL').toUpperCase();if(!['INDIVIDUAL','COMUM'].includes(modalidade))throw new Error('Selecione Individual ou Uso comum / compartilhado.');
    const entrega=String(caut62Campo('data_entrega')?.value||'').trim()||caut62Hoje();
    const d={equipamento,patrimonio:String(caut62Campo('patrimonio')?.value||'').trim(),tipo:String(caut62Campo('tipo')?.value||'').trim(),modalidade_uso:modalidade,guarda_id:caut62Campo('guarda_id')?.value?Number(caut62Campo('guarda_id').value):null,viatura_id:caut62Campo('viatura_id')?.value?Number(caut62Campo('viatura_id').value):null,data_entrega:entrega,data_devolucao:null,situacao:'CAUTELADO',observacao:String(caut62Campo('observacao')?.value||'').trim()};
    await caut62Api('entity_mutate',{entity:'equipamentos_cautelas',record_key:'',operation:'UPSERT',data:d});
    if(msg)msg.textContent='Cautela registrada e enviada para sincronização.';caut62$('onlineEditor')?.close();setTimeout(()=>document.querySelector('#mainNav [data-module="cautelas"]')?.click(),160);
  }catch(err){if(msg)msg.textContent=err?.message||String(err);}finally{caut62Busy=false;}
}
async function caut62Devolver(key){
  if(caut62Busy)return;const data=prompt('Data da devolução (AAAA-MM-DD):',caut62Hoje());if(!data)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return alert('Informe a data no formato AAAA-MM-DD.');
  caut62Busy=true;try{const resp=await caut62Api('entity_list',{entity:'equipamentos_cautelas',limit:5000,offset:0}),rec=(resp.records||[]).find(r=>String(r.record_key)===String(key));if(!rec)throw new Error('Cautela não encontrada na réplica atual.');const d={...(rec.data||{}),data_devolucao:data,situacao:'DEVOLVIDO'};await caut62Api('entity_mutate',{entity:'equipamentos_cautelas',record_key:String(key),operation:'UPSERT',data:d});setTimeout(()=>document.querySelector('#mainNav [data-module="cautelas"]')?.click(),160);}catch(err){alert(err?.message||String(err));}finally{caut62Busy=false;}
}
function caut62Run(){if(!caut62Ativo())return;caut62ClearInheritedFilter();caut62NormalizarEditor();caut62AjustarAcoes();const desc=caut62$('onlineDescricao');if(desc)desc.textContent='Controle de equipamentos vinculados a GCMs ou viaturas.';}
function caut62Install(){
  document.addEventListener('click',e=>{const nav=e.target.closest?.('#mainNav [data-module="cautelas"]');if(nav)setTimeout(caut62Run,500);const ret=e.target.closest?.('[data-caut62-return]');if(ret){e.preventDefault();e.stopImmediatePropagation();caut62Devolver(ret.dataset.caut62Return);return;}caut62Salvar(e);},true);
  const root=caut62$('appTela')||document.body;new MutationObserver(()=>{if(caut62RenderBusy||!caut62Ativo())return;caut62RenderBusy=true;requestAnimationFrame(()=>{caut62RenderBusy=false;caut62Run();});}).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open']});
  if(caut62Ativo())caut62Run();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',caut62Install,{once:true});else caut62Install();
