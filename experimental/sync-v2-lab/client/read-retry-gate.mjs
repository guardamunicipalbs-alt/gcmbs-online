/**
 * GCMBS Sync V2 - prototipo isolado de controle de RETENTATIVAS DE LEITURA AUTOMATICA.
 * NAO integra o Online/Android por enquanto.
 * Nunca impedir envio de permutas, aceite, aprovacao ou operacoes manuais.
 */
const MINUTE = 60_000;
export class ReadRetryGate {
  constructor({ now = () => Date.now(), maxWaitMs = 60 * MINUTE } = {}) {
    this.now = now;
    this.maxWaitMs = maxWaitMs;
    this.blockedUntil = 0;
    this.transientFailures = 0;
    this.lastReason = "";
  }
  automaticReadAllowed() {
    return this.now() >= this.blockedUntil;
  }
  remainingMs() {
    return Math.max(0, this.blockedUntil - this.now());
  }
  success() {
    this.blockedUntil = 0;
    this.transientFailures = 0;
    this.lastReason = "";
  }
  fail({ status = 0, retryAfterMs = null } = {}) {
    // 401 e 403 precisam de fluxo explicito de autenticacao/permissao;
    // nao serao tratados como limite de transferencia.
    if (status === 401 || status === 403) {
      this.lastReason = "authorization";
      this.blockedUntil = this.now() + 5 * MINUTE;
      return this.remainingMs();
    }
    // A cota esgotada (402) pode persistir ate renovar o ciclo.
    // Nao realizar polling agressivo. Teste expor um retry por hora.
    if (status === 402) {
      this.lastReason = "quota";
      this.blockedUntil = this.now() + this.maxWaitMs;
      return this.remainingMs();
    }
    if (status === 429 || status >= 500 || status === 0) {
      this.transientFailures += 1;
      this.lastReason = status === 429 ? "rate_limit" : "temporary";
      const exponential = Math.min(this.maxWaitMs, 15_000 * (2 ** Math.min(this.transientFailures - 1, 12)));
      const retryAfter = Number.isFinite(retryAfterMs) && retryAfterMs !== null && retryAfterMs >= 0
        ? retryAfterMs : 0;
      const delay = Math.min(this.maxWaitMs, Math.max(exponential, retryAfter));
      this.blockedUntil = this.now() + delay;
      return delay;
    }
    // Outros 4xx representam invalidacao do pedido, nao outage global.
    return 0;
  }
}
