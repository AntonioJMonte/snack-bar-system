import { allowedNextStatus } from '@lanchonete/contracts';
import { describe, expect, it } from 'vitest';
import { advanceActionLabel, formatPhone, minutesSince, panelStatusLabel } from './panel-labels';

describe('formatPhone', () => {
  it('formata celular de 11 dígitos', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formata fixo de 10 dígitos', () => {
    expect(formatPhone('1132654321')).toBe('(11) 3265-4321');
  });

  it('devolve o valor cru quando o tamanho é inesperado', () => {
    // Nunca deformar um telefone que a loja precisa discar.
    expect(formatPhone('123')).toBe('123');
  });
});

describe('minutesSince', () => {
  it('conta os minutos decorridos', () => {
    const now = Date.parse('2026-09-01T12:30:00Z');
    expect(minutesSince('2026-09-01T12:00:00Z', now)).toBe(30);
    expect(minutesSince('2026-09-01T12:29:30Z', now)).toBe(0);
  });

  it('nunca devolve negativo com relógio adiantado', () => {
    const now = Date.parse('2026-09-01T12:00:00Z');
    expect(minutesSince('2026-09-01T12:05:00Z', now)).toBe(0);
  });
});

describe('botão de avanço', () => {
  it('oferece exatamente o passo que o servidor aceita', () => {
    // A mesma função decide o botão e a transição válida (decisão #24): o painel
    // nunca oferece um passo que a API vai rejeitar.
    const next = allowedNextStatus('delivery', 'ready');
    expect(next).toBe('out_for_delivery');
    expect(advanceActionLabel(next!)).toBe('Saiu para entrega');
  });

  it('na retirada, "pronto" leva direto a concluir', () => {
    const next = allowedNextStatus('pickup', 'ready');
    expect(next).toBe('completed');
    expect(advanceActionLabel(next!)).toBe('Concluir pedido');
  });

  it('pedido aguardando aceite não avança por este caminho', () => {
    // O aceite tem endpoint próprio, que registra quem viu e quando (seção 8.3).
    expect(allowedNextStatus('delivery', 'awaiting_acceptance')).toBeNull();
  });

  it('pedido concluído não avança mais', () => {
    expect(allowedNextStatus('delivery', 'completed')).toBeNull();
  });
});

describe('panelStatusLabel', () => {
  it('mostra o estado operacional real, ao contrário da tela do cliente', () => {
    expect(panelStatusLabel('awaiting_acceptance')).toBe('Aguardando aceite');
    expect(panelStatusLabel('accepted')).toBe('Aceito');
  });
});
