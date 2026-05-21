# Recovery Report

Data: 2026-05-21

## Repositorio recuperado

- GitHub: https://github.com/Israel-MCardoso/restaurante-mamitaria-app
- Pasta local: `C:\Users\israe\Desktop\Projeto Restaurante\recovery-daiana-20260521\restaurante-mamitaria-app`
- Branch ativa: `main`
- Branches remotas encontradas:
  - `origin/HEAD -> origin/main`
  - `origin/main`
- Branch mais atual pelo historico: `main`

Ultimos commits:

- `873651e` 2026-05-11 Handle pickup checkout with legacy order schema
- `097911d` 2026-05-11 Fix pickup order creation in production
- `b08dec5` 2026-05-11 Release candidate for client testing
- `9a0b1e2` 2026-04-25 Use shared WhatsApp config and add dashboard refresh
- `0bace17` 2026-04-24 Add manual card payment approval in admin app

## Arquivos principais encontrados

- `web/`: app Next.js publicado na Vercel
- `mobile/`: app Expo/React Native admin
- `desktop-app/`: app Electron operacional
- `supabase/migrations/`: migrations SQL do banco
- `supabase/functions/send-order-notification/`: Edge Function
- `.gitignore`: regras de protecao local

## Package manager e dependencias

- Gerenciador detectado: npm
- Lockfiles encontrados:
  - `web/package-lock.json`
  - `mobile/package-lock.json`
  - `desktop-app/package-lock.json`
- Instalacao executada:
  - `npm ci` em `web`: sucesso; audit report com 3 vulnerabilidades
  - `npm ci` em `mobile`: sucesso; audit report com 29 vulnerabilidades
  - `npm ci` em `desktop-app`: sucesso; audit report com 8 vulnerabilidades
- Nenhuma dependencia foi atualizada.
- Nenhum `npm audit fix` foi executado.

## Vercel

- Vercel CLI: `54.3.0`
- Usuario autenticado: `israelcardoso1206-2480`
- Projeto vinculado:
  - Nome: `restaurante-mamitaria-app`
  - Diretorio: `web`
- Arquivos locais gerados e ignorados pelo Git:
  - `.vercel/`
  - `web/.env.local`

Variaveis puxadas para `web/.env.local` apenas por nome:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `VERCEL_OIDC_TOKEN`

Variaveis listadas na Vercel apenas por nome/ambiente:

- `NEXT_PUBLIC_APP_URL`: Production
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Production, Preview, Development
- `NEXT_PUBLIC_SUPABASE_URL`: Production, Preview, Development
- `SUPABASE_SERVICE_ROLE_KEY`: Production, Preview, Development
- `SUPABASE_URL`: Production, Preview, Development

Status das envs essenciais:

- Supabase: presente.
- Mercado Pago: ausente na listagem atual da Vercel, embora `web/.env.example` espere `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_URL` e `MERCADO_PAGO_WEBHOOK_SECRET`.
- App URL: `NEXT_PUBLIC_APP_URL` existe somente em Production.
- Auth/admin: `SUPABASE_SERVICE_ROLE_KEY` existe e e usado pelo backend/server.
- Flags mock/producao: nenhuma flag desse tipo encontrada nas envs puxadas/listadas.

## Supabase e migrations

- Pasta `supabase/migrations` encontrada.
- Nenhum reset de banco foi executado.
- Nenhuma migration foi aplicada em producao.

Migrations encontradas:

- `20231027000000_initial_schema.sql`
- `20231027000001_coupons.sql`
- `20231027000002_notifications_and_rls.sql`
- `20260410150000_storage_products_bucket.sql`
- `20260410200000_canonical_order_creation.sql`
- `20260410213000_order_idempotency.sql`
- `20260410224500_order_access_token.sql`
- `20260410233000_payment_lookup_helpers.sql`
- `20260411003000_order_tracking_history.sql`
- `20260413074000_orders_notes_compat.sql`
- `20260416090000_admin_products_rls_hardening.sql`
- `20260417093000_auth_profiles_sync.sql`
- `20260417112000_public_storefront_addons_read.sql`
- `20260419110000_restaurant_payment_integrations.sql`
- `20260422103000_admin_manage_addons_and_product_addons.sql`
- `20260422153000_checkout_coupons_delivery_quote.sql`
- `20260423120000_product_options_required_checkout.sql`
- `20260424120000_product_option_price_override.sql`
- `20260424143000_card_payment_whatsapp_checkout.sql`
- `20260426193000_order_payment_method_guards.sql`
- `20260426221500_order_print_tracking_fields.sql`
- `20260511203000_allow_pickup_orders_without_delivery_address.sql`

