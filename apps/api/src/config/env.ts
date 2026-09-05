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
  API_PUBLIC_URL: z.url(),
  // Origem do apps/web: usada no CORS e nas back_urls do gateway (retorno do
  // navegador é só navegação — NUNCA prova de pagamento, seção 5.3).
  //
  // OBRIGATÓRIA, sem padrão. O `http://localhost:3000` que ficava aqui deixava
  // a API subir feliz em produção com a origem errada: o CORS passava a barrar
  // o site de verdade e as back_urls mandavam o cliente de volta para a máquina
  // dele. Todas as outras variáveis críticas já falham rápido; esta não podia
  // ser a exceção. Em desenvolvimento o valor vem do .env.example.
  WEB_ORIGIN: z.url(),
  // Saltos de proxy confiáveis (decisão #35). 0 = não confia em ninguém, que é
  // o certo em desenvolvimento. Atrás de Railway/Render/Cloudflare, sem isto o
  // `req.ip` vira o IP do PROXY e todos os clientes caem no mesmo balde: o rate
  // limiting deixa de proteger por cliente e passa a derrubar a loja inteira.
  // O número correto vem do provedor e só é definido no deploy.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
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
