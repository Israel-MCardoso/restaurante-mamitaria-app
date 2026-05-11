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
  PrinterTargetConfig,
  UsbPrinterOption,
} from '../shared/types';

declare global {
  interface Window {
    desktopApp: {
      getState: () => Promise<DesktopAppState>;
      getPublicBackendConfig: () => Promise<PublicBackendConfig>;
      refreshOrders: () => Promise<DesktopAppState>;
      login: (email: string, password: string) => Promise<LoginResult>;
      completeLogin: (accessToken: string, refreshToken: string) => Promise<LoginResult>;
      requestPasswordReset: (email: string) => Promise<ActionResult>;
      logRendererEvent: (
        level: 'info' | 'warn' | 'error',
        message: string,
        context?: Record<string, unknown>,
      ) => Promise<void>;
      logout: () => Promise<DesktopAppState>;
      saveSettings: (settings: DesktopSettings, options?: { refreshOrders?: boolean }) => Promise<ActionResult>;
      listPrinters: () => Promise<PrinterOption[]>;
      qzStatus: () => Promise<QzTrayStatus>;
      testQzConnection: () => Promise<QzTrayStatus>;
      listQzPrinters: () => Promise<{ status: QzTrayStatus; printers: PrinterOption[] }>;
      testQzBoth: () => Promise<ActionResult>;
      openQzDownload: () => Promise<void>;
      fetchCatalog: () => Promise<CatalogData>;
      saveCatalogCategory: (category: Partial<CatalogCategory>) => Promise<ActionResult>;
      deleteCatalogCategory: (id: string) => Promise<ActionResult>;
      saveCatalogAddon: (addon: Partial<CatalogAddon>) => Promise<ActionResult>;
      deleteCatalogAddon: (id: string) => Promise<ActionResult>;
      saveCatalogProduct: (product: CatalogProductSavePayload) => Promise<ActionResult>;
      archiveCatalogProduct: (id: string) => Promise<ActionResult>;
      pickCatalogImage: () => Promise<ActionResult & { imageUrl?: string }>;
      listUsbPrinters: () => Promise<UsbPrinterOption[]>;
      printTestPage: (
        lane: PrinterLane,
        config?: PrinterTargetConfig,
        branding?: DesktopSettings['receiptBranding'],
      ) => Promise<ActionResult>;
      generatePrintPreview: (
        lane: PrinterLane,
        config?: PrinterTargetConfig,
        branding?: DesktopSettings['receiptBranding'],
      ) => Promise<PrintPreviewResult>;
      openLogs: () => Promise<ActionResult>;
      reprintOrder: (orderId: string, selection: PrintLaneSelection) => Promise<ActionResult>;
      updateOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<ActionResult>;
      clearLogs: () => Promise<DesktopAppState>;
      toggleFullscreen: (enabled: boolean) => Promise<DesktopAppState>;
      onStateChanged: (callback: (state: DesktopAppState) => void) => () => void;
      onOperationalEvent: (callback: (event: DesktopOperationalEvent) => void) => () => void;
    };
  }
}

export {};
