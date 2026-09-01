'use client';

import type { OrderStatus } from '@lanchonete/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { fetchOrderHistory } from '@/lib/admin-endpoints';
import { formatCents } from '@/lib/money';
import { formatPhone, panelStatusLabel } from '@/lib/panel-labels';

const FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'awaiting_acceptance', label: 'Aguardando aceite' },
  { value: 'preparing', label: 'Em preparo' },
  { value: 'ready', label: 'Pronto' },
  { value: 'out_for_delivery', label: 'A caminho' },
  { value: 'completed', label: 'Concluído' },
  { value: 'pending_payment', label: 'Aguardando pagamento' },
];

// Lista de pedidos (seção 5.7): o registro definitivo da operação, incluindo os
// já concluídos — o painel de produção mostra apenas os ativos.
export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['order-history', filter],
    queryFn: () => fetchOrderHistory(filter === 'all' ? undefined : filter, 100),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              filter === option.value
                ? 'border-brand bg-brand text-white'
                : 'border-border-subtle bg-surface text-ink-muted hover:border-brand',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-ink-muted">Carregando pedidos…</p>
      ) : (orders ?? []).length === 0 ? (
        <p className="py-12 text-center text-ink-muted">Nenhum pedido neste filtro.</p>
      ) : (
        <ul className="space-y-3">
          {(orders ?? []).map((order) => (
            <li key={order.id} className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-lg font-bold tabular-nums">#{order.number}</span>
                  <span className="rounded bg-surface-muted px-2 py-0.5 text-sm text-ink-muted">
                    {panelStatusLabel(order.status)}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {order.channel === 'web' ? 'site' : 'WhatsApp'}
                  </span>
                </div>
                <span className="text-sm text-ink-muted">
                  {new Date(order.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="font-medium">{order.customerName}</span>
                <a href={`tel:+55${order.customerPhone}`} className="text-brand underline">
                  {formatPhone(order.customerPhone)}
                </a>
                <span className="text-ink-muted">
                  {order.deliveryType === 'delivery' ? `Entrega — ${order.address ?? ''}` : 'Retirada'}
                </span>
              </div>

              <ul className="mt-2 text-sm text-ink-muted">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.itemName}
                    {item.discountPercentApplied > 0 && (
                      <span className="ml-2 text-brand">
                        (desconto de {item.discountPercentApplied}% aplicado na compra)
                      </span>
                    )}
                    {item.note && <span className="ml-2 italic">— {item.note}</span>}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2">
                <span className="text-sm text-ink-muted">
                  {order.payment
                    ? `Pagamento ${order.payment.status} · ${order.payment.method}`
                    : 'Sem pagamento registrado'}
                </span>
                <span className="font-bold tabular-nums">{formatCents(order.totalCents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
