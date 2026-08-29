import { describe, expect, it } from 'vitest';
import { createOrderSchema } from './create-order.schema';

const UUID = '01890a5d-ac96-774b-bcce-b302099a8057';

const validPickup = {
  customerName: 'Maria',
  customerPhone: '(11) 98765-4321',
  deliveryType: 'pickup',
  items: [{ itemId: UUID, quantity: 1 }],
};

describe('createOrderSchema', () => {
  it('aceita pedido de retirada válido e normaliza o telefone', () => {
    const parsed = createOrderSchema.safeParse(validPickup);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.customerPhone).toBe('11987654321');
  });

  it('rejeita carrinho vazio', () => {
    const parsed = createOrderSchema.safeParse({ ...validPickup, items: [] });
    expect(parsed.success).toBe(false);
  });

  it.each([0, -1, 1.5])('rejeita quantidade %s', (quantity) => {
    const parsed = createOrderSchema.safeParse({
      ...validPickup,
      items: [{ itemId: UUID, quantity }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejeita nome ausente ou vazio', () => {
    expect(createOrderSchema.safeParse({ ...validPickup, customerName: '  ' }).success).toBe(false);
    const { customerName: _omitted, ...withoutName } = validPickup;
    expect(createOrderSchema.safeParse(withoutName).success).toBe(false);
  });

  it('rejeita telefone ausente, inválido ou sem DDD — inclusive na retirada', () => {
    const { customerPhone: _omitted, ...withoutPhone } = validPickup;
    expect(createOrderSchema.safeParse(withoutPhone).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...validPickup, customerPhone: 'abc' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...validPickup, customerPhone: '98765-4321' }).success).toBe(false);
  });

  it('entrega exige endereço e região, com erros identificáveis por campo', () => {
    const parsed = createOrderSchema.safeParse({ ...validPickup, deliveryType: 'delivery' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('address');
      expect(paths).toContain('regionId');
    }
  });

  it('retirada com endereço é aceita e o endereço é ignorado', () => {
    const parsed = createOrderSchema.safeParse({
      ...validPickup,
      address: 'Rua X, 123',
      regionId: UUID,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.address).toBeUndefined();
      expect(parsed.data.regionId).toBeUndefined();
    }
  });

  it('campos de preço/desconto/total do cliente são REMOVIDOS, não lidos', () => {
    const forged = {
      ...validPickup,
      totalCents: 1,
      subtotalNetCents: 1,
      items: [{ itemId: UUID, quantity: 1, unitNetPriceCents: 1, discountPercent: 99 }],
    };
    const parsed = createOrderSchema.safeParse(forged);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('totalCents');
      expect(parsed.data).not.toHaveProperty('subtotalNetCents');
      expect(parsed.data.items[0]).not.toHaveProperty('unitNetPriceCents');
      expect(parsed.data.items[0]).not.toHaveProperty('discountPercent');
      // Resultado idêntico ao payload limpo:
      const clean = createOrderSchema.safeParse(validPickup);
      expect(clean.success).toBe(true);
      if (clean.success) expect(parsed.data).toEqual(clean.data);
    }
  });
});
