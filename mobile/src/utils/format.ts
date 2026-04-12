export function formatCurrency(value?: number | string | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('pt-BR');
}

export function formatTime(value?: string | null) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseCurrencyInput(value: string) {
  return value.replace(',', '.').replace(/[^\d.]/g, '');
}
