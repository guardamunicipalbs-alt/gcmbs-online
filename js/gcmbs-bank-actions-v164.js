/* GCMBS Online V164: acoes do Banco de Horas isoladas dos interceptadores legados. */
(()=>{'use strict';
if(window.__GCMBS_BANK_ACTIONS_V164__)return;window.__GCMBS_BANK_ACTIONS_V164__=true;
if(window.Capacitor?.isNativePlatform?.())return;
const APPROVE_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-bank-decide-v163';
const REJECT_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-bank-decide-v162';
const select=(root,selector)=>root?.querySelector(selector);
const time=m=>{m=Math.round(Number(m)||0);return `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`};
const actionSelector='[data-gc164-approve],[data-gc164-edit],[data-gc164-confirm],[data-gc164-cancel],[data-gc164-no]';
const working=new Set();
function css(){if(document.getElementById('gc164-style'))return;const s=document.createElement('style');s.id='gc164-style';s.textContent=`#listaBancoGestao .gc164-actions{display:flex;flex-wrap:wrap;gap:8px}#listaBancoGestao .gc164-actions button{min-height:42px;cursor:pointer}#listaBancoGestao [data-gc164-approve],#listaBancoGestao [data-gc164-confirm]{background:#176b42;color:#fff;border:1px solid #176b42}#listaBancoGestao [data-gc164-edit]{background:#ebf3ff;color:#164c92;border:1px solid #94b8e8}#listaBancoGestao .gc164-editor{border:1px solid #bcd2eb;background:#f5faff;border-radius:12px;padding:12px;display:grid;gap:10px}#listaBancoGestao .gc164-editor textarea{width:100%;min-height:75px}#listaBancoGestao .gc164-editor-buttons{display:flex;flex-wrap:wrap;gap:8px}#listaBancoGestao .gc164-feedback{padding:10px;border-radius:9px;background:#eef6ff;color:#174578;font-size:13px}#listaBancoGestao .gc164-feedback.error{background:#fff1f2;color:#9f1239}#listaBancoGestao [hidden]{display:none!important}@media(max-width:450px){#listaBancoGestao .gc164-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#listaBancoGestao .gc164-actions button{min-width:0;width:100%}}`;document.head.appendChild(s)}
function mount(){css();document.querySelectorAll('#listaBancoGestao .record-card').forEach(card=>{
 if(card.dataset.gc164Ready==='1')return;
 const review=select(card,'.command-review'),approve=select(card,'[data-gc163-approve],[data-cmd-bh-ok]');
 if(!review||!approve)return;
 const id=Number(approve.dataset.gc163Approve||approve.dataset.cmdBhOk);
 const hours=select(review,`[data-bh-hours="${id}"]`),level=select(review,`[data-bh-class="${id}"]`),actions=approve.closest('.request-actions');
 if(!Number.isSafeInteger(id)||id<=0||!hours||!level||!actions)return;
 const minutes=Number(card.dataset.gc163OriginalMinutes||Math.round(Number(hours.value)*60)),classe=card.dataset.gc163OriginalClass||level.value;
 if(!Number.isSafeInteger(minutes)||minutes<30||minutes%30!==0||!['50','100'].includes(classe)){
  const warn=document.createElement('div');warn.setAttribute('role','alert');warn.textContent=`Solicitação #${id}: quantidade ou classe inconsistente. Atualize os dados antes de decidir.`;review.prepend(warn);approve.disabled=true;return;
 }
 card.dataset.gc164Ready='1';card.dataset.gc164Minutes=String(minutes);card.dataset.gc164Class=classe;
 card.dataset.gc163Split='1';
 approve.removeAttribute('data-cmd-bh-ok');approve.removeAttribute('data-gc163-approve');approve.onclick=null;
 approve.dataset.gc164Approve=String(id);approve.type='button';approve.textContent='Aprovar';
 actions.classList.add('gc164-actions');
 let edit=select(actions,'[data-gc163-edit],[data-gc164-edit]');if(!edit){edit=document.createElement('button');edit.className='mini';approve.after(edit)}
 edit.removeAttribute('data-gc163-edit');edit.dataset.gc164Edit=String(id);edit.type='button';edit.textContent='Corrigir / editar';edit.onclick=null;
 const reject=select(actions,'[data-cmd-bh-no],[data-gc164-no]');if(reject){reject.removeAttribute('data-cmd-bh-no');reject.onclick=null;reject.dataset.gc164No=String(id);reject.type='button';reject.textContent='Recusar'}
 hours.disabled=true;level.disabled=true;hours.closest('label').hidden=true;level.closest('label').hidden=true;
 let summary=select(review,'.gc163-summary,.gc164-summary');if(!summary){summary=document.createElement('div');summary.className='gc164-summary full';review.insertBefore(summary,actions)}
 summary.className='gc164-summary full';summary.hidden=false;summary.textContent=`Pedido original: ${time(minutes)} · ${classe}%. Aprovar mantém os valores; Corrigir permite edição com justificativa.`;
 let editor=select(review,'.gc163-editor,.gc164-editor');if(!editor){editor=document.createElement('div');editor.className='gc164-editor full';review.appendChild(editor)}
 editor.className='gc164-editor full';editor.hidden=true;
 editor.innerHTML=`<strong>Editar solicitação #${id}</strong><label>Justificativa da correção<textarea data-gc164-reason="${id}" maxlength="800" placeholder="Explique as horas ou a classe que deseja corrigir."></textarea></label><div class="gc164-editor-buttons"><button type="button" class="mini" data-gc164-confirm="${id}">Salvar correção e aprovar</button><button type="button" class="mini" data-gc164-cancel="${id}">Cancelar edição</button></div>`;
 let feedback=select(review,'.gc163-feedback,.gc164-feedback');if(!feedback){feedback=document.createElement('div');review.appendChild(feedback)}feedback.className='gc164-feedback full';feedback.hidden=true;feedback.setAttribute('role','status');
 });}
function note(card,message,error=false){let el=select(card,'.gc164-feedback');if(!el){el=document.createElement('div');el.className='gc164-feedback';el.setAttribute('role','alert');card.appendChild(el)}el.hidden=false;el.classList.toggle('error',error);el.textContent=message;}
function editMode(card,on){const review=select(card,'.command-review');if(!review)return;const hours=select(review,'[data-bh-hours]'),level=select(review,'[data-bh-class]');if(!hours||!level)return;
 if(!on){hours.value=String(Number(card.dataset.gc164Minutes)/60);level.value=card.dataset.gc164Class;const reason=select(review,'[data-gc164-reason]');if(reason)reason.value=''}
 hours.disabled=!on;level.disabled=!on;hours.closest('label').hidden=!on;level.closest('label').hidden=!on;
 select(review,'.gc164-editor').hidden=!on;
 select(review,'.gc164-summary').hidden=on;
 for(const b of review.querySelectorAll('[data-gc164-approve],[data-gc164-edit],[data-gc164-no]'))b.hidden=on;
 card.dataset.gc164Edit=on?'1':'0';const feedback=select(review,'.gc164-feedback');if(feedback)feedback.hidden=true;
 if(on)hours.focus();}
function busy(card,on){card.dataset.gc164Busy=on?'1':'0';card.querySelectorAll(actionSelector).forEach(b=>b.disabled=on)}
async function call(url,body){const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessão expirada. Entre novamente.');let response;try{response=await fetch(url,{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'})}catch{throw new Error('Falha de conexão. Consulte a solicitação antes de repetir a decisão.')}let result={};try{result=await response.json()}catch{}if(!response.ok||!result.success)throw new Error(result.message||`Servidor não confirmou a ação (HTTP ${response.status}).`);return result}
async function submit(card,id,mode){if(working.has(id))return;const hours=select(card,'[data-bh-hours]'),level=select(card,'[data-bh-class]');const original=Number(card.dataset.gc164Minutes),originalClass=card.dataset.gc164Class;
 const minutes=mode==='CORRIGIR'?Math.round(Number(hours?.value)*60):original,classe=mode==='CORRIGIR'?level?.value:originalClass;
 const reason=String(select(card,'[data-gc164-reason]')?.value||'').trim();
 if(mode==='CORRIGIR'){
  if(!hours?.value||!Number.isSafeInteger(minutes)||minutes<30||minutes%30!==0||!['50','100'].includes(classe))return note(card,'Informe horas válidas em blocos de 30 minutos e classe 50% ou 100%.',true);
  if(minutes===original&&classe===originalClass)return note(card,'Nenhuma alteração. Use Aprovar para manter o pedido original.',true);
  if(!reason)return note(card,'Informe a justificativa antes de confirmar a correção.',true);
 }
 let payload,url;
 if(mode==='RECUSAR'){
  const why=window.prompt(`Motivo da recusa da solicitação #${id}:`,'');if(why===null)return;if(!why.trim())return note(card,'O motivo da recusa é obrigatório.',true);
  if(!window.confirm(`Confirmar a recusa da solicitação #${id}?`))return;
  url=REJECT_API;payload={action:'decide_bank_request',id,decisao:'RECUSADA',ajustes:{motivo:why.trim()}};
 }else{
  if(!window.confirm(mode==='CORRIGIR'?`Corrigir #${id}: ${time(original)} (${originalClass}%) → ${time(minutes)} (${classe}%) e aprovar?\nMotivo: ${reason}`:`Aprovar solicitação #${id} SEM ALTERAR ${time(original)} (${originalClass}%)?`))return;
  url=APPROVE_API;payload={action:'decide_bank_request',id,modo:mode,ajustes:{minutos_solicitados:minutes,classe,motivo:mode==='CORRIGIR'?reason:''}};
 }
 working.add(id);busy(card,true);note(card,'Registrando decisão no servidor...');
 try{const result=await call(url,payload);const review=select(card,'.command-review');if(review)review.remove();const pill=select(card,'.status-pill');if(pill)pill.textContent=mode==='RECUSAR'?'RECUSADA · ONLINE':mode==='CORRIGIR'?'CORRIGIDA E APROVADA · ONLINE':'APROVADA · ONLINE';const message=document.createElement('div');message.className=result.identity_collision?'record-warning':'notice';message.setAttribute('role','status');message.textContent=result.message||'Decisão registrada; aguarde conciliação para contabilização financeira.';card.appendChild(message);window.dispatchEvent(new Event('gcmbs:v110-refresh'))}
 catch(e){note(card,String(e?.message||'O servidor não confirmou a decisão.'),true)}
 finally{working.delete(id);if(card.isConnected&&select(card,'.command-review'))busy(card,false)}
}
function boot(){mount();window.addEventListener('click',event=>{const button=event.target?.closest?.(actionSelector);if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(button.disabled)return;const card=button.closest('.record-card'),id=Number(button.dataset.gc164Approve||button.dataset.gc164Edit||button.dataset.gc164Confirm||button.dataset.gc164Cancel||button.dataset.gc164No);if(!card||card.dataset.gc164Busy==='1'||!Number.isSafeInteger(id)||id<=0)return;
 if(button.hasAttribute('data-gc164-edit'))editMode(card,true);else if(button.hasAttribute('data-gc164-cancel'))editMode(card,false);else submit(card,id,button.hasAttribute('data-gc164-confirm')?'CORRIGIR':button.hasAttribute('data-gc164-no')?'RECUSAR':'APROVAR');},true);
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount()})}).observe(document.documentElement,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();