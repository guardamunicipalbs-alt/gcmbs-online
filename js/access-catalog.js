import './stability-hotfix-v62.js?v=100073';
import './sync-button-hotfix-v62.js?v=100073';
import {MODULES} from './communication-contract.js?v=100073';

// Extensoes funcionais sao carregadas depois do nucleo para nunca bloquear o login.
// Auditoria automatica fica suspensa temporariamente para evitar rajadas de consultas ao banco.
// P0 usa import opcional. A Folha possui um único import canônico em login-security.js.
let extensoesAgendadas=false;
const importarOpcional=async(caminho,rotulo)=>{
  try{await import(caminho);}catch(e){console.error(`[GCMBS] Falha em extensao opcional ${rotulo}`,e);}
};
const carregarExtensoesOpcionais=()=>{
  if(extensoesAgendadas)return;
  extensoesAgendadas=true;
  setTimeout(()=>importarOpcional('./p0-online-workflows.js?v=100073','P0'),400);
};
if(document.readyState==='complete') carregarExtensoesOpcionais();
else window.addEventListener('load',carregarExtensoesOpcionais,{once:true});
setTimeout(carregarExtensoesOpcionais,1500);

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
