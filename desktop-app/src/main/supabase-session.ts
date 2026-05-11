import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { getBackendConfig } from './config';
import type {
  CatalogAddon,
  CatalogCategory,
  CatalogData,
  CatalogProduct,
  CatalogProductOptionGroup,
  CatalogProductOptionItem,
  CatalogProductSavePayload,
  OperationalUser,
  OrderAddon,
  OrderDetail,
  OrderItemDetail,
  OrderOption,
  OrderStatus,
  PrintedOrderState,
  PrinterLane,
  UserRole,
} from '../shared/types';

type AdminProfile = {
  id: string;
  restaurant_id: string | null;
  role: UserRole | string | null;
};

type RestaurantRow = {
  id: string;
  name: string;
  phone: string | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  subtotal: number | string;
  delivery_fee: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  estimated_time_minutes: number | null;
  customer_name: string;
  customer_phone: string;
  notes: string | null;
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address: Record<string, unknown> | null;
  printed_at?: string | null;
  customer_printed_at?: string | null;
  kitchen_printed_at?: string | null;
  print_attempts?: number | null;
};

type OrderItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  observations: string | null;
  addons_json: unknown;
  options_json: unknown;
};

type OrderWithItemsRow = OrderRow & {
  order_items?: OrderItemRow[] | null;
};

type ProductCategoryRelation = {
  name?: string | null;
  is_active?: boolean | null;
} | null;

type ProductRow = Omit<CatalogProduct, 'category' | 'addonIds' | 'optionGroups'> & {
  category?: ProductCategoryRelation | ProductCategoryRelation[];
  categories?: ProductCategoryRelation | ProductCategoryRelation[];
};

const ORDER_PRINT_TRACKING_COLUMNS =
  'printed_at, customer_printed_at, kitchen_printed_at, print_attempts';

const ORDER_BASE_COLUMNS =
  'id, order_number, created_at, updated_at, status, payment_status, payment_method, subtotal, delivery_fee, discount_amount, total_amount, estimated_time_minutes, customer_name, customer_phone, notes, fulfillment_type, delivery_address';

const ORDER_LIST_SELECT_WITH_PRINT = `${ORDER_BASE_COLUMNS}, ${ORDER_PRINT_TRACKING_COLUMNS}`;
const ORDER_LIST_SELECT_NO_PRINT = ORDER_BASE_COLUMNS;
const ORDER_WITH_ITEMS_SELECT_WITH_PRINT = `${ORDER_BASE_COLUMNS}, ${ORDER_PRINT_TRACKING_COLUMNS}, order_items(id, product_id, product_name, quantity, unit_price, subtotal, observations, addons_json, options_json)`;
const ORDER_WITH_ITEMS_SELECT_NO_PRINT = `${ORDER_BASE_COLUMNS}, order_items(id, product_id, product_name, quantity, unit_price, subtotal, observations, addons_json, options_json)`;

function toMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAddons(value: unknown): OrderAddon[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const addon = entry as Record<string, unknown>;
      return {
        addon_id: typeof addon.addon_id === 'string' ? addon.addon_id : undefined,
        name: typeof addon.name === 'string' ? addon.name : 'Adicional',
        quantity: Number(addon.quantity ?? 1),
        unit_price: toMoney(addon.unit_price as number | string | null | undefined),
        total_price: toMoney(addon.total_price as number | string | null | undefined),
      };
    });
}

function normalizeOptions(value: unknown): OrderOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const option = entry as Record<string, unknown>;
      return {
        option_id: typeof option.option_id === 'string' ? option.option_id : undefined,
        option_name: typeof option.option_name === 'string' ? option.option_name : 'Opcao',
        option_item_id: typeof option.option_item_id === 'string' ? option.option_item_id : undefined,
        option_item_name:
          typeof option.option_item_name === 'string' ? option.option_item_name : 'Item',
        price_adjustment: toMoney(option.price_adjustment as number | string | null | undefined),
      };
    });
}

function normalizeItems(itemsData: OrderItemRow[] | null | undefined): OrderItemDetail[] {
  return (itemsData ?? []).map((item) => ({
    item_id: item.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: toMoney(item.unit_price),
    subtotal: toMoney(item.subtotal),
    notes: item.observations,
    addons: normalizeAddons(item.addons_json),
    options: normalizeOptions(item.options_json),
  }));
}

