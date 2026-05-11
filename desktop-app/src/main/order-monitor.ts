import type {
  ConnectionStatus,
  DesktopSettings,
  OperationalUser,
  OrderDetail,
  PrintLaneSelection,
  PrintMode,
  PrintSource,
  PrintedOrderState,
  PrinterLane,
} from '../shared/types';
import { UI_MESSAGES } from '../shared/ui-messages';
import { DesktopLogger } from './logger';
import { DesktopStore } from './store';
import { DesktopSupabase } from './supabase-session';
import { PrintService } from './print-service';

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const AUTO_RETRY_COOLDOWN_MS = 30000;

type MonitorPatch = {
  isMonitoring?: boolean;
  realtimeConnected?: boolean;
  connectionStatus?: ConnectionStatus;
  connectionLabel?: string;
  lastError?: string | null;
};

type MonitorEvent =
  | { type: 'order-detected'; order: OrderDetail; source: Extract<PrintSource, 'realtime' | 'polling'> }
  | {
      type: 'print-success';
      order: OrderDetail;
      lane: PrinterLane;
      source: PrintSource;
      mode: PrintMode;
    }
  | {
      type: 'print-failure';
      order: OrderDetail;
      lane: PrinterLane;
      source: PrintSource;
      mode: PrintMode;
      error: string;
    };

function buildConnectionLabel(settings: DesktopSettings, realtimeConnected: boolean) {
  if (settings.receivingPaused) {
    return UI_MESSAGES.receivingPaused;
  }

  if (settings.listenMode === 'polling_only') {
    return UI_MESSAGES.pollingActive;
  }

  if (realtimeConnected) {
    return UI_MESSAGES.realtimeConnected;
  }

  return UI_MESSAGES.realtimeFallback;
}

function getAutoPrintLanes(settings: DesktopSettings): PrinterLane[] {
  if (!settings.autoPrintEnabled || settings.receivingPaused) {
    return [];
  }

  const lanes: PrinterLane[] = [];
  if (settings.autoPrintClient) {
    lanes.push('client');
  }
  if (settings.autoPrintKitchen) {
    lanes.push('kitchen');
  }
  return lanes;
}

function printerConfigSummary(settings: DesktopSettings, lane: PrinterLane) {
  const config = settings.printers[lane];
  return {
    driver: config.driver,
    systemName: config.systemName,
    backupSystemName: config.backupSystemName,
    host: config.host,
    port: config.port,
    usbVendorId: config.usbVendorId,
    usbProductId: config.usbProductId,
    copies: config.copies,
    paperWidth: config.paperWidth,
  };
}

function effectivePendingLanes(remotePrintState: PrintedOrderState | null, laneCandidates: PrinterLane[]) {
  if (!remotePrintState) {
    return laneCandidates;
  }

  return laneCandidates.filter((lane) =>
    lane === 'client' ? !remotePrintState.customerPrintedAt : !remotePrintState.kitchenPrintedAt,
  );
}

function shouldPrintOrder(order: OrderDetail) {
  if (order.paymentStatus === 'paid') {
    return true;
  }

  return order.paymentMethod === 'cash' || order.paymentMethod === 'card';
}

export class OrderMonitor {
  private stopRealtime: (() => void) | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private inFlightOrderIds = new Set<string>();
  private realtimeConnected = false;
  private consecutivePollingFailures = 0;

  constructor(
    private readonly backend: DesktopSupabase,
    private readonly store: DesktopStore,
    private readonly logger: DesktopLogger,
    private readonly printer: PrintService,
    private readonly stateChanged: (patch: MonitorPatch) => void,
    private readonly ordersChanged: (reason: string) => void,
    private readonly eventOccurred: (event: MonitorEvent) => void,
  ) {}

