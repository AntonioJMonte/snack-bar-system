-- Decisao #32: uma linha de pagamento por transacao do gateway.
-- O UNIQUE em payments.order_id fazia o upsert SOBRESCREVER a tentativa anterior:
-- cartao recusado seguido de Pix aprovado apagava o registro do cartao, e um
-- segundo pagamento aprovado no mesmo pedido nao era gravado em lugar nenhum.
-- A unicidade que importa continua sendo gateway_transaction_id (idempotencia).
DROP INDEX "payments_order_id_key";
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- Decisao #33: deduplicacao do "finalizar pedido" por Idempotency-Key.
-- UNIQUE do Postgres aceita multiplos NULL, entao pedido sem chave nao colide.
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- Decisao #33: preferencia de checkout reaproveitada em vez de recriada.
ALTER TABLE "orders" ADD COLUMN "checkout_init_point" TEXT;

-- Decisao #34: expiracao do pedido nao pago (15 min de QR + 10 de tolerancia)
-- e marca permanente do pagamento que chegou depois dela.
ALTER TABLE "orders" ADD COLUMN "expired_at" TIMESTAMPTZ(3);
ALTER TABLE "orders" ADD COLUMN "paid_after_expiry_at" TIMESTAMPTZ(3);
ALTER TYPE "OrderStatus" ADD VALUE 'expired';
