# FASE 8 - Erros Padronizados

## Diagnostico

O backend ja usava `ApiError`, mas ainda havia inconsistencias reais:

- cada rota tratava erro manualmente
- JSON invalido podia virar `500` em vez de `400`
- respostas internas nao garantiam sempre o mesmo formato
- novos erros do dominio podiam escapar sem mapeamento canonico

Para producao, isso e ruim tanto para UX quanto para integracao frontend.

## Arquivos criados e alterados

- `web/lib/api/errors.ts`
- `web/app/api/orders/route.ts`
- `web/app/api/orders/[id]/route.ts`
- `web/app/api/webhooks/mercado-pago/route.ts`
- `web/lib/api/orders.ts`

## O que foi implementado

### 1. Normalizacao central de erros HTTP

Foi consolidado o tratamento de erro em `web/lib/api/errors.ts`.

Agora existem duas utilidades centrais:

- `ensureApiError`
- `parseJsonBody`

### 2. JSON invalido agora responde corretamente

Quando o corpo da request nao e JSON valido, o backend agora responde:

```json
{
  "code": "INVALID_JSON_BODY",
  "message": "Request body must be valid JSON."
}
```

Com status HTTP `400`.

### 3. Formato padrao garantido

As rotas principais passaram a responder erro no formato canonico:

```json
{
  "code": "ERROR_CODE",
  "message": "Mensagem amigavel",
  "field": "campo"
}
```

O campo `field` so e enviado quando existir contexto de validacao.

### 4. Cobertura das rotas principais

Foi padronizado o tratamento nas rotas:

- `POST /api/orders`
- `GET /api/orders/:id`
- `POST /api/webhooks/mercado-pago`

### 5. Novo mapeamento de dominio

Foi incluido o erro:

- `INVALID_ORDER_STATUS`

Isso evita resposta generica quando o backend detectar status operacional invalido.

## Explicacao tecnica

A ideia desta fase nao foi criar uma camada complexa, e sim remover ambiguidade.

Com `parseJsonBody`, o parse de entrada deixa de vazar `SyntaxError` cru.
Com `ensureApiError`, toda rota consegue cair em um caminho padrao e previsivel.

Isso melhora:

- integracao frontend
- depuracao
- observabilidade
- confianca contratual da API

## Riscos e limites desta fase

- ainda nao existe catalogo documental unico com todos os codigos de erro do sistema
- respostas de sucesso ainda nao carregam envelope padrao, apenas os erros
- o frontend ainda nao foi adaptado para exibir mensagens de erro por `code` de forma especializada
