import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MinRole } from '../auth/min-role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOr400 } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

const querySchema = z.object({
  entity: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// Consulta do registro de auditoria: exclusiva do administrador (seção 5.5).
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinRole('admin')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    const { entity, action, limit } = parseOr400(querySchema, query);
    return this.prisma.auditLog.findMany({
      where: { ...(entity ? { entity } : {}), ...(action ? { action } : {}) },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
