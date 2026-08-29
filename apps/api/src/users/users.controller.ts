import {
  Body,
  Controller,
  ConflictException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MinRole } from '../auth/min-role.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOr400 } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

const roleSchema = z.enum(['attendant', 'manager', 'admin']);
const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: roleSchema,
});
const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    role: roleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nada para atualizar' });

// Gestão de usuários e perfis: EXCLUSIVA do administrador (seção 5.5).
// A senha nunca aparece em resposta nem em auditoria.
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@MinRole('admin')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private static readonly SAFE_FIELDS = {
    id: true,
    name: true,
    email: true,
    role: true,
    active: true,
  } as const;

  @Get()
  list() {
    return this.prisma.user.findMany({
      select: UsersController.SAFE_FIELDS,
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const data = parseOr400(createUserSchema, body);
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException({ code: 'EMAIL_IN_USE' });

    const passwordHash = await AuthService.hashPassword(data.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, role: data.role, passwordHash },
        select: UsersController.SAFE_FIELDS,
      });
      await this.audit.record(tx, {
        userId: req.user.id,
        action: 'user.created',
        entity: 'User',
        entityId: user.id,
        newValue: { name: user.name, email: user.email, role: user.role },
      });
      return user;
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = parseOr400(updateUserSchema, body);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', userId: id });
      const updated = await tx.user.update({
        where: { id },
        data,
        select: UsersController.SAFE_FIELDS,
      });
      const fields = Object.keys(data) as (keyof typeof data)[];
      await this.audit.record(tx, {
        userId: req.user.id,
        action: 'user.updated',
        entity: 'User',
        entityId: id,
        oldValue: Object.fromEntries(fields.map((f) => [f, user[f]])),
        newValue: Object.fromEntries(fields.map((f) => [f, updated[f]])),
      });
      return updated;
    });
  }
}
