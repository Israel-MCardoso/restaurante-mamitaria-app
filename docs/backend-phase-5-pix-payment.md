# FASE 5 - Pagamento Pix

## Diagnostico

Depois das fases anteriores, o backend ja criava e consultava pedidos de forma segura, mas o pagamento Pix ainda era apenas um placeholder sem QR code, expiracao ou identificador do provedor.

O objetivo desta fase foi ligar a criacao de pedido a um provedor real de Pix e preencher `payment_data` no contrato canonico.

## Arquivos criados e alterados

- `web/lib/contracts/orders.ts`
- `web/lib/payments/mercado-pago.ts`
- `web/lib/api/orders.ts`
- `web/.env.example`
- `supabase/migrations/20260410213000_order_idempotency.sql`

## O que foi implementado

### 1. Provedor real de Pix

Foi implementada uma integracao server-side com Mercado Pago em:

- `web/lib/payments/mercado-pago.ts`

Essa integracao:

- cria pagamento Pix via API do provedor
- usa idempotencia propria no header `X-Idempotency-Key`
- extrai QR code e QR code em base64
- extrai expiracao
- extrai identificador da transacao no provedor

### 2. Preenchimento de `payment_data`

O backend agora preenche o contrato canonico com:

- `qr_code`
- `qr_code_base64`
- `copy_paste_code`
- `expires_at`
- `provider_transaction_id`

### 3. Persistencia do pagamento no pedido

Foi criada a funcao:

- `public.update_order_payment_data(order_id_input uuid, payment_status_input text, payment_data_input jsonb)`

Ela atualiza o pedido no banco e devolve o contrato canonico atualizado.

### 4. Integracao com o fluxo de criacao

Depois que o pedido e criado:

- se `payment_method !== pix`, nada muda
- se `payment_method === pix`, o backend gera o pagamento Pix no provedor
- persiste `payment_data` no pedido
- devolve o pedido atualizado na resposta final

### 5. Idempotencia preservada

Depois de gerar o Pix, a resposta persistida da `Idempotency-Key` tambem e atualizada.

Isso garante que retries da mesma chave nao gerem novo Pix desnecessariamente quando o pagamento ja foi criado com sucesso.

## Explicacao tecnica

O pagamento Pix foi integrado fora da funcao SQL principal, porque a chamada ao provedor e um efeito externo e nao pode participar de uma transacao de banco tradicional.

A estrategia adotada foi:

1. criar o pedido canonicamente
2. gerar o Pix com idempotencia no provedor
3. persistir `payment_data` no pedido
4. sincronizar a resposta idempotente final

Essa abordagem evita acoplamento excessivo entre SQL e HTTP externo e deixa a fase 6 de webhook mais limpa.

## Variaveis de ambiente

Arquivo:

- `web/.env.example`

Novas variaveis:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_URL`
- `PIX_EXPIRATION_MINUTES`

## Riscos e limites desta fase

- a integracao assume Mercado Pago como provedor Pix
- o frontend atual ainda precisa enviar `customer.email` ao criar pedidos Pix
- ainda nao existe webhook para confirmacao automatica do pagamento
- o pedido pode ser criado e a geracao do Pix falhar depois; nesse caso a API falha e uma nova tentativa com a mesma `Idempotency-Key` pode reaproveitar o mesmo pedido e tentar completar o pagamento
- as migrations precisam ser aplicadas no banco antes do fluxo funcionar em runtime
