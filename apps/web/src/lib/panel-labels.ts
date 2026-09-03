import type { OrderStatus } from '@lanchonete/contracts';

// Rótulos OPERACIONAIS (painel da loja) — diferentes dos rótulos do cliente em
// order-status.ts, que escondem o estado interno.
const PANEL_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  awaiting_acceptance: 'Aguardando aceite',
  accepted: 'Aceito',
  preparing: 'Em preparo',
  ready: 'Pronto',
  out_for_delivery: 'A caminho',
  completed: 'Concluído',
  expired: 'Expirado',
};

export function panelStatusLabel(status: OrderStatus): string {
  return PANEL_LABELS[status];
}

// Texto do botão que leva ao PRÓXIMO status — verbo de ação, não nome de estado:
// quem opera está com pressa e clica no que vai fazer, não no que já é.
const ADVANCE_LABELS: Partial<Record<OrderStatus, string>> = {
  preparing: 'Iniciar preparo',
  ready: 'Marcar como pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Concluir pedido',
};

export function advanceActionLabel(next: OrderStatus): string {
  return ADVANCE_LABELS[next] ?? 'Avançar';
}

// Telefone nacional (10 ou 11 dígitos) para leitura humana no painel.
export function formatPhone(national: string): string {
  if (national.length === 11) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return national;
}

// Minutos decorridos desde a criação — o que a cozinha realmente olha.
export function minutesSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
