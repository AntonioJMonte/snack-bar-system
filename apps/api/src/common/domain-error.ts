// Erros de regra de negócio, cada um com código específico e identificável
// (exigência da Etapa 4: nenhum bloqueio genérico).
export type DomainErrorCode =
  | 'ITEM_NOT_FOUND'
  | 'ITEM_INACTIVE'
  | 'ITEM_SOLD_OUT'
  | 'ADDON_NOT_FOR_ITEM'
  | 'ADDON_INACTIVE'
  | 'REGION_NOT_FOUND'
  | 'REGION_INACTIVE'
  | 'STORE_CLOSED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_PAYABLE'
  | 'INVALID_STATUS_TRANSITION';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
