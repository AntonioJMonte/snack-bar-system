// Telefone brasileiro com DDD, obrigatório em todos os canais e tipos de entrega
// (seção 5.3). Validação no SERVIDOR, nunca apenas no navegador — o web usa a
// mesma função só para feedback imediato no formulário.
// Normaliza para dígitos nacionais (DDD + número), sem código do país.
export function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const national =
    digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;

  if (national.length !== 10 && national.length !== 11) return null;

  // DDDs brasileiros: 11–99, sem zero no segundo dígito.
  if (!/^[1-9][1-9]$/.test(national.slice(0, 2))) return null;

  // Celular: 11 dígitos, terceiro dígito 9. Fixo: 10 dígitos, terceiro 2–5.
  if (national.length === 11 && national[2] !== '9') return null;
  if (national.length === 10 && !/^[2-5]$/.test(national[2])) return null;

  return national;
}
