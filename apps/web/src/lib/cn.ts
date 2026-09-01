import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Implementação canônica do shadcn/ui (decisão #26): clsx resolve as condicionais
// e tailwind-merge desempata classes conflitantes do Tailwind, para que a última
// vença de fato (`px-2` sobrescrevendo `px-4`, por exemplo).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
