'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { clearToken, currentUser, hasAtLeast, type PanelSessionUser } from '@/lib/auth';

const LINKS = [
  { href: '/admin', label: 'Visão geral', minRole: 'manager' as const },
  { href: '/admin/pedidos', label: 'Pedidos', minRole: 'manager' as const },
  { href: '/admin/cardapio', label: 'Cardápio', minRole: 'manager' as const },
  { href: '/admin/configuracoes', label: 'Configurações', minRole: 'manager' as const },
  { href: '/admin/usuarios', label: 'Usuários', minRole: 'admin' as const },
  { href: '/admin/auditoria', label: 'Auditoria', minRole: 'admin' as const },
];

// Guarda de INTERFACE: esconde o que o perfil não usa e evita telas quebradas.
// Não é controle de acesso — cada rota da API verifica o perfil no servidor
// (seção 12.2), inclusive quando chamada diretamente.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PanelSessionUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const current = currentUser();
    if (!current) {
      router.replace(`/painel/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!hasAtLeast(current.role, 'manager')) {
      // Atendente não tem painel administrativo (seção 5.5).
      router.replace('/painel');
      return;
    }
    setUser(current);
    setChecked(true);
  }, [router, pathname]);

  if (!checked || !user) return null;

  const visible = LINKS.filter((link) => hasAtLeast(user.role, link.minRole));

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-bold">Administração</h1>
            <p className="text-xs text-ink-muted">
              {user.name} · {user.role === 'manager' ? 'gerente' : 'administrador'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/painel">
              <Button variant="outline" size="sm">
                Painel de produção
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearToken();
                router.replace('/painel/login');
              }}
            >
              Sair
            </Button>
          </div>
        </div>

        <nav className="mx-auto max-w-5xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2">
            {visible.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-brand text-white'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
