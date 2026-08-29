import type { Role } from '@prisma/client';

// Hierarquia da seção 5.5: admin pode tudo que gerente pode; gerente, tudo que
// atendente pode. A verificação é SEMPRE no servidor.
const RANK: Record<Role, number> = {
  attendant: 1,
  manager: 2,
  admin: 3,
};

export function roleAtLeast(userRole: Role, minimum: Role): boolean {
  return RANK[userRole] >= RANK[minimum];
}
