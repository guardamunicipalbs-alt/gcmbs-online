// GCMBS 10.0.62 — camada P0 Online/App para fluxos protegidos.
// A gravação só é liberada quando o catálogo recebido do Desktop indicar writable=true.
const P0_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const p0$=id=>document.getElementById(id);
const p0Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let p0Session=null,p0Refs=null,p0EventKey='',p0Busy=false,p0Scheduled=false,p0EventoComandoIds=null,p0EventoAjustando=false;

async function p0Api(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(P0_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;
}
async function p0GetSession(){if(p0Session)return p0Session;try{p0Session=(await p0Api('session')).session||null;}catch{p0Session=null;}return p0Session;}
async function p0GetRefs(){if(p0Refs)return p0Refs;try{p0Refs=await p0Api('references');}catch{p0Refs={guardas:[],oficios:[],equipes:[]};}return p0Refs;}
async function p0Entity(entity,limit=5000){return p0Api('entity_list',{entity,limit,offset:0});}
const p0Titulo=()=>String(p0$('onlineTitulo')?.textContent||'').trim();
const p0IsExtra=()=>p0Titulo()==='Escala Extra Manual';
const p0IsJust=()=>p0Titulo()==='Justificativa de Faltas';
const p0IsEvento=()=>p0Titulo()==='Serviço Extra por Evento';
const p0ModuloAtivo=()=>p0IsExtra()||p0IsJust()||p0IsEvento();

function p0Mensagem(text,erro=false){const e=p0$('onlineMsg');if(e){e.textContent=text;e.style.color=erro?'#b91c1c':'#15803d';}}
function p0RefreshModule(mod){setTimeout(()=>{const b=document.querySelector(`#mainNav [data-module="${mod}"]`);if(b)b.click();},150);}
function p0RotularBotao(b,text,title){
  if(!b)return;
  if(String(b.textContent||'')!==text)b.textContent=text;
  if(b.title!==title)b.title=title;
}

// Extra Manual: criação pelas regras do repositório; registros ativos não são editados em SQL.
function p0AjustarExtra(){
  if(!p0IsExtra())return;
  document.querySelectorAll('#onlineRegistros [data-online-edit]').forEach(b=>b.remove());
  document.querySelectorAll('#onlineRegistros [data-online-del]').forEach(b=>p0RotularBotao(b,'Cancelar extra','Cancela o serviço extra preservando o histórico.'));
  const dlg=p0$('onlineEditor');if(!dlg?.open)return;
  const status=dlg.querySelector('[data-online-field="status"]');if(status){status.value='ATIVA';status.closest('label')?.classList.add('hidden');}
  const posto=dlg.querySelector('[data-online-field="posto"]');if(posto)posto.closest('label')?.classList.add('hidden');
  const funcao=dlg.querySelector('[data-online-field="funcao"]');if(funcao)funcao.closest('label')?.classList.add('hidden');
  if(!dlg.querySelector('[data-p0-extra-info]')){
    p0$('onlineCampos')?.insertAdjacentHTML('afterbegin','<div data-p0-extra-info class="notice full"><strong>Escala Extra Manual</strong><br>O Desktop validará conflito de turno, serviço de 24h, férias, grupo de Comando e extra já existente. Para alterar uma extra ativa, cancele e crie outra.</div>');
  }
}
function p0ValidarExtra(){
  const data=document.querySelector('[data-online-field="data"]')?.value||'',ini=document.querySelector('[data-online-field="horario_inicio"]')?.value||'',fim=document.querySelector('[data-online-field="horario_fim"]')?.value||'',g=Number(document.querySelector('[data-online-field="guarda_id"]')?.value||0);
  if(!data||!g)throw new Error('Informe data e GCM.');
  if(!new Set(['07:00|19:00','19:00|07:00','07:00|07:00']).has(`${ini}|${fim}`))throw new Error('Use uma jornada válida: 07:00–19:00, 19:00–07:00 ou 07:00–07:00 (24h).');
}

// Justificativa: o próprio GCM não pode escolher outro servidor.
async function p0AjustarJustificativa(){
  if(!p0IsJust()||!p0$('onlineEditor')?.open)return;
  const s=await p0GetSession();if(!s)return;
  const role=String(s.role||s.perfil||'').toLowerCase(),cargo=String(s.cargo||'').toUpperCase(),gestor=role==='comandante'||role==='subcomandante'||cargo.includes('COMANDANTE');
  if(!gestor){const g=document.querySelector('[data-online-field="guarda_id"]');if(g&&s.guarda_id){g.value=String(s.guarda_id);g.disabled=true;g.title='O GCM registra justificativa somente em seu próprio nome.';}}
  const status=document.querySelector('[data-online-field="status"]');if(status&&!gestor){status.value='ATIVA';status.closest('label')?.classList.add('hidden');}
  if(!p0$('onlineCampos')?.querySelector('[data-p0-just-info]'))p0$('onlineCampos')?.insertAdjacentHTML('afterbegin','<div data-p0-just-info class="notice full">Justificativas de serviço <b>ordinário</b> podem recompor a escala automática já salva; justificativas de serviço <b>extra</b> geram/estornam os débitos correspondentes no Banco de Horas pelo Desktop.</div>');
}

async function p0EventoSelecionados(){
  if(!p0EventKey)return new Set();
  try{const b=await p0Entity('eventos_extras_participantes',5000);return new Set((b.records||[]).map(x=>x.data||{}).filter(x=>String(x.evento_id)===String(p0EventKey)).map(x=>Number(x.guarda_id)).filter(Boolean));}catch{return new Set();}
}
function p0EventoCargoComando(g){return /\b(SUBCOMANDANTE|COMANDANTE)\b/i.test(String(g?.cargo||''));}
async function p0EventoIdsComando(){
  if(p0EventoComandoIds instanceof Set)return p0EventoComandoIds;
  const ids=new Set();
  try{
    const [eqResp,vincResp]=await Promise.all([p0Entity('equipes',500),p0Entity('guarda_equipes',3000)]);
    const equipes=(eqResp.records||[]).map(r=>r.data||{}),eqs=new Set(equipes.filter(e=>/COMAND/i.test(String(e.nome||''))).map(e=>Number(e.id)).filter(Number.isFinite));
    for(const r of (vincResp.records||[])){const v=r.data||{};if(eqs.has(Number(v.equipe_id)))ids.add(Number(v.guarda_id));}
  }catch(e){console.warn('[GCMBS] Não foi possível carregar vínculos da equipe de Comando para eventos:',e?.message||e);}
  p0EventoComandoIds=ids;return ids;
}
function p0EventoAjustarOrigem(dlg){
  let origem=dlg.querySelector('[data-online-field="origem_evento"]');
  const oficio=dlg.querySelector('[data-online-field="oficio_id"]'),oficioLabel=oficio?.closest('label');
  if(origem&&origem.tagName!=='SELECT'){
    const atual=String(origem.value||'EVENTO_NOVO').toUpperCase();
    const sel=document.createElement('select');sel.dataset.onlineField='origem_evento';sel.innerHTML='<option value="EVENTO_NOVO">Criar evento</option><option value="OFICIO">Usar ofício cadastrado</option>';sel.value=atual==='OFICIO'?'OFICIO':'EVENTO_NOVO';origem.replaceWith(sel);origem=sel;
  }
  if(!origem&&oficioLabel){
    const l=document.createElement('label');l.innerHTML='<span>Origem do evento</span><select data-online-field="origem_evento"><option value="EVENTO_NOVO">Criar evento</option><option value="OFICIO">Usar ofício cadastrado</option></select>';oficioLabel.parentElement?.insertBefore(l,oficioLabel);origem=l.querySelector('select');
  }
  const origemLabel=origem?.closest('label');
  if(origemLabel){
    const txt=[...origemLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());
    if(txt)txt.nodeValue='Origem do evento ';
    else if(!origemLabel.querySelector(':scope > span'))origemLabel.insertAdjacentHTML('afterbegin','<span>Origem do evento</span>');
  }
  if(oficioLabel){const t=[...oficioLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.textContent||'').trim());if(t)t.nodeValue='Ofício ';}
  const sync=()=>{const usar=String(origem?.value||'EVENTO_NOVO').toUpperCase()==='OFICIO';if(oficioLabel)oficioLabel.style.display=usar?'':'none';if(!usar&&oficio)oficio.value='';};
  if(origem&&!origem.dataset.p0OrigemBind){origem.dataset.p0OrigemBind='1';origem.addEventListener('change',sync);}sync();
}
function p0EventoReorganizarCampos(dlg){
  const host=p0$('onlineCampos');if(!host)return;
  const nome=dlg.querySelector('[data-online-field="nome"]')?.closest('label');
  const origem=dlg.querySelector('[data-online-field="origem_evento"]')?.closest('label');
  const oficio=dlg.querySelector('[data-online-field="oficio_id"]')?.closest('label');
  if(!nome&&!origem&&!oficio)return;
  let sec=p0$('p0EventoIdentificacao');
  if(!sec){
    sec=document.createElement('section');sec.id='p0EventoIdentificacao';sec.className='form-section module-editor-section';
    sec.innerHTML='<h3>Evento</h3><div class="form-grid"></div>';
    host.insertBefore(sec,host.firstChild);
  }
  const grid=sec.querySelector('.form-grid');
  [origem,oficio,nome].filter(Boolean).forEach(el=>grid.appendChild(el));
  [...host.querySelectorAll('section.form-section.module-editor-section')].forEach(s=>{
    if(s.id==='p0EventoIdentificacao'||s.id==='p0EventoParticipantes')return;
    if(!s.querySelector('[data-online-field]'))s.remove();
  });
}
function p0EventoAtualizarContador(){
  const scope=p0$('p0EventoParticipantes');
  const n=scope?.querySelectorAll('[data-p0-evento-gcm]:checked').length||0,e=p0$('p0EventoSelecionados');
  if(e)e.textContent=`${n} GCM${n===1?'':'s'} selecionado${n===1?'':'s'}`;
}
function p0EventoDeduplicarParticipantes(dlg){
  const blocos=[...dlg.querySelectorAll('section#p0EventoParticipantes')];
  blocos.slice(1).forEach(x=>x.remove());
  return blocos[0]||null;
}
async function p0AjustarEvento(){
  if(!p0IsEvento()||p0EventoAjustando)return;
  p0EventoAjustando=true;
  try{
    const host=p0$('onlineRegistros');
    if(host&&!host.dataset.p0EventoResumo){
      host.dataset.p0EventoResumo='1';
      try{
        const [parts,refs]=await Promise.all([p0Entity('eventos_extras_participantes',5000),p0GetRefs()]);
        const gs=new Map((refs.guardas||[]).map(g=>[Number(g.id),g.nome_guerra||g.nome_completo||`GCM ${g.id}`])),map=new Map();
        for(const r of parts.records||[]){const d=r.data||{},id=String(d.evento_id||'');if(!id)continue;if(!map.has(id))map.set(id,new Map());const m=map.get(id),gid=Number(d.guarda_id);if(gid)m.set(gid,gs.get(gid)||`GCM ${gid}`);}
        host.querySelectorAll('[data-online-key]').forEach(card=>{const key=String(card.dataset.onlineKey||''),names=[...(map.get(key)?.values()||[])];if(names.length&&!card.querySelector('[data-p0-evento-participantes]'))card.querySelector('.online-kv')?.insertAdjacentHTML('beforeend',`<b data-p0-evento-participantes>Participantes</b><span>${p0Esc(names.join(', '))}</span>`);});
      }catch{}
    }
    document.querySelectorAll('#onlineRegistros [data-online-del]').forEach(b=>p0RotularBotao(b,'Cancelar evento','Cancela o evento e estorna os créditos automáticos, preservando o histórico.'));
    const dlg=p0$('onlineEditor');if(!dlg?.open)return;
    p0EventoAjustarOrigem(dlg);
    p0EventoReorganizarCampos(dlg);
    const status=dlg.querySelector('[data-online-field="status"]');if(status){status.value='ATIVO';status.closest('label')?.classList.add('hidden');}
    const eq=dlg.querySelector('[data-online-field="equipe_servico_id"]');if(eq)eq.closest('label')?.classList.add('hidden');
    if(p0EventoDeduplicarParticipantes(dlg))return;
    const [refs,selected,comandoIds]=await Promise.all([p0GetRefs(),p0EventoSelecionados(),p0EventoIdsComando()]);
    if(!dlg.open||!p0IsEvento())return;
    if(p0EventoDeduplicarParticipantes(dlg))return;
    const guardas=(refs.guardas||[]).filter(g=>['ATIVO','ATIVA',''].includes(String(g.status||'').toUpperCase())&&!comandoIds.has(Number(g.id))&&!p0EventoCargoComando(g)).sort((a,b)=>String(a.nome_guerra||a.nome_completo).localeCompare(String(b.nome_guerra||b.nome_completo),'pt-BR'));
    const html=guardas.map(g=>`<label class="check"><input type="checkbox" data-p0-evento-gcm value="${p0Esc(g.id)}" ${selected.has(Number(g.id))?'checked':''}> ${p0Esc(g.nome_guerra||g.nome_completo||`GCM ${g.id}`)}</label>`).join('');
    p0$('onlineCampos')?.insertAdjacentHTML('beforeend',`<section id="p0EventoParticipantes" class="form-section module-editor-section full"><h3>GCMs participantes</h3><p class="muted">Selecione os participantes. Integrantes da equipe de Comando não são elegíveis. O Desktop descontará escala ordinária, permutas e outras extras e contabilizará somente o trecho realmente livre do evento.</p><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 10px"><button id="p0EventoTodos" type="button" class="secondary">Selecionar todos</button><button id="p0EventoLimpar" type="button" class="secondary">Limpar</button><small id="p0EventoSelecionados" class="muted">0 GCMs selecionados</small></div><div class="choice-grid">${html||'<span class="muted">Nenhum GCM elegível encontrado.</span>'}</div></section>`);
    const bloco=p0$('p0EventoParticipantes');
    bloco?.querySelectorAll('[data-p0-evento-gcm]').forEach(i=>i.addEventListener('change',p0EventoAtualizarContador));
    p0$('p0EventoTodos')?.addEventListener('click',()=>{bloco?.querySelectorAll('[data-p0-evento-gcm]').forEach(i=>i.checked=true);p0EventoAtualizarContador();});
    p0$('p0EventoLimpar')?.addEventListener('click',()=>{bloco?.querySelectorAll('[data-p0-evento-gcm]').forEach(i=>i.checked=false);p0EventoAtualizarContador();});
    p0EventoAtualizarContador();
  }finally{p0EventoAjustando=false;}
}
function p0ColetarEvento(){
  const d={};
  p0$('onlineCampos')?.querySelectorAll('[data-online-field]').forEach(i=>{let v=i.value;const n=i.dataset.onlineField;if(n==='oficio_id'&&v!=='')v=Number(v);d[n]=v;});
  d.nome=String(d.nome||'').trim();d.origem_evento=String(d.origem_evento||'EVENTO_NOVO').toUpperCase()==='OFICIO'?'OFICIO':'EVENTO_NOVO';
  if(d.origem_evento==='OFICIO'){d.oficio_id=Number(d.oficio_id||0)||null;if(!d.oficio_id)throw new Error('Selecione o ofício vinculado ao evento.');}else d.oficio_id=null;
  const bloco=p0$('p0EventoParticipantes');
  d.guarda_ids=[...(bloco?.querySelectorAll('[data-p0-evento-gcm]:checked')||[])].map(x=>Number(x.value)).filter(Boolean);
  if(!d.nome||!d.data||!d.horario_inicio||!d.horario_fim)throw new Error('Informe evento, data, início e término.');
  if(!d.guarda_ids.length)throw new Error('Selecione ao menos um GCM participante.');
  return d;
}
async function p0SalvarEvento(e){
  if(!p0IsEvento()||!p0$('onlineEditor')?.open)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(p0Busy)return;p0Busy=true;
  const btn=p0$('onlineSalvar'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{const d=p0ColetarEvento();await p0Api('entity_mutate',{entity:'eventos_extras',record_key:p0EventKey||'',operation:'UPSERT',data:d});p0Mensagem('Evento registrado na fila segura. O Desktop calculará participantes efetivos e Banco de Horas na próxima sincronização.');setTimeout(()=>{p0$('onlineEditor')?.close();p0RefreshModule('eventos_extra');},500);}
  catch(err){const msg=String(err.message||err);p0Mensagem(/não editável|somente leitura/i.test(msg)?'A gravação deste fluxo ainda aguarda o Desktop publicar o catálogo P0 atualizado. '+msg:msg,true);}
  finally{p0Busy=false;if(btn){btn.disabled=false;btn.textContent=old||'Salvar';}}
}
async function p0CancelarProtegido(e,b){
  const mod=p0IsExtra()?'escala_extra_manual':p0IsEvento()?'eventos_extra':'';if(!mod)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const key=b.dataset.onlineDel;if(!key)return;
  const nome=p0IsExtra()?'esta escala extra':'este evento';if(!confirm(`Cancelar ${nome}? O histórico será preservado.`))return;
  try{await p0Api('entity_mutate',{entity:p0IsExtra()?'escalas_extras_manuais':'eventos_extras',record_key:key,operation:'DELETE',data:{}});b.closest('[data-online-key]')?.remove();alert('Cancelamento registrado para processamento seguro pelo Desktop.');}
  catch(err){alert(err.message||err);}
}

function p0Capture(e){
  const edit=e.target.closest?.('[data-online-edit]');if(edit&&p0IsEvento())p0EventKey=String(edit.dataset.onlineEdit||'');
  if(e.target.closest?.('#onlineNovo')&&p0IsEvento())p0EventKey='';
  const del=e.target.closest?.('[data-online-del]');if(del&&(p0IsExtra()||p0IsEvento())){p0CancelarProtegido(e,del);return;}
  if(e.target.closest?.('#onlineSalvar')){
    if(p0IsEvento()){p0SalvarEvento(e);return;}
    if(p0IsExtra()){try{p0ValidarExtra();}catch(err){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();p0Mensagem(err.message,true);}}
  }
}
function p0Ajustar(){
  if(p0Scheduled||!p0ModuloAtivo())return;
  p0Scheduled=true;
  queueMicrotask(async()=>{p0Scheduled=false;try{p0AjustarExtra();await p0AjustarJustificativa();await p0AjustarEvento();}catch{}});
}
document.addEventListener('click',p0Capture,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',p0Ajustar,{once:true});else p0Ajustar();
new MutationObserver(()=>{
  if(!p0ModuloAtivo())return;
  const h=p0$('onlineRegistros');
  if(h&&!p0IsEvento()&&h.dataset.p0EventoResumo)delete h.dataset.p0EventoResumo;
  p0Ajustar();
}).observe(document.documentElement,{subtree:true,childList:true});