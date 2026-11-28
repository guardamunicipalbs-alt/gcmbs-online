import './sync-button-hotfix-v62.js?v=100076';
import {MODULES, canonicalModule, ENTITY_BY_ID} from './communication-contract.js?v=100250';
// v74: o runtime canônico não carrega hotfixes opcionais fora do manifesto.
// V219: confirmação isolada da cessão 321 pelo GCM titular autenticado.

// V368: APENAS O ONLINE. O contrato de sincronizacao continua integral e imutavel.
// Modulos abaixo permanecem no Desktop e no transporte, mas nao entram no bundle de navegacao.
export const ONLINE_DESKTOP_ONLY = new Set([
  'cadastro_guardas','equipes','postos','gerador_escala','escalas','tipos_escalas',
  'escala_extra_manual','viaturas','relatorios_frota','controle_acesso','cautelas',
  'gratificacao_motorista','feriados',
  'eventos_extra','folha_pagamento','cursos','frequencia','central_pendencias','imagens','imagens_gcm','avisos'
]);
// R2: politica de navegacao local, independente do catalogo remoto.
const normalizeOnlineId = id => String(id ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_');
const removedAliases = new Set(['pendencias','central_de_pendencias','quadro_avisos','quadro_de_avisos','institutional_notices','notices','cursos_e_habilitacoes','servico_extra_por_evento','eventos_servico_extra_por_evento','imagens_da_gcm','folhas_fechadas']);
export function onlineModuleBlocked(id){
  const key=normalizeOnlineId(id);
  return ONLINE_DESKTOP_ONLY.has(canonicalModule(key)) || removedAliases.has(key);
}
export function onlineEntityBlocked(id){
  const key=normalizeOnlineId(id);
  const meta=Object.prototype.hasOwnProperty.call(ENTITY_BY_ID,key)?ENTITY_BY_ID[key]:null;
  return !key || !meta || onlineModuleBlocked(meta.module) || onlineModuleBlocked(key);
}
export function onlineCatalogAllowed(row){
  return !!row && !onlineModuleBlocked(row.modulo) && !onlineEntityBlocked(row.entity);
}
// R21: lista explícita de menus publicados; o contrato de transporte permanece integral.
export const ONLINE_VISIBLE_MODULES = new Set(["dashboard","justificativas_faltas","permutas","banco_horas","relatorios","checklist_viaturas","manutencao_viaturas","abastecimento_viaturas","ocorrencias","operacoes_especiais"]);
export const MODULOS_GCMBS = MODULES
  .filter(m=>ONLINE_VISIBLE_MODULES.has(m.id)&&!onlineModuleBlocked(m.id))
  .map(m=>({...m,nome:m.name,descricao:m.description}));

export function normalizarPerfil(session={}){
  const role=String(session.role||session.perfil||'').trim().toLowerCase();
  const cargo=String(session.cargo||'').trim().toUpperCase();
  if(role==='comandante' || (/\bCOMANDANTE\b/.test(cargo) && !/SUBCOMANDANTE/.test(cargo))) return 'comandante';
  if(role==='subcomandante' || /\bSUBCOMANDANTE/.test(cargo)) return 'subcomandante';
  return role||'gcm';
}

export function controleTotal(session={}){
  return session.controle_total===true || normalizarPerfil(session)==='comandante';
}
