import { MenuBrowser } from '@/components/menu-browser';
import { StoreClosedBanner } from '@/components/store-closed-banner';
import { fetchMenu, fetchStoreSchedules, fetchStoreStatus } from '@/lib/endpoints';

// Cardápio renderizado no servidor (PDF 10.2): já chega com preços, descontos e
// itens esgotados refletidos.
export default async function MenuPage() {
  const [menu, status, schedules] = await Promise.all([
    fetchMenu(),
    fetchStoreStatus(),
    fetchStoreSchedules(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Cardápio</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Monte seu pedido, pague por Pix ou cartão e acompanhe o preparo.
        </p>
      </header>

      {!status.open && <StoreClosedBanner schedules={schedules} />}

      <MenuBrowser menu={menu} storeOpen={status.open} />
    </main>
  );
}
