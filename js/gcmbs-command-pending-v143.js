/* GCMBS V143 — Central de Pendências do Comando + organização Banco de Horas. */
(()=>{'use strict';
if(window.__GCMBS_V143_COMMAND_PENDING__)return;window.__GCMBS_V143_COMMAND_PENDING__=true;
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const $=id=>document.getElementById(id),norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
function isCommand(){const c=norm($('perfilCargo')?.textContent||document.body?.dataset?.perfil||document.documentElement?.dataset?.perfil||'');return /COMANDANTE|SUBCOMANDANTE/.test(c)}
async function data(){const t=token();if(!t)return null;const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({action:'data'}),cache:'no-store'});if(!r.ok)return null;return r.json()}
const pending=s=>['PENDENTE','PENDENTE_DESKTOP','AGUARDANDO_ACEITE','ACEITE_PENDENTE_DESKTOP','DECISAO_PENDENTE_DESKTOP','CANCELAMENTO_PENDENTE','CANCELAMENTO_PENDENTE_DESKTOP'].includes(norm(s));
function commandPending(r){
  const tipo=norm(r?.tipo);
  const status=norm(r?.status);
  const statusOriginal=norm(r?.status_original||r?.status);
  const desktopRecebido=Number(r?.desktop_referencia_id||0)>0;

  // O gateway pode converter PENDENTE_DESKTOP em PENDENTE
  // apenas para apresentacao. A fila do Comando usa o estado real.
  if(tipo==='PERMUTA'){
    if(statusOriginal==='PENDENTE_DESKTOP'&&!desktopRecebido)return false;
    return status==='PENDENTE';
  }

  if(tipo==='BANCO_HORAS_CORRECAO'){
    return ['PENDENTE','PENDENTE_DESKTOP'].includes(status);
  }

  return pending(status);
}
function bankOrder(){if(!isCommand())return;const cards=[...document.querySelectorAll('[data-view="banco"] .card,#bancoGestaoCard .card,#bancoGestaoCard')];const byTitle=t=>cards.find(c=>norm(c.querySelector('h1,h2,h3')?.textContent).includes(norm(t)));const cmd=$('bancoComandoMovV133')||byTitle('Movimentação do Comando'),req=byTitle('Solicitações de correção'),mov=byTitle('Movimentações da competência');if(cmd&&req&&cmd.parentNode===req.parentNode)req.parentNode.insertBefore(cmd,req);if(req&&mov&&req.parentNode===mov.parentNode)mov.parentNode.insertBefore(req,mov);document.querySelectorAll('[data-view="banco"] .card').forEach(c=>{const h=norm(c.querySelector('h1,h2,h3')?.textContent);if(h==='SOLICITAR CORRECAO')c.classList.add('hidden')})}
function go(label){const n=norm(label);const candidates=[...document.querySelectorAll('button,a,[role="button"]')];const el=candidates.find(x=>norm(x.textContent).includes(n));el?.click()}
function escPend(v){
  return String(v??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));
}
function dataBrPend(v){
  const s=String(v||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '-';
  const p=s.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}
function detalheHoras(r){
  const p=r?.payload||{};
  const nome=escPend(r?.nome_guerra||'GCM');
  const data=dataBrPend(p.data_servico);
  const min=Math.max(0,Number(p.minutos_solicitados||0));
  const h=Math.floor(min/60);
  const m=min%60;
  const horas=m?`${h}h${String(m).padStart(2,'0')}`:`${h}h00`;
  const classe=escPend(String(p.classe||'50')+'%');
  const desc=escPend(String(p.descricao||'').trim());

  return `Solicitação #${r.id} · ${nome} · ${data} · ${horas} · ${classe}${desc?' · '+desc:''}`;
}
function detalhePermuta(r){
  const p=r?.payload||{};
  const nome=escPend(r?.nome_guerra||'GCM');
  const data=dataBrPend(p.data);
  const turno=escPend(String(p.turno||'-'));
  const posto=escPend(String(p.posto_nome||'').trim());

  return `Solicitação #${r.id} · ${nome} · ${data} · turno ${turno}${posto?' · '+posto:''}`;
}
function mount(items){let box=$('gcmbsCommandPendingV143');if(!box){box=document.createElement('section');box.id='gcmbsCommandPendingV143';box.className='card';box.style.cssText='margin:14px 18px;padding:16px;border-radius:16px';const app=$('appTela')||document.body;app.prepend(box)}const rows=items.slice(0,12).map(x=>`<button type="button" data-v143-go="${x.go}" style="display:block;width:100%;text-align:left;margin:7px 0;padding:10px;border-radius:10px"><strong>${x.title}</strong><br><small>${x.text}</small></button>`).join('');box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><h2 style="margin:0">Pendências do Comando</h2><small>Itens que aguardam avaliação ou ciência administrativa.</small></div><span class="badge">${items.length}</span></div>${rows||'<p class="muted">Nenhuma pendência administrativa no momento.</p>'}`;box.querySelectorAll('[data-v143-go]').forEach(b=>b.onclick=()=>go(b.dataset.v143Go))}
async function refresh(){bankOrder();if(!isCommand()){$('gcmbsCommandPendingV143')?.remove();return}const d=await data();if(!d)return;const out=[];for(const r of (d.action_requests||[])){if(!commandPending(r))continue;const t=norm(r.tipo);if(t==='PERMUTA')out.push({title:'Permuta aguardando avaliação',text:detalhePermuta(r),go:'Permutas'});else if(t==='BANCO_HORAS_CORRECAO')out.push({title:'Correção de horas aguardando avaliação',text:detalheHoras(r),go:'Banco de Horas'})}const requestsById=new Map(
  (d.action_requests||[]).map(r=>[Number(r.id),r])
);

for(const n of (d.notifications||[])){

  if(
    n.lida_em ||
    norm(n.tipo)!=='PENDENCIA_COMANDO'
  ) continue;

  const rt=norm(n.referencia_tipo);
  const refId=Number(n.referencia_id||0);
  const req=refId ? requestsById.get(refId) : null;
  const activeBankPending=(d.action_requests||[]).some(r=>
    norm(r.tipo)==='BANCO_HORAS_CORRECAO' && commandPending(r)
  );
  if(rt.includes('BANCO')&&(req||activeBankPending))continue;

  /*
    Notificação antiga não pode recriar uma pendência
    que o estado atual da solicitação já não confirma.
  */
  if(rt.includes('PERMUTA')){

    if(!req || norm(req.tipo)!=='PERMUTA'){
      continue;
    }

    if(!commandPending(req)){
      continue;
    }
  }

  if(rt.includes('BANCO')){

    if(req && !commandPending(req)){
      continue;
    }
  }

  out.push({
    title:n.titulo||'Pendência do Comando',
    text:n.mensagem||'',
    go:rt.includes('PERMUTA')
      ?'Permutas'
      :rt.includes('BANCO')
        ?'Banco de Horas'
        :rt.includes('JUSTIFICATIVA')
          ?'Justificativa de Faltas'
          :'Notificações'
  });
}const seen=new Set();mount(out.filter(x=>{const k=x.title+'|'+x.text;if(seen.has(k))return false;seen.add(k);return true}))}
function guardClicks(){if(document.documentElement.dataset.gcmbsV143ClickGuard)return;document.documentElement.dataset.gcmbsV143ClickGuard='1';document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-cmd-pm-ok],[data-cmd-pm-no],[data-cmd-pm-del],[data-cmd-mirror-ok],[data-cmd-mirror-no],[data-cmd-bh-ok],[data-cmd-bh-no]');if(!b||b.disabled)return;queueMicrotask(()=>{b.disabled=true;b.setAttribute('aria-busy','true');setTimeout(()=>{if(document.body.contains(b)){b.disabled=false;b.removeAttribute('aria-busy')}},15000)})},true)}
function boot(){guardClicks();refresh();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;bankOrder()})}).observe(document.documentElement,{childList:true,subtree:true});setInterval(refresh,15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();