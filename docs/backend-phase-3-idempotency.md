# FASE 3 - Idempotency Key

## Diagnostico

Depois da FASE 2, o backend ja criava pedidos de forma transacional, mas ainda existia um risco critico de duplicidade em cenarios de retry, timeout, clique duplo ou repeticao do request pelo cliente.

O objetivo desta fase foi garantir:

- mesma chave -> mesma resposta
- mesma chave com payload diferente -> erro
- retries concorrentes sem criar pedidos duplicados

## Arquivos criados e alterados

- `web/app/api/orders/route.ts`
- `web/lib/api/orders.ts`
- `supabase/migrations/20260410213000_order_idempotency.sql`

## O que foi implementado

### 1. Header obrigatorio

O endpoint `POST /api/orders` agora exige:

- `Idempotency-Key`

Quando o header nao e enviado, a API retorna erro `400`.

### 2. Hash estavel do payload

A camada server-side agora gera um hash SHA-256 do payload normalizado. Isso permite detectar quando a mesma chave e reutilizada com um corpo diferente.

### 3. Persistencia da chave

Foi criada a tabela:

- `public.order_idempotency_keys`

Ela guarda:

- `idempotency_key`
- `request_hash`
- `order_id`
- `response_body`
- timestamps

### 4. Reaproveitamento da mesma resposta

A funcao transacional agora:

- bloqueia a chave com `pg_advisory_xact_lock`
- verifica se a chave ja existe
- compara o hash
- devolve a resposta salva se a chave ja tiver sido processada com o mesmo payload

Isso evita duplicidade mesmo em requests concorrentes.

### 5. Conflito de reutilizacao indevida

Se a mesma `Idempotency-Key` for enviada com payload diferente, o backend retorna:

- `409`
- `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`

## Explicacao tecnica

A idempotencia foi implementada no banco, dentro do fluxo transacional, porque esse e o unico lugar onde retry e concorrencia podem ser resolvidos com seguranca real.

Se a logica ficasse apenas no endpoint HTTP:

- requests paralelos ainda poderiam duplicar pedido
- falhas entre insercoes deixariam o sistema vulneravel

Com a abordagem atual:

- o lock e por chave
- o replay usa a resposta persistida
- a semantica fica consistente mesmo com varias tentativas

## Comportamento esperado

### Mesmo payload + mesma chave

- primeira chamada cria o pedido
- chamadas seguintes retornam o mesmo pedido
- nenhum pedido extra e criado

### Payload diferente + mesma chave

- a API nao cria novo pedido
- a API retorna conflito

## Riscos e limites desta fase

- ainda nao existe `GET /api/orders/:id`
- ainda nao existe pagamento Pix real
- ainda nao existe webhook de pagamento
- a integracao do frontend com o novo header ainda nao foi feita
- a migration precisa ser aplicada no banco antes de usar a rota em runtime
