import type { CanonicalOrder } from '@/lib/contracts';
import { WHATSAPP_NUMBER } from '@/components/site/original-landing/siteConfig';

export function buildCardPaymentWhatsAppUrl(args: {
  order: CanonicalOrder;
  restaurantPhone?: string | null;
}) {
  const phone = normalizeWhatsAppPhone(args.restaurantPhone);
  const message = buildCardPaymentWhatsAppMessage(args.order);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildCardPaymentWhatsAppMessage(order: CanonicalOrder) {
  const lines: string[] = [
    'Ola! Finalizei um pedido pelo site e escolhi pagar no cartao.',
    '',
    `Pedido: #${order.order_number}`,
    `Nome: ${order.customer.name}`,
    'Itens:',
    ...order.items.flatMap((item) => formatOrderItemLines(item)),
    '',
  ];

  if (order.items.every((item) => !item.notes)) {
    lines.pop();
  }

  lines.push(`Total: ${formatMoney(order.total_amount)}`);
  lines.push('Forma escolhida: Cartao');
  lines.push('');
  lines.push('Pode me enviar o link/codigo para pagamento no cartao?');

  return lines.join('\n');
}

function formatOrderItemLines(item: CanonicalOrder['items'][number]) {
  const lines = [`* ${item.quantity}x ${item.product_name}`];

  for (const option of item.options) {
    lines.push(`  ${option.option_name}: ${option.option_item_name}`);
  }

  for (const addon of item.addons) {
    lines.push(`  + ${addon.name} x${addon.quantity}`);
  }

  if (item.notes) {
    lines.push(`  Obs: ${item.notes}`);
  }

  return lines;
}

function normalizeWhatsAppPhone(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits : WHATSAPP_NUMBER;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
