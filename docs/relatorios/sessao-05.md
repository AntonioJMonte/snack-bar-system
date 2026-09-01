# Sessão 05 — Painel de produção e painel administrativo

**Data:** 2026-09-01
**Frente:** fechar as telas da Fase 1A — o painel da loja (seção 8, "o coração da
Fase 1") e a administração (seção 5.7).

## Decisões tomadas

| # | Tema | Resultado |
|---|---|---|
| 25 | Token do painel | `localStorage` + header `Authorization: Bearer` |
| 26 | Biblioteca de componentes | Adotar shadcn/ui (clsx, tailwind-merge, cva, lucide-react) |
| 27 | Intervalo do alerta | Por dispositivo em `localStorage`, 15–20s, ajustável na tela |
| 28 | Alerta no celular | PWA instalável agora; Web Push numa etapa própria |

A decisão #28 resolveu uma tensão interna do PDF: a seção 5.6 marca "notificação
com som na tela apagada" como 1A, mas a 8.5 manda verificar o comportamento no
aparelho real da loja antes de contar com esse canal. O elo da frase-teste — "a
loja é alertada, vê o pedido na tela e o aceita" — é cumprido pelo painel com som.

## Painel de produção (`/painel`)

Cada exigência da seção 8.2 tem código correspondente:

- **Som armado por clique.** Botão explícito "Ativar som"; sem ele o painel abriria
  mudo em silêncio. O som é sintetizado com a Web Audio API (três bipes de onda
  quadrada em 880 Hz) em vez de um arquivo: não há asset para faltar no deploy e o
  volume não depende da normalização de um mp3. Ao armar, toca uma vez — o operador
  confirma com o ouvido, não com um rótulo na tela.
- **Indicador visual permanente.** Barra fixa no topo, verde com "Som armado" ou
  vermelha com "Som DESLIGADO". O sistema nunca finge estar alertando.
- **Repetição até o aceite.** Enquanto houver pedido não aceito, o som repete no
  intervalo configurado. Um pedido novo dispara o som imediatamente.
- **Destaque visual.** Pedido não aceito vai para o topo, com borda de 4px e tipografia
  ampliada — legível a alguns metros.
- **Sinal de vida.** Heartbeat a cada 30s com nome do dispositivo e estado do som.
- **Tela sempre acesa.** Wake Lock API, readquirido quando a aba volta a ficar visível.

Além disso: consulta periódica de 6s, telefone do cliente clicável (`tel:`),
observação do item em destaque colorido (é o que mais gera erro de produção),
aceite explícito e avanço de status. Token expirado durante o expediente devolve
ao login em vez de piscar erro a cada ciclo.

O PWA (`manifest.webmanifest` + ícone SVG) aponta para `/painel`: quem instala é a
loja, no celular do expediente.

## Painel administrativo (`/admin`)

Guarda de interface por perfil, com a navegação filtrada — atendente é mandado de
volta ao painel de produção. **Isso é conveniência, não controle de acesso:** cada
rota da API verifica o perfil no servidor, e os testes e2e confirmam a rejeição
quando um atendente chama direto.

- **Visão geral:** estado da loja com o mecanismo vigente explícito (manual expira ao
  final do dia) e botão de abrir/fechar; painéis ativos com dois alertas próprios —
  "nenhum painel ativo" e "nenhum painel com som armado", que são exatamente os
  cenários do risco nº 1 do projeto.
- **Pedidos:** histórico completo com filtro por status, valores congelados e situação
  do pagamento.
- **Cardápio:** cadastro de categorias, itens e adicionais; alteração de preço e
  desconto; marcar esgotado; desativar e reativar. Promoção ativa aparece destacada —
  é a mitigação do risco "desconto esquecido ligado".
- **Configurações:** horário semanal (o PUT substitui a semana inteira, então a tela
  carrega o estado atual e envia o estado final completo) e regiões de entrega.
- **Usuários** e **Auditoria:** exclusivos do administrador. A auditoria formata
  centavos como reais — exibir "2000" cru faria o registro mentir para quem lê.

## Mudanças na API

Duas telas do PDF 5.7 não tinham endpoint:

- **`GET /menu/catalog`** (gerente+): catálogo completo, incluindo itens, categorias e
  adicionais inativos. Sem ele não havia como reativar pela interface o que foi
  desativado — o `GET /menu` público esconde tudo que está inativo.
- **`GET /orders`** (gerente+): o registro definitivo da operação, com filtro por status.
  O `GET /panel/orders` lista apenas os ativos, então pedidos concluídos sumiam.

O perfil escolhido para ambos foi gerente+, alinhado a "consultar relatórios" na
matriz da seção 5.5. **Fica registrado para confirmação**, junto da pendência
equivalente sobre "painéis ativos".

Também movido para o contrato: **`allowedNextStatus` / `canTransition`**. Agora a
mesma função decide o botão que o painel mostra e a transição que o servidor aceita
— o painel não consegue oferecer um passo que a API vá rejeitar.

## Testes

| Suíte | Antes | Agora |
|---|---|---|
| API — unitários | 70 | 70 |
| API — e2e | 45 | **55** |
| Web — unitários | 23 | **39** |
| **Total** | 138 | **164** |

Os 10 e2e novos cobrem os dois endpoints: exigência de autenticação, rejeição de
atendente, presença de itens inativos no catálogo de gestão, a diferença entre
histórico e painel de produção, filtro por status e rejeição de status inválido.

Os 16 testes de web novos cobrem `parseReaisToCents` (o caminho inverso do dinheiro:
`Number("8.29") * 100` dá 828,9999… em JavaScript, e a conversão é feita por
aritmética inteira sobre os dígitos), formatação de telefone, minutos decorridos e a
concordância entre o botão de avanço e a transição aceita pelo servidor.

A suíte e2e completa passou desta vez sem o timeout de hook da sessão anterior — o
`node_modules` reinstalado e fixado localmente resolveu a lentidão.

## Pendências abertas

- **Web Push** (decisão #28): fazer depois de verificar o aparelho real da loja,
  especialmente em iOS.
- **Confirmar o perfil** de `GET /orders`, `GET /menu/catalog` e "painéis ativos" —
  o PDF 5.7 não fixa o perfil dessas três telas.
- **Projeto dentro do OneDrive** continua sendo risco de build (ver sessão 04).
- Herdadas: assinatura do webhook contra o sandbox real do Mercado Pago; constantes
  da reconciliação; 3 vulnerabilidades high no CLI do Prisma (dev-only).
- Não há teste automatizado de interface (o alerta sonoro, o Wake Lock e o PWA
  dependem de verificação manual no PC e no celular reais — plano de testes 14.3).
