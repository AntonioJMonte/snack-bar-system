import type { StoreSchedule } from '@lanchonete/contracts';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Loja fechada (seção 5.1): o site avisa, mas quem impede o pedido é o servidor
// no momento da criação — um carrinho montado às 22h58 e finalizado às 23h02 é
// barrado lá, não aqui.
export function StoreClosedBanner({ schedules }: { schedules: StoreSchedule[] }) {
  const byDay = [...schedules].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt),
  );

  return (
    <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 p-4">
      <p className="font-semibold text-danger">A loja está fechada no momento</p>
      <p className="mt-1 text-sm text-ink-muted">
        Você pode ver o cardápio, mas não é possível finalizar pedidos agora.
      </p>
      {byDay.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {byDay.map((schedule) => (
            <div key={schedule.id} className="contents">
              <dt className="text-ink-muted">{DAY_NAMES[schedule.dayOfWeek]}</dt>
              <dd>
                {schedule.opensAt} às {schedule.closesAt}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
