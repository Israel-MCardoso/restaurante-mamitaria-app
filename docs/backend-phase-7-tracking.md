# FASE 7 - Tracking e Historico de Status

## Diagnostico

Depois da FASE 6, o pedido ja podia ser criado, consultado e pago com Pix, mas o tracking ainda dependia apenas do `status` atual.

Isso deixava tres problemas reais:

- nao existia linha do tempo confiavel do pedido
- mudancas de status feitas por canais legados podiam ficar fora do contrato canonico
- a resposta idempotente podia ficar congelada com um status antigo

## Arquivos criados e alterados

- `web/lib/contracts/orders.ts`
- `supabase/migrations/20260411003000_order_tracking_history.sql`

## O que foi implementado

### 1. Historico canonico no contrato

O contrato TypeScript agora suporta `status_history`, com entradas no formato:

- `status`
- `changed_at`
- `note`
- `source`

Tambem foi adicionada validacao desse bloco no `validateCanonicalOrder`.

### 2. Persistencia de historico no banco

Foi criada a tabela:

- `public.order_status_history`

Ela registra cada transicao de status de forma ordenada e preserva:

- pedido relacionado
- status canonico
- nota opcional
- origem da alteracao
- timestamp da mudanca

### 3. Normalizacao do legado

O backend agora normaliza `shipped` para `out_for_delivery`.

Isso permite manter compatibilidade com fluxos antigos que ainda gravam `shipped` no banco, sem quebrar o contrato canonico esperado pelo frontend profissional.

### 4. Captura automatica de mudancas

Foi adicionado trigger em `orders` para registrar historico automaticamente:

- na criacao do pedido
- em qualquer update de `status`

Com isso, mesmo que algum canal ainda atualize `orders.status` diretamente, a timeline continua sendo preenchida.

### 5. Leitura canonica com timeline

A funcao `build_canonical_order` foi redefinida para retornar:

- status atual normalizado
- `status_history` ordenado cronologicamente

Assim, o `GET /api/orders/:id` passa a devolver uma leitura mais confiavel para tracking.

### 6. Sincronizacao do replay idempotente

Quando um novo evento de status e gravado, a resposta persistida em `order_idempotency_keys.response_body` tambem e sincronizada.

Isso evita que retries posteriores devolvam um snapshot antigo sem a timeline atualizada.

## Explicacao tecnica

A estrategia desta fase foi blindar o tracking no backend antes de adaptar telas.

Em vez de depender da disciplina do frontend ou do app admin para montar a timeline, o proprio banco passou a registrar a transicao de status e a expor esse historico dentro do pedido canonico.

Isso reduz inconsistencias e prepara a integracao real do tracking sem exigir migracao imediata de todos os clientes legados.

## Riscos e limites desta fase

- o app admin ainda atualiza `orders.status` direto; agora isso gera historico, mas ainda nao passa por endpoint HTTP canonico
- o enum fisico do banco continua aceitando `shipped`; o backend normaliza na leitura, mas a persistencia ainda carrega legado
- o frontend web ainda nao foi adaptado para renderizar a timeline de `status_history`
- nao foi adicionada nesta fase uma rota administrativa dedicada para transicao operacional de status
