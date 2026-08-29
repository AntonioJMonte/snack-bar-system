// Conversão UTC → fuso da loja (decisão #13). Único lugar que responde
// "que dia/hora é agora PARA A LOJA".

export interface StoreLocalParts {
  dayOfWeek: number; // 0=domingo … 6=sábado, no fuso da loja
  time: string; // "HH:mm" no fuso da loja
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Diferença (ms) entre o horário local do fuso e o UTC no instante dado.
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(
    parts.filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Instante UTC da PRÓXIMA meia-noite no fuso da loja: é quando a sobreposição
// manual expira ("ao final do dia", seção 5.5).
export function endOfStoreDay(now: Date, timeZone: string): Date {
  const offset = tzOffsetMs(now, timeZone);
  const local = new Date(now.getTime() + offset);
  const nextMidnightLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  );
  let result = new Date(nextMidnightLocal - offset);
  // Refina se o offset mudar na virada (horário de verão, se voltar a existir).
  const offsetAtResult = tzOffsetMs(result, timeZone);
  if (offsetAtResult !== offset) result = new Date(nextMidnightLocal - offsetAtResult);
  return result;
}

export function storeLocalParts(date: Date, timeZone: string): StoreLocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    dayOfWeek: WEEKDAYS[get('weekday')],
    time: `${get('hour')}:${get('minute')}`,
  };
}
