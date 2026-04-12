# Backend Project Memory

## 1. Visão do backend

Este projeto não possui um serviço `backend/` separado. O backend canônico está implementado dentro da aplicação Next.js em `web/`, usando rotas HTTP do App Router como camada pública, Supabase como persistência principal e RPCs PostgreSQL como núcleo transacional das regras de negócio.

Este backend é a fonte de verdade para:

- criação de pedidos públicos
- consulta segura de pedidos por token
- cálculo financeiro no servidor
- idempotência de criação
- criação de pagamento Pix
- processamento de webhook do Mercado Pago
- persistência e leitura de `status_history`

Consumidores atuais:

- frontend público do site
- tracking público de pedido
- fluxo de pagamento Pix
- app/admin de operação ainda parcialmente dependente de Supabase direto

## 2. Arquitetura atual

Fluxo principal:

`Frontend público -> /api/orders -> lib/api/orders.ts -> Supabase RPC -> tabelas public.orders + public.order_items + order_idempotency_keys`

Fluxo de leitura:

`Frontend público / tracking -> /api/orders/:id -> lib/api/orders.ts -> get_canonical_order(...) -> canonical order`

Fluxo de pagamento Pix:

`POST /api/orders -> createOrder(...) -> create_canonical_order(...) -> createMercadoPagoPixPayment(...) -> update_order_payment_data(...)`

Fluxo de confirmação:

`Mercado Pago webhook -> /api/webhooks/mercado-pago -> valida assinatura -> consulta pagamento no provider -> localiza order por provider_transaction_id -> update_order_payment_data(...)`

Camadas:

- HTTP/API pública: `web/app/api/**`
- Regras de aplicação: `web/lib/api/orders.ts`
- Contrato e validação: `web/lib/contracts/orders.ts`
- Integração de pagamento: `web/lib/payments/mercado-pago.ts`
- Validação/consulta de webhook: `web/lib/payments/mercado-pago-webhook.ts`
- Persistência privilegiada: `web/lib/supabase-admin.ts`
- Regras transacionais e leitura canônica: `supabase/migrations/*.sql`

## 3. Endpoints públicos atuais

### `POST /api/orders`

Arquivo:

- `web/app/api/orders/route.ts`

Responsabilidade:

- recebe payload público de criação
- exige header `Idempotency-Key`
- valida request com contrato canônico
- chama RPC `create_canonical_order`
- cria Pix no Mercado Pago quando `payment_method = pix`
- sincroniza resposta idempotente
- retorna pedido canônico + `Order-Access-Token`

Headers relevantes:

- request: `Idempotency-Key`
- response: `Order-Access-Token`
- response: `X-Idempotency-Replay`

### `GET /api/orders/:id`

Arquivo:

- `web/app/api/orders/[id]/route.ts`

Responsabilidade:

- retorna pedido canônico completo
- exige `Order-Access-Token` por header ou `access_token` em query string
- suporta tracking público e refresh direto

Headers/query relevantes:

- request header: `Order-Access-Token`
- request query fallback: `access_token`

### `POST /api/webhooks/mercado-pago`

Arquivo:

- `web/app/api/webhooks/mercado-pago/route.ts`

Responsabilidade:

- valida assinatura do webhook
- ignora eventos não relacionados a pagamento
- consulta o pagamento real no Mercado Pago
- localiza o pedido via `provider_transaction_id`
- atualiza `payment_status` e `payment_data`
- sincroniza payload salvo em `order_idempotency_keys`

## 4. Contratos canônicos implementados

Arquivo principal:

- `web/lib/contracts/orders.ts`

### Entidade `CanonicalOrder`

Campos principais obrigatórios:

- `order_id`
- `order_number`
- `status`
- `payment_method`
- `payment_status`
- `subtotal`
- `delivery_fee`
- `discount_amount`
- `total_amount`
- `estimated_time_minutes`
- `fulfillment_type`
- `items`
- `payment_data`
- `customer`
- `delivery_address`
- `created_at`
- `updated_at`

Campo adicional relevante:

- `status_history`

### Enums

`status`:

- `pending`
- `confirmed`
- `preparing`
- `out_for_delivery`
- `delivered`
- `cancelled`

`payment_status`:

- `unpaid`
- `pending`
- `paid`
- `failed`
- `expired`

`payment_method`:

- `pix`
- `cash`
- `card`

`fulfillment_type`:

- `delivery`
- `pickup`

### Request canônico de criação

Tipo:

- `CreateOrderRequest`

Campos:

- `restaurant_id?`
- `restaurant_slug?`
- `payment_method`
- `fulfillment_type`
- `customer`
- `delivery_address`
- `items`
- `notes?`
- `coupon_code?`

Regra importante:

- o request aceita `restaurant_id` ou `restaurant_slug`
- para Pix, `customer.email` é obrigatório
- para `delivery`, `delivery_address` é obrigatório

