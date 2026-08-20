import './audit-pending-fixes.js';
import './p0-online-workflows.js';

export const MODULOS_GCMBS = [
  {id:'dashboard',nome:'Quadro Operacional',descricao:'Indicadores integrados do efetivo, escalas e frota',mobile:'inicio'},
  {id:'cadastro_guardas',nome:'Cadastro de Guardas',descricao:'Dados pessoais, habilitações e configuração operacional'},
  {id:'justificativas_faltas',nome:'Justificativa de Faltas',descricao:'Faltas ordinárias e extras'},
  {id:'equipes',nome:'Equipes',descricao:'Vinculação de GCMs, jornadas e ciclos operacionais'},
  {id:'postos',nome:'Postos Operacionais',descricao:'Prioridade, mínimo, máximo, viatura e motorista'},
  {id:'gerador_escala',nome:'Gerador de Escala',descricao:'Distribuição automática conforme regras operacionais'},
  {id:'escalas',nome:'Gerenciar Escalas',descricao:'Consulta das escalas salvas',mobile:'escala'},
  {id:'tipos_escalas',nome:'Tipos de Escalas',descricao:'Jornadas e horários usados pelas equipes'},
  {id:'escala_extra_manual',nome:'Escala Extra',descricao:'Complementos e ajustes operacionais',mobile:'extras'},
  {id:'feriados',nome:'Feriados',descricao:'Dias não úteis considerados pelo sistema'},
  {id:'permutas',nome:'Permutas',descricao:'Solicitação e análise de troca ou assunção de serviço',mobile:'permutas'},
  {id:'eventos_extra',nome:'Eventos / Serviço Extra por Evento',descricao:'Serviços extraordinários vinculados a eventos'},
  {id:'folha_pagamento',nome:'Folha de Pagamento',descricao:'Apuração mensal de horas extras e valores'},
  {id:'banco_horas',nome:'Banco de Horas',descricao:'Créditos, débitos, correções e auditoria',mobile:'banco'},
  {id:'relatorios',nome:'Relatórios',descricao:'Consultas e impressão das informações operacionais',mobile:'escala'},
  {id:'viaturas',nome:'Cadastro de Viaturas',descricao:'Frota disponível para postos e escalas'},
  {id:'manutencao_viaturas',nome:'Manutenção de Viaturas',descricao:'Baixa e retorno da frota',mobile:'viaturas'},
  {id:'abastecimento_viaturas',nome:'Abastecimento',descricao:'Histórico de consumo da frota',mobile:'viaturas'},
  {id:'checklist_viaturas',nome:'Check-list de Viaturas',descricao:'Inspeção operacional da frota'},
  {id:'relatorios_frota',nome:'Relatórios da Frota',descricao:'Viaturas, manutenções e abastecimentos'},
  {id:'ocorrencias',nome:'Ocorrências / Produção',descricao:'Registro de atividade operacional'},
  {id:'cautelas',nome:'Equipamentos e Cautelas',descricao:'Controle de equipamentos e responsabilidades'},
  {id:'cursos',nome:'Cursos e Habilitações',descricao:'Capacitações, datas e comprovantes'},
  {id:'operacoes_especiais',nome:'Ofícios',descricao:'Ofícios e demandas recebidas'},
  {id:'frequencia',nome:'Frequência',descricao:'Consolidação de escalas, extras e afastamentos'},
  {id:'central_pendencias',nome:'Central de Pendências',descricao:'Alertas administrativos consolidados'},
  {id:'controle_acesso',nome:'Controle de Acesso',descricao:'Permissões por GCM e nível de acesso'},
  {id:'imagens_gcm',nome:'Imagens da GCM',descricao:'Identidade visual, escudo e ícone do aplicativo'}
];

export function normalizarPerfil(session={}){
  const role=String(session.role||session.perfil||'').trim().toLowerCase();
  const cargo=String(session.cargo||'').trim().toUpperCase();
  if(role==='comandante' || (/\bCOMANDANTE\b/.test(cargo) && !/SUBCOMANDANTE/.test(cargo))) return 'comandante';
  if(role==='subcomandante' || /\bSUBCOMANDANTE\b/.test(cargo)) return 'subcomandante';
  return role||'gcm';
}

export function controleTotal(session={}){
  return session.controle_total===true || normalizarPerfil(session)==='comandante';
}
