import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lanchonete — Peça online',
  description: 'Monte seu pedido, pague por Pix ou cartão e acompanhe o preparo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-surface-muted text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
