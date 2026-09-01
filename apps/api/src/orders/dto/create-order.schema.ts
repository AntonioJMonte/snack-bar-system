// O schema vive em @lanchonete/contracts (decisão #24): o web monta o payload
// com o MESMO contrato que o servidor valida. Campos desconhecidos (preço,
// desconto, total…) continuam REMOVIDOS pelo Zod (modo strip) — seção 5.4.
export { createOrderSchema, type CreateOrderInput } from '@lanchonete/contracts';