function buildPrintState(row: OrderRow): PrintedOrderState | null {
  if (
    !row.printed_at &&
    !row.customer_printed_at &&
    !row.kitchen_printed_at &&
    !(row.print_attempts && row.print_attempts > 0)
  ) {
    return null;
  }

  const pendingLanes = [];
  if (!row.customer_printed_at) {
    pendingLanes.push('client');
  }
  if (!row.kitchen_printed_at) {
    pendingLanes.push('kitchen');
  }

  return {
    orderId: row.id,
    orderNumber: row.order_number,
    firstDetectedAt: null,
    lastSource: null,
    lastAttemptMode: null,
    lastAttemptAt: null,
    lastSuccessAt: row.printed_at ?? row.customer_printed_at ?? row.kitchen_printed_at ?? null,
    lastFailureAt: null,
    customerPrintedAt: row.customer_printed_at ?? null,
    kitchenPrintedAt: row.kitchen_printed_at ?? null,
    printedAt: row.printed_at ?? null,
    printAttempts: Number(row.print_attempts ?? 0),
    lastError: null,
    retryBlockedUntil: null,
    pendingLanes: pendingLanes as Array<'client' | 'kitchen'>,
  };
}

function mapOrderRow(row: OrderWithItemsRow): OrderDetail {
  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    paymentStatus: row.payment_status as OrderDetail['paymentStatus'],
    paymentMethod: row.payment_method as OrderDetail['paymentMethod'],
    subtotal: toMoney(row.subtotal),
    deliveryFee: toMoney(row.delivery_fee),
    discountAmount: toMoney(row.discount_amount),
    totalAmount: toMoney(row.total_amount),
    estimatedTimeMinutes: row.estimated_time_minutes,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    fulfillmentType: row.fulfillment_type,
    deliveryAddress: row.delivery_address,
    items: normalizeItems(row.order_items),
    printState: buildPrintState(row),
  };
}

function normalizeProductCategory(product: ProductRow): CatalogProduct['category'] {
  const relation = product.category ?? product.categories ?? null;
  const normalizedRelation = Array.isArray(relation) ? relation[0] ?? null : relation;

  if (!normalizedRelation || typeof normalizedRelation !== 'object') {
    return null;
  }

  return {
    name: normalizedRelation.name ?? null,
    is_active: normalizedRelation.is_active ?? null,
  };
}

