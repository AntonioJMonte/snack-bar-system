import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'deve ser uma URL postgresql://'),
  JWT_SECRET: z.string().min(16, 'mínimo de 16 caracteres'),
  JWT_TTL: z.string().default('12h'),
  MP_ACCESS_TOKEN: z.string().min(1),
  MP_WEBHOOK_SECRET: z.string().min(1),
  STORE_TIMEZONE: z.string().refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'deve ser um fuso IANA válido (ex.: America/Sao_Paulo)' },
  ),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

// Falha rápida: a aplicação NÃO SOBE se faltar variável obrigatória.
export function loadEnv(): Env {
  // Em teste, as variáveis vêm do runner (vitest.e2e.config.ts); o .env de dev
  // não pode interferir — e2e jamais deve apontar para o banco de desenvolvimento.
  if (process.env.NODE_ENV !== 'test') {
    try {
      process.loadEnvFile();
    } catch {
      // .env ausente: segue com as variáveis do processo
    }
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }
  return parsed.data;
}
