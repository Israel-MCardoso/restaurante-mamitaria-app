export const ORDER_STATUS_VALUES = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const PAYMENT_STATUS_VALUES = [
  'unpaid',
  'pending',
  'paid',
  'failed',
  'expired',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const PAYMENT_METHOD_VALUES = ['pix', 'cash', 'card'] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const FULFILLMENT_TYPE_VALUES = ['delivery', 'pickup'] as const;

export type FulfillmentType = (typeof FULFILLMENT_TYPE_VALUES)[number];

export interface PaymentData {
  qr_code: string | null;
  qr_code_base64: string | null;
  copy_paste_code: string | null;
  expires_at: string | null;
  provider_transaction_id: string | null;
}

export interface OrderItemAddon {
  addon_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderItem {
  item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  addons: OrderItemAddon[];
}

export interface CustomerSnapshot {
  name: string;
  phone: string;
  email?: string | null;
}

export interface DeliveryAddress {
  street: string;
  number: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  zip_code: string | null;
  complement: string | null;
  reference: string | null;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  changed_at: string;
  note: string | null;
  source: string | null;
}

export interface CanonicalOrder {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  estimated_time_minutes: number | null;
  fulfillment_type: FulfillmentType;
  items: OrderItem[];
  payment_data: PaymentData | null;
  customer: CustomerSnapshot;
  delivery_address: DeliveryAddress | null;
  status_history?: OrderStatusHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface ContractValidationIssue {
  field: string;
  message: string;
}

export interface ErrorResponseBody {
  code: string;
  message: string;
  field?: string;
}

export interface CreateOrderItemAddonSelection {
  addon_id: string;
  quantity: number;
}

export interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  notes?: string | null;
  addons?: CreateOrderItemAddonSelection[];
}

export interface CreateOrderRequest {
  restaurant_id?: string;
  restaurant_slug?: string;
  payment_method: PaymentMethod;
  fulfillment_type: FulfillmentType;
  customer: CustomerSnapshot;
  delivery_address: DeliveryAddress | null;
  items: CreateOrderItemInput[];
  notes?: string | null;
  coupon_code?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUS_VALUES.includes(value as OrderStatus);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && PAYMENT_STATUS_VALUES.includes(value as PaymentStatus);
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHOD_VALUES.includes(value as PaymentMethod);
}

export function isFulfillmentType(value: unknown): value is FulfillmentType {
  return typeof value === 'string' && FULFILLMENT_TYPE_VALUES.includes(value as FulfillmentType);
}

export function createEmptyPaymentData(): PaymentData {
  return {
    qr_code: null,
    qr_code_base64: null,
    copy_paste_code: null,
    expires_at: null,
    provider_transaction_id: null,
  };
}

export function normalizeLegacyOrderStatus(value: string): OrderStatus | null {
  if (value === 'shipped') {
    return 'out_for_delivery';
  }

  return isOrderStatus(value) ? value : null;
}

export function validatePaymentData(value: unknown): ContractValidationIssue[] {
  if (value === null) {
    return [];
  }

  if (!isRecord(value)) {
    return [{ field: 'payment_data', message: 'payment_data must be an object or null.' }];
  }

  const issues: ContractValidationIssue[] = [];

  const nullableStringFields: Array<keyof PaymentData> = [
    'qr_code',
    'qr_code_base64',
    'copy_paste_code',
    'expires_at',
    'provider_transaction_id',
  ];

  for (const field of nullableStringFields) {
    const fieldValue = value[field];

    if (fieldValue !== null && typeof fieldValue !== 'string') {
      issues.push({
        field: `payment_data.${field}`,
        message: `${field} must be a string or null.`,
      });
    }
  }

  return issues;
}

export function validateOrderItem(value: unknown, index = 0): ContractValidationIssue[] {
  if (!isRecord(value)) {
    return [{ field: `items[${index}]`, message: 'Each item must be an object.' }];
  }

  const issues: ContractValidationIssue[] = [];

  if (!isNonEmptyString(value.item_id)) {
    issues.push({ field: `items[${index}].item_id`, message: 'item_id is required.' });
  }

  if (!isNonEmptyString(value.product_id)) {
    issues.push({ field: `items[${index}].product_id`, message: 'product_id is required.' });
  }

  if (!isNonEmptyString(value.product_name)) {
    issues.push({ field: `items[${index}].product_name`, message: 'product_name is required.' });
  }

  if (!Number.isInteger(value.quantity) || Number(value.quantity) <= 0) {
    issues.push({ field: `items[${index}].quantity`, message: 'quantity must be a positive integer.' });
  }

  if (!isFiniteMoney(value.unit_price)) {
    issues.push({ field: `items[${index}].unit_price`, message: 'unit_price must be a non-negative number.' });
  }

  if (!isFiniteMoney(value.subtotal)) {
    issues.push({ field: `items[${index}].subtotal`, message: 'subtotal must be a non-negative number.' });
  }

  if (value.notes !== null && value.notes !== undefined && typeof value.notes !== 'string') {
    issues.push({ field: `items[${index}].notes`, message: 'notes must be a string or null.' });
  }

  if (!Array.isArray(value.addons)) {
    issues.push({ field: `items[${index}].addons`, message: 'addons must be an array.' });
  } else {
    value.addons.forEach((addon, addonIndex) => {
      if (!isRecord(addon)) {
        issues.push({
          field: `items[${index}].addons[${addonIndex}]`,
          message: 'Each addon must be an object.',
        });
        return;
      }

      if (!isNonEmptyString(addon.addon_id)) {
        issues.push({
          field: `items[${index}].addons[${addonIndex}].addon_id`,
          message: 'addon_id is required.',
        });
      }

      if (!isNonEmptyString(addon.name)) {
        issues.push({
          field: `items[${index}].addons[${addonIndex}].name`,
          message: 'name is required.',
        });
      }

      if (!Number.isInteger(addon.quantity) || Number(addon.quantity) <= 0) {
        issues.push({
          field: `items[${index}].addons[${addonIndex}].quantity`,
          message: 'quantity must be a positive integer.',
        });
      }

      if (!isFiniteMoney(addon.unit_price)) {
        issues.push({
          field: `items[${index}].addons[${addonIndex}].unit_price`,
          message: 'unit_price must be a non-negative number.',
        });
      }

      if (!isFiniteMoney(addon.total_price)) {
        issues.push({
          field: `items[${index}].addons[${addonIndex}].total_price`,
          message: 'total_price must be a non-negative number.',
        });
      }
    });
  }

  return issues;
}

export function validateOrderStatusHistoryEntry(value: unknown, index = 0): ContractValidationIssue[] {
  if (!isRecord(value)) {
    return [{ field: `status_history[${index}]`, message: 'Each status history entry must be an object.' }];
  }

  const issues: ContractValidationIssue[] = [];

  if (!isOrderStatus(value.status)) {
    issues.push({
      field: `status_history[${index}].status`,
      message: 'status must be a valid canonical order status.',
    });
  }

  if (!isNonEmptyString(value.changed_at)) {
    issues.push({
      field: `status_history[${index}].changed_at`,
      message: 'changed_at is required.',
    });
  }

  if (value.note !== null && value.note !== undefined && typeof value.note !== 'string') {
    issues.push({
      field: `status_history[${index}].note`,
      message: 'note must be a string or null.',
    });
  }

  if (value.source !== null && value.source !== undefined && typeof value.source !== 'string') {
    issues.push({
      field: `status_history[${index}].source`,
      message: 'source must be a string or null.',
    });
  }

  return issues;
}

export function validateCanonicalOrder(value: unknown): ContractValidationIssue[] {
  if (!isRecord(value)) {
    return [{ field: 'order', message: 'Order must be an object.' }];
  }

  const issues: ContractValidationIssue[] = [];

  if (!isNonEmptyString(value.order_id)) {
    issues.push({ field: 'order_id', message: 'order_id is required.' });
  }

  if (!isNonEmptyString(value.order_number)) {
    issues.push({ field: 'order_number', message: 'order_number is required.' });
  }

  if (!isOrderStatus(value.status)) {
    issues.push({ field: 'status', message: 'status is invalid.' });
  }

  if (!isPaymentMethod(value.payment_method)) {
    issues.push({ field: 'payment_method', message: 'payment_method is invalid.' });
  }

  if (!isPaymentStatus(value.payment_status)) {
    issues.push({ field: 'payment_status', message: 'payment_status is invalid.' });
  }

  const moneyFields: Array<keyof Pick<
    CanonicalOrder,
    'subtotal' | 'delivery_fee' | 'discount_amount' | 'total_amount'
  >> = ['subtotal', 'delivery_fee', 'discount_amount', 'total_amount'];

  for (const field of moneyFields) {
    if (!isFiniteMoney(value[field])) {
      issues.push({ field, message: `${field} must be a non-negative number.` });
    }
  }

  if (value.estimated_time_minutes !== null && value.estimated_time_minutes !== undefined) {
    if (!Number.isInteger(value.estimated_time_minutes) || Number(value.estimated_time_minutes) < 0) {
      issues.push({
        field: 'estimated_time_minutes',
        message: 'estimated_time_minutes must be a non-negative integer or null.',
      });
    }
  }

  if (!isFulfillmentType(value.fulfillment_type)) {
    issues.push({ field: 'fulfillment_type', message: 'fulfillment_type is invalid.' });
  }

  if (!Array.isArray(value.items) || value.items.length === 0) {
    issues.push({ field: 'items', message: 'items must be a non-empty array.' });
  } else {
    value.items.forEach((item, index) => {
      issues.push(...validateOrderItem(item, index));
    });
  }

  issues.push(...validatePaymentData(value.payment_data ?? null));

  if (value.status_history !== undefined) {
    if (!Array.isArray(value.status_history)) {
      issues.push({ field: 'status_history', message: 'status_history must be an array when provided.' });
    } else {
      value.status_history.forEach((entry, index) => {
        issues.push(...validateOrderStatusHistoryEntry(entry, index));
      });
    }
  }

  if (!isRecord(value.customer)) {
    issues.push({ field: 'customer', message: 'customer is required.' });
  } else {
    if (!isNonEmptyString(value.customer.name)) {
      issues.push({ field: 'customer.name', message: 'customer.name is required.' });
    }

    if (!isNonEmptyString(value.customer.phone)) {
      issues.push({ field: 'customer.phone', message: 'customer.phone is required.' });
    }

    if (value.customer.email !== undefined && value.customer.email !== null && typeof value.customer.email !== 'string') {
      issues.push({ field: 'customer.email', message: 'customer.email must be a string or null.' });
    }
  }

  if (value.delivery_address !== null) {
    if (!isRecord(value.delivery_address)) {
      issues.push({
        field: 'delivery_address',
        message: 'delivery_address must be an object or null.',
      });
    } else {
      if (!isNonEmptyString(value.delivery_address.street)) {
        issues.push({ field: 'delivery_address.street', message: 'street is required.' });
      }

      if (!isNonEmptyString(value.delivery_address.number)) {
        issues.push({ field: 'delivery_address.number', message: 'number is required.' });
      }

      if (!isNonEmptyString(value.delivery_address.city)) {
        issues.push({ field: 'delivery_address.city', message: 'city is required.' });
      }
    }
  }

  if (!isNonEmptyString(value.created_at)) {
    issues.push({ field: 'created_at', message: 'created_at is required.' });
  }

  if (!isNonEmptyString(value.updated_at)) {
    issues.push({ field: 'updated_at', message: 'updated_at is required.' });
  }

  return issues;
}

export function validateCreateOrderRequest(value: unknown): ContractValidationIssue[] {
  if (!isRecord(value)) {
    return [{ field: 'request', message: 'Request body must be an object.' }];
  }

  const issues: ContractValidationIssue[] = [];

  if (!isPaymentMethod(value.payment_method)) {
    issues.push({ field: 'payment_method', message: 'payment_method is invalid.' });
  }

  if (!isFulfillmentType(value.fulfillment_type)) {
    issues.push({ field: 'fulfillment_type', message: 'fulfillment_type is invalid.' });
  }

  if (!isNonEmptyString(value.restaurant_id) && !isNonEmptyString(value.restaurant_slug)) {
    issues.push({
      field: 'restaurant_id',
      message: 'restaurant_id or restaurant_slug is required.',
    });
  }

  if (!isRecord(value.customer)) {
    issues.push({ field: 'customer', message: 'customer is required.' });
  } else {
    if (!isNonEmptyString(value.customer.name)) {
      issues.push({ field: 'customer.name', message: 'customer.name is required.' });
    }

    if (!isNonEmptyString(value.customer.phone)) {
      issues.push({ field: 'customer.phone', message: 'customer.phone is required.' });
    }

    if (value.customer.email !== undefined && value.customer.email !== null && typeof value.customer.email !== 'string') {
      issues.push({ field: 'customer.email', message: 'customer.email must be a string or null.' });
    }
  }

  if (value.fulfillment_type === 'delivery') {
    if (!isRecord(value.delivery_address)) {
      issues.push({
        field: 'delivery_address',
        message: 'delivery_address is required for delivery orders.',
      });
    } else {
      if (!isNonEmptyString(value.delivery_address.street)) {
        issues.push({ field: 'delivery_address.street', message: 'street is required.' });
      }

      if (!isNonEmptyString(value.delivery_address.number)) {
        issues.push({ field: 'delivery_address.number', message: 'number is required.' });
      }

      if (!isNonEmptyString(value.delivery_address.city)) {
        issues.push({ field: 'delivery_address.city', message: 'city is required.' });
      }
    }
  }

  if (value.fulfillment_type === 'pickup' && value.delivery_address !== null && value.delivery_address !== undefined) {
    if (!isRecord(value.delivery_address)) {
      issues.push({
        field: 'delivery_address',
        message: 'delivery_address must be null or an object.',
      });
    }
  }

  if (!Array.isArray(value.items) || value.items.length === 0) {
    issues.push({ field: 'items', message: 'items must be a non-empty array.' });
  } else {
    value.items.forEach((item, index) => {
      if (!isRecord(item)) {
        issues.push({ field: `items[${index}]`, message: 'Each item must be an object.' });
        return;
      }

      if (!isNonEmptyString(item.product_id)) {
        issues.push({ field: `items[${index}].product_id`, message: 'product_id is required.' });
      }

      if (!Number.isInteger(item.quantity) || Number(item.quantity) <= 0) {
        issues.push({
          field: `items[${index}].quantity`,
          message: 'quantity must be a positive integer.',
        });
      }

      if (item.notes !== null && item.notes !== undefined && typeof item.notes !== 'string') {
        issues.push({
          field: `items[${index}].notes`,
          message: 'notes must be a string or null.',
        });
      }

      if (item.addons !== undefined) {
        if (!Array.isArray(item.addons)) {
          issues.push({
            field: `items[${index}].addons`,
            message: 'addons must be an array when provided.',
          });
        } else {
          item.addons.forEach((addon, addonIndex) => {
            if (!isRecord(addon)) {
              issues.push({
                field: `items[${index}].addons[${addonIndex}]`,
                message: 'Each addon selection must be an object.',
              });
              return;
            }

            if (!isNonEmptyString(addon.addon_id)) {
              issues.push({
                field: `items[${index}].addons[${addonIndex}].addon_id`,
                message: 'addon_id is required.',
              });
            }

            if (!Number.isInteger(addon.quantity) || Number(addon.quantity) <= 0) {
              issues.push({
                field: `items[${index}].addons[${addonIndex}].quantity`,
                message: 'quantity must be a positive integer.',
              });
            }
          });
        }
      }
    });
  }

  if (value.notes !== null && value.notes !== undefined && typeof value.notes !== 'string') {
    issues.push({ field: 'notes', message: 'notes must be a string or null.' });
  }

  if (value.coupon_code !== null && value.coupon_code !== undefined && typeof value.coupon_code !== 'string') {
    issues.push({ field: 'coupon_code', message: 'coupon_code must be a string or null.' });
  }

  return issues;
}