function normalizeImageContentType(extension: string) {
  switch (extension.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function buildSafeUploadFileName(filePath: string) {
  const extension = extname(filePath).toLowerCase() || '.jpg';
  const base = basename(filePath, extension)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${Date.now()}-${base || 'imagem'}-${Math.random().toString(36).slice(2, 8)}${extension}`;
}

function isMissingPrintTrackingColumnsError(error: unknown) {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '');

  const normalized = message.toLowerCase();
  return (
    normalized.includes('printed_at') ||
    normalized.includes('customer_printed_at') ||
    normalized.includes('kitchen_printed_at') ||
    normalized.includes('print_attempts') ||
    normalized.includes('could not find the') ||
    normalized.includes('column')
  );
}

export class DesktopSupabase {
  private client: SupabaseClient | null = null;
  private printTrackingColumnsAvailable = true;

  private getClient() {
    if (!this.client) {
      const backendConfig = getBackendConfig();
      this.client = createClient(backendConfig.supabaseUrl, backendConfig.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
      });
    }

    return this.client;
  }

  async login(email: string, password: string) {
    const client = this.getClient();
    const normalizedEmail = email.trim();
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Nao foi possivel autenticar este restaurante.');
    }

    const operator = await this.resolveOperationalUser(data.user.id, data.user.email ?? normalizedEmail);
    return {
      session: data.session,
      operator,
      client,
    };
  }

  async requestPasswordReset(email: string) {
    const client = this.getClient();
    const normalizedEmail = email.trim();
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail);

    if (error) {
      throw new Error(error.message || 'Nao foi possivel solicitar a recuperacao de senha.');
    }
  }

  async restoreSession(accessToken: string, refreshToken: string) {
    const client = this.getClient();
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new Error('Sessao local invalida ou expirada.');
    }

    const operator = await this.resolveOperationalUser(data.user.id, data.user.email ?? '');
    return {
      session: data.session,
      operator,
      client,
    };
  }

  async logout() {
    const client = this.getClient();
    await client.auth.signOut();
  }

  async fetchOrdersEligibleForPrinting(restaurantId: string) {
    const client = this.getClient();
    const runQuery = async (includePrintTracking: boolean) =>
      client
        .from('orders')
        .select((includePrintTracking ? ORDER_LIST_SELECT_WITH_PRINT : ORDER_LIST_SELECT_NO_PRINT) as any)
        .eq('restaurant_id', restaurantId)
        .not('status', 'in', '(delivered,cancelled)')
        .order('created_at', { ascending: false })
        .limit(50);

    let response = await runQuery(this.printTrackingColumnsAvailable);

    if (response.error && this.printTrackingColumnsAvailable && isMissingPrintTrackingColumnsError(response.error)) {
      this.printTrackingColumnsAvailable = false;
      response = await runQuery(false);
    }

    if (response.error) {
      throw new Error(response.error.message || 'Nao foi possivel consultar os pedidos para impressao.');
    }

    return (response.data ?? []) as unknown as OrderRow[];
  }

  async fetchOperationalOrders(restaurantId: string): Promise<OrderDetail[]> {
    const client = this.getClient();
    const runQuery = async (includePrintTracking: boolean) =>
      client
        .from('orders')
        .select((includePrintTracking ? ORDER_WITH_ITEMS_SELECT_WITH_PRINT : ORDER_WITH_ITEMS_SELECT_NO_PRINT) as any)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(80);

    let response = await runQuery(this.printTrackingColumnsAvailable);

    if (response.error && this.printTrackingColumnsAvailable && isMissingPrintTrackingColumnsError(response.error)) {
      this.printTrackingColumnsAvailable = false;
      response = await runQuery(false);
    }

    if (response.error) {
      throw new Error(response.error.message || 'Nao foi possivel carregar a fila operacional.');
    }

    return ((response.data ?? []) as unknown as OrderWithItemsRow[]).map(mapOrderRow);
  }

  async fetchOrderDetail(orderId: string, restaurantId: string): Promise<OrderDetail> {
    const client = this.getClient();
    const runQuery = async (includePrintTracking: boolean) =>
      client
        .from('orders')
        .select((includePrintTracking ? ORDER_WITH_ITEMS_SELECT_WITH_PRINT : ORDER_WITH_ITEMS_SELECT_NO_PRINT) as any)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    let response = await runQuery(this.printTrackingColumnsAvailable);

    if (response.error && this.printTrackingColumnsAvailable && isMissingPrintTrackingColumnsError(response.error)) {
      this.printTrackingColumnsAvailable = false;
      response = await runQuery(false);
    }

    if (response.error || !response.data) {
      throw new Error(response.error?.message || 'Pedido nao encontrado para impressao.');
    }

    return mapOrderRow(response.data as unknown as OrderWithItemsRow);
  }

  async updateOrderStatus(orderId: string, restaurantId: string, status: OrderStatus) {
    const client = this.getClient();
    const { data, error } = await client
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .select('id, status, updated_at')
      .maybeSingle();

    if (error || !data) {
      throw new Error('Nao foi possivel atualizar o status do pedido.');
    }

    return data;
  }

  async markOrderLanePrinted(orderId: string, restaurantId: string, lane: PrinterLane) {
    const client = this.getClient();
    const now = new Date().toISOString();
    const laneColumn = lane === 'client' ? 'customer_printed_at' : 'kitchen_printed_at';

    const { data: currentOrder, error: fetchError } = await client
      .from('orders')
      .select(`id, printed_at, customer_printed_at, kitchen_printed_at, print_attempts, ${laneColumn}`)
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (fetchError || !currentOrder) {
      throw new Error('Nao foi possivel carregar o estado de impressao do pedido.');
    }

    const nextCustomerPrintedAt =
      lane === 'client' ? ((currentOrder as Record<string, unknown>).customer_printed_at as string | null) ?? now : ((currentOrder as Record<string, unknown>).customer_printed_at as string | null) ?? null;
    const nextKitchenPrintedAt =
      lane === 'kitchen' ? ((currentOrder as Record<string, unknown>).kitchen_printed_at as string | null) ?? now : ((currentOrder as Record<string, unknown>).kitchen_printed_at as string | null) ?? null;
    const nextPrintedAt =
      nextCustomerPrintedAt && nextKitchenPrintedAt
        ? (((currentOrder as Record<string, unknown>).printed_at as string | null) ?? now)
        : ((currentOrder as Record<string, unknown>).printed_at as string | null) ?? null;
    const nextAttemptCount = Math.max(Number((currentOrder as Record<string, unknown>).print_attempts ?? 0), 1);

    const { error } = await client
      .from('orders')
      .update({
        [laneColumn]: now,
        customer_printed_at: nextCustomerPrintedAt,
        kitchen_printed_at: nextKitchenPrintedAt,
        printed_at: nextPrintedAt,
        print_attempts: nextAttemptCount,
        updated_at: now,
      })
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error('Nao foi possivel persistir o status de impressao do pedido.');
    }
  }

  async fetchCatalog(restaurantId: string): Promise<CatalogData> {
    const client = this.getClient();

    const [categoriesResponse, addonsResponse, productsResponse] = await Promise.all([
      client
        .from('categories')
        .select('id, restaurant_id, name, position, is_active, created_at')
        .eq('restaurant_id', restaurantId)
        .order('position', { ascending: true }),
      client
        .from('addons')
        .select('id, restaurant_id, name, price, is_available, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),
      client
        .from('products')
        .select('id, restaurant_id, category_id, name, description, price, promo_price, image_url, is_available, created_at, category:categories(name, is_active)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),
    ]);

    if (categoriesResponse.error) {
      throw new Error(categoriesResponse.error.message || 'Nao foi possivel carregar categorias.');
    }
    if (addonsResponse.error) {
      throw new Error(addonsResponse.error.message || 'Nao foi possivel carregar adicionais.');
    }
    if (productsResponse.error) {
      throw new Error(productsResponse.error.message || 'Nao foi possivel carregar produtos.');
    }

    const productRows = (productsResponse.data ?? []) as unknown as ProductRow[];
    const productIds = productRows.map((product) => product.id);
    const addonIdsByProduct = new Map<string, string[]>();
    const optionsByProduct = new Map<string, CatalogProductOptionGroup[]>();

    if (productIds.length > 0) {
      const [productAddonsResponse, optionGroupsResponse] = await Promise.all([
        client
          .from('product_addons')
          .select('product_id, addon_id')
          .in('product_id', productIds),
        client
          .from('product_options')
          .select('id, product_id, name, min_select, max_select, position')
          .in('product_id', productIds)
          .order('position', { ascending: true }),
      ]);

      if (productAddonsResponse.error) {
        throw new Error(productAddonsResponse.error.message || 'Nao foi possivel carregar adicionais dos produtos.');
      }
      if (optionGroupsResponse.error) {
        throw new Error(optionGroupsResponse.error.message || 'Nao foi possivel carregar variacoes dos produtos.');
      }

      for (const row of (productAddonsResponse.data ?? []) as Array<{ product_id: string; addon_id: string }>) {
        const current = addonIdsByProduct.get(row.product_id) ?? [];
        current.push(row.addon_id);
        addonIdsByProduct.set(row.product_id, current);
      }

      const optionGroups = (optionGroupsResponse.data ?? []) as Array<Omit<CatalogProductOptionGroup, 'items'>>;
      const optionIds = optionGroups.map((group) => group.id).filter((id): id is string => Boolean(id));
      const itemsByOption = new Map<string, CatalogProductOptionItem[]>();

      if (optionIds.length > 0) {
        const optionItemsResponse = await client
          .from('product_option_items')
          .select('id, option_id, name, price_adjustment, is_available, position')
          .in('option_id', optionIds)
          .order('position', { ascending: true });

        if (optionItemsResponse.error) {
          throw new Error(optionItemsResponse.error.message || 'Nao foi possivel carregar itens das variacoes.');
        }

        for (const item of (optionItemsResponse.data ?? []) as CatalogProductOptionItem[]) {
          const optionId = item.option_id ?? '';
          const current = itemsByOption.get(optionId) ?? [];
          current.push(item);
          itemsByOption.set(optionId, current);
        }
      }

      for (const group of optionGroups) {
        const productGroups = optionsByProduct.get(group.product_id ?? '') ?? [];
        productGroups.push({
          ...group,
          items: itemsByOption.get(group.id ?? '') ?? [],
        });
        optionsByProduct.set(group.product_id ?? '', productGroups);
      }
    }

    return {
      categories: (categoriesResponse.data ?? []) as CatalogCategory[],
      addons: ((addonsResponse.data ?? []) as CatalogAddon[]).map((addon) => ({
        ...addon,
        price: toMoney(addon.price),
      })),
      products: productRows.map((product) => ({
        ...product,
        price: toMoney(product.price),
        promo_price: product.promo_price === null || product.promo_price === undefined ? null : toMoney(product.promo_price),
        category: normalizeProductCategory(product),
        addonIds: addonIdsByProduct.get(product.id) ?? [],
        optionGroups: optionsByProduct.get(product.id) ?? [],
      })),
    };
  }

  async saveCatalogCategory(restaurantId: string, category: Partial<CatalogCategory>) {
    const client = this.getClient();
    const { error } = await client.from('categories').upsert({
      id: category.id,
      restaurant_id: restaurantId,
      name: category.name,
      position: category.position ?? 0,
      is_active: category.is_active ?? true,
    });

    if (error) {
      throw new Error(error.message || 'Nao foi possivel salvar a categoria.');
    }
  }

  async deleteCatalogCategory(id: string, restaurantId: string) {
    const client = this.getClient();
    const { error } = await client.from('categories').delete().eq('id', id).eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message || 'Nao foi possivel excluir a categoria.');
    }
  }

  async saveCatalogAddon(restaurantId: string, addon: Partial<CatalogAddon>) {
    const client = this.getClient();
    const { error } = await client.from('addons').upsert({
      id: addon.id,
      restaurant_id: restaurantId,
      name: addon.name,
      price: addon.price ?? 0,
      is_available: addon.is_available ?? true,
    });

    if (error) {
      throw new Error(error.message || 'Nao foi possivel salvar o adicional.');
    }
  }

  async deleteCatalogAddon(id: string, restaurantId: string) {
    const client = this.getClient();
    const { error } = await client.from('addons').delete().eq('id', id).eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message || 'Nao foi possivel excluir o adicional.');
    }
  }

  async saveCatalogProduct(restaurantId: string, payload: CatalogProductSavePayload): Promise<string> {
    const client = this.getClient();
    const { data: ownedCategory, error: categoryError } = await client
      .from('categories')
      .select('id, restaurant_id')
      .eq('id', payload.category_id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (categoryError || !ownedCategory) {
      throw new Error('A categoria selecionada nao pertence ao restaurante autenticado.');
    }

    const { data: savedProduct, error: productError } = await client
      .from('products')
      .upsert({
        id: payload.id,
        restaurant_id: restaurantId,
        category_id: payload.category_id,
        name: payload.name,
        description: payload.description ?? '',
        price: payload.price,
        promo_price: payload.promo_price,
        image_url: payload.image_url,
        is_available: payload.is_available,
      })
      .select('id')
      .single();

    if (productError || !savedProduct) {
      throw new Error(productError?.message || 'Nao foi possivel salvar o produto.');
    }

    const productId = (savedProduct as { id: string }).id;

    const deleteAddonsResponse = await client.from('product_addons').delete().eq('product_id', productId);
    if (deleteAddonsResponse.error) {
      throw new Error(deleteAddonsResponse.error.message || 'Produto salvo, mas falhou ao sincronizar adicionais.');
    }

    if (payload.addonIds.length > 0) {
      const insertAddonsResponse = await client
        .from('product_addons')
        .insert(payload.addonIds.map((addonId) => ({ product_id: productId, addon_id: addonId })));
      if (insertAddonsResponse.error) {
        throw new Error(insertAddonsResponse.error.message || 'Produto salvo, mas falhou ao vincular adicionais.');
      }
    }

    const existingGroupsResponse = await client.from('product_options').select('id').eq('product_id', productId);
    if (existingGroupsResponse.error) {
      throw new Error(existingGroupsResponse.error.message || 'Produto salvo, mas falhou ao carregar variacoes antigas.');
    }

    const existingGroupIds = (((existingGroupsResponse as { data?: Array<{ id: string }> | null }).data) ?? []).map((group) => group.id);
    if (existingGroupIds.length > 0) {
      const deleteItemsResponse = await client.from('product_option_items').delete().in('option_id', existingGroupIds);
      if (deleteItemsResponse.error) {
        throw new Error(deleteItemsResponse.error.message || 'Produto salvo, mas falhou ao limpar itens antigos.');
      }
    }

    const deleteGroupsResponse = await client.from('product_options').delete().eq('product_id', productId);
    if (deleteGroupsResponse.error) {
      throw new Error(deleteGroupsResponse.error.message || 'Produto salvo, mas falhou ao limpar variacoes antigas.');
    }

    if (payload.optionGroups.length > 0) {
      const { data: insertedGroups, error: insertGroupsError } = await client
        .from('product_options')
        .insert(
          payload.optionGroups.map((group, index) => ({
            product_id: productId,
            name: group.name,
            min_select: group.min_select ?? 1,
            max_select: group.max_select ?? 1,
            position: index,
          })),
        )
        .select('id');

      if (insertGroupsError) {
        throw new Error(insertGroupsError.message || 'Produto salvo, mas falhou ao criar variacoes.');
      }

      const itemRows = ((insertedGroups ?? []) as Array<{ id: string }>).flatMap((group, groupIndex) =>
        (payload.optionGroups[groupIndex]?.items ?? []).map((item, itemIndex) => ({
          option_id: group.id,
          name: item.name,
          price_adjustment: item.price_adjustment,
          is_available: item.is_available ?? true,
          position: itemIndex,
        })),
      );

      if (itemRows.length > 0) {
        const insertItemsResponse = await client.from('product_option_items').insert(itemRows);
        if (insertItemsResponse.error) {
          throw new Error(insertItemsResponse.error.message || 'Produto salvo, mas falhou ao criar itens das variacoes.');
        }
      }
    }

    return productId;
  }

  async archiveCatalogProduct(id: string, restaurantId: string) {
    const client = this.getClient();
    const { error } = await client
      .from('products')
      .update({ is_available: false })
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(error.message || 'Nao foi possivel arquivar o produto.');
    }
  }

  async uploadCatalogProductImage(restaurantId: string, filePath: string) {
    const client = this.getClient();
    const extension = extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
      throw new Error('Selecione uma imagem JPG, PNG ou WEBP.');
    }

    const fileName = buildSafeUploadFileName(filePath);
    const storagePath = `${restaurantId}/products/${fileName}`;
    const fileBody = await readFile(filePath);
    const contentType = normalizeImageContentType(extension);

    const { error } = await client.storage.from('products').upload(storagePath, fileBody, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(error.message || 'Nao foi possivel enviar a imagem para o storage.');
    }

    const { data } = client.storage.from('products').getPublicUrl(storagePath);
    if (!data.publicUrl) {
      throw new Error('Upload concluido, mas a URL publica da imagem nao foi gerada.');
    }

    return data.publicUrl;
  }

  subscribeToRestaurantOrders(
    restaurantId: string,
    onOrderChanged: (order: OrderRow) => void,
    onStatusChanged: (connected: boolean) => void,
  ) {
    const client = this.getClient();
    const channel = client
      .channel(`desktop-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const candidate = payload.new as OrderRow | undefined;
          if (candidate?.id) {
            onOrderChanged(candidate);
          }
        },
      )
      .subscribe((status) => {
        onStatusChanged(status === 'SUBSCRIBED');
      });

    return () => {
      client.removeChannel(channel);
      onStatusChanged(false);
    };
  }

  private async resolveOperationalUser(userId: string, email: string): Promise<OperationalUser> {
    const client = this.getClient();
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, restaurant_id, role')
      .eq('id', userId)
      .maybeSingle();

    const adminProfile = profile as AdminProfile | null;

    if (profileError || !adminProfile?.restaurant_id) {
      throw new Error('Nao encontramos um restaurante vinculado a este usuario.');
    }

    if (adminProfile.role !== 'admin' && adminProfile.role !== 'manager') {
      throw new Error('Este usuario nao possui permissao operacional para o desktop.');
    }

    const { data: restaurant, error: restaurantError } = await client
      .from('restaurants')
      .select('id, name, phone')
      .eq('id', adminProfile.restaurant_id)
      .maybeSingle();

    if (restaurantError || !restaurant) {
      throw new Error('Nao foi possivel carregar os dados do restaurante.');
    }

    const restaurantRow = restaurant as RestaurantRow;

    return {
      userId,
      email,
      restaurantId: adminProfile.restaurant_id,
      restaurantName: restaurantRow.name,
      restaurantPhone: restaurantRow.phone,
      role: adminProfile.role as UserRole,
    };
  }
}
