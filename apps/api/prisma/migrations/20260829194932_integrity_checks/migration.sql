-- Restrições de integridade da seção 11, garantidas pelo BANCO (não por código).
-- O Prisma não expressa CHECK no DSL; por isso vivem nesta migração dedicada.

-- Desconto percentual do item do cardápio: 0 a 100.
ALTER TABLE "items"
  ADD CONSTRAINT "items_discount_percent_range"
  CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100);

-- Desconto percentual congelado no item do pedido: 0 a 100.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_discount_percent_range"
  CHECK ("discount_percent_applied" >= 0 AND "discount_percent_applied" <= 100);

-- Quantidade estritamente positiva.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0);
