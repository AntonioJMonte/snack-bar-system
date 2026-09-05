// Confere se MP_ACCESS_TOKEN é aceito pela Mercado Pago.
// Não imprime o token — só o que a MP responde sobre ele.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const token = readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('MP_ACCESS_TOKEN='))
  ?.slice('MP_ACCESS_TOKEN='.length)
  .trim()
  .replace(/^["']|["']$/g, '');

if (!token) throw new Error(`MP_ACCESS_TOKEN não encontrado em ${envPath}`);

console.log(`prefixo: ${token.slice(0, 5)}`);
console.log(`tamanho: ${token.length} chars`);
console.log(`formato esperado (TEST- + dígitos): ${/^TEST-\d{6,}/.test(token)}`);

const res = await fetch('https://api.mercadopago.com/users/me', {
  headers: { Authorization: `Bearer ${token}` },
});

console.log(`\nHTTP ${res.status}`);
const body = await res.json();
if (res.ok) {
  console.log(`conta: ${body.nickname} | site: ${body.site_id} | id: ${body.id}`);
} else {
  console.log(body);
}