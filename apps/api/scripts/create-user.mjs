// Cria um usuário (admin/gerente/atendente) direto no banco — necessário para o
// primeiro acesso, já que criação de usuário pela API é exclusiva do admin.
// Uso: node scripts/create-user.mjs <email> <senha> <attendant|manager|admin> <nome...>
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import process from 'node:process';

const [email, password, role, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ');

if (!email || !password || !role || !name) {
  console.error('Uso: node scripts/create-user.mjs <email> <senha> <attendant|manager|admin> <nome>');
  process.exit(1);
}
if (!['attendant', 'manager', 'admin'].includes(role)) {
  console.error(`Perfil inválido: ${role}`);
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
const user = await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, role, name },
  update: { passwordHash, role, name, active: true },
});
console.log(`Usuário ${user.email} (${user.role}) pronto — id ${user.id}`);
await prisma.$disconnect();
