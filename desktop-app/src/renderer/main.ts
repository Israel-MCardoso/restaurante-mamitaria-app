import './styles.css';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CatalogAddon,
  CatalogCategory,
  CatalogData,
  CatalogProduct,
  CatalogProductOptionGroup,
  CatalogProductSavePayload,
  DesktopAppState,
  DesktopOperationalEvent,
  DesktopSettings,
  FilterMode,
  OrderDetail,
  OrderStatus,
  PaymentStatus,
  PrintLaneSelection,
  PublicBackendConfig,
  QzTrayStatus,
  PrinterLane,
  PrinterOption,
  PrinterTargetConfig,
  UsbPrinterOption,
} from '../shared/types';
import { UI_MESSAGES, printerHealthMeta, type UiMessageTone } from '../shared/ui-messages';

type ViewMode = 'queue' | 'kitchen' | 'catalog' | 'settings' | 'logs';
type AlertTone = 'new' | 'late';
type SidebarIconName = 'queue' | 'kitchen' | 'catalog' | 'settings' | 'logs' | 'refresh' | 'printer' | 'pause' | 'resume' | 'logout' | 'collapse';
type ToastItem = { id: number; tone: UiMessageTone; message: string };

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found');
}

const app = appRoot;

let state: DesktopAppState | null = null;
let printerOptions: PrinterOption[] = [];
let qzPrinterOptions: PrinterOption[] = [];
let usbPrinterOptions: UsbPrinterOption[] = [];
let activeView: ViewMode = 'queue';
let activeFilter: FilterMode = 'all';
let isSidebarCollapsed = false;
let seenAlertOrderIds = new Set<string>();
let lateWarnedOrderIds = new Set<string>();
let lateDangerOrderIds = new Set<string>();
let isKitchenFullscreen = false;
let loginDraftEmail = '';
let loginDraftPassword = '';
let loginPasswordVisible = false;
let loginNotice: { tone: 'success' | 'error'; message: string } | null = null;
let authClientPromise: Promise<SupabaseClient> | null = null;
let settingsDraft: DesktopSettings | null = null;
let settingsDirty = false;
let toastSequence = 0;
let toasts: ToastItem[] = [];
let busyActions = new Set<string>();
let isRefreshingOrders = false;
let highlightedOrderIds = new Set<string>();
let currentAlertAudio: HTMLMediaElement | null = null;
let printDiagnosticOutput = 'Nenhum diagnostico executado nesta sessao.';
let catalogData: CatalogData | null = null;
let catalogLoading = false;
let catalogError: string | null = null;
let catalogEditingProductId: string | 'new' | null = null;
let catalogEditingCategoryId: string | 'new' | null = null;
let catalogEditingAddonId: string | 'new' | null = null;
let qzStatus: QzTrayStatus = {
  connected: false,
  running: false,
  installed: false,
  state: 'not_found',
  version: null,
  error: 'Para imprimir automaticamente, instale e abra o QZ Tray.',
};

const newOrderSoundCandidates = [
  {
    url: new URL('./assets/new-order.mp3', import.meta.url).href,
    mime: 'audio/mpeg',
  },
  {
    url: new URL('./assets/new-order.wav', import.meta.url).href,
    mime: 'audio/wav',
  },
];
const lateOrderSoundUrl = new URL('./assets/late-order.wav', import.meta.url).href;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Novo',
  confirmed: 'Confirmado',
  preparing: 'Em preparo',
  out_for_delivery: 'Pronto / saida',
  delivered: 'Finalizado',
  cancelled: 'Cancelado',
};

const STATUS_ACTIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

function cloneSettings(settings: DesktopSettings): DesktopSettings {
  return JSON.parse(JSON.stringify(settings)) as DesktopSettings;
}

function ensureSettingsDraft(currentState: DesktopAppState) {
  if (!settingsDraft) {
    settingsDraft = cloneSettings(currentState.settings);
  }

  return settingsDraft;
}

function syncSettingsDraft(currentState: DesktopAppState, force = false) {
  if (force || activeView !== 'settings' || !settingsDirty || !settingsDraft) {
    settingsDraft = cloneSettings(currentState.settings);
    settingsDirty = false;
  }
}

function pushToast(tone: UiMessageTone, message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return;
  }

  const id = ++toastSequence;
  toasts = [...toasts, { id, tone, message: normalized }].slice(-4);
  if (!shouldDeferAutomaticRender()) {
    render();
  }

  window.setTimeout(() => {
    toasts = toasts.filter((toast) => toast.id !== id);
    if (!shouldDeferAutomaticRender()) {
      render();
    }
  }, 3600);
}

function setPrintDiagnosticOutput(title: string, payload: unknown) {
  printDiagnosticOutput = `${title}\n${JSON.stringify(payload, null, 2)}`;
}

function updateHighlightedOrders(previousState: DesktopAppState | null, nextState: DesktopAppState) {
  const previousIds = new Set(previousState?.currentOrders.map((order) => order.id) ?? []);
  const freshIds = nextState.currentOrders
    .filter((order) => !previousIds.has(order.id))
    .map((order) => order.id);

  if (freshIds.length === 0) {
    return [];
  }

  freshIds.forEach((id) => highlightedOrderIds.add(id));
  window.setTimeout(() => {
    freshIds.forEach((id) => highlightedOrderIds.delete(id));
    if (!shouldDeferAutomaticRender()) {
      render();
    }
  }, 4200);

  return freshIds;
}

function toastIcon(tone: UiMessageTone) {
  if (tone === 'success') {
    return 'OK';
  }
  if (tone === 'warning') {
    return '!';
  }
  if (tone === 'error') {
    return 'X';
  }
  return 'i';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Nao foi possivel ler o arquivo do logo.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo do logo.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel processar a imagem do logo.'));
    image.src = source;
  });
}

async function prepareReceiptLogoDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem valido para o logo.');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const maxWidth = 360;
  const maxHeight = 140;
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Nao foi possivel preparar o logo para impressao.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/png');
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

function getPasswordDiagnostics(password: string) {
  return {
    passwordLength: password.length,
    hasLeadingWhitespace: /^\s/.test(password),
    hasTrailingWhitespace: /\s$/.test(password),
    hasInternalWhitespace: /\s/.test(password.trim()),
  };
}

function isInvalidCredentialsError(message?: string) {
  const normalized = (message ?? '').toLowerCase();
  return (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_credentials') ||
    normalized.includes('invalid credentials')
  );
}

async function getRendererAuthClient() {
  if (!authClientPromise) {
    authClientPromise = (async () => {
      const config: PublicBackendConfig = await window.desktopApp.getPublicBackendConfig();
      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    })();
  }

  return authClientPromise;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionItemsToText(group: CatalogProductOptionGroup) {
  return group.items
    .map((item) => (item.price_adjustment > 0 ? `${item.name}|${String(item.price_adjustment).replace('.', ',')}` : item.name))
    .join('\n');
}

function renderOptionGroupCard(group: CatalogProductOptionGroup | null, index: number) {
  return `
    <article class="option-group-card" data-option-group>
      <div class="field">
        <label>Grupo obrigatorio ${index + 1}</label>
        <input data-option-group-name value="${escapeHtml(group?.name ?? '')}" placeholder="Ex: Tamanho, Proteina, Molho" />
      </div>
      <div class="field">
        <label>Itens do grupo</label>
        <textarea data-option-group-items rows="5" placeholder="Ex:
Pequena
Media|2,00
Grande|4,00">${escapeHtml(group ? optionItemsToText(group) : '')}</textarea>
      </div>
      <button class="ghost danger-text" data-action="catalog-remove-option-group" type="button">Remover grupo</button>
    </article>
  `;
}

function parseOptionGroupsFromDom(): CatalogProductOptionGroup[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-option-group]'))
    .map((groupElement, groupIndex) => {
      const name = groupElement.querySelector<HTMLInputElement>('[data-option-group-name]')?.value.trim() ?? '';
      const itemsText = groupElement.querySelector<HTMLTextAreaElement>('[data-option-group-items]')?.value ?? '';
      const items = itemsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, itemIndex) => {
          const [rawName, rawPrice] = line.split('|');
          const itemName = rawName?.trim() ?? '';
          const parsedPrice = rawPrice ? parseMoneyInput(rawPrice) : 0;
          return {
            name: itemName,
            price_adjustment: Number.isFinite(parsedPrice) ? parsedPrice : 0,
            is_available: true,
            position: itemIndex,
          };
        })
        .filter((item) => item.name.length > 0);

      return {
        name,
        min_select: 1,
        max_select: 1,
        position: groupIndex,
        items,
      };
    })
    .filter((group) => group.name.length > 0 && group.items.length > 0);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSince(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  return `ha ${minutes} min`;
}

function usbValue(vendorId: number | null, productId: number | null) {
  return vendorId !== null && productId !== null ? `${vendorId}:${productId}` : '';
}

function resolvePreferredNewOrderSoundUrl() {
  const probe = document.createElement('audio');
  const supportedCandidate = newOrderSoundCandidates.find((candidate) => probe.canPlayType(candidate.mime) !== '');
  return supportedCandidate?.url ?? newOrderSoundCandidates[0].url;
}

function paymentBadge(status: PaymentStatus) {
  if (status === 'paid') {
    return '<span class="badge success">Pago</span>';
  }
  if (status === 'pending') {
    return '<span class="badge warn">Pendente</span>';
  }
  if (status === 'failed' || status === 'expired') {
    return '<span class="badge danger">Falhou</span>';
  }
  return '<span class="badge neutral">Nao pago</span>';
}

function statusBadge(status: OrderStatus) {
  if (status === 'delivered') {
    return `<span class="badge success">${STATUS_LABELS[status]}</span>`;
  }
  if (status === 'cancelled') {
    return `<span class="badge danger">${STATUS_LABELS[status]}</span>`;
  }
  if (status === 'preparing' || status === 'out_for_delivery') {
    return `<span class="badge warn">${STATUS_LABELS[status]}</span>`;
  }
  return `<span class="badge neutral">${STATUS_LABELS[status]}</span>`;
}

function orderAgeMinutes(order: OrderDetail) {
  return Math.max(0, Math.floor((Date.now() - Date.parse(order.createdAt)) / 60000));
}

function lateLevel(order: OrderDetail, settings: DesktopSettings) {
  const minutes = orderAgeMinutes(order);
  if (minutes >= settings.lateDangerMinutes) {
    return 'danger';
  }
  if (minutes >= settings.lateWarningMinutes) {
    return 'warn';
  }
  return 'normal';
}

function printBadges(order: OrderDetail) {
  const printState = state?.recentPrintJobs.find((job) => job.orderId === order.id) ?? order.printState;

  if (!printState) {
    return '<span class="badge neutral">Sem impressao</span>';
  }

  return `
    <span class="badge ${printState.customerPrintedAt ? 'success' : 'neutral'}">Cliente ${
      printState.customerPrintedAt ? 'impresso' : 'pendente'
    }</span>
    <span class="badge ${printState.kitchenPrintedAt ? 'success' : 'neutral'}">Cozinha ${
      printState.kitchenPrintedAt ? 'impressa' : 'pendente'
    }</span>
    ${printState.lastError ? '<span class="badge danger">Erro</span>' : ''}
  `;
}

function orderItemsSummary(order: OrderDetail) {
  return order.items
    .slice(0, 3)
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(' • ');
}

function orderActionLabel(order: OrderDetail, nextStatus: OrderStatus) {
  if (nextStatus === 'confirmed') {
    return 'Confirmar';
  }
  if (nextStatus === 'preparing') {
    return 'Em preparo';
  }
  if (nextStatus === 'out_for_delivery') {
    return order.fulfillmentType === 'pickup' ? 'Marcar pronto' : 'Saiu para entrega';
  }
  if (nextStatus === 'delivered') {
    return order.fulfillmentType === 'pickup' ? 'Finalizar retirada' : 'Finalizar entrega';
  }
  return 'Cancelar';
}

function connectionBadge(currentState: DesktopAppState) {
  const label = escapeHtml(currentState.connectionLabel);
  if (currentState.connectionStatus === 'online') {
    return `<span class="badge success" title="${label}"><span class="status-dot" aria-hidden="true"></span>${label}</span>`;
  }
  if (currentState.connectionStatus === 'reconnecting') {
    return `<span class="badge warn" title="${label}"><span class="status-dot" aria-hidden="true"></span>${label}</span>`;
  }
  if (currentState.connectionStatus === 'offline' || currentState.connectionStatus === 'auth_error') {
    return `<span class="badge danger" title="${label}"><span class="status-dot" aria-hidden="true"></span>${label}</span>`;
  }
  return `<span class="badge neutral" title="${label}"><span class="status-dot" aria-hidden="true"></span>${label}</span>`;
}