Tabelas esperadas pelo codigo/migrations:

- Encontradas em ingles: `restaurants`, `profiles`, `categories`, `products`, `orders`, `order_items`, `restaurant_payment_integrations`, `coupons`, `addons`, `product_addons`, `product_options`, `product_option_items`, `order_status_history`, `order_idempotency_keys`.
- Nomes em portugues citados para conferencia (`restaurantes`, `categorias`, `produtos`, `pedidos`, `pagamentos`) nao aparecem como tabelas; o projeto usa os equivalentes em ingles.
- `restaurant_users` nao foi encontrado; o projeto usa `profiles` com `restaurant_id` e `role`.
- `restaurant_promotions` nao foi encontrado.

Uso de service role:

- `SUPABASE_SERVICE_ROLE_KEY` aparece em `web/lib/supabase-admin.ts`, rotas server/API do Next.js e `supabase/functions/send-order-notification/index.ts`.
- Nao foi encontrado uso de service role em `mobile/` ou `desktop-app/`.

## Validacao local

Scripts por app:

- `web`: `dev`, `build`, `start`; sem `lint` e sem `typecheck`.
- `mobile`: `start`, `android`, `ios`, `web`; sem `lint`, sem `typecheck` e sem `build`.
- `desktop-app`: `dev`, `build:renderer`, `build:main`, `build`, `typecheck`, `dist`, `start`; sem `lint`.

Comandos executados:

- `web`: `npx tsc --noEmit` passou.
- `web`: `npm run build` passou.
- `web`: `npm run dev -- --hostname 127.0.0.1 --port 3000` subiu localmente e `GET /api/health` respondeu `200`.
- `mobile`: `npx tsc --noEmit` passou.
- `desktop-app`: `npm run typecheck` passou.
- `desktop-app`: `npm run build` passou.

Nao executados:

- `web npm run lint`: script ausente.
- `mobile npm run lint`: script ausente.
- `mobile npm run build`: script ausente.
- `desktop-app npm run lint`: script ausente.
- `desktop-app npm run dev`: nao executado para evitar abertura de GUI Electron durante recuperacao.
- `mobile npm run start`: nao executado por ser servidor Expo interativo/long-running.

## Correcoes feitas

- `.gitignore` ajustado para conter explicitamente:
  - `.env`
  - `.env.local`
  - `.env.*.local`
  - `.vercel/`
  - `node_modules/`
  - `.next/`
  - `dist/`
- Mantidas excecoes para `.env.example` e `.env*.example`.
- Nenhuma regra de negocio foi alterada.
- Nenhum commit foi feito.

## Erros e observacoes encontrados

- `pnpm` e `yarn` nao estavam instalados globalmente, mas o projeto usa npm por lockfile.
- `vercel` nao estava inicialmente no PATH; a CLI foi instalada via npm e executada pelo caminho da instalacao Node do WinGet.
- `vercel env pull .env.local` puxou variaveis de Development, mas Mercado Pago nao apareceu.
- `NEXT_PUBLIC_APP_URL` existe apenas em Production, nao em Development/Preview.
- Os audit reports do npm apontam vulnerabilidades, mas nao foram corrigidas para evitar alteracao de dependencias.
- O app mobile e o desktop possuem chaves publicas anon do Supabase embutidas em codigo/config. Isso nao e service role, mas deve ser confirmado como decisao consciente.

## Riscos atuais

- Mercado Pago pode falhar em desenvolvimento ou producao se as variaveis necessarias realmente nao existirem no projeto Vercel.
- `NEXT_PUBLIC_APP_URL` somente em Production pode causar diferenca de comportamento em Preview/Development.
- Audit reports indicam vulnerabilidades em dependencias, especialmente no app mobile; atualizar agora poderia quebrar compatibilidade e deve ser tratado em tarefa separada.
- Nao foi comparado o estado real do banco remoto com as migrations locais, porque isso exigiria acesso/confirmacao para comandos Supabase conectados ao projeto.
- Nao foi aplicado nenhum teste de fluxo real de pedido/pagamento para evitar writes em producao.

## Proximos passos recomendados

- Confirmar no painel Vercel se Mercado Pago deve ser configurado por variaveis globais ou somente por credenciais salvas por restaurante no banco.
- Confirmar se `NEXT_PUBLIC_APP_URL` deve existir tambem em Preview/Development.
- Comparar migrations locais com o projeto Supabase remoto usando Supabase CLI, sem `db reset` e sem `db push` ate haver confirmacao.
- Rodar um smoke test manual de checkout em ambiente seguro/staging antes de tocar producao.
- Criar scripts formais de `lint` e `typecheck` em `web`/`mobile` se a manutencao futura exigir CI mais previsivel.

