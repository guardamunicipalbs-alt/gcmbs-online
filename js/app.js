
import {AuthenticatedProvider} from './data-provider.js';
import {MODULOS_GCMBS} from './access-catalog.js';
import {configurarPushNativo} from './native-push.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{if(!d)return'';const [y,m,day]=String(d).slice(0,10).split('-');return `${day}/${m}/${y}`};
const horas=min=>{const n=Number(min||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`};
let provider=new AuthenticatedProvider();
let onlineCatalog=[],onlineCurrent=null,onlineRecords=[],onlineEditing=null,quadroAtual=null;

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
    b.classList.toggle('hidden',b.dataset.go==='inicio'?false:!temAcesso(mod));
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

function hoje(){return new Date().toISOString().slice(0,10)}
function normalizar(v){return String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function horarioRelatorio(item){
  const turno=String(item.turno||'').toUpperCase();
  if(turno==='B')return '19:00 às 07:00';
  const hi=String(item.horario_inicio||item.hist_horario_inicio||'').slice(0,5),hf=String(item.horario_fim||item.hist_horario_fim||'').slice(0,5);
  if(hi==='07:00'&&hf==='17:00')return '07:00 às 17:00';
  return '07:00 às 19:00';
}
function nomeEscala(x){return x.nome_guerra||x.hist_guarda_nome_guerra||x.guarda_nome||x.guarda||'GCM'}
function postoEscala(x){return String(x.posto_nome||x.hist_posto_nome||x.posto||'').trim()}
function motoristaEscala(x,nome){const m=normalizar(x.motorista);return !!m&&(m===normalizar(nome)||m===normalizar(x.guarda_nome)||m===normalizar(x.hist_guarda_nome_guerra))}
function montarGruposEscala(registros){
  const grupos=new Map();
  for(const item of registros){
    const posto=postoEscala(item);if(!posto)continue;
    const turno=String(item.turno||'A').toUpperCase(),horario=horarioRelatorio(item),prioridade=Number(item.posto_prioridade??item.hist_posto_prioridade??9999),chave=`${posto}\0${turno}\0${horario}`;
    if(!grupos.has(chave))grupos.set(chave,{posto,turno,horario,prioridade,itens:new Map()});
    const g=grupos.get(chave),arr=g.itens.get(item.data)||[],nome=nomeEscala(item),ex=arr.find(x=>normalizar(x.nome)===normalizar(nome)),motorista=motoristaEscala(item,nome),veiculo=String(item.viatura||item.hist_viatura_prefixo||'').trim(),extra=normalizar(item.origem).includes('EXTRA');
    if(ex){ex.motorista=ex.motorista||motorista;ex.veiculo=ex.veiculo||veiculo;ex.extra=ex.extra||extra}else arr.push({nome,motorista,veiculo,extra});
    g.itens.set(item.data,arr);g.prioridade=Math.min(g.prioridade,prioridade);
  }
  return [...grupos.values()].sort((a,b)=>(a.prioridade-b.prioridade)||normalizar(a.posto).localeCompare(normalizar(b.posto))||a.turno.localeCompare(b.turno));
}
function gerarDatas(ini,fim){const out=[];if(!ini||!fim||fim<ini)return out;const d=new Date(`${ini}T00:00:00Z`),f=new Date(`${fim}T00:00:00Z`);while(d<=f){out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out}
function preencherFiltrosEscala(){
  const dados=provider.escalas();
  const nomes=[...new Set(dados.map(nomeEscala).filter(Boolean))].sort((a,b)=>normalizar(a).localeCompare(normalizar(b)));
  const postos=[...new Set(dados.map(postoEscala).filter(Boolean))].sort((a,b)=>normalizar(a).localeCompare(normalizar(b)));
  const g=$('escalaGcm'),p=$('escalaPosto');if(g){const v=g.value;g.innerHTML='<option value="">Todos os GCMs</option>'+nomes.map(x=>`<option>${esc(x)}</option>`).join('');g.value=v}if(p){const v=p.value;p.innerHTML='<option value="">Todos os postos</option>'+postos.map(x=>`<option>${esc(x)}</option>`).join('');p.value=v}
}
function renderEscalas(){
  preencherFiltrosEscala();
  const ini=$('escalaIni')?.value||'',fim=$('escalaFim')?.value||'',gcm=$('escalaGcm')?.value||'',posto=$('escalaPosto')?.value||'',horario=$('escalaHorario')?.value||'';
  if(!ini||!fim){$('cabecalhoMatrizMobile').innerHTML='<th class="col-posto">POSTO / HORÁRIO</th>';$('resultadoMatrizMobile').innerHTML='<tr><td>Informe o período para consultar.</td></tr>';return}
  let dados=provider.escalas().filter(x=>{const d=String(x.data||'').slice(0,10);if(d<ini||d>fim)return false;if(gcm&&normalizar(nomeEscala(x))!==normalizar(gcm))return false;if(posto&&normalizar(postoEscala(x))!==normalizar(posto))return false;if(horario&&horarioRelatorio(x)!==horario)return false;return true});
  let datas=gerarDatas(ini,fim);if(gcm){const ds=new Set(dados.map(x=>String(x.data||'').slice(0,10)));datas=datas.filter(d=>ds.has(d))}
  const grupos=montarGruposEscala(dados);
  $('cabecalhoMatrizMobile').innerHTML='<th class="col-posto">POSTO / HORÁRIO</th>'+datas.map(d=>`<th>${fmt(d)}</th>`).join('');
  $('resultadoMatrizMobile').innerHTML=grupos.map(g=>`<tr><th class="posto-linha"><b>${esc(g.posto)}</b><span>${esc(g.horario)}</span></th>${datas.map(d=>{const itens=g.itens.get(d)||[];return itens.length?`<td>${itens.map(x=>`<div class="gcm-linha"><b>${esc(x.nome)}</b>${x.motorista?`<span class="tag-driver">MOTORISTA${x.veiculo?' - '+esc(x.veiculo):''}</span>`:''}${x.extra?'<span class="tag-extra">Extra</span>':''}</div>`).join('')}</td>`:'<td class="vazio">—</td>'}).join('')}</tr>`).join('')||`<tr><td colspan="${Math.max(1,datas.length+1)}">Nenhuma escala encontrada para os filtros informados.</td></tr>`;
  $('escalaInfo').textContent=`${dados.length} registro(s) · ${fmt(ini)} a ${fmt(fim)}`;
  $('escalaFiltroAtivo').textContent=[gcm&&`GCM: ${gcm}`,posto&&`Posto: ${posto}`,horario&&`Horário: ${horario}`].filter(Boolean).join(' · ')||'Todos os GCMs, postos e horários';
}
function detalhesQuadro(caminho){const [g,k]=String(caminho||'').split('.');if(!quadroAtual)return[];if(g==='efetivo')return quadroAtual.efetivo?.detalhes?.[k]||[];if(g==='viaturas')return quadroAtual.viaturas?.detalhes?.[k]||[];if(g==='postos'&&k==='cobertos')return quadroAtual.postos?.detalhamento||[];return[]}
function abrirQuadroDetalhe(titulo,caminho){const itens=detalhesQuadro(caminho);$('quadroModalTitulo').textContent=titulo||'Detalhes';$('quadroModalMeta').textContent=`Data de referência: ${fmt(quadroAtual?.data||$('quadroData').value)} · ${itens.length} registro(s)`;$('quadroModalLista').innerHTML=itens.length?itens.map(x=>`<div class="item"><strong>${esc(x.nome||'-')}</strong><span>${esc(x.complemento||'')}</span></div>`).join(''):'<div class="empty">Nenhum registro compõe este indicador na data selecionada.</div>';$('quadroModal').classList.remove('hidden')}
function renderInicio(){
  const s=provider.session||{};$('perfilNome').textContent=s.nome||'';$('perfilCargo').textContent=s.cargo||s.role||'';
}
async function carregarQuadro(){
  const data=$('quadroData')?.value||hoje();$('qAviso').textContent='Atualizando Quadro Operacional...';
  try{const d=await provider.quadro(data);quadroAtual=d;$('qAtivos').textContent=d.efetivo?.ativos||0;$('qAfastados').textContent=d.efetivo?.afastados||0;$('qFerias').textContent=d.efetivo?.feristas||0;$('qServicoA').textContent=d.efetivo?.servicoA||0;$('qServicoB').textContent=d.efetivo?.servicoB||0;$('qViaturasTotal').textContent=d.viaturas?.total||0;$('qViaturasDisponiveis').textContent=d.viaturas?.disponivel||0;$('qViaturasUso').textContent=d.viaturas?.emUso||0;$('qViaturasBaixadas').textContent=d.viaturas?.baixadas||0;$('qViaturasManut').textContent=d.viaturas?.manutencao||0;$('qPostos').textContent=d.postos?.cobertos||0;$('qAviso').textContent=(d.cnhVencidas||[]).length?`⚠ CNH vencida: ${d.cnhVencidas.length} GCM(s).`:'Sem avisos de CNH vencida para a data selecionada.'}catch(e){$('qAviso').textContent='Não foi possível carregar o Quadro Operacional: '+e.message}
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

  const req=provider.actionRequests().filter(x=>String(x.tipo||'').toUpperCase()==='BANCO_HORAS_CORRECAO');
  const lr=$('listaCorrecoes');if(lr)lr.innerHTML=req.length?req.map(x=>{const p=x.payload||{},min=Number(p.minutos_solicitados||0),status=String(x.status||'PENDENTE').toUpperCase();return `<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} · ${esc(p.data_servico||'')} · ${horas(min)}</small><strong>${esc(status)}</strong><span>${esc(p.descricao||'Solicitação de correção')}</span>${x.resposta?`<small>${esc(x.resposta)}</small>`:''}</div>`}).join(''):'<div class="empty">Nenhuma solicitação de correção enviada.</div>';
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
  ev.preventDefault();const h=Number($('bcHoras').value||0),m=Number($('bcMinutos').value||0),total=h*60+m,msg=$('bcMsg'),btn=$('bcEnviar');
  msg.className='full request-message';
  if(total<30||total%30!==0){msg.textContent='A correção deve ter no mínimo 30 minutos e sempre em blocos de 30 minutos.';msg.classList.add('error');return}
  btn.disabled=true;msg.textContent='Enviando...';
  try{
    const comp=$('bcComp').value,data=$('bcData').value,classe=$('bcClasse').value,descricao=$('bcDescricao').value;
    const r=await provider.requestBankCorrection({competencia:comp,data_servico:data,minutos_solicitados:total,classe,tipo_correcao:'HORAS_NAO_LANCADAS',descricao});
    msg.textContent=`Solicitação enviada com sucesso${r?.request?.id?' · protocolo #'+r.request.id:''}. Aguardando análise do Comando.`;msg.classList.add('success');
    $('bcComp').value='';$('bcData').value='';$('bcHoras').value='0';$('bcMinutos').value='0';$('bcClasse').value='50';$('bcDescricao').value='';
    renderTudo(false);setView('banco');
  }catch(e){msg.textContent=e.message;msg.classList.add('error')}finally{btn.disabled=false}
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
  renderInicio();
  if(temAcesso('escalas')) renderEscalas();
  if(temAcesso('extras')) renderExtras();
  if(temAcesso('banco_horas')) renderBanco();
  renderAvisos();
  renderSolicitacoes();
  renderPermutaCandidates();
  if(resetView){
    setView('inicio');carregarQuadro().catch(()=>{});
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
    carregarOnlineCatalog().catch(()=>{});carregarQuadro().catch(()=>{});
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
  await aplicarIdentidadeVisual();if($('quadroData'))$('quadroData').value=hoje();if($('escalaIni'))$('escalaIni').value=hoje();if($('escalaFim'))$('escalaFim').value=hoje();
  $('loginForm').addEventListener('submit',entrar);
  $('sair').addEventListener('click',sair);
  $('formBancoCorrecao')?.addEventListener('submit',enviarBancoCorrecao);
  $('formPermuta')?.addEventListener('submit',enviarPermuta);
  document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.go);if(b.dataset.go==='online')carregarOnlineCatalog().catch(()=>{});if(b.dataset.go==='inicio')carregarQuadro().catch(()=>{});if(b.dataset.go==='escala')renderEscalas()}));
  $('onlineVoltar')?.addEventListener('click',voltarOnline);
  $('onlineFiltro')?.addEventListener('input',renderRegistrosOnline);
  $('onlineNovo')?.addEventListener('click',()=>editarOnline());
  $('onlineSalvar')?.addEventListener('click',salvarOnline);
  $('onlineCancelar')?.addEventListener('click',()=>$('onlineEditor').close());
  ['escalaIni','escalaFim','escalaGcm','escalaPosto','escalaHorario'].forEach(id=>$(id)?.addEventListener('change',renderEscalas));
  $('escalaGerar')?.addEventListener('click',renderEscalas);
  $('escalaLimpar')?.addEventListener('click',()=>{['escalaIni','escalaFim','escalaGcm','escalaPosto','escalaHorario'].forEach(id=>{if($(id))$(id).value=''});renderEscalas();});
  $('quadroData')?.addEventListener('change',()=>carregarQuadro().catch(()=>{}));
  document.querySelectorAll('[data-quadro-detail]').forEach(b=>b.addEventListener('click',()=>abrirQuadroDetalhe(b.dataset.title,b.dataset.quadroDetail)));
  $('quadroModalFechar')?.addEventListener('click',()=>$('quadroModal').classList.add('hidden'));
  $('quadroModal')?.addEventListener('click',e=>{if(e.target===$('quadroModal'))$('quadroModal').classList.add('hidden')});
  window.addEventListener('gcmbs:push-received',async()=>{try{await provider.load();renderTudo();}catch{}});
  const s=await provider.restore();
  if(s){
    configurarPushNativo(provider).catch(()=>{});
    $('loginTela').classList.add('hidden');
    $('appTela').classList.remove('hidden');
    renderTudo();
    aplicarIdentidadeVisualRemota().catch(()=>{});
    carregarOnlineCatalog().catch(()=>{});carregarQuadro().catch(()=>{});
  }
  setInterval(()=>{if(!document.hidden)atualizarAoVivo()},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)atualizarAoVivo()});
}
boot();

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=100034',{updateViaCache:'none'}).catch(()=>{});}
