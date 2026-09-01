'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import {
  createRegion,
  fetchRegions,
  fetchSchedules,
  replaceSchedules,
  updateRegion,
  type ScheduleInput,
} from '@/lib/admin-endpoints';
import { formatCents, parseReaisToCents } from '@/lib/money';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <SchedulesSection />
      <RegionsSection />
    </div>
  );
}

interface DayRow {
  enabled: boolean;
  opensAt: string;
  closesAt: string;
}

function SchedulesSection() {
  const queryClient = useQueryClient();
  const { data: schedules } = useQuery({ queryKey: ['schedules'], queryFn: fetchSchedules });
  const [rows, setRows] = useState<DayRow[]>(
    DAYS.map(() => ({ enabled: false, opensAt: '18:00', closesAt: '23:00' })),
  );
  const [error, setError] = useState<string | null>(null);

  // O PUT substitui a semana inteira: a tela carrega o estado atual e envia o
  // estado final completo, nunca um delta.
  useEffect(() => {
    if (!schedules) return;
    setRows(
      DAYS.map((_, day) => {
        const found = schedules.find((s) => s.dayOfWeek === day);
        return found
          ? { enabled: true, opensAt: found.opensAt, closesAt: found.closesAt }
          : { enabled: false, opensAt: '18:00', closesAt: '23:00' };
      }),
    );
  }, [schedules]);

  const mutation = useMutation({
    mutationFn: replaceSchedules,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['schedules'] }),
    onError: () => setError('Não foi possível salvar os horários.'),
  });

  function handleSave() {
    setError(null);
    const payload: ScheduleInput[] = [];
    for (const [day, row] of rows.entries()) {
      if (!row.enabled) continue;
      if (row.opensAt >= row.closesAt) {
        setError(`${DAYS[day]}: o horário de abertura precisa ser antes do de fechamento.`);
        return;
      }
      payload.push({ dayOfWeek: day, opensAt: row.opensAt, closesAt: row.closesAt });
    }
    mutation.mutate(payload);
  }

  function updateRow(day: number, patch: Partial<DayRow>) {
    setRows((current) => current.map((row, index) => (index === day ? { ...row, ...patch } : row)));
  }

  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-5">
      <h2 className="mb-1 font-semibold">Horário de funcionamento</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Fora destes horários a loja fica fechada automaticamente. Uma abertura ou
        fechamento manual sobrepõe o programado e expira ao final do dia.
      </p>

      <ul className="space-y-2">
        {rows.map((row, day) => (
          <li key={DAYS[day]} className="flex flex-wrap items-center gap-3">
            <label className="flex w-32 items-center gap-2">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) => updateRow(day, { enabled: event.target.checked })}
                className="size-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm">{DAYS[day]}</span>
            </label>
            <input
              type="time"
              value={row.opensAt}
              disabled={!row.enabled}
              onChange={(event) => updateRow(day, { opensAt: event.target.value })}
              aria-label={`Abertura ${DAYS[day]}`}
              className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-50"
            />
            <span className="text-ink-muted">às</span>
            <input
              type="time"
              value={row.closesAt}
              disabled={!row.enabled}
              onChange={(event) => updateRow(day, { closesAt: event.target.value })}
              aria-label={`Fechamento ${DAYS[day]}`}
              className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-50"
            />
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <Button onClick={handleSave} disabled={mutation.isPending} className="mt-4">
        {mutation.isPending ? 'Salvando…' : 'Salvar horários'}
      </Button>
    </section>
  );
}

function RegionsSection() {
  const queryClient = useQueryClient();
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: fetchRegions });
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['regions'] });
  }

  const create = useMutation({
    mutationFn: ({ name, feeCents }: { name: string; feeCents: number }) =>
      createRegion(name, feeCents),
    onSuccess: () => {
      setName('');
      setFee('');
      invalidate();
    },
    onError: () => setError('Não foi possível criar a região.'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateRegion(id, { active }),
    onSuccess: invalidate,
    onError: () => setError('Não foi possível atualizar a região.'),
  });

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const feeCents = parseReaisToCents(fee);
    if (feeCents === null) {
      setError('Informe a taxa como 7,50.');
      return;
    }
    create.mutate({ name, feeCents });
  }

  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-5">
      <h2 className="mb-1 font-semibold">Regiões de entrega</h2>
      <p className="mb-4 text-sm text-ink-muted">
        A taxa da região entra no total do pedido e <strong>nunca recebe desconto</strong>.
      </p>

      <ul className="mb-4 divide-y divide-border-subtle">
        {(regions ?? []).map((region) => (
          <li key={region.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{region.name}</p>
              <p className="text-sm text-ink-muted">{formatCents(region.feeCents)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggle.mutate({ id: region.id, active: !region.active })}
              disabled={toggle.isPending}
            >
              {region.active ? 'Desativar' : 'Reativar'}
            </Button>
          </li>
        ))}
        {(regions ?? []).length === 0 && (
          <li className="py-3 text-sm text-ink-muted">Nenhuma região cadastrada.</li>
        )}
      </ul>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome da região"
          required
          className="flex-1 py-2"
          aria-label="Nome da região"
        />
        <Input
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          placeholder="Taxa (7,50)"
          inputMode="decimal"
          required
          className="w-40 py-2"
          aria-label="Taxa de entrega"
        />
        <Button type="submit" disabled={create.isPending}>
          Adicionar
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