### Padrão de erro

Arquivo:

- `web/lib/api/errors.ts`

Formato público:

```json
{
  "code": "ERROR_CODE",
  "message": "Mensagem amigável",
  "field": "campo.opcional"
}
```

## 5. Dependências externas

### Infra principal

- Next.js App Router
- React / React DOM
- Supabase JS (`@supabase/supabase-js`)
- PostgreSQL/Supabase RPC
- Mercado Pago Payments API

### Dependências operacionais adjacentes

- Supabase Edge Function `send-order-notification`
- FCM legacy endpoint (`https://fcm.googleapis.com/fcm/send`) para notificação de novo pedido

### Dependências lógicas de banco

Migrations mais importantes:

- `20260410200000_canonical_order_creation.sql`
- `20260410213000_order_idempotency.sql`
- `20260410224500_order_access_token.sql`
- `20260410233000_payment_lookup_helpers.sql`
- `20260411003000_order_tracking_history.sql`

RPCs/funções críticas:

- `create_canonical_order(payload, request_idempotency_key, request_hash)`
- `get_canonical_order(order_id_input, request_access_token)`
- `update_order_payment_data(order_id_input, payment_status_input, payment_data_input)`
- `find_order_id_by_provider_transaction_id(provider_transaction_id_input)`
- `build_canonical_order(order_row)`
- `append_order_status_history(order_id_input, status_input, note_input, source_input)`
- `sync_order_idempotency_response_by_order_id(order_id_input)`

## 6. Variáveis de ambiente necessárias

Fonte atual:

- `web/.env.example`

