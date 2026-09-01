'use client';

import { useEffect, useRef } from 'react';
import { sendHeartbeat } from '@/lib/panel-endpoints';

const HEARTBEAT_MS = 30_000;

// Sinal de vida a cada 30 segundos (seção 8.2). O painel administrativo usa isso
// para mostrar quais dispositivos estão ativos e desde quando — e para sinalizar
// a ausência de qualquer painel, que é o cenário mais perigoso da Fase 1.
export function useHeartbeat(device: string, soundArmed: boolean, enabled: boolean): void {
  // O estado do som muda sem precisar reiniciar o intervalo; a ref evita isso.
  const soundArmedRef = useRef(soundArmed);
  soundArmedRef.current = soundArmed;

  useEffect(() => {
    if (!enabled || !device) return;

    function beat() {
      // Falha de rede aqui não pode derrubar a tela: o próximo ciclo tenta de novo.
      void sendHeartbeat(device, soundArmedRef.current).catch(() => undefined);
    }

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [device, enabled]);
}
