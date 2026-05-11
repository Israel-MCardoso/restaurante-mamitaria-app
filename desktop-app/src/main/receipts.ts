import type {
  OperationalUser,
  OrderDetail,
  OrderItemDetail,
  OrderStatus,
  PaperWidth,
  PaymentMethod,
  PaymentStatus,
  PrinterLane,
  ReceiptBranding,
} from '../shared/types';

function lineWidth(width: PaperWidth) {
  return width === 58 ? 32 : 48;
}

function divider(width: PaperWidth, char = '-') {
  return char.repeat(lineWidth(width));
}

function center(text: string, width: PaperWidth) {
  const limit = lineWidth(width);
  const cleaned = text.trim();
  if (!cleaned) {
    return '';
  }
  if (cleaned.length >= limit) {
    return cleaned;
  }

  const left = Math.floor((limit - cleaned.length) / 2);
  return `${' '.repeat(left)}${cleaned}`;
}

function money(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatted = safeValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formatted}`;
}

function paymentMethodLabel(value: PaymentMethod | string) {
  switch (String(value).toLowerCase()) {
    case 'pix':
      return 'PIX';
    case 'cash':
      return 'DINHEIRO';
    case 'card':
      return 'CARTAO';
    default:
      return String(value || '-').toUpperCase();
  }
}

function paymentStatusLabel(value: PaymentStatus | string) {
  switch (String(value).toLowerCase()) {
    case 'paid':
    case 'approved':
      return 'PAGO';
    case 'pending':
    case 'unpaid':
      return 'PENDENTE';
    case 'authorized':
      return 'AUTORIZADO';
    case 'rejected':
      return 'RECUSADO';
    case 'canceled':
    case 'cancelled':
      return 'CANCELADO';
    case 'failed':
      return 'FALHOU';
    case 'refunded':
      return 'REEMBOLSADO';
    case 'expired':
      return 'EXPIRADO';
    default:
      return String(value || '-').toUpperCase();
  }
}

function orderStatusLabel(value: OrderStatus | string) {
  switch (String(value).toLowerCase()) {
    case 'pending':
      return 'PENDENTE';
    case 'confirmed':
      return 'CONFIRMADO';
    case 'preparing':
      return 'EM PREPARO';
    case 'ready':
      return 'PRONTO';
    case 'out_for_delivery':
    case 'shipped':
      return 'SAIU PARA ENTREGA';
    case 'delivered':
      return 'ENTREGUE';
    case 'canceled':
    case 'cancelled':
      return 'CANCELADO';
    default:
      return String(value || '-').toUpperCase();
  }
}

function wrap(text: string, width: PaperWidth) {
  const limit = lineWidth(width);
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > limit) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function padRight(text: string, width: number) {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return `${text}${' '.repeat(width - text.length)}`;
}

function moneyRow(label: string, value: number, width: PaperWidth) {
  const contentWidth = lineWidth(width);
  const amount = money(value);
  const dotsWidth = Math.max(2, contentWidth - label.length - amount.length);
  return `${label}${'.'.repeat(dotsWidth)}${amount}`;
}

function sectionTitle(title: string, width: PaperWidth) {
  return center(title.toUpperCase(), width);
}

function buildItemLines(item: OrderItemDetail, width: PaperWidth, kitchenMode: boolean) {
  const lines = [
    `${item.quantity}x ${item.product_name.toUpperCase()}`,
    ...item.options.flatMap((option) => wrap(`  ${option.option_name}: ${option.option_item_name}`, width)),
    ...item.addons.flatMap((addon) => wrap(`  + ${addon.name} x${addon.quantity}`, width)),
  ];

  if (item.notes) {
    lines.push(...wrap(`  Obs do item: ${item.notes}`, width));
  }

  if (!kitchenMode) {
    lines.push(...wrap(`  Subtotal do item: ${money(item.subtotal)}`, width));
  }

  return lines;
}

function receiptLabel(order: OrderDetail) {
  return order.fulfillmentType === 'delivery' ? 'ENTREGA' : 'RETIRADA';
}

type ReceiptArgs = {
  lane: PrinterLane;
  width: PaperWidth;
  order: OrderDetail;
  operator: OperationalUser;
  branding?: ReceiptBranding | null;
};

export function buildReceiptText(args: ReceiptArgs) {
  const { lane, width, order, operator } = args;
  const lines: string[] = [];

  lines.push(center(operator.restaurantName, width));
  if (operator.restaurantPhone) {
    lines.push(center(operator.restaurantPhone, width));
  }
  lines.push(center(lane === 'client' ? 'VIA CLIENTE' : 'VIA COZINHA', width));
  lines.push(divider(width, '='));
  lines.push(sectionTitle(`Pedido #${order.orderNumber}`, width));
  lines.push(divider(width));

  if (lane === 'client') {
    lines.push(`Cliente: ${order.customerName}`);
    lines.push(`Pagamento: ${paymentMethodLabel(order.paymentMethod)}`);
    lines.push(`Status pgto: ${paymentStatusLabel(order.paymentStatus)}`);
    lines.push(`Status pedido: ${orderStatusLabel(order.status)}`);
    lines.push(`Tipo: ${receiptLabel(order)}`);
    if (order.customerPhone) {
      lines.push(`Contato: ${order.customerPhone}`);
    }
    lines.push(divider(width));
    lines.push(sectionTitle('Itens', width));
    lines.push('');
    for (const item of order.items) {
      lines.push(...buildItemLines(item, width, false));
      lines.push('');
    }
    lines.push(divider(width));
    lines.push(moneyRow('Subtotal', order.subtotal, width));
    lines.push(moneyRow('Entrega', order.deliveryFee, width));
    lines.push(moneyRow('Desconto', order.discountAmount, width));
    lines.push(moneyRow('TOTAL', order.totalAmount, width));
    if (order.notes) {
      lines.push(divider(width));
      lines.push('Observacoes do pedido:');
      lines.push(...wrap(order.notes, width));
    }
    lines.push(divider(width, '='));
    lines.push(center(new Date(order.createdAt).toLocaleString('pt-BR'), width));
    lines.push(center('Obrigado pela preferencia', width));
  } else {
    lines.push(`Cliente: ${order.customerName}`);
    lines.push(`Pagamento: ${paymentMethodLabel(order.paymentMethod)}`);
    lines.push(`Status pgto: ${paymentStatusLabel(order.paymentStatus)}`);
    lines.push(`Status pedido: ${orderStatusLabel(order.status)}`);
    lines.push(`Tipo: ${receiptLabel(order)}`);
    if (order.customerPhone) {
      lines.push(`Contato: ${order.customerPhone}`);
    }
    lines.push(divider(width));
    lines.push(sectionTitle('Producao', width));
    lines.push('');
    for (const item of order.items) {
      lines.push(...buildItemLines(item, width, true));
      lines.push('');
    }
    if (order.notes) {
      lines.push(divider(width));
      lines.push('OBS GERAL:');
      lines.push(...wrap(order.notes, width));
    }
    lines.push(divider(width, '='));
    lines.push(center(new Date(order.createdAt).toLocaleString('pt-BR'), width));
  }

  lines.push('');
  lines.push('');
  return lines.join('\n');
}

