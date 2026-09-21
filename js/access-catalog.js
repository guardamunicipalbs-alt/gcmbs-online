import './sync-button-hotfix-v62.js?v=100076';
import {MODULES} from './communication-contract.js?v=100076';
import './gcmbs-cessao-aceite-v219.js?v=219';

// v74: o runtime canônico não carrega hotfixes opcionais fora do manifesto.
// V219: confirmação isolada da cessão 321 pelo GCM titular autenticado.

export const MODULOS_GCMBS = MODULES.map(m=>({...m,nome:m.name,descricao:m.description}));

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
