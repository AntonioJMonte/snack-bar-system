'use client';

import { useEffect, useState } from 'react';

// Tela sempre acesa (seção 8.2): impede que o PC ou o celular suspendam com o
// painel aberto. O navegador libera o lock sozinho quando a aba perde a
// visibilidade, então é preciso readquirir ao voltar.
export function useWakeLock(enabled: boolean): { supported: boolean; active: boolean } {
  const [active, setActive] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!enabled || !supported) {
      setActive(false);
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        setActive(true);
        sentinel.addEventListener('release', () => setActive(false));
      } catch {
        // Bateria baixa ou política do navegador: seguimos sem o lock. O alerta
        // sonoro continua sendo a garantia principal.
        setActive(false);
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void sentinel?.release().catch(() => undefined);
      setActive(false);
    };
  }, [enabled, supported]);

  return { supported, active };
}
