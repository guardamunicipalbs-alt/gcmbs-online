
import {AuthenticatedProvider} from './data-provider.js';
import {MODULOS_GCMBS} from './access-catalog.js';
import {configurarPushNativo} from './native-push.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{if(!d)return'';const [y,m,day]=String(d).slice(0,10).split('-');return `${day}/${m}/${y}`};
const horas=min=>{const n=Number(min||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`};
const APP_VERSION='10.0.55';
let provider=new AuthenticatedProvider();
let onlineCatalog=[],onlineCurrent=null,onlineRecords=[],onlineEditing=null,quadroAtual=null,permutaEditingId=null,escalaModo='pessoal',escalasInstitucionais=[],escalaEditing=null;

const ONLINE_LABELS={
  viatura_id:'Viatura',data_manutencao:'Data da manutenÃ§Ã£o',tipo_manutencao:'Tipo de manutenÃ§Ã£o',descricao:'DescriÃ§Ã£o',
  quilometragem:'Quilometragem',responsavel:'ResponsÃ¡vel',empresa:'Empresa / oficina',valor:'Valor',status:'Status',
  observacao:'ObservaÃ§Ã£o',data_retorno:'Data de retorno',recebido_por:'Recebido por',consertado:'Consertado',
  encaminhado_por:'Encaminhado por',atendente_oficina:'Atendente da oficina',data_abastecimento:'Data do abastecimento',
  motorista:'Motorista',motorista_id:'Motorista',litros:'Litros',guarda_id:'GCM',data_inicial:'Data inicial',
  quantidade_dias:'Quantidade de dias',data_final:'Data final',motivo:'Motivo / justificativa',tipo_servico:'Tipo do serviÃ§o',
  arquivo_nome:'Documento',arquivo_tipo:'Tipo do documento',arquivo_dados:'Arquivo',criado_em:'Criado em',atualizado_em:'Atualizado em',
  nome_guerra:'Nome de guerra',nome_completo:'Nome completo',cpf:'CPF',matricula:'MatrÃ­cula',cargo:'Cargo',equipe:'Equipe',equipe_id:'Equipe',posto_prioritario:'Posto prioritÃ¡rio',posto_prioritario_id:'Posto prioritÃ¡rio',categoria_cnh:'Categoria CNH',
  nome:'Nome',tipo:'Tipo',prioridade:'Prioridade',minimo:'Efetivo mÃ­nimo',maximo:'Efetivo mÃ¡ximo',quantidade_minima:'Efetivo mÃ­nimo',quantidade_maxima:'Efetivo mÃ¡ximo',horario_inicio:'HorÃ¡rio inicial',horario_fim:'HorÃ¡rio final',
  data:'Data',hora:'Hora',prefixo:'Prefixo',placa:'Placa',modelo:'Modelo',ano:'Ano',ano_fabricacao:'Ano de fabricaÃ§Ã£o',ano_modelo:'Ano/modelo',combustivel:'CombustÃ­vel',intervalo_troca_oleo_km:'Intervalo troca de Ã³leo (km)',km_ultima_troca_oleo:'KM da Ãºltima troca de Ã³leo',
  patrimonio:'PatrimÃ´nio',equipamento:'Equipamento',modalidade_uso:'Modalidade de uso',data_entrega:'Data de entrega',data_devolucao:'Data de devoluÃ§Ã£o',situacao:'SituaÃ§Ã£o',
  fator_rh:'Fator RH',tipo_sanguineo:'Tipo sanguÃ­neo',curso:'Curso / habilitaÃ§Ã£o',instituicao:'InstituiÃ§Ã£o',data_inicio:'Data de inÃ­cio',data_conclusao:'Data de conclusÃ£o',validade:'Validade',certificado:'Certificado',
  numero_oficio:'NÃºmero do ofÃ­cio',data_recebimento:'Data de recebimento',secretaria_municipal:'Secretaria Municipal',instituicao_solicitante:'Unidade / instituiÃ§Ã£o solicitante',responsavel_solicitacao:'ResponsÃ¡vel pela solicitaÃ§Ã£o',cargo_solicitante:'Cargo do solicitante',telefone_solicitante:'Telefone',data_demanda:'Data da demanda',local_demanda:'Local da demanda',horario_termino_previsto:'TÃ©rmino previsto',demanda:'Demanda a ser atendida',
  competencia:'CompetÃªncia',classe:'Classe',minutos:'Minutos',natureza:'Natureza',origem:'Origem',posto_nome:'Posto',turno:'Turno',ativo:'Ativo',ativa:'Ativa',participa_gerador:'Participa do gerador',modo_distribuicao:'Modo de distribuiÃ§Ã£o',grupo_id:'Grupo de ativaÃ§Ã£o',equipe_servico_id:'Equipe de serviÃ§o',justificativa_id:'Justificativa vinculada'
};
const ONLINE_HIDE_FIELDS=new Set(['criado_por','analisado_por','arquivo_dados','arquivo_tipo','criado_em','atualizado_em','password','password_hash','token','token_sha256','origem_id','referencia_id','movimentacao_id','movimento_vinculado_id','entidade_id','usuario_id','escala_id','extra_id']);
const onlineLabel=k=>ONLINE_LABELS[k]||String(k||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const refData=()=>provider.references?.()||{viaturas:[],guardas:[],equipes:[],postos:[],tipos_escalas:[],eventos:[],oficios:[]};
function viaturaPorId(v){const x=(refData().viaturas||[]).find(r=>Number(r.id)===Number(v));return x?[x.prefixo,x.placa].filter(Boolean).join(' Â· '):''}
function guardaPorId(v){const x=(refData().guardas||[]).find(r=>Number(r.id)===Number(v));return x?.nome_guerra||x?.nome_completo||''}
function equipePorId(v){const x=(refData().equipes||[]).find(r=>Number(r.id)===Number(v));return x?.nome||''}
function postoPorId(v){const x=(refData().postos||[]).find(r=>Number(r.id)===Number(v));return x?.nome||''}
function valorApresentacao(k,v){
  if(v==null||v==='')return 'â€”';
  if(['viatura_id','viatura_principal_id','viatura_substituta_id','hist_viatura_id'].includes(k))return viaturaPorId(v)||'Viatura cadastrada';
  if(k==='equipe_id')return equipePorId(v)||'Equipe cadastrada';
  if(k==='posto_id'||k==='posto_prioritario_id')return postoPorId(v)||'Posto cadastrado';
  if(k==='tipo_escala_id'){const x=(refData().tipos_escalas||[]).find(r=>Number(r.id)===Number(v));return x?.nome||x?.descricao||'Tipo de escala cadastrado';}
  if(k==='evento_id'){const x=(refData().eventos||[]).find(r=>Number(r.id)===Number(v));return x?[x.nome,x.data].filter(Boolean).join(' Â· '):'Evento cadastrado';}
  if(k==='oficio_id'){const x=(refData().oficios||[]).find(r=>Number(r.id)===Number(v));return x?[x.numero_oficio,x.data_demanda].filter(Boolean).join(' Â· '):'OfÃ­cio cadastrado';}
  if(k==='grupo_id'){const x=(refData().grupos_ativacao||[]).find(r=>Number(r.id)===Number(v));return x?.nome||'Grupo cadastrado';}
  if(k==='equipe_servico_id')return equipePorId(v)||'Equipe cadastrada';
  if(k==='justificativa_id'){const x=(refData().justificativas||[]).find(r=>Number(r.id)===Number(v));return x?[fmt(x.data_inicial),x.motivo].filter(Boolean).join(' Â· '):'Justificativa cadastrada';}
  if(k==='posto_prioritario')return String(v);
  if(k==='equipe'&&onlineCurrent?.entity==='guardas')return String(v);
  if(/^(guarda_id|substituido_id|substituto_id|motorista_id|recebido_por|encaminhado_por|responsavel_id|condutor_ocorrencia_id)$/.test(k))return guardaPorId(v)||'GCM cadastrado';
  if(/^data_|_em$/.test(k)||['data_inicial','data_final','criado_em','atualizado_em'].includes(k)){const d=fmt(String(v).slice(0,10));return d||String(v)}
  if(k==='valor'){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):String(v)}
  if(k==='consertado')return Number(v)?'Sim':'NÃ£o';
  if(k==='tipo_servico')return String(v).toUpperCase()==='EXTRA'?'ServiÃ§o extra':'ServiÃ§o ordinÃ¡rio';
  return String(v);
}


const ENTITY_UI={
  guardas:{titulo:'Cadastro de Guardas',action:'Novo GCM',descricao:'Cadastro funcional organizado por assunto, sem expor campos tÃ©cnicos.',order:['nome_guerra','nome_completo','cpf','matricula','cargo','status','tipo_sanguineo','fator_rh','equipe','posto_prioritario','categoria_cnh','autorizado_viatura','autorizado_motocicleta','disponivel_escala','pode_noite','pode_24h'],sections:[['IdentificaÃ§Ã£o funcional',['nome_guerra','nome_completo','cpf','matricula','cargo','status']],['Dados pessoais',['tipo_sanguineo','fator_rh']],['LotaÃ§Ã£o e configuraÃ§Ã£o operacional',['equipe','posto_prioritario','disponivel_escala','pode_noite','pode_24h']],['CNH e autorizaÃ§Ãµes',['categoria_cnh','autorizado_viatura','autorizado_motocicleta']]]},
  equipes:{titulo:'Equipes',action:'Nova equipe',descricao:'Equipes operacionais, jornada vinculada e ciclo de serviÃ§o.',order:['nome','tipo_escala_id','ciclo','ativa','participa_gerador','turno_inicio','modo_distribuicao'],sections:[['IdentificaÃ§Ã£o',['nome','ativa']],['Jornada e ciclo',['tipo_escala_id','ciclo','turno_inicio','modo_distribuicao']],['OperaÃ§Ã£o',['participa_gerador']]]},
  postos:{titulo:'Postos Operacionais',action:'Novo posto',descricao:'Prioridade operacional, efetivo mÃ­nimo/mÃ¡ximo, horÃ¡rios e funcionamento dos postos.',order:['nome','tipo','prioridade','quantidade_minima','quantidade_maxima','horario_inicio','horario_fim','funcionamento_24h','ativo','observacao'],sections:[['IdentificaÃ§Ã£o',['nome','tipo','ativo']],['Prioridade e efetivo',['prioridade','quantidade_minima','quantidade_maxima']],['Funcionamento',['horario_inicio','horario_fim','funcionamento_24h']],['ObservaÃ§Ãµes',['observacao']]]},
  tipos_escalas:{titulo:'Tipos de Escalas',action:'Novo tipo',descricao:'Jornadas e horÃ¡rios utilizados pelas equipes e escalas.',order:['nome','descricao','ativo'],sections:[['Tipo de escala',['nome','ativo']],['DescriÃ§Ã£o',['descricao']]]},
  escalas_extras_manuais:{titulo:'Escala Extra Manual',action:'Nova escala extra',descricao:'Efetivo adicional sincronizado com o Desktop, obedecendo Ã s permissÃµes do usuÃ¡rio.',order:['data','guarda_id','horario_inicio','horario_fim','status','observacao'],sections:[['ServiÃ§o extra',['data','guarda_id','horario_inicio','horario_fim','status']],['ObservaÃ§Ã£o',['observacao']]]},
  feriados:{titulo:'Feriados',action:'Novo feriado',descricao:'CalendÃ¡rio institucional de feriados utilizado nos cÃ¡lculos do sistema.',order:['data','nome','observacao'],sections:[['Feriado',['data','nome']],['ObservaÃ§Ã£o',['observacao']]]},
  justificativas_faltas:{titulo:'Justificativa de Faltas',action:'Nova justificativa',descricao:'Justificativa de faltas e documentos do prÃ³prio GCM, conforme permissÃ£o.',order:['guarda_id','data_inicial','quantidade_dias','data_final','tipo_servico','motivo','observacao','status'],sections:[['PerÃ­odo e serviÃ§o',['guarda_id','data_inicial','quantidade_dias','data_final','tipo_servico']],['Justificativa',['motivo','observacao','status']]]},
  eventos_extras:{titulo:'ServiÃ§o Extra por Evento',action:'Novo evento',descricao:'Eventos extraordinÃ¡rios, local e perÃ­odo operacional.',order:['nome','data','horario_inicio','horario_fim','local','observacao','status'],sections:[['Evento',['nome','status']],['Data, horÃ¡rio e local',['data','horario_inicio','horario_fim','local']],['ObservaÃ§Ã£o',['observacao']]]},
  folha_pagamento_config:{titulo:'Folha de Pagamento',action:'Nova configuraÃ§Ã£o',descricao:'ParÃ¢metros e configuraÃ§Ãµes da folha de pagamento autorizados ao perfil atual.'},
  viaturas:{titulo:'Cadastro de Viaturas',action:'Nova viatura',descricao:'Frota institucional, distinguindo viatura e motopatrulha, com parÃ¢metros operacionais e de manutenÃ§Ã£o.',order:['prefixo','placa','marca','modelo','ano_fabricacao','ano_modelo','tipo','status','combustivel','intervalo_troca_oleo_km','km_ultima_troca_oleo','observacao'],sections:[['IdentificaÃ§Ã£o da viatura',['prefixo','placa','marca','modelo','ano_fabricacao','ano_modelo','tipo','status']],['CaracterÃ­sticas',['combustivel']],['Troca de Ã³leo',['intervalo_troca_oleo_km','km_ultima_troca_oleo']],['ObservaÃ§Ãµes',['observacao']]]},
  manutencao_viaturas:{titulo:'ManutenÃ§Ã£o de Viaturas',action:'Nova manutenÃ§Ã£o',descricao:'Baixa, acompanhamento e retorno de viaturas. ExclusÃ£o fica restrita ao Comando/Subcomando.',order:['viatura_id','data_manutencao','tipo_manutencao','descricao','quilometragem','encaminhado_por','empresa','atendente_oficina','valor','status','consertado','data_retorno','recebido_por','observacao'],sections:[['Viatura e entrada',['viatura_id','data_manutencao','quilometragem','tipo_manutencao','status']],['ServiÃ§o / oficina',['descricao','encaminhado_por','empresa','atendente_oficina','valor']],['Retorno',['consertado','data_retorno','recebido_por']],['ObservaÃ§Ãµes',['observacao']]]},
  abastecimento_viaturas:{titulo:'Abastecimento',action:'Novo abastecimento',descricao:'Registro e histÃ³rico de abastecimentos da frota.',order:['viatura_id','data_abastecimento','quilometragem','litros','motorista_id','observacao'],sections:[['Abastecimento',['viatura_id','data_abastecimento','quilometragem','litros']],['Condutor e observaÃ§Ã£o',['motorista_id','observacao']]]},
  equipamentos_cautelas:{titulo:'Equipamentos e Cautelas',action:'Nova cautela',descricao:'Cautelas individuais, de viatura e coletivas, com entrega, situaÃ§Ã£o e devoluÃ§Ã£o.',order:['equipamento','patrimonio','tipo','modalidade_uso','guarda_id','viatura_id','data_entrega','data_devolucao','situacao','observacao'],sections:[['Equipamento',['equipamento','patrimonio','tipo','modalidade_uso','situacao']],['Responsabilidade',['guarda_id','viatura_id']],['Datas',['data_entrega','data_devolucao']],['ObservaÃ§Ãµes',['observacao']]]},
  cursos_habilitacoes:{titulo:'Cursos e HabilitaÃ§Ãµes',action:'Novo curso',descricao:'Cursos e habilitaÃ§Ãµes dos GCMs, incluindo inÃ­cio, conclusÃ£o, validade e comprovantes.',order:['guarda_id','curso','instituicao','data_inicio','data_conclusao','validade','certificado','observacao','ativo'],sections:[['GCM e curso',['guarda_id','curso','instituicao','ativo']],['Datas',['data_inicio','data_conclusao','validade']],['Comprovante e observaÃ§Ã£o',['certificado','observacao']]]},
  oficios:{titulo:'OfÃ­cios',action:'Novo ofÃ­cio',descricao:'OfÃ­cios e demandas institucionais seguindo o formulÃ¡rio adotado no Desktop.',order:['numero_oficio','data_recebimento','secretaria_municipal','outro','instituicao_solicitante','responsavel_solicitacao','cargo_solicitante','telefone_solicitante','data_demanda','local_demanda','horario_inicio','horario_termino_previsto','demanda'],sections:[['IdentificaÃ§Ã£o do ofÃ­cio',['numero_oficio','data_recebimento','secretaria_municipal','outro']],['Solicitante',['instituicao_solicitante','responsavel_solicitacao','cargo_solicitante','telefone_solicitante']],['Demanda',['data_demanda','local_demanda','horario_inicio','horario_termino_previsto']],['DescriÃ§Ã£o detalhada',['demanda']]]},
  frequencia_registros:{titulo:'FrequÃªncia',action:'Novo registro',descricao:'Registros de frequÃªncia consolidados e sincronizados com o Desktop.'},
  permissoes_usuarios:{titulo:'Controle de Acesso',action:'Configurar acesso',descricao:'Defina de forma clara o que cada usuÃ¡rio pode fazer em cada mÃ³dulo: Sem acesso, Somente consulta, EdiÃ§Ã£o ou Acesso total. As mesmas regras valem no Desktop, Online e App.'},
  imagens_gcm:{titulo:'Imagens da GCM',action:'Nova imagem',descricao:'Identidade visual institucional utilizada no Desktop, Online e aplicativo Android.'}
};
function uiEntity(){return ENTITY_UI[onlineCurrent?.entity]||{descricao:`Dados de ${onlineCurrent?.titulo||'mÃ³dulo'} sincronizados com o Desktop.`}}
function orderedColumns(){const cols=onlineCurrent?.columns||[],cfg=uiEntity(),map=new Map(cols.map(c=>[c.name,c]));const out=[];for(const n of cfg.order||[])if(map.has(n)){out.push(map.get(n));map.delete(n)}for(const c of cols)if(map.has(c.name))out.push(c);return out}

const NAV_GROUPS=[
  {id:'operacional',titulo:'Operacional',mods:['dashboard','cadastro_guardas','equipes','postos']},
  {id:'escalas',titulo:'Escalas',mods:['gerador_escala','escalas','tipos_escalas','escala_extra_manual','feriados','justificativas_faltas','eventos_extra','folha_pagamento','banco_horas','relatorios']},
  {id:'frota',titulo:'Frota e Permutas',mods:['viaturas','permutas','abastecimento_viaturas','manutencao_viaturas','checklist_viaturas','relatorios_frota']},
  {id:'gestao',titulo:'GestÃ£o Institucional',mods:['ocorrencias','cautelas','cursos','operacoes_especiais','frequencia','central_pendencias','controle_acesso']},
  {id:'institucional',titulo:'Institucional',mods:['imagens_gcm']}
];
const NAV_ICONS={dashboard:'ðŸ“Š',cadastro_guardas:'ðŸ‘®',equipes:'ðŸ‘¥',postos:'ðŸ“',gerador_escala:'ðŸ¤–',escalas:'ðŸ“‹',tipos_escalas:'âš™ï¸',escala_extra_manual:'âž•',feriados:'ðŸ“…',permutas:'ðŸ”„',justificativas_faltas:'ðŸ“„',eventos_extra:'ðŸŽª',folha_pagamento:'ðŸ’°',banco_horas:'â±ï¸',relatorios:'ðŸ–¨ï¸',viaturas:'ðŸš“',manutencao_viaturas:'ðŸ”§',abastecimento_viaturas:'â›½',checklist_viaturas:'âœ…',relatorios_frota:'ðŸ“‘',ocorrencias:'ðŸ“',cautelas:'ðŸŽ’',cursos:'ðŸŽ“',operacoes_especiais:'âœ‰ï¸',frequencia:'ðŸ“‘',central_pendencias:'âš ï¸',controle_acesso:'ðŸ”',imagens_gcm:'ðŸ–¼ï¸'};
const DEDICATED_VIEW={dashboard:'inicio',escalas:'escala',relatorios:'escala',permutas:'permutas',banco_horas:'banco',ocorrencias:'ocorrencias',checklist_viaturas:'checklist',justificativas_faltas:'justificativas',relatorios_frota:'relatoriosFrota',central_pendencias:'pendencias'};
const PRIMARY_ENTITY={
  cadastro_guardas:'guardas',equipes:'equipes',postos:'postos',tipos_escalas:'tipos_escalas',escala_extra_manual:'escalas_extras_manuais',feriados:'feriados',
  justificativas_faltas:'justificativas_faltas',eventos_extra:'eventos_extras',folha_pagamento:'folha_pagamento_config',
  viaturas:'viaturas',manutencao_viaturas:'manutencao_viaturas',abastecimento_viaturas:'abastecimento_viaturas',checklist_viaturas:'checklist_viaturas',
  cautelas:'equipamentos_cautelas',cursos:'cursos_habilitacoes',operacoes_especiais:'oficios',frequencia:'frequencia_registros',controle_acesso:'permissoes_usuarios',imagens_gcm:'imagens_gcm'
};
function setView(id){
  document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('hidden',x.dataset.view!==id));
  document.querySelectorAll('#mainNav [data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===id));
  fecharMenu();
}
function temAcesso(modulo){
  if(modulo==='perfil'||modulo==='avisos') return true;
  if(modulo==='escalas'||modulo==='gerador_escala') return provider.gestor() && provider.pode('escalas');
  return provider.pode(modulo);
}
function renderNavegacao(){
  const host=$('navGroups'); if(!host)return;
  const byId=new Map(MODULOS_GCMBS.map(m=>[m.id,m]));
  host.innerHTML=NAV_GROUPS.map(g=>{
    const mods=g.mods.map(id=>byId.get(id)).filter(Boolean).filter(m=>temAcesso(m.id));
    if(!mods.length)return'';
    return `<section class="nav-group" data-nav-group="${esc(g.id)}"><div class="nav-group-title">${esc(g.titulo)}</div><div class="nav-group-body">${mods.map(m=>`<button type="button" data-module="${esc(m.id)}" title="${esc(m.descricao||m.nome)}"><span>${NAV_ICONS[m.id]||'â€¢'}</span><span class="nav-label">${esc(m.nome)}</span></button>`).join('')}</div></section>`;
  }).join('');
  host.querySelectorAll('[data-module]').forEach(b=>b.addEventListener('click',()=>abrirModuloPrincipal(b.dataset.module)));
  const s=provider.session||{}; if($('headerUsuario'))$('headerUsuario').textContent=s.nome||s.nome_guerra||s.usuario||'';
}
function fecharMenu(){$('mainNav')?.classList.remove('open');$('navBackdrop')?.classList.add('hidden')}
function abrirMenu(){$('mainNav')?.classList.add('open');$('navBackdrop')?.classList.remove('hidden')}
async function abrirModuloPrincipal(modulo){
  if(!temAcesso(modulo)){alert('VocÃª nÃ£o possui acesso a este mÃ³dulo.');return;}
  const ativar=()=>document.querySelectorAll('#mainNav [data-module]').forEach(x=>x.classList.toggle('active',x.dataset.module===modulo));
  if(modulo==='gerador_escala'){
    onlineModuleFilter='gerador_escala'; setView('online'); ativar();
    $('onlineEntidades').closest('.card').classList.remove('hidden'); $('onlineRegistrosCard').classList.add('hidden');
    $('onlineEntidades').innerHTML='<div class="notice module-safe-note"><strong>Gerador de Escala protegido</strong>A interface reconhece sua permissÃ£o, mas a execuÃ§Ã£o do gerador continua no Desktop nesta versÃ£o. A lÃ³gica existente nÃ£o foi alterada.</div>';
    return;
  }
  const view=DEDICATED_VIEW[modulo];
  if(view){if(modulo==='justificativas_faltas'){await abrirModuloOnline(modulo);ativar();return;}setView(view);ativar();if(view==='inicio')carregarQuadro().catch(()=>{});if(view==='ocorrencias')carregarOcorrencias().catch(e=>console.warn(e));if(view==='checklist')carregarChecklist().catch(e=>console.warn(e));if(view==='relatoriosFrota')renderRelatoriosFrota();if(view==='pendencias')renderCentralPendencias();if(view==='escala'){escalaModo=modulo==='relatorios'?'institucional':'pessoal';if(escalaModo==='institucional'){try{escalasInstitucionais=await provider.relatorioEscalas()}catch(e){alert(e.message);escalasInstitucionais=[]}}renderEscalas();}return;}
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
    ? `<span class="badge">CONTROLE TOTAL Â· ${ps.length} mÃ³dulos</span>`
    : ps.length
      ? ps.map(p=>`<span class="badge">${esc(p.modulo)} Â· ${esc(p.nivel)}</span>`).join(' ')
      : '<span class="muted">Sem permissÃµes habilitadas no Desktop.</span>';
}
function modulosOutros(){
  const dedicados=new Set(['dashboard','escalas','relatorios','banco_horas','permutas','abastecimento_viaturas','manutencao_viaturas']);
  // Comandante/Subcomandante recebem o catÃ¡logo integral do Desktop. Para os
  // demais GCMs continuam valendo estritamente as permissÃµes cadastradas.
  const base=provider.controleTotal()?MODULOS_GCMBS:provider.modulosAutorizados();
  return base.filter(m=>!dedicados.has(m.id) && !(m.id==='relatorios_frota'&&!provider.gestor()));
}
function renderModulos(){
  const lista=modulosOutros(),el=$('listaModulos');if(!el)return;
  if(!lista.length){el.innerHTML='<div class="empty">Nenhum outro mÃ³dulo autorizado.</div>';return;}
  el.innerHTML=lista.map(m=>{const online=onlineCatalog.some(c=>c.modulo===m.id);const acao=online?`<button class="mini" data-open-module="${esc(m.id)}">Abrir</button>`:'<span class="muted module-state">Autorizado Â· aguardando tela online especÃ­fica</span>';return `<article class="module-card ${online?'ready':'desktop-only'}"><div><strong>${esc(m.nome)}</strong><small>${esc(m.descricao)}</small></div><span class="level">${esc(m.nivel)}</span>${acao}</article>`;}).join('');
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
  // Postos 24h podem vir do histÃ³rico como 07:00â€“07:00; na visÃ£o por turno
  // exibimos o intervalo efetivamente representado pela linha da escala.
  if(hi&&hf&&hi!==hf)return `${hi} Ã s ${hf}`;
  if(turno==='B')return '19:00 Ã s 07:00';
  if(turno==='A')return '07:00 Ã s 19:00';
  return hi&&hf?`${hi} Ã s ${hf}`:'07:00 Ã s 19:00';
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
    if(ex){ex.motorista=ex.motorista||motorista;ex.veiculo=ex.veiculo||veiculo;ex.extra=ex.extra||extra}else arr.push({nome,motorista,veiculo,extra,raw:item,id:Number(item.id||0),guarda_id:Number(item.guarda_id||0),posto_id:Number(item.posto_id||0),data:dia});
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
  if(!ini||!fim){$('cabecalhoMatrizMobile').innerHTML='<th class="col-posto">POSTO / HORÃRIO</th>';$('resultadoMatrizMobile').innerHTML='<tr><td>Informe o perÃ­odo para consultar.</td></tr>';return}
  let dados=dadosEscalaVisao().filter(x=>{const d=String(x.data||'').slice(0,10);if(d<ini||d>fim)return false;if(gcm&&normalizar(nomeEscala(x))!==normalizar(gcm))return false;if(posto&&normalizar(postoEscala(x))!==normalizar(posto))return false;if(horario&&horarioRelatorio(x)!==horario)return false;return true});
  let datas=gerarDatas(ini,fim);if(gcm||posto||horario){const ds=new Set(dados.map(x=>String(x.data||'').slice(0,10)));datas=datas.filter(d=>ds.has(d))}
  const grupos=montarGruposEscala(dados);
  $('cabecalhoMatrizMobile').innerHTML='<th class="col-posto">POSTO / HORÃRIO</th>'+datas.map(d=>`<th>${fmt(d)}</th>`).join('');
  const podeGerenciar=provider.gestor()&&provider.pode('escalas','EDICAO');
  $('escalaComandoAviso')?.classList.toggle('hidden',!podeGerenciar);
  if($('escalaTitulo'))$('escalaTitulo').textContent=podeGerenciar?'Gerenciar Escalas':'RelatÃ³rio de Escala';
  if($('escalaSubtitulo'))$('escalaSubtitulo').textContent=podeGerenciar?'Visualize a escala e faÃ§a ajustes administrativos pelo celular.':'Mesma visÃ£o por posto e horÃ¡rio utilizada no Desktop.';
  $('resultadoMatrizMobile').innerHTML=grupos.map(g=>`<tr><th class="posto-linha"><b>${esc(g.posto)}</b><span>${esc(g.horario)}</span></th>${datas.map(d=>{const itens=g.itens.get(d)||[];return itens.length?`<td>${itens.map(x=>`<div class="gcm-linha"><b>${esc(x.nome)}</b>${x.motorista?`<span class="tag-driver">MOTORISTA${x.veiculo?' - '+esc(x.veiculo):''}</span>`:''}${x.extra?'<span class="tag-extra">Extra</span>':''}${podeGerenciar&&x.id&&!x.extra?`<button class="mini scale-edit" data-scale-edit="${x.id}" type="button">Alterar</button>`:''}</div>`).join('')}</td>`:'<td class="vazio">â€”</td>'}).join('')}</tr>`).join('')||`<tr><td colspan="${Math.max(1,datas.length+1)}">Nenhuma escala encontrada para os filtros informados.</td></tr>`;
  document.querySelectorAll('[data-scale-edit]').forEach(b=>b.onclick=()=>abrirAjusteEscala(Number(b.dataset.scaleEdit)));
  $('escalaInfo').textContent=`${dados.length} registro(s) Â· ${fmt(ini)} a ${fmt(fim)}`;
  $('escalaFiltroAtivo').textContent=[gcm&&`GCM: ${gcm}`,posto&&`Posto: ${posto}`,horario&&`HorÃ¡rio: ${horario}`].filter(Boolean).join(' Â· ')||'Todos os GCMs, postos e horÃ¡rios';
}

function abrirAjusteEscala(id){
  if(!(provider.gestor()&&provider.pode('escalas','EDICAO')))return alert('Ajuste de escala restrito ao Comando autorizado.');
  const item=dadosEscalaVisao().find(x=>Number(x.id)===Number(id));if(!item)return alert('Registro de escala nÃ£o localizado.');
  const hojeLocal=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});if(String(item.data||'').slice(0,10)<hojeLocal)return alert('Escalas anteriores sÃ£o histÃ³ricas e nÃ£o podem ser alteradas.');
  escalaEditing=item;const refs=refData();
  $('escalaEditorResumo').innerHTML=`<b>${esc(nomeEscala(item))}</b> Â· ${fmt(String(item.data).slice(0,10))} Â· ${esc(horarioRelatorio(item))}<br>Posto atual: <b>${esc(postoEscala(item)||'-')}</b>`;
  $('escalaNovoPosto').innerHTML='<option value="">Manter posto atual</option>'+(refs.postos||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.nome||'Posto')}</option>`).join('');
  $('escalaNovoGcm').innerHTML='<option value="">Manter GCM atual</option>'+(refs.guardas||[]).filter(x=>Number(x.id)!==Number(item.guarda_id)).map(x=>`<option value="${esc(x.id)}">${esc(x.nome_guerra||x.nome_completo||'GCM')}</option>`).join('');
  $('escalaMotivo').value='';$('escalaAjusteMsg').textContent='';$('escalaEditor').showModal();
}
async function salvarAjusteEscala(){
  if(!escalaEditing)return;const posto=Number($('escalaNovoPosto').value)||0,gcm=Number($('escalaNovoGcm').value)||0,motivo=$('escalaMotivo').value.trim();
  if(!posto&&!gcm)return alert('Selecione um novo posto ou um GCM substituto.');if(!motivo)return alert('Informe o motivo da alteraÃ§Ã£o.');
  $('escalaSalvarAjuste').disabled=true;$('escalaAjusteMsg').textContent='Registrando ajuste...';
  try{const r=await provider.ajustarEscalaComando({escala_id:Number(escalaEditing.id),data:String(escalaEditing.data||'').slice(0,10),novo_posto_id:posto||null,novo_guarda_id:gcm||null,motivo});$('escalaAjusteMsg').textContent=r.message||'AlteraÃ§Ã£o registrada para sincronizaÃ§Ã£o com o Desktop.';$('escalaEditor').close();await provider.load();renderEscalas();alert(r.message||'AlteraÃ§Ã£o registrada.');}catch(e){$('escalaAjusteMsg').textContent=e.message;}finally{$('escalaSalvarAjuste').disabled=false;}
}

