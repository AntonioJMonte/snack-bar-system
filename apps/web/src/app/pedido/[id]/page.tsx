import { notFound } from 'next/navigation';
import { OrderTracking } from '@/components/order-tracking';
import { ApiError } from '@/lib/api';
import { fetchOrderTracking } from '@/lib/endpoints';

export const dynamic = 'force-dynamic';

// Acompanhamento do pedido: acessível só por quem tem o UUID (não enumerável,
// decisão #9). Nenhum dado operacional da loja é exposto aqui.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const tracking = await fetchOrderTracking(id);
    return (
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <OrderTracking orderId={id} initialData={tracking} />
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
