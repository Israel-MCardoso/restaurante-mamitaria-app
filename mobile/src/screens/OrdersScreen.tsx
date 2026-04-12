import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Clock3, ShoppingBag } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useRestaurant } from '../hooks/useRestaurant';
import { api } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatCurrency, formatTime } from '../utils/format';

export default function OrdersScreen({ navigation }: any) {
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      if (!loadingRestaurant) {
        setLoading(false);
      }
      return;
    }

    fetchOrders();

    const subscription = supabase
      .channel(`restaurant-orders-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [restaurantId, loadingRestaurant]);

  async function fetchOrders(showLoader = true) {
    if (!restaurantId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    const { data, error } = await api.orders.list(restaurantId);
    if (!error) {
      setOrders(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  if (loading) {
    return (
      <AppScreen padded={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen padded={false}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(false); }} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              eyebrow="Operação"
              title="Pedidos"
              subtitle="Acompanhe os pedidos em tempo real e entre no detalhe para atualizar o status."
            />
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          >
            <Card style={styles.orderCard}>
              <View style={styles.rowBetween}>
                <Badge status={item.status} />
                <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
              </View>

              <Text style={styles.customerName}>{item.customer_name}</Text>

              <View style={styles.metaRow}>
                <View style={styles.timeWrap}>
                  <Clock3 size={16} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{formatTime(item.created_at)}</Text>
                </View>
                <Text style={styles.total}>{formatCurrency(item.total_amount)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowBetween}>
                <Text style={styles.linkText}>Ver detalhes do pedido</Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={ShoppingBag}
            title="Nenhum pedido encontrado"
            description="Assim que novos pedidos entrarem, eles aparecerão aqui."
          />
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing.huge,
  },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  orderCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    ...typography.caption,
  },
  customerName: {
    ...typography.subtitle,
    marginTop: spacing.md,
  },
  metaRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
  },
  total: {
    ...typography.subtitle,
    color: colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
