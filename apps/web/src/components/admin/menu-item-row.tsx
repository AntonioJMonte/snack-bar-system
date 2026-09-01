'use client';

import { priceUnit, type AdminItem } from '@lanchonete/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  createAddon,
  setItemActive,
  setItemSoldOut,
  updateAddon,
  updateItemDiscount,
  updateItemPrice,
} from '@/lib/admin-endpoints';
import { formatCents, parseReaisToCents } from '@/lib/money';

export function MenuItemRow({ item, onChanged }: { item: AdminItem; onChanged: () => void }) {
  const [priceInput, setPriceInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unit = priceUnit(item.priceCents, [], item.discountPercent);

  function fail(message: string) {
    return () => setError(message);
  }

  const priceMutation = useMutation({
    mutationFn: (cents: number) => updateItemPrice(item.id, cents),
    onSuccess: () => {
      setPriceInput('');
      onChanged();
    },
    onError: fail('Não foi possível alterar o preço.'),
  });

  const discountMutation = useMutation({
    mutationFn: (percent: number) => updateItemDiscount(item.id, percent),
    onSuccess: () => {
      setDiscountInput('');
      onChanged();
    },
    onError: fail('Não foi possível alterar o desconto.'),
  });

  const soldOutMutation = useMutation({
    mutationFn: (soldOut: boolean) => setItemSoldOut(item.id, soldOut),
    onSuccess: onChanged,
    onError: fail('Não foi possível alterar a disponibilidade.'),
  });

  const activeMutation = useMutation({
    mutationFn: (active: boolean) => setItemActive(item.id, active),
    onSuccess: onChanged,
    onError: fail('Não foi possível ativar ou desativar o item.'),
  });

  const addonMutation = useMutation({
    mutationFn: ({ name, cents }: { name: string; cents: number }) =>
      createAddon(item.id, name, cents),
    onSuccess: () => {
      setAddonName('');
      setAddonPrice('');
      onChanged();
    },
    onError: fail('Não foi possível criar o adicional.'),
  });

  const addonToggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateAddon(id, { active }),
    onSuccess: onChanged,
    onError: fail('Não foi possível atualizar o adicional.'),
  });

  function submitPrice(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const cents = parseReaisToCents(priceInput);
    if (cents === null || cents <= 0) {
      setError('Informe o preço como 12,90 e maior que zero.');
      return;
    }
    priceMutation.mutate(cents);
  }

  function submitDiscount(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const percent = Number(discountInput);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      setError('O desconto vai de 0 a 100.');
      return;
    }
    discountMutation.mutate(percent);
  }

  function submitAddon(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const cents = parseReaisToCents(addonPrice);
    if (cents === null) {
      setError('Informe o preço do adicional como 3,50.');
      return;
    }
    addonMutation.mutate({ name: addonName, cents });
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-surface p-4',
        item.active ? 'border-border-subtle' : 'border-dashed border-ink-muted/40 opacity-70',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {item.name}
            {!item.active && <span className="ml-2 text-xs text-ink-muted">(desativado)</span>}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            {item.discountPercent > 0 && (
              <span className="text-sm text-ink-muted line-through">
                {formatCents(unit.unitFullCents)}
              </span>
            )}
            <span className={cn('font-semibold', item.discountPercent > 0 && 'text-brand')}>
              {formatCents(unit.unitNetCents)}
            </span>
            {/* Promoção ativa em destaque: é a mitigação do risco "desconto
                esquecido ligado" (seção 16). */}
            {item.discountPercent > 0 && (
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-medium text-brand">
                promoção de {item.discountPercent}% ativa
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={item.soldOut ? 'success' : 'outline'}
            size="sm"
            onClick={() => soldOutMutation.mutate(!item.soldOut)}
            disabled={soldOutMutation.isPending}
          >
            {item.soldOut ? 'Marcar disponível' : 'Marcar esgotado'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activeMutation.mutate(!item.active)}
            disabled={activeMutation.isPending}
          >
            {item.active ? 'Desativar' : 'Reativar'}
          </Button>
        </div>
      </div>

      {item.soldOut && (
        <p className="mt-2 text-sm font-medium text-danger">
          Esgotado — não pode ser adicionado ao carrinho.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <form onSubmit={submitPrice} className="flex gap-2">
          <Input
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
            placeholder="Novo preço (12,90)"
            inputMode="decimal"
            className="py-2"
            aria-label={`Novo preço de ${item.name}`}
          />
          <Button type="submit" size="sm" disabled={!priceInput || priceMutation.isPending}>
            Salvar
          </Button>
        </form>

        <form onSubmit={submitDiscount} className="flex gap-2">
          <Input
            value={discountInput}
            onChange={(event) => setDiscountInput(event.target.value)}
            placeholder="Desconto % (0 a 100)"
            inputMode="numeric"
            className="py-2"
            aria-label={`Novo desconto de ${item.name}`}
          />
          <Button type="submit" size="sm" disabled={!discountInput || discountMutation.isPending}>
            Salvar
          </Button>
        </form>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink-muted">
          Adicionais ({item.addons.filter((a) => a.active).length})
        </summary>

        <ul className="mt-2 space-y-1">
          {item.addons.map((addon) => (
            <li key={addon.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={cn(!addon.active && 'text-ink-muted line-through')}>
                {addon.name} — {formatCents(addon.priceCents)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addonToggle.mutate({ id: addon.id, active: !addon.active })}
                disabled={addonToggle.isPending}
              >
                {addon.active ? 'Desativar' : 'Reativar'}
              </Button>
            </li>
          ))}
          {item.addons.length === 0 && (
            <li className="text-sm text-ink-muted">Nenhum adicional cadastrado.</li>
          )}
        </ul>

        <form onSubmit={submitAddon} className="mt-2 flex flex-wrap gap-2">
          <Input
            value={addonName}
            onChange={(event) => setAddonName(event.target.value)}
            placeholder="Nome do adicional"
            required
            className="flex-1 py-2"
            aria-label={`Novo adicional de ${item.name}`}
          />
          <Input
            value={addonPrice}
            onChange={(event) => setAddonPrice(event.target.value)}
            placeholder="Preço (3,50)"
            inputMode="decimal"
            required
            className="w-32 py-2"
            aria-label={`Preço do novo adicional de ${item.name}`}
          />
          <Button type="submit" size="sm" disabled={addonMutation.isPending}>
            Adicionar
          </Button>
        </form>
      </details>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
