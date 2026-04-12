# FASE 8B - Integracao do Frontend Publico com Backend Canonico

## Diagnostico Antes

O frontend publico ainda criava pedidos direto no Supabase e lia o status do pedido pela tabela `orders`.

Isso gerava problemas reais:

- o backend nao era a fonte da verdade
- nao existia `Idempotency-Key` no checkout
- o frontend nao usava `Order-Access-Token`
- o tracking dependia de leitura direta de banco
- o Pix nao estava conectado ao fluxo canonico de sucesso e acompanhamento

## Diagnostico Depois

O fluxo publico de pedidos agora esta API-first:

- checkout cria pedido via `POST /api/orders`
- sucesso e tracking leem pedido via `GET /api/orders/:id`
- o token `Order-Access-Token` e persistido localmente
- o banco deixou de ser acessado diretamente para criar ou consultar pedidos no frontend publico
- o polling passa a refletir `status`, `payment_status` e `status_history`

## Arquivos criados e alterados

- `web/app/checkout/page.tsx`
- `web/app/order-success/[id]/page.tsx`
- `web/app/pedido/[id]/page.tsx`
- `web/components/order/OrderTrackingView.tsx`
- `web/lib/orders/public.ts`

## O que foi implementado

### 1. Checkout canônico

O checkout agora:

- gera `Idempotency-Key` por tentativa
- bloqueia duplo submit com `isSubmitting`
- envia o payload no contrato canonico
- nao grava mais `orders` nem `order_items` direto no Supabase

### 2. Tratamento da resposta

Depois do `POST /api/orders`, o frontend extrai:

- `order_id`
- `order_number`
- `payment_status`
- `payment_method`
- `payment_data`
- `total_amount`

E le o header:

- `Order-Access-Token`

### 3. Persistencia local segura

Foi criada uma camada dedicada em `web/lib/orders/public.ts` para persistir:

- `lastOrderId`
- `lastOrderAccessToken`
- `lastOrderSummary`

Com:

- `localStorage`
- fallback em `sessionStorage`
- validade de 24 horas

### 4. Pagina de sucesso integrada ao backend

A pagina de sucesso agora usa o pedido canonico e exibe:

- status operacional
- status de pagamento
- codigo Pix quando existir
- total real devolvido pelo backend

O fallback local e usado apenas para sustentar refresh e reidratar a tela antes do fetch canonico terminar.

### 5. Tracking canonico

Foi criada a rota:

- `/pedido/[id]`

E tambem foi mantida a tela:

- `/order-success/[id]`

Ambas usam o mesmo componente de tracking, com:

- `GET /api/orders/:id`
- envio de `Order-Access-Token` no header
- polling adaptativo
- leitura de `status_history`
- atualizacao de `payment_status`

### 6. Remocao do legado publico de pedidos

Foram removidas do fluxo publico:

- insercao direta em `orders`
- insercao direta em `order_items`
- leitura direta de `orders` para sucesso/tracking
- realtime direto em tabela `orders` para acompanhamento publico

## Explicacao tecnica

Para evitar espalhar logica de integracao em varias telas, a fase foi concentrada em uma camada client-side unica:

- `createPublicOrder`
- `fetchPublicOrder`
- `persistLastOrder`
- `readLastOrder`

Isso reduz acoplamento, centraliza parsing de erro e evita mistura do fluxo novo com o legado.

Na interface, a estrategia foi preservar a estrutura visual existente e trocar somente a origem dos dados.

## Riscos e limites

- o checkout ainda depende de um `restaurant_id` fixo, porque o projeto atual nao injeta esse contexto dinamicamente no fluxo publico
- a pagina publica de acompanhamento depende do token salvo no mesmo navegador; sem token persistido, o pedido nao pode ser consultado com seguranca
- o frontend ainda mostra um total estimado antes da criacao do pedido, porque nao existe endpoint de quote/preview no backend
- o catalogo publico ainda usa Supabase para restaurante e cardapio, o que e aceitavel nesta fase porque o escopo era desacoplar o fluxo de pedidos, nao o catalogo

## O que ainda depende do backend

- um mecanismo definitivo para resolver `restaurant_id` sem valor fixo
- um endpoint de preview de totais caso se queira eliminar qualquer estimativa visual no checkout
- eventual expansao do contrato para incluir metadados publicos do restaurante no pedido, se isso for necessario no success/tracking
