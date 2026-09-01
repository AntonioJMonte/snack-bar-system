import { ApiError, ContractError } from './api';

// Traduz os códigos de DomainError da API (build-order.ts, payments.service.ts)
// para mensagens que o cliente entende. Códigos desconhecidos caem no genérico:
// nunca mostrar detalhe técnico de servidor ao consumidor final.
const MESSAGES: Record<string, string> = {
  STORE_CLOSED: 'A loja está fechada no momento. Nenhum pedido foi criado.',
  ITEM_NOT_FOUND: 'Um item do seu carrinho não está mais no cardápio.',
  ITEM_INACTIVE: 'Um item do seu carrinho ficou indisponível.',
  ITEM_SOLD_OUT: 'Um item do seu carrinho esgotou.',
  ADDON_NOT_FOR_ITEM: 'Um adicional escolhido não pertence mais ao item.',
  ADDON_INACTIVE: 'Um adicional escolhido ficou indisponível.',
  REGION_NOT_FOUND: 'A região de entrega selecionada não existe.',
  REGION_INACTIVE: 'Não estamos entregando nessa região no momento.',
  ORDER_NOT_PAYABLE: 'Este pedido não está mais aguardando pagamento.',
  ORDER_NOT_FOUND: 'Pedido não encontrado.',
  VALIDATION_ERROR: 'Confira os dados informados e tente novamente.',
};

export function userMessageFor(error: unknown): string {
  if (error instanceof ApiError) {
    // A API já manda uma mensagem pronta para os erros de negócio (ela nomeia o
    // item que esgotou, por exemplo); preferimos ela quando existe.
    if (error.code && MESSAGES[error.code]) {
      return error.body.message ?? MESSAGES[error.code];
    }
    return 'Não foi possível concluir agora. Tente novamente.';
  }
  if (error instanceof ContractError) {
    return 'Recebemos uma resposta inesperada do servidor. Tente novamente.';
  }
  return 'Falha de conexão. Verifique sua internet e tente novamente.';
}

// Erros que invalidam o carrinho: o cliente precisa voltar e ajustar os itens.
const CART_INVALIDATING = new Set([
  'ITEM_NOT_FOUND',
  'ITEM_INACTIVE',
  'ITEM_SOLD_OUT',
  'ADDON_NOT_FOR_ITEM',
  'ADDON_INACTIVE',
]);

export function invalidatesCart(error: unknown): boolean {
  return error instanceof ApiError && !!error.code && CART_INVALIDATING.has(error.code);
}
