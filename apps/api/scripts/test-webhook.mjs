// Dispara um webhook do Mercado Pago assinado corretamente contra a API.
//
// O que ESTE script prova: construção do manifesto, HMAC, janela de frescor da
// decisão #36 e que o fluxo avança para a consulta ao gateway.
// O que ele NÃO prova: que MP_WEBHOOK_SECRET bate com o segredo do painel do
// Mercado Pago — ele assina com o mesmo valor que a API usa para validar.
// Isso só sai com notificação real do sandbox.
//
// Uso (de qualquer diretório):
//   node apps/api/scripts/test-webhook.mjs [dataId] [requestId]
//
// Variáveis opcionais:
//   WEBHOOK_BASE  — URL base da API (padrão: o domínio ngrok reservado)

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.WEBHOOK_BASE ?? 'https://backlit-uplifted-pawing.ngrok-free.dev';
const dataId = process.argv[2] ?? '999999';
const requestId = process.argv[3] ?? `test-${Date.now()}`;

// Ancorado no próprio arquivo, não no diretório de chamada: roda de qualquer cwd.
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');

let envContent;
try {
  envContent = readFileSync(envPath, 'utf8');
} catch {
  throw new Error(`Não consegui ler ${envPath}`);
}

const secret = envContent
  .split(/\r?\n/)
  .find((l) => l.startsWith('MP_WEBHOOK_SECRET='))
  ?.slice('MP_WEBHOOK_SECRET='.length)
  .trim()
  .replace(/^["']|["']$/g, '');

if (!secret) throw new Error(`MP_WEBHOOK_SECRET não encontrado ou vazio em ${envPath}`);

const ts = Date.now();
// A MP normaliza data.id alfanumérico para minúsculas no manifesto.
const normalized = /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
const manifest = `id:${normalized};request-id:${requestId};ts:${ts};`;
const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

const url = `${BASE}/payments/webhook/mercadopago?type=payment&data.id=${encodeURIComponent(dataId)}`;

console.log(`POST ${url}`);
console.log(`manifesto: ${manifest}`);

const started = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-signature': `ts=${ts},v1=${v1}`,
    'x-request-id': requestId,
  },
  body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
});
const elapsed = Date.now() - started;

console.log(`\n${res.status} ${res.statusText}  (${elapsed}ms)`);
console.log(await res.text());