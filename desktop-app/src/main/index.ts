import { Menu, Notification, Tray, app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { backendConfig, getResolvedBackendConfig } from './config';
import { DesktopLogger } from './logger';
import { DEFAULT_SETTINGS, DesktopStore } from './store';
import { DesktopSupabase } from './supabase-session';
import { PrintService } from './print-service';
import { QzService } from './qz-service';
import { OrderMonitor } from './order-monitor';
import type {
  ActionResult,
  CatalogAddon,
  CatalogCategory,
  CatalogProductSavePayload,
  ConnectionStatus,
  DesktopAppState,
  DesktopOperationalEvent,
  DesktopSettings,
  DeviceInfo,
  LoginResult,
  OperationalUser,
  OrderDetail,
  OrderStatus,
  PrintLaneSelection,
  PrintPreviewResult,
  QzTrayStatus,
  PrinterHealthState,
  PrinterLane,
  PrinterTargetConfig,
} from '../shared/types';
import { UI_MESSAGES, printerLaneLabel } from '../shared/ui-messages';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const appUserModelId = 'com.restaurante.desktop';

if (process.platform === 'win32') {
  app.setAppUserModelId(appUserModelId);
}

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

const initialPrinterHealth = (): Record<PrinterLane, PrinterHealthState> => ({
  client: {
    lane: 'client',
    status: 'idle',
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
  kitchen: {
    lane: 'kitchen',
    status: 'idle',
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let store!: DesktopStore;
let logger!: DesktopLogger;
let backend!: DesktopSupabase;
let printer!: PrintService;
let qzService!: QzService;
let monitor!: OrderMonitor;
let deviceInfo: DeviceInfo = {
  deviceId: 'pending-device',
  machineName: 'pending-machine',
};

let currentUser: OperationalUser | null = null;
let currentSettings: DesktopSettings = DEFAULT_SETTINGS;
let currentOrders: DesktopAppState['currentOrders'] = [];
let isMonitoring = false;
let realtimeConnected = false;
let connectionStatus: ConnectionStatus = 'idle';
let connectionLabel: string = UI_MESSAGES.waitingForAuth;
let lastError: string | null =
  backendConfig.source === 'missing'
    ? 'Backend do desktop não configurado. Verifique DESKTOP_SUPABASE_URL, DESKTOP_SUPABASE_ANON_KEY ou config/backend.json.'
    : null;
let lastSyncAt: string | null = null;
let isUsingOfflineCache = currentOrders.length > 0;
let printerHealth = initialPrinterHealth();
const lateAlerts = new Map<string, 'warn' | 'danger'>();
const notifiedPrintFailures = new Map<string, string>();

function publishOperationalEvent(event: DesktopOperationalEvent) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:operational-event', event);
  }
}

function getSafeLoginErrorMessage(message?: string) {
  const normalized = (message ?? '').toLowerCase();

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_credentials') ||
    normalized.includes('invalid credentials')
  ) {
    return 'E-mail ou senha invalidos.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Este e-mail ainda nao foi confirmado.';
  }

  if (normalized.includes('too many requests')) {
    return 'Muitas tentativas de login. Aguarde um pouco e tente novamente.';
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Nao foi possivel conectar ao Supabase agora. Verifique a internet e tente novamente.';
  }

  return 'Nao foi possivel autenticar este restaurante.';
}

function getSafePasswordResetErrorMessage(message?: string) {
  const normalized = (message ?? '').toLowerCase();

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Nao foi possivel conectar ao servidor agora. Verifique a internet e tente novamente.';
  }

  if (normalized.includes('too many requests')) {
    return 'Muitas tentativas em sequencia. Aguarde um pouco antes de tentar novamente.';
  }

  return 'Nao foi possivel solicitar a recuperacao agora. Tente novamente em instantes.';
}

function getWindowIconPath() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'build', iconFile),
        join(app.getAppPath(), 'build', iconFile),
        join(process.resourcesPath, 'app.asar', 'build', iconFile),
      ]
    : [join(app.getAppPath(), 'build', iconFile)];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (app.isPackaged) {
    return candidates[0];
  }

  return candidates[0];
}

function updateLoginItemSettings() {
  app.setLoginItemSettings({
    openAtLogin: currentSettings.openAtLogin,
    path: process.execPath,
  });
}

function updatePrinterHealth(lane: PrinterLane, status: 'ok' | 'error', errorMessage?: string | null) {
  const now = new Date().toISOString();
  printerHealth = {
    ...printerHealth,
    [lane]: {
      ...printerHealth[lane],
      status,
      lastCheckedAt: now,
      lastSuccessAt: status === 'ok' ? now : printerHealth[lane].lastSuccessAt,
      lastError: status === 'error' ? errorMessage ?? `Falha na impressora ${printerLaneLabel(lane)}.` : null,
    },
  };
}

