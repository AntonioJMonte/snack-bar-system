import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  // Falha rápida ANTES de montar o app: sem variável obrigatória, não sobe.
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  // Só o apps/web fala com a API pelo navegador; webhooks do gateway são
  // server-to-server e não passam por CORS.
  app.enableCors({ origin: env.WEB_ORIGIN });
  await app.listen(env.PORT);
}

void bootstrap();