function detalhesQuadro(caminho){const [g,k]=String(caminho||'').split('.');if(!quadroAtual)return[];if(g==='efetivo')return quadroAtual.efetivo?.detalhes?.[k]||[];if(g==='viaturas')return quadroAtual.viaturas?.detalhes?.[k]||[];if(g==='postos'&&k==='cobertos')return quadroAtual.postos?.detalhamento||[];if(g==='faltas'&&k==='registros')return quadroAtual.faltas?.registros||[];return[]}
function abrirQuadroDetalhe(titulo,caminho){const itens=detalhesQuadro(caminho);$('quadroModalTitulo').textContent=titulo||'Detalhes';$('quadroModalMeta').textContent=`Data de referÃªncia: ${fmt(quadroAtual?.data||$('quadroData').value)} Â· ${itens.length} registro(s)`;$('quadroModalLista').innerHTML=itens.length?itens.map(x=>`<div class="item"><strong>${esc(x.nome||'-')}</strong><span>${esc(x.complemento||'')}</span></div>`).join(''):'<div class="empty">Nenhum registro compÃµe este indicador na data selecionada.</div>';$('quadroModal').classList.remove('hidden')}
function renderInicio(){
  const s=provider.session||{};$('perfilNome').textContent=s.nome||'';$('perfilCargo').textContent=s.cargo||s.role||'';
}
async function carregarQuadro(){
  const data=$('quadroData')?.value||hoje();$('qAviso').textContent='Atualizando Quadro Operacional...';
  try{const d=await provider.quadro(data);quadroAtual=d;$('qAtivos').textContent=d.efetivo?.ativos||0;$('qAfastados').textContent=d.efetivo?.afastados||0;$('qFerias').textContent=d.efetivo?.feristas||0;if($('qServicoA'))$('qServicoA').textContent=d.efetivo?.servicoA||0;if($('qServicoB'))$('qServicoB').textContent=d.efetivo?.servicoB||0;$('qViaturasTotal').textContent=d.viaturas?.total||0;$('qViaturasDisponiveis').textContent=d.viaturas?.disponivel||0;$('qViaturasUso').textContent=d.viaturas?.emUso||0;$('qViaturasBaixadas').textContent=d.viaturas?.baixadas||0;$('qViaturasManut').textContent=d.viaturas?.manutencao||0;$('qPostos').textContent=d.postos?.cobertos||0;if($('qFaltas'))$('qFaltas').textContent=d.faltas?.total||0;$('qAviso').textContent=(d.cnhVencidas||[]).length?`âš  CNH vencida: ${d.cnhVencidas.length} GCM(s).`:'Sem avisos de CNH vencida para a data selecionada.'}catch(e){$('qAviso').textContent='NÃ£o foi possÃ­vel carregar o Quadro Operacional: '+e.message}
}
function nomeCandidato(id){const x=provider.permutationCandidates().find(g=>Number(g.guarda_id)===Number(id));return x?.nome_guerra||'GCM';}
function renderViaturas(){
  $('cardAbastecimento')?.classList.toggle('hidden',!provider.pode('abastecimento_viaturas'));
  $('cardManutencao')?.classList.toggle('hidden',!provider.pode('manutencao_viaturas'));
}