  start(user: OperationalUser, settings: DesktopSettings) {
    this.stop();
    this.consecutivePollingFailures = 0;
    this.logger.info('Monitor de pedidos iniciado.', {
      restaurantId: user.restaurantId,
      autoPrintEnabled: settings.autoPrintEnabled,
      receivingPaused: settings.receivingPaused,
      listenMode: settings.listenMode,
      pollingIntervalMs: settings.pollingIntervalMs,
    });

    this.stateChanged({
      isMonitoring: true,
      lastError: null,
      connectionStatus: settings.listenMode === 'polling_only' ? 'online' : 'reconnecting',
      connectionLabel: buildConnectionLabel(settings, false),
    });

    if (settings.listenMode === 'realtime_fallback') {
      this.stopRealtime = this.backend.subscribeToRestaurantOrders(
        user.restaurantId,
        async (order) => {
          this.ordersChanged('realtime');
          await this.processOrder(user, settings, order.id, 'realtime');
        },
        (connected) => {
          this.realtimeConnected = connected;
          this.stateChanged({
            realtimeConnected: connected,
            connectionStatus: connected ? 'online' : 'reconnecting',
            connectionLabel: buildConnectionLabel(settings, connected),
          });
        },
      );
    }

    const runPolling = async () => {
      try {
        const orders = await this.backend.fetchOrdersEligibleForPrinting(user.restaurantId);
        this.consecutivePollingFailures = 0;
        this.ordersChanged('polling');

        this.stateChanged({
          connectionStatus: settings.listenMode === 'polling_only' ? 'online' : this.realtimeConnected ? 'online' : 'reconnecting',
          connectionLabel: buildConnectionLabel(settings, this.realtimeConnected),
          lastError: null,
        });

        for (const order of orders.reverse()) {
          await this.processOrder(user, settings, order.id, 'polling');
        }
      } catch (error) {
        this.consecutivePollingFailures += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn('Polling de pedidos falhou.', {
          error: message,
          failures: this.consecutivePollingFailures,
        });
        this.stateChanged({
          connectionStatus: this.consecutivePollingFailures >= 2 ? 'offline' : 'reconnecting',
          connectionLabel:
            this.consecutivePollingFailures >= 2
              ? UI_MESSAGES.reconnectingServer
              : UI_MESSAGES.unstableConnection,
          lastError: UI_MESSAGES.temporaryOrdersFailure,
        });
      } finally {
        this.pollingTimer = setTimeout(runPolling, settings.pollingIntervalMs);
      }
    };

    void runPolling();
  }

  stop() {
    if (this.stopRealtime) {
      this.stopRealtime();
      this.stopRealtime = null;
    }

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.inFlightOrderIds.clear();
    this.realtimeConnected = false;
    this.consecutivePollingFailures = 0;
    this.stateChanged({
      isMonitoring: false,
      realtimeConnected: false,
      connectionStatus: 'idle',
      connectionLabel: UI_MESSAGES.monitorStopped,
    });
  }

  async processOrder(
    user: OperationalUser,
    settings: DesktopSettings,
    orderId: string,
    source: Extract<PrintSource, 'realtime' | 'polling'>,
  ) {
    const autoPrintLanes = getAutoPrintLanes(settings);
    const printedJob = this.store.getPrintedJob(orderId);

    if (this.store.hasPrintedOrder(orderId)) {
      this.logger.info('[PRINT] Pedido ignorado porque ja foi totalmente impresso.', {
        orderId,
        source,
      });
      return;
    }

    if (this.inFlightOrderIds.has(orderId)) {
      this.logger.info('[PRINT] Pedido ignorado porque ja esta em processamento.', {
        orderId,
        source,
      });
      return;
    }

    if (!this.store.canAutoRetry(orderId)) {
      this.logger.info('[PRINT] Pedido aguardando fim do cooldown para nova tentativa.', {
        orderId,
        source,
        retryBlockedUntil: printedJob?.retryBlockedUntil ?? null,
      });
      return;
    }

    this.inFlightOrderIds.add(orderId);

    try {
      const order = await this.backend.fetchOrderDetail(orderId, user.restaurantId);
      this.store.syncRemotePrintState(order.printState);

      if (order.printState?.printedAt) {
        this.logger.info('[PRINT] Pedido ignorado porque o backend ja registra impressao completa.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          source,
        });
        return;
      }

      if (!shouldPrintOrder(order)) {
        this.logger.info('[PRINT] Pedido ignorado porque ainda aguarda confirmacao do pagamento online.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          source,
        });
        return;
      }

