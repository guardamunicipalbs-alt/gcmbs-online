
import {AuthenticatedProvider} from './data-provider.js';
import {MODULOS_GCMBS} from './access-catalog.js';
import {configurarPushNativo} from './native-push.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{if(!d)return'';const [y,m,day]=String(d).slice(0,10).split('-');return `${day}/${m}/${y}`};
const horas=min=>{const n=Number(min||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`};
let provider=new AuthenticatedProvider();
let onlineCatalog=[],onlineCurrent=null,onlineRecords=[],onlineEditing=null,quadroAtual=null,permutaEditingId=null,escalaModo='pessoal',escalasInstitucionais=[];

const ONLINE_LABELS={
  viatura_id:'Viatura',data_manutencao:'Data da manutenção',tipo_manutencao:'Tipo de manutenção',descricao:'Descrição',
  quilometragem:'Quilometragem',responsavel:'Responsável',empresa:'Empresa / oficina',valor:'Valor',status:'Status',
  observacao:'Observação',data_retorno:'Data de retorno',recebido_por:'Recebido por',consertado:'Consertado',
  encaminhado_por:'Encaminhado por',atendente_oficina:'Atendente da oficina',data_abastecimento:'Data do abastecimento',
  motorista:'Motorista',motorista_id:'Motorista',litros:'Litros',guarda_id:'GCM',data_inicial:'Data inicial',
  quantidade_dias:'Quantidade de dias',data_final:'Data final',motivo:'Motivo / justificativa',tipo_servico:'Tipo do serviço',
  arquivo_nome:'Documento',arquivo_tipo:'Tipo do documento',arquivo_dados:'Arquivo',criado_em:'Criado em',atualizado_em:'Atualizado em'
};
const ONLINE_HIDE_FIELDS=new Set(['criado_por','analisado_por','arquivo_dados','arquivo_tipo','criado_em','atualizado_em']);
const onlineLabel=k=>ONLINE_LABELS[k]||String(k||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const refData=()=>provider.references?.()||{viaturas:[],guardas:[]};
function viaturaPorId(v){const x=(refData().viaturas||[]).find(r=>Number(r.id)===Number(v));return x?[x.prefixo,x.placa].filter(Boolean).join(' · '):''}
function guardaPorId(v){const x=(refData().guardas||[]).find(r=>Number(r.id)===Number(v));return x?.nome_guerra||x?.nome_completo||''}
function valorApresentacao(k,v){
  if(v==null||v==='')return '—';
  if(k==='viatura_id')return viaturaPorId(v)||`Viatura #${v}`;
  if(/^(guarda_id|substituido_id|substituto_id|motorista_id|recebido_por|encaminhado_por|responsavel_id|condutor_ocorrencia_id)$/.test(k))return guardaPorId(v)||pessoaPorId(v)||`GCM #${v}`;
  if(/^data_|_em$/.test(k)||['data_inicial','data_final','criado_em','atualizado_em'].includes(k)){const d=fmt(String(v).slice(0,10));return d||String(v)}
  if(k==='valor'){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):String(v)}
  if(k==='consertado')return Number(v)?'Sim':'Não';
  if(k==='tipo_servico')return String(v).toUpperCase()==='EXTRA'?'Serviço extra':'Serviço ordinário';
  return String(v);
}