const CHECK_ITEMS=['pneus','luzes','sirene','giroflex','freios','oleo','agua','combustivel','limpeza','avarias','equipamentos'];
const OCC_NATUREZAS=['ABORDAGEM','APOIO A OUTRO Ã“RGÃƒO','AVERIGUAÃ‡ÃƒO','DANO AO PATRIMÃ”NIO','DESENTENDIMENTO','FURTO','ROUBO','TRÃ‚NSITO','VIOLÃŠNCIA DOMÃ‰STICA','PERTURBAÃ‡ÃƒO DO SOSSEGO','PESSOA EM ATITUDE SUSPEITA','ACIDENTE','APREENSÃƒO','PRISÃƒO / CONDUÃ‡ÃƒO','OUTRO'];
let chkRecords=[],chkPending=[],occRecords=[];
function nowTime(){return new Date().toTimeString().slice(0,5)}
function parseMaybeJson(v,fb=[]){if(Array.isArray(v))return v;try{return JSON.parse(v||'[]')}catch{return fb}}
function checklistItemLabel(k){return ({pneus:'Pneus',luzes:'Luzes',sirene:'Sirene',giroflex:'Giroflex',freios:'Freios',oleo:'Ã“leo',agua:'Ãgua',combustivel:'CombustÃ­vel',limpeza:'Limpeza',avarias:'Avarias',equipamentos:'Equipamentos'})[k]||k}
async function carregarChecklist(){
  if(!$('chkItens'))return;
  $('chkItens').innerHTML=CHECK_ITEMS.map(i=>`<label><span>${checklistItemLabel(i)}</span><select id="chk_${i}"><option selected>OK</option><option>ATENÃ‡ÃƒO</option><option>NÃƒO CONFORME</option></select></label>`).join('');
  const refs=provider.references();$('chkViatura').innerHTML='<option value="">Selecione...</option>'+(refs.viaturas||[]).map(v=>`<option value="${v.id}">${esc([v.prefixo,v.placa,v.modelo].filter(Boolean).join(' Â· '))}</option>`).join('');
  const gid=Number(provider.session?.guarda_id);$('chkGuarda').innerHTML=(refs.guardas||[]).filter(g=>Number(g.id)===gid).map(g=>`<option value="${g.id}" selected>${esc(g.nome_guerra||g.nome_completo)}</option>`).join('')||`<option value="${gid}">${esc(provider.session?.nome||'GCM')}</option>`;
  const b=await provider.entityList('checklist_viaturas',500,0);chkRecords=b.records||[];renderChecklistHistorico();
}
function renderChecklistHistorico(){const el=$('chkLista');if(!el)return;el.innerHTML=chkRecords.slice(0,40).map(r=>{const d=r.data||{},probs=CHECK_ITEMS.filter(i=>['ATENÃ‡ÃƒO','NÃƒO CONFORME'].includes(String(d[i]||'').toUpperCase()));return `<article class="record-card"><div class="record-card-head"><strong>${esc(viaturaPorId(d.viatura_id)||'Viatura')}</strong><span class="status-pill ${probs.length?'warn':'ok'}">${esc(d.situacao||'APTA')}</span></div><div class="record-meta">${fmt(d.data)} ${esc(d.hora||'')} Â· KM ${esc(d.km??'â€”')}</div>${probs.length?`<div class="record-warning">${probs.map(i=>checklistItemLabel(i)+': '+d[i]).join(' Â· ')}</div>`:'<div class="record-ok">Sem problemas apontados.</div>'}</article>`}).join('')||'<div class="empty">Nenhum check-list registrado.</div>'}
async function atualizarChecklistContexto(){const vid=Number($('chkViatura').value)||0;chkPending=[];$('chkPendencia').classList.add('hidden');if(!vid)return;try{const c=await provider.checklistContext(vid);chkPending=c.pending||[];if(chkPending.length){$('chkPendencia').classList.remove('hidden');$('chkPendenciaTexto').textContent=(c.previous?.data?`Check-list de ${fmt(c.previous.data)}: `:'')+chkPending.map(x=>`${checklistItemLabel(x.item)} â€” ${x.status}`).join('; ')+(c.previous?.observacao?` Â· ${c.previous.observacao}`:'');$('chkResolvidos').innerHTML=chkPending.map(x=>`<label><input type="checkbox" class="chk-resolved" value="${esc(x.item)}"> ${checklistItemLabel(x.item)} jÃ¡ foi resolvido</label>`).join('')}else $('chkResolvidos').innerHTML='';if(c.vehicle){const v=c.vehicle,km=Number($('chkKm').value)||0,intv=Number(v.intervalo_troca_oleo_km)||0,ult=v.km_ultima_troca_oleo==null?null:Number(v.km_ultima_troca_oleo);let txt=intv?`Intervalo: ${intv.toLocaleString('pt-BR')} km.`:'Intervalo de troca de Ã³leo nÃ£o cadastrado.';if(ult!=null){const prox=ult+intv;txt+=` Ãšltima troca: ${ult.toLocaleString('pt-BR')} km. PrÃ³xima: ${prox.toLocaleString('pt-BR')} km.`;if(km)txt+=km>=prox?' TROCA NECESSÃRIA.':` Faltam ${(prox-km).toLocaleString('pt-BR')} km.`}$('chkOleoResumo').textContent=txt}}catch(e){$('chkOleoResumo').textContent=e.message}}
function abrirNovoChecklist(){$('chkFormCard').classList.remove('hidden');$('chkData').value=hoje();$('chkHora').value=nowTime();$('chkSituacao').value='APTA';$('chkObs').value='';$('chkKm').value='';$('chkViatura').value='';$('chkTrocaOleo').checked=false;$('chkKmTrocaBox').classList.add('hidden');CHECK_ITEMS.forEach(i=>{if($(`chk_${i}`))$(`chk_${i}`).value='OK'});$('chkPendencia').classList.add('hidden');$('chkFormCard').scrollIntoView({behavior:'smooth',block:'start'})}
async function salvarChecklist(e){e.preventDefault();try{const vid=Number($('chkViatura').value);if(!vid)throw new Error('Selecione a viatura.');const d={viatura_id:vid,guarda_id:Number(provider.session?.guarda_id),data:$('chkData').value,hora:$('chkHora').value,km:$('chkKm').value?Number($('chkKm').value):null,situacao:$('chkSituacao').value,observacao:$('chkObs').value,troca_oleo_realizada:$('chkTrocaOleo').checked?1:0,km_troca_oleo:$('chkTrocaOleo').checked?(Number($('chkKmTroca').value)||Number($('chkKm').value)||null):null,pendencias_anteriores:JSON.stringify(chkPending),pendencias_resolvidas:JSON.stringify([...document.querySelectorAll('.chk-resolved:checked')].map(x=>x.value))};CHECK_ITEMS.forEach(i=>d[i]=$(`chk_${i}`).value);if(CHECK_ITEMS.some(i=>d[i]==='NÃƒO CONFORME'))d.situacao='NÃƒO APTA';else if(CHECK_ITEMS.some(i=>d[i]==='ATENÃ‡ÃƒO')&&d.situacao==='APTA')d.situacao='APTA COM RESSALVA';await provider.entityMutate('checklist_viaturas','','UPSERT',d);$('chkMsg').textContent='Check-list salvo e enviado para sincronizaÃ§Ã£o.';$('chkFormCard').classList.add('hidden');await carregarChecklist()}catch(err){$('chkMsg').textContent=err.message}}
async function carregarOcorrencias(){if(!$('occNaturezas'))return;$('occNaturezas').innerHTML=OCC_NATUREZAS.map(n=>`<label><input type="checkbox" class="occ-nat" value="${esc(n)}"> ${esc(n)}</label>`).join('');const b=await provider.entityList('ocorrencias_operacionais',500,0);occRecords=b.records||[];renderOcorrencias()}
function renderOcorrencias(){const el=$('occLista');if(!el)return;el.innerHTML=occRecords.slice(0,60).map(r=>{const d=r.data||{},n=parseMaybeJson(d.naturezas,[]);return `<article class="record-card"><div class="record-card-head"><strong>${esc(n.join(', ')||d.tipo||'OcorrÃªncia')}</strong><span>${fmt(d.data)} ${esc(d.hora||'')}</span></div><div class="record-meta">${esc(d.local||'Local nÃ£o informado')} Â· ${esc(d.recebida_via||'Via nÃ£o informada')}</div><div>${esc(d.historico_ocorrencia||d.descricao||'')}</div></article>`}).join('')||'<div class="empty">Nenhuma ocorrÃªncia registrada.</div>'}
function occEquipeIds(){return [...document.querySelectorAll('.occ-team:checked')].map(x=>Number(x.value)).filter(Boolean)}
function atualizarOccCondutor(){const ids=occEquipeIds(),cur=Number($('occCondutor').value)||0,refs=provider.references().guardas||[];$('occCondutor').innerHTML='<option value="">Selecione...</option>'+refs.filter(g=>ids.includes(Number(g.id))).map(g=>`<option value="${g.id}">${esc(g.nome_guerra||g.nome_completo)}</option>`).join('');if(ids.includes(cur))$('occCondutor').value=String(cur);else if(ids.includes(Number(provider.session?.guarda_id)))$('occCondutor').value=String(provider.session.guarda_id)}
async function preencherEquipeOcorrencia(){const data=$('occData').value,hora=$('occHora').value||nowTime();let ctx={team:[]};try{ctx=await provider.occurrenceContext(data,hora)}catch{}const teamIds=new Set((ctx.team||[]).map(x=>Number(x.guarda_id)));teamIds.add(Number(provider.session?.guarda_id));const refs=provider.references().guardas||[];$('occEquipe').innerHTML=refs.map(g=>`<label class="${teamIds.has(Number(g.id))?'suggested':''}"><input type="checkbox" class="occ-team" value="${g.id}" ${teamIds.has(Number(g.id))?'checked':''}> ${esc(g.nome_guerra||g.nome_completo)}</label>`).join('');document.querySelectorAll('.occ-team').forEach(x=>x.addEventListener('change',atualizarOccCondutor));atualizarOccCondutor()}
async function abrirNovaOcorrencia(){$('occForm').reset();$('occData').value=hoje();$('occHora').value=nowTime();$('occAlgemas').value='NÃƒO';document.querySelectorAll('.occ-nat').forEach(x=>x.checked=false);await preencherEquipeOcorrencia();$('occFormCard').classList.remove('hidden');$('occFormCard').scrollIntoView({behavior:'smooth',block:'start'})}
async function salvarOcorrencia(e){e.preventDefault();try{const naturezas=[...document.querySelectorAll('.occ-nat:checked')].map(x=>x.value),comp=occEquipeIds(),cond=Number($('occCondutor').value);if(!naturezas.length&&!$('occNaturezaOutro').value.trim())throw new Error('Informe ao menos uma natureza da ocorrÃªncia.');if(!comp.length)throw new Error('Selecione os membros da equipe.');if(!cond||!comp.includes(cond))throw new Error('O condutor deve fazer parte da equipe.');if($('occAlgemas').value==='SIM'&&!$('occJustAlgemas').value.trim())throw new Error('Justifique o uso de algemas.');const d={data:$('occData').value,hora:$('occHora').value,tipo:naturezas.join(', ')||$('occNaturezaOutro').value.trim()||'OUTRO',naturezas:JSON.stringify(naturezas),natureza_outro:$('occNaturezaOutro').value.trim(),recebida_via:$('occVia').value,recebida_via_outro:$('occViaOutro').value.trim(),local:$('occLocal').value.trim(),suspeitos_dados:$('occSuspeitos').value.trim(),suspeitos_sexo:$('occSuspeitosSexo').value,suspeitos_sexo_outro:$('occSuspeitosSexoOutro').value.trim(),vitimas_dados:$('occVitimas').value.trim(),vitimas_sexo:$('occVitimasSexo').value,vitimas_sexo_outro:$('occVitimasSexoOutro').value.trim(),testemunhas_dados:$('occTestemunhas').value.trim(),uso_algemas:$('occAlgemas').value,justificativa_algemas:$('occJustAlgemas').value.trim(),materiais_apreendidos:$('occMateriais').value.trim(),composicao_equipe:JSON.stringify(comp),condutor_ocorrencia_id:cond,responsavel_id:Number(provider.session?.guarda_id),procedimentos_adotados:$('occProcedimentos').value.trim(),historico_ocorrencia:$('occHistorico').value.trim(),criado_em:new Date().toISOString()};await provider.entityMutate('ocorrencias_operacionais','','UPSERT',d);$('occMsg').textContent='OcorrÃªncia registrada e enviada para sincronizaÃ§Ã£o.';$('occFormCard').classList.add('hidden');await carregarOcorrencias()}catch(err){$('occMsg').textContent=err.message}}

