import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const MIN_ROLE_KEY = 'minRole';

// Perfil mínimo exigido pela rota (hierarquia em roles.ts).
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);
