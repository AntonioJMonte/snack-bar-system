'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { MAX_ALERT_SECONDS, MIN_ALERT_SECONDS } from '@/lib/device';

interface SoundControlProps {
  armed: boolean;
  onArm: () => void;
  pendingCount: number;
  alertSeconds: number;
  onAlertSecondsChange: (seconds: number) => void;
  deviceName: string;
  onDeviceNameChange: (name: string) => void;
  wakeLockActive: boolean;
  wakeLockSupported: boolean;
}

// Indicador visual permanente do estado do som (seção 8.2): "nunca deixar essa
// informação implícita". O sistema jamais finge estar alertando.
export function SoundControl({
  armed,
  onArm,
  pendingCount,
  alertSeconds,
  onAlertSecondsChange,
  deviceName,
  onDeviceNameChange,
  wakeLockActive,
  wakeLockSupported,
}: SoundControlProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-30 border-b p-4',
        armed ? 'border-success/30 bg-success/5' : 'border-danger/40 bg-danger/10',
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className={cn('font-bold', armed ? 'text-success' : 'text-danger')}>
            {armed ? '🔊 Som armado' : '🔇 Som DESLIGADO'}
          </p>
          <p className="text-sm text-ink-muted">
            {armed
              ? `Repetindo a cada ${alertSeconds}s enquanto houver pedido não aceito.`
              : 'Ninguém será avisado por som. Clique em "Ativar som" para começar o expediente.'}
          </p>
        </div>

        {!armed && (
          <Button size="lg" onClick={onArm}>
            Ativar som
          </Button>
        )}

        {pendingCount > 0 && (
          <span className="rounded-full bg-brand px-4 py-2 font-bold text-white">
            {pendingCount} {pendingCount === 1 ? 'pedido novo' : 'pedidos novos'}
          </span>
        )}
      </div>

      <details className="mx-auto mt-3 max-w-4xl text-sm">
        <summary className="cursor-pointer text-ink-muted">Configurações deste dispositivo</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-medium">Nome do dispositivo</span>
            <input
              value={deviceName}
              onChange={(event) => onDeviceNameChange(event.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2"
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Aparece no painel administrativo como painel ativo.
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block font-medium">
              Repetir alerta a cada {alertSeconds}s
            </span>
            <input
              type="range"
              min={MIN_ALERT_SECONDS}
              max={MAX_ALERT_SECONDS}
              step={1}
              value={alertSeconds}
              onChange={(event) => onAlertSecondsChange(Number(event.target.value))}
              className="w-full accent-[var(--color-brand)]"
            />
            <span className="mt-1 block text-xs text-ink-muted">
              {wakeLockSupported
                ? wakeLockActive
                  ? 'Tela mantida acesa enquanto o painel estiver aberto.'
                  : 'Tela acesa indisponível no momento.'
                : 'Este navegador não mantém a tela acesa; ajuste no sistema.'}
            </span>
          </label>
        </div>
      </details>
    </div>
  );
}
