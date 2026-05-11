import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hostname } from 'node:os';
import type {
  DesktopSettings,
  DeviceInfo,
  ListenMode,
  OrderDetail,
  PrintMode,
  PrintedOrderState,
  PrintSource,
  PrinterLane,
  PrinterTargetConfig,
} from '../shared/types';

interface PersistedSession {
  access_token: string;
  refresh_token: string;
}

interface PersistedSettingsFile {
  version: 1;
  settings: Partial<DesktopSettings>;
}

interface LegacyPrintedRegistry {
  printedOrderIds: Record<string, string>;
}

interface PrintedRegistry {
  version: 2;
  orders: Record<string, Omit<PrintedOrderState, 'pendingLanes'>>;
}

const DEFAULT_PRINTER: PrinterTargetConfig = {
  driver: 'system',
  displayName: 'Impressora',
  systemName: null,
  backupSystemName: null,
  host: null,
  port: 9100,
  usbVendorId: null,
  usbProductId: null,
  paperWidth: 80,
  copies: 1,
};

const DEFAULT_SETTINGS: DesktopSettings = {
  autoPrintEnabled: true,
  autoPrintClient: true,
  autoPrintKitchen: true,
  receivingPaused: false,
  soundEnabled: true,
  soundVolume: 70,
  desktopNotificationsEnabled: true,
  openAtLogin: false,
  minimizeToTray: true,
  listenMode: 'realtime_fallback',
  pollingIntervalMs: 5000,
  lateWarningMinutes: 15,
  lateDangerMinutes: 30,
  receiptBranding: {
    logoDataUrl: null,
  },
  printers: {
    client: {
      ...DEFAULT_PRINTER,
      displayName: 'Via cliente',
    },
    kitchen: {
      ...DEFAULT_PRINTER,
      displayName: 'Via cozinha',
    },
  },
};