const NAV_GROUPS=[
  {id:'operacional',titulo:'Operacional',mods:['dashboard','cadastro_guardas','equipes','postos']},
  {id:'escalas',titulo:'Escalas',mods:['gerador_escala','escalas','tipos_escalas','escala_extra_manual','feriados','permutas','justificativas_faltas','eventos_extra','folha_pagamento','banco_horas','relatorios']},
  {id:'frota',titulo:'Frota',mods:['viaturas','manutencao_viaturas','abastecimento_viaturas','checklist_viaturas','relatorios_frota']},
  {id:'gestao',titulo:'Gestão Institucional',mods:['ocorrencias','cautelas','cursos','operacoes_especiais','frequencia','central_pendencias','controle_acesso']},
  {id:'institucional',titulo:'Institucional',mods:['imagens_gcm']}
];
const NAV_ICONS={dashboard:'📊',cadastro_guardas:'👮',equipes:'👥',postos:'📍',gerador_escala:'🤖',escalas:'📋',tipos_escalas:'⚙️',escala_extra_manual:'➕',feriados:'📅',permutas:'🔄',justificativas_faltas:'📄',eventos_extra:'🎪',folha_pagamento:'💰',banco_horas:'⏱️',relatorios:'🖨️',viaturas:'🚓',manutencao_viaturas:'🔧',abastecimento_viaturas:'⛽',checklist_viaturas:'✅',relatorios_frota:'📑',ocorrencias:'📝',cautelas:'🎒',cursos:'🎓',operacoes_especiais:'✉️',frequencia:'📑',central_pendencias:'⚠️',controle_acesso:'🔐',imagens_gcm:'🖼️'};
const DEDICATED_VIEW={dashboard:'inicio',escalas:'escala',relatorios:'escala',permutas:'permutas',banco_horas:'banco',ocorrencias:'ocorrencias',eventos_extra:'eventos',justificativas_faltas:'justificativas'};
const PRIMARY_ENTITY={justificativas_faltas:'justificativas_faltas',manutencao_viaturas:'manutencao_viaturas',abastecimento_viaturas:'abastecimento_viaturas',checklist_viaturas:'checklist_viaturas'};
function setView(id){
  document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('hidden',x.dataset.view!==id));
  document.querySelectorAll('#mainNav [data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===id));
  fecharMenu();
}
function temAcesso(modulo){
  if(modulo==='perfil'||modulo==='avisos') return true;
  if(modulo==='escalas') return provider.pode('escalas') || provider.pode('relatorios');
  return provider.pode(modulo);
}
function renderNavegacao(){
  const host=$('navGroups'); if(!host)return;
  const byId=new Map(MODULOS_GCMBS.map(m=>[m.id,m]));
  host.innerHTML=NAV_GROUPS.map(g=>{
    const mods=g.mods.map(id=>byId.get(id)).filter(Boolean).filter(m=>temAcesso(m.id));
    if(!mods.length)return'';
    return `<section class="nav-group" data-nav-group="${esc(g.id)}"><div class="nav-group-title">${esc(g.titulo)}</div><div class="nav-group-body">${mods.map(m=>`<button type="button" data-module="${esc(m.id)}" title="${esc(m.descricao||m.nome)}"><span>${NAV_ICONS[m.id]||'•'}</span><span class="nav-label">${esc(m.nome)}</span></button>`).join('')}</div></section>`;
  }).join('');
  host.querySelectorAll('[data-module]').forEach(b=>b.addEventListener('click',()=>abrirModuloPrincipal(b.dataset.module)));
  const s=provider.session||{}; if($('headerUsuario'))$('headerUsuario').textContent=s.nome||s.nome_guerra||s.usuario||'';
}
function fecharMenu(){$('mainNav')?.classList.remove('open');$('navBackdrop')?.classList.add('hidden')}
function abrirMenu(){$('mainNav')?.classList.add('open');$('navBackdrop')?.classList.remove('hidden')}
async function abrirModuloPrincipal(modulo){
  if(!temAcesso(modulo)){alert('Você não possui acesso a este módulo.');return;}
  const ativar=()=>document.querySelectorAll('#mainNav [data-module]').forEach(x=>x.classList.toggle('active',x.dataset.module===modulo));
  if(modulo==='gerador_escala'){
    onlineModuleFilter='gerador_escala'; setView('online'); ativar();
    $('onlineEntidades').closest('.card').classList.remove('hidden'); $('onlineRegistrosCard').classList.add('hidden');
    $('onlineEntidades').innerHTML='<div class="notice module-safe-note"><strong>Gerador de Escala protegido</strong>A interface reconhece sua permissão, mas a execução do gerador continua no Desktop nesta versão. A lógica existente não foi alterada.</div>';
    return;
  }
  const view=DEDICATED_VIEW[modulo];
  if(view){if(modulo==='justificativas_faltas'){await abrirModuloOnline(modulo);ativar();return;}setView(view);ativar();if(view==='inicio')carregarQuadro().catch(()=>{});if(view==='escala'){escalaModo=modulo==='relatorios'?'institucional':'pessoal';if(escalaModo==='institucional'){try{escalasInstitucionais=await provider.relatorioEscalas()}catch(e){alert(e.message);escalasInstitucionais=[]}}renderEscalas();}return;}
  await abrirModuloOnline(modulo);ativar();
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
function modulosOutros(){
  const dedicados=new Set(['dashboard','escalas','relatorios','banco_horas','permutas','abastecimento_viaturas','manutencao_viaturas']);
  // Comandante/Subcomandante recebem o catálogo integral do Desktop. Para os
  // demais GCMs continuam valendo estritamente as permissões cadastradas.
  const base=provider.controleTotal()?MODULOS_GCMBS:provider.modulosAutorizados();
  return base.filter(m=>!dedicados.has(m.id) && !(m.id==='relatorios_frota'&&!provider.gestor()));
}
function renderModulos(){
  const lista=modulosOutros(),el=$('listaModulos');if(!el)return;
  if(!lista.length){el.innerHTML='<div class="empty">Nenhum outro módulo autorizado.</div>';return;}
  el.innerHTML=lista.map(m=>{const online=onlineCatalog.some(c=>c.modulo===m.id);const acao=online?`<button class="mini" data-open-module="${esc(m.id)}">Abrir</button>`:'<span class="muted module-state">Autorizado · aguardando tela online específica</span>';return `<article class="module-card ${online?'ready':'desktop-only'}"><div><strong>${esc(m.nome)}</strong><small>${esc(m.descricao)}</small></div><span class="level">${esc(m.nivel)}</span>${acao}</article>`;}).join('');
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
  const hi=String(item.horario_inicio||item.hist_horario_inicio||'').slice(0,5),hf=String(item.horario_fim||item.hist_horario_fim||'').slice(0,5);
  // Postos 24h podem vir do histórico como 07:00–07:00; na visão por turno
  // exibimos o intervalo efetivamente representado pela linha da escala.
  if(hi&&hf&&hi!==hf)return `${hi} às ${hf}`;
  if(turno==='B')return '19:00 às 07:00';
  if(turno==='A')return '07:00 às 19:00';
  return hi&&hf?`${hi} às ${hf}`:'07:00 às 19:00';
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
    const dia=String(item.data||'').slice(0,10),g=grupos.get(chave),arr=g.itens.get(dia)||[],nome=nomeEscala(item),ex=arr.find(x=>normalizar(x.nome)===normalizar(nome)),motorista=motoristaEscala(item,nome),veiculo=String(item.viatura||item.hist_viatura_prefixo||'').trim(),extra=normalizar(item.origem).includes('EXTRA');
    if(ex){ex.motorista=ex.motorista||motorista;ex.veiculo=ex.veiculo||veiculo;ex.extra=ex.extra||extra}else arr.push({nome,motorista,veiculo,extra});
    g.itens.set(dia,arr);g.prioridade=Math.min(g.prioridade,prioridade);
  }
  return [...grupos.values()].sort((a,b)=>(a.prioridade-b.prioridade)||normalizar(a.posto).localeCompare(normalizar(b.posto))||a.turno.localeCompare(b.turno));
}
function gerarDatas(ini,fim){const out=[];if(!ini||!fim||fim<ini)return out;const d=new Date(`${ini}T00:00:00Z`),f=new Date(`${fim}T00:00:00Z`);while(d<=f){out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out}
function dadosEscalaVisao(){return escalaModo==='institucional'?escalasInstitucionais:provider.escalas()}
function preencherFiltrosEscala(){
  const dados=dadosEscalaVisao();
  const nomes=[...new Set(dados.map(nomeEscala).filter(Boolean))].sort((a,b)=>normalizar(a).localeCompare(normalizar(b)));
  const postos=[...new Set(dados.map(postoEscala).filter(Boolean))].sort((a,b)=>normalizar(a).localeCompare(normalizar(b)));
  const g=$('escalaGcm'),p=$('escalaPosto');if(g){const v=g.value;g.innerHTML='<option value="">Todos os GCMs</option>'+nomes.map(x=>`<option>${esc(x)}</option>`).join('');g.value=v}if(p){const v=p.value;p.innerHTML='<option value="">Todos os postos</option>'+postos.map(x=>`<option>${esc(x)}</option>`).join('');p.value=v}
}
function renderEscalas(){
  preencherFiltrosEscala();
  const ini=$('escalaIni')?.value||'',fim=$('escalaFim')?.value||'',gcm=$('escalaGcm')?.value||'',posto=$('escalaPosto')?.value||'',horario=$('escalaHorario')?.value||'';
  if(!ini||!fim){$('cabecalhoMatrizMobile').innerHTML='<th class="col-posto">POSTO / HORÁRIO</th>';$('resultadoMatrizMobile').innerHTML='<tr><td>Informe o período para consultar.</td></tr>';return}
  let dados=dadosEscalaVisao().filter(x=>{const d=String(x.data||'').slice(0,10);if(d<ini||d>fim)return false;if(gcm&&normalizar(nomeEscala(x))!==normalizar(gcm))return false;if(posto&&normalizar(postoEscala(x))!==normalizar(posto))return false;if(horario&&horarioRelatorio(x)!==horario)return false;return true});
  let datas=gerarDatas(ini,fim);if(gcm||posto||horario){const ds=new Set(dados.map(x=>String(x.data||'').slice(0,10)));datas=datas.filter(d=>ds.has(d))}
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
function nomeCandidato(id){const x=provider.permutationCandidates().find(g=>Number(g.guarda_id)===Number(id));return x?.nome_guerra||'GCM';}
function renderViaturas(){
  $('cardAbastecimento')?.classList.toggle('hidden',!provider.pode('abastecimento_viaturas'));
  $('cardManutencao')?.classList.toggle('hidden',!provider.pode('manutencao_viaturas'));
}
async function atualizarSubstituidosPermuta(){
  const sel=$('pmSubstituto'),data=$('pmData')?.value,turno=$('pmTurno')?.value,msg=$('pmMsg'),btn=$('pmEnviar');if(!sel)return;
  sel.disabled=true;if(btn)btn.disabled=true;sel.innerHTML='<option value="">Consultando escala...</option>';
  if(msg){msg.className='full request-message';msg.textContent='';}
  if(!data||!turno){sel.innerHTML='<option value="">Selecione data e turno</option>';return;}
  try{
    const r=await provider.permutaCandidatesFor(data,turno);
    if(r.bloqueado){sel.innerHTML='<option value="">Indisponível neste período</option>';if(msg){msg.textContent=r.message;msg.classList.add('error');}return;}
    const lista=r.candidates||[];sel.innerHTML='<option value="">Selecione...</option>'+lista.map(x=>`<option value="${x.guarda_id}">${esc(x.nome_guerra||'GCM')}</option>`).join('');
    if(!lista.length)sel.innerHTML='<option value="">Nenhum GCM escalado neste período</option>';else{sel.disabled=false;if(btn)btn.disabled=false;}
  }catch(e){sel.innerHTML='<option value="">Não foi possível consultar</option>';if(msg){msg.textContent=e.message;msg.classList.add('error');}}
}
function renderPermutas(){
  const el=$('listaPermutasSolicitadas');if(!el)return;
  const req=provider.actionRequests().filter(x=>String(x.tipo||'').toUpperCase()==='PERMUTA');
  el.innerHTML=req.length?req.map(x=>{const q=x.payload||{},st=String(x.status||'PENDENTE').toUpperCase(),nome=nomeCandidato(q.substituido_id||q.substituto_id);return `<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} · ${esc(q.data||'')} · Turno ${esc(q.turno||'-')}</small><strong>GCM substituído: ${esc(nome)}</strong><span class="status-pill status-${esc(st)}">${esc(st)}</span>${q.observacao?`<span>${esc(q.observacao)}</span>`:''}${x.resposta?`<small>${esc(x.resposta)}</small>`:''}${x.editable?`<div class="request-actions"><button class="mini" data-pm-edit="${x.id}">Editar</button><button class="mini" data-pm-del="${x.id}">Excluir solicitação</button></div>`:''}</div>`}).join(''):'<div class="empty">Nenhuma solicitação de permuta enviada.</div>';
  document.querySelectorAll('[data-pm-edit]').forEach(b=>b.onclick=()=>editarPermutaSolicitacao(Number(b.dataset.pmEdit)));
  document.querySelectorAll('[data-pm-del]').forEach(b=>b.onclick=()=>cancelarPermutaSolicitacao(Number(b.dataset.pmDel)));
}
function resetPermutaForm(){permutaEditingId=null;$('pmTitulo').textContent='Nova solicitação de permuta';$('pmEnviar').textContent='Enviar solicitação';$('pmCancelarEdicao').classList.add('hidden');$('pmData').value='';$('pmTurno').value='A';$('pmExtra').value='0';$('pmSubstituto').value='';$('pmObs').value='';$('pmTermo').checked=false;}
async function editarPermutaSolicitacao(id){const x=provider.actionRequests().find(r=>Number(r.id)===id&&String(r.tipo).toUpperCase()==='PERMUTA');if(!x||!x.editable)return;const q=x.payload||{};permutaEditingId=id;$('pmTitulo').textContent='Editar solicitação de permuta';$('pmEnviar').textContent='Salvar alteração';$('pmCancelarEdicao').classList.remove('hidden');$('pmData').value=q.data||'';$('pmTurno').value=q.turno||'A';$('pmExtra').value=String(Number(q.servico_extra||0));$('pmObs').value=q.observacao||'';$('pmTermo').checked=!!q.concordou_termo;await atualizarSubstituidosPermuta();$('pmSubstituto').value=String(q.substituido_id||q.substituto_id||'');$('permutaCard').scrollIntoView({behavior:'smooth',block:'start'});}
async function cancelarPermutaSolicitacao(id){if(!confirm('Excluir/cancelar esta solicitação de permuta enquanto ainda está pendente?'))return;try{await provider.cancelPermutaRequest(id);renderTudo(false);setView('permutas')}catch(e){alert(e.message)}}
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
function pessoaPorId(v){const todos=[...(provider.guardas()||[]),...(provider.permutationCandidates()||[]),...(refData().guardas||[])];const x=todos.find(g=>Number(g.guarda_id||g.id)===Number(v));return x?.nome_guerra||x?.nome_completo||''}
function rotuloOnline(k,v){return valorApresentacao(k,v)}
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
async function abrirModuloOnline(modulo){
  if(!onlineCatalog.length){try{onlineCatalog=await provider.entityCatalog()}catch(e){onlineCatalog=[]}}
  onlineModuleFilter=modulo;setView('online');$('onlineRegistrosCard').classList.add('hidden');$('onlineEntidades').closest('.card').classList.remove('hidden');
  document.querySelectorAll('#mainNav [data-module]').forEach(x=>x.classList.toggle('active',x.dataset.module===modulo));
  const primary=PRIMARY_ENTITY[modulo],available=onlineCatalog.find(c=>c.entity===primary&&c.modulo===modulo);
  if(available){await abrirEntidadeOnline(primary);return;}
  renderCatalogoOnline();
}
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
    const pairs=Object.entries(r.data||{}).filter(([k])=>!ONLINE_HIDE_FIELDS.has(String(k).toLowerCase())&&!['id'].includes(String(k).toLowerCase())).slice(0,18);
    return `<div class="item" data-online-key="${esc(r.record_key)}"><div class="online-kv">${pairs.map(([k,v])=>`<b>${esc(onlineLabel(k))}</b><span>${esc(rotuloOnline(k,v))}</span>`).join('')}</div>${onlineCurrent.can_edit?`<div class="online-record-actions"><button class="mini" data-online-edit="${esc(r.record_key)}">Editar</button><button class="mini" data-online-del="${esc(r.record_key)}">Excluir</button></div>`:''}</div>`;
  }).join('')||'<div class="empty">Nenhum registro.</div>';
  document.querySelectorAll('[data-online-edit]').forEach(b=>b.addEventListener('click',()=>editarOnline(b.dataset.onlineEdit)));
  document.querySelectorAll('[data-online-del]').forEach(b=>b.addEventListener('click',()=>excluirOnline(b.dataset.onlineDel)));
}
function campoOnline(col,val){
  const name=String(col.name||''),lower=name.toLowerCase();
  if(Number(col.pk)>0||['criado_por','analisado_por','criado_em','atualizado_em','arquivo_dados','arquivo_tipo'].includes(lower))return'';
  if(onlineCurrent?.entity==='justificativas_faltas'&&['status','arquivo_nome'].includes(lower))return'';
  if(onlineCurrent?.entity==='abastecimento_viaturas'&&lower==='motorista')return'';
  if(lower==='guarda_id'&&!provider.gestor())return'';
  const type=String(col.type||'').toUpperCase(),v=valorOnline(val),label=onlineLabel(name);
  if(lower==='viatura_id'){
    const opts=(refData().viaturas||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc([x.prefixo,x.placa,x.modelo].filter(Boolean).join(' · '))}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(/^(guarda_id|substituido_id|substituto_id|motorista_id|recebido_por|encaminhado_por|responsavel_id|condutor_ocorrencia_id)$/.test(lower)){
    const opts=(refData().guardas||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc(x.nome_guerra||x.nome_completo||'GCM')}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='consertado')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="0" ${Number(v)!==1?'selected':''}>Não</option><option value="1" ${Number(v)===1?'selected':''}>Sim</option></select></label>`;
  if(lower==='tipo_servico')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="ORDINARIO" ${String(v||'ORDINARIO').toUpperCase()==='ORDINARIO'?'selected':''}>Serviço ordinário</option><option value="EXTRA" ${String(v).toUpperCase()==='EXTRA'?'selected':''}>Serviço extra</option></select></label>`;
  if(lower==='status')return `<label>${esc(label)}<input data-online-field="${esc(name)}" value="${esc(v||'ATIVA')}"></label>`;
  if(/^data_/.test(lower)||['data_inicial','data_final'].includes(lower)){
    const ro=onlineCurrent?.entity==='justificativas_faltas'&&lower==='data_final'?' readonly':'';
    return `<label>${esc(label)}<input data-online-field="${esc(name)}" type="date" value="${esc(String(v||'').slice(0,10))}"${ro}></label>`;
  }
  if(type.includes('INT')||type.includes('REAL')||type.includes('NUM')) return `<label>${esc(label)}<input data-online-field="${esc(name)}" type="number" step="${type.includes('REAL')?'0.01':'1'}" value="${esc(v)}"></label>`;
  if(v.length>100||/observ|descr|histor|demanda|motivo/i.test(lower)) return `<label class="full">${esc(label)}<textarea data-online-field="${esc(name)}">${esc(v)}</textarea></label>`;
  return `<label>${esc(label)}<input data-online-field="${esc(name)}" value="${esc(v)}"></label>`;
}

function editarOnline(key=null){
  onlineEditing=key?onlineRecords.find(r=>String(r.record_key)===String(key)):null;const d=onlineEditing?.data||{};
  $('onlineEditorTitulo').textContent=(onlineEditing?'Editar ':'Novo ')+(onlineCurrent?.titulo||'registro');
  $('onlineCampos').innerHTML=(onlineCurrent?.columns||[]).map(c=>campoOnline(c,d[c.name])).join('');
  if(onlineCurrent?.entity==='justificativas_faltas'){
    $('onlineCampos').insertAdjacentHTML('beforeend',`<label class="full">Documento comprobatório (JPG, PNG ou PDF)<input id="onlineArquivoJustificativa" type="file" accept="image/jpeg,image/png,application/pdf"><small>${d.arquivo_nome?`Atual: ${esc(d.arquivo_nome)}`:'Opcional'}</small></label>`);
  }
  $('onlineMsg').textContent='';$('onlineEditor').showModal();
}
async function salvarOnline(){
  try{
    const d={...(onlineEditing?.data||{})};
    document.querySelectorAll('[data-online-field]').forEach(i=>{let v=i.value;const c=onlineCurrent.columns.find(x=>x.name===i.dataset.onlineField);if(/INT|REAL|NUM/i.test(String(c?.type||''))&&v!=='')v=Number(v);d[i.dataset.onlineField]=v});
    if(onlineCurrent.entity==='justificativas_faltas'){
      if(!provider.gestor())d.guarda_id=Number(provider.session?.guarda_id);
      const ini=String(d.data_inicial||''),dias=Math.max(1,Number(d.quantidade_dias||1));if(ini){const dt=new Date(`${ini}T00:00:00Z`);dt.setUTCDate(dt.getUTCDate()+dias-1);d.data_final=dt.toISOString().slice(0,10)}
      d.status=d.status||'ATIVA';d.tipo_servico=d.tipo_servico||'ORDINARIO';
      const f=$('onlineArquivoJustificativa')?.files?.[0];if(f){if(f.size>5*1024*1024)throw new Error('O documento deve ter no máximo 5 MB.');const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||'').split(',')[1]||'');r.onerror=()=>rej(new Error('Não foi possível ler o documento.'));r.readAsDataURL(f)});d.arquivo_nome=f.name;d.arquivo_tipo=f.type;d.arquivo_dados=b64;}
    }
    if(onlineCurrent.entity==='abastecimento_viaturas'){
      if(!d.motorista_id)d.motorista_id=Number(provider.session?.guarda_id)||null;
      d.motorista=guardaPorId(d.motorista_id)||pessoaPorId(d.motorista_id)||d.motorista||'';
    }
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
  const decisoes=provider.actionRequests().filter(x=>['APROVADA','RECUSADA','REPROVADA','CANCELADA'].includes(String(x.status||'').toUpperCase())).map(x=>({created_at:x.processado_em||x.created_at,titulo:String(x.tipo).toUpperCase()==='PERMUTA'?'Decisão de permuta':'Decisão do Banco de Horas',mensagem:x.resposta||`Situação: ${x.status}`,synthetic:true}));
  const naoLidas=lista.filter(x=>!x.lida_em).length;
  const badge=$('navAvisosBadge'); if(badge){badge.textContent=naoLidas?String(naoLidas):'';badge.classList.toggle('hidden',!naoLidas);}
  const todos=[...decisoes,...lista];
  $('listaAvisos').innerHTML=todos.length?todos.map(x=>`<div class="item notice-item ${!x.synthetic&&!x.lida_em?'unread':''}" ${x.id?`data-notification-id="${x.id}"`:''}><small>${fmt(String(x.created_at||'').slice(0,10))}${x.data_evento?' · evento '+fmt(x.data_evento):''}</small><strong>${esc(x.titulo||'Aviso')}</strong><span>${esc(x.mensagem||'')}</span>${x.id&&!x.lida_em?'':' '}${x.id&&!x.lida_em?'<button class="mini" data-read="'+x.id+'">Marcar como lido</button>':''}</div>`).join(''):'<div class="empty">Nenhuma notificação.</div>';
  document.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',async()=>{try{await provider.markNotificationRead(Number(b.dataset.read));renderAvisos();}catch(e){alert(e.message)}}));
}


