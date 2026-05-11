const { appendFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const bootstrapLog = join(tmpdir(), 'restaurante-desktop-bootstrap.log');

function writeBootstrapLog(message) {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    appendFileSync(bootstrapLog, `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    // ignore bootstrap logging failures
  }
}

try {
  writeBootstrapLog('Bootstrap starting.');
  require('./dist/main/index.js');
  writeBootstrapLog('Main module loaded.');
} catch (error) {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  writeBootstrapLog(`Bootstrap failure: ${message}`);
  throw error;
}
