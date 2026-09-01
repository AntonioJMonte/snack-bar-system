'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cartTotals, useCart } from '@/lib/cart-store';
import { formatCents } from '@/lib/money';

// Barra fixa com o resumo do carrinho. O carrinho vem do localStorage, que não
// existe no servidor: só renderiza depois de montar, evitando divergência de
// hidratação.
export function CartBar({ storeOpen }: { storeOpen: boolean }) {
  const lines = useCart((state) => state.lines);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || lines.length === 0) return null;

  const totals = cartTotals(lines);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-muted">
            {totals.itemCount} {totals.itemCount === 1 ? 'item' : 'itens'}
          </p>
          <p className="font-semibold">{formatCents(totals.subtotalNetCents)}</p>
        </div>

        {storeOpen ? (
          <Link
            href="/carrinho"
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Ver carrinho
          </Link>
        ) : (
          <span className="rounded-lg bg-surface-muted px-6 py-3 font-semibold text-ink-muted">
            Loja fechada
          </span>
        )}
      </div>
    </div>
  );
}
