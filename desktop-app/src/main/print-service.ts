import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReceiptHtml, buildReceiptText } from './receipts';
import type {
  OperationalUser,
  OrderDetail,
  ReceiptBranding,
  PrinterLane,
  PrinterOption,
  PrinterTargetConfig,
  UsbPrinterOption,
} from '../shared/types';
import { DesktopLogger } from './logger';
import { QzService } from './qz-service';

const PRINT_TIMEOUT_MS = 15000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function elapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function isVirtualSystemPrinterName(name: string | null | undefined) {
  const normalized = (name ?? '').toLowerCase();
  return (
    normalized.includes('microsoft print to pdf') ||
    normalized.includes('microsoft xps document writer') ||
    normalized.includes('onenote')
  );
}

function rawError(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : null,
  };
}

function sameSystemPrinter(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string, onTimeout?: () => void) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class PrintService {
  constructor(
    private readonly logger: DesktopLogger,
    private readonly dependencies?: {
      listSystemPrinters?: () => Promise<PrinterOption[]>;
      listUsbPrinters?: () => Promise<UsbPrinterOption[]>;
    },
    private readonly qzService?: QzService,
  ) {}

  isVirtualSystemPrinter(name: string | null | undefined) {
    return isVirtualSystemPrinterName(name);
  }

  private describeConfig(config: PrinterTargetConfig) {
    return {
      driver: config.driver,
      systemName: config.systemName,
      backupSystemName: config.backupSystemName,
      host: config.host,
      port: config.port,
      usbVendorId: config.usbVendorId,
      usbProductId: config.usbProductId,
      paperWidth: config.paperWidth,
      copies: config.copies,
      isVirtualPrinter: config.driver === 'system' || config.driver === 'qz' ? isVirtualSystemPrinterName(config.systemName) : false,
    };
  }

  async validatePrinterConfig(lane: PrinterLane, config: PrinterTargetConfig) {
    const startedAt = Date.now();
    this.logger.info('[PRINT][VALIDATE] starting', {
      lane,
      config: this.describeConfig(config),
    });

    if (config.driver === 'system' || config.driver === 'qz') {
      if (!config.systemName) {
        throw new Error(`Selecione uma impressora ${config.driver === 'qz' ? 'QZ' : 'do sistema'} para a via ${lane}.`);
      }

      const printers = (await this.dependencies?.listSystemPrinters?.()) ?? [];
      const printerNames = printers.map((printer) => printer.name);
      const printerExists = printers.length === 0 || printerNames.includes(config.systemName);
      this.logger.info('[PRINT][PRINTERS] windows-list', {
        lane,
        found: printerNames,
        count: printers.length,
      });
      this.logger.info(config.driver === 'qz' ? '[PRINT][VALIDATE] qz-printer' : '[PRINT][VALIDATE] system-printer', {
        lane,
        printer: config.systemName,
        printerExists,
        isVirtualPrinter: isVirtualSystemPrinterName(config.systemName),
        durationMs: elapsedMs(startedAt),
      });

      if (!printerExists) {
        throw new Error(`A impressora "${config.systemName}" nao esta disponivel para a via ${lane}.`);
      }
    }

    if (config.driver === 'network') {
      const hostOk = Boolean(config.host);
      this.logger.info('[PRINT][VALIDATE] network-printer', {
        lane,
        host: config.host,
        port: config.port ?? 9100,
        hostOk,
        durationMs: elapsedMs(startedAt),
      });
      if (!hostOk) {
        throw new Error(`Informe o IP/host da impressora de rede para a via ${lane}.`);
      }
    }

    if (config.driver === 'usb') {
      if (config.usbVendorId === null || config.usbProductId === null) {
        throw new Error(`Selecione uma impressora USB valida para a via ${lane}.`);
      }

      const usbPrinters = (await this.dependencies?.listUsbPrinters?.()) ?? (await this.listUsbPrinters());
      const printerExists =
        usbPrinters.length === 0 ||
        usbPrinters.some(
          (printer) => printer.vendorId === config.usbVendorId && printer.productId === config.usbProductId,
        );
      this.logger.info('[PRINT][PRINTERS] usb-list', {
        lane,
        found: usbPrinters.map((printer) => printer.name),
        count: usbPrinters.length,
      });
      this.logger.info('[PRINT][VALIDATE] usb-printer', {
        lane,
        vendorId: config.usbVendorId,
        productId: config.usbProductId,
        printerExists,
        durationMs: elapsedMs(startedAt),
      });

      if (!printerExists) {
        throw new Error(
          `A impressora USB ${config.usbVendorId}:${config.usbProductId} nao esta disponivel para a via ${lane}.`,
        );
      }
    }

    if (config.backupSystemName) {
      if ((config.driver === 'system' || config.driver === 'qz') && sameSystemPrinter(config.systemName, config.backupSystemName)) {
        this.logger.warn('[PRINT][VALIDATE] backup-same-as-primary-ignored', {
          lane,
          printer: config.backupSystemName,
          durationMs: elapsedMs(startedAt),
        });
        return;
      }

      const printers = (await this.dependencies?.listSystemPrinters?.()) ?? [];
      const printerExists = printers.length === 0 || printers.some((printer) => printer.name === config.backupSystemName);
      this.logger.info('[PRINT][VALIDATE] backup-system-printer', {
        lane,
        printer: config.backupSystemName,
        printerExists,
        isVirtualPrinter: isVirtualSystemPrinterName(config.backupSystemName),
        durationMs: elapsedMs(startedAt),
      });

      if (!printerExists) {
        throw new Error(`A impressora backup "${config.backupSystemName}" nao esta disponivel para a via ${lane}.`);
      }
    }
  }

  async listUsbPrinters(): Promise<UsbPrinterOption[]> {
    try {
      const UsbPrinter = require('escpos-usb');
      const devices = UsbPrinter.findPrinter?.() ?? [];

      return devices.map((device: { deviceDescriptor?: { idVendor?: number; idProduct?: number } }) => {
        const vendorId = Number(device.deviceDescriptor?.idVendor ?? 0);
        const productId = Number(device.deviceDescriptor?.idProduct ?? 0);
        const vendorIdHex = `0x${vendorId.toString(16).padStart(4, '0')}`;
        const productIdHex = `0x${productId.toString(16).padStart(4, '0')}`;

        return {
          name: `USB ${vendorIdHex}:${productIdHex}`,
          vendorId,
          productId,
          vendorIdHex,
          productIdHex,
        };
      });
    } catch (error) {
      this.logger.warn('[PRINT][PRINTERS] usb-list-failed', {
        ...rawError(error),
      });
      return [];
    }
  }

  async printOrder(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    order: OrderDetail,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    const startedAt = Date.now();
    this.logger.info('[PRINT][START]', {
      lane,
      driver: config.driver,
      printer: config.systemName ?? config.host ?? `${config.usbVendorId}:${config.usbProductId}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

    await this.validatePrinterConfig(lane, config);

    const copies = Math.max(1, config.copies ?? 1);
    this.logger.info('[PRINT][CONFIG] effective', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      copies,
      config: this.describeConfig(config),
    });

    for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
      try {
        await this.printPrimary(lane, config, order, operator, branding);
        this.logger.info('[PRINT][DONE] copy-sent', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          copyIndex: copyIndex + 1,
          copies,
          durationMs: elapsedMs(startedAt),
        });
      } catch (error) {
        this.logger.error('[PRINT][ERROR] raw', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          copyIndex: copyIndex + 1,
          durationMs: elapsedMs(startedAt),
          ...rawError(error),
        });

        const hasDistinctSystemBackup =
          Boolean(config.backupSystemName) &&
          !(
            (config.driver === 'system' || config.driver === 'qz') &&
            sameSystemPrinter(config.systemName, config.backupSystemName)
          );

        if (config.driver === 'qz' && config.systemName && !hasDistinctSystemBackup) {
          this.logger.warn('[PRINT][BACKUP] qz-failed-trying-windows-fallback', {
            lane,
            orderId: order.id,
            orderNumber: order.orderNumber,
            systemName: config.systemName,
            ...rawError(error),
          });

          await this.printPrimary(
            lane,
            {
              ...config,
              driver: 'system',
              systemName: config.backupSystemName ?? config.systemName,
            },
            order,
            operator,
            branding,
          );
          this.logger.info('[PRINT][BACKUP] windows-fallback-sent', {
            lane,
            orderId: order.id,
            orderNumber: order.orderNumber,
            systemName: config.backupSystemName ?? config.systemName,
          });
          continue;
        }

        if (!hasDistinctSystemBackup) {
          throw error;
        }

        this.logger.warn('[PRINT][BACKUP] primary-failed-trying-system-backup', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          backupSystemName: config.backupSystemName,
          ...rawError(error),
        });

        await this.printPrimary(
          lane,
          {
            ...config,
            driver: 'system',
            systemName: config.backupSystemName,
          },
          order,
          operator,
          branding,
        );
        this.logger.info('[PRINT][BACKUP] sent', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          backupSystemName: config.backupSystemName,
        });
      }

      if (copyIndex < copies - 1) {
        await delay(150);
      }
    }

    this.logger.info('[PRINT][END]', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      durationMs: elapsedMs(startedAt),
    });
  }

  private buildTestOrder(lane: PrinterLane): OrderDetail {
    return {
      id: `test-${lane}`,
      orderNumber: 'TESTE-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'pix',
      subtotal: 39.9,
      deliveryFee: 0,
      discountAmount: 0,
      totalAmount: 39.9,
      estimatedTimeMinutes: 25,
      customerName: 'Cliente Teste',
      customerPhone: '(31) 99999-0000',
      notes: lane === 'kitchen' ? 'Sem cebola, embalar separado.' : null,
      fulfillmentType: 'pickup',
      deliveryAddress: null,
      printState: null,
      items: [
        {
          item_id: 'item-1',
          product_id: 'product-1',
          product_name: 'Marmita especial',
          quantity: 1,
          unit_price: 39.9,
          subtotal: 39.9,
          notes: 'Pouco sal',
          addons: [{ name: 'Ovo', quantity: 1 }],
          options: [{ option_name: 'Tamanho', option_item_name: 'Grande' }],
        },
      ],
    };
  }

  async printTestPage(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    await this.printOrder(lane, config, this.buildTestOrder(lane), operator, branding);
  }

  async generatePreviewFiles(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    operator: OperationalUser,
    outputDir: string,
    branding?: ReceiptBranding | null,
  ) {
    const startedAt = Date.now();
    const testOrder = this.buildTestOrder(lane);
    mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `preview-${lane}-${stamp}`;
    const htmlPath = join(outputDir, `${baseName}.html`);
    const txtPath = join(outputDir, `${baseName}.txt`);

    writeFileSync(
      htmlPath,
      buildReceiptHtml({ lane, width: config.paperWidth, order: testOrder, operator, branding }),
      'utf8',
    );
    writeFileSync(
      txtPath,
      buildReceiptText({ lane, width: config.paperWidth, order: testOrder, operator, branding }),
      'utf8',
    );

    this.logger.info('[PRINT][PREVIEW] generated', {
      lane,
      htmlPath,
      txtPath,
      paperWidth: config.paperWidth,
      durationMs: elapsedMs(startedAt),
    });

    return { htmlPath, txtPath };
  }

  private async printPrimary(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    order: OrderDetail,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    this.logger.info('[PRINT][DRIVER] selected', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      driver: config.driver,
    });

    if (config.driver === 'network') {
      await withTimeout(
        this.printOverEscPosNetwork(lane, config, order, operator, branding),
        PRINT_TIMEOUT_MS,
        `Tempo esgotado ao imprimir pela rede na via ${lane}.`,
        () =>
          this.logger.error('[PRINT][WAIT] timeout', {
            lane,
            driver: 'network',
            timeoutMs: PRINT_TIMEOUT_MS,
            host: config.host,
            port: config.port ?? 9100,
          }),
      );
      return;
    }

    if (config.driver === 'qz') {
      await withTimeout(
        this.printOverQz(lane, config, order, operator, branding),
        PRINT_TIMEOUT_MS,
        `Tempo esgotado ao imprimir via QZ Tray na via ${lane}.`,
        () =>
          this.logger.error('[PRINT][WAIT] timeout', {
            lane,
            driver: 'qz',
            timeoutMs: PRINT_TIMEOUT_MS,
            printer: config.systemName,
          }),
      );
      return;
    }

    if (config.driver === 'usb') {
      await withTimeout(
        this.printOverEscPosUsb(lane, config, order, operator, branding),
        PRINT_TIMEOUT_MS,
        `Tempo esgotado ao imprimir via USB na via ${lane}.`,
        () =>
          this.logger.error('[PRINT][WAIT] timeout', {
            lane,
            driver: 'usb',
            timeoutMs: PRINT_TIMEOUT_MS,
            usbVendorId: config.usbVendorId,
            usbProductId: config.usbProductId,
          }),
      );
      return;
    }

    await withTimeout(
      this.printOverSystemDriver(lane, config, order, operator, branding),
      PRINT_TIMEOUT_MS,
      `Tempo esgotado ao imprimir na impressora do Windows para a via ${lane}.`,
      () =>
        this.logger.error('[PRINT][WAIT] timeout', {
          lane,
          driver: 'system',
          timeoutMs: PRINT_TIMEOUT_MS,
          printer: config.systemName,
          isVirtualPrinter: isVirtualSystemPrinterName(config.systemName),
        }),
    );
  }

  private async printOverSystemDriver(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    order: OrderDetail,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    if (!config.systemName) {
      throw new Error(`Selecione uma impressora do sistema para a via ${lane}.`);
    }

    this.logger.info('[PRINT][JOB] preparing-system-window', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      systemName: config.systemName,
      isVirtualPrinter: isVirtualSystemPrinterName(config.systemName),
    });

    const window = new BrowserWindow({
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: false,
      },
    });

    try {
      await window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          buildReceiptHtml({ lane, width: config.paperWidth, order, operator, branding }),
        )}`,
      );
      this.logger.info('[PRINT][JOB] preview-loaded', {
        lane,
        orderId: order.id,
        orderNumber: order.orderNumber,
        systemName: config.systemName,
      });

      await new Promise<void>((resolve, reject) => {
        const jobStartedAt = Date.now();
        this.logger.info('[PRINT][JOB] sending', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          printer: config.systemName,
          copies: 1,
        });

        window.webContents.print(
          {
            silent: true,
            copies: 1,
            printBackground: true,
            deviceName: config.systemName ?? undefined,
            margins: {
              marginType: 'none',
            },
          },
          (success, failureReason) => {
            this.logger.info('[PRINT][JOB] callback', {
              lane,
              orderId: order.id,
              orderNumber: order.orderNumber,
              printer: config.systemName,
              sent: success,
              failureReason: failureReason || null,
              durationMs: elapsedMs(jobStartedAt),
            });

            if (!success) {
              reject(new Error(failureReason || `Falha ao imprimir a via ${lane}.`));
              return;
            }

            this.logger.info('[PRINT][JOB] sent', {
              lane,
              orderId: order.id,
              orderNumber: order.orderNumber,
              systemName: config.systemName,
            });
            resolve();
          },
        );
      });
    } finally {
      this.logger.info('[PRINT][JOB] cleanup-window', {
        lane,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
      window.destroy();
    }
  }

  private async printOverQz(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    order: OrderDetail,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    if (!config.systemName) {
      throw new Error(`Selecione uma impressora QZ para a via ${lane}.`);
    }

    if (!this.qzService) {
      throw new Error('Servico QZ Tray nao inicializado.');
    }

    this.logger.info('[PRINT][JOB] sending-qz', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      printer: config.systemName,
    });
    const text = buildReceiptText({ lane, width: config.paperWidth, order, operator, branding });
    await this.qzService.printRaw(config.systemName, text, 1);
    this.logger.info('[PRINT][JOB] qz-sent', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      printer: config.systemName,
    });
  }

  private async printOverEscPosNetwork(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    order: OrderDetail,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    if (!config.host) {
      throw new Error(`Informe o IP/host da impressora de rede para a via ${lane}.`);
    }

    this.logger.info('[PRINT][JOB] sending-network', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      host: config.host,
      port: config.port ?? 9100,
    });

    const escpos = require('escpos');
    escpos.Network = require('escpos-network');

    const device = new escpos.Network(config.host, config.port ?? 9100);
    const text = buildReceiptText({ lane, width: config.paperWidth, order, operator, branding });

    await new Promise<void>((resolve, reject) => {
      device.open((error: Error | null) => {
        if (error) {
          this.logger.error('[PRINT][JOB] network-open-failed', {
            lane,
            orderId: order.id,
            orderNumber: order.orderNumber,
            host: config.host,
            port: config.port ?? 9100,
            error: error.message,
          });
          reject(error);
          return;
        }

        this.logger.info('[PRINT][JOB] network-opened', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          host: config.host,
          port: config.port ?? 9100,
        });
        const printer = new escpos.Printer(device, { encoding: 'GB18030' });
        void this.printEscPosPayload(printer, text, branding)
          .then(() => {
            printer.cut().close(() => {
              this.logger.info('[PRINT][JOB] network-sent', {
                lane,
                orderId: order.id,
                orderNumber: order.orderNumber,
              });
              resolve();
            });
          })
          .catch(reject);
      });
    });

    await delay(300);
  }

  private async printOverEscPosUsb(
    lane: PrinterLane,
    config: PrinterTargetConfig,
    order: OrderDetail,
    operator: OperationalUser,
    branding?: ReceiptBranding | null,
  ) {
    if (config.usbVendorId === null || config.usbProductId === null) {
      throw new Error(`Selecione uma impressora USB valida para a via ${lane}.`);
    }

    this.logger.info('[PRINT][JOB] sending-usb', {
      lane,
      orderId: order.id,
      orderNumber: order.orderNumber,
      usbVendorId: config.usbVendorId,
      usbProductId: config.usbProductId,
    });

    const escpos = require('escpos');
    escpos.USB = require('escpos-usb');

    const device = new escpos.USB(config.usbVendorId, config.usbProductId);
    const text = buildReceiptText({ lane, width: config.paperWidth, order, operator, branding });

    await new Promise<void>((resolve, reject) => {
      device.open((error: Error | null) => {
        if (error) {
          this.logger.error('[PRINT][JOB] usb-open-failed', {
            lane,
            orderId: order.id,
            orderNumber: order.orderNumber,
            usbVendorId: config.usbVendorId,
            usbProductId: config.usbProductId,
            error: error.message,
          });
          reject(error);
          return;
        }

        this.logger.info('[PRINT][JOB] usb-opened', {
          lane,
          orderId: order.id,
          orderNumber: order.orderNumber,
          usbVendorId: config.usbVendorId,
          usbProductId: config.usbProductId,
        });
        const printer = new escpos.Printer(device, { encoding: 'GB18030' });
        void this.printEscPosPayload(printer, text, branding)
          .then(() => {
            printer.cut().close(() => {
              this.logger.info('[PRINT][JOB] usb-sent', {
                lane,
                orderId: order.id,
                orderNumber: order.orderNumber,
              });
              resolve();
            });
          })
          .catch(reject);
      });
    });

    await delay(300);
  }

  private parseDataUrl(dataUrl: string) {
    const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) {
      throw new Error('Logo invalido. Use uma imagem PNG ou JPEG valida.');
    }

    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }

  private async withTempLogoFile<T>(dataUrl: string, action: (path: string) => Promise<T>) {
    const { mimeType, buffer } = this.parseDataUrl(dataUrl);
    const extension = mimeType.includes('png') ? '.png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '.img';
    const filePath = join(tmpdir(), `restaurante-desktop-logo-${randomUUID()}${extension}`);
    writeFileSync(filePath, buffer);

    try {
      return await action(filePath);
    } finally {
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  }

  private async printEscPosLogo(printer: {
    align: (value: string) => unknown;
    image: (image: unknown, density?: string) => Promise<unknown>;
    text: (value: string) => unknown;
  }, branding?: ReceiptBranding | null) {
    if (!branding?.logoDataUrl) {
      return;
    }

    const escpos = require('escpos');

    await this.withTempLogoFile(branding.logoDataUrl, async (logoPath) => {
      const image = await new Promise<unknown>((resolve, reject) => {
        escpos.Image.load(logoPath, (loaded: unknown) => {
          if (loaded instanceof Error) {
            reject(loaded);
            return;
          }
          resolve(loaded);
        });
      });

      printer.align('ct');
      await printer.image(image, 's8');
      printer.text('');
    });
  }

  private async printEscPosPayload(
    printer: {
      align: (value: string) => unknown;
      image: (image: unknown, density?: string) => Promise<unknown>;
      text: (value: string) => unknown;
    },
    text: string,
    branding?: ReceiptBranding | null,
  ) {
    try {
      await this.printEscPosLogo(printer, branding);
    } catch (error) {
      this.logger.warn('[PRINT][LOGO] escpos-logo-failed-continuing-without-logo', {
        ...rawError(error),
      });
    }

    printer.text(text);
  }
}
