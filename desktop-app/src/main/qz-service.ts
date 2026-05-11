import type { PrinterOption, QzTrayStatus } from '../shared/types';
import { DesktopLogger } from './logger';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const QZ_DOWNLOAD_MESSAGE = 'Para imprimir automaticamente, instale e abra o QZ Tray.';

type QzApi = {
  websocket: {
    isActive: () => boolean;
    connect: (options?: Record<string, unknown>) => Promise<void>;
    disconnect: () => Promise<void>;
  };
  api: {
    getVersion: () => Promise<string>;
  };
  security: {
    setCertificatePromise: (handler: (resolve: (value: string | null) => void, reject: (error?: unknown) => void) => void) => void;
    setSignaturePromise: (factory: (dataToSign: string) => (resolve: (signature: string) => void) => void) => void;
  };
  printers: {
    find: (query?: string) => Promise<string[] | string>;
  };
  configs: {
    create: (printer: string, options?: Record<string, unknown>) => unknown;
  };
  print: (config: unknown, data: unknown[]) => Promise<void>;
};

function rawError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escposTextPayload(text: string) {
  // Initialize, print text, feed, cut. Thermal printers that do not support cut simply ignore it.
  return `\x1b@${text}\n\n\n\x1dV\x00`;
}

function qzInstallCandidates() {
  const candidates = [
    process.env.ProgramFiles ? join(process.env.ProgramFiles, 'QZ Tray', 'qz-tray.exe') : null,
    process.env['ProgramFiles(x86)'] ? join(process.env['ProgramFiles(x86)'], 'QZ Tray', 'qz-tray.exe') : null,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'QZ Tray', 'qz-tray.exe') : null,
  ];

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

async function isQzProcessRunning() {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq qz-tray.exe', '/NH'], {
      windowsHide: true,
    });
    return stdout.toLowerCase().includes('qz-tray.exe');
  } catch {
    return false;
  }
}

export class QzService {
  private qz: QzApi | null = null;
  private setupDone = false;

  constructor(private readonly logger: DesktopLogger) {}

  private getQz() {
    if (!this.qz) {
      this.qz = require('qz-tray') as QzApi;
    }

    if (!this.setupDone) {
      this.qz.security.setCertificatePromise((resolve) => resolve(null));
      this.qz.security.setSignaturePromise(() => (resolve) => resolve(''));
      this.setupDone = true;
    }

    return this.qz;
  }

  private async getLocalStatus(error: string | null = null): Promise<QzTrayStatus> {
    const running = await isQzProcessRunning();
    const installed = running || qzInstallCandidates().some((candidate) => existsSync(candidate));
    return {
      connected: false,
      running,
      installed,
      state: installed ? 'closed' : 'not_found',
      version: null,
      error: error ?? QZ_DOWNLOAD_MESSAGE,
    };
  }

  async status(): Promise<QzTrayStatus> {
    const qz = this.getQz();

    if (qz.websocket.isActive()) {
      const version = await qz.api.getVersion().catch(() => null);
      return { connected: true, running: true, installed: true, state: 'connected', version, error: null };
    }

    return this.getLocalStatus();
  }

  async connect(): Promise<QzTrayStatus> {
    const qz = this.getQz();

    if (qz.websocket.isActive()) {
      const version = await qz.api.getVersion().catch(() => null);
      return { connected: true, running: true, installed: true, state: 'connected', version, error: null };
    }

    this.logger.info('[QZ] conectando');
    try {
      await qz.websocket.connect({ retries: 1, delay: 250 });
      const version = await qz.api.getVersion().catch(() => null);
      this.logger.info('[QZ] conectado', { version });
      return { connected: true, running: true, installed: true, state: 'connected', version, error: null };
    } catch (error) {
      const status = await this.getLocalStatus(QZ_DOWNLOAD_MESSAGE);
      this.logger.error('[QZ][ERROR] falha ao conectar', {
        installed: status.installed,
        running: status.running,
        state: status.state,
        error: rawError(error),
      });
      return status;
    }
  }

  async listPrinters(): Promise<{ status: QzTrayStatus; printers: PrinterOption[] }> {
    const status = await this.connect();
    if (!status.connected) {
      return { status, printers: [] };
    }

    try {
      const qz = this.getQz();
      const found = await qz.printers.find();
      const names = Array.isArray(found) ? found : [found];
      const printers = names.map((name) => ({
        name,
        description: 'QZ Tray',
        isDefault: false,
        status: 0,
      }));
      this.logger.info('[QZ] impressoras encontradas', {
        count: printers.length,
        found: printers.map((printer) => printer.name),
      });
      return { status, printers };
    } catch (error) {
      const nextStatus = {
        connected: status.connected,
        running: status.running,
        installed: status.installed,
        state: status.state,
        version: status.version,
        error: rawError(error),
      };
      this.logger.error('[QZ][ERROR] falha ao listar impressoras', {
        error: rawError(error),
      });
      return { status: nextStatus, printers: [] };
    }
  }

  async printRaw(printerName: string, text: string, copies: number) {
    const status = await this.connect();
    if (!status.connected) {
      throw new Error(status.error ?? 'QZ Tray nao esta rodando. Abra o QZ Tray para imprimir.');
    }

    const listed = await this.listPrinters();
    const printerExists = listed.printers.some((printer) => printer.name === printerName);
    this.logger.info('[QZ] impressora encontrada', {
      printer: printerName,
      printerExists,
    });

    if (!printerExists) {
      throw new Error(`A impressora "${printerName}" nao foi encontrada pelo QZ Tray.`);
    }

    const qz = this.getQz();
    const config = qz.configs.create(printerName, {
      copies: Math.max(1, copies),
      colorType: 'blackwhite',
      jobName: 'Restaurante Desktop',
    });
    const data = [
      {
        type: 'raw',
        format: 'plain',
        data: escposTextPayload(text),
      },
    ];

    this.logger.info('[QZ] enviando impressao', {
      printer: printerName,
      copies: Math.max(1, copies),
      bytes: escposTextPayload(text).length,
    });
    try {
      await qz.print(config, data);
      this.logger.info('[QZ] sucesso', {
        printer: printerName,
      });
    } catch (error) {
      this.logger.error('[QZ][ERROR] falha ao imprimir', {
        printer: printerName,
        error: rawError(error),
      });
      throw error;
    }
  }
}
