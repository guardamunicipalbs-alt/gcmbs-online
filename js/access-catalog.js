import './sync-button-hotfix-v62.js?v=100075';
import {MODULES} from './communication-contract.js?v=100075';

// v74: o runtime canônico não carrega hotfixes opcionais fora do manifesto.

export const MODULOS_GCMBS = MODULES.map(m=>({...m,nome:m.name,descricao:m.description}));

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
