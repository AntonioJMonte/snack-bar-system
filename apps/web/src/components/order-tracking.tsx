'use client';

import type { OrderTracking as Tracking } from '@lanchonete/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { fetchOrderTracking } from '@/lib/endpoints';
import { formatCents } from '@/lib/money';
import { customerStatusLabel, customerSteps, stepIndexFor } from '@/lib/order-status';

interface OrderTrackingProps {
  orderId: string;
  initialData: Tracking;
}

export function OrderTracking({ orderId, initialData }: OrderTrackingProps) {
  // Consulta periódica (PDF seção 3): o cliente vê o status avançar sem recarregar.
  // Pedido concluído não precisa mais de polling.
  const { data } = useQuery({
    queryKey: ['order-tracking', orderId],
    queryFn: () => fetchOrderTracking(orderId),
    initialData,
    refetchInterval: (query) =>
      query.state.data?.status === 'completed' ? false : 10_000,
  });

  const steps = customerSteps(data.deliveryType);
  const currentStep = stepIndexFor(data.status, steps);
  const awaitingPayment = data.status === 'pending_payment';

  return (
    <>
      <header className="mb-6">
        <p className="text-sm text-ink-muted">Pedido</p>
        <h1 className="text-2xl font-bold tracking-tight">#{data.number}</h1>
      </header>

      <section
        className={cn(
          'rounded-lg border p-5',
          awaitingPayment
            ? 'border-border-subtle bg-surface'
            : 'border-success/30 bg-success/5',
        )}
      >
        <p className="text-sm text-ink-muted">Status</p>
        <p
          className={cn(
            'text-xl font-semibold',
            awaitingPayment ? 'text-ink' : 'text-success',
          )}
        >
          {customerStatusLabel(data.status)}
        </p>

        {awaitingPayment && (
          <p className="mt-2 text-sm text-ink-muted">
            Assim que o pagamento for confirmado, seu pedido entra na fila da cozinha.
            Esta página se atualiza sozinha.
          </p>
        )}
      </section>

      {!awaitingPayment && (
        <ol className="mt-6 space-y-3">
          {steps.map((step, index) => {
            const done = index <= currentStep;
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                    done
                      ? 'border-success bg-success text-white'
                      : 'border-border-subtle text-ink-muted',
                  )}
                  aria-hidden="true"
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className={cn(done ? 'font-medium' : 'text-ink-muted')}>
                  {customerStatusLabel(step)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="mt-6 rounded-lg border border-border-subtle bg-surface p-4">
        <h2 className="mb-3 font-semibold">Itens</h2>
        <ul className="space-y-2">
          {data.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4 text-sm">
              <span>
                {item.quantity}× {item.itemName}
              </span>
              <span className="tabular-nums text-ink-muted">
                {formatCents(item.unitNetPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1 border-t border-border-subtle pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Subtotal</span>
            <span className="tabular-nums">{formatCents(data.subtotalNetCents)}</span>
          </div>
          {data.deliveryFeeCents > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-muted">Taxa de entrega</span>
              <span className="tabular-nums">{formatCents(data.deliveryFeeCents)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(data.totalCents)}</span>
          </div>
        </div>
      </section>

      <Link href="/" className="mt-6 inline-block text-sm text-ink-muted hover:text-brand">
        ← Voltar ao cardápio
      </Link>
    </>
  );
}
