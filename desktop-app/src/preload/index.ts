import { contextBridge, ipcRenderer } from 'electron';
import type {
  ActionResult,
  CatalogAddon,
  CatalogCategory,
  CatalogData,
  CatalogProductSavePayload,
  DesktopAppState,
  DesktopOperationalEvent,
  DesktopSettings,
  LoginResult,
  OrderStatus,
  PrintLaneSelection,
  PrintPreviewResult,
  PublicBackendConfig,
  QzTrayStatus,
  PrinterLane,
  PrinterOption,
  UsbPrinterOption,
  PrinterTargetConfig,
  TestPrintPayload,
} from '../shared/types';

const api = {
  getState: () => ipcRenderer.invoke('desktop:get-state') as Promise<DesktopAppState>,
  getPublicBackendConfig: () => ipcRenderer.invoke('desktop:get-public-backend-config') as Promise<PublicBackendConfig>,
  refreshOrders: () => ipcRenderer.invoke('desktop:refresh-orders') as Promise<DesktopAppState>,
  login: (email: string, password: string) =>
    ipcRenderer.invoke('desktop:login', { email, password }) as Promise<LoginResult>,
  completeLogin: (accessToken: string, refreshToken: string) =>
    ipcRenderer.invoke('desktop:complete-login', { accessToken, refreshToken }) as Promise<LoginResult>,
  requestPasswordReset: (email: string) =>
    ipcRenderer.invoke('desktop:request-password-reset', { email }) as Promise<ActionResult>,
  logRendererEvent: (level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) =>
    ipcRenderer.invoke('desktop:renderer-log', { level, message, context }) as Promise<void>,
  logout: () => ipcRenderer.invoke('desktop:logout') as Promise<DesktopAppState>,
  saveSettings: (settings: DesktopSettings, options?: { refreshOrders?: boolean }) =>
    ipcRenderer.invoke('desktop:save-settings', { settings, options }) as Promise<ActionResult>,
  listPrinters: () => ipcRenderer.invoke('desktop:list-printers') as Promise<PrinterOption[]>,
  qzStatus: () => ipcRenderer.invoke('desktop:qz-status') as Promise<QzTrayStatus>,
  testQzConnection: () => ipcRenderer.invoke('desktop:test-qz-connection') as Promise<QzTrayStatus>,
  listQzPrinters: () => ipcRenderer.invoke('desktop:list-qz-printers') as Promise<{ status: QzTrayStatus; printers: PrinterOption[] }>,
  testQzBoth: () => ipcRenderer.invoke('desktop:test-qz-both') as Promise<ActionResult>,
  openQzDownload: () => ipcRenderer.invoke('desktop:open-qz-download') as Promise<void>,
  fetchCatalog: () => ipcRenderer.invoke('desktop:catalog-fetch') as Promise<CatalogData>,
  saveCatalogCategory: (category: Partial<CatalogCategory>) =>
    ipcRenderer.invoke('desktop:catalog-save-category', category) as Promise<ActionResult>,
  deleteCatalogCategory: (id: string) => ipcRenderer.invoke('desktop:catalog-delete-category', id) as Promise<ActionResult>,
  saveCatalogAddon: (addon: Partial<CatalogAddon>) =>
    ipcRenderer.invoke('desktop:catalog-save-addon', addon) as Promise<ActionResult>,
  deleteCatalogAddon: (id: string) => ipcRenderer.invoke('desktop:catalog-delete-addon', id) as Promise<ActionResult>,
  saveCatalogProduct: (product: CatalogProductSavePayload) =>
    ipcRenderer.invoke('desktop:catalog-save-product', product) as Promise<ActionResult>,
  archiveCatalogProduct: (id: string) => ipcRenderer.invoke('desktop:catalog-archive-product', id) as Promise<ActionResult>,
  pickCatalogImage: () => ipcRenderer.invoke('desktop:catalog-pick-image') as Promise<ActionResult & { imageUrl?: string }>,
  listUsbPrinters: () => ipcRenderer.invoke('desktop:list-usb-printers') as Promise<UsbPrinterOption[]>,
  printTestPage: (lane: PrinterLane, config?: PrinterTargetConfig, branding?: TestPrintPayload['branding']) =>
    ipcRenderer.invoke('desktop:print-test-page', { lane, config, branding } satisfies TestPrintPayload) as Promise<ActionResult>,
  generatePrintPreview: (lane: PrinterLane, config?: PrinterTargetConfig, branding?: TestPrintPayload['branding']) =>
    ipcRenderer.invoke('desktop:generate-print-preview', { lane, config, branding } satisfies TestPrintPayload) as Promise<PrintPreviewResult>,
  openLogs: () => ipcRenderer.invoke('desktop:open-logs') as Promise<ActionResult>,
  reprintOrder: (orderId: string, selection: PrintLaneSelection) =>
    ipcRenderer.invoke('desktop:reprint-order', { orderId, selection }) as Promise<ActionResult>,
  updateOrderStatus: (orderId: string, nextStatus: OrderStatus) =>
    ipcRenderer.invoke('desktop:update-order-status', { orderId, nextStatus }) as Promise<ActionResult>,
  clearLogs: () => ipcRenderer.invoke('desktop:clear-logs') as Promise<DesktopAppState>,
  toggleFullscreen: (enabled: boolean) =>
    ipcRenderer.invoke('desktop:toggle-fullscreen', enabled) as Promise<DesktopAppState>,
  onStateChanged: (callback: (state: DesktopAppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: DesktopAppState) => callback(state);
    ipcRenderer.on('desktop:state-changed', listener);
    return () => ipcRenderer.removeListener('desktop:state-changed', listener);
  },
  onOperationalEvent: (callback: (event: DesktopOperationalEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DesktopOperationalEvent) => callback(payload);
    ipcRenderer.on('desktop:operational-event', listener);
    return () => ipcRenderer.removeListener('desktop:operational-event', listener);
  },
};

contextBridge.exposeInMainWorld('desktopApp', api);
