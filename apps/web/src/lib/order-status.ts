import type { OrderStatus } from '@lanchonete/contracts';

// Rótulos VISÍVEIS AO CLIENTE (seção 5.1). Estados internos da loja não vazam:
// `awaiting_acceptance` e `accepted` aparecem como "Recebido" — o cliente não
// precisa saber se alguém já clicou em Aceitar.
const CUSTOMER_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  awaiting_acceptance: 'Recebido',
  accepted: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  out_for_delivery: 'A caminho',
  completed: 'Concluído',
};

export function customerStatusLabel(status: OrderStatus): string {
  return CUSTOMER_LABELS[status];
}

// Etapas exibidas na linha do tempo, por tipo de entrega. Na retirada não existe
// "a caminho" (decisão #19).
export function customerSteps(deliveryType: 'pickup' | 'delivery'): OrderStatus[] {
  return deliveryType === 'delivery'
    ? ['awaiting_acceptance', 'preparing', 'ready', 'out_for_delivery', 'completed']
    : ['awaiting_acceptance', 'preparing', 'ready', 'completed'];
}

// Posição do status atual na linha do tempo. `accepted` compartilha a etapa de
// "Recebido"; `pending_payment` ainda não entrou na linha.
export function stepIndexFor(status: OrderStatus, steps: OrderStatus[]): number {
  if (status === 'pending_payment') return -1;
  const normalized: OrderStatus = status === 'accepted' ? 'awaiting_acceptance' : status;
  return steps.indexOf(normalized);
}
