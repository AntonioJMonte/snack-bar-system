'use client';

import { normalizeBrazilianPhone, type DeliveryRegion } from '@lanchonete/contracts';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { cartTotals, lineTotals, useCart } from '@/lib/cart-store';
import { cn } from '@/lib/cn';
import { createCheckout, createOrder } from '@/lib/endpoints';
import { invalidatesCart, userMessageFor } from '@/lib/error-messages';
import { formatCents } from '@/lib/money';

type DeliveryType = 'pickup' | 'delivery';

export function CheckoutForm({ regions }: { regions: DeliveryRegion[] }) {
  const lines = useCart((state) => state.lines);
  const setQuantity = useCart((state) => state.setQuantity);
  const removeLine = useCart((state) => state.removeLine);
  const clear = useCart((state) => state.clear);

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [address, setAddress] = useState('');
  const [regionId, setRegionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartBroken, setCartBroken] = useState(false);

  useEffect(() => setMounted(true), []);

  const totals = useMemo(() => cartTotals(lines), [lines]);
  const selectedRegion = regions.find((region) => region.id === regionId) ?? null;

  // Taxa de entrega NUNCA recebe desconto (seção 5.4) e só existe na entrega.
  const deliveryFeeCents = deliveryType === 'delivery' ? (selectedRegion?.feeCents ?? 0) : 0;
  const totalCents = totals.subtotalNetCents + deliveryFeeCents;

  // Telefone obrigatório em AMBOS os tipos de entrega (seção 5.3). Aqui é só
  // feedback imediato — a validação que vale é a do servidor.
  const phoneValid = normalizeBrazilianPhone(phone) !== null;
  const canSubmit =
    lines.length > 0 &&
    name.trim().length > 0 &&
    phoneValid &&
    (deliveryType === 'pickup' || (address.trim().length > 0 && regionId !== '')) &&
    !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCartBroken(false);
    setSubmitting(true);

    try {
      // O payload leva SOMENTE item, quantidade, adicionais e observação.
      // Nenhum preço, desconto ou total é enviado (seção 5.4, regra 3).
      const order = await createOrder({
        channel: 'web',
        customerName: name,
        customerPhone: phone,
        deliveryType,
        ...(deliveryType === 'delivery' ? { address, regionId } : {}),
        items: lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          addonIds: line.addons.map((addon) => addon.id),
          ...(line.note ? { note: line.note } : {}),
        })),
      });

      const { initPoint } = await createCheckout(order.id);

      // Pedido criado e persistido: o carrinho local cumpriu seu papel. O
      // acompanhamento passa a ser pelo id do pedido.
      clear();
      window.location.href = initPoint;
    } catch (caught) {
      setError(userMessageFor(caught));
      setCartBroken(invalidatesCart(caught));
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
        <p className="text-ink-muted">Seu carrinho está vazio.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-white"
        >
          Ver cardápio
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-lg border border-border-subtle bg-surface">
        <ul className="divide-y divide-border-subtle">
          {lines.map((line) => {
            const totals = lineTotals(line);
            const hasDiscount = line.discountPercent > 0;
            return (
              <li key={line.lineId} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{line.itemName}</p>
                    {line.addons.length > 0 && (
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {line.addons.map((addon) => addon.name).join(', ')}
                      </p>
                    )}
                    {line.note && (
                      <p className="mt-0.5 text-sm italic text-ink-muted">{line.note}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {/* Valor cheio riscado quando há desconto (seção 5.1). */}
                    {hasDiscount && (
                      <p className="text-sm text-ink-muted line-through">
                        {formatCents(totals.lineFullCents)}
                      </p>
                    )}
                    <p className={cn('font-semibold', hasDiscount && 'text-brand')}>
                      {formatCents(totals.lineNetCents)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                    aria-label={`Diminuir ${line.itemName}`}
                    className="size-8 rounded-full border border-border-subtle"
                  >
                    −
                  </button>
                  <span className="w-6 text-center tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                    aria-label={`Aumentar ${line.itemName}`}
                    className="size-8 rounded-full border border-border-subtle"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                    className="ml-auto text-sm text-danger hover:underline"
                  >
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4 rounded-lg border border-border-subtle bg-surface p-4">
        <h2 className="font-semibold">Seus dados</h2>

        <Field label="Nome" htmlFor="customer-name" required>
          <input
            id="customer-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-lg border border-border-subtle px-4 py-3 outline-none focus:border-brand"
          />
        </Field>

        <Field
          label="Telefone"
          htmlFor="customer-phone"
          required
          hint={
            phone.length > 0 && !phoneValid
              ? 'Informe um número brasileiro válido, com DDD.'
              : 'Usamos apenas para falar com você sobre este pedido.'
          }
          invalid={phone.length > 0 && !phoneValid}
        >
          <input
            id="customer-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 98765-4321"
            className={cn(
              'w-full rounded-lg border px-4 py-3 outline-none focus:border-brand',
              phone.length > 0 && !phoneValid ? 'border-danger' : 'border-border-subtle',
            )}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border border-border-subtle bg-surface p-4">
        <h2 className="font-semibold">Entrega</h2>

        <div className="grid grid-cols-2 gap-3">
          <DeliveryChoice
            active={deliveryType === 'pickup'}
            onClick={() => setDeliveryType('pickup')}
          >
            Retirar no balcão
          </DeliveryChoice>
          <DeliveryChoice
            active={deliveryType === 'delivery'}
            onClick={() => setDeliveryType('delivery')}
          >
            Receber em casa
          </DeliveryChoice>
        </div>

        {/* Endereço só na entrega; na retirada é dispensado (seção 5.3). */}
        {deliveryType === 'delivery' && (
          <>
            <Field label="Endereço" htmlFor="address" required>
              <input
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                autoComplete="street-address"
                placeholder="Rua, número, complemento"
                className="w-full rounded-lg border border-border-subtle px-4 py-3 outline-none focus:border-brand"
              />
            </Field>

            <Field label="Região" htmlFor="region" required>
              <select
                id="region"
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                required
                className="w-full rounded-lg border border-border-subtle bg-surface px-4 py-3 outline-none focus:border-brand"
              >
                <option value="">Selecione a região</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name} — {formatCents(region.feeCents)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-border-subtle bg-surface p-4">
        <Row label="Subtotal dos itens" value={formatCents(totals.subtotalFullCents)} />
        {totals.discountTotalCents > 0 && (
          <Row
            label="Total de descontos"
            value={`- ${formatCents(totals.discountTotalCents)}`}
            accent
          />
        )}
        <Row label="Subtotal com desconto" value={formatCents(totals.subtotalNetCents)} />
        {deliveryType === 'delivery' && (
          <Row label="Taxa de entrega" value={formatCents(deliveryFeeCents)} />
        )}
        <div className="border-t border-border-subtle pt-2">
          <Row label="Total" value={formatCents(totalCents)} strong />
        </div>
        <p className="pt-1 text-xs text-ink-muted">
          O valor final é confirmado pelo servidor no momento do pedido.
        </p>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-danger">{error}</p>
          {cartBroken && (
            <Link href="/" className="mt-2 inline-block text-sm underline">
              Revisar o cardápio
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-brand px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-ink-muted"
      >
        {submitting ? 'Criando pedido…' : `Ir para o pagamento • ${formatCents(totalCents)}`}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  invalid,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {hint && (
        <p className={cn('mt-1 text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>{hint}</p>
      )}
    </div>
  );
}

function DeliveryChoice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
        active ? 'border-brand bg-brand/5 text-brand' : 'border-border-subtle text-ink-muted',
      )}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(strong ? 'font-semibold' : 'text-ink-muted')}>{label}</span>
      <span
        className={cn(
          'tabular-nums',
          strong && 'text-lg font-bold',
          accent && 'text-brand',
        )}
      >
        {value}
      </span>
    </div>
  );
}
