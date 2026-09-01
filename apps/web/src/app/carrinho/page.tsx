import Link from 'next/link';
import { CheckoutForm } from '@/components/checkout-form';
import { fetchDeliveryRegions } from '@/lib/endpoints';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  // Só regiões ativas são oferecidas; o servidor rejeita região inativa de
  // qualquer forma (REGION_INACTIVE).
  const regions = (await fetchDeliveryRegions()).filter((region) => region.active);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-ink-muted hover:text-brand">
        ← Voltar ao cardápio
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold tracking-tight">Seu pedido</h1>
      <CheckoutForm regions={regions} />
    </main>
  );
}
