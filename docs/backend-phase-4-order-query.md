# FASE 4 - Consulta Canonica de Pedido

## Diagnostico

Depois das fases 2 e 3, o backend ja criava pedidos de forma transacional e idempotente, mas ainda faltava uma leitura canonicamente segura para:

- pagina de sucesso
- tracking
- polling do frontend

O desafio principal desta fase era permitir leitura do pedido sem abrir acesso publico irrestrito por UUID.

## Arquivos criados e alterados

- `web/app/api/orders/[id]/route.ts`
- `web/app/api/orders/route.ts`
- `web/lib/api/orders.ts`
- `supabase/migrations/20260410213000_order_idempotency.sql`
- `supabase/migrations/20260410224500_order_access_token.sql`

## O que foi implementado

### 1. Endpoint canonico de leitura

Foi criado:

- `GET /api/orders/:id`

Arquivo:

- `web/app/api/orders/[id]/route.ts`

Esse endpoint retorna o contrato canonicamente serializado do pedido.

### 2. Leitura segura por token

A leitura agora exige um token de acesso do pedido:

- header `Order-Access-Token`

Como fallback, o endpoint tambem aceita:

- query param `access_token`

Se o token estiver ausente ou incorreto, a API nao devolve o pedido.

### 3. Token persistido no banco

Foi adicionado o campo:

- `orders.access_token`

Arquivo:

- `supabase/migrations/20260410224500_order_access_token.sql`

Esse token:

- e unico
- e obrigatorio
- tem default automatico com `gen_random_uuid()::text`

### 4. RPC de leitura canonica

Foi criada a funcao:

- `public.get_canonical_order(order_id_input uuid, request_access_token text)`

Ela:

- busca o pedido por `id`
- valida o token
- monta a resposta usando `build_canonical_order`
- retorna o contrato canonicamente serializado

### 5. Token devolvido no POST

Para permitir integracao limpa com o frontend, o `POST /api/orders` agora devolve o token de acesso no header:

- `Order-Access-Token`

Isso permite que a pagina de sucesso e o tracking usem o mesmo pedido com leitura segura sem expor o banco.

## Explicacao tecnica

A estrategia escolhida foi:

- `order_id` como identificador publico
- `access_token` como segredo de leitura

Esse desenho tem algumas vantagens:

- evita leitura aberta por UUID
- nao exige login obrigatorio do cliente final
- suporta tracking publico controlado
- mantem o contrato do pedido limpo, sem poluir o body com campos internos de autorizacao

Tambem foi reutilizada a funcao `build_canonical_order`, o que reduz o risco de divergencia entre o payload devolvido no `POST` e o payload devolvido no `GET`.

## Riscos e limites desta fase

- o frontend ainda precisa ser adaptado para armazenar e reenviar `Order-Access-Token`
- ainda nao existe status history
- ainda nao existe Pix real
- ainda nao existe webhook
- a migration precisa ser aplicada antes de usar a consulta em runtime