function renderClientItemsHtml(order: OrderDetail) {
  return order.items
    .map((item) => {
      const meta = [
        ...item.options.map((option) => `${option.option_name}: ${option.option_item_name}`),
        ...item.addons.map((addon) => `+ ${addon.name} x${addon.quantity}`),
      ];

      return `
        <article class="receipt-item">
          <div class="item-head">
            <strong>${item.quantity}x ${escapeHtml(item.product_name)}</strong>
            <span>${escapeHtml(money(item.subtotal))}</span>
          </div>
          ${meta.length > 0 ? `<div class="item-meta">${meta.map(escapeHtml).join(' • ')}</div>` : ''}
          ${item.notes ? `<div class="item-note">Obs do item: ${escapeHtml(item.notes)}</div>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderKitchenItemsHtml(order: OrderDetail) {
  return order.items
    .map((item) => {
      const meta = [
        ...item.options.map((option) => `${option.option_name}: ${option.option_item_name}`),
        ...item.addons.map((addon) => `+ ${addon.name} x${addon.quantity}`),
      ];

      return `
        <article class="receipt-item kitchen-item">
          <div class="item-head kitchen">
            <strong>${item.quantity}x ${escapeHtml(item.product_name.toUpperCase())}</strong>
          </div>
          ${meta.length > 0 ? `<div class="item-meta">${meta.map(escapeHtml).join(' • ')}</div>` : ''}
          ${item.notes ? `<div class="item-note">Obs do item: ${escapeHtml(item.notes)}</div>` : ''}
        </article>
      `;
    })
    .join('');
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildReceiptHtml(args: ReceiptArgs) {
  const { lane, width, order, operator, branding } = args;
  const widthMm = width === 58 ? 58 : 80;
  const logoMarkup =
    branding?.logoDataUrl
      ? `<div class="receipt-logo-wrap"><img class="receipt-logo" src="${branding.logoDataUrl}" alt="Logo do restaurante" /></div>`
      : '';
  const clientMeta = `
    <div class="receipt-grid">
      <div><span>Cliente</span><strong>${escapeHtml(order.customerName)}</strong></div>
      <div><span>Pagamento</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></div>
      <div><span>Status pgto</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></div>
      <div><span>Status pedido</span><strong>${escapeHtml(orderStatusLabel(order.status))}</strong></div>
      <div><span>Tipo</span><strong>${escapeHtml(receiptLabel(order))}</strong></div>
    </div>
  `;
  const kitchenMeta = `
    <div class="receipt-grid">
      <div><span>Cliente</span><strong>${escapeHtml(order.customerName)}</strong></div>
      <div><span>Pagamento</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></div>
      <div><span>Status pgto</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></div>
      <div><span>Status pedido</span><strong>${escapeHtml(orderStatusLabel(order.status))}</strong></div>
      <div><span>Tipo</span><strong>${escapeHtml(receiptLabel(order))}</strong></div>
      <div><span>Contato</span><strong>${escapeHtml(order.customerPhone || '-')}</strong></div>
      <div><span>Via</span><strong>COZINHA</strong></div>
    </div>
  `;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${lane === 'client' ? 'Via Cliente' : 'Via Cozinha'}</title>
    <style>
      :root {
        --ink: #18130f;
        --muted: #6d6257;
        --line: #d9c6ad;
        --soft: #f7efe6;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: #fff;
      }
      main {
        width: ${widthMm}mm;
        padding: 4mm 3mm 5mm;
        box-sizing: border-box;
      }
      .receipt {
        display: grid;
        gap: 10px;
      }
      .receipt-logo-wrap {
        display: flex;
        justify-content: center;
      }
      .receipt-logo {
        max-width: ${width === 58 ? '28mm' : '38mm'};
        max-height: 18mm;
        object-fit: contain;
      }
      .receipt-header {
        display: grid;
        gap: 4px;
        justify-items: center;
        text-align: center;
      }
      .receipt-header h1 {
        margin: 0;
        font-size: ${lane === 'client' ? (width === 58 ? '15px' : '17px') : width === 58 ? '14px' : '16px'};
        letter-spacing: 0.03em;
      }
      .receipt-header p {
        margin: 0;
        font-size: 11px;
        color: var(--muted);
      }
      .receipt-label {
        display: inline-block;
        padding: 4px 10px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--soft);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .receipt-order {
        border-top: 2px solid var(--ink);
        border-bottom: 1px solid var(--line);
        padding: 8px 0 10px;
        text-align: center;
      }
      .receipt-order strong {
        font-size: ${width === 58 ? '18px' : '20px'};
        letter-spacing: 0.04em;
      }
      .receipt-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .receipt-grid div {
        display: grid;
        gap: 2px;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .receipt-grid span {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .receipt-grid strong {
        font-size: ${width === 58 ? '11px' : '12px'};
      }
      .receipt-section-title {
        margin: 2px 0 0;
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .receipt-items {
        display: grid;
        gap: 8px;
      }
      .receipt-item {
        border-bottom: 1px dashed var(--line);
        padding-bottom: 8px;
      }
      .item-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        font-size: ${width === 58 ? '12px' : '13px'};
      }
      .item-head.kitchen strong {
        font-size: ${width === 58 ? '13px' : '14px'};
      }
      .item-meta,
      .item-note,
      .receipt-note,
      .receipt-footer {
        font-size: ${width === 58 ? '11px' : '12px'};
        color: var(--muted);
      }
      .item-meta,
      .item-note {
        margin-top: 4px;
      }
      .receipt-totals {
        display: grid;
        gap: 4px;
        border-top: 1px solid var(--line);
        border-bottom: 2px solid var(--ink);
        padding: 8px 0;
      }
      .receipt-total-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: ${width === 58 ? '12px' : '13px'};
      }
      .receipt-total-row.grand strong,
      .receipt-total-row.grand span {
        font-size: ${width === 58 ? '14px' : '16px'};
      }
      .receipt-note-block {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #fcf8f4;
        padding: 9px 10px;
      }
      .receipt-footer {
        display: grid;
        gap: 4px;
        justify-items: center;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="receipt">
        ${logoMarkup}
        <header class="receipt-header">
          <div class="receipt-label">${lane === 'client' ? 'VIA CLIENTE' : 'VIA COZINHA'}</div>
          <h1>${escapeHtml(operator.restaurantName)}</h1>
          ${operator.restaurantPhone ? `<p>${escapeHtml(operator.restaurantPhone)}</p>` : ''}
        </header>
        <section class="receipt-order">
          <strong>PEDIDO #${escapeHtml(order.orderNumber)}</strong>
        </section>
        ${lane === 'client' ? clientMeta : kitchenMeta}
        <div class="receipt-section-title">${lane === 'client' ? 'Itens do pedido' : 'Producao'}</div>
        <section class="receipt-items">
          ${lane === 'client' ? renderClientItemsHtml(order) : renderKitchenItemsHtml(order)}
        </section>
        ${
          lane === 'client'
            ? `<section class="receipt-totals">
                 <div class="receipt-total-row"><span>Subtotal</span><strong>${escapeHtml(money(order.subtotal))}</strong></div>
                 <div class="receipt-total-row"><span>Entrega</span><strong>${escapeHtml(money(order.deliveryFee))}</strong></div>
                 <div class="receipt-total-row"><span>Desconto</span><strong>${escapeHtml(money(order.discountAmount))}</strong></div>
                 <div class="receipt-total-row grand"><span>Total</span><strong>${escapeHtml(money(order.totalAmount))}</strong></div>
               </section>`
            : ''
        }
        ${
          order.notes
            ? `<section class="receipt-note-block">
                 <div class="receipt-section-title">${lane === 'client' ? 'Observacoes do pedido' : 'OBS GERAL'}</div>
                 <div class="receipt-note">${escapeHtml(order.notes)}</div>
               </section>`
            : ''
        }
        <footer class="receipt-footer">
          <strong>${escapeHtml(new Date(order.createdAt).toLocaleString('pt-BR'))}</strong>
          ${lane === 'client' ? '<span>Obrigado pela preferencia</span>' : ''}
        </footer>
      </section>
    </main>
  </body>
</html>`;
}