async function atualizarSubstituidosPermuta(){
  const sel=$('pmSubstituto'),data=$('pmData')?.value,turno=$('pmTurno')?.value,msg=$('pmMsg'),btn=$('pmEnviar');if(!sel)return;
  sel.disabled=true;if(btn)btn.disabled=true;sel.innerHTML='<option value="">Consultando escala...</option>';
  if(msg){msg.className='full request-message';msg.textContent='';}
  if(!data||!turno){sel.innerHTML='<option value="">Selecione data e turno</option>';return;}
  try{
    const r=await provider.permutaCandidatesFor(data,turno);
    if(r.bloqueado){sel.innerHTML='<option value="">IndisponÃ­vel neste perÃ­odo</option>';if(msg){msg.textContent=r.message;msg.classList.add('error');}return;}
    const lista=r.candidates||[];sel.innerHTML='<option value="">Selecione...</option>'+lista.map(x=>`<option value="${x.guarda_id}">${esc(x.nome_guerra||'GCM')}</option>`).join('');
    if(!lista.length)sel.innerHTML='<option value="">Nenhum GCM escalado neste perÃ­odo</option>';else{sel.disabled=false;if(btn)btn.disabled=false;}
  }catch(e){sel.innerHTML='<option value="">NÃ£o foi possÃ­vel consultar</option>';if(msg){msg.textContent=e.message;msg.classList.add('error');}}
}
function renderPermutas(){
  const el=$('listaPermutasSolicitadas');if(!el)return;
  const req=provider.actionRequests().filter(x=>String(x.tipo||'').toUpperCase()==='PERMUTA');
  el.innerHTML=req.length?req.map(x=>{const q=x.payload||{},st=String(x.status||'PENDENTE').toUpperCase(),nome=nomeCandidato(q.substituido_id||q.substituto_id);return `<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} Â· ${esc(q.data||'')} Â· Turno ${esc(q.turno||'-')}</small><strong>GCM substituÃ­do: ${esc(nome)}</strong><span class="status-pill status-${esc(st)}">${esc(st)}</span>${q.observacao?`<span>${esc(q.observacao)}</span>`:''}${x.resposta?`<small>${esc(x.resposta)}</small>`:''}${x.editable?`<div class="request-actions"><button class="mini" data-pm-edit="${x.id}">Editar</button><button class="mini" data-pm-del="${x.id}">Excluir solicitaÃ§Ã£o</button></div>`:''}</div>`}).join(''):'<div class="empty">Nenhuma solicitaÃ§Ã£o de permuta enviada.</div>';
  document.querySelectorAll('[data-pm-edit]').forEach(b=>b.onclick=()=>editarPermutaSolicitacao(Number(b.dataset.pmEdit)));
  document.querySelectorAll('[data-pm-del]').forEach(b=>b.onclick=()=>cancelarPermutaSolicitacao(Number(b.dataset.pmDel)));
}

