import { describe, expect, it } from 'vitest';
import { allowedNextStatus, canTransition } from './status-flow';

describe('status-flow — decisão #19', () => {
  it('entrega percorre a sequência completa', () => {
    expect(allowedNextStatus('delivery', 'accepted')).toBe('preparing');
    expect(allowedNextStatus('delivery', 'preparing')).toBe('ready');
    expect(allowedNextStatus('delivery', 'ready')).toBe('out_for_delivery');
    expect(allowedNextStatus('delivery', 'out_for_delivery')).toBe('completed');
  });

  it('retirada pula a_caminho: pronto vai direto a concluído', () => {
    expect(allowedNextStatus('pickup', 'ready')).toBe('completed');
    expect(allowedNextStatus('pickup', 'out_for_delivery')).toBeNull();
  });

  it('estados fora da produção não avançam por aqui', () => {
    expect(allowedNextStatus('delivery', 'pending_payment')).toBeNull();
    expect(allowedNextStatus('delivery', 'awaiting_acceptance')).toBeNull(); // aceite tem endpoint próprio
    expect(allowedNextStatus('delivery', 'completed')).toBeNull();
  });

  it('não permite pular etapas nem voltar', () => {
    expect(canTransition('delivery', 'accepted', 'ready')).toBe(false);
    expect(canTransition('delivery', 'ready', 'preparing')).toBe(false);
    expect(canTransition('pickup', 'ready', 'out_for_delivery')).toBe(false);
    expect(canTransition('pickup', 'preparing', 'ready')).toBe(true);
  });
});