Obrigatórias para o backend público:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_URL`
- `MERCADO_PAGO_WEBHOOK_SECRET`

Opcional com default:

- `PIX_EXPIRATION_MINUTES=60`

Observações:

- `SUPABASE_SERVICE_ROLE_KEY` é necessária para rotas servidoras e nunca deve ir para o cliente
- `MERCADO_PAGO_WEBHOOK_URL` precisa apontar para a URL pública real do endpoint de webhook
- `MERCADO_PAGO_WEBHOOK_SECRET` precisa bater com a configuração do painel/provedor

Variáveis adicionais fora do backend canônico:

- `FCM_SERVER_KEY` na Edge Function `supabase/functions/send-order-notification/index.ts`

## 7. Estrutura de dados relevante

### Tabelas principais envolvidas

- `public.orders`
- `public.order_items`
- `public.order_idempotency_keys`
- `public.order_status_history`

### Colunas críticas em `orders`

- `id`
- `restaurant_id`
- `order_number`
- `customer_name`
- `customer_phone`
- `delivery_address`
- `status`
- `payment_method`
- `payment_status`
- `subtotal`
- `delivery_fee`
- `discount_amount`
- `total_amount`
- `estimated_time_minutes`
- `fulfillment_type`
- `payment_data`
- `access_token`
- `created_at`
- `updated_at`

### Garantias importantes já existentes

- `access_token` único por pedido
- `order_number` único
- `order_idempotency_keys.idempotency_key` como chave primária
- histórico de status persistido em tabela separada
- atualização de `updated_at` por trigger
- sync automático de `status_history` ao mudar `orders.status`

## 8. Comportamento operacional atual

### Criação de pedido

- o frontend envia request público para `POST /api/orders`
- o backend valida payload e idempotência antes de chamar o banco
- a RPC recalcula subtotal, taxa e total com base em `products`, `addons` e `restaurants.settings`
- o pedido nasce com `status = pending`
- `payment_status` nasce como `pending` para Pix e `unpaid` para não-Pix

### Idempotência

- cada request exige `Idempotency-Key`
- o backend calcula `request_hash` estável em `web/lib/api/orders.ts`
- a RPC usa `pg_advisory_xact_lock(...)` por chave
- mesma chave + mesmo payload retorna replay
- mesma chave + payload diferente gera conflito

### Leitura segura

- o pedido público não é buscado por sessão/autenticação tradicional
- o acesso é controlado por `Order-Access-Token`
- a leitura pública falha com `ORDER_ACCESS_DENIED` se o token não bater

### Pix

- criação de Pix ocorre depois da criação do pedido canônico
- `payment_data` é persistido via `update_order_payment_data`
- `provider_transaction_id` é o elo entre order e webhook

### Tracking

- `build_canonical_order(...)` inclui `status_history`
- `GET /api/orders/:id` já suporta refresh e link direto
- frontend público usa polling adaptativo em cima desse endpoint

## 9. Limites atuais da arquitetura

### O backend canônico público existe, mas o sistema inteiro ainda não é API-first

O site público já usa o backend canônico para pedidos.

O app/admin ainda usa Supabase direto em:

- `mobile/src/services/api.ts`
- `mobile/src/hooks/useRestaurant.ts`

Isso significa que o sistema completo ainda está híbrido:

- público: API canônica
- admin/operação: acesso direto ao banco

### Não existe um serviço backend isolado

Hoje o backend roda acoplado ao deploy do `web`. Isso simplifica entrega, mas mistura:

- UI pública
- rotas públicas
- segredos de servidor
- integração de pagamentos

Para staging real isso funciona, mas para escala e governança futura a separação de serviço ainda não existe.

## 10. Riscos atuais

### CRÍTICO

- O admin continua operando `orders`, `products`, `categories`, `addons`, `coupons` e `restaurants` direto no Supabase, fora do backend canônico. Isso cria risco de inconsistência entre regras públicas e operação interna.
- `update_order_payment_data(...)` aceita sobrescrever `payment_status` sem regra explícita de não-regressão. Um webhook fora de ordem pode potencialmente degradar um estado já confirmado.
- Não há camada explícita de autenticação/autorização própria no backend para o app/admin; a segurança operacional depende de RLS/Supabase direto.

### ALTO

- Falta observabilidade estruturada: não há logging padronizado, tracing, métricas ou correlação de request para pedidos e webhooks.
- Não há rate limiting ou proteção anti-abuso nos endpoints públicos de pedido e tracking.
- O `GET /api/orders/:id` aceita `access_token` em query string como fallback. Isso melhora portabilidade, mas aumenta superfície de vazamento via histórico, logs ou compartilhamento de URL.
- O webhook sincroniza `order_idempotency_keys.response_body`, mas não há fila/retry estruturado fora do fluxo síncrono da rota.

### MÉDIO

- `coupon_code` já existe no contrato, mas o desconto ainda não é aplicado de fato no backend canônico; `discount_amount` permanece `0` no fluxo atual.
- A arquitetura depende fortemente de mensagens de exceção SQL para mapear erros em `mapSupabaseError(...)`.
- `next`, `react` e `react-dom` estão como `latest` em `web/package.json`, o que aumenta risco de drift de ambiente ao reproduzir staging/produção.

### BAIXO

- Existe uma Edge Function de notificação com FCM legacy, separada do backend canônico e sem integração explícita com os endpoints públicos.

## 11. Status atual do backend

### Estado funcional

Implementado:

- contrato canônico de pedidos
- validação de request e response
- `POST /api/orders`
- `GET /api/orders/:id`
- idempotência real com persistência e replay
- `Order-Access-Token`
- Pix com Mercado Pago
- webhook de confirmação
- `status_history`
- erros padronizados

### Estado arquitetural

- backend público canônico está operacional
- banco e RPCs concentram a lógica crítica correta
- frontend público já depende desse backend
- operação/admin ainda não está unificada nesse backend

### Estado para staging real

Pode servir staging real do fluxo público de pedidos, desde que:

- envs do Supabase e Mercado Pago estejam corretas
- webhook público esteja acessível
- credenciais sejam válidas
- o risco de regressão de `payment_status` seja aceito ou corrigido antes de dinheiro real

### Estado para produção controlada

Ainda pede endurecimento antes de considerar o backend como plataforma única de produção:

- proteger transições de pagamento contra regressão
- reduzir dependência do admin em acesso direto ao banco
- adicionar observabilidade e logs
- revisar proteção do token em query string
- estabilizar versionamento de dependências do `web`

## 12. Arquivos-chave para manutenção futura

- `web/app/api/orders/route.ts`
- `web/app/api/orders/[id]/route.ts`
- `web/app/api/webhooks/mercado-pago/route.ts`
- `web/lib/api/orders.ts`
- `web/lib/api/errors.ts`
- `web/lib/contracts/orders.ts`
- `web/lib/payments/mercado-pago.ts`
- `web/lib/payments/mercado-pago-webhook.ts`
- `web/lib/supabase-admin.ts`
- `supabase/migrations/20260410200000_canonical_order_creation.sql`
- `supabase/migrations/20260410213000_order_idempotency.sql`
- `supabase/migrations/20260410224500_order_access_token.sql`
- `supabase/migrations/20260410233000_payment_lookup_helpers.sql`
- `supabase/migrations/20260411003000_order_tracking_history.sql`

## 13. Resumo executivo

O backend canônico público está implementado dentro do `web/` e já cobre o fluxo crítico de pedido, pagamento Pix, leitura segura, webhook e tracking. A base transacional está corretamente centralizada em RPCs do Supabase e o contrato canônico está bem definido e validado.

O principal gap atual não é o fluxo público, e sim a falta de unificação do restante do sistema em torno desse backend. O app/admin ainda conversa com o banco diretamente, e o backend ainda carece de endurecimento operacional para staging/produção real, especialmente em observabilidade, segurança de transição de pagamento e consistência entre canais.
