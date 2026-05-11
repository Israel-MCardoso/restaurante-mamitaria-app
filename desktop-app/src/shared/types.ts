export const ORDER_STATUS_VALUES = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const PAYMENT_STATUS_VALUES = ['unpaid', 'pending', 'paid', 'failed', 'expired'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const PAYMENT_METHOD_VALUES = ['pix', 'cash', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const FULFILLMENT_TYPE_VALUES = ['delivery', 'pickup'] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPE_VALUES)[number];

export type UserRole = 'admin' | 'manager';
export type PrinterDriver = 'system' | 'qz' | 'network' | 'usb';
export type PrinterLane = 'client' | 'kitchen';
export type PrintSource = 'realtime' | 'polling' | 'manual';
export type PrintMode = 'auto' | 'manual';
export type PrintLaneSelection = PrinterLane | 'both';
export type PaperWidth = 58 | 80;
export type ListenMode = 'realtime_fallback' | 'polling_only';
export type ConnectionStatus = 'idle' | 'online' | 'reconnecting' | 'offline' | 'auth_error';
export type FilterMode =
  | 'all'
  | 'delivery'
  | 'pickup'
  | 'paid'
  | 'pending_payment'
  | 'late'
  | 'unprinted'
  | 'ready';

export interface PrinterTargetConfig {
  driver: PrinterDriver;
  displayName: string;
  systemName: string | null;
  backupSystemName: string | null;
  host: string | null;
  port: number | null;
  usbVendorId: number | null;
  usbProductId: number | null;
  paperWidth: PaperWidth;
  copies: number;
}

export interface TestPrintPayload {
  lane: PrinterLane;
  config?: PrinterTargetConfig;
  branding?: ReceiptBranding | null;
}

export interface ReceiptBranding {
  logoDataUrl: string | null;
}

export interface DesktopSettings {
  autoPrintEnabled: boolean;
  autoPrintClient: boolean;
  autoPrintKitchen: boolean;
  receivingPaused: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  desktopNotificationsEnabled: boolean;
  openAtLogin: boolean;
  minimizeToTray: boolean;
  listenMode: ListenMode;
  pollingIntervalMs: number;
  lateWarningMinutes: number;
  lateDangerMinutes: number;
  receiptBranding: ReceiptBranding;
  printers: Record<PrinterLane, PrinterTargetConfig>;
}

export interface OperationalUser {
  userId: string;
  email: string;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone: string | null;
  role: UserRole;
}

export interface PrinterOption {
  name: string;
  description: string;
  isDefault: boolean;
  status: number;
}

export interface QzTrayStatus {
  connected: boolean;
  running: boolean;
  installed: boolean;
  state: 'connected' | 'not_found' | 'closed';
  version: string | null;
  error: string | null;
}

export interface UsbPrinterOption {
  name: string;
  vendorId: number;
  productId: number;
  vendorIdHex: string;
  productIdHex: string;
}

export interface OrderAddon {
  addon_id?: string;
  name: string;
  quantity: number;
  unit_price?: number | null;
  total_price?: number | null;
}

export interface OrderOption {
  option_id?: string;
  option_name: string;
  option_item_id?: string;
  option_item_name: string;
  price_adjustment?: number | null;
}

export interface OrderItemDetail {
  item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  addons: OrderAddon[];
  options: OrderOption[];
}

export interface PrintedOrderState {
  orderId: string;
  orderNumber: string | null;
  firstDetectedAt: string | null;
  lastSource: PrintSource | null;
  lastAttemptMode: PrintMode | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  customerPrintedAt: string | null;
  kitchenPrintedAt: string | null;
  printedAt: string | null;
  printAttempts: number;
  lastError: string | null;
  retryBlockedUntil: string | null;
  pendingLanes: PrinterLane[];
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  estimatedTimeMinutes: number | null;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  fulfillmentType: FulfillmentType;
  deliveryAddress: Record<string, unknown> | null;
  items: OrderItemDetail[];
  printState: PrintedOrderState | null;
}

export interface CatalogCategory {
  id: string;
  restaurant_id: string;
  name: string;
  position: number | null;
  is_active: boolean | null;
  created_at?: string;
}

export interface CatalogAddon {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  is_available: boolean | null;
  created_at?: string;
}

export interface CatalogProductOptionItem {
  id?: string;
  option_id?: string;
  name: string;
  price_adjustment: number;
  is_available?: boolean | null;
  position?: number | null;
}

export interface CatalogProductOptionGroup {
  id?: string;
  product_id?: string;
  name: string;
  min_select: number;
  max_select: number;
  position?: number | null;
  items: CatalogProductOptionItem[];
}

export interface CatalogProduct {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  is_available: boolean | null;
  created_at?: string;
  category?: {
    name: string | null;
    is_active: boolean | null;
  } | null;
  addonIds: string[];
  optionGroups: CatalogProductOptionGroup[];
}

export interface CatalogData {
  categories: CatalogCategory[];
  addons: CatalogAddon[];
  products: CatalogProduct[];
}

export interface CatalogProductSavePayload {
  id?: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  is_available: boolean;
  addonIds: string[];
  optionGroups: CatalogProductOptionGroup[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface DeviceInfo {
  deviceId: string;
  machineName: string;
}

export interface PrinterHealthState {
  lane: PrinterLane;
  status: 'idle' | 'ok' | 'error';
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface DesktopAppState {
  isAuthenticated: boolean;
  isMonitoring: boolean;
  realtimeConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionLabel: string;
  appVersion: string;
  currentUser: OperationalUser | null;
  settings: DesktopSettings;
  currentOrders: OrderDetail[];
  recentLogs: LogEntry[];
  recentPrintJobs: PrintedOrderState[];
  lastError: string | null;
  lastSyncAt: string | null;
  isUsingOfflineCache: boolean;
  deviceInfo: DeviceInfo;
  printerHealth: Record<PrinterLane, PrinterHealthState>;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  state: DesktopAppState;
}

export interface SaveSettingsResult {
  ok: boolean;
  error?: string;
  state: DesktopAppState;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  state?: DesktopAppState;
}

export interface PrintPreviewResult extends ActionResult {
  htmlPath?: string;
  txtPath?: string;
}

export interface PublicBackendConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export type DesktopOperationalEvent =
  | {
      type: 'order-detected';
      orderId: string;
      orderNumber: string;
      customerName: string;
      source: Extract<PrintSource, 'realtime' | 'polling'>;
    };