function renderSolicitacoes(){
  const lista=provider.actionRequests();
  $('listaSolicitacoes').innerHTML=lista.length?lista.map(x=>`<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} · ${esc(x.tipo||'')}</small><strong>${esc(x.status||'PENDENTE')}</strong><span>${esc(x.resposta||'Aguardando processamento pelo Desktop.')}</span></div>`).join(''):'<div class="empty">Nenhuma solicitação enviada pelo aplicativo.</div>';
}
function renderPermutaCandidates(){const el=$('pmSubstituto');if(!el)return;if(!$('pmData')?.value){el.disabled=true;el.innerHTML='<option value="">Selecione data e turno</option>';const btn=$('pmEnviar');if(btn)btn.disabled=true;}}
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
  ev.preventDefault();const msg=$('pmMsg');msg.className='full request-message';msg.textContent='Enviando...';
  try{const req={data:$('pmData').value,turno:$('pmTurno').value,servico_extra:Number($('pmExtra').value),substituido_id:Number($('pmSubstituto').value),observacao:$('pmObs').value,concordou_termo:$('pmTermo').checked};const r=permutaEditingId?await provider.updatePermutaRequest(permutaEditingId,req):await provider.requestPermuta(req);msg.textContent=permutaEditingId?'Solicitação atualizada. Aguardando decisão do Comando.':'Solicitação enviada. Acompanhe o histórico nesta tela.';msg.classList.add('success');resetPermutaForm();renderTudo(false);setView('permutas')}catch(e){msg.textContent=e.message;msg.classList.add('error')}
}

