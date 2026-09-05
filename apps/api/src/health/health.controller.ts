import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// Sonda de saúde do provedor de hospedagem: é ela que decide se um deploy é
// promovido e se o container continua de pé.
//
// DELIBERADAMENTE sem consultar o banco. Uma sonda que testa a dependência
// transforma um blip do Postgres em reversão de um deploy correto — e, pior,
// em reinício em laço de um serviço que estava funcionando. O que esta rota
// responde é uma pergunta só: "o processo subiu e está atendendo HTTP?".
// A saúde do banco aparece nos erros das rotas que realmente o usam.
//
// Sem guard: a API não tem guard global de autenticação (a proteção é opt-in,
// por rota, com @UseGuards(JwtAuthGuard, RolesGuard)), então esta rota já nasce
// pública, como o POST /orders. Nada sensível é devolvido — só `{ ok: true }`.
@Controller('health')
export class HealthController {
  // A sonda bate de poucos em poucos segundos, sempre do MESMO IP. No balde
  // comum de 120/min ela competiria com o polling do painel da loja: o provedor
  // levaria 429, concluiria que o serviço morreu e reiniciaria um serviço são.
  @SkipThrottle()
  @Get()
  check() {
    return { ok: true };
  }
}