function ensureParent(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function appPath(...parts: string[]) {
  return join(app.getPath('userData'), ...parts);
}

function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    return fallback;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeListenMode(value: unknown): ListenMode {
  return value === 'polling_only' ? 'polling_only' : 'realtime_fallback';
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePrinterConfig(source: Partial<PrinterTargetConfig> | undefined, fallback: PrinterTargetConfig) {
  const driver =
    source?.driver === 'network' || source?.driver === 'usb' || source?.driver === 'system' || source?.driver === 'qz'
      ? source.driver
      : fallback.driver;

  const normalizedBase = {
    ...fallback,
    ...(source ?? {}),
    driver,
    systemName: typeof source?.systemName === 'string' && source.systemName.trim() ? source.systemName : null,
    backupSystemName: source?.backupSystemName ?? fallback.backupSystemName,
    host: typeof source?.host === 'string' && source.host.trim() ? source.host.trim() : null,
    port: toFiniteNumber(source?.port, fallback.port ?? 9100),
    usbVendorId: Number.isFinite(Number(source?.usbVendorId)) ? Number(source?.usbVendorId) : null,
    usbProductId: Number.isFinite(Number(source?.usbProductId)) ? Number(source?.usbProductId) : null,
    paperWidth: source?.paperWidth === 58 ? 58 : 80,
    copies: Math.max(1, Math.min(5, toFiniteNumber(source?.copies, fallback.copies))),
  } satisfies PrinterTargetConfig;

  if (driver === 'system' || driver === 'qz') {
    return {
      ...normalizedBase,
      host: null,
      usbVendorId: null,
      usbProductId: null,
    } satisfies PrinterTargetConfig;
  }

  if (driver === 'network') {
    return {
      ...normalizedBase,
      systemName: null,
      usbVendorId: null,
      usbProductId: null,
    } satisfies PrinterTargetConfig;
  }

  return {
    ...normalizedBase,
    systemName: null,
    host: null,
  } satisfies PrinterTargetConfig;
}

function baseRecord(orderId: string): Omit<PrintedOrderState, 'pendingLanes'> {
  return {
    orderId,
    orderNumber: null,
    firstDetectedAt: null,
    lastSource: null,
    lastAttemptMode: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    customerPrintedAt: null,
    kitchenPrintedAt: null,
    printedAt: null,
    printAttempts: 0,
    lastError: null,
    retryBlockedUntil: null,
  };
}

function withPendingLanes(record: Omit<PrintedOrderState, 'pendingLanes'>): PrintedOrderState {
  const pendingLanes: PrinterLane[] = [];
  if (!record.customerPrintedAt) {
    pendingLanes.push('client');
  }
  if (!record.kitchenPrintedAt) {
    pendingLanes.push('kitchen');
  }

  return {
    ...record,
    pendingLanes,
  };
}

function normalizeRegistry(raw: PrintedRegistry | LegacyPrintedRegistry | null): PrintedRegistry {
  if (!raw) {
    return { version: 2, orders: {} };
  }

  if ('version' in raw && raw.version === 2) {
    return raw;
  }

  const legacy = raw as LegacyPrintedRegistry;
  const orders = Object.fromEntries(
    Object.entries(legacy.printedOrderIds ?? {}).map(([orderId, timestamp]) => [
      orderId,
      {
        ...baseRecord(orderId),
        firstDetectedAt: timestamp,
        lastSuccessAt: timestamp,
        customerPrintedAt: timestamp,
        kitchenPrintedAt: timestamp,
        printedAt: timestamp,
        printAttempts: 1,
      },
    ]),
  );

  return {
    version: 2,
    orders,
  };
}

function normalizeSettings(input: Partial<DesktopSettings> | null | undefined): DesktopSettings {
  const source = input ?? {};
  const lateWarningMinutes = Math.max(5, toFiniteNumber(source.lateWarningMinutes, DEFAULT_SETTINGS.lateWarningMinutes));
  const lateDangerMinutes = Math.max(
    lateWarningMinutes + 1,
    toFiniteNumber(source.lateDangerMinutes, DEFAULT_SETTINGS.lateDangerMinutes),
  );

  return {
    autoPrintEnabled: source.autoPrintEnabled ?? DEFAULT_SETTINGS.autoPrintEnabled,
    autoPrintClient: source.autoPrintClient ?? DEFAULT_SETTINGS.autoPrintClient,
    autoPrintKitchen: source.autoPrintKitchen ?? DEFAULT_SETTINGS.autoPrintKitchen,
    receivingPaused: source.receivingPaused ?? DEFAULT_SETTINGS.receivingPaused,
    soundEnabled: source.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
    soundVolume: Math.min(100, Math.max(0, toFiniteNumber(source.soundVolume, DEFAULT_SETTINGS.soundVolume))),
    desktopNotificationsEnabled:
      source.desktopNotificationsEnabled ?? DEFAULT_SETTINGS.desktopNotificationsEnabled,
    openAtLogin: source.openAtLogin ?? DEFAULT_SETTINGS.openAtLogin,
    minimizeToTray: source.minimizeToTray ?? DEFAULT_SETTINGS.minimizeToTray,
    listenMode: normalizeListenMode(source.listenMode),
    pollingIntervalMs: Math.max(3000, toFiniteNumber(source.pollingIntervalMs, DEFAULT_SETTINGS.pollingIntervalMs)),
    lateWarningMinutes,
    lateDangerMinutes,
    receiptBranding: {
      logoDataUrl:
        typeof source.receiptBranding?.logoDataUrl === 'string' && source.receiptBranding.logoDataUrl.trim()
          ? source.receiptBranding.logoDataUrl
          : null,
    },
    printers: {
      client: normalizePrinterConfig(source.printers?.client, DEFAULT_SETTINGS.printers.client),
      kitchen: normalizePrinterConfig(source.printers?.kitchen, DEFAULT_SETTINGS.printers.kitchen),
    },
  };
}

function extractSettingsPayload(raw: PersistedSettingsFile | Partial<DesktopSettings> | null): {
  settings: Partial<DesktopSettings> | null;
  migrated: boolean;
} {
  if (!raw) {
    return { settings: null, migrated: false };
  }

  if ('version' in raw && raw.version === 1 && 'settings' in raw) {
    return { settings: raw.settings ?? null, migrated: false };
  }

  return { settings: raw as Partial<DesktopSettings>, migrated: true };
}

export class DesktopStore {
  private settingsPath() {
    return appPath('config', 'settings.json');
  }

  private sessionPath() {
    return appPath('secure', 'session.bin');
  }

  private printedPath() {
    return appPath('data', 'printed-orders.json');
  }

  private ordersCachePath() {
    return appPath('data', 'orders-cache.json');
  }

  private devicePath() {
    return appPath('config', 'device.json');
  }

  readSettings() {
    const raw = readJsonFile<PersistedSettingsFile | Partial<DesktopSettings> | null>(this.settingsPath(), null);
    const payload = extractSettingsPayload(raw);
    return normalizeSettings(payload.settings);
  }

  saveSettings(settings: DesktopSettings) {
    ensureParent(this.settingsPath());
    const serialized: PersistedSettingsFile = {
      version: 1,
      settings: normalizeSettings(settings),
    };
    writeFileSync(this.settingsPath(), JSON.stringify(serialized, null, 2), 'utf8');
  }

  ensureSettingsFile(settings: DesktopSettings) {
    const raw = readJsonFile<PersistedSettingsFile | Partial<DesktopSettings> | null>(this.settingsPath(), null);
    const payload = extractSettingsPayload(raw);
    const normalized = normalizeSettings(payload.settings);
    const needsRewrite =
      payload.migrated ||
      JSON.stringify(normalized) !== JSON.stringify(settings) ||
      !raw;

    if (needsRewrite) {
      this.saveSettings(settings);
    }

    return needsRewrite;
  }

  readDeviceInfo(): DeviceInfo {
    const fallback: DeviceInfo = {
      deviceId: randomUUID(),
      machineName: hostname(),
    };
    const existing = readJsonFile<DeviceInfo | null>(this.devicePath(), null);
    const next: DeviceInfo = {
      deviceId: existing?.deviceId || fallback.deviceId,
      machineName: existing?.machineName || fallback.machineName,
    };
    ensureParent(this.devicePath());
    writeFileSync(this.devicePath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  readQueueCache() {
    return readJsonFile<OrderDetail[]>(this.ordersCachePath(), []);
  }

  saveQueueCache(orders: OrderDetail[]) {
    ensureParent(this.ordersCachePath());
    writeFileSync(this.ordersCachePath(), JSON.stringify(orders, null, 2), 'utf8');
  }

  readPrintedRegistry() {
    return normalizeRegistry(readJsonFile<PrintedRegistry | LegacyPrintedRegistry | null>(this.printedPath(), null));
  }

  private writePrintedRegistry(registry: PrintedRegistry) {
    ensureParent(this.printedPath());
    writeFileSync(this.printedPath(), JSON.stringify(registry, null, 2), 'utf8');
  }

  private patchPrintedOrder(
    orderId: string,
    mutator: (current: Omit<PrintedOrderState, 'pendingLanes'>) => Omit<PrintedOrderState, 'pendingLanes'>,
  ) {
    const registry = this.readPrintedRegistry();
    const current = registry.orders[orderId] ?? baseRecord(orderId);
    registry.orders[orderId] = mutator(current);
    this.writePrintedRegistry(registry);
  }

  listRecentPrintJobs(limit = 20) {
    const registry = this.readPrintedRegistry();
    return Object.values(registry.orders)
      .map(withPendingLanes)
      .sort((left, right) => {
        const leftKey = left.lastAttemptAt ?? left.firstDetectedAt ?? '';
        const rightKey = right.lastAttemptAt ?? right.firstDetectedAt ?? '';
        return rightKey.localeCompare(leftKey);
      })
      .slice(0, limit);
  }

  getPrintedJob(orderId: string) {
    const registry = this.readPrintedRegistry();
    const current = registry.orders[orderId];
    return current ? withPendingLanes(current) : null;
  }

  hasPrintedOrder(orderId: string) {
    return Boolean(this.getPrintedJob(orderId)?.printedAt);
  }

  isLanePrinted(orderId: string, lane: PrinterLane) {
    const job = this.getPrintedJob(orderId);
    if (!job) {
      return false;
    }

    return lane === 'client' ? Boolean(job.customerPrintedAt) : Boolean(job.kitchenPrintedAt);
  }

  getPendingLanes(orderId: string): PrinterLane[] {
    const job = this.getPrintedJob(orderId);
    return job?.pendingLanes ?? ['client', 'kitchen'];
  }

  canAutoRetry(orderId: string) {
    const job = this.getPrintedJob(orderId);
    if (!job) {
      return true;
    }

    if (job.printedAt) {
      return false;
    }

    if (!job.retryBlockedUntil) {
      return true;
    }

    return Date.parse(job.retryBlockedUntil) <= Date.now();
  }

  markOrderDetected(orderId: string, params: { orderNumber: string; source: PrintSource }) {
    const now = nowIso();
    this.patchPrintedOrder(orderId, (current) => ({
      ...current,
      orderNumber: current.orderNumber ?? params.orderNumber,
      firstDetectedAt: current.firstDetectedAt ?? now,
      lastSource: params.source,
    }));
  }

  beginPrintAttempt(orderId: string, params: { orderNumber: string; source: PrintSource; mode: PrintMode }) {
    const now = nowIso();
    this.patchPrintedOrder(orderId, (current) => ({
      ...current,
      orderNumber: params.orderNumber,
      firstDetectedAt: current.firstDetectedAt ?? now,
      lastSource: params.source,
      lastAttemptMode: params.mode,
      lastAttemptAt: now,
      printAttempts: current.printAttempts + 1,
      lastError: null,
      retryBlockedUntil: null,
    }));
  }

  markLanePrinted(orderId: string, lane: PrinterLane, params: { orderNumber: string }) {
    const now = nowIso();
    this.patchPrintedOrder(orderId, (current) => {
      const next = {
        ...current,
        orderNumber: params.orderNumber,
        lastSuccessAt: now,
        lastError: null,
        retryBlockedUntil: null,
        customerPrintedAt: lane === 'client' ? current.customerPrintedAt ?? now : current.customerPrintedAt,
        kitchenPrintedAt: lane === 'kitchen' ? current.kitchenPrintedAt ?? now : current.kitchenPrintedAt,
      };

      if (next.customerPrintedAt && next.kitchenPrintedAt) {
        next.printedAt = next.printedAt ?? now;
      }

      return next;
    });
  }

  markAttemptFailed(orderId: string, params: { orderNumber: string; error: string; retryCooldownMs: number }) {
    const timestamp = Date.now();
    this.patchPrintedOrder(orderId, (current) => ({
      ...current,
      orderNumber: params.orderNumber,
      lastError: params.error,
      lastFailureAt: new Date(timestamp).toISOString(),
      retryBlockedUntil: new Date(timestamp + params.retryCooldownMs).toISOString(),
    }));
  }

  clearPrintRetryBlocks() {
    const registry = this.readPrintedRegistry();
    let changed = false;

    for (const [orderId, current] of Object.entries(registry.orders)) {
      if (!current.retryBlockedUntil && !current.lastError) {
        continue;
      }

      registry.orders[orderId] = {
        ...current,
        retryBlockedUntil: null,
        lastError: null,
      };
      changed = true;
    }

    if (changed) {
      this.writePrintedRegistry(registry);
    }

    return changed;
  }

  syncRemotePrintState(printState: PrintedOrderState | null) {
    if (!printState) {
      return false;
    }

    const registry = this.readPrintedRegistry();
    const current = registry.orders[printState.orderId] ?? baseRecord(printState.orderId);
    const next = {
      ...current,
      orderNumber: printState.orderNumber ?? current.orderNumber,
      firstDetectedAt: current.firstDetectedAt ?? printState.firstDetectedAt,
      lastSuccessAt: printState.lastSuccessAt ?? current.lastSuccessAt,
      customerPrintedAt: printState.customerPrintedAt ?? current.customerPrintedAt,
      kitchenPrintedAt: printState.kitchenPrintedAt ?? current.kitchenPrintedAt,
      printedAt: printState.printedAt ?? current.printedAt,
      printAttempts: Math.max(current.printAttempts, printState.printAttempts ?? 0),
    };

    if (JSON.stringify(current) === JSON.stringify(next)) {
      return false;
    }

    registry.orders[printState.orderId] = next;
    this.writePrintedRegistry(registry);
    return true;
  }

  syncRemotePrintStates(orders: OrderDetail[]) {
    let changed = false;
    for (const order of orders) {
      changed = this.syncRemotePrintState(order.printState) || changed;
    }
    return changed;
  }

  readSession(): PersistedSession | null {
    if (!existsSync(this.sessionPath())) {
      return null;
    }

    try {
      const raw = readFileSync(this.sessionPath());
      const decrypted = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8');
      return JSON.parse(decrypted) as PersistedSession;
    } catch {
      return null;
    }
  }

  saveSession(session: PersistedSession) {
    ensureParent(this.sessionPath());
    const payload = Buffer.from(JSON.stringify(session), 'utf8');
    const output = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(payload.toString('utf8')) : payload;
    writeFileSync(this.sessionPath(), output);
  }

  clearSession() {
    ensureParent(this.sessionPath());
    writeFileSync(this.sessionPath(), Buffer.alloc(0));
  }
}

export { DEFAULT_SETTINGS };