async function enviarMensagemComando(ev){ev.preventDefault();const ret=$('msgComandoRetorno');ret.className='full request-message';ret.textContent='Enviando...';try{const destino=$('msgDestino').value,ids=[...$('msgGcms').selectedOptions].map(o=>Number(o.value));const r=await provider.sendInstitutionalMessage({titulo:$('msgTitulo').value,mensagem:$('msgConteudo').value,destino,guarda_ids:ids});ret.textContent=`Mensagem enviada para ${r.enviadas||0} destinatário(s).`;ret.classList.add('success');$('msgTitulo').value='';$('msgConteudo').value='';await provider.load();renderAvisos()}catch(e){ret.textContent=e.message;ret.classList.add('error')}}
function renderMensagemComando(){const card=$('mensagemComandoCard');if(!card)return;card.classList.toggle('hidden',!provider.gestor());if(!provider.gestor())return;const sel=$('msgGcms');const pessoas=provider.permutationCandidates();sel.innerHTML=pessoas.map(x=>`<option value="${x.guarda_id}">${esc(x.nome_guerra||'GCM')}</option>`).join('');}
function renderTudo(resetView=true){
  renderNavegacao();
  renderPerfil();
  renderModulos();
  renderInicio();
  if(temAcesso('escalas')) renderEscalas();
  renderViaturas();
  if(temAcesso('permutas')) renderPermutas();
  if(temAcesso('banco_horas')) renderBanco();
  renderAvisos();
  renderSolicitacoes();
  renderPermutaCandidates();
  renderMensagemComando();
  if(resetView){
    const primeiro=MODULOS_GCMBS.find(m=>temAcesso(m.id));
    if(primeiro) abrirModuloPrincipal(primeiro.id).catch(()=>setView('perfil')); else setView('perfil');
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
  $('pmCancelarEdicao')?.addEventListener('click',resetPermutaForm);
  $('abrirAbastecimento')?.addEventListener('click',()=>abrirModuloOnline('abastecimento_viaturas'));
  $('abrirManutencao')?.addEventListener('click',()=>abrirModuloOnline('manutencao_viaturas'));
  $('formMensagemComando')?.addEventListener('submit',enviarMensagemComando);
  $('msgDestino')?.addEventListener('change',()=>$('msgGcmsLabel').classList.toggle('hidden',$('msgDestino').value!=='SELECIONADOS'));
  document.querySelectorAll('#mainNav [data-fixed][data-go]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.go)));
  $('menuToggle')?.addEventListener('click',()=>{if($('mainNav')?.classList.contains('open'))fecharMenu();else abrirMenu()});
  $('navBackdrop')?.addEventListener('click',fecharMenu);
  $('onlineVoltar')?.addEventListener('click',voltarOnline);
  $('onlineFiltro')?.addEventListener('input',renderRegistrosOnline);
  $('onlineNovo')?.addEventListener('click',()=>editarOnline());
  $('onlineSalvar')?.addEventListener('click',salvarOnline);
  $('onlineCancelar')?.addEventListener('click',()=>$('onlineEditor').close());
  ['escalaIni','escalaFim','escalaGcm','escalaPosto','escalaHorario'].forEach(id=>$(id)?.addEventListener('change',renderEscalas));
  $('escalaGerar')?.addEventListener('click',renderEscalas);$('pmData')?.addEventListener('change',atualizarSubstituidosPermuta);$('pmTurno')?.addEventListener('change',atualizarSubstituidosPermuta);$('abrirOcorrencias')?.addEventListener('click',()=>abrirModuloOnline('ocorrencias'));$('abrirEventos')?.addEventListener('click',()=>abrirModuloOnline('eventos_extra'));$('abrirJustificativas')?.addEventListener('click',()=>abrirModuloOnline('justificativas_faltas'));
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

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=100043',{updateViaCache:'none'}).catch(()=>{});}
