# Restaurante Desktop

App desktop Windows para operacao do restaurante com:

- login operacional via Supabase Auth
- escuta de novos pedidos por Realtime com fallback de polling
- impressao automatica em duas vias
- prevencao de duplicidade por via
- reimpressao manual
- suporte a Windows printer, ESC/POS network e ESC/POS USB
- logs operacionais sem expor segredos

## Estrutura

- `src/main`: processo principal, autenticacao, monitor de pedidos, impressao, persistencia local e resiliencia
- `src/preload`: ponte segura IPC entre Electron e renderer
- `src/renderer`: interface de login, status, impressoras, jobs e logs
- `src/shared`: tipos compartilhados
- `build`: icones usados no app e no instalador

## Backend

O app usa:

- `DESKTOP_SUPABASE_URL`
- `DESKTOP_SUPABASE_ANON_KEY`

Fluxo de isolamento:

- login via Supabase Auth
- validacao de `profiles.restaurant_id`
- validacao de role `admin` ou `manager`
- filtros por `restaurant_id` em Realtime, polling e leitura detalhada do pedido

## Como rodar localmente

1. Copie `desktop-app/.env.example` para `desktop-app/.env`
2. Preencha:
   - `DESKTOP_SUPABASE_URL`
   - `DESKTOP_SUPABASE_ANON_KEY`
3. Instale dependencias:
   - `npm install`
4. Rode em desenvolvimento:
   - `npm run dev`
5. Valide tipos:
   - `npm run typecheck`
6. Gere build Windows:
   - `npm run dist`

## Como instalar

Depois do `npm run dist`, use:

- instalador: `desktop-app/release/Restaurante Desktop Setup 1.0.0.exe`
- executavel empacotado: `desktop-app/release/win-unpacked/Restaurante Desktop.exe`

## Como configurar impressora

Na tela do app:

1. faca login com a conta operacional do restaurante
2. clique em `Atualizar impressoras`
3. configure separadamente:
   - via cliente
   - via cozinha
4. escolha o driver:
   - `Windows printer`
   - `ESC/POS network`
   - `ESC/POS USB`
5. escolha a largura:
   - `58 mm`
   - `80 mm`
6. salve as configuracoes
7. rode `Testar impressao` em cada via

## Regra de disparo automatico

O app monitora pedidos do restaurante autenticado e imprime somente quando:

- `payment_status === 'paid'`

Ordem da impressao:

1. via cliente
2. via cozinha

## Duplicidade

O app agora rastreia localmente:

- `printed_at`
- `customer_printed_at`
- `kitchen_printed_at`
- `print_attempts`

Isso evita reimpressao completa quando apenas uma via falhou e permite retomar somente a via pendente.

Tambem foi adicionada a migration opcional:

- `supabase/migrations/20260426221500_order_print_tracking_fields.sql`

Ela prepara o backend para persistir esses campos no futuro sem quebrar a versao atual.

## Falhas e resiliencia

- falha de impressora aparece na UI
- o app continua rodando
- pedidos com falha entram em cooldown automatico antes de nova tentativa automatica
- existe reimpressao manual por `order_id`
- a fila nao entra em loop agressivo quando uma via falha

## Logs

Eventos registrados:

- login
- pedido detectado
- tentativa de impressao
- sucesso por via
- falha por via
- reimpressao manual
- falhas de polling

O logger faz redacao de campos sensiveis como:

- token
- password
- secret
- authorization
- access
- refresh
- JWTs

## Como testar impressao

Smoke test recomendado:

1. login com restaurante real de homologacao
2. configurar uma impressora Windows, USB ou ESC/POS de rede
3. usar `Testar impressao` nas duas vias
4. criar um pedido pago no mesmo restaurante
5. confirmar que o app:
   - detectou o pedido
   - imprimiu cliente primeiro
   - imprimiu cozinha depois
   - nao repetiu a via que ja saiu
6. desligar uma das impressoras e confirmar:
   - erro visivel na UI
   - app continua aberto
   - reimpressao manual funciona

## Limitacoes conhecidas

- o tracking detalhado de impressao continua autoritativo no storage local do desktop; a migration prepara o backend, mas o app ainda nao persiste esses campos na tabela `orders`
- a descoberta USB depende do dispositivo expor interface de impressora compativel com `escpos-usb`
- o desktop ainda nao lista nome comercial do device USB, apenas vendor/product id

## Veredito

Pronto para teste operacional com cliente em ambiente controlado de restaurante.