function renderSidebarIcon(icon: SidebarIconName) {
  const icons: Record<SidebarIconName, string> = {
    queue: '<path d="M9 6.75h10.5M9 12h10.5M9 17.25h10.5" /><circle cx="5.25" cy="6.75" r="1.125" fill="currentColor" stroke="none" /><circle cx="5.25" cy="12" r="1.125" fill="currentColor" stroke="none" /><circle cx="5.25" cy="17.25" r="1.125" fill="currentColor" stroke="none" />',
    kitchen:
      '<path d="M6.75 4.5v8.25a1.5 1.5 0 0 0 1.5 1.5h.75v5.25" /><path d="M9.75 4.5v9.75" /><path d="M14.25 4.5v15" /><path d="M17.25 4.5c1.5 1.5 2.25 3.125 2.25 4.875s-.75 3.375-2.25 4.875" />',
    catalog:
      '<path d="M5.25 4.5h13.5v15H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M7.5 8.25h6M7.5 12h9M7.5 15.75h5.25" />',
    settings:
      '<circle cx="12" cy="12" r="3.1" /><path d="M12 3.75v2.1M12 18.15v2.1M5.85 5.85l1.5 1.5M16.65 16.65l1.5 1.5M3.75 12h2.1M18.15 12h2.1M5.85 18.15l1.5-1.5M16.65 7.35l1.5-1.5" /><circle cx="12" cy="12" r="6.25" />',
    logs: '<path d="M8.25 4.5h6l3 3v12a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M14.25 4.5v3h3" /><path d="M9.75 11.25h4.5M9.75 15h4.5" />',
    refresh: '<path d="M16.023 9.348h4.992V4.356" /><path d="M20.49 9.851a8.25 8.25 0 1 0 2.789 5.636" />',
    printer:
      '<path d="M7.5 8.25v-3a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 .75.75v3" /><rect x="4.5" y="8.25" width="15" height="8.25" rx="1.5" ry="1.5" /><path d="M8.25 13.5h7.5v6h-7.5z" /><circle cx="16.5" cy="11.25" r=".75" fill="currentColor" stroke="none" />',
    pause: '<path d="M9 5.25v13.5m6-13.5v13.5" />',
    resume: '<path d="M8.25 6.75 17.25 12l-9 5.25V6.75Z" />',
    logout: '<path d="M15.75 9V5.625A1.875 1.875 0 0 0 13.875 3.75h-6A1.875 1.875 0 0 0 6 5.625v12.75c0 1.036.84 1.875 1.875 1.875h6a1.875 1.875 0 0 0 1.875-1.875V15" /><path d="m12 15 3-3m0 0-3-3m3 3H3.75" />',
    collapse: '<path d="M15 6l-6 6 6 6" /><path d="M19 5v14" />',
  };

  return `
    <span class="sidebar-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${icons[icon]}
      </svg>
    </span>
  `;
}

function optionMarkup(selectedValue: string | null) {
  return printerOptions
    .map(
      (printer) =>
        `<option value="${escapeHtml(printer.name)}" ${
          selectedValue === printer.name ? 'selected' : ''
        }>${escapeHtml(printer.name)}${printer.isDefault ? ' (padrao)' : ''}</option>`,
    )
    .join('');
}

function qzOptionMarkup(selectedValue: string | null) {
  const options = qzPrinterOptions
    .map(
      (printer) =>
        `<option value="${escapeHtml(printer.name)}" ${
          selectedValue === printer.name ? 'selected' : ''
        }>${escapeHtml(printer.name)}</option>`,
    )
    .join('');

  if (selectedValue && !qzPrinterOptions.some((printer) => printer.name === selectedValue)) {
    return `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)} (salva)</option>${options}`;
  }

  return options;
}

function qzStatusLabel(status: QzTrayStatus) {
  if (status.connected) {
    return `QZ Tray conectado${status.version ? ` (${status.version})` : ''}`;
  }

  if (status.state === 'not_found') {
    return 'QZ Tray nao encontrado';
  }

  return 'QZ Tray fechado';
}

function qzStatusInstruction(status: QzTrayStatus) {
  if (status.connected) {
    return 'Pronto para impressao automatica via QZ Tray.';
  }

  return 'Para imprimir automaticamente, instale e abra o QZ Tray.';
}

function usbOptionMarkup(config: PrinterTargetConfig) {
  const selected = usbValue(config.usbVendorId, config.usbProductId);
  return usbPrinterOptions
    .map(
      (printer) =>
        `<option value="${escapeHtml(usbValue(printer.vendorId, printer.productId))}" ${
          selected === usbValue(printer.vendorId, printer.productId) ? 'selected' : ''
        }>${escapeHtml(printer.name)}</option>`,
    )
    .join('');
}

