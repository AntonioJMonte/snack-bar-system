import type { MetadataRoute } from 'next';

// PWA instalável (PDF 10.2, decisão #28). O alvo da instalação é o PAINEL: quem
// instala é a loja, no celular do expediente. O cliente usa o site numa aba
// normal e não precisa instalar nada.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Painel da Lanchonete',
    short_name: 'Painel',
    description: 'Pedidos pagos, alerta sonoro e aceite na loja.',
    start_url: '/painel',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f5f4',
    theme_color: '#c2410c',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
