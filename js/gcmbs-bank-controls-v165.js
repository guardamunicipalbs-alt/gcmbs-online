/* GCMBS Online V165 — controlador independente: reconstrói ações removidas/desativadas por versões legadas. */
(()=>{'use strict';
if(window.__GCMBS_BANK_CONTROLS_V165__)return;
window.__GCMBS_BANK_CONTROLS_V165__=true;
if(window.Capacitor?.isNativePlatform?.())return;
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const pending=new Set(['PENDENTE','PENDENTE_DESKTOP']);
const ongoing=new Set();
const $=(el,q)=>el?.querySelector(q);
const fmt=n=>{n=Math.abs(Math.round(Number(n)||0));return `${Math.floor(n/60)}h${String(n%60).padStart(2,'0')}`};
function css(){if(document.getElementById('gc165-style'))return;const s=document.createElement('style');s.id='gc165-style';s.textContent=`#listaBancoGestao .gc165-actions{display:flex;flex-wrap:wrap;gap:9px}#listaBancoGestao .gc165-actions button{min-height:44px;min-width:104px;cursor:pointer;pointer-events:auto!important;opacity:1!important}#listaBancoGestao [data-gc165-action="approve"],#listaBancoGestao [data-gc165-action="save"]{background:#166534;color:#fff;border:1px solid #166534}#listaBancoGestao [data-gc165-action="edit"]{background:#eaf3ff;color:#164b91;border:1px solid #8fb2e5}#listaBancoGestao .gc165-editor{display:grid;gap:10px;padding:12px;border-radius:12px;border:1px solid #bdd4ee;background:#f6faff}#listaBancoGestao .gc165-editor .gc165-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#listaBancoGestao .gc165-editor textarea{min-height:75px}#listaBancoGestao .gc165-feedback{margin-top:8px;padding:10px;border-radius:8px;background:#eef6ff;color:#194c7f;font-size:13px}#listaBancoGestao .gc165-feedback.error{background:#fff1f2;color:#9f1239}#listaBancoGestao [hidden]{display:none!important}@media(max-width:470px){#listaBancoGestao .gc165-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#listaBancoGestao .gc165-actions button{width:100%;min-width:0}#listaBancoGestao .gc165-editor .gc165-grid{grid-template-columns:1fr}}`;document.head.appendChild(s)}
function feedback(card,text,error=false){let el=$(card,'.gc165-feedback');if(!el){el=document.createElement('div');el.className='gc165-feedback';el.setAttribute('role','status');card.appendChild(el)}el.hidden=false;el.classList.toggle('error',error);el.textContent=text;}
function mount(){css();const root=document.getElementById('listaBancoGestao');if(!root)return;
root.querySelectorAll('.record-card').forEach(card=>{
 if(card.dataset.gc165Ready==='1')return;
 const review=$(card,'.command-review');if(!review)return;
 const hours=$(review,'[data-bh-hours]'),level=$(review,'[data-bh-class]');if(!hours||!level)return;
 const id=Number(hours.dataset.bhHours),st=String($(card,'.status-pill')?.textContent||'').trim().toUpperCase();
 if(!Number.isSafeInteger(id)||id<1||!pending.has(st))return;
 const minutes=Number(card.dataset.gc164Minutes||card.dataset.gc163OriginalMinutes||Math.round(Number(hours.value)*60));
 const classe=String(card.dataset.gc164Class||card.dataset.gc163OriginalClass||level.value);
 let actions=$(review,'.request-actions');if(!actions){actions=document.createElement('div');actions.className='request-actions full';review.appendChild(actions)}
 // Substitui o conteúdo antigo, inclusive botões que scripts anteriores removeram ou deixaram desabilitados.
 actions.replaceChildren();actions.className='request-actions full gc165-actions';
 for(const [act,text] of [['approve','Aprovar'],['edit','Corrigir / editar'],['reject','Recusar']]){const b=document.createElement('button');b.type='button';b.className='mini';b.dataset.gc165Action=act;b.dataset.gc165Id=String(id);b.textContent=text;b.disabled=false;b.removeAttribute('aria-disabled');b.style.display='';actions.appendChild(b)}
 review.querySelectorAll('.gc163-editor,.gc164-editor,.gc163-summary,.gc164-summary,.gc163-feedback,.gc164-feedback').forEach(el=>el.remove());
 hours.disabled=true;level.disabled=true;hours.closest('label')?.setAttribute('hidden','');level.closest('label')?.setAttribute('hidden','');
 const summary=document.createElement('div');summary.className='full';summary.dataset.gc165Summary='';summary.textContent=`Pedido original: ${fmt(minutes)} · ${classe}%. Aprovar mantém esses valores; Corrigir abre a edição.`;
 review.insertBefore(summary,actions);
 const editor=document.createElement('div');editor.className='gc165-editor full';editor.hidden=true;editor.innerHTML=`<strong>Editar solicitação #${id}</strong><div class="gc165-grid"><label>Horas<input data-gc165-hours type="number" min="0.5" max="200" step="0.5"></label><label>Classificação<select data-gc165-class><option value="50">50%</option><option value="100">100%</option></select></label></div><label>Justificativa obrigatória<textarea data-gc165-reason maxlength="800" placeholder="Explique a alteração realizada."></textarea></label><div class="gc165-actions"><button type="button" class="mini" data-gc165-action="save" data-gc165-id="${id}">Salvar correção e aprovar</button><button type="button" class="mini" data-gc165-action="cancel" data-gc165-id="${id}">Cancelar</button></div>`;
 review.appendChild(editor);
 $(editor,'[data-gc165-hours]').value=String(minutes/60);$(editor,'[data-gc165-class]').value=classe;
 card.dataset.gc165Id=String(id);card.dataset.gc165Minutes=String(minutes);card.dataset.gc165Class=classe;card.dataset.gc165Ready='1';
 if(!Number.isSafeInteger(minutes)||minutes<30||minutes%30!==0||!['50','100'].includes(classe)){actions.querySelectorAll('button').forEach(b=>b.disabled=true);feedback(card,`Solicitação #${id}: dados de horas ou classe inconsistentes. Conferir antes de decidir.`,true)}
});}
function edit(card,on){const ed=$(card,'.gc165-editor'),actions=$(card,'.request-actions'),summary=$(card,'[data-gc165-summary]');if(!ed||!actions)return;
 ed.hidden=!on;actions.hidden=on;if(summary)summary.hidden=on;
 if(on){$(ed,'[data-gc165-hours]').value=String(Number(card.dataset.gc165Minutes)/60);$(ed,'[data-gc165-class]').value=card.dataset.gc165Class;$(ed,'[data-gc165-reason]').value='';$(ed,'[data-gc165-hours]').focus()}
 const note=$(card,'.gc165-feedback');if(note)note.hidden=true;
}
async function call(slug,body){const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessão expirada. Entre novamente.');let response;
 try{response=await fetch(API+slug,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'})}catch{throw new Error('Falha de conexão. Consulte o estado da solicitação antes de repetir a ação.')}
 let result={};try{result=await response.json()}catch{}if(!response.ok||result.success!==true)throw new Error(result.message||`Ação não confirmada pelo servidor (HTTP ${response.status}).`);return result}
async function submit(card,id,kind){if(ongoing.has(id))return;const original=Number(card.dataset.gc165Minutes),originalClass=card.dataset.gc165Class;const ed=$(card,'.gc165-editor');let minutes=original,classe=originalClass,reason='';
 if(kind==='save'){
  const input=$(ed,'[data-gc165-hours]');minutes=Math.round(Number(input?.value)*60);classe=$(ed,'[data-gc165-class]')?.value||'';reason=String($(ed,'[data-gc165-reason]')?.value||'').trim();
  if(!input?.value||!Number.isSafeInteger(minutes)||minutes<30||minutes%30!==0||!['50','100'].includes(classe))return feedback(card,'Informe horas em blocos de 30 minutos e classificação de 50% ou 100%.',true);
  if(minutes===original&&classe===originalClass)return feedback(card,'Nenhuma alteração encontrada. Use Aprovar para manter o pedido original.',true);
  if(!reason)return feedback(card,'A justificativa da correção é obrigatória.',true);
 }
 let slug='gcmbs-bank-decide-v163',payload={action:'decide_bank_request',id,modo:kind==='save'?'CORRIGIR':'APROVAR',ajustes:{minutos_solicitados:minutes,classe,motivo:reason}};
 if(kind==='reject'){
  const v=window.prompt(`Motivo da recusa da solicitação #${id}:`,'');if(v===null)return;if(!v.trim())return feedback(card,'Informe o motivo da recusa.',true);
  if(!window.confirm(`Recusar solicitação #${id}?`))return;
  slug='gcmbs-bank-decide-v162';payload={action:'decide_bank_request',id,decisao:'RECUSADA',ajustes:{motivo:v.trim()}};
 }else if(!window.confirm(kind==='save'?`Corrigir #${id}: ${fmt(original)} (${originalClass}%) → ${fmt(minutes)} (${classe}%) e aprovar?\nMotivo: ${reason}`:`Aprovar #${id} sem alterar ${fmt(original)} (${originalClass}%)?`))return;
 ongoing.add(id);card.querySelectorAll('[data-gc165-action]').forEach(b=>b.disabled=true);feedback(card,'Enviando decisão ao servidor...');
 try{const result=await call(slug,payload);const r=$(card,'.command-review');if(r)r.remove();const pill=$(card,'.status-pill');if(pill)pill.textContent=kind==='reject'?'RECUSADA · ONLINE':kind==='save'?'CORRIGIDA E APROVADA · ONLINE':'APROVADA · ONLINE';feedback(card,result.message||'Decisão confirmada; crédito depende de conciliação.');window.dispatchEvent(new Event('gcmbs:v110-refresh'))}
 catch(e){feedback(card,String(e?.message||'Falha ao registrar decisão.'),true)}
 finally{ongoing.delete(id);if(card.isConnected&&$(card,'.command-review'))card.querySelectorAll('[data-gc165-action]').forEach(b=>b.disabled=false)}
}
function boot(){mount();window.addEventListener('click',e=>{const b=e.target?.closest?.('[data-gc165-action]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const card=b.closest('.record-card'),kind=b.dataset.gc165Action,id=Number(b.dataset.gc165Id);if(!card||b.disabled||!Number.isSafeInteger(id)||id<1)return;
 if(kind==='edit')edit(card,true);else if(kind==='cancel')edit(card,false);else submit(card,id,kind);},true);
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount()})}).observe(document.documentElement,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();