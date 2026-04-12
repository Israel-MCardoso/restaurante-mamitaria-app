# FASE 6 - Webhook de Pagamento

## Diagnostico

Depois da FASE 5, o backend ja criava pagamentos Pix reais, mas ainda faltava a confirmacao automatica do pagamento pelo provedor.

Sem webhook, o sistema ficava dependente de polling manual ou atualizacao indireta, o que nao e aceitavel para um fluxo profissional de pagamento.

## Arquivos criados e alterados

- `web/lib/payments/mercado-pago-webhook.ts`
- `web/app/api/webhooks/mercado-pago/route.ts`
- `web/.env.example`
- `supabase/migrations/20260410233000_payment_lookup_helpers.sql`

## O que foi implementado

### 1. Endpoint de webhook

Foi criado:

- `POST /api/webhooks/mercado-pago`

Arquivo:

- `web/app/api/webhooks/mercado-pago/route.ts`

### 2. Validacao de assinatura

Foi implementada validacao da assinatura do Mercado Pago com base em:

- header `x-signature`
- header `x-request-id`
- query param `data.id`

O webhook so e processado quando a assinatura e valida.

### 3. Lookup do pagamento no provedor

O endpoint nao confia apenas no payload da notificacao.

Depois de validar a assinatura, ele consulta o pagamento no Mercado Pago para obter o estado atual da transacao:

- `GET /v1/payments/{id}`

### 4. Atualizacao do pedido

Depois de consultar o provedor, o backend:

- encontra o pedido pelo `provider_transaction_id`
- mapeia o status do Mercado Pago para o `payment_status` canonico
- atualiza `payment_data`
- atualiza `payment_status`

### 5. Sincronizacao da resposta idempotente

Depois que o webhook atualiza o pedido, a resposta persistida na tabela de idempotencia tambem e sincronizada.

Isso evita que retries posteriores do mesmo pedido devolvam um snapshot antigo sem o estado de pagamento atualizado.

## Explicacao tecnica

A estrategia adotada foi:

1. validar autenticidade da notificacao
2. buscar a fonte da verdade no provedor
3. localizar o pedido no banco
4. atualizar o pedido canonico
5. sincronizar a resposta idempotente

Esse desenho reduz risco de fraude e evita confiar em notificacoes incompletas ou adulteradas.

## Variaveis de ambiente

Arquivo:

- `web/.env.example`

Nova variavel:

- `MERCADO_PAGO_WEBHOOK_SECRET`

## Riscos e limites desta fase

- a implementacao assume o modelo de assinatura e notificacao do Mercado Pago
- ainda nao ha transicao automatica do `status` operacional do pedido; nesta fase atualizamos apenas `payment_status`
- ainda nao existe status history
- o frontend ainda nao foi adaptado para reagir automaticamente a mudancas confirmadas por webhook
