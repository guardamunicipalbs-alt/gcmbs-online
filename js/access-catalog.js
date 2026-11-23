import './sync-button-hotfix-v62.js?v=100076';
import {MODULES} from './communication-contract.js?v=100250';
// v74: o runtime canônico não carrega hotfixes opcionais fora do manifesto.
// V219: confirmação isolada da cessão 321 pelo GCM titular autenticado.

// V368: APENAS O ONLINE. O contrato de sincronizacao continua integral e imutavel.
// Modulos abaixo permanecem no Desktop e no transporte, mas nao entram no bundle de navegacao.
export const ONLINE_DESKTOP_ONLY = new Set([
  'cadastro_guardas','equipes','postos','gerador_escala','escalas','tipos_escalas',
  'escala_extra_manual','viaturas','relatorios_frota','controle_acesso','cautelas'
]);
export const MODULOS_GCMBS = MODULES
  .filter(m=>!ONLINE_DESKTOP_ONLY.has(m.id))
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