function showDesktopNotification(title: string, body: string) {
  if (!currentSettings.desktopNotificationsEnabled || !Notification.isSupported()) {
    return;
  }

    const notification = new Notification({
      title,
      body,
      icon: getWindowIconPath(),
    });
  notification.show();
}

function orderAgeMinutes(order: OrderDetail) {
  const created = Date.parse(order.createdAt);
  if (!Number.isFinite(created)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - created) / 60000));
}

function havePrinterSettingsChanged(previous: DesktopSettings, next: DesktopSettings) {
  return JSON.stringify(previous.printers) !== JSON.stringify(next.printers);
}

function evaluateLateOrders(orders: OrderDetail[]) {
  for (const order of orders) {
    if (['delivered', 'cancelled'].includes(order.status)) {
      lateAlerts.delete(order.id);
      continue;
    }

    const ageMinutes = orderAgeMinutes(order);
    const currentLevel =
      ageMinutes >= currentSettings.lateDangerMinutes
        ? 'danger'
        : ageMinutes >= currentSettings.lateWarningMinutes
          ? 'warn'
          : null;

    if (!currentLevel) {
      lateAlerts.delete(order.id);
      continue;
    }

    const previousLevel = lateAlerts.get(order.id);
    if (previousLevel === currentLevel || previousLevel === 'danger') {
      continue;
    }

    lateAlerts.set(order.id, currentLevel);
    logger.warn('Pedido com atraso operacional detectado.', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      level: currentLevel,
      ageMinutes,
    });
    showDesktopNotification(
      currentLevel === 'danger' ? 'Pedido muito atrasado' : 'Pedido em atraso',
      `Pedido #${order.orderNumber} com ${ageMinutes} min de espera.`,
    );
  }
}

