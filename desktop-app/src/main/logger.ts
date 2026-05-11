import { mkdirSync, readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogEntry } from '../shared/types';

type LogListener = (entry: LogEntry) => void;

const listeners = new Set<LogListener>();
const recentLogs: LogEntry[] = [];

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
        const lowered = key.toLowerCase();
        if (
          lowered.includes('token') ||
          lowered.includes('password') ||
          lowered.includes('secret') ||
          lowered.includes('authorization') ||
          lowered.includes('refresh') ||
          lowered.includes('access')
        ) {
          return [key, '[redacted]'];
        }

        return [key, sanitizeValue(entryValue)];
      }),
    );
  }

  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [redacted]')
      .replace(/APP_USR-[A-Za-z0-9\-_]+/g, 'APP_USR-[redacted]')
      .replace(/eyJ[A-Za-z0-9\-_=.]+/g, '[redacted-jwt]');
  }

  return value;
}

export class DesktopLogger {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  info(message: string, context?: Record<string, unknown>) {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.write('error', message, context);
  }

  clear() {
    writeFileSync(this.filePath, '', 'utf8');
    recentLogs.length = 0;
    this.info('Historico de logs limpo manualmente.');
  }

  readRecent() {
    return [...recentLogs];
  }

  getFilePath() {
    return this.filePath;
  }

  subscribe(listener: LogListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  private write(level: LogEntry['level'], message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? (sanitizeValue(context) as Record<string, unknown>) : undefined,
    };

    const serialized = JSON.stringify(entry);
    appendFileSync(this.filePath, `${serialized}\n`, 'utf8');

    recentLogs.unshift(entry);
    if (recentLogs.length > 200) {
      recentLogs.length = 200;
    }

    for (const listener of listeners) {
      listener(entry);
    }
  }

  seedFromDisk() {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const lines = readFileSync(this.filePath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-200);

      recentLogs.length = 0;
      for (const line of lines.reverse()) {
        recentLogs.push(JSON.parse(line) as LogEntry);
      }
    } catch {
      recentLogs.length = 0;
    }
  }
}
