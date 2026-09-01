'use client';

import { priceUnit, type MenuItem } from '@lanchonete/contracts';
import { useState } from 'react';
import { cartLineFromMenuItem, useCart, type CartAddon } from '@/lib/cart-store';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';

// Personalização do item (seção 5.1): adicionais, quantidade e observação livre.
export function ItemSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addLine = useCart((state) => state.addLine);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const selectedAddons: CartAddon[] = item.addons.filter((addon) =>
    selectedAddonIds.includes(addon.id),
  );

  // Adicionais somam ao valor cheio ANTES do desconto (seção 5.4).
  const unit = priceUnit(
    item.priceCents,
    selectedAddons.map((a) => a.priceCents),
    item.discountPercent,
  );

  function toggleAddon(addonId: string) {
    setSelectedAddonIds((current) =>
      current.includes(addonId)
        ? current.filter((id) => id !== addonId)
        : [...current, addonId],
    );
  }

  function handleAdd() {
    addLine(cartLineFromMenuItem(item, selectedAddons, quantity, note));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{item.name}</h2>
            {item.description && (
              <p className="mt-1 text-sm text-ink-muted">{item.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md px-2 py-1 text-ink-muted hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>

        {item.addons.length > 0 && (
          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium">Adicionais</legend>
            <ul className="space-y-2">
              {item.addons.map((addon) => (
                <li key={addon.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-subtle p-3">
                    <input
                      type="checkbox"
                      checked={selectedAddonIds.includes(addon.id)}
                      onChange={() => toggleAddon(addon.id)}
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    <span className="flex-1">{addon.name}</span>
                    <span className="text-sm text-ink-muted">
                      + {formatCents(addon.priceCents)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <div className="mt-5">
          <label htmlFor="item-note" className="mb-2 block text-sm font-medium">
            Observação
          </label>
          <input
            id="item-note"
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Ex.: sem cebola"
            className="w-full rounded-lg border border-border-subtle px-4 py-3 outline-none focus:border-brand"
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium">Quantidade</span>
          <div className="flex items-center gap-3">
            <StepButton onClick={() => setQuantity((q) => Math.max(1, q - 1))} label="Diminuir">
              −
            </StepButton>
            <span className="w-8 text-center font-semibold tabular-nums">{quantity}</span>
            <StepButton onClick={() => setQuantity((q) => q + 1)} label="Aumentar">
              +
            </StepButton>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="mt-6 w-full rounded-lg bg-brand px-4 py-3.5 font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          Adicionar • {formatCents(unit.unitNetCents * quantity)}
        </button>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'size-9 rounded-full border border-border-subtle text-lg leading-none',
        'transition-colors hover:border-brand hover:text-brand',
      )}
    >
      {children}
    </button>
  );
}
