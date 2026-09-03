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
  // Chave de idempotência do checkout (decisão #33). Vive AQUI, junto do
  // carrinho persistido, porque o cenário que ela resolve é justamente o do
  // celular com internia ruim: o cliente clica, não vê resposta, recarrega a
  // página e clica de novo. Se a chave morresse com o componente, o segundo
  // clique criaria outro pedido — exatamente o que ela existe para impedir.
  // Zera a cada mudança do carrinho: carrinho diferente é pedido diferente.
  checkoutKey: string | null;
  ensureCheckoutKey: () => string;
  addLine: (input: Omit<CartLine, 'lineId'>) => void;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      checkoutKey: null,

      ensureCheckoutKey: () => {
        const current = get().checkoutKey;
        if (current) return current;
        const key = crypto.randomUUID();
        set({ checkoutKey: key });
        return key;
      },

      addLine: (input) =>
        set((state) => {
          const signature = lineSignature(input);
          const existing = state.lines.find((l) => lineSignature(l) === signature);
          if (existing) {
            return {
              checkoutKey: null,
              lines: state.lines.map((l) =>
                l.lineId === existing.lineId
                  ? { ...l, quantity: l.quantity + input.quantity }
                  : l,
              ),
            };
          }
          return {
            checkoutKey: null,
            lines: [...state.lines, { ...input, lineId: crypto.randomUUID() }],
          };
        }),

      removeLine: (lineId) =>
        set((state) => ({
          checkoutKey: null,
          lines: state.lines.filter((l) => l.lineId !== lineId),
        })),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          checkoutKey: null,
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
        })),

      clear: () => set({ lines: [], checkoutKey: null }),
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
