import { execSync } from 'node:child_process';
import { TEST_ENV } from './test-env';

// Banco de teste recriado por execução (decisão #11): derruba os objetos e
// reaplica todas as migrações — valida as migrações de graça a cada suíte.
export default function globalSetup() {
  if (!TEST_ENV.DATABASE_URL.includes('lanchonete_test')) {
    throw new Error('Recusa de segurança: e2e só roda contra lanchonete_test.');
  }
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: TEST_ENV.DATABASE_URL,
      // Consentimento restrito ao banco DESCARTÁVEL de teste, recriado a cada
      // execução por decisão registrada (docs/decisoes/011-banco-testes-e2e.md).
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
        'Opção A para todas as decisões (decisão #11: banco de teste recriado por execução)',
    },
  });
}
