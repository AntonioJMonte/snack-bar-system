// Popula o banco de DESENVOLVIMENTO com um cardápio de exemplo, horário aberto
// todos os dias e duas regiões de entrega — para conseguir exercitar o site sem
// cadastrar tudo à mão. Nunca rodar contra produção.
// Uso: node scripts/seed-dev.mjs
import { PrismaClient } from '@prisma/client';
import process from 'node:process';

const prisma = new PrismaClient();

const url = process.env.DATABASE_URL ?? '';
if (!url.includes('lanchonete_dev')) {
  console.error('Recusa de segurança: este seed só roda contra lanchonete_dev.');
  process.exit(1);
}

// Loja aberta das 00:00 às 23:59 todos os dias, para o teste não esbarrar em
// horário. Ajuste depois pela tela de configurações.
await prisma.storeSchedule.deleteMany();
await prisma.storeSchedule.createMany({
  data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '00:00',
    closesAt: '23:59',
  })),
});

const regions = [
  { name: 'Centro', feeCents: 500 },
  { name: 'Zona Norte', feeCents: 850 },
];
for (const region of regions) {
  const existing = await prisma.deliveryRegion.findFirst({ where: { name: region.name } });
  if (!existing) await prisma.deliveryRegion.create({ data: region });
}

const catalog = [
  {
    name: 'Lanches',
    displayOrder: 1,
    items: [
      {
        name: 'X-Burger',
        description: 'Pão, hambúrguer 150g, queijo, alface e tomate.',
        priceCents: 2490,
        discountPercent: 0,
        addons: [
          { name: 'Bacon', priceCents: 500 },
          { name: 'Cheddar extra', priceCents: 350 },
        ],
      },
      {
        // Um item com desconto para conferir o valor cheio riscado no site.
        name: 'X-Salada',
        description: 'Pão, hambúrguer 150g, queijo, salada completa.',
        priceCents: 2690,
        discountPercent: 15,
        addons: [{ name: 'Ovo', priceCents: 300 }],
      },
      {
        // Um item esgotado para conferir o bloqueio no carrinho.
        name: 'X-Tudo',
        description: 'Tudo o que cabe no pão.',
        priceCents: 3490,
        discountPercent: 0,
        soldOut: true,
        addons: [],
      },
    ],
  },
  {
    name: 'Bebidas',
    displayOrder: 2,
    items: [
      { name: 'Refrigerante lata', priceCents: 700, discountPercent: 0, addons: [] },
      { name: 'Suco natural 500ml', priceCents: 1200, discountPercent: 10, addons: [] },
    ],
  },
];

for (const category of catalog) {
  const existing = await prisma.category.findFirst({ where: { name: category.name } });
  if (existing) {
    console.log(`Categoria "${category.name}" já existe — pulando.`);
    continue;
  }
  const created = await prisma.category.create({
    data: { name: category.name, displayOrder: category.displayOrder },
  });
  for (const item of category.items) {
    await prisma.item.create({
      data: {
        name: item.name,
        description: item.description ?? null,
        priceCents: item.priceCents,
        discountPercent: item.discountPercent,
        soldOut: item.soldOut ?? false,
        categoryId: created.id,
        addons: { create: item.addons },
      },
    });
  }
  console.log(`Categoria "${category.name}" criada com ${category.items.length} itens.`);
}

console.log('\nSeed de desenvolvimento pronto.');
await prisma.$disconnect();
