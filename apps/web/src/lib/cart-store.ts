'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { lineSignature, type CartLine } from './cart-math';

// Carrinho: estado LOCAL do navegador (decisão #23), persistido em localStorage
// para sobreviver a recarregamento. Guarda apenas snapshot de EXIBIÇÃO — o
// total que vale é sempre o do servidor (seção 5.4, regra 3).
// A matemática vive em cart-math.ts, pura e testável.

interface CartState {
  lines: CartLine[];
  addLine: (input: Omit<CartLine, 'lineId'>) => void;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      addLine: (input) =>
        set((state) => {
          const signature = lineSignature(input);
          const existing = state.lines.find((l) => lineSignature(l) === signature);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.lineId === existing.lineId
                  ? { ...l, quantity: l.quantity + input.quantity }
                  : l,
              ),
            };
          }
          return {
            lines: [...state.lines, { ...input, lineId: crypto.randomUUID() }],
          };
        }),

      removeLine: (lineId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
        })),

      clear: () => set({ lines: [] }),
    }),
    { name: 'lanchonete.cart' },
  ),
);

export {
  cartLineFromMenuItem,
  cartTotals,
  lineTotals,
  type CartAddon,
  type CartLine,
  type CartTotals,
  type LineTotals,
} from './cart-math';
