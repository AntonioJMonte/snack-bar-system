import { Injectable, Logger, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';

// Rate limit falha em SILÊNCIO por natureza — e este sistema inteiro foi feito
// contra falha silenciosa. Webhook barrado é pagamento não confirmado; cliente
// barrado no checkout é venda perdida que ninguém contabiliza. Todo bloqueio
// vira log (decisão #35).
@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger('Throttler');

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    this.logger.warn(
      `throttle.blocked method=${request.method} route=${request.originalUrl} ip=${request.ip} ` +
        `handler=${context.getClass().name}.${context.getHandler().name} ` +
        `hits=${detail.totalHits} limit=${detail.limit} ttl_ms=${detail.ttl}`,
    );
    return super.throwThrottlingException(context, detail);
  }
}
