// Janela de vida do pedido não pago (decisão #34).
//
// 15 minutos é a validade do QR Pix do checkout: passou disso, o Mercado Pago
// cancela a cobrança e o cliente precisa gerar outra. Os 10 minutos seguintes
// são folga de PROCESSAMENTO — quem pagou no minuto 14 pode ter a confirmação
// chegando no 16, e esse pedido é legítimo.
//
// Um número só, usado pela expiração e pela reconciliação, para que as duas não
// possam discordar sobre o que é um pedido vivo.
export const CHECKOUT_QR_MINUTES = 15;
export const PAYMENT_GRACE_MINUTES = 10;
export const ORDER_EXPIRY_MINUTES = CHECKOUT_QR_MINUTES + PAYMENT_GRACE_MINUTES;
