# FASE 2 - Criacao Canonica de Pedido

## Diagnostico

Antes desta fase, o projeto nao possuia nenhum backend real para criacao de pedidos. O checkout escrevia direto no banco pelo cliente, sem transacao, sem recalculo server-side e sem protecao contra falha parcial.

O objetivo desta fase foi criar a base profissional do fluxo de pedido:

- endpoint HTTP claro
- validacao do payload
- recalculo de valores no servidor
- validacao de produto e adicionais
- persistencia atomica

## Arquivos criados e alterados

- `web/lib/contracts/orders.ts`
- `web/lib/api/errors.ts`
- `web/lib/api/orders.ts`
- `web/lib/supabase-admin.ts`
- `web/app/api/orders/route.ts`
- `web/jsconfig.json`
- `web/.env.example`
- `supabase/migrations/20260410200000_canonical_order_creation.sql`

## O que foi implementado

### 1. Payload canonico de criacao

Foi adicionado ao contrato compartilhado:

- `CreateOrderRequest`
- `CreateOrderItemInput`
- `CreateOrderItemAddonSelection`
- `validateCreateOrderRequest`

Esse payload prepara o backend para aceitar:

- restaurante por `restaurant_id` ou `restaurant_slug`
- cliente
- tipo de atendimento (`delivery` ou `pickup`)
- endereco de entrega quando necessario
- itens e adicionais
- anotacoes
- cupom futuro

### 2. Endpoint REST

Foi criado o endpoint:

- `POST /api/orders`

Arquivo:

- `web/app/api/orders/route.ts`

O endpoint:

- le o JSON
- valida o payload
- chama a camada de aplicacao
- retorna `201` com o pedido canonicamente serializado
- retorna erro padronizado quando a criacao falha

### 3. Camada server-side

Foi criada a infraestrutura de backend em:

- `web/lib/api/orders.ts`
- `web/lib/api/errors.ts`
- `web/lib/supabase-admin.ts`

Essa camada:

- usa `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor
- chama a funcao SQL transacional
- mapeia erros tecnicos para erros HTTP previsiveis
- valida o contrato de resposta antes de devolver ao cliente

### 4. Persistencia transacional

A transacao foi implementada no banco via:

- `public.create_canonical_order(payload jsonb)`

Arquivo:

- `supabase/migrations/20260410200000_canonical_order_creation.sql`

A funcao:

- resolve o restaurante por `id` ou `slug`
- valida se o restaurante esta ativo
- valida cada produto
- valida disponibilidade
- valida addons permitidos por produto
- recalcula preco efetivo usando `promo_price` quando existir
- calcula subtotal da linha e subtotal total
- calcula taxa de entrega via `restaurants.settings.delivery_fee`
- aplica desconto como `0` por enquanto
- valida pedido minimo usando `restaurants.settings.min_order`
- gera `order_number`
- insere `orders`
- insere `order_items`
- retorna o pedido no contrato canonico

Como tudo acontece dentro da funcao PL/pgSQL, a persistencia do pedido e dos itens ocorre atomicamente.

### 5. Extensao do schema atual

A migration adiciona na tabela `orders` os campos necessarios para sustentar o contrato e as proximas fases:

- `order_number`
- `subtotal`
- `discount_amount`
- `estimated_time_minutes`
- `fulfillment_type`
- `payment_data`
- `updated_at`

Tambem foi adicionada:

- sequence `order_number_seq`
- check constraint para `payment_status`
- trigger para atualizar `updated_at`

## Explicacao tecnica

Foi escolhida uma arquitetura em duas camadas:

1. `POST /api/orders` no Next.js como borda HTTP
2. funcao SQL transacional no Supabase como unidade atomica de negocio e persistencia

Essa divisao traz algumas vantagens importantes:

- o frontend para de escrever direto no banco
- a API vira a unica forma de criar pedido
- o calculo financeiro sai do cliente
- a transacao fica garantida no proprio banco
- a fase 3 de idempotencia pode ser adicionada sem reescrever o fluxo inteiro

## Riscos e limites desta fase

- ainda nao existe idempotencia; isso entra na FASE 3
- ainda nao existe pagamento Pix real; nesta fase o pedido apenas nasce com `payment_status` coerente
- `discount_amount` esta fixo em `0`
- a leitura `GET /api/orders/:id` ainda nao foi implementada
- o schema legado ainda contem `status = shipped` em partes antigas; a criacao nova ja nasce com o contrato novo, mas a migracao completa do legado ainda nao foi finalizada
- o frontend ainda nao foi adaptado para consumir o endpoint novo; isso fica para a FASE 9

## Variaveis de ambiente necessarias

Arquivo de referencia:

- `web/.env.example`

Obrigatorias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no servidor.
