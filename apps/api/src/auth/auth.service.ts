import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Mensagem única para usuário inexistente/inativo/senha errada — não vazar
    // qual credencial falhou.
    const invalid = new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    if (!user || !user.active) throw invalid;
    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw invalid;

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      name: user.name,
    });
    return { accessToken };
  }

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }
}
