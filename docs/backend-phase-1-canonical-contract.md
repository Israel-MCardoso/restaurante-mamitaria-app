# FASE 1 - Contrato Canonico de Pedidos

## Diagnostico

O projeto atual nao possui um contrato canonico centralizado para pedidos. O frontend web, o painel mobile e o schema do Supabase usam nomes, enums e expectativas diferentes, o que impede a construcao segura do backend nas proximas fases.

Os principais desvios identificados antes desta fase eram:

- status legado `shipped` em vez de `out_for_delivery`
- ausencia dos campos canonicos `order_number`, `subtotal`, `discount_amount`, `estimated_time_minutes`, `fulfillment_type` e `payment_data`
- ausencia de uma definicao compartilhada do payload de pedido
- falta de validacao de shape para respostas e futuras integracoes

## Arquivos criados

- `web/lib/contracts/orders.ts`
- `web/lib/contracts/index.ts`

## Decisoes de modelagem

### API canonica vs persistencia interna

Nesta fase, o contrato foi definido no nivel da API e da integracao, nao no nivel fisico do banco. Isso e intencional:

- `order_id` e o identificador canonico exposto externamente
- o banco ainda pode continuar usando `id` como chave primaria interna
- o backend futuro fara a traducao entre persistencia e contrato publico

Essa separacao evita acoplar a API ao schema atual do Supabase e reduz custo de evolucao.

### Enums canonicos

Status do pedido:

- `pending`
- `confirmed`
- `preparing`
- `out_for_delivery`
- `delivered`
- `cancelled`

Status do pagamento:

- `unpaid`
- `pending`
- `paid`
- `failed`
- `expired`

Tambem foram definidos os enums operacionais:

- `payment_method`: `pix`, `cash`, `card`
- `fulfillment_type`: `delivery`, `pickup`

### Modelos implementados

Foram implementados os modelos:

- `CanonicalOrder`
- `OrderItem`
- `OrderItemAddon`
- `PaymentData`
- `CustomerSnapshot`
- `DeliveryAddress`
- `ErrorResponseBody`

## Validacoes incluidas

O contrato agora possui validacao basica de runtime para preparar as proximas fases:

- `validateCanonicalOrder`
- `validateOrderItem`
- `validatePaymentData`
- type guards para enums
- `normalizeLegacyOrderStatus` para facilitar migracao do status legado `shipped`

## Como isso prepara a FASE 2

A FASE 2 podera usar esse contrato como fonte unica para:

- construir o `POST /api/orders`
- normalizar resposta do backend
- validar payloads antes de persistir
- mapear dados do banco para resposta externa

## Riscos remanescentes

- o contrato ainda nao esta conectado ao banco nem ao frontend existente
- o schema atual do Supabase continua divergente
- ainda nao ha validacao de payload de criacao do pedido, que sera adicionada na FASE 2
- ainda nao ha politica de versionamento de contrato
