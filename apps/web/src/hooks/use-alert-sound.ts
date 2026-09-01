'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Som do alerta (seção 8.2). Duas exigências do PDF governam este arquivo:
//
// 1. "Um botão explícito 'Ativar som' precisa ser clicado uma vez" — navegadores
//    bloqueiam áudio sem gesto do usuário. Sem isso o painel abre mudo em
//    silêncio e ninguém percebe.
// 2. "Arquivo curto e alto, testado em ambiente ruidoso" — o som é sintetizado
//    com a Web Audio API em vez de um arquivo: não há asset para faltar no
//    deploy, e o volume não depende da normalização de um mp3.

const BEEP_COUNT = 3;
const BEEP_MS = 180;
const GAP_MS = 120;
const FREQUENCY_HZ = 880;

export interface AlertSound {
  armed: boolean;
  /** Precisa ser chamado de dentro de um clique do usuário. */
  arm: () => Promise<void>;
  disarm: () => void;
  play: () => void;
}

export function useAlertSound(): AlertSound {
  const contextRef = useRef<AudioContext | null>(null);
  const [armed, setArmed] = useState(false);

  const playOn = useCallback((context: AudioContext) => {
    const now = context.currentTime;
    for (let index = 0; index < BEEP_COUNT; index += 1) {
      const start = now + index * ((BEEP_MS + GAP_MS) / 1000);
      const end = start + BEEP_MS / 1000;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square'; // corta melhor o ruído de uma cozinha que a senoide
      oscillator.frequency.setValueAtTime(FREQUENCY_HZ, start);

      // Rampas curtas evitam o "clique" de ligar/desligar abruptamente.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.6, start + 0.01);
      gain.gain.setValueAtTime(0.6, end - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
    }
  }, []);

  const arm = useCallback(async () => {
    try {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      // O gesto do usuário é o que autoriza; resume() precisa acontecer aqui.
      if (context.state === 'suspended') await context.resume();
      setArmed(true);
      // Toca uma vez ao armar: o operador confirma com o ouvido que funciona,
      // em vez de confiar num rótulo na tela.
      playOn(context);
    } catch {
      setArmed(false);
    }
  }, [playOn]);

  const disarm = useCallback(() => {
    setArmed(false);
  }, []);

  const play = useCallback(() => {
    const context = contextRef.current;
    if (!armed || !context || context.state !== 'running') return;
    playOn(context);
  }, [armed, playOn]);

  useEffect(() => {
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  return { armed, arm, disarm, play };
}
