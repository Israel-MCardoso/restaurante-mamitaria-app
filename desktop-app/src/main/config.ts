import { app } from 'electron';
import { config as loadDotEnv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type BackendConfigSource = 'env' | 'dotenv' | 'bundled-json' | 'missing';

type BackendConfigFile = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const DEFAULT_DESKTOP_BACKEND = {
  supabaseUrl: 'https://cwekbsatoddlnojyzvus.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZWtic2F0b2RkbG5vanl6dnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODkyNDksImV4cCI6MjA5MTM2NTI0OX0.0nEMNdpmkrrAXGuIFme30lzerBvjIDgFmXN179Puq9Q',
} as const;

export type ResolvedBackendConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  source: BackendConfigSource;
};

function normalize(value: string | null | undefined) {
  return value?.trim().replace(/^"|"$/g, '') ?? '';
}

function readJsonConfig(path: string): BackendConfigFile | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BackendConfigFile;
  } catch {
    return null;
  }
}

function resolveDotEnvPaths() {
  const paths = [join(process.cwd(), '.env')];

  if (app.isPackaged) {
    paths.push(join(process.resourcesPath, 'config', '.env'));
  }

  return paths;
}

function resolveJsonPaths() {
  const paths = [join(process.cwd(), 'config', 'backend.json')];

  if (app.isPackaged) {
    paths.push(join(process.resourcesPath, 'config', 'backend.json'));
    paths.push(join(app.getAppPath(), 'config', 'backend.json'));
  }

  return paths;
}

function loadDotEnvCandidates() {
  for (const path of resolveDotEnvPaths()) {
    if (!existsSync(path)) {
      continue;
    }

    loadDotEnv({
      path,
      override: false,
    });
  }
}

loadDotEnvCandidates();

function resolveBackendConfig(): ResolvedBackendConfig {
  const envSupabaseUrl = normalize(process.env.DESKTOP_SUPABASE_URL);
  const envSupabaseAnonKey = normalize(process.env.DESKTOP_SUPABASE_ANON_KEY);

  if (envSupabaseUrl && envSupabaseAnonKey) {
    return {
      supabaseUrl: envSupabaseUrl,
      supabaseAnonKey: envSupabaseAnonKey,
      source: 'env',
    };
  }

  for (const path of resolveJsonPaths()) {
    const file = readJsonConfig(path);
    const supabaseUrl = normalize(file?.supabaseUrl);
    const supabaseAnonKey = normalize(file?.supabaseAnonKey);

    if (supabaseUrl && supabaseAnonKey) {
      return {
        supabaseUrl,
        supabaseAnonKey,
        source: 'bundled-json',
      };
    }
  }

  if (DEFAULT_DESKTOP_BACKEND.supabaseUrl && DEFAULT_DESKTOP_BACKEND.supabaseAnonKey) {
    return {
      supabaseUrl: DEFAULT_DESKTOP_BACKEND.supabaseUrl,
      supabaseAnonKey: DEFAULT_DESKTOP_BACKEND.supabaseAnonKey,
      source: 'bundled-json',
    };
  }

  for (const path of resolveDotEnvPaths()) {
    if (!existsSync(path)) {
      continue;
    }

    const supabaseUrl = normalize(process.env.DESKTOP_SUPABASE_URL);
    const supabaseAnonKey = normalize(process.env.DESKTOP_SUPABASE_ANON_KEY);

    if (supabaseUrl && supabaseAnonKey) {
      return {
        supabaseUrl,
        supabaseAnonKey,
        source: 'dotenv',
      };
    }
  }

  return {
    supabaseUrl: '',
    supabaseAnonKey: '',
    source: 'missing',
  };
}

export function getResolvedBackendConfig() {
  return resolveBackendConfig();
}

export const backendConfig = resolveBackendConfig();

export function hasDesktopEnvFile() {
  return resolveDotEnvPaths().some((path) => existsSync(path));
}

export function hasBundledBackendConfig() {
  return resolveJsonPaths().some((path) => existsSync(path));
}

export function getBackendConfig() {
  const resolved = resolveBackendConfig();

  if (!resolved.supabaseUrl || !resolved.supabaseAnonKey) {
    throw new Error(
      'Configure o backend do desktop com DESKTOP_SUPABASE_URL e DESKTOP_SUPABASE_ANON_KEY ou use config/backend.json.',
    );
  }

  return resolved;
}