      if (!printedJob?.firstDetectedAt) {
        this.store.markOrderDetected(order.id, {
          orderNumber: order.orderNumber,
          source,
        });

        this.logger.info('Pedido detectado para operacao.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          source,
          receivingPaused: settings.receivingPaused,
        });
        this.eventOccurred({ type: 'order-detected', order, source });
        this.ordersChanged('detected');
      }

      if (autoPrintLanes.length === 0) {
        this.logger.info('[PRINT] Pedido detectado sem auto print ativo nesta estacao.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          source,
          autoPrintEnabled: settings.autoPrintEnabled,
          receivingPaused: settings.receivingPaused,
        });
        return;
      }

      this.logger.info('[PRINT] Pedido elegivel para impressao automatica.', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        source,
        lanes: autoPrintLanes,
        clientConfig: autoPrintLanes.includes('client') ? printerConfigSummary(settings, 'client') : null,
        kitchenConfig: autoPrintLanes.includes('kitchen') ? printerConfigSummary(settings, 'kitchen') : null,
      });

      const result = await this.executePrintFlow(
        user,
        settings,
        order,
        source,
        'auto',
        effectivePendingLanes(order.printState, autoPrintLanes),
      );

      if (result.ok && this.store.hasPrintedOrder(order.id)) {
        this.logger.info('Impressao concluida.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
        this.stateChanged({ lastError: null });
      }
    } finally {
      this.inFlightOrderIds.delete(orderId);
    }
  }

  async reprintOrder(
    user: OperationalUser,
    settings: DesktopSettings,
    orderId: string,
    selection: PrintLaneSelection,
  ) {
    const order = await this.backend.fetchOrderDetail(orderId, user.restaurantId);

    this.store.markOrderDetected(order.id, {
      orderNumber: order.orderNumber,
      source: 'manual',
    });

    this.logger.info('Reimpressao manual solicitada.', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      selection,
    });

    const manualLanes: PrinterLane[] = selection === 'both' ? ['client', 'kitchen'] : [selection];
    this.logger.info('[PRINT] Reimpressao manual iniciada.', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      selection,
      lanes: manualLanes,
    });
    return this.executePrintFlow(user, settings, order, 'manual', 'manual', manualLanes);
  }

  private async executePrintFlow(
    user: OperationalUser,
    settings: DesktopSettings,
    order: OrderDetail,
    source: PrintSource,
    mode: PrintMode,
    targetLanes: PrinterLane[],
  ) {
    const lanes =
      mode === 'manual'
        ? targetLanes
        : targetLanes.filter((lane) => !this.store.isLanePrinted(order.id, lane));

    if (lanes.length === 0) {
      this.logger.info('[PRINT] Pedido ignorado porque todas as vias ja foram impressas.', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        source,
      });
      return { ok: true };
    }

    this.store.beginPrintAttempt(order.id, {
      orderNumber: order.orderNumber,
      source,
      mode,
    });

    this.logger.info('[PRINT] Tentativa de impressao iniciada.', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      source,
      mode,
      lanes,
    });

    const errors: string[] = [];
    for (const [index, lane] of lanes.entries()) {
      try {
        await this.printer.printOrder(lane, settings.printers[lane], order, user, settings.receiptBranding);
        this.store.markLanePrinted(order.id, lane, {
          orderNumber: order.orderNumber,
        });
        try {
          await this.backend.markOrderLanePrinted(order.id, user.restaurantId, lane);
        } catch (error) {
          this.logger.warn('[PRINT] Via impressa, mas nao foi possivel sincronizar o status remoto.', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            lane,
            source,
            mode,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        this.logger.info('[PRINT] Via impressa com sucesso.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          lane,
          source,
          mode,
        });
        this.eventOccurred({
          type: 'print-success',
          order,
          lane,
          source,
          mode,
        });

        if (index < lanes.length - 1) {
          await pause(250);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${lane}: ${message}`);
        this.store.markAttemptFailed(order.id, {
          orderNumber: order.orderNumber,
          error: message,
          retryCooldownMs: AUTO_RETRY_COOLDOWN_MS,
        });
        this.logger.error('[PRINT][ERROR] Falha ao imprimir via do pedido.', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          lane,
          source,
          mode,
          error: message,
        });
        this.eventOccurred({
          type: 'print-failure',
          order,
          lane,
          source,
          mode,
          error: message,
        });
      }
    }

    this.ordersChanged('print-updated');

    if (errors.length > 0) {
      this.stateChanged({
        lastError: `Falha de impressao no pedido ${order.orderNumber}: ${errors.join(' | ')}`,
      });
      return { ok: false, error: errors.join(' | ') };
    }

    this.stateChanged({ lastError: null });
    return { ok: true };
  }
}
