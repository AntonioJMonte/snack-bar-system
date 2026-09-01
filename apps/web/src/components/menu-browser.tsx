'use client';

import type { Menu, MenuItem } from '@lanchonete/contracts';
import { useMemo, useState } from 'react';
import { CartBar } from './cart-bar';
import { ItemSheet } from './item-sheet';
import { cn } from '@/lib/cn';
import { formatCents, formatDiscountPercent } from '@/lib/money';
import { priceUnit } from '@lanchonete/contracts';

interface MenuBrowserProps {
  menu: Menu;
  storeOpen: boolean;
}

export function MenuBrowser({ menu, storeOpen }: MenuBrowserProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  // Busca por nome e filtro por categoria (seção 5.1).
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return menu
      .filter((category) => categoryId === null || category.id === categoryId)
      .map((category) => ({
        ...category,
        items: term
          ? category.items.filter((item) => item.name.toLowerCase().includes(term))
          : category.items,
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, query, categoryId]);

  return (
    <>
      <div className="mb-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar item pelo nome"
          aria-label="Buscar item pelo nome"
          className="w-full rounded-lg border border-border-subtle bg-surface px-4 py-3 text-base outline-none focus:border-brand"
        />

        <div className="flex flex-wrap gap-2">
          <CategoryChip active={categoryId === null} onClick={() => setCategoryId(null)}>
            Tudo
          </CategoryChip>
          {menu.map((category) => (
            <CategoryChip
              key={category.id}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </CategoryChip>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-ink-muted">Nenhum item encontrado.</p>
      ) : (
        <div className="space-y-8">
          {visible.map((category) => (
            <section key={category.id}>
              <h2 className="mb-3 text-lg font-semibold">{category.name}</h2>
              <ul className="space-y-3">
                {category.items.map((item) => (
                  <li key={item.id}>
                    <ItemCard item={item} onSelect={() => setSelected(item)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selected && <ItemSheet item={selected} onClose={() => setSelected(null)} />}

      <CartBar storeOpen={storeOpen} />
    </>
  );
}

function CategoryChip({
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
        'rounded-full border px-4 py-1.5 text-sm transition-colors',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-border-subtle bg-surface text-ink-muted hover:border-brand',
      )}
    >
      {children}
    </button>
  );
}

function ItemCard({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  // Preço exibido pela MESMA função pura do servidor (decisão #24). Adicionais
  // não entram aqui: o cartão mostra o preço base do item.
  const unit = priceUnit(item.priceCents, [], item.discountPercent);
  const hasDiscount = item.discountPercent > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={item.soldOut}
      className={cn(
        'flex w-full items-start gap-4 rounded-lg border border-border-subtle bg-surface p-4 text-left transition-colors',
        item.soldOut ? 'cursor-not-allowed opacity-60' : 'hover:border-brand',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name}</span>
          {item.soldOut && (
            <span className="rounded bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink-muted">
              Esgotado
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{item.description}</p>
        )}

        <div className="mt-2 flex items-baseline gap-2">
          {/* Item com desconto exibe o valor cheio riscado (seção 5.1). */}
          {hasDiscount && (
            <span className="text-sm text-ink-muted line-through">
              {formatCents(unit.unitFullCents)}
            </span>
          )}
          <span className={cn('font-semibold', hasDiscount && 'text-brand')}>
            {formatCents(unit.unitNetCents)}
          </span>
          {hasDiscount && (
            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-medium text-brand">
              {formatDiscountPercent(item.discountPercent)}
            </span>
          )}
        </div>
      </div>

      {item.photoUrl && (
        // Foto vem de URL cadastrada pelo gerente; sem otimização do Next para
        // não exigir allowlist de domínios nesta fase.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photoUrl}
          alt=""
          className="size-20 shrink-0 rounded-md object-cover"
          loading="lazy"
        />
      )}
    </button>
  );
}
