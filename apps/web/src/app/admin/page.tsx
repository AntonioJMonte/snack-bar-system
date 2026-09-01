'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fetchStoreStatusAuth, setStoreOverride } from '@/lib/admin-endpoints';
import { minutesSince } from '@/lib/panel-labels';
import { fetchPanelSessions } from '@/lib/panel-endpoints';

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['store-status'],
    queryFn: fetchStoreStatusAuth,
    refetchInterval: 30_000,
  });

  // Painéis ativos (seção 5.7): "nenhum painel ativo" é o cenário mais perigoso
  // da Fase 1 — um pedido pago que ninguém vê.
  const { data: sessions } = useQuery({
    queryKey: ['panel-sessions'],
    queryFn: fetchPanelSessions,
    refetchInterval: 30_000,
  });

  const override = useMutation({
    mutationFn: setStoreOverride,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['store-status'] });
    },
  });

  const activeSessions = (sessions ?? []).filter((session) => session.active);
  const anyArmed = activeSessions.some((session) => session.soundArmed);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-3 font-semibold">Estado da loja</h2>

        {status ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'rounded-full px-4 py-1.5 font-bold',
                  status.open ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                )}
              >
                {status.open ? 'Aberta' : 'Fechada'}
              </span>
              {/* Qual mecanismo está vigente precisa ficar claro (seção 5.7). */}
              <span className="text-sm text-ink-muted">
                {status.source === 'manual'
                  ? 'Por decisão manual — expira ao final do dia e volta ao horário programado.'
                  : 'Pelo horário programado.'}
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant={status.open ? 'danger' : 'success'}
                onClick={() => override.mutate(!status.open)}
                disabled={override.isPending}
              >
                {override.isPending
                  ? 'Aplicando…'
                  : status.open
                    ? 'Fechar a loja agora'
                    : 'Abrir a loja agora'}
              </Button>
            </div>

            {override.isError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                Não foi possível alterar o estado da loja.
              </p>
            )}
          </>
        ) : (
          <p className="text-ink-muted">Carregando…</p>
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface p-5">
        <h2 className="mb-1 font-semibold">Painéis ativos</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Dispositivos com o painel aberto e o último sinal de vida.
        </p>

        {activeSessions.length === 0 ? (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
            <p className="font-semibold text-danger">Nenhum painel ativo</p>
            <p className="mt-1 text-sm text-ink-muted">
              Um pedido pago agora não seria visto por ninguém. Abra o painel de produção
              no computador da loja e ative o som.
            </p>
          </div>
        ) : (
          <>
            {!anyArmed && (
              <div className="mb-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
                <p className="text-sm font-medium text-danger">
                  Nenhum painel está com o som armado — os pedidos chegam em silêncio.
                </p>
              </div>
            )}
            <ul className="divide-y divide-border-subtle">
              {activeSessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{session.device}</p>
                    <p className="text-sm text-ink-muted">{session.user.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded px-2 py-1 text-sm font-medium',
                        session.soundArmed
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger',
                      )}
                    >
                      {session.soundArmed ? 'Som armado' : 'Mudo'}
                    </span>
                    <span className="text-sm text-ink-muted">
                      há {minutesSince(session.lastHeartbeatAt)} min
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
