import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CreditCard, MapPin, Phone } from 'lucide-react-native';
import { api } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatCurrency, formatDateTime } from '../utils/format';

const statusOptions = [
  { label: 'Confirmar', value: 'confirmed', variant: 'secondary' as const },
  { label: 'Preparar', value: 'preparing', variant: 'primary' as const },
  { label: 'Despachar', value: 'shipped', variant: 'outline' as const },
  { label: 'Entregar', value: 'delivered', variant: 'secondary' as const },
  { label: 'Cancelar', value: 'cancelled', variant: 'danger' as const },
];

export default function OrderDetailScreen({ route }: any) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  async function fetchOrderDetails() {
    setLoading(true);
    const { data, error } = await api.orders.details(orderId);

    if (error || !data) {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do pedido.');
      setLoading(false);
      return;
    }

    setOrder(data);
    setItems(data.order_items || []);
    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    const { error } = await api.orders.updateStatus(orderId, newStatus);

    if (error) {
      Alert.alert('Erro', 'Falha ao atualizar o status do pedido.');
    } else {
      setOrder((current: any) => ({ ...current, status: newStatus }));
    }

    setUpdating(false);
  }

  if (loading || !order) {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  const deliveryAddress = order.delivery_address || {};

  return (
    <AppScreen scrollable>
      <PageHeader
        eyebrow="Pedido"
        title={`#${order.id.slice(0, 8)}`}
        subtitle={`Criado em ${formatDateTime(order.created_at)}`}
      />

      <Card style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Status atual</Text>
          <Badge status={order.status} />
        </View>

        <View style={styles.actionsWrap}>
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              title={option.label}
              variant={option.variant}
              disabled={updating || order.status === option.value}
              onPress={() => updateStatus(option.value)}
              style={styles.statusButton}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.customerName}>{order.customer_name}</Text>
            <Text style={styles.customerPhone}>{order.customer_phone}</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customer_phone}`)} style={styles.actionCircle}>
            <Phone size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <MapPin size={18} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {deliveryAddress.street || 'Rua não informada'}, {deliveryAddress.number || 's/n'} -{' '}
            {deliveryAddress.city || 'Cidade não informada'}
          </Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Itens do pedido</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemQuantity}>
              <Text style={styles.itemQuantityText}>{item.quantity}x</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemName}>{item.products?.name || 'Produto removido'}</Text>
              {item.observations ? <Text style={styles.itemObservation}>{item.observations}</Text> : null}
            </View>
            <Text style={styles.itemPrice}>{formatCurrency(item.subtotal)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(Number(order.total_amount) - Number(order.delivery_fee || 0))}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Taxa de entrega</Text>
          <Text style={styles.totalValue}>{formatCurrency(order.delivery_fee)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(order.total_amount)}</Text>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Pagamento</Text>
        <View style={styles.rowBetween}>
          <View style={styles.paymentInfo}>
            <CreditCard size={18} color={colors.textSecondary} />
            <Text style={styles.infoText}>{String(order.payment_method || '').toUpperCase()}</Text>
          </View>
          <View style={[styles.paymentBadge, order.payment_status === 'paid' ? styles.paidBadge : styles.pendingBadge]}>
            <Text style={styles.paymentBadgeText}>
              {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
            </Text>
          </View>
        </View>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statusButton: {
    minWidth: 124,
  },
  flex: {
    flex: 1,
  },
  customerName: {
    ...typography.subtitle,
  },
  customerPhone: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  actionCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  infoText: {
    ...typography.body,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  itemQuantity: {
    minWidth: 42,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  itemQuantityText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  itemName: {
    ...typography.body,
    color: colors.darkText,
    fontWeight: '600',
  },
  itemObservation: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  itemPrice: {
    ...typography.body,
    color: colors.success,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
  },
  totalValue: {
    ...typography.body,
    color: colors.darkText,
  },
  grandTotalLabel: {
    ...typography.subtitle,
  },
  grandTotalValue: {
    ...typography.subtitle,
    color: colors.success,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  paymentBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  paidBadge: {
    backgroundColor: '#E4F4E7',
  },
  pendingBadge: {
    backgroundColor: '#FBECCC',
  },
  paymentBadgeText: {
    ...typography.caption,
    color: colors.darkText,
    fontWeight: '700',
  },
});