function renderPermutasGestao(){
  const card=$('permutaGestaoCard'),el=$('listaPermutasGestao');if(!card||!el)return;const gestor=provider.gestor()&&provider.pode('permutas','EDICAO');card.classList.toggle('hidden',!gestor);if(!gestor)return;
  const req=provider.actionRequests().filter(x=>String(x.tipo||'').toUpperCase()==='PERMUTA');
  el.innerHTML=req.length?req.map(x=>{const q=x.payload||{},st=String(x.status||'PENDENTE').toUpperCase(),sol=x.nome_guerra||pessoaPorId(x.guarda_id)||'GCM',sub=pessoaPorId(q.substituido_id)||nomeCandidato(q.substituido_id)||'GCM';const pend=['PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP','CANCELAMENTO_COMANDO_PENDENTE'].includes(st);return `<article class="record-card"><div class="record-card-head"><strong>${esc(sol)} assume serviÃ§o de ${esc(sub)}</strong><span class="status-pill status-${esc(st)}">${esc(st)}</span></div><div class="record-meta">${fmt(q.data)} Â· Turno ${esc(q.turno||'-')} Â· ${Number(q.servico_extra)?'ServiÃ§o extra':'ServiÃ§o ordinÃ¡rio'}</div>${q.observacao?`<div>${esc(q.observacao)}</div>`:''}${x.resposta?`<small>${esc(x.resposta)}</small>`:''}${pend?`<div class="request-actions"><button class="mini" data-cmd-pm-ok="${x.id}">Aprovar</button><button class="mini" data-cmd-pm-no="${x.id}">Recusar</button><button class="mini danger-soft" data-cmd-pm-del="${x.id}">Excluir solicitaÃ§Ã£o</button></div>`:''}</article>`}).join(''):'<div class="empty">Nenhuma solicitaÃ§Ã£o de permuta visÃ­vel ao Comando.</div>';
  el.querySelectorAll('[data-cmd-pm-ok]').forEach(b=>b.onclick=()=>decidirPermutaComando(Number(b.dataset.cmdPmOk),'APROVADA'));
  el.querySelectorAll('[data-cmd-pm-no]').forEach(b=>b.onclick=()=>decidirPermutaComando(Number(b.dataset.cmdPmNo),'NEGADA'));
  el.querySelectorAll('[data-cmd-pm-del]').forEach(b=>b.onclick=()=>excluirPermutaComando(Number(b.dataset.cmdPmDel)));
}
async function decidirPermutaComando(id,decisao){let motivo='';if(decisao==='NEGADA'){motivo=prompt('Informe o motivo da recusa da permuta:','')||'';if(!motivo.trim())return alert('O motivo da recusa Ã© obrigatÃ³rio.')}else{motivo=prompt('ObservaÃ§Ã£o da aprovaÃ§Ã£o (opcional):','')||'';}try{await provider.decidePermutaRequest(id,decisao,motivo);renderTudo(false);setView('permutas')}catch(e){alert(e.message)}}
async function excluirPermutaComando(id){const motivo=prompt('Informe o motivo da exclusÃ£o/cancelamento administrativo:','SolicitaÃ§Ã£o registrada de forma equivocada')||'';if(!motivo.trim())return;if(!confirm('Retirar esta solicitaÃ§Ã£o pendente da fila? O histÃ³rico administrativo serÃ¡ preservado.'))return;try{await provider.adminDeletePermutaRequest(id,motivo);renderTudo(false);setView('permutas')}catch(e){alert(e.message)}}
function resetPermutaForm(){permutaEditingId=null;$('pmTitulo').textContent='Nova solicitaÃ§Ã£o de permuta';$('pmEnviar').textContent='Enviar solicitaÃ§Ã£o';$('pmCancelarEdicao').classList.add('hidden');$('pmData').value='';$('pmTurno').value='A';$('pmExtra').value='0';$('pmSubstituto').value='';$('pmObs').value='';$('pmTermo').checked=false;}
async function editarPermutaSolicitacao(id){const x=provider.actionRequests().find(r=>Number(r.id)===id&&String(r.tipo).toUpperCase()==='PERMUTA');if(!x||!x.editable)return;const q=x.payload||{};permutaEditingId=id;$('pmTitulo').textContent='Editar solicitaÃ§Ã£o de permuta';$('pmEnviar').textContent='Salvar alteraÃ§Ã£o';$('pmCancelarEdicao').classList.remove('hidden');$('pmData').value=q.data||'';$('pmTurno').value=q.turno||'A';$('pmExtra').value=String(Number(q.servico_extra||0));$('pmObs').value=q.observacao||'';$('pmTermo').checked=!!q.concordou_termo;await atualizarSubstituidosPermuta();$('pmSubstituto').value=String(q.substituido_id||q.substituto_id||'');$('permutaCard').scrollIntoView({behavior:'smooth',block:'start'});}
async function cancelarPermutaSolicitacao(id){if(!confirm('Excluir/cancelar esta solicitaÃ§Ã£o de permuta enquanto ainda estÃ¡ pendente?'))return;try{await provider.cancelPermutaRequest(id);renderTudo(false);setView('permutas')}catch(e){alert(e.message)}}
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
  $('listaBanco').innerHTML=b.slice(0,40).map(x=>`<div class="item"><small>${fmt(x.data_fato)} Â· ${esc(x.classe||'50')}%${gestor&&x.nome_guerra?' Â· '+esc(x.nome_guerra):''}</small><strong>${esc(x.tipo||x.origem||'MovimentaÃ§Ã£o')}</strong><span>${String(x.natureza).toUpperCase()==='DEBITO'?'-':'+'}${horas(x.minutos)}</span></div>`).join('')||'<div class="empty">Sem movimentaÃ§Ãµes.</div>';

  const req=provider.actionRequests().filter(x=>String(x.tipo||'').toUpperCase()==='BANCO_HORAS_CORRECAO');
  const lr=$('listaCorrecoes');if(lr)lr.innerHTML=req.length?req.map(x=>{const p=x.payload||{},min=Number(p.minutos_solicitados||0),status=String(x.status||'PENDENTE').toUpperCase();return `<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} Â· ${esc(p.data_servico||'')} Â· ${horas(min)}</small><strong>${esc(status)}</strong><span>${esc(p.descricao||'SolicitaÃ§Ã£o de correÃ§Ã£o')}</span>${x.resposta?`<small>${esc(x.resposta)}</small>`:''}</div>`}).join(''):'<div class="empty">Nenhuma solicitaÃ§Ã£o de correÃ§Ã£o enviada.</div>';
}

function renderBancoGestao(){
  const card=$('bancoGestaoCard'),el=$('listaBancoGestao');if(!card||!el)return;const gestor=provider.gestor()&&provider.pode('banco_horas','EDICAO');card.classList.toggle('hidden',!gestor);if(!gestor)return;
  const req=provider.actionRequests().filter(x=>String(x.tipo||'').toUpperCase()==='BANCO_HORAS_CORRECAO');
  el.innerHTML=req.length?req.map(x=>{const p=x.payload||{},st=String(x.status||'PENDENTE').toUpperCase(),min=Number(p.minutos_solicitados||0),hor=min/60,pend=['PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP'].includes(st),nome=x.nome_guerra||pessoaPorId(x.guarda_id)||'GCM';return `<article class="record-card"><div class="record-card-head"><strong>${esc(nome)} â€” ${fmt(p.data_servico)}</strong><span class="status-pill status-${esc(st)}">${esc(st)}</span></div><div class="record-meta">CompetÃªncia ${esc(p.competencia||'-')} Â· solicitado ${horas(min)}</div><div>${esc(p.descricao||'SolicitaÃ§Ã£o de correÃ§Ã£o')}</div>${x.resposta?`<small>${esc(x.resposta)}</small>`:''}${pend?`<div class="form-grid command-review"><label>Horas a reconhecer<input type="number" min="0.5" step="0.5" value="${hor}" data-bh-hours="${x.id}"></label><label>Classe<select data-bh-class="${x.id}"><option value="50" ${String(p.classe||'50')==='50'?'selected':''}>50%</option><option value="100" ${String(p.classe)==='100'?'selected':''}>100%</option></select></label><div class="request-actions full"><button class="mini" data-cmd-bh-ok="${x.id}">Aprovar / corrigir</button><button class="mini" data-cmd-bh-no="${x.id}">Recusar</button></div></div>`:''}</article>`}).join(''):'<div class="empty">Nenhuma solicitaÃ§Ã£o de correÃ§Ã£o visÃ­vel ao Comando.</div>';
  el.querySelectorAll('[data-cmd-bh-ok]').forEach(b=>b.onclick=()=>decidirBancoComando(Number(b.dataset.cmdBhOk),'APROVADA'));
  el.querySelectorAll('[data-cmd-bh-no]').forEach(b=>b.onclick=()=>decidirBancoComando(Number(b.dataset.cmdBhNo),'RECUSADA'));
}
async function decidirBancoComando(id,decisao){const req=provider.actionRequests().find(x=>Number(x.id)===id);if(!req)return;let motivo='';const horasInput=document.querySelector(`[data-bh-hours="${id}"]`),classeInput=document.querySelector(`[data-bh-class="${id}"]`);const min=Math.round(Number(horasInput?.value||0)*60),classe=classeInput?.value||'50';if(decisao==='RECUSADA'){motivo=prompt('Informe o motivo da recusa:','')||'';if(!motivo.trim())return alert('O motivo da recusa Ã© obrigatÃ³rio.')}else if(min<30||min%30!==0)return alert('Informe no mÃ­nimo 30 minutos, em blocos de 30 minutos.');try{await provider.decideBankRequest(id,decisao,{minutos_solicitados:min||Number(req.payload?.minutos_solicitados||0),classe,motivo});renderTudo(false);setView('banco')}catch(e){alert(e.message)}}


