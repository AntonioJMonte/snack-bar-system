// Dinheiro trafega e é calculado SEMPRE em centavos inteiros (decisão #6).
// Este arquivo é o único ponto do site onde centavos viram reais, e só para
// EXIBIÇÃO — nenhum valor daqui volta para a API.

export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  // Divisão inteira: `abs` é sempre um inteiro seguro, então não há float.
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${negative ? '-' : ''}R$ ${reais.toLocaleString('pt-BR')},${String(centavos).padStart(2, '0')}`;
}

// Percentual de desconto para exibição ("-15%"). Zero não deve ser exibido.
export function formatDiscountPercent(percent: number): string {
  return `-${percent}%`;
}

// Caminho inverso: o gerente digita "12,90" e o servidor precisa receber 1290.
// A conversão é feita por aritmética INTEIRA sobre os dígitos — `Number("12.90")
// * 100` daria 1289.9999999999998 em alguns casos, e erro de arredondamento em
// dinheiro aparece na conferência contra o gateway (seção 11).
export function parseReaisToCents(input: string): number | null {
  const match = input.trim().replace(',', '.').match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const centavos = (match[2] ?? '0').padEnd(2, '0');
  return Number(match[1]) * 100 + Number(centavos);
}
