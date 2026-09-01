import { describe, expect, it } from 'vitest';
import { customerStatusLabel, customerSteps, stepIndexFor } from './order-status';

describe('customerSteps', () => {
  it('na retirada não existe "a caminho" (decisão #19)', () => {
    expect(customerSteps('pickup')).not.toContain('out_for_delivery');
    expect(customerSteps('pickup')).toEqual([
      'awaiting_acceptance',
      'preparing',
      'ready',
      'completed',
    ]);
  });

  it('na entrega inclui "a caminho"', () => {
    expect(customerSteps('delivery')).toEqual([
      'awaiting_acceptance',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
    ]);
  });
});

describe('stepIndexFor', () => {
  const steps = customerSteps('delivery');

  it('pedido ainda não pago não entrou na linha do tempo', () => {
    expect(stepIndexFor('pending_payment', steps)).toBe(-1);
  });

  it('"aceito" compartilha a etapa de "recebido"', () => {
    // O cliente não precisa saber se alguém já clicou em Aceitar no painel.
    expect(stepIndexFor('accepted', steps)).toBe(stepIndexFor('awaiting_acceptance', steps));
    expect(stepIndexFor('accepted', steps)).toBe(0);
  });

  it('avança conforme a produção', () => {
    expect(stepIndexFor('preparing', steps)).toBe(1);
    expect(stepIndexFor('ready', steps)).toBe(2);
    expect(stepIndexFor('out_for_delivery', steps)).toBe(3);
    expect(stepIndexFor('completed', steps)).toBe(4);
  });

  it('status inexistente na retirada não quebra a linha do tempo', () => {
    // "a caminho" nunca ocorre na retirada; indexOf devolve -1 sem lançar.
    expect(stepIndexFor('out_for_delivery', customerSteps('pickup'))).toBe(-1);
  });
});

describe('customerStatusLabel', () => {
  it('não expõe estado operacional interno ao cliente', () => {
    expect(customerStatusLabel('awaiting_acceptance')).toBe('Recebido');
    expect(customerStatusLabel('accepted')).toBe('Recebido');
  });

  it('usa os rótulos da seção 5.1', () => {
    expect(customerStatusLabel('preparing')).toBe('Em preparo');
    expect(customerStatusLabel('ready')).toBe('Pronto');
    expect(customerStatusLabel('out_for_delivery')).toBe('A caminho');
  });
});
