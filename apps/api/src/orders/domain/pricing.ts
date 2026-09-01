// Regra ÚNICA de arredondamento (decisão #7): half-up, POR UNIDADE, inteira.
// A implementação vive em @lanchonete/contracts (decisão #24) para que o site
// exiba exatamente os números que o servidor grava. Este arquivo preserva o
// caminho de import histórico da API.
export { priceUnit, unitDiscountCents, type PricedUnit } from '@lanchonete/contracts';
