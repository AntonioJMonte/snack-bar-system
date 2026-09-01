'use client';

import type { Order, OrderStatus } from '@lanchonete/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { OrderCard } from './order-card';
import { SoundControl } from './sound-control';
import { Button } from '@/components/ui/button';
import { useAlertSound } from '@/hooks/use-alert-sound';
import { useHeartbeat } from '@/hooks/use-heartbeat';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { ApiError } from '@/lib/api';
import { clearToken, currentUser, hasAtLeast, type PanelSessionUser } from '@/lib/auth';
import {
  DEFAULT_ALERT_SECONDS,
  readAlertSeconds,
  readDeviceName,
  storeAlertSeconds,
  storeDeviceName,
} from '@/lib/device';
import { acceptOrder, advanceOrderStatus, fetchPanelOrders } from '@/lib/panel-endpoints';

// Consulta periódica de 5–10s (PDF seção 3): suficiente para o volume de uma
// lanchonete e mantém Redis e WebSocket fora do MVP.
const POLL_MS = 6_000;

export function ProductionPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sound = useAlertSound();

  const [user, setUser] = useState<PanelSessionUser | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [alertSeconds, setAlertSeconds] = useState(DEFAULT_ALERT_SECONDS);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Guarda de sessão: sem token válido, vai para o login. É conveniência de
  // interface — a autorização real é do servidor, em toda rota (seção 12.2).
  useEffect(() => {
    const current = currentUser();
    if (!current) {
      router.replace('/painel/login?next=/painel');
      return;
    }
    setUser(current);
    setDeviceName(readDeviceName());
    setAlertSeconds(readAlertSeconds());
    setCheckedAuth(true);
  }, [router]);

  const { data: orders, error } = useQuery({
    queryKey: ['panel-orders'],
    queryFn: fetchPanelOrders,
    refetchInterval: POLL_MS,
    // Queda e retorno da internet: o painel recarrega a lista sozinho (plano 14.3).
    refetchOnWindowFocus: true,
    enabled: checkedAuth,
  });

  // Token expirado ou revogado durante o expediente: volta ao login em vez de
  // ficar piscando erro a cada ciclo de polling.
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      clearToken();
      router.replace('/painel/login?next=/painel');
    }
  }, [error, router]);

  useHeartbeat(deviceName, sound.armed, checkedAuth);
  const wakeLock = useWakeLock(checkedAuth);

  // Pedido não aceito ocupa o TOPO da lista (seção 8.2); o resto segue ordem de
  // chegada, que é como a cozinha produz.
  const sorted = useMemo(() => {
    const list = orders ?? [];
    return [...list].sort((a, b) => {
      const aPending = a.status === 'awaiting_acceptance' ? 0 : 1;
      const bPending = b.status === 'awaiting_acceptance' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [orders]);

  const pendingCount = sorted.filter((o) => o.status === 'awaiting_acceptance').length;

  // Repetição até o aceite (seção 8.2): "um único bipe pode ser perdido no
  // barulho de uma cozinha". Depende de pendingCount para que um pedido NOVO
  // toque imediatamente, sem esperar o próximo ciclo.
  useEffect(() => {
    if (!sound.armed || pendingCount === 0) return;
    sound.play();
    const timer = setInterval(() => sound.play(), alertSeconds * 1000);
    return () => clearInterval(timer);
  }, [sound, pendingCount, alertSeconds]);

  const acceptMutation = useMutation({
    mutationFn: acceptOrder,
    onSettled: () => {
      setBusyOrderId(null);
      void queryClient.invalidateQueries({ queryKey: ['panel-orders'] });
    },
    onError: () => setActionError('Não foi possível aceitar o pedido. Tente de novo.'),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      advanceOrderStatus(orderId, status as 'preparing' | 'ready' | 'out_for_delivery' | 'completed'),
    onSettled: () => {
      setBusyOrderId(null);
      void queryClient.invalidateQueries({ queryKey: ['panel-orders'] });
    },
    onError: () => setActionError('Não foi possível avançar o status. Tente de novo.'),
  });

  function handleAccept(order: Order) {
    setActionError(null);
    setBusyOrderId(order.id);
    acceptMutation.mutate(order.id);
  }

  function handleAdvance(order: Order, status: OrderStatus) {
    setActionError(null);
    setBusyOrderId(order.id);
    advanceMutation.mutate({ orderId: order.id, status });
  }

  function handleDeviceNameChange(name: string) {
    setDeviceName(name);
    storeDeviceName(name);
  }

  function handleAlertSecondsChange(seconds: number) {
    setAlertSeconds(storeAlertSeconds(seconds));
  }

  function handleLogout() {
    clearToken();
    router.replace('/painel/login');
  }

  if (!checkedAuth || !user) return null;

  return (
    <div className="min-h-dvh">
      <SoundControl
        armed={sound.armed}
        onArm={() => void sound.arm()}
        pendingCount={pendingCount}
        alertSeconds={alertSeconds}
        onAlertSecondsChange={handleAlertSecondsChange}
        deviceName={deviceName}
        onDeviceNameChange={handleDeviceNameChange}
        wakeLockActive={wakeLock.active}
        wakeLockSupported={wakeLock.supported}
      />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-sm text-ink-muted">
              {user.name} · {user.role === 'attendant' ? 'atendente' : user.role === 'manager' ? 'gerente' : 'administrador'}
            </p>
          </div>
          <div className="flex gap-2">
            {hasAtLeast(user.role, 'manager') && (
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  Administração
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </header>

        {actionError && (
          <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-danger">
            {actionError}
          </p>
        )}

        {error && !(error instanceof ApiError && error.status === 401) && (
          <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-danger">
            Falha ao carregar os pedidos. Tentando de novo automaticamente.
          </p>
        )}

        {sorted.length === 0 ? (
          <p className="py-16 text-center text-ink-muted">
            Nenhum pedido ativo no momento. Esta tela se atualiza sozinha.
          </p>
        ) : (
          <div className="space-y-4">
            {sorted.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                busy={busyOrderId === order.id}
                onAccept={() => handleAccept(order)}
                onAdvance={(status) => handleAdvance(order, status)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
