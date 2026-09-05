// Janela de vida do pedido não pago (decisões #34 e #37).
//
// 40 minutos é a validade do QR Pix que NÓS mandamos ao gateway em
// `date_of_expiration` (decisão #37) — não mais o padrão dele. Antes da #37 o
// checkout não enviava expiração alguma e valia o padrão do Mercado Pago (24h),
// contra um pedido que morria em 25 min: o QR sempre sobrevivia ao pedido e o
// caminho de `paidAfterExpiryAt` — desenhado para a borda "pagou no minuto 14,
// confirmou no 16" — virava rotina. Faixa que aparece sempre é faixa que
// ninguém lê.
//
// Por que 40 e não o piso de 30 documentado pelo gateway: o piso dele é contado
// a partir da criação do PAGAMENTO, que no Checkout Pro nasce depois do nosso
// pedido. Os 10 minutos de margem cobrem essa diferença de âncora.
//
// Os 10 seguintes são folga de PROCESSAMENTO — quem pagou no minuto 39 pode ter
// a confirmação chegando no 41, e esse pedido é legítimo.
//
// Um número só, usado pela expiração, pela reconciliação e pelo prazo enviado ao
// gateway, para que os três não possam discordar sobre o que é um pedido vivo.
export const CHECKOUT_QR_MINUTES = 40;
export const PAYMENT_GRACE_MINUTES = 10;
export const ORDER_EXPIRY_MINUTES = CHECKOUT_QR_MINUTES + PAYMENT_GRACE_MINUTES;
