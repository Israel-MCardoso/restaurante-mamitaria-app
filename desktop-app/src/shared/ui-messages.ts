import type { PrinterHealthState, PrinterLane } from './types';

export type UiMessageTone = 'success' | 'warning' | 'error' | 'info';

export const UI_MESSAGES = {
  waitingForAuth: 'Aguardando autenticação.',
  loginCompleted: 'Login concluído. Inicializando a fila operacional.',
  sessionRestored: 'Sessão restaurada. Inicializando a operação.',
  sessionExpired: 'Sessão expirada. Faça login novamente.',
  authFailure: 'Falha na autenticação operacional.',
  monitorStopped: 'Monitor pausado.',
  receivingPaused: 'Recebimento pausado. A fila continua visível sem impressão automática.',
  pollingActive: 'Polling operacional ativo.',
  realtimeConnected: 'Tempo real ativo. Escutando novos pedidos.',
  realtimeFallback: 'Tempo real indisponível. Polling de segurança ativo.',
  reconnectingServer: 'Sem conexão com o servidor. Tentando reconectar...',
  unstableConnection: 'Instabilidade na conexão. Tentando novamente...',
  temporaryOrdersFailure: 'Falha temporária ao consultar pedidos. Tentando novamente...',
  queueRefreshSuccess: 'Fila atualizada com sucesso.',
  queueRefreshOfflineCache: 'Sem conexão no momento. Exibindo a última fila salva nesta estação.',
  settingsSaved: 'Configurações salvas com sucesso.',
  receivingPausedSuccess: 'Recebimento pausado nesta estação.',
  receivingResumedSuccess: 'Recebimento retomado nesta estação.',
  printersRefreshed: 'Lista de impressoras atualizada.',
  logsCleared: 'Logs locais limpos.',
  soundTested: 'Som de alerta reproduzido.',
  printSentClient: 'Impressão enviada para a via do cliente.',
  printSentKitchen: 'Impressão enviada para a via da cozinha.',
  printErrorClient: 'Falha na impressora do cliente.',
  printErrorKitchen: 'Falha na impressora da cozinha.',
  manualReprintSent: 'Reimpressão enviada com sucesso.',
  statusUpdated: 'Status do pedido atualizado.',
} as const;

export function printerLaneLabel(lane: PrinterLane) {
  return lane === 'client' ? 'cliente' : 'cozinha';
}

export function printerHealthMeta(lane: PrinterLane, health: PrinterHealthState) {
  if (health.status === 'ok') {
    return {
      tone: 'success' as const,
      label: `Impressora ${printerLaneLabel(lane)} OK`,
      tooltip: health.lastSuccessAt
        ? `Último teste bem-sucedido às ${new Date(health.lastSuccessAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}.`
        : `A impressora da ${printerLaneLabel(lane)} está pronta para uso.`,
    };
  }

  if (health.status === 'error') {
    return {
      tone: 'error' as const,
      label: `Falha na impressora ${printerLaneLabel(lane)}`,
      tooltip: health.lastError ?? `A impressora da ${printerLaneLabel(lane)} precisa de atenção.`,
    };
  }

  return {
    tone: 'info' as const,
    label: `Impressora ${printerLaneLabel(lane)} sem teste recente`,
    tooltip: `Faça um teste para validar a impressora da ${printerLaneLabel(lane)} nesta estação.`,
  };
}
