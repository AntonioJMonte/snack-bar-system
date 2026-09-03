import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  // Falha rápida ANTES de montar o app: sem variável obrigatória, não sobe.
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Descoberta do IP real do cliente. É o que faz o rate limiting contar POR
  // CLIENTE atrás de um proxy; com 0 (padrão) o Express usa o socket direto.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(
    helmet({
      // A API devolve JSON para um site que roda em OUTRO domínio. O padrão do
      // helmet (`same-origin`) é feito para quem serve páginas e recursos, não
      // para uma API pública consumida por outra origem — e passaria a bloquear
      // no dia em que a API servir uma imagem do cardápio. O CORS continua sendo
      // a barreira de verdade: só WEB_ORIGIN pode ler as respostas.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Limite de corpo EXPLÍCITO (decisão #35). Antes eram 100kb por herança do
  // express.json(), não por decisão. O maior corpo legítimo é um pedido com
  // dezenas de itens e observações — alguns kilobytes. 100kb continua sendo
  // folga de duas ordens de grandeza, agora escrito onde alguém consegue achar.
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  // Só o apps/web fala com a API pelo navegador; webhooks do gateway são
  // server-to-server e não passam por CORS.
  app.enableCors({ origin: env.WEB_ORIGIN });
  await app.listen(env.PORT);
}

void bootstrap();
