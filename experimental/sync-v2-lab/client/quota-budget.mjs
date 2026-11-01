/**
 * GCMBS Sync V2 - orcamento de Egress, apenas calculo puro e offline.
 * Entrada obrigatoria: BYTES FATURADOS de Egress obtidos da plataforma.
 * Nao tentar substituir metricas do Billing por bytes de consultas SQL.
 */
const GB=1000**3;
export const DEFAULT_EGRESS_LIMIT_BYTES = 5 * GB;
export const TARGET_EGRESS_BYTES = Math.round(3.5 * GB);

export function assessEgressBudget({
  billedBytes,
  elapsedDays,
  cycleDays,
  targetBytes = TARGET_EGRESS_BYTES,
  planLimitBytes = DEFAULT_EGRESS_LIMIT_BYTES,
  minimumSampleDays = 3,
} = {}) {
  if (!Number.isSafeInteger(billedBytes) || billedBytes < 0) throw new Error("Egress faturado invalido");
  if (!Number.isInteger(cycleDays) || cycleDays < 28 || cycleDays > 31) throw new Error("Ciclo invalido");
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0 || elapsedDays > cycleDays)
    throw new Error("Dias decorridos invalidos");
  if (!Number.isSafeInteger(planLimitBytes) || planLimitBytes <= 0 ||
      !Number.isSafeInteger(targetBytes) || targetBytes <= 0 || targetBytes >= planLimitBytes)
    throw new Error("Limites invalidos");
  if (!Number.isFinite(minimumSampleDays) || minimumSampleDays < 1)
    throw new Error("Amostra invalida");
  const remainingToLimitBytes = Math.max(0, planLimitBytes - billedBytes);
  const remainingToTargetBytes = Math.max(0, targetBytes - billedBytes);
  const averageDailyBytes = billedBytes / elapsedDays;
  // Projetar linearmente nao captura picos de consumo; a metrica e indicativa.
  const projectedCycleBytes = Math.ceil(averageDailyBytes * cycleDays);
  const sampleSufficient = elapsedDays >= minimumSampleDays;
  let status = "INSUFFICIENT_SAMPLE";
  if (billedBytes >= planLimitBytes) status = "LIMIT_REACHED";
  else if (billedBytes >= targetBytes) status = "TARGET_REACHED";
  else if (sampleSufficient && projectedCycleBytes >= planLimitBytes) status = "PROJECTED_LIMIT";
  else if (sampleSufficient && projectedCycleBytes >= targetBytes) status = "PROJECTED_TARGET";
  else if (sampleSufficient) status = "WITHIN_TARGET";
  return Object.freeze({
    status, sampleSufficient, actualBilledBytes:billedBytes,
    actualFractionOfLimit:billedBytes / planLimitBytes,
    averageDailyBytes:Math.ceil(averageDailyBytes),
    projectedCycleBytes, remainingToLimitBytes, remainingToTargetBytes,
    maximumDailyBytesForRemainingTarget: elapsedDays < cycleDays ?
      Math.floor(remainingToTargetBytes / (cycleDays - elapsedDays)) : 0,
    sourceRequired:"SUPABASE_BILLED_EGRESS_METRIC",
    projectionIsEstimate:true,
  });
}