## Checklist manual pendente

- Confirmar que o projeto Vercel correto e `israelcardoso1206-2480s-projects/restaurante-mamitaria-app`.
- Confirmar se a branch de producao na Vercel e `main`.
- Confirmar no Supabase remoto se todas as migrations listadas ja foram aplicadas.
- Confirmar se `restaurant_promotions` e `restaurant_users` nao sao mais necessarias ou se pertencem a versao antiga.
- Confirmar variaveis de Mercado Pago e URL publica do app.
- Confirmar se chaves anon hardcoded no mobile/desktop devem continuar assim ou migrar para configuracao externa.
- Aprovar qualquer commit futuro com `.gitignore` e `RECOVERY_REPORT.md`.

## Atualizacao de entrega e seguranca - 2026-05-21

Artefatos finais gerados:

- Desktop installer: `C:\Users\israe\Desktop\Projeto Restaurante\recovery-daiana-20260521\restaurante-mamitaria-app\desktop-app\release\Restaurante Desktop Setup 1.1.0.exe`
- Desktop unpacked: `C:\Users\israe\Desktop\Projeto Restaurante\recovery-daiana-20260521\restaurante-mamitaria-app\desktop-app\release\win-unpacked\Restaurante Desktop.exe`
- Android APK release: `C:\Users\israe\Desktop\Projeto Restaurante\recovery-daiana-20260521\restaurante-mamitaria-app\mobile\android\app\build\outputs\apk\release\app-release.apk`
- Logo sem fundo: `C:\Users\israe\Desktop\Projeto Restaurante\recovery-daiana-20260521\restaurante-mamitaria-app\desktop-app\build\logo-sem-fundo.png`

Correcoes adicionais feitas:

- Desktop: renderizacao inicial deixou de depender de checks de impressora/QZ antes do primeiro paint, reduzindo o risco de janela em branco.
- Desktop: icone aplicado ao executavel empacotado via hook `afterPack`.
- Desktop: `escapeHtml` endurecido para escapar aspas em atributos HTML e recibos.
- Web: `/api/health` nao executa checagem profunda de schema em producao sem `x-health-check-secret` e `HEALTH_CHECK_SECRET`.
- Mobile: bloco de diagnostico tecnico em Settings ficou restrito a build de desenvolvimento.
- Web: Next atualizado de `16.2.3` para `16.2.6` e PostCSS direto atualizado para `8.5.10`.
- Desktop: overrides pontuais adicionados para reduzir vulnerabilidades transitivas antigas vindas de `request`.
- Mobile/Desktop/Web: `npm audit fix` sem `--force` executado onde aplicavel.

Validacoes finais executadas:

- `web`: TypeScript passou via `npm exec tsc -- --noEmit`.
- `web`: build de producao passou via `npm run build` com Next `16.2.6`.
- `desktop-app`: `npm run typecheck` passou.
- `desktop-app`: `npm run dist` passou e regenerou o instalador.
- `mobile`: TypeScript passou via `npm exec tsc -- --noEmit`.
- `mobile/android`: `:app:assembleRelease` passou usando caminho curto temporario no Windows para evitar limite do CMake.
- APK release: `apksigner verify --verbose` confirmou assinatura v1 e v2 com 1 signer.
- Android emulator/device: nenhum dispositivo conectado em `adb devices`, entao smoke test em aparelho/emulador nao foi executado.

Status atual de auditoria de dependencias:

- `web`: sem vulnerabilidade alta em dependencia de producao no `npm audit --omit=dev --audit-level=high`; restam alertas moderados no PostCSS embutido pelo Next.
- `desktop-app`: sem vulnerabilidade alta em dependencia de producao no `npm audit --omit=dev --audit-level=high`; restam vulnerabilidades moderadas transitivas de `request` via `escpos/get-pixels`.
- `mobile`: ainda ha vulnerabilidades altas em cadeia Expo/React Native; a correcao sugerida pelo npm exige upgrade quebravel para Expo/React Native, por isso nao foi forcada nesta entrega.

Riscos remanescentes:

- Upgrade de Expo/React Native deve ser planejado em branch separada para remover vulnerabilidades altas do toolchain mobile sem quebrar build nativo.
- Upgrade major do Electron tambem deve ser planejado em branch separada; nao foi forcado para preservar compatibilidade do app desktop agora.
- O APK nao foi instalado/testado em dispositivo porque nenhum aparelho/emulador estava conectado.
- O build Android local precisa de caminho curto temporario no Windows; executar direto pela pasta longa falha por limite de path do CMake.
