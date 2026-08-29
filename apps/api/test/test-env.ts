// Ambiente dos e2e: SEMPRE o banco de teste (decisão #11). O loadEnv pula o
// .env quando NODE_ENV=test, então estes valores são os únicos que valem.
export const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '3999',
  DATABASE_URL: 'postgresql://lanchonete:lanchonete@localhost:5432/lanchonete_test',
  STORE_TIMEZONE: 'America/Sao_Paulo',
} as const;