function valorOnline(v){if(v==null)return'';if(typeof v==='object')return JSON.stringify(v);return String(v)}
function pessoaPorId(v){const todos=[...(provider.guardas()||[]),...(provider.permutationCandidates()||[]),...(refData().guardas||[])];const x=todos.find(g=>Number(g.guarda_id||g.id)===Number(v));return x?.nome_guerra||x?.nome_completo||''}
function rotuloOnline(k,v){return valorApresentacao(k,v)}
let onlineModuleFilter='';
function renderCatalogoOnline(){
  const el=$('onlineEntidades');if(!el)return;
  const lista=onlineModuleFilter?onlineCatalog.filter(c=>c.modulo===onlineModuleFilter):onlineCatalog;
  el.innerHTML=lista.map(c=>`<article class="module-card ready" data-online-entity="${esc(c.entity)}"><div><strong>${esc(c.titulo)}</strong><small>${esc(c.modulo)} Â· ${c.can_edit?'ediÃ§Ã£o online':'consulta online'}</small></div><span class="level">${c.can_edit?'EDIÃ‡ÃƒO':'CONSULTA'}</span></article>`).join('')||'<div class="empty">Nenhum conjunto de dados online autorizado para este mÃ³dulo.</div>';
  document.querySelectorAll('[data-online-entity]').forEach(x=>x.addEventListener('click',()=>abrirEntidadeOnline(x.dataset.onlineEntity)));
}
async function carregarOnlineCatalog(){
  try{onlineCatalog=await provider.entityCatalog();onlineModuleFilter='';renderCatalogoOnline();renderModulos();}
  catch(e){const el=$('onlineEntidades');if(el)el.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function configurarCabecalhoModulo(modulo){
  const meta=MODULOS_GCMBS.find(m=>m.id===modulo)||{};
  const primary=PRIMARY_ENTITY[modulo],cfg=ENTITY_UI[primary]||{};
  if($('onlineModuloTitulo'))$('onlineModuloTitulo').textContent=cfg.titulo||meta.nome||'MÃ³dulo institucional';
  if($('onlineModuloDescricao'))$('onlineModuloDescricao').textContent=cfg.descricao||meta.descricao||'Dados sincronizados com o GCMBS Desktop.';
  if($('onlineNivel')){const edit=provider.pode(modulo,'EDICAO');$('onlineNivel').textContent=edit?'EDIÃ‡ÃƒO':'CONSULTA';$('onlineNivel').className='level '+(edit?'edit':'read');}
  if($('onlineVersao'))$('onlineVersao').textContent='Android '+APP_VERSION;
}
async function abrirModuloOnline(modulo){
  if(!onlineCatalog.length){try{onlineCatalog=await provider.entityCatalog()}catch(e){onlineCatalog=[]}}
  onlineModuleFilter=modulo;setView('online');configurarCabecalhoModulo(modulo);$('onlineRegistrosCard').classList.add('hidden');$('onlineEntidades').closest('.card').classList.remove('hidden');
  document.querySelectorAll('#mainNav [data-module]').forEach(x=>x.classList.toggle('active',x.dataset.module===modulo));
  const primary=PRIMARY_ENTITY[modulo],available=onlineCatalog.find(c=>c.entity===primary&&c.modulo===modulo);
  if(available){await abrirEntidadeOnline(primary);return;}
  renderCatalogoOnline();
}
function renderEntityTabs(){
  const host=$('onlineEntityTabs');if(!host)return;const itens=onlineCatalog.filter(c=>c.modulo===onlineModuleFilter);
  host.innerHTML=itens.length>1?itens.map(c=>`<button type="button" class="module-tab ${onlineCurrent?.entity===c.entity?'active':''}" data-entity-tab="${esc(c.entity)}">${esc(c.titulo)}</button>`).join(''):'';
  host.classList.toggle('hidden',itens.length<=1);host.querySelectorAll('[data-entity-tab]').forEach(b=>b.addEventListener('click',()=>abrirEntidadeOnline(b.dataset.entityTab)));
}
async function abrirEntidadeOnline(entity){
  const b=await provider.entityList(entity,500,0);onlineCurrent=b.catalog;onlineRecords=b.records||[];const cfg=uiEntity();
  $('onlineTitulo').textContent=cfg.titulo||onlineCurrent.titulo;if($('onlineDescricao'))$('onlineDescricao').textContent=cfg.descricao||'Dados sincronizados com o GCMBS Desktop.';
  $('onlineNovo').textContent=cfg.action||'Novo registro';$('onlineNovo').classList.toggle('hidden',!onlineCurrent.can_edit);
  if($('onlineTotal'))$('onlineTotal').textContent=String(onlineRecords.length);
  if($('onlineFiltro'))$('onlineFiltro').placeholder='Pesquisar em '+(cfg.titulo||onlineCurrent.titulo||'registros').toLowerCase()+'...';
  $('onlineEntidades').closest('.card').classList.add('hidden');$('onlineRegistrosCard').classList.remove('hidden');
  if($('onlineVoltar'))$('onlineVoltar').classList.toggle('hidden',!!(onlineModuleFilter&&PRIMARY_ENTITY[onlineModuleFilter]));renderEntityTabs();
  renderRegistrosOnline();
}
function renderRegistrosOnline(){
  const q=String($('onlineFiltro')?.value||'').toLowerCase(),el=$('onlineRegistros');if(!el||!onlineCurrent)return;
  const list=onlineRecords.filter(r=>JSON.stringify(r.data||{}).toLowerCase().includes(q));if($('onlineFiltrados'))$('onlineFiltrados').textContent=q?`${list.length} encontrado(s)`:'Todos os registros';
  const cfg=uiEntity();
  el.innerHTML=list.map(r=>{
    const d=r.data||{},ord=cfg.order||[];const keys=[...ord.filter(k=>Object.prototype.hasOwnProperty.call(d,k)),...Object.keys(d).filter(k=>!ord.includes(k))];
    const pairs=keys.filter(k=>!ONLINE_HIDE_FIELDS.has(String(k).toLowerCase())&&!['id'].includes(String(k).toLowerCase())).slice(0,18).map(k=>[k,d[k]]);
    return `<div class="item" data-online-key="${esc(r.record_key)}"><div class="online-kv">${pairs.map(([k,v])=>`<b>${esc(onlineLabel(k))}</b><span>${esc(rotuloOnline(k,v))}</span>`).join('')}</div>${onlineCurrent.can_edit?`<div class="online-record-actions"><button class="mini" data-online-edit="${esc(r.record_key)}">Editar</button>${(onlineCurrent.entity!=='manutencao_viaturas'||provider.gestor())?`<button class="mini danger-soft" data-online-del="${esc(r.record_key)}">Excluir</button>`:''}</div>`:''}</div>`;
  }).join('')||'<div class="empty">Nenhum registro.</div>';
  document.querySelectorAll('[data-online-edit]').forEach(b=>b.addEventListener('click',()=>editarOnline(b.dataset.onlineEdit)));
  document.querySelectorAll('[data-online-del]').forEach(b=>b.addEventListener('click',()=>excluirOnline(b.dataset.onlineDel)));
}
function campoOnline(col,val){
  const name=String(col.name||''),lower=name.toLowerCase();
  if(Number(col.pk)>0||['criado_por','analisado_por','criado_em','atualizado_em','arquivo_dados','arquivo_tipo','origem_id','referencia_id','movimentacao_id','movimento_vinculado_id','entidade_id','usuario_id','escala_id','extra_id'].includes(lower))return'';
  if(onlineCurrent?.entity==='justificativas_faltas'&&['status','arquivo_nome'].includes(lower))return'';
  if(onlineCurrent?.entity==='abastecimento_viaturas'&&lower==='motorista')return'';
  if(lower==='guarda_id'&&!provider.gestor())return'';
  const type=String(col.type||'').toUpperCase(),v=valorOnline(val),label=onlineLabel(name);
  if(/^(viatura_id|viatura_principal_id|viatura_substituta_id|hist_viatura_id)$/.test(lower)){
    const all=(refData().viaturas||[]);
    const lista=onlineCurrent?.entity==='manutencao_viaturas'?all:all.filter(x=>!['MANUTENCAO','MANUTENÃ‡ÃƒO','INDISPONIVEL','INDISPONÃVEL','BAIXADA','INATIVA'].includes(String(x.situacao_operacional||x.status||'ATIVA').toUpperCase()));
    const opts=lista.map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc([x.prefixo,x.placa,x.modelo,x.situacao_operacional].filter(Boolean).join(' Â· '))}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='equipe_id'){
    const opts=(refData().equipes||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc(x.nome||'Equipe')}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='posto_id'||lower==='posto_prioritario_id'){
    const opts=(refData().postos||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc([x.nome,x.tipo].filter(Boolean).join(' Â· '))}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='posto_prioritario'&&onlineCurrent?.entity==='guardas'){
    const opts=(refData().postos||[]).map(x=>`<option value="${esc(x.nome||'')}" ${String(x.nome||'')===String(v)?'selected':''}>${esc([x.nome,x.tipo].filter(Boolean).join(' Â· '))}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Sem posto prioritÃ¡rio</option>${opts}</select></label>`;
  }
  if(lower==='equipe'&&onlineCurrent?.entity==='guardas'){
    const opts=(refData().equipes||[]).map(x=>`<option value="${esc(x.nome||'')}" ${String(x.nome||'')===String(v)?'selected':''}>${esc(x.nome||'Equipe')}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Sem equipe informada</option>${opts}</select></label>`;
  }
  if(/^(guarda_id|substituido_id|substituto_id|motorista_id|recebido_por|encaminhado_por|responsavel_id|condutor_ocorrencia_id)$/.test(lower)){
    const opts=(refData().guardas||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc(x.nome_guerra||x.nome_completo||'GCM')}</option>`).join('');
    return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='tipo_escala_id'){
    const opts=(refData().tipos_escalas||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc(x.nome||x.descricao||'Tipo de escala')}</option>`).join('');return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='evento_id'){
    const opts=(refData().eventos||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc([x.nome,x.data,x.local].filter(Boolean).join(' Â· '))}</option>`).join('');return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='oficio_id'){
    const opts=(refData().oficios||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc([x.numero_oficio,x.data_demanda,x.local_demanda].filter(Boolean).join(' Â· '))}</option>`).join('');return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='grupo_id'){
    const opts=(refData().grupos_ativacao||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc(x.nome||'Grupo')}</option>`).join('');return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='equipe_servico_id'){
    const opts=(refData().equipes||[]).map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc(x.nome||'Equipe')}</option>`).join('');return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${opts}</select></label>`;
  }
  if(lower==='justificativa_id'){
    const gid=Number((onlineEditing?.data||{}).guarda_id||provider.session?.guarda_id||0);const lista=(refData().justificativas||[]).filter(x=>!gid||Number(x.guarda_id)===gid);
    const opts=lista.map(x=>`<option value="${esc(x.id)}" ${Number(x.id)===Number(v)?'selected':''}>${esc([fmt(x.data_inicial),x.motivo].filter(Boolean).join(' Â· '))}</option>`).join('');return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Sem justificativa vinculada</option>${opts}</select></label>`;
  }
  if(/_id$/.test(lower)&&!['id','origem_id','referencia_id','movimentacao_id','movimento_vinculado_id','escala_id','extra_id','usuario_id','entidade_id'].includes(lower))return `<label>${esc(label)}<input type="hidden" data-online-field="${esc(name)}" value="${esc(v)}"><span class="field-auto">${esc(label)}: vÃ­nculo administrado automaticamente pelo sistema</span></label>`;
  if(lower==='consertado')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="0" ${Number(v)!==1?'selected':''}>NÃ£o</option><option value="1" ${Number(v)===1?'selected':''}>Sim</option></select></label>`;
  if(['autorizado_viatura','autorizado_motocicleta','disponivel_escala','pode_noite','pode_24h','exige_motorista','funcionamento_24h','ativa','participa_gerador'].includes(lower))return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="1" ${['1','SIM','TRUE'].includes(String(v).toUpperCase())?'selected':''}>Sim</option><option value="0" ${!['1','SIM','TRUE'].includes(String(v).toUpperCase())?'selected':''}>NÃ£o</option></select></label>`;
  if(lower==='combustivel')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="">Selecione...</option>${['GASOLINA','ETANOL','DIESEL','FLEX'].map(x=>`<option ${String(v).toUpperCase()===x?'selected':''}>${x}</option>`).join('')}</select></label>`;
  if(lower==='tipo'&&onlineCurrent?.entity==='viaturas')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="VIATURA" ${String(v||'VIATURA').toUpperCase()==='VIATURA'?'selected':''}>Viatura / carro</option><option value="MOTO" ${['MOTO','MOTOPATRULHA'].includes(String(v).toUpperCase())?'selected':''}>Motopatrulha</option></select></label>`;
  if(lower==='status'&&onlineCurrent?.entity==='viaturas')return `<label>${esc(label)}<select data-online-field="${esc(name)}">${['ATIVA','INDISPONIVEL','BAIXADA','INATIVA'].map(x=>`<option value="${x}" ${String(v||'ATIVA').toUpperCase()===x?'selected':''}>${x}</option>`).join('')}</select></label>`;
  if(lower==='modalidade_uso')return `<label>${esc(label)}<select data-online-field="${esc(name)}">${['INDIVIDUAL','VIATURA','COLETIVO'].map(x=>`<option ${String(v||'INDIVIDUAL').toUpperCase()===x?'selected':''}>${x}</option>`).join('')}</select></label>`;
  if(lower==='tipo_servico'&&onlineCurrent?.entity==='frequencia_registros')return `<label>${esc(label)}<select data-online-field="${esc(name)}" disabled><option value="${esc(v)}">${esc(v||'Selecione GCM e data')}</option></select><small>Preenchido automaticamente pela escala gravada.</small></label>`;
  if(lower==='tipo_servico')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="ORDINARIO" ${String(v||'ORDINARIO').toUpperCase()==='ORDINARIO'?'selected':''}>ServiÃ§o ordinÃ¡rio</option><option value="EXTRA" ${String(v).toUpperCase()==='EXTRA'?'selected':''}>ServiÃ§o extra</option></select></label>`;
  if(lower==='status')return `<label>${esc(label)}<input data-online-field="${esc(name)}" value="${esc(v||'ATIVA')}"></label>`;
  if(lower==='data'||/^data_/.test(lower)||['data_inicial','data_final','validade'].includes(lower)){
    const ro=onlineCurrent?.entity==='justificativas_faltas'&&lower==='data_final'?' readonly':'';
    return `<label>${esc(label)}<input data-online-field="${esc(name)}" type="date" value="${esc(String(v||'').slice(0,10))}"${ro}></label>`;
  }
  if(lower==='hora'||/^horario_/.test(lower))return `<label>${esc(label)}<input data-online-field="${esc(name)}" type="time" value="${esc(String(v||'').slice(0,5))}"></label>`;
  if(lower==='ativo')return `<label>${esc(label)}<select data-online-field="${esc(name)}"><option value="1" ${Number(v)!==0?'selected':''}>Sim</option><option value="0" ${Number(v)===0?'selected':''}>NÃ£o</option></select></label>`;
  if(type.includes('INT')||type.includes('REAL')||type.includes('NUM')) return `<label>${esc(label)}<input data-online-field="${esc(name)}" type="number" step="${type.includes('REAL')?'0.01':'1'}" value="${esc(v)}"></label>`;
  if(v.length>100||/observ|descr|histor|demanda|motivo/i.test(lower)) return `<label class="full">${esc(label)}<textarea data-online-field="${esc(name)}">${esc(v)}</textarea></label>`;
  return `<label>${esc(label)}<input data-online-field="${esc(name)}" value="${esc(v)}"></label>`;
}

function editarOnline(key=null){
  onlineEditing=key?onlineRecords.find(r=>String(r.record_key)===String(key)):null;const d=onlineEditing?.data||{},cfg=uiEntity();
  $('onlineEditorTitulo').textContent=(onlineEditing?'Editar ':'Novo ')+(cfg.titulo||onlineCurrent?.titulo||'registro');
  const cols=orderedColumns(),map=new Map(cols.map(c=>[c.name,c]));let html='';
  for(const sec of cfg.sections||[]){const [titulo,campos]=sec;const conteudo=campos.map(n=>map.has(n)?campoOnline(map.get(n),d[n]):'').join('');if(conteudo){html+=`<section class="form-section module-editor-section"><h3>${esc(titulo)}</h3><div class="form-grid">${conteudo}</div></section>`;campos.forEach(n=>map.delete(n));}}
  const restantes=[...map.values()].map(c=>campoOnline(c,d[c.name])).join('');if(restantes)html+=`<section class="form-section module-editor-section"><h3>Outros dados</h3><div class="form-grid">${restantes}</div></section>`;
  $('onlineCampos').className='module-editor-fields';$('onlineCampos').innerHTML=html;
  if(onlineCurrent?.entity==='justificativas_faltas'){
    $('onlineCampos').insertAdjacentHTML('beforeend',`<label class="full">Documento comprobatÃ³rio (JPG, PNG ou PDF)<input id="onlineArquivoJustificativa" type="file" accept="image/jpeg,image/png,application/pdf"><small>${d.arquivo_nome?`Atual: ${esc(d.arquivo_nome)}`:'Opcional'}</small></label>`);
  }
  $('onlineMsg').textContent='';$('onlineEditor').showModal();
  if(onlineCurrent?.entity==='frequencia_registros'){
    const atualizar=async()=>{const g=Number(document.querySelector('[data-online-field="guarda_id"]')?.value||0),dt=document.querySelector('[data-online-field="data"]')?.value,ts=document.querySelector('[data-online-field="tipo_servico"]'),ref=document.querySelector('[data-online-field="referencia_id"]');if(!g||!dt||!ts)return;try{const rr=await provider.frequencyServices(g,dt),sv=rr.services||[];ts.disabled=false;ts.innerHTML=sv.length?sv.map(x=>`<option value="${esc(x.tipo_servico)}" data-ref="${esc(x.referencia_id)}">${esc(x.tipo_servico==='ORDINARIO'?'ServiÃ§o ordinÃ¡rio':'ServiÃ§o extra')} Â· ${esc(x.turno||'')} Â· ${esc(x.referencia||'')}</option>`).join(''):'<option value="">Nenhum serviÃ§o gravado nesta data</option>';const setref=()=>{if(ref)ref.value=ts.selectedOptions[0]?.dataset.ref||''};ts.onchange=setref;setref()}catch(e){ts.innerHTML=`<option value="">${esc(e.message)}</option>`}};document.querySelector('[data-online-field="guarda_id"]')?.addEventListener('change',atualizar);document.querySelector('[data-online-field="data"]')?.addEventListener('change',atualizar);atualizar();
  }
}
async function salvarOnline(){
  try{
    const d={...(onlineEditing?.data||{})};
    document.querySelectorAll('[data-online-field]').forEach(i=>{let v=i.value;const c=onlineCurrent.columns.find(x=>x.name===i.dataset.onlineField);if(/INT|REAL|NUM/i.test(String(c?.type||''))&&v!=='')v=Number(v);d[i.dataset.onlineField]=v});
    if(onlineCurrent.entity==='justificativas_faltas'){
      if(!provider.gestor())d.guarda_id=Number(provider.session?.guarda_id);
      const ini=String(d.data_inicial||''),dias=Math.max(1,Number(d.quantidade_dias||1));if(ini){const dt=new Date(`${ini}T00:00:00Z`);dt.setUTCDate(dt.getUTCDate()+dias-1);d.data_final=dt.toISOString().slice(0,10)}
      d.status=d.status||'ATIVA';d.tipo_servico=d.tipo_servico||'ORDINARIO';
      const f=$('onlineArquivoJustificativa')?.files?.[0];if(f){if(f.size>5*1024*1024)throw new Error('O documento deve ter no mÃ¡ximo 5 MB.');const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||'').split(',')[1]||'');r.onerror=()=>rej(new Error('NÃ£o foi possÃ­vel ler o documento.'));r.readAsDataURL(f)});d.arquivo_nome=f.name;d.arquivo_tipo=f.type;d.arquivo_dados=b64;}
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

function renderAvisosInstitucionais(){
  const lista=(provider.institutionalNotices?.()||[]).slice();
  const render=(host,limit=50)=>{if(!host)return;const arr=lista.slice(0,limit);host.innerHTML=arr.length?arr.map(x=>{const nivel=String(x.nivel||'NORMAL').toUpperCase();const ate=x.fim_em?` Â· atÃ© ${fmt(String(x.fim_em).slice(0,10))}`:'';return `<article class="notice-board-item ${esc(nivel)}"><small><span class="notice-priority">${esc(nivel)}</span> Â· ${fmt(String(x.created_at||x.inicio_em||'').slice(0,10))}${ate}</small><strong>${esc(x.titulo||'Comunicado')}</strong><p>${esc(x.mensagem||'')}</p>${x.criado_por_nome?`<small>Publicado por ${esc(x.criado_por_nome)}</small>`:''}</article>`}).join(''):'<div class="empty">Nenhum aviso institucional ativo.</div>';};
  render($('avisosHomeLista'),3);render($('listaAvisosInstitucionais'),50);
}

function renderAvisos(){
  const lista=provider.notifications().slice();
  const decisoes=provider.actionRequests().filter(x=>['APROVADA','RECUSADA','REPROVADA','CANCELADA'].includes(String(x.status||'').toUpperCase())).map(x=>({created_at:x.processado_em||x.created_at,titulo:String(x.tipo).toUpperCase()==='PERMUTA'?'DecisÃ£o de permuta':'DecisÃ£o do Banco de Horas',mensagem:x.resposta||`SituaÃ§Ã£o: ${x.status}`,synthetic:true}));
  const naoLidas=lista.filter(x=>!x.lida_em).length;
  const badge=$('navAvisosBadge'); if(badge){badge.textContent=naoLidas?String(naoLidas):'';badge.classList.toggle('hidden',!naoLidas);}
  const todos=[...decisoes,...lista];
  $('listaAvisos').innerHTML=todos.length?todos.map(x=>`<div class="item notice-item ${!x.synthetic&&!x.lida_em?'unread':''}" ${x.id?`data-notification-id="${x.id}"`:''}><small>${fmt(String(x.created_at||'').slice(0,10))}${x.data_evento?' Â· evento '+fmt(x.data_evento):''}</small><strong>${esc(x.titulo||'Aviso')}</strong><span>${esc(x.mensagem||'')}</span>${x.id&&!x.lida_em?'':' '}${x.id&&!x.lida_em?'<button class="mini" data-read="'+x.id+'">Marcar como lido</button>':''}</div>`).join(''):'<div class="empty">Nenhuma notificaÃ§Ã£o.</div>';
  document.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',async()=>{try{await provider.markNotificationRead(Number(b.dataset.read));renderAvisos();}catch(e){alert(e.message)}}));
}


function renderSolicitacoes(){
  const lista=provider.actionRequests();
  $('listaSolicitacoes').innerHTML=lista.length?lista.map(x=>`<div class="item"><small>${fmt(String(x.created_at||'').slice(0,10))} Â· ${esc(x.tipo||'')}</small><strong>${esc(x.status||'PENDENTE')}</strong><span>${esc(x.resposta||'Aguardando processamento pelo Desktop.')}</span></div>`).join(''):'<div class="empty">Nenhuma solicitaÃ§Ã£o enviada pelo aplicativo.</div>';
}
function renderPermutaCandidates(){const el=$('pmSubstituto');if(!el)return;if(!$('pmData')?.value){el.disabled=true;el.innerHTML='<option value="">Selecione data e turno</option>';const btn=$('pmEnviar');if(btn)btn.disabled=true;}}
async function enviarBancoCorrecao(ev){
  ev.preventDefault();const h=Number($('bcHoras').value||0),m=Number($('bcMinutos').value||0),total=h*60+m,msg=$('bcMsg'),btn=$('bcEnviar');
  msg.className='full request-message';
  if(total<30||total%30!==0){msg.textContent='A correÃ§Ã£o deve ter no mÃ­nimo 30 minutos e sempre em blocos de 30 minutos.';msg.classList.add('error');return}
  btn.disabled=true;msg.textContent='Enviando...';
  try{
    const comp=$('bcComp').value,data=$('bcData').value,classe=$('bcClasse').value,descricao=$('bcDescricao').value;
    const r=await provider.requestBankCorrection({competencia:comp,data_servico:data,minutos_solicitados:total,classe,tipo_correcao:'HORAS_NAO_LANCADAS',descricao});
    msg.textContent=`SolicitaÃ§Ã£o enviada com sucesso${r?.request?.id?' Â· protocolo #'+r.request.id:''}. Aguardando anÃ¡lise do Comando.`;msg.classList.add('success');
    $('bcComp').value='';$('bcData').value='';$('bcHoras').value='0';$('bcMinutos').value='0';$('bcClasse').value='50';$('bcDescricao').value='';
    renderTudo(false);setView('banco');
  }catch(e){msg.textContent=e.message;msg.classList.add('error')}finally{btn.disabled=false}
}
async function enviarPermuta(ev){
  ev.preventDefault();const msg=$('pmMsg');msg.className='full request-message';msg.textContent='Enviando...';
  try{const req={data:$('pmData').value,turno:$('pmTurno').value,servico_extra:Number($('pmExtra').value),substituido_id:Number($('pmSubstituto').value),observacao:$('pmObs').value,concordou_termo:$('pmTermo').checked};const r=permutaEditingId?await provider.updatePermutaRequest(permutaEditingId,req):await provider.requestPermuta(req);msg.textContent=permutaEditingId?'SolicitaÃ§Ã£o atualizada. Aguardando decisÃ£o do Comando.':'SolicitaÃ§Ã£o enviada. Acompanhe o histÃ³rico nesta tela.';msg.classList.add('success');resetPermutaForm();renderTudo(false);setView('permutas')}catch(e){msg.textContent=e.message;msg.classList.add('error')}
}

async function enviarMensagemComando(ev){ev.preventDefault();const ret=$('msgComandoRetorno');ret.className='full request-message';ret.textContent='Enviando...';try{const destino=$('msgDestino').value,ids=[...$('msgGcms').selectedOptions].map(o=>Number(o.value));const r=await provider.sendInstitutionalMessage({titulo:$('msgTitulo').value,mensagem:$('msgConteudo').value,nivel:$('msgNivel')?.value||'NORMAL',fim_em:$('msgFim')?.value||null,destino,guarda_ids:ids});ret.textContent=`Mensagem enviada para ${r.enviadas||0} destinatÃ¡rio(s).`;ret.classList.add('success');$('msgTitulo').value='';$('msgConteudo').value='';if($('msgFim'))$('msgFim').value='';if($('msgNivel'))$('msgNivel').value='NORMAL';await provider.load();renderAvisosInstitucionais();renderAvisos()}catch(e){ret.textContent=e.message;ret.classList.add('error')}}
function renderMensagemComando(){const card=$('mensagemComandoCard');if(!card)return;const permitido=provider.gestor()&&provider.pode('central_pendencias','EDICAO');card.classList.toggle('hidden',!permitido);if(!permitido)return;const sel=$('msgGcms');const pessoas=(refData().guardas||[]).map(x=>({guarda_id:x.guarda_id||x.id,nome_guerra:x.nome_guerra||x.nome_completo}));sel.innerHTML=pessoas.map(x=>`<option value="${x.guarda_id}">${esc(x.nome_guerra||'GCM')}</option>`).join('');}
function renderRelatoriosFrota(){
  const el=$('frotaRelatorioAtalhos');if(!el)return;const mods=[['viaturas','Cadastro de Viaturas','Frota, tipo e situaÃ§Ã£o'],['manutencao_viaturas','ManutenÃ§Ãµes','Baixas, oficinas e retornos'],['abastecimento_viaturas','Abastecimentos','Consumo, km e motorista'],['checklist_viaturas','Check-lists','InspeÃ§Ãµes e pendÃªncias']].filter(x=>temAcesso(x[0]));
  el.innerHTML=mods.map(x=>`<button class="report-launch" type="button" data-frota-open="${x[0]}"><strong>${x[1]}</strong><span>${x[2]}</span><b>ABRIR â†’</b></button>`).join('')||'<div class="empty">Nenhum conjunto da frota autorizado.</div>';
  el.querySelectorAll('[data-frota-open]').forEach(b=>b.addEventListener('click',()=>abrirModuloPrincipal(b.dataset.frotaOpen)));
  const refs=refData(),vs=refs.viaturas||[];if($('rfTotal'))$('rfTotal').textContent=String(vs.length);if($('rfAtivas'))$('rfAtivas').textContent=String(vs.filter(v=>!['MANUTENCAO','MANUTENÃ‡ÃƒO','INDISPONIVEL','INDISPONÃVEL','BAIXADA','INATIVA'].includes(String(v.situacao_operacional||v.status||'ATIVA').toUpperCase())).length);
}
function renderCentralPendencias(){
  const host=$('pendenciasLista');if(!host)return;const req=(provider.actionRequests()||[]).filter(x=>!['APROVADA','RECUSADA','REPROVADA','CANCELADA','CONCLUIDA'].includes(String(x.status||'PENDENTE').toUpperCase()));const notif=(provider.notifications()||[]).filter(x=>!x.lida_em);
  const itens=[...req.map(x=>({data:x.created_at,tipo:'SolicitaÃ§Ã£o',titulo:String(x.tipo||'PENDÃŠNCIA').replace(/_/g,' '),texto:x.resposta||'Aguardando anÃ¡lise/processamento.',status:x.status||'PENDENTE',modulo:String(x.tipo||'').startsWith('PERMUTA')?'permutas':String(x.tipo||'').startsWith('BANCO_HORAS')?'banco_horas':''})),...notif.map(x=>({data:x.created_at,tipo:'Aviso',titulo:x.titulo||'NotificaÃ§Ã£o',texto:x.mensagem||'',status:'NÃƒO LIDA',modulo:x.referencia_tipo&&String(x.referencia_tipo).includes('PERMUTA')?'permutas':''}))].sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  if($('pTotal'))$('pTotal').textContent=String(itens.length);if($('pSolic'))$('pSolic').textContent=String(req.length);if($('pAvisos'))$('pAvisos').textContent=String(notif.length);
  host.innerHTML=itens.map(x=>`<article class="pending-card" ${x.modulo?`data-pend-open="${esc(x.modulo)}" tabindex="0" role="button"`:''}><div><small>${esc(x.tipo)} Â· ${fmt(String(x.data||'').slice(0,10))}</small><strong>${esc(x.titulo)}</strong><p>${esc(x.texto)}</p></div><span class="status-pill status-PENDENTE">${esc(x.status)}</span></article>`).join('')||'<div class="empty">Nenhuma pendÃªncia visÃ­vel para seu perfil.</div>'; host.querySelectorAll('[data-pend-open]').forEach(el=>{const abrir=()=>abrirModuloPrincipal(el.dataset.pendOpen);el.addEventListener('click',abrir);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();abrir();}})});
}

function renderTudo(resetView=true){
  renderNavegacao();
  renderPerfil();
  renderModulos();
  renderInicio();
  if(temAcesso('escalas')) renderEscalas();
  renderViaturas();
  if(temAcesso('permutas')) {renderPermutas();renderPermutasGestao();}
  if(temAcesso('banco_horas')) {renderBanco();renderBancoGestao();}
  renderAvisosInstitucionais();
  renderAvisos();
  renderSolicitacoes();
  renderPermutaCandidates();
  renderMensagemComando();
  renderCentralPendencias();
  if(resetView){
    const primeiro=MODULOS_GCMBS.find(m=>temAcesso(m.id));
    if(primeiro) abrirModuloPrincipal(primeiro.id).catch(()=>setView('perfil')); else setView('perfil');
  }
}

function atualizarStatusConexao(){const el=$('connectionStatus');if(!el)return;const on=navigator.onLine;el.textContent=on?'Online':'Sem conexÃ£o';el.className='connection-status '+(on?'online':'offline');}

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
  await aplicarIdentidadeVisual();atualizarStatusConexao();window.addEventListener('online',atualizarStatusConexao);window.addEventListener('offline',atualizarStatusConexao);if($('quadroData'))$('quadroData').value=hoje();if($('escalaIni'))$('escalaIni').value=hoje();if($('escalaFim'))$('escalaFim').value=hoje();
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
  document.querySelectorAll('#quadroAvisosHome [data-go="avisos"]').forEach(b=>b.addEventListener('click',()=>setView('avisos')));
  $('menuToggle')?.addEventListener('click',()=>{if($('mainNav')?.classList.contains('open'))fecharMenu();else abrirMenu()});
  $('navBackdrop')?.addEventListener('click',fecharMenu);
  $('chkNovo')?.addEventListener('click',abrirNovoChecklist);$('chkCancelar')?.addEventListener('click',()=>$('chkFormCard').classList.add('hidden'));$('chkForm')?.addEventListener('submit',salvarChecklist);$('chkViatura')?.addEventListener('change',atualizarChecklistContexto);$('chkKm')?.addEventListener('input',atualizarChecklistContexto);$('chkTrocaOleo')?.addEventListener('change',()=>{$('chkKmTrocaBox').classList.toggle('hidden',!$('chkTrocaOleo').checked);if($('chkTrocaOleo').checked&&!$('chkKmTroca').value)$('chkKmTroca').value=$('chkKm').value||''});
  $('occNovo')?.addEventListener('click',abrirNovaOcorrencia);$('occCancelar')?.addEventListener('click',()=>$('occFormCard').classList.add('hidden'));$('occForm')?.addEventListener('submit',salvarOcorrencia);$('occData')?.addEventListener('change',preencherEquipeOcorrencia);$('occHora')?.addEventListener('change',preencherEquipeOcorrencia);
  $('onlineVoltar')?.addEventListener('click',voltarOnline);
  $('onlineFiltro')?.addEventListener('input',renderRegistrosOnline);
  $('onlineNovo')?.addEventListener('click',()=>editarOnline());
  $('onlineSalvar')?.addEventListener('click',salvarOnline);
  $('onlineCancelar')?.addEventListener('click',()=>$('onlineEditor').close());$('onlineCancelarBottom')?.addEventListener('click',()=>$('onlineEditor').close());
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

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=100049',{updateViaCache:'none'}).catch(()=>{});}

$('escalaEditorFechar')?.addEventListener('click',()=>$('escalaEditor')?.close());$('escalaCancelarAjuste')?.addEventListener('click',()=>$('escalaEditor')?.close());$('escalaSalvarAjuste')?.addEventListener('click',salvarAjusteEscala);


