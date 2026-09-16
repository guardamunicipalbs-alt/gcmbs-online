/* GCMBS Online V163 — Aprovar original separado de Corrigir / editar. */
(()=>{'use strict';
if(window.__GCMBS_BANK_SPLIT_V163__)return;
window.__GCMBS_BANK_SPLIT_V163__=true;
if(window.Capacitor?.isNativePlatform?.())return; // App e Desktop possuem atualizacoes separadas.
const GATEWAY='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const DECIDE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-bank-decide-v163';
const pending=new Set(['PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP']);
const ongoing=new Set();
const fmt=n=>{const m=Math.round(Number(n)||0);return `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`};
const $=(root,selector)=>root?.querySelector(selector);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(url,body){
 const token=localStorage.getItem('gcmbs.mobile.token');
 if(!token)throw new Error('Sessão expirada. Faça login novamente.');
 let res;
 try{res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(body),cache:'no-store'})}
 catch{throw new Error('Falha de comunicação. Nenhuma decisão foi confirmada. Consulte a situação antes de tentar novamente.')}
 let result={};try{result=await res.json()}catch{}
 if(!res.ok)throw new Error(result.message||`Falha HTTP ${res.status}. Confira a situação antes de repetir a ação.`);
 return result;
}
function style(){
 if(document.getElementById('gc163-decision-css'))return;
 const el=document.createElement('style');el.id='gc163-decision-css';
 el.textContent=`#listaBancoGestao .gc163-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center}#listaBancoGestao .gc163-actions button{min-height:42px;min-width:112px;cursor:pointer}#listaBancoGestao .gc163-actions [data-gc163-approve]{background:#14683b;color:white;border:1px solid #14683b}#listaBancoGestao .gc163-actions [data-gc163-edit]{background:#eff6ff;color:#144b91;border:1px solid #93b7e9}#listaBancoGestao .gc163-summary{font-size:13px;color:#334e68;line-height:1.5}#listaBancoGestao .gc163-editor{border:1px solid #bcd2eb;background:#f5faff;border-radius:12px;padding:13px;display:grid;gap:10px}#listaBancoGestao .gc163-editor textarea{width:100%;min-height:76px;resize:vertical}#listaBancoGestao .gc163-editor .gc163-editor-buttons{display:flex;gap:9px;flex-wrap:wrap}#listaBancoGestao .gc163-editor button{min-height:42px;cursor:pointer}#listaBancoGestao .gc163-editor [data-gc163-confirm]{background:#14683b;color:#fff;border:1px solid #14683b}#listaBancoGestao .gc163-editor [data-gc163-cancel]{background:#fff;color:#144b91;border:1px solid #adc7e6}#listaBancoGestao .gc163-editor[hidden],#listaBancoGestao [hidden]{display:none!important}#listaBancoGestao .gc163-feedback{font-size:13px;padding:9px 11px;border-radius:9px;background:#f0f7ff;color:#214a76}#listaBancoGestao .gc163-feedback.error{background:#fff1f2;color:#9f1239}#listaBancoGestao button:focus-visible,#listaBancoGestao textarea:focus-visible{outline:3px solid #246bd3;outline-offset:2px}@media(max-width:450px){#listaBancoGestao .gc163-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#listaBancoGestao .gc163-actions button{width:100%;min-width:0}#listaBancoGestao .gc163-editor .gc163-editor-buttons{flex-direction:column}#listaBancoGestao .gc163-editor .gc163-editor-buttons button{width:100%}}`;
 document.head.appendChild(el);
}
function mount(){
 style();
 document.querySelectorAll('#listaBancoGestao .record-card').forEach(card=>{
  if(card.dataset.gc163Split==='1')return;
  const original=$(card,'[data-cmd-bh-ok]'),review=$(card,'.command-review');
  if(!original||!review)return;
  const id=Number(original.dataset.cmdBhOk);
  const hours=$(review,`[data-bh-hours="${id}"]`),classe=$(review,`[data-bh-class="${id}"]`);
  const actions=original.closest('.request-actions');
  if(!Number.isSafeInteger(id)||id<=0||!hours||!classe||!actions)return;
  const minutes=Math.round(Number(hours.value)*60),level=String(classe.value);
  if(!Number.isSafeInteger(minutes)||minutes<30||minutes%30!==0||!['50','100'].includes(level))return;
  card.dataset.gc163Split='1';card.dataset.gc163OriginalMinutes=String(minutes);card.dataset.gc163OriginalClass=level;
  hours.disabled=true;classe.disabled=true;
  hours.closest('label').hidden=true;classe.closest('label').hidden=true;
  const summary=document.createElement('div');summary.className='gc163-summary full';summary.innerHTML=`<strong>Pedido original:</strong> ${fmt(minutes)} · ${esc(level)}%. <span>Aprovar mantém esses valores; Corrigir abre a edição com justificativa.</span>`;
  review.insertBefore(summary,actions);
  actions.classList.add('gc163-actions');
  original.removeAttribute('data-cmd-bh-ok');original.onclick=null;
  original.dataset.gc163Approve=String(id);original.type='button';original.textContent='Aprovar';
  original.setAttribute('aria-label',`Aprovar pedido original da solicitação ${id}`);
  const edit=document.createElement('button');edit.type='button';edit.className='mini';edit.dataset.gc163Edit=String(id);edit.textContent='Corrigir / editar';
  edit.setAttribute('aria-label',`Editar horas e classe da solicitação ${id}`);
  original.after(edit);
  const reject=$(actions,'[data-cmd-bh-no]');if(reject)reject.type='button';
  const editor=document.createElement('div');editor.className='gc163-editor full';editor.hidden=true;
  editor.innerHTML=`<strong>Corrigir solicitação #${id}</strong><small>Edite as horas e/ou a classificação nos campos acima. O motivo da correção é obrigatório. A gravação da correção também registra a aprovação; o crédito aguarda conciliação pelo Desktop.</small><label>Motivo da correção<textarea data-gc163-reason="${id}" maxlength="800" placeholder="Explique a alteração das horas ou da classe." required></textarea></label><div class="gc163-editor-buttons"><button class="mini" type="button" data-gc163-confirm="${id}">Confirmar correção e aprovar</button><button class="mini" type="button" data-gc163-cancel="${id}">Cancelar edição</button></div>`;
  review.appendChild(editor);
  const feedback=document.createElement('div');feedback.className='gc163-feedback full';feedback.setAttribute('role','status');feedback.hidden=true;review.appendChild(feedback);
 });
}
function showFeedback(card,msg,error=false){const node=$(card,'.gc163-feedback');if(!node)return;node.hidden=false;node.classList.toggle('error',error);node.textContent=msg;}
function editing(card,enabled){
 const review=$(card,'.command-review'),id=Number(card.dataset.gc163OriginalMinutes);
 if(!review||!id)return;
 const hours=$(review,'[data-bh-hours]'),classe=$(review,'[data-bh-class]');
 if(!hours||!classe)return;
 if(!enabled){hours.value=String(id/60);classe.value=card.dataset.gc163OriginalClass;const textarea=$(review,'[data-gc163-reason]');if(textarea)textarea.value='';}
 hours.disabled=!enabled;classe.disabled=!enabled;
 hours.closest('label').hidden=!enabled;classe.closest('label').hidden=!enabled;
 const editor=$(review,'.gc163-editor');if(editor)editor.hidden=!enabled;
 const approve=$(review,'[data-gc163-approve]'),edit=$(review,'[data-gc163-edit]'),reject=$(review,'[data-cmd-bh-no]');
 for(const b of [approve,edit,reject])if(b)b.hidden=enabled;
 card.dataset.gc163Editing=enabled?'1':'0';
 const info=$(review,'.gc163-feedback');if(info)info.hidden=true;
 if(enabled)hours.focus();
}
function busy(card,on){
 card.dataset.gc163Busy=on?'1':'0';
 card.querySelectorAll('[data-gc163-approve],[data-gc163-edit],[data-gc163-confirm],[data-gc163-cancel],[data-cmd-bh-no],[data-bh-hours],[data-bh-class],[data-gc163-reason]').forEach(el=>{el.disabled=on||(!on&&['data-bh-hours','data-bh-class'].some(k=>el.hasAttribute(k))&&card.dataset.gc163Editing!=='1');});
}
async function submit(card,id,mode){
 if(card.dataset.gc163Busy==='1'||ongoing.has(id))return;
 const hours=$(card,'[data-bh-hours]'),classe=$(card,'[data-bh-class]');
 const newMinutes=Math.round(Number(hours?.value)*60),newClass=classe?.value||'';
 const oldMinutes=Number(card.dataset.gc163OriginalMinutes),oldClass=card.dataset.gc163OriginalClass;
 const reason=String($(card,'[data-gc163-reason]')?.value||'').trim();
 if(mode==='CORRIGIR'){
  if(!hours?.value||!Number.isSafeInteger(newMinutes)||newMinutes<30||newMinutes%30!==0||!['50','100'].includes(newClass))return showFeedback(card,'Informe horas em blocos de 30 minutos e classe 50% ou 100%.',true);
  if(newMinutes===oldMinutes&&newClass===oldClass)return showFeedback(card,'Nenhuma alteração detectada. Para manter os valores originais, use Aprovar.',true);
  if(!reason)return showFeedback(card,'Descreva o motivo da correção antes de confirmar.',true);
 }
 ongoing.add(id);busy(card,true);
 try{
  // Verifica novamente o pedido online antes de decidir: outro dispositivo pode ter alterado o status.
  const state=await call(GATEWAY,{action:'data'});
  const request=(state.action_requests||[]).find(x=>Number(x.id)===id&&String(x.tipo).toUpperCase()==='BANCO_HORAS_CORRECAO');
  if(!request)throw new Error('Não foi possível localizar a solicitação atual. Atualize a página antes de decidir.');
  const p=request.payload||{},liveStatus=String(request.status||'').toUpperCase();
  if(!pending.has(liveStatus))throw new Error(`A solicitação não está mais pendente (${liveStatus||'status desconhecido'}). Atualize a página.`);
  if(Number(p.minutos_solicitados)!==oldMinutes||String(p.classe||'50')!==oldClass)
   throw new Error('O pedido original mudou após a abertura da tela. Atualize a página para evitar uma decisão incorreta.');
  const proposedMinutes=mode==='CORRIGIR'?newMinutes:oldMinutes,proposedClass=mode==='CORRIGIR'?newClass:oldClass;
  const person=String(request.nome_guerra||`GCM #${request.guarda_id}`);
  const confirmation=mode==='CORRIGIR'
   ?`Corrigir solicitação #${id} (${person}) de ${fmt(oldMinutes)} · ${oldClass}% para ${fmt(proposedMinutes)} · ${proposedClass}% e APROVAR?\n\nMotivo: ${reason}\n\nO crédito financeiro continuará pendente de conciliação com o Desktop.`
   :`Aprovar SEM ALTERAÇÕES a solicitação #${id} (${person}): ${fmt(oldMinutes)} · ${oldClass}%?\n\nO crédito financeiro continuará pendente de conciliação com o Desktop.`;
  if(!window.confirm(confirmation))return;
  const result=await call(DECIDE,{action:'decide_bank_request',id,modo:mode,ajustes:{minutos_solicitados:proposedMinutes,classe:proposedClass,motivo:mode==='CORRIGIR'?reason:''}});
  if(!result.success)throw new Error('O servidor não confirmou a decisão.');
  const review=$(card,'.command-review');if(review)review.remove();
  const status=$(card,'.status-pill');if(status)status.textContent=mode==='CORRIGIR'?'CORRIGIDA E APROVADA · ONLINE':'APROVADA · ONLINE';
  const note=document.createElement('div');note.setAttribute('role','status');note.className=result.identity_collision?'record-warning':'notice';
  note.textContent=`${mode==='CORRIGIR'?'Correção: '+fmt(oldMinutes)+' '+oldClass+'% → '+fmt(proposedMinutes)+' '+proposedClass+'%. ':''}${result.message||'Decisão registrada no Online.'}`;
  card.appendChild(note);
  window.dispatchEvent(new Event('gcmbs:v110-refresh'));
 }catch(error){showFeedback(card,String(error?.message||'Falha ao registrar a decisão.'),true)}
 finally{ongoing.delete(id);if(card.isConnected&&$(card,'.command-review'))busy(card,false)}
}
function boot(){
 mount();
 document.addEventListener('click',event=>{
  const btn=event.target?.closest?.('[data-gc163-approve],[data-gc163-edit],[data-gc163-confirm],[data-gc163-cancel]');
  if(!btn||btn.disabled)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const card=btn.closest('.record-card'),id=Number(btn.dataset.gc163Approve||btn.dataset.gc163Edit||btn.dataset.gc163Confirm||btn.dataset.gc163Cancel);
  if(!card||!Number.isSafeInteger(id)||id<1||card.dataset.gc163Busy==='1')return;
  if(btn.hasAttribute('data-gc163-edit'))editing(card,true);
  else if(btn.hasAttribute('data-gc163-cancel'))editing(card,false);
  else submit(card,id,btn.hasAttribute('data-gc163-confirm')?'CORRIGIR':'APROVAR');
 },true);
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;mount()})}).observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();