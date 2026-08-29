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
