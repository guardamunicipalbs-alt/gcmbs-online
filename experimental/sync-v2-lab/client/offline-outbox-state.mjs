/**
 * GCMBS Sync V2 - prototipo puro de estados da fila offline.
 * Nao realiza HTTP, SQL nem aprovacao de servico.
 * A garantia de nao duplicar depende TAMBEM de idempotencia transacional no servidor.
 */
export const STATES=Object.freeze({
  PENDING_SEND:"PENDING_SEND",
  SERVER_RECEIVED:"SERVER_RECEIVED",
  AWAITING_DESKTOP:"AWAITING_DESKTOP",
  FINAL_CONFIRMED:"FINAL_CONFIRMED",
  REJECTED:"REJECTED",
  CONFLICT:"CONFLICT",
});
function validId(id){return typeof id==="string" && /^[0-9a-fA-F-]{20,80}$/.test(id);}
export function newPendingOperation({ clientChangeId, guardaId, type, payload, createdAt }) {
  if (!validId(clientChangeId)) throw new Error("Identificador de idempotencia invalido");
  if (!Number.isSafeInteger(guardaId)||guardaId<=0) throw new Error("Guarda invalido");
  if (typeof type!=="string"||!type||type.length>70) throw new Error("Tipo invalido");
  if (!payload||typeof payload!=="object"||Array.isArray(payload)) throw new Error("Payload invalido");
  if (typeof createdAt!=="string"||!Number.isFinite(Date.parse(createdAt))) throw new Error("Data invalida");
  // Credenciais/senhas NUNCA entram na fila SQLite local. Rotinas de reset
  // de senha V296 precisam de canal autenticado especifico, nao desta fila.
  // Inspecionar o objeto de entrada ANTES da serializacao, sem circularidade.
  const stack=[{value:payload,depth:0}],seen=new WeakSet();
  while(stack.length){
    const {value,depth}=stack.pop();
    if(!value||typeof value!=="object")continue;
    if(seen.has(value))throw new Error("Referencia circular/repetida no payload");
    seen.add(value);
    if(depth>10)throw new Error("Payload profundo demais");
    for(const [key,entry] of Object.entries(value)){
      if(/(?:^|_)(?:senha|password|passwd|token|secret|authorization|credential|api[_-]?key|pin)(?:$|_)/i.test(key))
        throw new Error("Credencial proibida na fila offline");
      if(typeof entry==="function"||typeof entry==="symbol"||typeof entry==="bigint")
        throw new Error("Payload nao JSON");
      if(entry&&typeof entry==="object")stack.push({value:entry,depth:depth+1});
    }
  }
  const encoded=JSON.stringify(payload);
  if(typeof encoded!=="string"||new TextEncoder().encode(encoded).length>32*1024)
    throw new Error("Payload excede limite seguro");
  const data=JSON.parse(encoded);
  return Object.freeze({
    client_change_id:clientChangeId,guarda_id:guardaId,type,payload:data,
    created_at:createdAt,status:STATES.PENDING_SEND,attempts:0,server_id:null,last_error:null,
  });
}
export function prepareRetry(operation) {
  if (operation.status!==STATES.PENDING_SEND) throw new Error("Operacao nao pendente de envio");
  return Object.freeze({ ...operation, attempts:operation.attempts+1 });
}
export function acknowledgeServer(operation,{ clientChangeId, serverId, pendingDesktop=false }) {
  if (clientChangeId!==operation.client_change_id) throw new Error("ACK nao corresponde a operacao");
  if (!Number.isSafeInteger(serverId)||serverId<=0) throw new Error("ID de servidor invalido");
  if (![STATES.PENDING_SEND,STATES.SERVER_RECEIVED,STATES.AWAITING_DESKTOP].includes(operation.status))
    throw new Error("Operacao nao pode receber ACK");
  if (operation.server_id!==null && operation.server_id!==serverId)
    throw new Error("Servidor retornou outra identidade");
  // Repeticoes/reordenacao de ACKs nunca podem rebaixar um estado confirmado.
  // A resposta mais antiga (SERVER_RECEIVED) nao desfaz AWAITING_DESKTOP.
  const alreadyWaiting=operation.status===STATES.AWAITING_DESKTOP;
  return Object.freeze({
    ...operation,server_id:serverId,
    status:(alreadyWaiting || pendingDesktop)?STATES.AWAITING_DESKTOP:STATES.SERVER_RECEIVED,
    last_error:null,
  });
}
export function finalizeAfterReconciliation(operation,{serverId, outcome}) {
  if (![STATES.SERVER_RECEIVED,STATES.AWAITING_DESKTOP].includes(operation.status))
    throw new Error("Nao ha comprovante de recebimento");
  if (operation.server_id!==serverId) throw new Error("Referência oficial diferente");
  if (!["CONFIRMED","REJECTED","CONFLICT"].includes(outcome))
    throw new Error("Resultado invalido");
  return Object.freeze({
    ...operation,
    status: outcome==="CONFIRMED"?STATES.FINAL_CONFIRMED:
      outcome==="REJECTED"?STATES.REJECTED:STATES.CONFLICT,
  });
}
