'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '@/lib/admin-endpoints';
import { formatCents } from '@/lib/money';

// Registro de auditoria (seção 5.5): exclusivo do administrador. Existe para
// responder à pergunta que aparece quando o faturamento vem abaixo do esperado —
// "alguém deixou um desconto de 30% ligado por três dias?".
const ACTION_LABELS: Record<string, string> = {
  'item.price_changed': 'Alterou o preço',
  'item.discount_changed': 'Alterou o desconto',
  'item.sold_out_changed': 'Alterou a disponibilidade',
  'item.created': 'Cadastrou item',
  'item.updated': 'Editou item',
  'category.created': 'Cadastrou categoria',
  'category.updated': 'Editou categoria',
  'addon.created': 'Cadastrou adicional',
  'addon.updated': 'Editou adicional',
  'store.manual_override': 'Abriu ou fechou a loja',
  'store.schedule_changed': 'Alterou os horários',
  'region.created': 'Criou região',
  'region.updated': 'Editou região',
  'user.created': 'Criou usuário',
  'user.updated': 'Editou usuário',
};

export default function AdminAuditPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => fetchAuditLogs(100),
  });

  if (isLoading) return <p className="text-ink-muted">Carregando auditoria…</p>;

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border-subtle bg-surface p-4 text-sm text-ink-muted">
        Quem fez, quando, o quê, valor anterior e valor novo. As 100 alterações mais
        recentes.
      </p>

      {(logs ?? []).length === 0 ? (
        <p className="py-12 text-center text-ink-muted">Nenhuma alteração registrada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {(logs ?? []).map((log) => (
            <li key={log.id} className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-sm text-ink-muted">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>

              <p className="mt-1 text-sm text-ink-muted">
                {log.user.name} · {log.entity}
              </p>

              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <ValueBlock label="Antes" value={log.oldValue} action={log.action} />
                <ValueBlock label="Depois" value={log.newValue} action={log.action} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ValueBlock({
  label,
  value,
  action,
}: {
  label: string;
  value: unknown;
  action: string;
}) {
  if (value === null || value === undefined) {
    return (
      <div className="rounded bg-surface-muted p-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <p className="text-ink-muted">—</p>
      </div>
    );
  }

  return (
    <div className="rounded bg-surface-muted p-2">
      <span className="text-xs text-ink-muted">{label}</span>
      <p className="break-words">{describe(value, action)}</p>
    </div>
  );
}

// Valores monetários vivem em centavos no registro; exibi-los crus ("2000") faria
// a auditoria mentir para quem lê.
function describe(value: unknown, action: string): string {
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries
      .map(([key, raw]) => {
        if (key.endsWith('Cents') && typeof raw === 'number') {
          return `${key.replace(/Cents$/, '')}: ${formatCents(raw)}`;
        }
        if (key === 'discountPercent' && typeof raw === 'number') return `desconto: ${raw}%`;
        if (key === 'soldOut') return raw ? 'esgotado' : 'disponível';
        if (key === 'open') return raw ? 'aberta' : 'fechada';
        return `${key}: ${JSON.stringify(raw)}`;
      })
      .join(' · ');
  }
  if (typeof value === 'number' && action.includes('price')) return formatCents(value);
  return String(value);
}
