
import {AuthenticatedProvider} from './data-provider.js';
import {MODULOS_GCMBS} from './access-catalog.js';
import {configurarPushNativo} from './native-push.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{if(!d)return'';const [y,m,day]=String(d).slice(0,10).split('-');return `${day}/${m}/${y}`};
const horas=min=>{const n=Number(min||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`};
let provider=new AuthenticatedProvider();
let onlineCatalog=[],onlineCurrent=null,onlineRecords=[],onlineEditing=null;

function setView(id){
  document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('hidden',x.dataset.view!==id));
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.go===id));
}
function temAcesso(modulo){
  if(modulo==='perfil') return true;
  if(modulo==='escalas') return provider.pode('escalas') || provider.pode('relatorios');
  if(modulo==='extras') return provider.pode('escala_extra_manual') || provider.pode('permutas');
  return provider.pode(modulo);
}

function aplicarPermissoes(){
  const mapa={inicio:'dashboard',escala:'escalas',extras:'extras',banco:'banco_horas',online:'perfil',acessos:'perfil',avisos:'perfil',perfil:'perfil'};
  document.querySelectorAll('nav button').forEach(b=>{
    const mod=mapa[b.dataset.go];
    b.classList.toggle('hidden',!temAcesso(mod));
  });
}
function minhasEscalas(){return provider.escalas().slice().sort((a,b)=>String(a.data).localeCompare(String(b.data)))}
function meusExtras(){return provider.extras()}
function minhasPermutas(){return provider.permutas()}
function meuBanco(){return provider.bancoHoras().filter(x=>String(x.status||'ATIVO').toUpperCase()==='ATIVO')}

function renderPerfil(){
  const s=provider.session||{};
  $('perfilNome').textContent=s.nome||'';
  $('perfilCargo').textContent=s.cargo||s.role||'';
  $('perfilUsuario').textContent=s.usuario||s.username||'';
  $('perfilRole').textContent=s.role||'gcm';
  const ps=provider.permissoesEfetivas();
  $('listaPermissoes').innerHTML=provider.controleTotal()
    ? `<span class="badge">CONTROLE TOTAL · ${ps.length} módulos</span>`
    : ps.length
      ? ps.map(p=>`<span class="badge">${esc(p.modulo)} · ${esc(p.nivel)}</span>`).join(' ')
      : '<span class="muted">Sem permissões habilitadas no Desktop.</span>';
}
function renderModulos(){
  const lista=provider.modulosAutorizados();
  const el=$('listaModulos'); if(!el)return;
  if(!lista.length){el.innerHTML='<div class="empty">Nenhum módulo autorizado.</div>';return;}
  el.innerHTML=lista.map(m=>{
    const online=onlineCatalog.some(c=>c.modulo===m.id);
    const acao=m.mobile?`<button class="mini" data-open-mobile="${esc(m.mobile)}">Abrir no app</button>`:online?`<button class="mini" data-open-module="${esc(m.id)}">Abrir online</button>`:'<span class="muted module-state">Autorizado · sem tela online específica</span>';
    return `<article class="module-card ${m.mobile||online?'ready':'desktop-only'}"><div><strong>${esc(m.nome)}</strong><small>${esc(m.descricao)}</small></div><span class="level">${esc(m.nivel)}</span>${acao}</article>`;
  }).join('');
  document.querySelectorAll('[data-open-mobile]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.openMobile)));
  document.querySelectorAll('[data-open-module]').forEach(b=>b.addEventListener('click',()=>abrirModuloOnline(b.dataset.openModule)));
}

async function aplicarIdentidadeVisual(){
  try{
    const r=await fetch('./data/branding.json',{cache:'no-store'});
    if(!r.ok)return; const b=await r.json();
    const icon=b?.icone?.arquivo||'icon.png';
    ['loginIcone','headerIcone'].forEach(id=>{const el=$(id);if(el&&icon)el.src=icon;});
    if(b?.login?.arquivo){const tela=$('loginTela');if(tela){tela.style.backgroundImage=`linear-gradient(rgba(15,23,42,.78),rgba(30,41,59,.78)),url('${b.login.arquivo}')`;tela.style.backgroundSize='cover';tela.style.backgroundPosition='center';}}
  }catch{}
}


async function aplicarIdentidadeVisualRemota(){
  try{
    const lista=await provider.branding();
    const icon=lista.find(x=>x.finalidade==='ICONE_APP')||lista.find(x=>x.principal)||lista[0];
    const login=lista.find(x=>x.finalidade==='TELA_LOGIN')||lista.find(x=>x.finalidade==='LOGOMARCA');
    if(icon?.data_url) ['loginIcone','headerIcone'].forEach(id=>{const el=$(id);if(el)el.src=icon.data_url;});
    if(login?.data_url){const tela=$('loginTela');if(tela){tela.style.backgroundImage=`linear-gradient(rgba(15,23,42,.78),rgba(30,41,59,.78)),url('${login.data_url}')`;tela.style.backgroundSize='cover';tela.style.backgroundPosition='center';}}
  }catch{}
}

function renderInicio(){
  const escs=minhasEscalas(), banco=meuBanco();
  const saldo=banco.reduce((a,x)=>a+(String(x.natureza).toUpperCase()==='DEBITO'?-Number(x.minutos||0):Number(x.minutos||0)),0);
  $('mEscalas').textContent=escs.length;
  $('mExtras').textContent=meusExtras().length;
  $('mPermutas').textContent=minhasPermutas().length;
  $('mSaldo').textContent=horas(saldo);
  const hoje=new Date().toISOString().slice(0,10);
  const prox=escs.find(x=>String(x.data)>=hoje)||escs[0];
  $('proxima').innerHTML=prox
    ? `<div class="item"><small>${fmt(prox.data)} · Turno ${esc(prox.turno||'-')}</small><strong>${esc(prox.posto_nome||prox.hist_posto_nome||prox.posto||'Posto')}</strong><span>${esc(prox.hist_horario_inicio||'')}${prox.hist_horario_fim?' às '+esc(prox.hist_horario_fim):''}</span></div>`
    : '<div class="empty">Sem escala encontrada.</div>';
}
function renderEscalas(){
  const ini=$('escalaIni')?.value||'',fim=$('escalaFim')?.value||'',q=String($('escalaBusca')?.value||'').trim().toLowerCase();
  const e=minhasEscalas().filter(x=>{const d=String(x.data||'').slice(0,10);if(ini&&d<ini)return false;if(fim&&d>fim)return false;return !q||JSON.stringify(x).toLowerCase().includes(q)});
  if($('tituloEscalas')) $('tituloEscalas').textContent='Escalas / Relatórios';
  $('listaEscalas').innerHTML=e.length?e.map(x=>`<div class="item"><small>${fmt(x.data)} · Turno ${esc(x.turno||'-')}${x.nome_guerra?' · '+esc(x.nome_guerra):''}</small><strong>${esc(x.posto_nome||x.hist_posto_nome||x.posto||'Posto')}</strong><span>${esc(x.horario_inicio||x.hist_horario_inicio||'')}${(x.horario_fim||x.hist_horario_fim)?' às '+esc(x.horario_fim||x.hist_horario_fim):''}</span>${x.motorista?'<small>Motorista</small>':''}${String(x.origem||'').toUpperCase().includes('EXTRA')?'<small>Extra</small>':''}</div>`).join(''):'<div class="empty">Nenhuma escala encontrada para o filtro informado.</div>';
}
function renderExtras(){
  const e=meusExtras(),gestor=provider.gestor();
  if($('tituloExtras')) $('tituloExtras').textContent=gestor?'Escalas extras autorizadas':'Minhas escalas extras';
  $('listaExtras').innerHTML=e.length?e.map(x=>`<div class="item"><small>${fmt(x.data)}${gestor&&x.nome_guerra?' · '+esc(x.nome_guerra):''}</small><strong>${esc(x.horario_inicio||'')} às ${esc(x.horario_fim||'')}</strong><span>${esc(x.status||'')}</span></div>`).join(''):'<div class="empty">Nenhuma escala extra encontrada.</div>';
}
function renderBanco(){
  const b=meuBanco(),gestor=provider.gestor();let c50=0,c100=0,d=0;
  if($('tituloBanco')) $('tituloBanco').textContent=gestor?'Banco de horas autorizado':'Meu banco de horas';
  for(const x of b){
    const sign=String(x.natureza).toUpperCase()==='DEBITO'?-1:1;
    const m=sign*Number(x.minutos||0);
    if(sign<0)d+=Number(x.minutos||0);
    if(String(x.classe)==='100')c100+=m; else c50+=m;
  }
  $('bh50').textContent=horas(c50);$('bh100').textContent=horas(c100);$('bhDeb').textContent=horas(d);$('bhSaldo').textContent=horas(c50+c100);
  $('listaBanco').innerHTML=b.slice(0,40).map(x=>`<div class="item"><small>${fmt(x.data_fato)} · ${esc(x.classe||'50')}%${gestor&&x.nome_guerra?' · '+esc(x.nome_guerra):''}</small><strong>${esc(x.tipo||x.origem||'Movimentação')}</strong><span>${String(x.natureza).toUpperCase()==='DEBITO'?'-':'+'}${horas(x.minutos)}</span></div>`).join('')||'<div class="empty">Sem movimentações.</div>';
}


function valorOnline(v){if(v==null)return'';if(typeof v==='object')return JSON.stringify(v);return String(v)}
let onlineModuleFilter='';
function renderCatalogoOnline(){
  const el=$('onlineEntidades');if(!el)return;
  const lista=onlineModuleFilter?onlineCatalog.filter(c=>c.modulo===onlineModuleFilter):onlineCatalog;
  el.innerHTML=lista.map(c=>`<article class="module-card ready" data-online-entity="${esc(c.entity)}"><div><strong>${esc(c.titulo)}</strong><small>${esc(c.modulo)} · ${c.can_edit?'edição online':'consulta online'}</small></div><span class="level">${c.can_edit?'EDIÇÃO':'CONSULTA'}</span></article>`).join('')||'<div class="empty">Nenhum conjunto de dados online autorizado para este módulo.</div>';
  document.querySelectorAll('[data-online-entity]').forEach(x=>x.addEventListener('click',()=>abrirEntidadeOnline(x.dataset.onlineEntity)));
}
async function carregarOnlineCatalog(){
  try{onlineCatalog=await provider.entityCatalog();onlineModuleFilter='';renderCatalogoOnline();renderModulos();}
  catch(e){const el=$('onlineEntidades');if(el)el.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function abrirModuloOnline(modulo){onlineModuleFilter=modulo;setView('online');$('onlineRegistrosCard').classList.add('hidden');$('onlineEntidades').closest('.card').classList.remove('hidden');renderCatalogoOnline();}
async function abrirEntidadeOnline(entity){
  const b=await provider.entityList(entity,500,0);onlineCurrent=b.catalog;onlineRecords=b.records||[];
  $('onlineTitulo').textContent=onlineCurrent.titulo;$('onlineNovo').classList.toggle('hidden',!onlineCurrent.can_edit);
  $('onlineEntidades').closest('.card').classList.add('hidden');$('onlineRegistrosCard').classList.remove('hidden');
  renderRegistrosOnline();
}
function renderRegistrosOnline(){
  const q=String($('onlineFiltro')?.value||'').toLowerCase(),el=$('onlineRegistros');if(!el||!onlineCurrent)return;
  const list=onlineRecords.filter(r=>JSON.stringify(r.data||{}).toLowerCase().includes(q));
  el.innerHTML=list.map(r=>{
    const pairs=Object.entries(r.data||{}).filter(([k])=>!String(k).toLowerCase().includes('dados')).slice(0,14);
    return `<div class="item" data-online-key="${esc(r.record_key)}"><div class="online-kv">${pairs.map(([k,v])=>`<b>${esc(k)}</b><span>${esc(valorOnline(v))}</span>`).join('')}</div>${onlineCurrent.can_edit?`<div class="online-record-actions"><button class="mini" data-online-edit="${esc(r.record_key)}">Editar</button><button class="mini" data-online-del="${esc(r.record_key)}">Excluir</button></div>`:''}</div>`;
  }).join('')||'<div class="empty">Nenhum registro.</div>';
  document.querySelectorAll('[data-online-edit]').forEach(b=>b.addEventListener('click',()=>editarOnline(b.dataset.onlineEdit)));
  document.querySelectorAll('[data-online-del]').forEach(b=>b.addEventListener('click',()=>excluirOnline(b.dataset.onlineDel)));
}
function campoOnline(col,val){
  if(Number(col.pk)>0)return'';
  const type=String(col.type||'').toUpperCase(),name=col.name,v=valorOnline(val);
  if(type.includes('INT')||type.includes('REAL')||type.includes('NUM')) return `<label>${esc(name)}<input data-online-field="${esc(name)}" type="number" value="${esc(v)}"></label>`;
  if(v.length>100||/observ|descr|histor|demanda|dados/i.test(name)) return `<label class="full">${esc(name)}<textarea data-online-field="${esc(name)}">${esc(v)}</textarea></label>`;
  return `<label>${esc(name)}<input data-online-field="${esc(name)}" value="${esc(v)}"></label>`;
}
function editarOnline(key=null){
  onlineEditing=key?onlineRecords.find(r=>String(r.record_key)===String(key)):null;const d=onlineEditing?.data||{};
  $('onlineEditorTitulo').textContent=(onlineEditing?'Editar ':'Novo ')+(onlineCurrent?.titulo||'registro');
  $('onlineCampos').innerHTML=(onlineCurrent?.columns||[]).map(c=>campoOnline(c,d[c.name])).join('');
  $('onlineMsg').textContent='';$('onlineEditor').showModal();
}
async function salvarOnline(){
  try{
    const d={...(onlineEditing?.data||{})};
    document.querySelectorAll('[data-online-field]').forEach(i=>{let v=i.value;const c=onlineCurrent.columns.find(x=>x.name===i.dataset.onlineField);if(/INT|REAL|NUM/i.test(String(c?.type||''))&&v!=='')v=Number(v);d[i.dataset.onlineField]=v});
    await provider.entityMutate(onlineCurrent.entity,onlineEditing?.record_key||'','UPSERT',d);
    $('onlineEditor').close();await abrirEntidadeOnline(onlineCurrent.entity);
  }catch(e){$('onlineMsg').textContent=e.message}
}
async function excluirOnline(key){
  if(!confirm('Excluir este registro online?'))return;
  try{const r=onlineRecords.find(x=>String(x.record_key)===String(key));await provider.entityMutate(onlineCurrent.entity,key,'DELETE',r?.data||{});await abrirEntidadeOnline(onlineCurrent.entity)}catch(e){alert(e.message)}
}
function voltarOnline(){
  $('onlineRegistrosCard').classList.add('hidden');$('onlineEntidades').closest('.card').classList.remove('hidden');onlineCurrent=null;onlineRecords=[];$('onlineFiltro').value='';renderCatalogoOnline();
}
async function atualizarAoVivo(){
  if(!provider.session)return;
  try{await provider.load();renderTudo(false);await aplicarIdentidadeVisualRemota();if(onlineCurrent)await abrirEntidadeOnline(onlineCurrent.entity)}catch{}
}

function renderAvisos(){
  const lista=provider.notifications().slice();
  const naoLidas=lista.filter(x=>!x.lida_em).length;
  const badge=$('navAvisosBadge'); if(badge){badge.textContent=naoLidas?String(naoLidas):'';badge.classList.toggle('hidden',!naoLidas);}
  $('listaAvisos').innerHTML=lista.length?lista.map(x=>`<div class="item notice-item ${x.lida_em?'':'unread'}" data-notification-id="${x.id}"><small>${fmt(String(x.created_at||'').slice(0,10))}${x.data_evento?' · evento '+fmt(x.data_evento):''}</small><strong>${esc(x.titulo||'Aviso')}</strong><span>${esc(x.mensagem||'')}</span>${x.lida_em?'':'<button class="mini" data-read="'+x.id+'">Marcar como lido</button>'}</div>`).join(''):'<div class="empty">Nenhuma notificação.</div>';
  document.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',async()=>{try{await provider.markNotificationRead(Number(b.dataset.read));renderAvisos();}catch(e){alert(e.message)}}));
}


function renderSolicitacoes(){
  const lista=provider.actionRequests();
  $('listaSolicitacoes').innerHTML=lista.length?lista.map(x=>`<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} · ${esc(x.tipo||'')}</small><strong>${esc(x.status||'PENDENTE')}</strong><span>${esc(x.resposta||'Aguardando processamento pelo Desktop.')}</span></div>`).join(''):'<div class="empty">Nenhuma solicitação enviada pelo aplicativo.</div>';
}
function renderPermutaCandidates(){
  const el=$('pmSubstituto'); if(!el)return;
  const lista=provider.permutationCandidates();
  el.innerHTML='<option value="">Selecione</option>'+lista.map(x=>`<option value="${x.guarda_id}">${esc(x.nome_guerra||('GCM '+x.guarda_id))}</option>`).join('');
}
async function enviarBancoCorrecao(ev){
  ev.preventDefault();const h=Number($('bcHoras').value||0),m=Number($('bcMinutos').value||0),total=h*60+m;
  $('bcMsg').textContent='Enviando...';
  try{
    await provider.requestBankCorrection({competencia:$('bcComp').value,data_servico:$('bcData').value,minutos_solicitados:total,classe:$('bcClasse').value,tipo_correcao:'HORAS_NAO_LANCADAS',descricao:$('bcDescricao').value});
    $('bcMsg').textContent='Solicitação enviada ao Desktop.';$('bcDescricao').value='';renderTudo();
  }catch(e){$('bcMsg').textContent=e.message}
}
async function enviarPermuta(ev){
  ev.preventDefault();$('pmMsg').textContent='Enviando...';
  try{
    await provider.requestPermuta({data:$('pmData').value,turno:$('pmTurno').value,servico_extra:Number($('pmExtra').value),substituto_id:Number($('pmSubstituto').value),observacao:$('pmObs').value,concordou_termo:$('pmTermo').checked});
    $('pmMsg').textContent='Solicitação enviada ao Desktop para análise.';$('pmObs').value='';$('pmTermo').checked=false;renderTudo();
  }catch(e){$('pmMsg').textContent=e.message}
}

function renderTudo(resetView=true){
  aplicarPermissoes();
  renderPerfil();
  renderModulos();
  if(temAcesso('dashboard')) renderInicio();
  if(temAcesso('escalas')) renderEscalas();
  if(temAcesso('extras')) renderExtras();
  if(temAcesso('banco_horas')) renderBanco();
  renderAvisos();
  renderSolicitacoes();
  renderPermutaCandidates();
  if(resetView){
    const primeiro=[['inicio','dashboard'],['escala','escalas'],['extras','extras'],['banco','banco_horas'],['online','perfil'],['acessos','perfil'],['avisos','perfil'],['perfil','perfil']].find(([,m])=>temAcesso(m));
    setView(primeiro?.[0]||'perfil');
  }
}

async function entrar(e){
  e.preventDefault();
  $('loginErro').textContent='';
  $('entrar').disabled=true;
  try{
    await provider.login($('loginUsuario').value,$('loginSenha').value);
    configurarPushNativo(provider).catch(()=>{});
    $('loginTela').classList.add('hidden');
    $('appTela').classList.remove('hidden');
    renderTudo();
    aplicarIdentidadeVisualRemota().catch(()=>{});
    carregarOnlineCatalog().catch(()=>{});
  }catch(err){
    $('loginErro').textContent=err.message||'Falha no login.';
  }finally{
    $('entrar').disabled=false;
  }
}
async function sair(){
  await provider.logout();
  $('appTela').classList.add('hidden');
  $('loginTela').classList.remove('hidden');
  $('loginSenha').value='';
  $('loginErro').textContent='';
}
async function boot(){
  await aplicarIdentidadeVisual();
  $('loginForm').addEventListener('submit',entrar);
  $('sair').addEventListener('click',sair);
  $('formBancoCorrecao')?.addEventListener('submit',enviarBancoCorrecao);
  $('formPermuta')?.addEventListener('submit',enviarPermuta);
  document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.go);if(b.dataset.go==='online')carregarOnlineCatalog().catch(()=>{})}));
  $('onlineVoltar')?.addEventListener('click',voltarOnline);
  $('onlineFiltro')?.addEventListener('input',renderRegistrosOnline);
  $('onlineNovo')?.addEventListener('click',()=>editarOnline());
  $('onlineSalvar')?.addEventListener('click',salvarOnline);
  $('onlineCancelar')?.addEventListener('click',()=>$('onlineEditor').close());
  ['escalaIni','escalaFim','escalaBusca'].forEach(id=>$(id)?.addEventListener(id==='escalaBusca'?'input':'change',renderEscalas));
  $('escalaLimpar')?.addEventListener('click',()=>{if($('escalaIni'))$('escalaIni').value='';if($('escalaFim'))$('escalaFim').value='';if($('escalaBusca'))$('escalaBusca').value='';renderEscalas();});
  window.addEventListener('gcmbs:push-received',async()=>{try{await provider.load();renderTudo();}catch{}});
  const s=await provider.restore();
  if(s){
    configurarPushNativo(provider).catch(()=>{});
    $('loginTela').classList.add('hidden');
    $('appTela').classList.remove('hidden');
    renderTudo();
    aplicarIdentidadeVisualRemota().catch(()=>{});
    carregarOnlineCatalog().catch(()=>{});
  }
  setInterval(()=>{if(!document.hidden)atualizarAoVivo()},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)atualizarAoVivo()});
}
boot();

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=100033',{updateViaCache:'none'}).catch(()=>{});}