async function playAlertTone(kind: AlertTone, force = false) {
  if (!state) {
    return;
  }

  if (!force && !state.settings.soundEnabled) {
    return;
  }

  const src = kind === 'late' ? lateOrderSoundUrl : resolvePreferredNewOrderSoundUrl();
  const volume = Math.max(0, Math.min(1, state.settings.soundVolume / 100));

  if (currentAlertAudio) {
    currentAlertAudio.pause();
    currentAlertAudio.currentTime = 0;
    currentAlertAudio = null;
  }

  const audio = new Audio(src);
  currentAlertAudio = audio;
  audio.volume = volume;
  audio.preload = 'auto';
  audio.currentTime = 0;
  audio.addEventListener(
    'ended',
    () => {
      if (currentAlertAudio === audio) {
        currentAlertAudio = null;
      }
    },
    { once: true },
  );

  try {
    await audio.play();
  } catch (error) {
    currentAlertAudio = null;
    await window.desktopApp.logRendererEvent('warn', 'Falha ao reproduzir alerta sonoro.', {
      kind,
      src,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function renderToasts() {
  if (toasts.length === 0) {
    return '';
  }

  return `
    <div class="toast-stack" aria-live="polite">
      ${toasts
        .map(
          (toast) => `
            <article class="toast toast-${toast.tone}">
              <span class="toast-icon" aria-hidden="true">${toastIcon(toast.tone)}</span>
              <span>${escapeHtml(toast.message)}</span>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

async function maybePlayOperationalAlerts(nextState: DesktopAppState) {
  if (nextState.settings.receivingPaused) {
    return;
  }

  const lateDanger = nextState.currentOrders.filter(
    (order) =>
      !['delivered', 'cancelled'].includes(order.status) &&
      lateLevel(order, nextState.settings) === 'danger' &&
      !lateDangerOrderIds.has(order.id),
  );

  if (lateDanger.length > 0) {
    lateDanger.forEach((order) => {
      lateDangerOrderIds.add(order.id);
      lateWarnedOrderIds.add(order.id);
    });
    await playAlertTone('late');
    return;
  }

  const lateWarn = nextState.currentOrders.filter(
    (order) =>
      !['delivered', 'cancelled'].includes(order.status) &&
      lateLevel(order, nextState.settings) === 'warn' &&
      !lateWarnedOrderIds.has(order.id),
  );

  if (lateWarn.length > 0) {
    lateWarn.forEach((order) => lateWarnedOrderIds.add(order.id));
    await playAlertTone('late');
  }
}

async function handleOperationalEvent(event: DesktopOperationalEvent) {
  if (event.type !== 'order-detected') {
    return;
  }

  if (seenAlertOrderIds.has(event.orderId)) {
    return;
  }

  seenAlertOrderIds.add(event.orderId);

  if (!state || state.settings.receivingPaused) {
    return;
  }

  await playAlertTone('new');
}

function filterOrder(order: OrderDetail, currentState: DesktopAppState) {
  if (activeFilter === 'delivery') {
    return order.fulfillmentType === 'delivery';
  }
  if (activeFilter === 'pickup') {
    return order.fulfillmentType === 'pickup';
  }
  if (activeFilter === 'paid') {
    return order.paymentStatus === 'paid';
  }
  if (activeFilter === 'pending_payment') {
    return order.paymentStatus !== 'paid';
  }
  if (activeFilter === 'late') {
    return lateLevel(order, currentState.settings) !== 'normal';
  }
  if (activeFilter === 'unprinted') {
    const printState = currentState.recentPrintJobs.find((job) => job.orderId === order.id) ?? order.printState;
    return !printState?.printedAt;
  }
  if (activeFilter === 'ready') {
    return order.status === 'out_for_delivery';
  }
  return true;
}

function groupedOrders(currentState: DesktopAppState) {
  const filtered = currentState.currentOrders.filter((order) => filterOrder(order, currentState));
  return {
    pending: filtered
      .filter((order) => order.status === 'pending')
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    confirmed: filtered
      .filter((order) => order.status === 'confirmed')
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    preparing: filtered
      .filter((order) => order.status === 'preparing')
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    ready: filtered
      .filter((order) => order.status === 'out_for_delivery')
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    archived: filtered
      .filter((order) => ['delivered', 'cancelled'].includes(order.status))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
  };
}

function renderOperationalStrip(currentState: DesktopAppState) {
  const printerClient = currentState.printerHealth.client;
  const printerKitchen = currentState.printerHealth.kitchen;
  const clientMeta = printerHealthMeta('client', printerClient);
  const kitchenMeta = printerHealthMeta('kitchen', printerKitchen);

  return `
    <section class="panel status-strip">
      <div class="status-chip">${connectionBadge(currentState)}</div>
      <div class="status-chip"><span class="badge ${currentState.isMonitoring ? 'success' : 'neutral'}" title="${currentState.isMonitoring ? 'O monitor está escutando novos pedidos.' : 'O monitor operacional está parado.'}"><span class="status-dot" aria-hidden="true"></span>${
        currentState.isMonitoring ? 'Escutando pedidos' : 'Monitor pausado'
      }</span></div>
      <div class="status-chip"><span class="badge ${clientMeta.tone === 'error' ? 'danger' : clientMeta.tone === 'success' ? 'success' : 'neutral'}" title="${escapeHtml(clientMeta.tooltip)}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(clientMeta.label)}</span></div>
      <div class="status-chip"><span class="badge ${kitchenMeta.tone === 'error' ? 'danger' : kitchenMeta.tone === 'success' ? 'success' : 'neutral'}" title="${escapeHtml(kitchenMeta.tooltip)}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(kitchenMeta.label)}</span></div>
      <div class="status-chip"><span class="badge ${currentState.settings.autoPrintEnabled && !currentState.settings.receivingPaused ? 'success' : 'warn'}" title="Define se as vias são impressas automaticamente nesta estação."><span class="status-dot" aria-hidden="true"></span>Auto print ${
        currentState.settings.autoPrintEnabled && !currentState.settings.receivingPaused ? 'ligado' : 'desligado'
      }</span></div>
      <div class="status-chip"><span class="badge ${currentState.settings.soundEnabled ? 'success' : 'warn'}" title="Ativa ou silencia os alertas sonoros do desktop."><span class="status-dot" aria-hidden="true"></span>Som ${
        currentState.settings.soundEnabled ? 'ligado' : 'desligado'
      }</span></div>
      <div class="status-chip"><span class="badge ${currentState.settings.receivingPaused ? 'warn' : 'success'}" title="${currentState.settings.receivingPaused ? 'Alertas e impressão automática estão pausados nesta estação.' : 'A estação está pronta para receber e operar novos pedidos.'}"><span class="status-dot" aria-hidden="true"></span>${
        currentState.settings.receivingPaused ? 'Recebimento pausado' : 'Recebimento ativo'
      }</span></div>
      <div class="status-chip"><span class="badge neutral" title="Horário da última sincronização com o backend."><span class="status-dot" aria-hidden="true"></span>${
        currentState.lastSyncAt ? `Última sincronização às ${formatTime(currentState.lastSyncAt)}` : 'Aguardando primeira sincronização'
      }</span></div>
      <div class="status-chip"><span class="badge ${currentState.isUsingOfflineCache ? 'warn' : 'neutral'}" title="${currentState.isUsingOfflineCache ? 'A fila exibida veio do cache local por falta de conexão.' : 'A fila exibida está online e sincronizada.'}"><span class="status-dot" aria-hidden="true"></span>${
        currentState.isUsingOfflineCache ? 'Exibindo cache offline' : 'Fila online'
      }</span></div>
    </section>
  `;
}

function renderSidebar(currentState: DesktopAppState) {
  const user = currentState.currentUser;
  const navItems: Array<{ view: ViewMode; label: string; icon: SidebarIconName; hint: string }> = [
    { view: 'queue', label: 'Fila', icon: 'queue', hint: 'Pedidos e operacao do dia' },
    { view: 'kitchen', label: 'Cozinha', icon: 'kitchen', hint: 'Modo KDS e preparo' },
    { view: 'catalog', label: 'Cardapio', icon: 'catalog', hint: 'Produtos, categorias e adicionais' },
    { view: 'settings', label: 'Configuracoes', icon: 'settings', hint: 'Impressao e preferencias' },
    { view: 'logs', label: 'Logs', icon: 'logs', hint: 'Diagnostico operacional' },
  ];

  return `
    <aside class="sidebar ${isSidebarCollapsed ? 'collapsed' : ''}">
      <div class="sidebar-top">
        <div class="brand">
          <div class="eyebrow">Central operacional Pro</div>
          <h1>${escapeHtml(user?.restaurantName ?? 'Restaurante')}</h1>
          <p class="muted">${escapeHtml(user?.email ?? '')}</p>
          <p class="muted">Device: ${escapeHtml(currentState.deviceInfo.machineName)} • ${escapeHtml(
            currentState.deviceInfo.deviceId.slice(0, 8),
          )}</p>
          <p class="muted">Versão ${escapeHtml(currentState.appVersion)}</p>
        </div>
      </div>

      <div class="sidebar-divider"></div>

      <section class="sidebar-section">
        <div class="sidebar-section-label">Navegação</div>
        <nav class="sidebar-nav" aria-label="Navegação principal">
          ${navItems
            .map(
              (item) => `
                <button
                  class="sidebar-item ${activeView === item.view ? 'active' : ''}"
                  data-action="switch-view"
                  data-view="${item.view}"
                  title="${escapeHtml(item.hint)}"
                >
                  ${renderSidebarIcon(item.icon)}
                  <span class="sidebar-item-text">
                    <strong>${escapeHtml(item.label)}</strong>
                    <small>${escapeHtml(item.hint)}</small>
                  </span>
                </button>
              `,
            )
            .join('')}
        </nav>
      </section>

      <div class="sidebar-spacer"></div>
      <div class="sidebar-divider"></div>

      <section class="sidebar-section sidebar-actions">
        <div class="sidebar-section-label">Ações rápidas</div>
        <div class="sidebar-quick-list">
          <button class="sidebar-item" data-action="refresh-orders">
            ${renderSidebarIcon('refresh')}
            <span class="sidebar-item-text">
              <strong>Atualizar fila</strong>
              <small>Sincroniza os pedidos agora</small>
            </span>
          </button>
          <button class="sidebar-item" data-action="refresh-printers">
            ${renderSidebarIcon('printer')}
            <span class="sidebar-item-text">
              <strong>Atualizar impressoras</strong>
              <small>Recarrega Windows, rede e USB</small>
            </span>
          </button>
          <button class="sidebar-item ${currentState.settings.receivingPaused ? 'attention' : ''}" data-action="toggle-receiving">
            ${renderSidebarIcon(currentState.settings.receivingPaused ? 'resume' : 'pause')}
            <span class="sidebar-item-text">
              <strong>${currentState.settings.receivingPaused ? 'Retomar recebimento' : 'Pausar recebimento'}</strong>
              <small>${currentState.settings.receivingPaused ? 'Volta a alertar e imprimir' : 'Silencia alertas e auto print'}</small>
            </span>
          </button>
          <button class="sidebar-item logout" data-action="logout">
            ${renderSidebarIcon('logout')}
            <span class="sidebar-item-text">
              <strong>Sair</strong>
              <small>Encerra a sessão desta estação</small>
            </span>
          </button>
        </div>
      </section>
    </aside>
  `;
}

function renderOrderCard(order: OrderDetail, currentState: DesktopAppState) {
  const severity = lateLevel(order, currentState.settings);
  return `
    <article class="order-card ${severity !== 'normal' ? `late-${severity}` : ''} ${highlightedOrderIds.has(order.id) ? 'order-card-highlight' : ''}">
      <div class="order-head">
        <div>
          <div class="eyebrow">Pedido ${escapeHtml(order.orderNumber)}</div>
          <h3>#${escapeHtml(order.orderNumber)} • ${escapeHtml(order.customerName)}</h3>
          <p class="muted small">${escapeHtml(order.fulfillmentType === 'delivery' ? 'Entrega' : 'Retirada')} • ${escapeHtml(
            order.paymentMethod,
          )} • ${formatTime(order.createdAt)}</p>
        </div>
        <div class="stack tight align-end">
          ${statusBadge(order.status)}
          ${paymentBadge(order.paymentStatus)}
          <span class="timer ${severity}">${formatSince(order.createdAt)}</span>
        </div>
      </div>
      <div class="order-grid">
        <div>
          <div class="muted small">Itens</div>
          <p>${escapeHtml(orderItemsSummary(order) || 'Sem itens')}</p>
        </div>
        <div>
          <div class="muted small">Total</div>
          <p><strong>${formatCurrency(order.totalAmount)}</strong></p>
        </div>
      </div>
      <div class="inline wrap">
        ${printBadges(order)}
      </div>
      ${
        order.notes
          ? `<div class="order-note"><strong>Observacoes:</strong> ${escapeHtml(order.notes)}</div>`
          : ''
      }
      <div class="actions wrap">
        <button class="ghost small" data-action="reprint-order" data-order-id="${escapeHtml(order.id)}" data-selection="client">Cliente</button>
        <button class="ghost small" data-action="reprint-order" data-order-id="${escapeHtml(order.id)}" data-selection="kitchen">Cozinha</button>
        <button class="ghost small" data-action="reprint-order" data-order-id="${escapeHtml(order.id)}" data-selection="both">Ambas</button>
        ${STATUS_ACTIONS[order.status]
          .map(
            (nextStatus) => `
              <button class="secondary small" data-action="update-status" data-order-id="${escapeHtml(order.id)}" data-status="${nextStatus}">
                ${escapeHtml(orderActionLabel(order, nextStatus))}
              </button>`,
          )
          .join('')}
      </div>
    </article>
  `;
}

function renderQueueColumn(title: string, orders: OrderDetail[], currentState: DesktopAppState) {
  return `
    <section class="queue-column panel">
      <div class="queue-column-head">
        <div>
          <div class="eyebrow">${escapeHtml(title)}</div>
          <h3>${orders.length} pedido(s)</h3>
        </div>
      </div>
      <div class="queue-column-body">
        ${
          isRefreshingOrders && orders.length === 0
            ? '<div class="queue-skeleton-stack"><div class="queue-skeleton-card"></div><div class="queue-skeleton-card"></div></div>'
            : orders.length === 0
            ? '<div class="empty-state"><strong>Sem pedidos aqui</strong><p class="muted">Novos pedidos desta etapa aparecerao automaticamente.</p></div>'
            : orders.map((order) => renderOrderCard(order, currentState)).join('')
        }
      </div>
    </section>
  `;
}

function renderFilterBar() {
  const filters: Array<{ id: FilterMode; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'delivery', label: 'Entrega' },
    { id: 'pickup', label: 'Retirada' },
    { id: 'paid', label: 'Pagos' },
    { id: 'pending_payment', label: 'Pendentes' },
    { id: 'late', label: 'Atrasados' },
    { id: 'unprinted', label: 'Nao impressos' },
    { id: 'ready', label: 'Prontos' },
  ];

  return `
    <div class="filter-bar">
      ${filters
        .map(
          (filter) => `
            <button class="${activeFilter === filter.id ? 'primary' : 'ghost'} small" data-action="filter" data-filter="${filter.id}">
              ${escapeHtml(filter.label)}
            </button>`,
        )
        .join('')}
    </div>
  `;
}

function renderQueueView(currentState: DesktopAppState) {
  const groups = groupedOrders(currentState);

  return `
    ${renderOperationalStrip(currentState)}
    <section class="hero stack">
      <div class="eyebrow">Fila inteligente</div>
      <h2>Visao completa do fluxo do dia.</h2>
      <p class="muted">Pedidos ativos agrupados por etapa, mais antigos primeiro e atrasos em destaque visual.</p>
      ${currentState.lastError ? `<p class="error">${escapeHtml(currentState.lastError)}</p>` : ''}
    </section>
    ${renderFilterBar()}
    <section class="queue-board">
      ${renderQueueColumn('Novos', groups.pending, currentState)}
      ${renderQueueColumn('Confirmados', groups.confirmed, currentState)}
      ${renderQueueColumn('Em preparo', groups.preparing, currentState)}
      ${renderQueueColumn('Prontos', groups.ready, currentState)}
    </section>
    <section class="panel stack" style="margin-top: 18px;">
      <div>
        <div class="eyebrow">Finalizados / cancelados</div>
        <h3>Historico curto</h3>
      </div>
      <div class="order-list">
        ${
          groups.archived.length === 0
            ? '<div class="empty-state"><strong>Historico limpo</strong><p class="muted">Pedidos finalizados ou cancelados recentes aparecerao aqui.</p></div>'
            : groups.archived.slice(0, 10).map((order) => renderOrderCard(order, currentState)).join('')
        }
      </div>
    </section>
  `;
}

function renderKitchenItems(order: OrderDetail) {
  return order.items
    .map(
      (item) => `
        <article class="kitchen-item">
          <div class="row-between">
            <strong>${item.quantity}x ${escapeHtml(item.product_name)}</strong>
            <span>${formatCurrency(item.subtotal)}</span>
          </div>
          ${
            item.options.length > 0
              ? `<div class="muted small">${item.options
                  .map((option) => `${option.option_name}: ${option.option_item_name}`)
                  .map(escapeHtml)
                  .join(' • ')}</div>`
              : ''
          }
          ${
            item.addons.length > 0
              ? `<div class="muted small">${item.addons
                  .map((addon) => `+ ${addon.name} x${addon.quantity}`)
                  .map(escapeHtml)
                  .join(' • ')}</div>`
              : ''
          }
          ${
            item.notes
              ? `<div class="order-note strong-note">Item: ${escapeHtml(item.notes)}</div>`
              : ''
          }
        </article>`
    )
    .join('');
}

function renderKitchenView(currentState: DesktopAppState) {
  const orders = currentState.currentOrders
    .filter((order) => !['delivered', 'cancelled'].includes(order.status))
    .filter((order) => filterOrder(order, currentState))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  const cards =
    orders.length === 0
      ? '<div class="empty-state empty-kds"><strong>Cozinha sem fila agora</strong><p class="muted">Quando um pedido entrar em producao, ele aparecera neste painel.</p></div>'
      : orders
          .map((order) => {
            const severity = lateLevel(order, currentState.settings);
            return `
              <article class="kitchen-card ${severity !== 'normal' ? `late-${severity}` : ''}">
                <div class="kitchen-top">
                  <div class="kitchen-number">#${escapeHtml(order.orderNumber)}</div>
                  <div class="stack tight align-end">
                    ${statusBadge(order.status)}
                    ${paymentBadge(order.paymentStatus)}
                    <span class="timer ${severity}">${formatSince(order.createdAt)}</span>
                  </div>
                </div>
                <div class="row-between">
                  <strong>${escapeHtml(order.customerName)}</strong>
                  <span class="muted">${escapeHtml(order.fulfillmentType === 'delivery' ? 'Entrega' : 'Retirada')}</span>
                </div>
                <div class="kitchen-items">
                  ${renderKitchenItems(order)}
                </div>
                ${
                  order.notes
                    ? `<div class="order-note kitchen-note"><strong>OBS GERAL:</strong> ${escapeHtml(order.notes)}</div>`
                    : ''
                }
                <div class="actions wrap">
                  ${STATUS_ACTIONS[order.status]
                    .map(
                      (nextStatus) => `
                        <button class="secondary" data-action="update-status" data-order-id="${escapeHtml(order.id)}" data-status="${nextStatus}">
                          ${escapeHtml(orderActionLabel(order, nextStatus))}
                        </button>`,
                    )
                    .join('')}
                  <button class="ghost" data-action="reprint-order" data-order-id="${escapeHtml(order.id)}" data-selection="kitchen">
                    Reimprimir cozinha
                  </button>
                </div>
              </article>
            `;
          })
          .join('');

  return `
    ${renderOperationalStrip(currentState)}
    <section class="hero stack">
      <div class="eyebrow">Modo cozinha / KDS</div>
      <div class="row-between">
        <div>
          <h2>Painel de producao em tela grande.</h2>
          <p class="muted">Cards grandes, cronometro de pedido, observacoes em destaque e status direto pelo desktop.</p>
        </div>
        <div class="actions">
          <button class="secondary" data-action="toggle-fullscreen">${isKitchenFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button>
        </div>
      </div>
    </section>
    ${renderFilterBar()}
    <section class="kitchen-grid">
      ${cards}
    </section>
  `;
}

function renderPrinterCard(currentState: DesktopAppState, lane: PrinterLane, config: PrinterTargetConfig) {
  const selectedUsbValue = usbValue(config.usbVendorId, config.usbProductId);
  const printerMeta = printerHealthMeta(lane, currentState.printerHealth[lane]);
  const latestLaneJob = currentState.recentPrintJobs.find((job) =>
    lane === 'client' ? Boolean(job.customerPrintedAt || job.lastFailureAt) : Boolean(job.kitchenPrintedAt || job.lastFailureAt),
  );
  const latestLaneSuccessAt =
    lane === 'client' ? latestLaneJob?.customerPrintedAt ?? latestLaneJob?.lastSuccessAt : latestLaneJob?.kitchenPrintedAt ?? latestLaneJob?.lastSuccessAt;
  const latestLaneError = latestLaneJob?.lastError;
  return `
    <section class="panel printer-card">
      <div>
        <div class="eyebrow">${lane === 'client' ? 'Via cliente' : 'Via cozinha'}</div>
        <h3>${lane === 'client' ? 'Impressora do cliente' : 'Impressora da cozinha'}</h3>
      </div>
      <div class="stack compact">
        <span class="badge ${printerMeta.tone === 'success' ? 'success' : printerMeta.tone === 'error' ? 'danger' : 'neutral'}">${escapeHtml(printerMeta.label)}</span>
        <p class="muted small">${escapeHtml(printerMeta.tooltip)}</p>
        <p class="muted small">${
          latestLaneSuccessAt
            ? `Ultima impressao bem-sucedida: ${escapeHtml(formatDateTime(latestLaneSuccessAt))}`
            : 'Nenhuma impressao bem-sucedida registrada nesta via.'
        }</p>
        ${
          latestLaneError
            ? `<p class="muted small">Ultima falha: ${escapeHtml(latestLaneError)}</p>`
            : ''
        }
      </div>
      <div class="field">
        <label>Driver</label>
        <select data-setting="printer-driver" data-lane="${lane}">
          <option value="system" ${config.driver === 'system' ? 'selected' : ''}>Windows printer</option>
          <option value="qz" ${config.driver === 'qz' ? 'selected' : ''}>QZ Tray RAW</option>
          <option value="network" ${config.driver === 'network' ? 'selected' : ''}>ESC/POS network</option>
          <option value="usb" ${config.driver === 'usb' ? 'selected' : ''}>ESC/POS USB</option>
        </select>
      </div>
      <div class="grid two">
        <div class="field">
          <label>Largura</label>
          <select data-setting="printer-width" data-lane="${lane}">
            <option value="58" ${config.paperWidth === 58 ? 'selected' : ''}>58 mm</option>
            <option value="80" ${config.paperWidth === 80 ? 'selected' : ''}>80 mm</option>
          </select>
        </div>
        <div class="field">
          <label>Copias</label>
          <input value="${escapeHtml(String(config.copies))}" data-setting="printer-copies" data-lane="${lane}" type="number" min="1" max="5" />
        </div>
      </div>
      ${
        config.driver === 'system'
          ? `<div class="field">
               <label>Impressora do Windows</label>
               <select data-setting="printer-system" data-lane="${lane}">
                 <option value="">Selecione</option>
                 ${optionMarkup(config.systemName)}
               </select>
             </div>`
          : ''
      }
      ${
        config.driver === 'qz'
          ? `<div class="field">
               <label>Impressora QZ Tray</label>
               <select data-setting="printer-system" data-lane="${lane}">
                 <option value="">Selecione</option>
                 ${qzOptionMarkup(config.systemName)}
               </select>
               <p class="muted small">${escapeHtml(qzStatusLabel(qzStatus))}</p>
               <p class="muted small">${escapeHtml(qzStatusInstruction(qzStatus))}</p>
             </div>`
          : ''
      }
      ${
        config.driver === 'network'
          ? `<div class="grid two">
               <div class="field">
                 <label>Host / IP</label>
                 <input value="${escapeHtml(config.host ?? '')}" data-setting="printer-host" data-lane="${lane}" placeholder="192.168.0.50" />
               </div>
               <div class="field">
                 <label>Porta</label>
                 <input value="${escapeHtml(String(config.port ?? 9100))}" data-setting="printer-port" data-lane="${lane}" placeholder="9100" />
               </div>
             </div>`
          : ''
      }
      ${
        config.driver === 'usb'
          ? `<div class="stack compact">
               <div class="field">
                 <label>Dispositivo USB</label>
                 <select data-setting="printer-usb" data-lane="${lane}">
                   <option value="">Selecione</option>
                   ${usbOptionMarkup(config)}
                 </select>
               </div>
               <div class="grid two">
                 <div class="field">
                   <label>Vendor ID</label>
                   <input value="${escapeHtml(config.usbVendorId !== null ? String(config.usbVendorId) : '')}" data-setting="printer-usb-vendor" data-lane="${lane}" placeholder="8137" />
                 </div>
                 <div class="field">
                   <label>Product ID</label>
                   <input value="${escapeHtml(config.usbProductId !== null ? String(config.usbProductId) : '')}" data-setting="printer-usb-product" data-lane="${lane}" placeholder="8211" />
                 </div>
               </div>
               <p class="muted small">Atual: ${selectedUsbValue ? escapeHtml(selectedUsbValue) : 'nao selecionado'}</p>
             </div>`
          : ''
      }
      <div class="field">
        <label>Impressora backup do Windows (opcional)</label>
        <select data-setting="printer-backup-system" data-lane="${lane}">
          <option value="">Sem backup</option>
          ${optionMarkup(config.backupSystemName)}
        </select>
      </div>
      <div class="actions wrap">
        <button class="secondary small" data-action="test-print" data-lane="${lane}">Testar impressora</button>
      </div>
    </section>
  `;
}

function renderSettingsView(currentState: DesktopAppState) {
  const draft = ensureSettingsDraft(currentState);
  const logoPreview = draft.receiptBranding.logoDataUrl;

  return `
    ${renderOperationalStrip(currentState)}
    <section class="hero stack">
      <div class="eyebrow">Configuracoes operacionais</div>
      <h2>Ajustes para caixa, cozinha, alertas e operacao continua.</h2>
      <p class="muted">As configuracoes desta estacao ficam persistidas localmente e valem apenas para este dispositivo.</p>
    </section>

    <section class="grid two">
      <section class="panel stack">
        <div>
          <div class="eyebrow">Operacao</div>
          <h3>Execucao do dia</h3>
        </div>
        <label class="toggle-row">
          <input type="checkbox" id="auto-print" ${draft.autoPrintEnabled ? 'checked' : ''} />
          <span>Ativar impressao automatica</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="auto-print-client" ${draft.autoPrintClient ? 'checked' : ''} />
          <span>Imprimir via cliente automaticamente</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="auto-print-kitchen" ${draft.autoPrintKitchen ? 'checked' : ''} />
          <span>Imprimir via cozinha automaticamente</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="receiving-paused" ${draft.receivingPaused ? 'checked' : ''} />
          <span>Pausar recebimento, alertas e auto print</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="sound-enabled" ${draft.soundEnabled ? 'checked' : ''} />
          <span>Tocar som em novo pedido</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="desktop-notifications" ${draft.desktopNotificationsEnabled ? 'checked' : ''} />
          <span>Mostrar notificacoes do Windows</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="open-at-login" ${draft.openAtLogin ? 'checked' : ''} />
          <span>Abrir junto com o Windows</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="minimize-to-tray" ${draft.minimizeToTray ? 'checked' : ''} />
          <span>Minimizar para a bandeja</span>
        </label>
        <div class="field">
          <label data-sound-volume-label>Volume do alerta (${draft.soundVolume}%)</label>
          <input id="sound-volume" type="range" min="0" max="100" value="${draft.soundVolume}" />
        </div>
        <div class="grid two">
          <div class="field">
            <label>Alerta amarelo (min)</label>
            <input id="late-warning" type="number" min="5" value="${draft.lateWarningMinutes}" />
          </div>
          <div class="field">
            <label>Alerta vermelho (min)</label>
            <input id="late-danger" type="number" min="6" value="${draft.lateDangerMinutes}" />
          </div>
        </div>
        <div class="field">
          <label>Modo de escuta</label>
          <select id="listen-mode">
            <option value="realtime_fallback" ${draft.listenMode === 'realtime_fallback' ? 'selected' : ''}>Realtime + polling fallback</option>
            <option value="polling_only" ${draft.listenMode === 'polling_only' ? 'selected' : ''}>Polling only</option>
          </select>
        </div>
        <div class="field">
          <label>Intervalo de polling (ms)</label>
          <input id="poll-interval" type="number" value="${draft.pollingIntervalMs}" min="3000" step="1000" />
        </div>
        <div class="actions wrap">
          <button class="secondary" data-action="test-sound">Testar som</button>
          <button class="secondary" data-action="test-print-complete">Testar impressao completa</button>
          <button class="primary" data-action="save-settings">Salvar configuracoes</button>
        </div>
      </section>

      <section class="panel stack">
        <div>
          <div class="eyebrow">Identidade da nota</div>
          <h3>Marca no topo da impressao</h3>
          <p class="muted">O logo aparece na impressao Windows e tambem e enviado para ESC/POS quando a impressora aceitar imagem termica.</p>
        </div>
        <div class="receipt-branding-card">
          ${
            logoPreview
              ? `<div class="receipt-logo-preview-wrap">
                   <img class="receipt-logo-preview" src="${logoPreview}" alt="Preview do logo da nota" />
                 </div>`
              : `<div class="receipt-logo-empty">
                   <strong>Nenhum logo configurado</strong>
                   <p class="muted">Envie um PNG ou JPG. O app reduz e prepara a imagem para a largura da nota.</p>
                 </div>`
          }
          <div class="actions wrap">
            <label class="button-like secondary" for="receipt-logo-input">Escolher logo</label>
            <input id="receipt-logo-input" type="file" accept="image/png,image/jpeg,image/jpg" hidden />
            ${
              logoPreview
                ? '<button class="ghost" type="button" data-action="remove-receipt-logo">Remover logo</button>'
                : ''
            }
          </div>
          <p class="muted small">Dica: prefira um logo escuro em fundo claro para sair melhor na impressora termica.</p>
        </div>
      </section>

      <section class="panel stack">
        <div>
          <div class="eyebrow">Diagnostico de impressao</div>
          <h3>Evidencia objetiva do teste</h3>
          <p class="muted">Use esta area para listar impressoras, testar envio real, gerar previa sem hardware e abrir o arquivo de logs.</p>
        </div>
        <div class="notice ${qzStatus.connected ? 'success' : 'warning'}">
          <strong>${escapeHtml(qzStatusLabel(qzStatus))}</strong>
          <span>${escapeHtml(qzStatusInstruction(qzStatus))}</span>
        </div>
        <div class="actions wrap">
          <button class="secondary" data-action="diagnostic-test-qz-connection">Testar conexao QZ</button>
          <button class="secondary" data-action="diagnostic-open-qz-download">Baixar QZ Tray</button>
          <button class="secondary" data-action="diagnostic-list-printers">Listar impressoras</button>
          <button class="secondary" data-action="diagnostic-list-qz-printers">Listar QZ</button>
          <button class="secondary" data-action="diagnostic-test-qz-both">Testar com QZ</button>
          <button class="secondary" data-action="diagnostic-test-print" data-lane="client">Testar via cliente</button>
          <button class="secondary" data-action="diagnostic-test-print" data-lane="kitchen">Testar via cozinha</button>
          <button class="ghost" data-action="diagnostic-preview" data-lane="client">Gerar previa cliente</button>
          <button class="ghost" data-action="diagnostic-preview" data-lane="kitchen">Gerar previa cozinha</button>
          <button class="ghost" data-action="diagnostic-open-logs">Abrir logs</button>
        </div>
        <pre class="diagnostic-output">${escapeHtml(printDiagnosticOutput)}</pre>
      </section>

      <section class="panel stack">
        <div>
          <div class="eyebrow">Reimpressao</div>
          <h3>Acao manual por pedido</h3>
        </div>
        <div class="field">
          <label>ID do pedido</label>
          <input id="manual-order-id" placeholder="UUID do pedido" />
        </div>
        <div class="actions wrap">
          <button class="ghost" data-action="manual-reprint" data-selection="client">Reimprimir cliente</button>
          <button class="ghost" data-action="manual-reprint" data-selection="kitchen">Reimprimir cozinha</button>
          <button class="ghost" data-action="manual-reprint" data-selection="both">Reimprimir ambas</button>
          ${
            currentState.currentOrders[0]
              ? `<button class="ghost" data-action="reprint-latest-order" data-order-id="${escapeHtml(currentState.currentOrders[0].id)}">Reimprimir ultimo pedido</button>`
              : ''
          }
        </div>
        <div class="field">
          <label>Dispositivo</label>
          <p class="muted">Machine: ${escapeHtml(currentState.deviceInfo.machineName)}</p>
          <p class="muted">Device ID: ${escapeHtml(currentState.deviceInfo.deviceId)}</p>
        </div>
      </section>
    </section>

    <section class="grid two" style="margin-top: 18px;">
      ${renderPrinterCard(currentState, 'client', draft.printers.client)}
      ${renderPrinterCard(currentState, 'kitchen', draft.printers.kitchen)}
    </section>
  `;
}

function renderCatalogProductForm(product: CatalogProduct | null, data: CatalogData) {
  const isNew = !product;
  const activeCategories = data.categories.filter((category) => category.is_active !== false);
  const selectedAddonIds = new Set(product?.addonIds ?? []);
  return `
    <section class="panel stack">
      <div class="row-between">
        <div>
          <div class="eyebrow">${isNew ? 'Novo produto' : 'Editar produto'}</div>
          <h3>${escapeHtml(product?.name ?? 'Produto do cardapio')}</h3>
        </div>
        <button class="ghost" data-action="catalog-cancel-product">Fechar</button>
      </div>
      <div class="grid two">
        <div class="field">
          <label>Nome</label>
          <input id="catalog-product-name" value="${escapeHtml(product?.name ?? '')}" placeholder="Ex: Marmita especial" />
        </div>
        <div class="field">
          <label>Categoria</label>
          <select id="catalog-product-category">
            <option value="">Selecione</option>
            ${activeCategories
              .map(
                (category) =>
                  `<option value="${escapeHtml(category.id)}" ${product?.category_id === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <label>Preco</label>
          <input id="catalog-product-price" value="${escapeHtml(product ? String(product.price).replace('.', ',') : '')}" placeholder="29,90" />
        </div>
        <div class="field">
          <label>Preco promocional</label>
          <input id="catalog-product-promo-price" value="${escapeHtml(product?.promo_price ? String(product.promo_price).replace('.', ',') : '')}" placeholder="Opcional" />
        </div>
      </div>
      <div class="field">
        <label>Descricao</label>
        <textarea id="catalog-product-description" rows="3" placeholder="Descricao exibida no cardapio publico">${escapeHtml(product?.description ?? '')}</textarea>
      </div>
      <div class="field">
        <label>Imagem</label>
        <div class="image-picker-row">
          <input id="catalog-product-image" value="${escapeHtml(product?.image_url ?? '')}" placeholder="Escolha uma imagem ou cole uma URL" />
          <button class="secondary" data-action="catalog-pick-image" type="button">Buscar no computador</button>
        </div>
        <p class="muted small">Escolha JPG, PNG ou WEBP pelo Explorador do Windows. A URL sera preenchida automaticamente apos o upload.</p>
      </div>
      <label class="check-row switch-inline">
        <input id="catalog-product-available" type="checkbox" ${product?.is_available === false ? '' : 'checked'} />
        <span class="switch-control visual-only"><span></span></span>
        <span>Produto ativo no cardapio publico</span>
      </label>
      <div class="field">
        <label>Adicionais permitidos</label>
        <div class="check-grid">
          ${
            data.addons.length === 0
              ? '<p class="muted small">Nenhum adicional cadastrado.</p>'
              : data.addons
                  .map(
                    (addon) => `
                      <label class="check-row">
                        <input type="checkbox" data-catalog-addon-option="${escapeHtml(addon.id)}" ${selectedAddonIds.has(addon.id) ? 'checked' : ''} />
                        <span>${escapeHtml(addon.name)} (${formatCurrency(addon.price)})</span>
                      </label>
                    `,
                  )
                  .join('')
          }
        </div>
      </div>
      <div class="field">
        <label>Variacoes obrigatorias</label>
        <p class="muted small">Cada grupo salvo aqui sera obrigatorio no site com selecao unica (1/1). Use uma opcao por linha e, se quiser, acrescente preco com "|". Ex.: Grande|4,00</p>
        <div id="catalog-option-groups" class="option-group-list">
          ${
            product?.optionGroups.length
              ? product.optionGroups.map((group, index) => renderOptionGroupCard(group, index)).join('')
              : '<p class="muted small" data-empty-option-groups>Nenhum grupo obrigatorio cadastrado para este produto.</p>'
          }
        </div>
      </div>
      <div class="actions wrap">
        <button class="ghost" data-action="catalog-add-option-group" type="button">Adicionar grupo obrigatorio</button>
        <button class="primary" data-action="catalog-save-product" data-product-id="${escapeHtml(product?.id ?? '')}">Salvar produto</button>
        <button class="ghost" data-action="catalog-cancel-product">Cancelar</button>
      </div>
    </section>
  `;
}

function renderCatalogView(currentState: DesktopAppState) {
  const data = catalogData;
  if (catalogLoading && !data) {
    return `
      ${renderOperationalStrip(currentState)}
      <section class="hero stack">
        <div class="eyebrow">Cardapio</div>
        <h2>Carregando catalogo...</h2>
        <p class="muted">Buscando produtos, categorias e adicionais no Supabase.</p>
      </section>
    `;
  }

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];
  const addons = data?.addons ?? [];
  const activeProducts = products.filter((product) => product.is_available !== false).length;
  const editingProduct =
    catalogEditingProductId && catalogEditingProductId !== 'new'
      ? products.find((product) => product.id === catalogEditingProductId) ?? null
      : null;
  const editingCategory =
    catalogEditingCategoryId && catalogEditingCategoryId !== 'new'
      ? categories.find((category) => category.id === catalogEditingCategoryId) ?? null
      : null;
  const editingAddon =
    catalogEditingAddonId && catalogEditingAddonId !== 'new'
      ? addons.find((addon) => addon.id === catalogEditingAddonId) ?? null
      : null;

  return `
    ${renderOperationalStrip(currentState)}
    <section class="hero stack">
      <div class="eyebrow">Cardapio</div>
      <h2>Produtos, categorias e adicionais no desktop.</h2>
      <p class="muted">As alteracoes usam as mesmas tabelas do app mobile e aparecem no cardapio publico depois de salvar.</p>
      ${catalogError ? `<p class="error">${escapeHtml(catalogError)}</p>` : ''}
      <div class="actions wrap">
        <button class="primary" data-action="catalog-new-product">Novo produto</button>
        <button class="secondary" data-action="catalog-refresh">Atualizar cardapio</button>
      </div>
    </section>

    <section class="grid three">
      <div class="metric-card"><span>Total</span><strong>${products.length}</strong><small>produtos cadastrados</small></div>
      <div class="metric-card"><span>Ativos</span><strong>${activeProducts}</strong><small>visiveis no site</small></div>
      <div class="metric-card"><span>Estrutura</span><strong>${categories.length}</strong><small>categorias</small></div>
    </section>

    ${
      catalogEditingProductId
        ? renderCatalogProductForm(catalogEditingProductId === 'new' ? null : editingProduct, data ?? { products: [], categories: [], addons: [] })
        : ''
    }

    <section class="grid two">
      <section class="panel stack">
        <div class="row-between">
          <div>
            <div class="eyebrow">Categorias</div>
            <h3>Organizacao do cardapio</h3>
          </div>
          <button class="ghost" data-action="catalog-new-category">Nova</button>
        </div>
        ${
          catalogEditingCategoryId
            ? `<div class="inline-form">
                <input id="catalog-category-name" value="${escapeHtml(editingCategory?.name ?? '')}" placeholder="Nome da categoria" />
                <button class="primary small" data-action="catalog-save-category" data-category-id="${escapeHtml(editingCategory?.id ?? '')}">Salvar</button>
                <button class="ghost small" data-action="catalog-cancel-category">Cancelar</button>
              </div>`
            : ''
        }
        <div class="compact-list">
          ${
            categories.length === 0
              ? '<div class="empty-state"><strong>Nenhuma categoria</strong><p class="muted">Crie uma categoria antes de cadastrar produtos.</p></div>'
              : categories
                  .map(
                    (category) => `
                      <article class="compact-item">
                        <div>
                          <strong>${escapeHtml(category.name)}</strong>
                          <p class="muted small">${category.is_active === false ? 'Oculta' : 'Ativa'} • posicao ${category.position ?? 0}</p>
                        </div>
                        <div class="actions wrap">
                          <label class="switch-control" title="${category.is_active === false ? 'Ativar' : 'Ocultar'}">
                            <input type="checkbox" data-action="catalog-toggle-category" data-category-id="${escapeHtml(category.id)}" ${category.is_active === false ? '' : 'checked'} />
                            <span></span>
                          </label>
                          <button class="ghost small" data-action="catalog-edit-category" data-category-id="${escapeHtml(category.id)}">Editar</button>
                          <button class="ghost small danger-text" data-action="catalog-delete-category" data-category-id="${escapeHtml(category.id)}">Excluir</button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')
          }
        </div>
      </section>

      <section class="panel stack">
        <div class="row-between">
          <div>
            <div class="eyebrow">Adicionais</div>
            <h3>Extras dos produtos</h3>
          </div>
          <button class="ghost" data-action="catalog-new-addon">Novo</button>
        </div>
        ${
          catalogEditingAddonId
            ? `<div class="inline-form">
                <input id="catalog-addon-name" value="${escapeHtml(editingAddon?.name ?? '')}" placeholder="Nome do adicional" />
                <input id="catalog-addon-price" value="${escapeHtml(editingAddon ? String(editingAddon.price).replace('.', ',') : '')}" placeholder="Preco" />
                <button class="primary small" data-action="catalog-save-addon" data-addon-id="${escapeHtml(editingAddon?.id ?? '')}">Salvar</button>
                <button class="ghost small" data-action="catalog-cancel-addon">Cancelar</button>
              </div>`
            : ''
        }
        <div class="compact-list">
          ${
            addons.length === 0
              ? '<div class="empty-state"><strong>Nenhum adicional</strong><p class="muted">Cadastre extras como queijo, bacon ou bebida.</p></div>'
              : addons
                  .map(
                    (addon) => `
                      <article class="compact-item">
                        <div>
                          <strong>${escapeHtml(addon.name)}</strong>
                          <p class="muted small">${formatCurrency(addon.price)} • ${addon.is_available === false ? 'Oculto' : 'Ativo'}</p>
                        </div>
                        <div class="actions wrap">
                          <label class="switch-control" title="${addon.is_available === false ? 'Ativar' : 'Ocultar'}">
                            <input type="checkbox" data-action="catalog-toggle-addon" data-addon-id="${escapeHtml(addon.id)}" ${addon.is_available === false ? '' : 'checked'} />
                            <span></span>
                          </label>
                          <button class="ghost small" data-action="catalog-edit-addon" data-addon-id="${escapeHtml(addon.id)}">Editar</button>
                          <button class="ghost small danger-text" data-action="catalog-delete-addon" data-addon-id="${escapeHtml(addon.id)}">Excluir</button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')
          }
        </div>
      </section>
    </section>

    <section class="panel stack">
      <div class="row-between">
        <div>
          <div class="eyebrow">Produtos</div>
          <h3>Itens do cardapio</h3>
        </div>
        <button class="primary" data-action="catalog-new-product">Novo produto</button>
      </div>
      <div class="catalog-products">
        ${
          products.length === 0
            ? '<div class="empty-state"><strong>Nenhum produto cadastrado</strong><p class="muted">Crie o primeiro produto para aparecer no site e no mobile.</p></div>'
            : products
                .map(
                  (product) => `
                    <article class="catalog-product ${product.is_available === false ? 'muted-card' : ''}">
                      <div class="catalog-product-media">
                        ${
                          product.image_url
                            ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" />`
                            : '<div class="catalog-product-placeholder"></div>'
                        }
                      </div>
                      <div class="catalog-product-copy">
                        <div class="eyebrow">${escapeHtml(product.category?.name ?? 'Sem categoria')}</div>
                        <h3>${escapeHtml(product.name)}</h3>
                        ${product.description ? `<p class="muted small">${escapeHtml(product.description)}</p>` : ''}
                        <p><strong>${formatCurrency(product.promo_price ?? product.price)}</strong>${product.promo_price ? ` <span class="muted small">de ${formatCurrency(product.price)}</span>` : ''}</p>
                      </div>
                      <div class="catalog-product-actions">
                        <span class="badge ${product.is_available === false ? 'neutral' : 'success'}">${product.is_available === false ? 'Oculto' : 'Ativo'}</span>
                        <label class="switch-control" title="${product.is_available === false ? 'Ativar' : 'Ocultar'}">
                          <input type="checkbox" data-action="catalog-toggle-product" data-product-id="${escapeHtml(product.id)}" ${product.is_available === false ? '' : 'checked'} />
                          <span></span>
                        </label>
                        <div class="icon-actions">
                          <button class="icon-button" data-action="catalog-edit-product" data-product-id="${escapeHtml(product.id)}" title="Editar">&#9998;</button>
                          <button class="icon-button danger-text" data-action="catalog-archive-product" data-product-id="${escapeHtml(product.id)}" title="Arquivar">&#128465;</button>
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join('')
        }
      </div>
    </section>
  `;
}

function renderLogsView(currentState: DesktopAppState) {
  return `
    ${renderOperationalStrip(currentState)}
    <section class="hero stack">
      <div class="eyebrow">Logs operacionais</div>
      <h2>Diagnostico em tempo real da operacao.</h2>
      <p class="muted">Login, reconexao, pedido detectado, impressao, falhas, reimpressao, status e eventos da bandeja ficam visiveis aqui.</p>
    </section>

    <section class="panel stack">
      <div class="row-between">
        <div>
          <div class="eyebrow">Eventos recentes</div>
          <h3>Historico local</h3>
        </div>
        <button class="ghost" data-action="clear-logs">Limpar logs</button>
      </div>
      <div class="log-list">
        ${
          currentState.recentLogs.length === 0
            ? '<div class="empty-state"><strong>Nenhum log recente</strong><p class="muted">Os eventos operacionais desta estacao aparecerao aqui em tempo real.</p></div>'
            : currentState.recentLogs
                .map(
                  (entry) => `
                    <article class="log-entry">
                      <strong>[${entry.level.toUpperCase()}] ${escapeHtml(entry.message)}</strong>
                      <div class="muted">${new Date(entry.timestamp).toLocaleString('pt-BR')}</div>
                      ${
                        entry.context
                          ? `<pre>${escapeHtml(JSON.stringify(entry.context, null, 2))}</pre>`
                          : ''
                      }
                    </article>`,
                )
                .join('')
        }
      </div>
    </section>
  `;
}

function renderLogin(currentState: DesktopAppState) {
  app.innerHTML = `
    <div class="login-wrap">
      <section class="panel login-card stack">
        <div>
          <div class="eyebrow">Desktop operacional</div>
          <h2>Restaurante Desktop</h2>
          <p class="muted">Entre com a conta operacional do restaurante para acompanhar a fila, a cozinha e a impressao automatica em tempo real.</p>
          <p class="muted">Device ${escapeHtml(currentState.deviceInfo.machineName)} • ${escapeHtml(currentState.deviceInfo.deviceId.slice(0, 8))}</p>
          <p class="muted">Versao ${escapeHtml(currentState.appVersion)}</p>
        </div>
        ${currentState.lastError ? `<p class="error">${escapeHtml(currentState.lastError)}</p>` : ''}
        ${
          loginNotice
            ? `<p class="notice ${loginNotice.tone === 'success' ? 'success' : 'error'}">${escapeHtml(loginNotice.message)}</p>`
            : ''
        }
        <div class="field">
          <label>E-mail</label>
          <input id="email" type="email" placeholder="voce@restaurante.com" value="${escapeHtml(loginDraftEmail)}" />
        </div>
        <div class="field">
          <label>Senha</label>
          <div class="password-row">
            <input id="password" type="${loginPasswordVisible ? 'text' : 'password'}" placeholder="Digite sua senha" value="${escapeHtml(loginDraftPassword)}" />
            <button class="ghost small" id="toggle-password" type="button">${loginPasswordVisible ? 'Ocultar' : 'Mostrar'}</button>
          </div>
        </div>
        <div class="actions wrap">
          <button class="primary" id="login-button">Entrar</button>
          <button class="ghost" id="forgot-password-button" type="button">Esqueci minha senha</button>
        </div>
      </section>
    </div>
  `;

  const emailInput = document.querySelector<HTMLInputElement>('#email');
  const passwordInput = document.querySelector<HTMLInputElement>('#password');
  const button = document.querySelector<HTMLButtonElement>('#login-button');
  const togglePasswordButton = document.querySelector<HTMLButtonElement>('#toggle-password');
  const forgotPasswordButton = document.querySelector<HTMLButtonElement>('#forgot-password-button');

  emailInput?.addEventListener('input', () => {
    loginDraftEmail = emailInput.value;
  });

  passwordInput?.addEventListener('input', () => {
    loginDraftPassword = passwordInput.value;
  });

  togglePasswordButton?.addEventListener('click', () => {
    loginPasswordVisible = !loginPasswordVisible;
    render();
    document.querySelector<HTMLInputElement>('#password')?.focus();
  });

  const handleLoginSubmit = async () => {
    const email = (document.querySelector<HTMLInputElement>('#email')?.value ?? '').trim();
    const password = document.querySelector<HTMLInputElement>('#password')?.value ?? '';

    loginDraftEmail = email;
    loginDraftPassword = password;
    loginNotice = null;

    if (!email || !password) {
      state = {
        ...currentState,
        lastError: 'Informe e-mail e senha para continuar.',
      };
      render();
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Entrando...';
    }

    const authClient = await getRendererAuthClient();
    let attemptedPassword = password;
    let { data, error } = await authClient.auth.signInWithPassword({
      email: email.trim(),
      password: attemptedPassword,
    });

    if (
      (error || !data.session) &&
      isInvalidCredentialsError(error?.message) &&
      (attemptedPassword !== attemptedPassword.trim())
    ) {
      await window.desktopApp.logRendererEvent('info', 'Login com senha bruta falhou; tentando senha sem espacos nas bordas.', {
        emailDomain: email.split('@')[1] ?? null,
        ...getPasswordDiagnostics(attemptedPassword),
      });

      attemptedPassword = attemptedPassword.trim();
      ({ data, error } = await authClient.auth.signInWithPassword({
        email: email.trim(),
        password: attemptedPassword,
      }));
    }

    if (error || !data.session) {
      await window.desktopApp.logRendererEvent('warn', 'Falha de login no renderer.', {
        emailDomain: email.split('@')[1] ?? null,
        safeError: getSafeLoginErrorMessage(error?.message),
        rawError: error?.message ?? 'missing-session',
        sessionReturned: Boolean(data.session),
        ...getPasswordDiagnostics(password),
      });
      state = {
        ...currentState,
        lastError: getSafeLoginErrorMessage(error?.message),
      };
      render();
      return;
    }

    if (attemptedPassword !== password) {
      loginNotice = {
        tone: 'success',
        message: 'O desktop removeu espacos extras no inicio ou fim da senha e conseguiu autenticar.',
      };
    }

    const result = await window.desktopApp.completeLogin(
      data.session.access_token,
      data.session.refresh_token,
    );
    if (result.ok) {
      seenAlertOrderIds = new Set((result.state.currentOrders ?? []).map((order) => order.id));
      lateWarnedOrderIds = new Set();
      lateDangerOrderIds = new Set();
      loginDraftPassword = '';
      loginNotice = null;
    }
    state = result.state;
    render();
  };

  button?.addEventListener('click', async () => {
    await handleLoginSubmit();
  });

  emailInput?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await handleLoginSubmit();
    }
  });

  passwordInput?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await handleLoginSubmit();
    }
  });

  forgotPasswordButton?.addEventListener('click', async () => {
    const email = (document.querySelector<HTMLInputElement>('#email')?.value ?? '').trim().toLowerCase();
    loginDraftEmail = email;
    loginDraftPassword = document.querySelector<HTMLInputElement>('#password')?.value ?? '';
    loginNotice = null;

    if (!email) {
      loginNotice = {
        tone: 'error',
        message: 'Informe o e-mail da conta para solicitar a recuperacao.',
      };
      render();
      return;
    }

    forgotPasswordButton.disabled = true;
    forgotPasswordButton.textContent = 'Enviando...';
    const result = await window.desktopApp.requestPasswordReset(email);
    loginNotice = {
      tone: result.ok ? 'success' : 'error',
      message:
        result.message ??
        result.error ??
        'Nao foi possivel solicitar a recuperacao agora. Tente novamente em instantes.',
    };
    state = result.state ?? currentState;
    render();
  });
}

function renderDashboard(currentState: DesktopAppState) {
  let mainContent = '';
  if (activeView === 'kitchen') {
    mainContent = renderKitchenView(currentState);
  } else if (activeView === 'catalog') {
    mainContent = renderCatalogView(currentState);
  } else if (activeView === 'settings') {
    mainContent = renderSettingsView(currentState);
  } else if (activeView === 'logs') {
    mainContent = renderLogsView(currentState);
  } else {
    mainContent = renderQueueView(currentState);
  }

  app.innerHTML = `
    <div class="shell ${activeView === 'kitchen' && isKitchenFullscreen ? 'kds-fullscreen' : ''}">
      ${renderSidebar(currentState)}
      <main class="content">${mainContent}</main>
      ${renderToasts()}
    </div>
  `;

  bindDashboardEvents(currentState);
}

async function triggerStatusUpdate(orderId: string, nextStatus: OrderStatus) {
  const result = await window.desktopApp.updateOrderStatus(orderId, nextStatus);
  state = result.state ?? (await window.desktopApp.getState());
  if (result.ok && result.message) {
    pushToast('success', result.message);
  } else if (!result.ok && (result.error ?? result.message)) {
    pushToast('error', result.error ?? result.message ?? 'Não foi possível atualizar o status.');
  }
  syncSettingsDraft(state, !settingsDirty);
  render();
}

async function refreshCatalog(showLoader = true) {
  if (showLoader) {
    catalogLoading = true;
    catalogError = null;
    render();
  }

  try {
    catalogData = await window.desktopApp.fetchCatalog();
    catalogError = null;
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'Nao foi possivel carregar o cardapio.';
    pushToast('error', catalogError);
  } finally {
    catalogLoading = false;
  }
}

async function toggleKitchenFullscreen() {
  isKitchenFullscreen = !isKitchenFullscreen;
  state = await window.desktopApp.toggleFullscreen(isKitchenFullscreen);
  if (state) {
    syncSettingsDraft(state, !settingsDirty);
  }
  render();
}

async function runBusyAction<T>(
  key: string,
  button: HTMLButtonElement | null,
  busyLabel: string,
  action: () => Promise<T>,
) {
  if (busyActions.has(key)) {
    return null;
  }

  busyActions.add(key);
  const originalLabel = button?.textContent ?? '';
  if (button) {
    button.disabled = true;
    button.textContent = busyLabel;
  }

  try {
    return await action();
  } finally {
    busyActions.delete(key);
    if (button && button.isConnected) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function persistSettingsDraftForPrint(currentState: DesktopAppState) {
  const latestSettings = collectSettings(currentState.settings);
  const result = await window.desktopApp.saveSettings(latestSettings, { refreshOrders: false });
  state = result.state ?? (await window.desktopApp.getState());

  if (state) {
    syncSettingsDraft(state, true);
  }

  if (!result.ok) {
    pushToast('error', result.error ?? result.message ?? 'Nao foi possivel salvar as configuracoes da impressora.');
    return null;
  }

  return {
    settings: state?.settings ?? latestSettings,
    receiptBranding: (state?.settings ?? latestSettings).receiptBranding,
  };
}

function updateSoundVolumeLabel() {
  const label = document.querySelector<HTMLElement>('[data-sound-volume-label]');
  const draft = settingsDraft;
  if (label && draft) {
    label.textContent = `Volume do alerta (${draft.soundVolume}%)`;
  }
}

function isCatalogDraftOpen() {
  return (
    activeView === 'catalog' &&
    Boolean(catalogEditingProductId || catalogEditingCategoryId || catalogEditingAddonId)
  );
}

function shouldDeferAutomaticRender() {
  if (isCatalogDraftOpen()) {
    return true;
  }

  if (activeView !== 'settings') {
    return false;
  }

  const activeElement = document.activeElement as HTMLElement | null;
  if (!activeElement) {
    return false;
  }

  return (
    (activeElement.tagName === 'SELECT' || activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
    Boolean(activeElement.closest('.printer-card, .panel'))
  );
}

function updateSettingsDraftFromElement(element: HTMLInputElement | HTMLSelectElement) {
  if (!state) {
    return;
  }

  const draft = ensureSettingsDraft(state);
  settingsDirty = true;

  switch (element.id) {
    case 'auto-print':
      draft.autoPrintEnabled = (element as HTMLInputElement).checked;
      return;
    case 'auto-print-client':
      draft.autoPrintClient = (element as HTMLInputElement).checked;
      return;
    case 'auto-print-kitchen':
      draft.autoPrintKitchen = (element as HTMLInputElement).checked;
      return;
    case 'receiving-paused':
      draft.receivingPaused = (element as HTMLInputElement).checked;
      return;
    case 'sound-enabled':
      draft.soundEnabled = (element as HTMLInputElement).checked;
      return;
    case 'desktop-notifications':
      draft.desktopNotificationsEnabled = (element as HTMLInputElement).checked;
      return;
    case 'open-at-login':
      draft.openAtLogin = (element as HTMLInputElement).checked;
      return;
    case 'minimize-to-tray':
      draft.minimizeToTray = (element as HTMLInputElement).checked;
      return;
    case 'sound-volume':
      draft.soundVolume = Math.max(0, Math.min(100, Number((element as HTMLInputElement).value) || 0));
      updateSoundVolumeLabel();
      return;
    case 'late-warning':
      draft.lateWarningMinutes = Math.max(5, Number((element as HTMLInputElement).value) || 5);
      draft.lateDangerMinutes = Math.max(draft.lateWarningMinutes + 1, draft.lateDangerMinutes);
      return;
    case 'late-danger':
      draft.lateDangerMinutes = Math.max(
        draft.lateWarningMinutes + 1,
        Number((element as HTMLInputElement).value) || draft.lateWarningMinutes + 1,
      );
      return;
    case 'listen-mode':
      draft.listenMode = element.value === 'polling_only' ? 'polling_only' : 'realtime_fallback';
      return;
    case 'poll-interval':
      draft.pollingIntervalMs = Math.max(3000, Number((element as HTMLInputElement).value) || 3000);
      return;
    case 'receipt-logo-input':
      return;
    default:
      break;
  }

  const lane = element.dataset.lane as PrinterLane | undefined;
  const setting = element.dataset.setting;
  if (!lane || !setting) {
    return;
  }

  const printerDraft = draft.printers[lane];

  if (setting === 'printer-driver') {
    printerDraft.driver = (element as HTMLSelectElement).value as PrinterTargetConfig['driver'];
    render();
    return;
  }

  if (setting === 'printer-width') {
    printerDraft.paperWidth = Number((element as HTMLSelectElement).value) === 58 ? 58 : 80;
    return;
  }

  if (setting === 'printer-copies') {
    printerDraft.copies = Math.max(1, Math.min(5, Number((element as HTMLInputElement).value) || 1));
    return;
  }

  if (setting === 'printer-system') {
    printerDraft.systemName = (element as HTMLSelectElement).value || null;
    return;
  }

  if (setting === 'printer-backup-system') {
    printerDraft.backupSystemName = (element as HTMLSelectElement).value || null;
    return;
  }

  if (setting === 'printer-host') {
    printerDraft.host = (element as HTMLInputElement).value.trim() || null;
    return;
  }

  if (setting === 'printer-port') {
    printerDraft.port = Number((element as HTMLInputElement).value.trim()) || 9100;
    return;
  }

  if (setting === 'printer-usb') {
    const [vendorIdText, productIdText] = ((element as HTMLSelectElement).value || '').split(':');
    const vendorId = Number(vendorIdText);
    const productId = Number(productIdText);
    printerDraft.usbVendorId = Number.isFinite(vendorId) ? vendorId : null;
    printerDraft.usbProductId = Number.isFinite(productId) ? productId : null;
    return;
  }

  if (setting === 'printer-usb-vendor') {
    const vendorId = Number((element as HTMLInputElement).value.trim());
    printerDraft.usbVendorId = Number.isFinite(vendorId) ? vendorId : null;
    return;
  }

  if (setting === 'printer-usb-product') {
    const productId = Number((element as HTMLInputElement).value.trim());
    printerDraft.usbProductId = Number.isFinite(productId) ? productId : null;
  }
}

function bindDashboardEvents(currentState: DesktopAppState) {
  document.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    state = await window.desktopApp.logout();
    if (state) {
      syncSettingsDraft(state, true);
    }
    seenAlertOrderIds.clear();
    lateWarnedOrderIds.clear();
    lateDangerOrderIds.clear();
    render();
  });

  document.querySelectorAll<HTMLElement>('[data-action="switch-view"]').forEach((button) => {
    button.addEventListener('click', async () => {
      activeView = button.dataset.view as ViewMode;
      if (activeView === 'catalog' && !catalogData && !catalogLoading) {
        await refreshCatalog(true);
      }
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="filter"]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter as FilterMode;
      render();
    });
  });

  document.querySelector('[data-action="refresh-orders"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('refresh-orders', button, 'Atualizando...', async () => {
      isRefreshingOrders = true;
      render();
      state = await window.desktopApp.refreshOrders();
      if (state) {
        syncSettingsDraft(state);
        pushToast(state.isUsingOfflineCache ? 'warning' : 'success', state.isUsingOfflineCache ? UI_MESSAGES.queueRefreshOfflineCache : UI_MESSAGES.queueRefreshSuccess);
      }
      isRefreshingOrders = false;
      render();
    });
  });

  document.querySelector('[data-action="refresh-printers"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('refresh-printers', button, 'Atualizando...', async () => {
      const [nextPrinters, nextUsbPrinters, nextQzPrinters] = await Promise.all([
        window.desktopApp.listPrinters(),
        window.desktopApp.listUsbPrinters(),
        window.desktopApp.listQzPrinters(),
      ]);
      printerOptions = nextPrinters;
      usbPrinterOptions = nextUsbPrinters;
      qzStatus = nextQzPrinters.status;
      qzPrinterOptions = nextQzPrinters.printers;
      pushToast('success', UI_MESSAGES.printersRefreshed);
      render();
    });
  });

  document.querySelector('[data-action="diagnostic-list-printers"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('diagnostic-list-printers', button, 'Listando...', async () => {
      await window.desktopApp.logRendererEvent('info', '[PRINT][UI] diagnostic-list-printers-clicked');
      printerOptions = await window.desktopApp.listPrinters();
      setPrintDiagnosticOutput('Impressoras do Windows encontradas', {
        count: printerOptions.length,
        printers: printerOptions,
      });
      pushToast('success', `Encontradas ${printerOptions.length} impressoras do Windows.`);
      render();
    });
  });

  document.querySelector('[data-action="diagnostic-test-qz-connection"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('diagnostic-test-qz-connection', button, 'Testando...', async () => {
      await window.desktopApp.logRendererEvent('info', '[QZ] diagnostic-test-connection-clicked');
      qzStatus = await window.desktopApp.testQzConnection();
      setPrintDiagnosticOutput('Teste de conexao QZ Tray', {
        status: qzStatus,
        message: qzStatus.connected
          ? 'QZ Tray conectado e pronto.'
          : qzStatus.error ?? 'Para imprimir automaticamente, instale e abra o QZ Tray.',
      });
      pushToast(
        qzStatus.connected ? 'success' : 'error',
        qzStatus.connected ? qzStatusLabel(qzStatus) : qzStatusInstruction(qzStatus),
      );
      render();
    });
  });

  document.querySelector('[data-action="diagnostic-open-qz-download"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('diagnostic-open-qz-download', button, 'Abrindo...', async () => {
      await window.desktopApp.logRendererEvent('info', '[QZ] diagnostic-open-download-clicked');
      await window.desktopApp.openQzDownload();
      setPrintDiagnosticOutput('Download QZ Tray', {
        ok: true,
        url: 'https://qz.io/download/',
      });
      pushToast('info', 'Pagina de download do QZ Tray aberta.');
      render();
    });
  });

  document.querySelector('[data-action="diagnostic-list-qz-printers"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('diagnostic-list-qz-printers', button, 'Listando...', async () => {
      await window.desktopApp.logRendererEvent('info', '[QZ] diagnostic-list-printers-clicked');
      const result = await window.desktopApp.listQzPrinters();
      qzStatus = result.status;
      qzPrinterOptions = result.printers;
      setPrintDiagnosticOutput('Impressoras QZ Tray encontradas', {
        status: qzStatus,
        count: qzPrinterOptions.length,
        printers: qzPrinterOptions,
      });
      pushToast(
        qzStatus.connected ? 'success' : 'error',
        qzStatus.connected
          ? `QZ Tray encontrou ${qzPrinterOptions.length} impressoras.`
          : qzStatus.error ?? 'QZ Tray nao esta rodando. Abra o QZ Tray para imprimir.',
      );
      render();
    });
  });

  document.querySelector('[data-action="toggle-receiving"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const nextSettings = {
      ...currentState.settings,
      receivingPaused: !currentState.settings.receivingPaused,
    };
    await runBusyAction('toggle-receiving', button, nextSettings.receivingPaused ? 'Pausando...' : 'Retomando...', async () => {
      const result = await window.desktopApp.saveSettings(nextSettings);
      state = result.state ?? (await window.desktopApp.getState());
      if (state) {
        syncSettingsDraft(state, true);
      }
      pushToast(
        result.ok ? 'success' : 'error',
        result.message ?? result.error ?? (nextSettings.receivingPaused ? UI_MESSAGES.receivingPausedSuccess : UI_MESSAGES.receivingResumedSuccess),
      );
      render();
    });
  });

  const settingsRoot = document.querySelector('.content');
  if (activeView === 'settings') {
    settingsRoot?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((element) => {
      element.addEventListener('input', () => {
        updateSettingsDraftFromElement(element);
      });
      element.addEventListener('change', () => {
        updateSettingsDraftFromElement(element);
      });
      element.addEventListener('blur', () => {
        if (state) {
          render();
        }
      });
    });
  }

  document.querySelector<HTMLInputElement>('#receipt-logo-input')?.addEventListener('change', async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !state) {
      return;
    }

    await runBusyAction('receipt-logo-upload', null, '', async () => {
      try {
        const logoDataUrl = await prepareReceiptLogoDataUrl(file);
        const draft = ensureSettingsDraft(state as DesktopAppState);
        draft.receiptBranding.logoDataUrl = logoDataUrl;
        settingsDirty = true;
        pushToast('success', 'Logo preparado e pronto para salvar nas configuracoes.');
        render();
      } catch (error) {
        pushToast('error', error instanceof Error ? error.message : 'Falha ao processar o logo.');
      } finally {
        input.value = '';
      }
    });
  });

  document.querySelector('[data-action="remove-receipt-logo"]')?.addEventListener('click', () => {
    if (!state) {
      return;
    }
    const draft = ensureSettingsDraft(state);
    draft.receiptBranding.logoDataUrl = null;
    settingsDirty = true;
    pushToast('info', 'Logo removido do rascunho. Salve as configuracoes para aplicar.');
    render();
  });

  document.querySelector('[data-action="save-settings"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('save-settings', button, 'Salvando...', async () => {
      const result = await window.desktopApp.saveSettings(collectSettings(currentState.settings));
      state = result.state ?? (await window.desktopApp.getState());
      if (state) {
        syncSettingsDraft(state, true);
      }
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? UI_MESSAGES.settingsSaved);
      render();
    });
  });

  document.querySelector('[data-action="test-sound"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('test-sound', button, 'Tocando...', async () => {
      await playAlertTone('new', true);
      pushToast('info', UI_MESSAGES.soundTested);
    });
  });

  document.querySelector('[data-action="test-print-complete"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('test-print-complete', button, 'Testando...', async () => {
      const persisted = await persistSettingsDraftForPrint(currentState);
      if (!persisted) {
        render();
        return;
      }

      const clientConfig = persisted.settings.printers.client;
      const kitchenConfig = persisted.settings.printers.kitchen;

      const clientResult = await window.desktopApp.printTestPage('client', clientConfig, persisted.receiptBranding);
      const kitchenResult = await window.desktopApp.printTestPage('kitchen', kitchenConfig, persisted.receiptBranding);

      state = kitchenResult.state ?? clientResult.state ?? (await window.desktopApp.getState());
      if (state) {
        syncSettingsDraft(state, !settingsDirty);
      }

      if (clientResult.ok && kitchenResult.ok) {
        pushToast('success', 'Teste completo enviado com sucesso para cliente e cozinha.');
      } else {
        pushToast(
          'error',
          `Teste completo com falhas. Cliente: ${clientResult.message ?? clientResult.error ?? 'ok'} | Cozinha: ${
            kitchenResult.message ?? kitchenResult.error ?? 'ok'
          }`,
        );
      }
      render();
    });
  });

  document.querySelector('[data-action="toggle-fullscreen"]')?.addEventListener('click', async () => {
    await toggleKitchenFullscreen();
  });

  document.querySelector('[data-action="clear-logs"]')?.addEventListener('click', async () => {
    state = await window.desktopApp.clearLogs();
    pushToast('info', UI_MESSAGES.logsCleared);
    render();
  });

  document.querySelector('[data-action="catalog-refresh"]')?.addEventListener('click', async () => {
    await refreshCatalog(true);
    pushToast('success', 'Cardapio atualizado.');
    render();
  });

  document.querySelectorAll<HTMLElement>('[data-action="catalog-new-product"]').forEach((button) => {
    button.addEventListener('click', () => {
      catalogEditingProductId = 'new';
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="catalog-edit-product"]').forEach((button) => {
    button.addEventListener('click', () => {
      catalogEditingProductId = button.dataset.productId ?? null;
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="catalog-cancel-product"]').forEach((button) => {
    button.addEventListener('click', () => {
      catalogEditingProductId = null;
      render();
    });
  });

  document.querySelector('[data-action="catalog-add-option-group"]')?.addEventListener('click', () => {
    const container = document.querySelector<HTMLElement>('#catalog-option-groups');
    if (!container) {
      return;
    }
    container.querySelector('[data-empty-option-groups]')?.remove();
    const index = container.querySelectorAll('[data-option-group]').length;
    container.insertAdjacentHTML('beforeend', renderOptionGroupCard(null, index));
    container
      .querySelector<HTMLElement>('[data-option-group]:last-child [data-action="catalog-remove-option-group"]')
      ?.addEventListener('click', (event) => {
        (event.currentTarget as HTMLElement).closest('[data-option-group]')?.remove();
      });
  });

  document.querySelectorAll<HTMLElement>('[data-action="catalog-remove-option-group"]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('[data-option-group]')?.remove();
    });
  });

  document.querySelector('[data-action="catalog-pick-image"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('catalog-pick-image', button, 'Enviando...', async () => {
      const result = await window.desktopApp.pickCatalogImage();
      if (result.ok && result.imageUrl) {
        const input = document.querySelector<HTMLInputElement>('#catalog-product-image');
        if (input) {
          input.value = result.imageUrl;
        }
      }
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel enviar a imagem.');
    });
  });

  document.querySelector('[data-action="catalog-save-product"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('catalog-save-product', button, 'Salvando...', async () => {
      const name = document.querySelector<HTMLInputElement>('#catalog-product-name')?.value.trim() ?? '';
      const categoryId = document.querySelector<HTMLSelectElement>('#catalog-product-category')?.value ?? '';
      const priceText = document.querySelector<HTMLInputElement>('#catalog-product-price')?.value ?? '';
      const promoText = document.querySelector<HTMLInputElement>('#catalog-product-promo-price')?.value ?? '';
      const description = document.querySelector<HTMLTextAreaElement>('#catalog-product-description')?.value.trim() ?? '';
      const imageUrl = document.querySelector<HTMLInputElement>('#catalog-product-image')?.value.trim() ?? '';
      const isAvailable = document.querySelector<HTMLInputElement>('#catalog-product-available')?.checked ?? true;
      const addonIds = Array.from(document.querySelectorAll<HTMLInputElement>('[data-catalog-addon-option]:checked')).map(
        (input) => input.dataset.catalogAddonOption ?? '',
      ).filter(Boolean);
      const optionGroups = parseOptionGroupsFromDom();
      const price = parseMoneyInput(priceText);
      const promoPrice = promoText.trim() ? parseMoneyInput(promoText) : null;

      if (!name || !categoryId || !Number.isFinite(price)) {
        pushToast('error', 'Preencha nome, categoria e preco valido.');
        return;
      }
      if (promoPrice !== null && !Number.isFinite(promoPrice)) {
        pushToast('error', 'Preco promocional invalido.');
        return;
      }

      const payload: CatalogProductSavePayload = {
        id: button.dataset.productId || undefined,
        category_id: categoryId,
        name,
        description,
        price,
        promo_price: promoPrice,
        image_url: imageUrl || null,
        is_available: isAvailable,
        addonIds,
        optionGroups,
      };

      const result = await window.desktopApp.saveCatalogProduct(payload);
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel salvar o produto.');
      if (result.ok) {
        catalogEditingProductId = null;
        await refreshCatalog(false);
      }
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="catalog-toggle-product"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const product = catalogData?.products.find((item) => item.id === button.dataset.productId);
      if (!product) return;
      const result = await window.desktopApp.saveCatalogProduct({
        id: product.id,
        category_id: product.category_id,
        name: product.name,
        description: product.description,
        price: product.price,
        promo_price: product.promo_price,
        image_url: product.image_url,
        is_available: product.is_available === false,
        addonIds: product.addonIds,
        optionGroups: product.optionGroups,
      });
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel atualizar o produto.');
      await refreshCatalog(false);
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="catalog-archive-product"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const productId = button.dataset.productId ?? '';
      if (!window.confirm('Arquivar este produto? Ele ficara oculto no cardapio, sem apagar o historico.')) {
        return;
      }
      const result = await window.desktopApp.archiveCatalogProduct(productId);
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel arquivar o produto.');
      await refreshCatalog(false);
      render();
    });
  });

  document.querySelector('[data-action="catalog-new-category"]')?.addEventListener('click', () => {
    catalogEditingCategoryId = 'new';
    render();
  });
  document.querySelectorAll<HTMLElement>('[data-action="catalog-edit-category"]').forEach((button) => {
    button.addEventListener('click', () => {
      catalogEditingCategoryId = button.dataset.categoryId ?? null;
      render();
    });
  });
  document.querySelector('[data-action="catalog-cancel-category"]')?.addEventListener('click', () => {
    catalogEditingCategoryId = null;
    render();
  });
  document.querySelector('[data-action="catalog-save-category"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const currentCategory = catalogData?.categories.find((category) => category.id === button.dataset.categoryId);
    const name = document.querySelector<HTMLInputElement>('#catalog-category-name')?.value.trim() ?? '';
    if (!name) {
      pushToast('error', 'Informe o nome da categoria.');
      return;
    }
    const result = await window.desktopApp.saveCatalogCategory({
      id: button.dataset.categoryId || undefined,
      name,
      position: currentCategory?.position ?? catalogData?.categories.length ?? 0,
      is_active: currentCategory?.is_active ?? true,
    });
    pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel salvar a categoria.');
    if (result.ok) catalogEditingCategoryId = null;
    await refreshCatalog(false);
    render();
  });
  document.querySelectorAll<HTMLElement>('[data-action="catalog-toggle-category"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const category = catalogData?.categories.find((item) => item.id === button.dataset.categoryId);
      if (!category) return;
      const result = await window.desktopApp.saveCatalogCategory({ ...category, is_active: category.is_active === false });
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel atualizar a categoria.');
      await refreshCatalog(false);
      render();
    });
  });
  document.querySelectorAll<HTMLElement>('[data-action="catalog-delete-category"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Excluir esta categoria? Produtos vinculados podem impedir a exclusao.')) {
        return;
      }
      const result = await window.desktopApp.deleteCatalogCategory(button.dataset.categoryId ?? '');
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel excluir a categoria.');
      await refreshCatalog(false);
      render();
    });
  });

  document.querySelector('[data-action="catalog-new-addon"]')?.addEventListener('click', () => {
    catalogEditingAddonId = 'new';
    render();
  });
  document.querySelectorAll<HTMLElement>('[data-action="catalog-edit-addon"]').forEach((button) => {
    button.addEventListener('click', () => {
      catalogEditingAddonId = button.dataset.addonId ?? null;
      render();
    });
  });
  document.querySelector('[data-action="catalog-cancel-addon"]')?.addEventListener('click', () => {
    catalogEditingAddonId = null;
    render();
  });
  document.querySelector('[data-action="catalog-save-addon"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const currentAddon = catalogData?.addons.find((addon) => addon.id === button.dataset.addonId);
    const name = document.querySelector<HTMLInputElement>('#catalog-addon-name')?.value.trim() ?? '';
    const price = parseMoneyInput(document.querySelector<HTMLInputElement>('#catalog-addon-price')?.value ?? '');
    if (!name || !Number.isFinite(price)) {
      pushToast('error', 'Preencha nome e preco valido do adicional.');
      return;
    }
    const result = await window.desktopApp.saveCatalogAddon({
      id: button.dataset.addonId || undefined,
      name,
      price,
      is_available: currentAddon?.is_available ?? true,
    });
    pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel salvar o adicional.');
    if (result.ok) catalogEditingAddonId = null;
    await refreshCatalog(false);
    render();
  });
  document.querySelectorAll<HTMLElement>('[data-action="catalog-toggle-addon"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const addon = catalogData?.addons.find((item) => item.id === button.dataset.addonId);
      if (!addon) return;
      const result = await window.desktopApp.saveCatalogAddon({ ...addon, is_available: addon.is_available === false });
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel atualizar o adicional.');
      await refreshCatalog(false);
      render();
    });
  });
  document.querySelectorAll<HTMLElement>('[data-action="catalog-delete-addon"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Excluir este adicional? Produtos vinculados podem ser afetados.')) {
        return;
      }
      const result = await window.desktopApp.deleteCatalogAddon(button.dataset.addonId ?? '');
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Nao foi possivel excluir o adicional.');
      await refreshCatalog(false);
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="test-print"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const lane = button.dataset.lane as PrinterLane;
      await runBusyAction(`test-print-${lane}`, button as HTMLButtonElement, 'Enviando...', async () => {
        const persisted = await persistSettingsDraftForPrint(currentState);
        if (!persisted) {
          render();
          return;
        }

        const testConfig = persisted.settings.printers[lane];
        const result = await window.desktopApp.printTestPage(lane, testConfig, persisted.receiptBranding);
        state = result.state ?? (await window.desktopApp.getState());
        if (state) {
          syncSettingsDraft(state, !settingsDirty);
        }
        pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao testar a impressora.');
        render();
      });
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="diagnostic-test-print"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const lane = button.dataset.lane as PrinterLane;
      await runBusyAction(`diagnostic-test-print-${lane}`, button as HTMLButtonElement, 'Testando...', async () => {
        await window.desktopApp.logRendererEvent('info', '[PRINT][UI] diagnostic-test-print-clicked', { lane });
        const persisted = await persistSettingsDraftForPrint(currentState);
        if (!persisted) {
          setPrintDiagnosticOutput(`Teste ${lane} nao iniciado`, {
            reason: 'Falha ao salvar configuracao antes do teste.',
          });
          render();
          return;
        }

        const testConfig = persisted.settings.printers[lane];
        const result = await window.desktopApp.printTestPage(lane, testConfig, persisted.receiptBranding);
        state = result.state ?? (await window.desktopApp.getState());
        if (state) {
          syncSettingsDraft(state, !settingsDirty);
        }
        setPrintDiagnosticOutput(`Resultado do teste de impressao: ${lane}`, {
          ok: result.ok,
          message: result.message ?? null,
          error: result.error ?? null,
          selectedPrinter: testConfig.systemName ?? testConfig.host ?? `${testConfig.usbVendorId}:${testConfig.usbProductId}`,
          config: testConfig,
          lastError: state?.lastError ?? null,
          printerHealth: state?.printerHealth[lane] ?? null,
        });
        pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao testar a impressora.');
        render();
      });
    });
  });

  document.querySelector('[data-action="diagnostic-test-qz-both"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('diagnostic-test-qz-both', button, 'Testando...', async () => {
      await window.desktopApp.logRendererEvent('info', '[QZ] diagnostic-test-both-clicked');
      const persisted = await persistSettingsDraftForPrint(currentState);
      if (!persisted) {
        setPrintDiagnosticOutput('Teste QZ nao iniciado', {
          reason: 'Falha ao salvar configuracao antes do teste QZ.',
        });
        render();
        return;
      }

      const result = await window.desktopApp.testQzBoth();
      state = result.state ?? (await window.desktopApp.getState());
      if (state) {
        syncSettingsDraft(state, !settingsDirty);
      }
      setPrintDiagnosticOutput('Resultado do teste QZ Tray', {
        ok: result.ok,
        message: result.message ?? null,
        error: result.error ?? null,
        qzStatus,
        clientConfig: persisted.settings.printers.client,
        kitchenConfig: persisted.settings.printers.kitchen,
        clientHealth: state?.printerHealth.client ?? null,
        kitchenHealth: state?.printerHealth.kitchen ?? null,
      });
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao testar com QZ Tray.');
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="diagnostic-preview"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const lane = button.dataset.lane as PrinterLane;
      await runBusyAction(`diagnostic-preview-${lane}`, button as HTMLButtonElement, 'Gerando...', async () => {
        await window.desktopApp.logRendererEvent('info', '[PRINT][UI] diagnostic-preview-clicked', { lane });
        const persisted = await persistSettingsDraftForPrint(currentState);
        if (!persisted) {
          setPrintDiagnosticOutput(`Previa ${lane} nao gerada`, {
            reason: 'Falha ao salvar configuracao antes da previa.',
          });
          render();
          return;
        }

        const config = persisted.settings.printers[lane];
        const result = await window.desktopApp.generatePrintPreview(lane, config, persisted.receiptBranding);
        state = result.state ?? (await window.desktopApp.getState());
        if (state) {
          syncSettingsDraft(state, !settingsDirty);
        }
        setPrintDiagnosticOutput(`Previa local: ${lane}`, {
          ok: result.ok,
          message: result.message ?? null,
          error: result.error ?? null,
          htmlPath: result.htmlPath ?? null,
          txtPath: result.txtPath ?? null,
          config,
        });
        pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao gerar previa.');
        render();
      });
    });
  });

  document.querySelector('[data-action="diagnostic-open-logs"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    await runBusyAction('diagnostic-open-logs', button, 'Abrindo...', async () => {
      await window.desktopApp.logRendererEvent('info', '[PRINT][UI] diagnostic-open-logs-clicked');
      const result = await window.desktopApp.openLogs();
      setPrintDiagnosticOutput('Abrir logs', {
        ok: result.ok,
        message: result.message ?? null,
        error: result.error ?? null,
      });
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao abrir logs.');
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="manual-reprint"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = (document.querySelector<HTMLInputElement>('#manual-order-id')?.value ?? '').trim();
      const selection = button.dataset.selection as PrintLaneSelection;
      await runBusyAction(`manual-reprint-${selection}`, button as HTMLButtonElement, 'Enviando...', async () => {
        if (activeView === 'settings') {
          const persisted = await persistSettingsDraftForPrint(currentState);
          if (!persisted) {
            render();
            return;
          }
        }

        const result = await window.desktopApp.reprintOrder(orderId, selection);
        state = result.state ?? (await window.desktopApp.getState());
        if (state) {
          syncSettingsDraft(state, !settingsDirty);
        }
        pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao reimprimir o pedido.');
        render();
      });
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="reprint-order"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.orderId ?? '';
      const selection = button.dataset.selection as PrintLaneSelection;
      await runBusyAction(`card-reprint-${orderId}-${selection}`, button as HTMLButtonElement, 'Enviando...', async () => {
        const result = await window.desktopApp.reprintOrder(orderId, selection);
        state = result.state ?? (await window.desktopApp.getState());
        if (state) {
          syncSettingsDraft(state, !settingsDirty);
        }
        pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao reimprimir o pedido.');
        render();
      });
    });
  });

  document.querySelector('[data-action="reprint-latest-order"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const orderId = button.dataset.orderId ?? '';
    await runBusyAction(`reprint-latest-${orderId}`, button, 'Enviando...', async () => {
      const persisted = await persistSettingsDraftForPrint(currentState);
      if (!persisted) {
        render();
        return;
      }

      const result = await window.desktopApp.reprintOrder(orderId, 'both');
      state = result.state ?? (await window.desktopApp.getState());
      if (state) {
        syncSettingsDraft(state, !settingsDirty);
      }
      pushToast(result.ok ? 'success' : 'error', result.message ?? result.error ?? 'Falha ao reimprimir o ultimo pedido.');
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="update-status"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.orderId ?? '';
      const nextStatus = button.dataset.status as OrderStatus;
      await runBusyAction(`update-status-${orderId}-${nextStatus}`, button as HTMLButtonElement, 'Atualizando...', async () => {
        await triggerStatusUpdate(orderId, nextStatus);
      });
    });
  });
}

function collectUsbFields(lane: PrinterLane) {
  const selectValue =
    (document.querySelector(`[data-setting="printer-usb"][data-lane="${lane}"]`) as HTMLSelectElement)?.value ?? '';
  const vendorInput =
    (document.querySelector(`[data-setting="printer-usb-vendor"][data-lane="${lane}"]`) as HTMLInputElement)?.value.trim() ?? '';
  const productInput =
    (document.querySelector(`[data-setting="printer-usb-product"][data-lane="${lane}"]`) as HTMLInputElement)?.value.trim() ?? '';

  if (selectValue.includes(':')) {
    const [vendorId, productId] = selectValue.split(':').map((value) => Number(value));
    return {
      usbVendorId: Number.isFinite(vendorId) ? vendorId : null,
      usbProductId: Number.isFinite(productId) ? productId : null,
    };
  }

  const usbVendorId = Number(vendorInput);
  const usbProductId = Number(productInput);

  return {
    usbVendorId: Number.isFinite(usbVendorId) ? usbVendorId : null,
    usbProductId: Number.isFinite(usbProductId) ? usbProductId : null,
  };
}

function collectPrinterConfig(settings: DesktopSettings, lane: PrinterLane): PrinterTargetConfig {
  const current = settings.printers[lane];
  const driver = (document.querySelector(`[data-setting="printer-driver"][data-lane="${lane}"]`) as HTMLSelectElement)
    ?.value as PrinterTargetConfig['driver'];
  const width = Number(
    (document.querySelector(`[data-setting="printer-width"][data-lane="${lane}"]`) as HTMLSelectElement)?.value ??
      current.paperWidth,
  ) as PrinterTargetConfig['paperWidth'];
  const copies = Number(
    (document.querySelector(`[data-setting="printer-copies"][data-lane="${lane}"]`) as HTMLInputElement)?.value ??
      String(current.copies),
  );
  const backupSystemName =
    (document.querySelector(`[data-setting="printer-backup-system"][data-lane="${lane}"]`) as HTMLSelectElement)?.value ||
    null;

  if (driver === 'network') {
    const host = (document.querySelector(`[data-setting="printer-host"][data-lane="${lane}"]`) as HTMLInputElement)?.value.trim() || null;
    const portText =
      (document.querySelector(`[data-setting="printer-port"][data-lane="${lane}"]`) as HTMLInputElement)?.value.trim() || '9100';
    return {
      ...current,
      driver,
      backupSystemName,
      systemName: null,
      host,
      port: Number(portText),
      usbVendorId: null,
      usbProductId: null,
      paperWidth: width,
      copies: Number.isFinite(copies) ? Math.max(1, Math.min(5, copies)) : 1,
    };
  }

  if (driver === 'usb') {
    const usbFields = collectUsbFields(lane);
    return {
      ...current,
      driver,
      backupSystemName,
      systemName: null,
      host: null,
      port: 9100,
      ...usbFields,
      paperWidth: width,
      copies: Number.isFinite(copies) ? Math.max(1, Math.min(5, copies)) : 1,
    };
  }

  const systemName =
    (document.querySelector(`[data-setting="printer-system"][data-lane="${lane}"]`) as HTMLSelectElement)?.value || null;

  return {
    ...current,
    driver,
    backupSystemName,
    systemName,
    host: null,
    port: 9100,
    usbVendorId: null,
    usbProductId: null,
    paperWidth: width,
    copies: Number.isFinite(copies) ? Math.max(1, Math.min(5, copies)) : 1,
  };
}

function collectSettings(settings: DesktopSettings): DesktopSettings {
  return cloneSettings(settingsDraft ?? settings);
}

function render() {
  if (!state) {
    return;
  }

  if (!state.isAuthenticated) {
    renderLogin(state);
    return;
  }

  renderDashboard(state);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function loadStartupPeripherals() {
  window.desktopApp
    .listPrinters()
    .then((nextPrinters) => {
      printerOptions = nextPrinters;
      render();
    })
    .catch(async (error: unknown) => {
      await window.desktopApp.logRendererEvent('warn', 'Falha ao carregar impressoras do sistema no bootstrap.', {
        error: getErrorMessage(error),
      });
    });

  window.desktopApp
    .listUsbPrinters()
    .then((nextUsbPrinters) => {
      usbPrinterOptions = nextUsbPrinters;
      render();
    })
    .catch(async (error: unknown) => {
      await window.desktopApp.logRendererEvent('warn', 'Falha ao carregar impressoras USB no bootstrap.', {
        error: getErrorMessage(error),
      });
    });

  window.desktopApp
    .listQzPrinters()
    .then((nextQzPrinters) => {
      qzStatus = nextQzPrinters.status;
      qzPrinterOptions = nextQzPrinters.printers;
      render();
    })
    .catch(async (error: unknown) => {
      qzStatus = {
        connected: false,
        running: false,
        installed: false,
        state: 'not_found',
        version: null,
        error: 'Para imprimir automaticamente, instale e abra o QZ Tray.',
      };
      qzPrinterOptions = [];
      await window.desktopApp.logRendererEvent('warn', 'Falha ao carregar impressoras QZ no bootstrap.', {
        error: getErrorMessage(error),
      });
      render();
    });
}

async function bootstrap() {
  try {
    const nextState = await window.desktopApp.getState();
    state = nextState;
    syncSettingsDraft(nextState, true);
    seenAlertOrderIds = new Set(nextState.currentOrders.map((order) => order.id));
    render();
    void loadStartupPeripherals();
  } catch (error) {
    app.innerHTML = `
      <main class="login-shell">
        <section class="login-card">
          <h1>Restaurante Desktop</h1>
          <p class="notice error">Nao foi possivel iniciar a interface local.</p>
        </section>
      </main>
    `;
    await window.desktopApp.logRendererEvent('error', 'Falha critica no bootstrap do renderer.', {
      error: getErrorMessage(error),
    });
    return;
  }

  window.desktopApp.onStateChanged(async (nextState: DesktopAppState) => {
    const previousState = state;
    state = nextState;
    syncSettingsDraft(nextState);
    const freshOrderIds = updateHighlightedOrders(previousState, nextState);
    const shouldPlayNewOrderAlert =
      freshOrderIds.length > 0 &&
      !nextState.settings.receivingPaused &&
      freshOrderIds.some((id) => !seenAlertOrderIds.has(id));

    if (shouldPlayNewOrderAlert) {
      freshOrderIds.forEach((id) => seenAlertOrderIds.add(id));
      await playAlertTone('new');
    }

    await maybePlayOperationalAlerts(nextState);
    if (shouldDeferAutomaticRender()) {
      return;
    }
    render();
  });

  window.desktopApp.onOperationalEvent(async (event: DesktopOperationalEvent) => {
    await handleOperationalEvent(event);
  });
}

void bootstrap();