async function refreshOrders(reason = 'manual') {
  if (!currentUser) {
    currentOrders = [];
    isUsingOfflineCache = false;
    publishState();
    return;
  }

  try {
    currentOrders = await backend.fetchOperationalOrders(currentUser.restaurantId);
    store.saveQueueCache(currentOrders);
    store.syncRemotePrintStates(currentOrders);
    lastSyncAt = new Date().toISOString();
    isUsingOfflineCache = false;
    evaluateLateOrders(currentOrders);
    publishState();
    logger.info('Fila operacional atualizada.', {
      reason,
      ordersCount: currentOrders.length,
      deviceId: deviceInfo.deviceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar a fila operacional.';
    const cachedOrders = store.readQueueCache();
    lastError = message;
    if (cachedOrders.length > 0) {
      currentOrders = cachedOrders;
      isUsingOfflineCache = true;
      logger.warn('Falha ao carregar fila online. Cache local mantido.', {
        reason,
        cachedOrders: cachedOrders.length,
        error: message,
      });
    } else {
      logger.warn('Falha ao carregar fila operacional.', {
        reason,
        error: message,
      });
    }
    publishState();
  }
}

function rebuildTrayMenu() {
  if (!tray) {
    return;
  }

  const statusLine = currentUser
    ? `${connectionStatus} ${isUsingOfflineCache ? '(cache offline)' : ''}`
    : 'Aguardando login';

  const menu = Menu.buildFromTemplate([
    {
      label: 'Abrir central operacional',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: `Status: ${statusLine}`,
      enabled: false,
    },
    {
      label: currentSettings.receivingPaused ? 'Retomar recebimento' : 'Pausar recebimento',
      click: async () => {
        currentSettings = {
          ...currentSettings,
          receivingPaused: !currentSettings.receivingPaused,
        };
        store.saveSettings(currentSettings);
        updateLoginItemSettings();
        if (currentUser) {
          monitor.start(currentUser, currentSettings);
          await refreshOrders('tray-toggle-pause');
        }
        logger.info('Recebimento operacional alternado pela bandeja.', {
          receivingPaused: currentSettings.receivingPaused,
        });
        publishState();
      },
    },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip('Restaurante Desktop');
}

function ensureTray() {
  if (tray) {
    return;
  }

  try {
    tray = new Tray(getWindowIconPath());
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    rebuildTrayMenu();
    logger.info('Bandeja do sistema inicializada.');
  } catch (error) {
    logger.warn('Falha ao inicializar bandeja do sistema. O app seguira sem tray.', {
      error: error instanceof Error ? error.message : String(error),
      iconPath: getWindowIconPath(),
    });
    tray = null;
  }
}

function createMonitor() {
  monitor = new OrderMonitor(
    backend,
    store,
    logger,
    printer,
    (patch) => {
      if (patch.isMonitoring !== undefined) {
        isMonitoring = patch.isMonitoring;
      }
      if (patch.realtimeConnected !== undefined) {
        realtimeConnected = patch.realtimeConnected;
      }
      if (patch.connectionStatus !== undefined) {
        connectionStatus = patch.connectionStatus;
      }
      if (patch.connectionLabel !== undefined) {
        connectionLabel = patch.connectionLabel;
      }
      if (patch.lastError !== undefined) {
        lastError = patch.lastError;
      }
      rebuildTrayMenu();
      publishState(patch);
    },
    (reason) => {
      void refreshOrders(reason);
    },
    (event) => {
      if (event.type === 'order-detected') {
        publishOperationalEvent({
          type: 'order-detected',
          orderId: event.order.id,
          orderNumber: event.order.orderNumber,
          customerName: event.order.customerName,
          source: event.source,
        });
        if (!currentSettings.receivingPaused) {
          showDesktopNotification(
            'Novo pedido recebido',
            `Pedido #${event.order.orderNumber} de ${event.order.customerName} entrou na fila.`,
          );
        }
        return;
      }

      if (event.type === 'print-success') {
        notifiedPrintFailures.delete(`${event.order.id}:client`);
        notifiedPrintFailures.delete(`${event.order.id}:kitchen`);
        updatePrinterHealth(event.lane, 'ok');
        publishState();
        return;
      }

      updatePrinterHealth(event.lane, 'error', event.error);
      const failureKey = `${event.order.id}:${event.lane}`;
      if (notifiedPrintFailures.get(failureKey) !== event.error) {
        notifiedPrintFailures.set(failureKey, event.error);
      }
      publishState();
    },
  );
}

function buildState(overrides?: Partial<DesktopAppState>): DesktopAppState {
  return {
    isAuthenticated: Boolean(currentUser),
    isMonitoring: overrides?.isMonitoring ?? isMonitoring,
    realtimeConnected: overrides?.realtimeConnected ?? realtimeConnected,
    connectionStatus: overrides?.connectionStatus ?? connectionStatus,
    connectionLabel: overrides?.connectionLabel ?? connectionLabel,
    appVersion: app.getVersion(),
    currentUser,
    settings: currentSettings,
    currentOrders,
    recentLogs: logger.readRecent(),
    recentPrintJobs: store.listRecentPrintJobs(),
    lastError: overrides?.lastError ?? lastError,
    lastSyncAt,
    isUsingOfflineCache,
    deviceInfo,
    printerHealth,
  };
}

function publishState(overrides?: Partial<DesktopAppState>) {
  const nextState = buildState(overrides);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:state-changed', nextState);
  }
  rebuildTrayMenu();
}

async function createMainWindow() {
  logger.info('Criando janela principal.', {
    isDev,
    preloadPath: join(__dirname, '../preload/index.js'),
  });

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#f5efe4',
    icon: getWindowIconPath(),
    title: 'Restaurante Desktop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('minimize', () => {
    logger.info('Janela principal minimizada.');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Renderer carregado com sucesso.');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    lastError = `Falha ao carregar a interface (${errorCode}).`;
    logger.error('Renderer falhou ao carregar.', {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    lastError = 'O processo de interface foi encerrado inesperadamente.';
    logger.error('Renderer encerrado inesperadamente.', {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });

  mainWindow.on('close', (event) => {
    if (isQuitting || !currentSettings.minimizeToTray) {
      return;
    }
    event.preventDefault();
    mainWindow?.hide();
    logger.info('Janela enviada para a bandeja.');
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

async function tryRestoreSession() {
  const session = store.readSession();
  if (!session?.access_token || !session?.refresh_token) {
    return;
  }

  try {
    const restored = await backend.restoreSession(session.access_token, session.refresh_token);
    currentUser = restored.operator;
    lastError = null;
    connectionStatus = 'reconnecting';
      connectionLabel = UI_MESSAGES.sessionRestored;
    monitor.start(currentUser, currentSettings);
    await refreshOrders('session-restore');
    logger.info('Sessao restaurada com sucesso.', {
      restaurantId: currentUser.restaurantId,
      role: currentUser.role,
      deviceId: deviceInfo.deviceId,
    });
  } catch (error) {
    currentUser = null;
    currentOrders = [];
    connectionStatus = 'auth_error';
    connectionLabel = UI_MESSAGES.sessionExpired;
    lastError = error instanceof Error ? error.message : 'Não foi possível restaurar a sessão.';
    logger.warn('Falha ao restaurar sessao local.', {
      error: lastError,
    });
    store.clearSession();
  }
}

async function handleLogin(email: string, password: string): Promise<LoginResult> {
  try {
    const { session, operator } = await backend.login(email, password);
    return await finalizeOperationalLogin(session.access_token, session.refresh_token, operator, 'login');
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Falha ao autenticar.';
    const message = getSafeLoginErrorMessage(rawMessage);
    currentOrders = [];
    connectionStatus = 'auth_error';
    connectionLabel = UI_MESSAGES.authFailure;
    lastError = message;
    logger.warn('Falha de login operacional.', {
      emailDomain: email.split('@')[1] ?? null,
      error: message,
      rawError: rawMessage,
    });
    const state = buildState({ lastError: message });
    publishState(state);
    return { ok: false, error: message, state };
  }
}

async function finalizeOperationalLogin(
  accessToken: string,
  refreshToken: string,
  operator: OperationalUser,
  source: 'login' | 'renderer-session',
): Promise<LoginResult> {
  currentUser = operator;
  store.saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  currentSettings = store.readSettings();
  updateLoginItemSettings();
  lastError = null;
  connectionStatus = 'reconnecting';
  connectionLabel = UI_MESSAGES.loginCompleted;
  monitor.start(operator, currentSettings);
  await refreshOrders(source);
  logger.info('Login operacional concluido.', {
    restaurantId: operator.restaurantId,
    role: operator.role,
    deviceId: deviceInfo.deviceId,
    machineName: deviceInfo.machineName,
    source,
  });
  const state = buildState();
  publishState(state);
  return { ok: true, state };
}

async function handleCompleteLogin(accessToken: string, refreshToken: string): Promise<LoginResult> {
  try {
    const { session, operator } = await backend.restoreSession(accessToken, refreshToken);
    return await finalizeOperationalLogin(session.access_token, session.refresh_token, operator, 'renderer-session');
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Falha ao finalizar autenticacao.';
    const message = getSafeLoginErrorMessage(rawMessage);
    currentOrders = [];
    connectionStatus = 'auth_error';
    connectionLabel = UI_MESSAGES.authFailure;
    lastError = message;
    logger.warn('Falha ao finalizar login via renderer.', {
      error: message,
      rawError: rawMessage,
    });
    const state = buildState({ lastError: message });
    publishState(state);
    return { ok: false, error: message, state };
  }
}

async function handlePasswordReset(email: string): Promise<ActionResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      ok: false,
      error: 'Informe o e-mail da conta para solicitar a recuperação.',
      state: buildState(),
    };
  }

  try {
    await backend.requestPasswordReset(normalizedEmail);
    logger.info('Recuperacao de senha solicitada.', {
      emailDomain: normalizedEmail.split('@')[1] ?? null,
      deviceId: deviceInfo.deviceId,
    });

    return {
      ok: true,
      message:
        'Se existir uma conta para esse e-mail, você receberá um link de recuperação em instantes.',
      state: buildState(),
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Falha ao solicitar recuperacao.';
    const message = getSafePasswordResetErrorMessage(rawMessage);
    logger.warn('Falha ao solicitar recuperacao de senha.', {
      emailDomain: normalizedEmail.split('@')[1] ?? null,
      error: message,
      rawError: rawMessage,
    });

    return {
      ok: false,
      error: message,
      state: buildState(),
    };
  }
}

async function handleLogout() {
  try {
    await backend.logout();
  } catch {
    // ignore
  }

  monitor.stop();
  store.clearSession();
  notifiedPrintFailures.clear();
  currentUser = null;
  currentOrders = store.readQueueCache();
  lastError = null;
  connectionStatus = 'idle';
  connectionLabel = UI_MESSAGES.waitingForAuth;
  isUsingOfflineCache = currentOrders.length > 0;
  logger.info('Sessao encerrada.');
  const state = buildState({
    isMonitoring: false,
    realtimeConnected: false,
    lastError: null,
  });
  publishState(state);
  return state;
}

async function listSystemPrinters() {
  if (!mainWindow) {
    logger.warn('[PRINT][PRINTERS] windows-list-skipped-no-main-window');
    return [];
  }

  const printers = await mainWindow.webContents.getPrintersAsync();
  const mapped = printers.map((printerOption) => ({
    name: printerOption.name,
    description: printerOption.description,
    isDefault: printerOption.isDefault,
    status: printerOption.status,
  }));
  logger.info('[PRINT][PRINTERS] windows-list-requested', {
    count: mapped.length,
    found: mapped.map((printerOption) => printerOption.name),
  });
  return mapped;
}

async function handleQzStatus(): Promise<QzTrayStatus> {
  return qzService.status();
}

async function handleTestQzConnection(): Promise<QzTrayStatus> {
  return qzService.connect();
}

async function handleListQzPrinters() {
  return qzService.listPrinters();
}

async function handleTestQzBoth(): Promise<ActionResult> {
  if (!currentUser) {
    return { ok: false, error: 'Faca login antes de testar o QZ Tray.', state: buildState() };
  }

  const qzStatus = await qzService.connect();
  if (!qzStatus.connected) {
    return {
      ok: false,
      error: qzStatus.error ?? 'Para imprimir automaticamente, instale e abra o QZ Tray.',
      state: buildState(),
    };
  }

  logger.info('[QZ] teste completo solicitado');
  const results = await Promise.all([
    handleTestPrint(
      'client',
      {
        ...currentSettings.printers.client,
        driver: 'qz',
      },
      currentSettings.receiptBranding,
    ),
    handleTestPrint(
      'kitchen',
      {
        ...currentSettings.printers.kitchen,
        driver: 'qz',
      },
      currentSettings.receiptBranding,
    ),
  ]);
  const ok = results.every((result) => result.ok);
  return {
    ok,
    message: ok ? 'Teste QZ enviado para cliente e cozinha.' : undefined,
    error: ok ? undefined : results.map((result) => result.message ?? result.error).filter(Boolean).join(' | '),
    state: buildState(),
  };
}

function requireCurrentRestaurant() {
  if (!currentUser) {
    throw new Error('Faca login antes de alterar o cardapio.');
  }

  return currentUser.restaurantId;
}

async function handleFetchCatalog() {
  return backend.fetchCatalog(requireCurrentRestaurant());
}

async function handleSaveCatalogCategory(category: Partial<CatalogCategory>): Promise<ActionResult> {
  try {
    await backend.saveCatalogCategory(requireCurrentRestaurant(), category);
    logger.info('[CATALOG] categoria salva', { id: category.id ?? null, name: category.name ?? null });
    return { ok: true, message: 'Categoria salva com sucesso.', state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel salvar a categoria.';
    logger.error('[CATALOG][ERROR] salvar categoria', { error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleDeleteCatalogCategory(id: string): Promise<ActionResult> {
  try {
    await backend.deleteCatalogCategory(id, requireCurrentRestaurant());
    logger.info('[CATALOG] categoria excluida', { id });
    return { ok: true, message: 'Categoria excluida.', state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel excluir a categoria.';
    logger.error('[CATALOG][ERROR] excluir categoria', { id, error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleSaveCatalogAddon(addon: Partial<CatalogAddon>): Promise<ActionResult> {
  try {
    await backend.saveCatalogAddon(requireCurrentRestaurant(), addon);
    logger.info('[CATALOG] adicional salvo', { id: addon.id ?? null, name: addon.name ?? null });
    return { ok: true, message: 'Adicional salvo com sucesso.', state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o adicional.';
    logger.error('[CATALOG][ERROR] salvar adicional', { error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleDeleteCatalogAddon(id: string): Promise<ActionResult> {
  try {
    await backend.deleteCatalogAddon(id, requireCurrentRestaurant());
    logger.info('[CATALOG] adicional excluido', { id });
    return { ok: true, message: 'Adicional excluido.', state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel excluir o adicional.';
    logger.error('[CATALOG][ERROR] excluir adicional', { id, error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleSaveCatalogProduct(product: CatalogProductSavePayload): Promise<ActionResult> {
  try {
    const productId = await backend.saveCatalogProduct(requireCurrentRestaurant(), product);
    logger.info('[CATALOG] produto salvo', { id: productId, name: product.name });
    return { ok: true, message: 'Produto salvo com sucesso.', state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o produto.';
    logger.error('[CATALOG][ERROR] salvar produto', { error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleArchiveCatalogProduct(id: string): Promise<ActionResult> {
  try {
    await backend.archiveCatalogProduct(id, requireCurrentRestaurant());
    logger.info('[CATALOG] produto arquivado', { id });
    return { ok: true, message: 'Produto arquivado.', state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel arquivar o produto.';
    logger.error('[CATALOG][ERROR] arquivar produto', { id, error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handlePickCatalogImage(): Promise<ActionResult & { imageUrl?: string }> {
  try {
    const restaurantId = requireCurrentRestaurant();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Selecionar imagem do produto',
      properties: ['openFile'],
      filters: [
        { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'Selecao de imagem cancelada.', state: buildState() };
    }

    const imageUrl = await backend.uploadCatalogProductImage(restaurantId, result.filePaths[0]);
    logger.info('[CATALOG] imagem do produto enviada', { filePath: result.filePaths[0], imageUrl });
    return { ok: true, message: 'Imagem enviada com sucesso.', imageUrl, state: buildState() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel enviar a imagem.';
    logger.error('[CATALOG][ERROR] enviar imagem', { error: message });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleTestPrint(
  lane: PrinterLane,
  configOverride?: PrinterTargetConfig,
  brandingOverride = currentSettings.receiptBranding,
): Promise<ActionResult> {
  if (!currentUser) {
    return { ok: false, error: 'Faça login antes de testar a impressão.', state: buildState() };
  }

  const startedAt = Date.now();
  try {
    const config = configOverride ?? currentSettings.printers[lane];
    logger.info('[PRINT][TEST][START]', {
      lane,
      loadedFrom: configOverride ? 'renderer-payload' : 'currentSettings',
      configVersion: 1,
      driver: config.driver,
      printer: config.systemName ?? config.host ?? `${config.usbVendorId}:${config.usbProductId}`,
      copies: config.copies,
      config,
      isVirtualPrinter: config.driver === 'system' ? printer.isVirtualSystemPrinter(config.systemName) : false,
    });
    await printer.printTestPage(lane, config, currentUser, brandingOverride);
    updatePrinterHealth(lane, 'ok');
    logger.info('[PRINT][TEST][END]', { lane, ok: true, durationMs: Date.now() - startedAt });
    lastError = null;
    publishState();
    return {
      ok: true,
      message: `${lane === 'client' ? UI_MESSAGES.printSentClient : UI_MESSAGES.printSentKitchen}${
        config.driver === 'system' && printer.isVirtualSystemPrinter(config.systemName)
          ? ' Esta e uma impressora virtual. Ela pode exigir interacao manual e nao simula perfeitamente uma impressora termica.'
          : ''
      }`,
      state: buildState(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no teste de impressao.';
    updatePrinterHealth(lane, 'error', message);
    logger.error('[PRINT][TEST][ERROR]', {
      lane,
      durationMs: Date.now() - startedAt,
      error: message,
      rawError: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    lastError = message;
    publishState();
    return {
      ok: false,
      error: lane === 'client' ? UI_MESSAGES.printErrorClient : UI_MESSAGES.printErrorKitchen,
      message: `${message}${
        currentSettings.printers[lane].driver === 'system' &&
        printer.isVirtualSystemPrinter(currentSettings.printers[lane].systemName)
          ? ' Esta e uma impressora virtual; ela pode exigir interacao manual e nao valida uma impressora termica real.'
          : ''
      }`,
      state: buildState(),
    };
  }
}

async function handleGeneratePrintPreview(
  lane: PrinterLane,
  configOverride?: PrinterTargetConfig,
  brandingOverride = currentSettings.receiptBranding,
): Promise<PrintPreviewResult> {
  if (!currentUser) {
    return { ok: false, error: 'Faca login antes de gerar a previa.', state: buildState() };
  }

  const startedAt = Date.now();
  try {
    const config = configOverride ?? currentSettings.printers[lane];
    const outputDir = join(app.getPath('userData'), 'print-previews');
    logger.info('[PRINT][PREVIEW][START]', {
      lane,
      outputDir,
      loadedFrom: configOverride ? 'renderer-payload' : 'currentSettings',
      configVersion: 1,
      config,
    });
    const result = await printer.generatePreviewFiles(lane, config, currentUser, outputDir, brandingOverride);
    const openError = await shell.openPath(result.htmlPath);
    logger.info('[PRINT][PREVIEW][END]', {
      lane,
      ok: true,
      htmlPath: result.htmlPath,
      txtPath: result.txtPath,
      openError: openError || null,
      durationMs: Date.now() - startedAt,
    });
    return {
      ok: true,
      message: openError
        ? `Previa gerada, mas nao foi possivel abrir automaticamente: ${openError}`
        : 'Previa gerada e aberta com sucesso.',
      htmlPath: result.htmlPath,
      txtPath: result.txtPath,
      state: buildState(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar previa de impressao.';
    logger.error('[PRINT][PREVIEW][ERROR]', {
      lane,
      durationMs: Date.now() - startedAt,
      error: message,
      rawError: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    return { ok: false, error: message, state: buildState() };
  }
}

async function handleOpenLogs(): Promise<ActionResult> {
  const path = logger.getFilePath();
  const error = await shell.openPath(path);
  logger.info('[PRINT][LOGS] open-requested', {
    path,
    opened: !error,
    error: error || null,
  });
  return {
    ok: !error,
    message: error ? undefined : 'Logs abertos.',
    error: error || undefined,
    state: buildState(),
  };
}

async function handleManualReprint(orderId: string, selection: PrintLaneSelection): Promise<ActionResult> {
  if (!currentUser) {
    return { ok: false, error: 'Faça login antes de reimprimir.', state: buildState() };
  }

  const normalizedOrderId = orderId.trim();
  if (!normalizedOrderId) {
    return { ok: false, error: 'Informe o ID do pedido para reimpressão.', state: buildState() };
  }

  try {
    const result = await monitor.reprintOrder(currentUser, currentSettings, normalizedOrderId, selection);
    await refreshOrders('manual-reprint');
    publishState();
    return {
      ok: result.ok,
      error: result.error,
      message: result.ok ? UI_MESSAGES.manualReprintSent : result.error,
      state: buildState(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao reimprimir o pedido.';
    logger.error('Reimpressao manual falhou.', {
      orderId: normalizedOrderId,
      selection,
      error: message,
    });
    lastError = message;
    publishState();
    return { ok: false, error: message, state: buildState() };
  }
}

function validateTransition(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  return STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

async function handleUpdateOrderStatus(orderId: string, nextStatus: OrderStatus): Promise<ActionResult> {
  if (!currentUser) {
    return { ok: false, error: 'Faça login antes de alterar o status.', state: buildState() };
  }

  const order = currentOrders.find((candidate) => candidate.id === orderId);
  if (!order) {
    return { ok: false, error: 'Pedido não encontrado na fila operacional.', state: buildState() };
  }

  if (!validateTransition(order.status, nextStatus)) {
    return {
      ok: false,
      error: `Transição inválida de ${order.status} para ${nextStatus}.`,
      state: buildState(),
    };
  }

  try {
    await backend.updateOrderStatus(orderId, currentUser.restaurantId, nextStatus);
    logger.info('Status do pedido atualizado.', {
      orderId,
      orderNumber: order.orderNumber,
      from: order.status,
      to: nextStatus,
    });
    await refreshOrders('status-update');
    return {
      ok: true,
      message: UI_MESSAGES.statusUpdated,
      state: buildState(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar status do pedido.';
    logger.error('Falha ao atualizar status do pedido.', {
      orderId,
      to: nextStatus,
      error: message,
    });
    lastError = message;
    publishState();
    return {
      ok: false,
      error: message,
      state: buildState(),
    };
  }
}

app.whenReady().then(async () => {
  store = new DesktopStore();
  logger = new DesktopLogger(join(app.getPath('userData'), 'logs', 'desktop-app.log'));
  backend = new DesktopSupabase();
  qzService = new QzService(logger);
  printer = new PrintService(logger, {
    listSystemPrinters: () => listSystemPrinters(),
  }, qzService);
  deviceInfo = store.readDeviceInfo();
  currentSettings = store.readSettings();
  const normalizedSettingsRewritten = store.ensureSettingsFile(currentSettings);
  currentOrders = store.readQueueCache();
  isUsingOfflineCache = currentOrders.length > 0;
  createMonitor();

  logger.seedFromDisk();
  logger.subscribe(() => {
    publishState();
  });
  logger.info('Desktop app inicializando.', {
    backendConfigSource: backendConfig.source,
    supabaseUrlConfigured: Boolean(backendConfig.supabaseUrl),
    deviceId: deviceInfo.deviceId,
    machineName: deviceInfo.machineName,
    normalizedSettingsRewritten,
    printers: currentSettings.printers,
  });

  try {
    ensureTray();
    updateLoginItemSettings();
    await createMainWindow();
    await tryRestoreSession();
    publishState();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastError = 'Falha crítica ao iniciar o desktop.';
    logger.error('Falha critica durante bootstrap do desktop.', {
      error: message,
    });
    throw error;
  }
});

process.on('uncaughtException', (error) => {
  lastError = 'Falha interna capturada no app desktop.';
  logger?.error?.('uncaughtException no processo principal.', {
    error: error.message,
  });
  publishState();
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  lastError = 'Falha assíncrona capturada no app desktop.';
  logger?.error?.('unhandledRejection no processo principal.', {
    error: message,
  });
  publishState();
});

app.on('before-quit', () => {
  isQuitting = true;
  logger?.info?.('App encerrado pelo operador.');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Mantem o app na bandeja quando configurado.
    if (!currentSettings.minimizeToTray) {
      app.quit();
    }
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
    publishState();
    return;
  }
  mainWindow?.show();
});

ipcMain.handle('desktop:get-state', async () => buildState());
ipcMain.handle('desktop:get-public-backend-config', async () => {
  const config = getResolvedBackendConfig();
  return {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
  };
});
ipcMain.handle('desktop:login', async (_event, payload: { email: string; password: string }) =>
  handleLogin(payload.email, payload.password),
);
ipcMain.handle(
  'desktop:complete-login',
  async (_event, payload: { accessToken: string; refreshToken: string }) =>
    handleCompleteLogin(payload.accessToken, payload.refreshToken),
);
ipcMain.handle('desktop:request-password-reset', async (_event, payload: { email: string }) =>
  handlePasswordReset(payload.email),
);
ipcMain.handle(
  'desktop:renderer-log',
  async (_event, payload: { level: 'info' | 'warn' | 'error'; message: string; context?: Record<string, unknown> }) => {
    const level = payload.level === 'error' || payload.level === 'warn' ? payload.level : 'info';
    logger[level](payload.message, payload.context);
  },
);
ipcMain.handle('desktop:logout', async () => handleLogout());
ipcMain.handle('desktop:list-printers', async () => listSystemPrinters());
ipcMain.handle('desktop:qz-status', async () => handleQzStatus());
ipcMain.handle('desktop:test-qz-connection', async () => handleTestQzConnection());
ipcMain.handle('desktop:list-qz-printers', async () => handleListQzPrinters());
ipcMain.handle('desktop:test-qz-both', async () => handleTestQzBoth());
ipcMain.handle('desktop:open-qz-download', async () => {
  await shell.openExternal('https://qz.io/download/');
});
ipcMain.handle('desktop:catalog-fetch', async () => handleFetchCatalog());
ipcMain.handle('desktop:catalog-save-category', async (_event, category: Partial<CatalogCategory>) =>
  handleSaveCatalogCategory(category),
);
ipcMain.handle('desktop:catalog-delete-category', async (_event, id: string) => handleDeleteCatalogCategory(id));
ipcMain.handle('desktop:catalog-save-addon', async (_event, addon: Partial<CatalogAddon>) => handleSaveCatalogAddon(addon));
ipcMain.handle('desktop:catalog-delete-addon', async (_event, id: string) => handleDeleteCatalogAddon(id));
ipcMain.handle('desktop:catalog-save-product', async (_event, product: CatalogProductSavePayload) =>
  handleSaveCatalogProduct(product),
);
ipcMain.handle('desktop:catalog-archive-product', async (_event, id: string) => handleArchiveCatalogProduct(id));
ipcMain.handle('desktop:catalog-pick-image', async () => handlePickCatalogImage());
ipcMain.handle('desktop:list-usb-printers', async () => printer.listUsbPrinters());
ipcMain.handle('desktop:refresh-orders', async () => {
  await refreshOrders('manual-refresh');
  return {
    ...buildState(),
    lastError,
  };
});
ipcMain.handle('desktop:clear-logs', async () => {
  logger.clear();
  publishState();
  return buildState();
});
ipcMain.handle('desktop:toggle-fullscreen', async (_event, enabled: boolean) => {
  mainWindow?.setFullScreen(Boolean(enabled));
  logger.info('Modo tela cheia alterado.', { enabled: Boolean(enabled) });
  return buildState();
});
ipcMain.handle('desktop:save-settings', async (_event, payload: DesktopSettings | { settings: DesktopSettings; options?: { refreshOrders?: boolean } }) => {
  const settings = 'settings' in payload ? payload.settings : payload;
  const shouldRefreshOrders = !('settings' in payload) || payload.options?.refreshOrders !== false;
  const previousSettings = currentSettings;
  const printerSettingsChanged = havePrinterSettingsChanged(previousSettings, settings);
  store.saveSettings(settings);
  currentSettings = store.readSettings();
  const normalizedSettingsRewritten = store.ensureSettingsFile(currentSettings);
  if (printerSettingsChanged) {
    const retryBlocksCleared = store.clearPrintRetryBlocks();
    notifiedPrintFailures.clear();
    logger.info('[PRINT] Configuracao de impressoras atualizada.', {
      printerSettingsChanged,
      retryBlocksCleared,
      normalizedSettingsRewritten,
      printers: currentSettings.printers,
    });
  }
  updateLoginItemSettings();
  if (currentUser) {
    monitor.start(currentUser, currentSettings);
    if (shouldRefreshOrders) {
      await refreshOrders('settings-change');
    }
  }
  logger.info('Configuracoes atualizadas.', {
    autoPrintEnabled: currentSettings.autoPrintEnabled,
    autoPrintClient: currentSettings.autoPrintClient,
    autoPrintKitchen: currentSettings.autoPrintKitchen,
    receivingPaused: currentSettings.receivingPaused,
    soundEnabled: currentSettings.soundEnabled,
    desktopNotificationsEnabled: currentSettings.desktopNotificationsEnabled,
    openAtLogin: currentSettings.openAtLogin,
    minimizeToTray: currentSettings.minimizeToTray,
    listenMode: currentSettings.listenMode,
    pollingIntervalMs: currentSettings.pollingIntervalMs,
    lateWarningMinutes: currentSettings.lateWarningMinutes,
    lateDangerMinutes: currentSettings.lateDangerMinutes,
    hasReceiptLogo: Boolean(currentSettings.receiptBranding.logoDataUrl),
  });
  const state = buildState({ lastError: null });
  publishState(state);
  return {
    ok: true,
    message: settings.receivingPaused ? UI_MESSAGES.receivingPausedSuccess : UI_MESSAGES.settingsSaved,
    state,
  };
});
ipcMain.handle(
  'desktop:print-test-page',
  async (_event, payload: { lane: PrinterLane; config?: PrinterTargetConfig; branding?: DesktopSettings['receiptBranding'] | null }) =>
    handleTestPrint(payload.lane, payload.config, payload.branding ?? currentSettings.receiptBranding),
);
ipcMain.handle(
  'desktop:generate-print-preview',
  async (_event, payload: { lane: PrinterLane; config?: PrinterTargetConfig; branding?: DesktopSettings['receiptBranding'] | null }) =>
    handleGeneratePrintPreview(payload.lane, payload.config, payload.branding ?? currentSettings.receiptBranding),
);
ipcMain.handle('desktop:open-logs', async () => handleOpenLogs());
ipcMain.handle('desktop:reprint-order', async (_event, payload: { orderId: string; selection: PrintLaneSelection }) =>
  handleManualReprint(payload.orderId, payload.selection),
);
ipcMain.handle('desktop:update-order-status', async (_event, payload: { orderId: string; nextStatus: OrderStatus }) =>
  handleUpdateOrderStatus(payload.orderId, payload.nextStatus),
);
