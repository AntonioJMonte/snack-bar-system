// ÚNICO ponto do sistema onde um valor monetário existe como decimal: a
// fronteira com o gateway, que reporta em reais (decisão #6). Converte
// imediatamente para centavos inteiros.
export function reaisToCents(reais: number): number {
  if (!Number.isFinite(reais) || reais < 0) {
    throw new TypeError(`valor em reais inválido: ${reais}`);
  }
  return Math.round(reais * 100);
}
