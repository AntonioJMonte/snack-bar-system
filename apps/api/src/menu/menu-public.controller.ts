import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cardápio público (seção 5.1): o site lê daqui. Já reflete preço, desconto e
// esgotado — itens/categorias inativos não aparecem; esgotado aparece sinalizado
// (o site bloqueia o carrinho; o servidor bloqueia o checkout de qualquer forma).
@Controller('menu')
export class MenuPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  catalog() {
    return this.prisma.category.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        items: {
          where: { active: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            priceCents: true,
            discountPercent: true,
            photoUrl: true,
            soldOut: true,
            addons: {
              where: { active: true },
              select: { id: true, name: true, priceCents: true },
            },
          },
        },
      },
    });
  }
}
