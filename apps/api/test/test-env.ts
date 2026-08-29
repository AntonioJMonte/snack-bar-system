// Ambiente dos e2e: SEMPRE o banco de teste (decisão #11). O loadEnv pula o
// .env quando NODE_ENV=test, então estes valores são os únicos que valem.
export const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '3999',
  DATABASE_URL: 'postgresql://lanchonete:lanchonete@localhost:5432/lanchonete_test',
  STORE_TIMEZONE: 'America/Sao_Paulo',
  JWT_SECRET: 'segredo-de-teste-com-16+',
  JWT_TTL: '1h',
  MP_ACCESS_TOKEN: 'TEST-token-fake',
  MP_WEBHOOK_SECRET: 'webhook-secret-de-teste',
} as const;
