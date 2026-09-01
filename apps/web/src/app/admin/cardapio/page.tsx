'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MenuCreation } from '@/components/admin/menu-creation';
import { MenuItemRow } from '@/components/admin/menu-item-row';
import { fetchCatalog } from '@/lib/admin-endpoints';

// Gestão do cardápio (seção 5.7). Mostra o catálogo COMPLETO, incluindo itens e
// categorias inativos — sem isso não haveria como reativar o que foi desativado.
export default function AdminMenuPage() {
  const queryClient = useQueryClient();
  const { data: catalog, isLoading } = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: fetchCatalog,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
  }

  if (isLoading) return <p className="text-ink-muted">Carregando cardápio…</p>;

  const categories = catalog ?? [];

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-border-subtle bg-surface p-4 text-sm text-ink-muted">
        Alterar preço ou desconto é operação financeira e fica registrada na auditoria,
        com valor anterior e novo. Pedidos já feitos <strong>não mudam</strong> — os valores
        são congelados no momento da compra.
      </p>

      <MenuCreation categories={categories} onChanged={invalidate} />

      {categories.length === 0 ? (
        <p className="py-12 text-center text-ink-muted">
          Nenhuma categoria cadastrada ainda. Comece criando uma acima.
        </p>
      ) : (
        categories.map((category) => (
          <section key={category.id}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              {category.name}
              {!category.active && (
                <span className="rounded bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink-muted">
                  categoria inativa
                </span>
              )}
            </h2>

            {category.items.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum item nesta categoria.</p>
            ) : (
              <ul className="space-y-3">
                {category.items.map((item) => (
                  <li key={item.id}>
                    <MenuItemRow item={item} onChanged={invalidate} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
