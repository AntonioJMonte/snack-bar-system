'use client';

import { allowedNextStatus, type Order } from '@lanchonete/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import { advanceActionLabel, formatPhone, minutesSince, panelStatusLabel } from '@/lib/panel-labels';

interface OrderCardProps {
  order: Order;
  busy: boolean;
  onAccept: () => void;
  onAdvance: (status: NonNullable<ReturnType<typeof allowedNextStatus>>) => void;
}

export function OrderCard({ order, busy, onAccept, onAdvance }: OrderCardProps) {
  const needsAcceptance = order.status === 'awaiting_acceptance';
  const next = allowedNextStatus(order.deliveryType, order.status);
  const elapsed = minutesSince(order.createdAt);

  return (
    <article
      className={cn(
        'rounded-xl border bg-surface p-5',
        // Pedido não aceito com cor e tamanho diferenciados (seção 8.2): o painel
        // precisa ser legível a alguns metros de distância.
        needsAcceptance ? 'border-4 border-brand shadow-lg' : 'border-border-subtle',
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className={cn('font-bold tabular-nums', needsAcceptance ? 'text-3xl' : 'text-xl')}>
            #{order.number}
          </span>
          <span
            className={cn(
              'rounded px-2 py-0.5 text-sm font-medium',
              needsAcceptance ? 'bg-brand text-white' : 'bg-surface-muted text-ink-muted',
            )}
          >
            {panelStatusLabel(order.status)}
          </span>
        </div>
        <span className="text-sm text-ink-muted">
          {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'} · há {elapsed} min
        </span>
      </header>

      {/* Pagamento que chegou DEPOIS da expiração (decisão #34). O aceite já é
          humano, então nada entra em produção sozinho — o que faltava era a
          pessoa saber que este pedido não é novo antes de apertar Aceitar. */}
      {order.paidAfterExpiryAt && (
        <p
          role="alert"
          className="mt-3 rounded-lg border-2 border-danger bg-danger/10 px-3 py-2 text-base font-bold text-danger"
        >
          PAGAMENTO FORA DO PRAZO — confirme com o cliente antes de aceitar
        </p>
      )}

      <div className="mt-3">
        <p className={cn('font-medium', needsAcceptance && 'text-lg')}>{order.customerName}</p>
        {/* Telefone visível e clicável para ligar direto do celular (plano 14.3). */}
        <a
          href={`tel:+55${order.customerPhone}`}
          className={cn(
            'inline-block font-semibold text-brand underline',
            needsAcceptance ? 'text-lg' : 'text-base',
          )}
        >
          {formatPhone(order.customerPhone)}
        </a>
        {order.deliveryType === 'delivery' && order.address && (
          <p className="mt-1 text-sm text-ink-muted">{order.address}</p>
        )}
      </div>

      <ul className="mt-4 space-y-2 border-t border-border-subtle pt-3">
        {order.items.map((item) => (
          <li key={item.id}>
            <div className="flex justify-between gap-3">
              <span className={cn('font-medium', needsAcceptance && 'text-lg')}>
                {item.quantity}× {item.itemName}
              </span>
              <span className="tabular-nums text-ink-muted">
                {formatCents(item.unitNetPriceCents * item.quantity)}
              </span>
            </div>
            {item.addons.length > 0 && (
              <p className="text-sm text-ink-muted">
                + {item.addons.map((addon) => addon.name).join(', ')}
              </p>
            )}
            {/* Observação em destaque: é o que mais gera erro de produção. */}
            {item.note && (
              <p className="mt-0.5 rounded bg-brand/10 px-2 py-1 text-sm font-medium text-brand">
                {item.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-between border-t border-border-subtle pt-3">
        <span className="text-ink-muted">Total</span>
        <span className="text-lg font-bold tabular-nums">{formatCents(order.totalCents)}</span>
      </div>

      <div className="mt-4">
        {needsAcceptance ? (
          // O aceite é o que encerra o alerta e registra quem viu (seção 8.3).
          <Button size="panel" onClick={onAccept} disabled={busy} className="w-full">
            {busy ? 'Aceitando…' : 'Aceitar pedido'}
          </Button>
        ) : next ? (
          <Button
            variant="outline"
            size="panel"
            onClick={() => onAdvance(next)}
            disabled={busy}
            className="w-full"
          >
            {busy ? 'Atualizando…' : advanceActionLabel(next)}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
