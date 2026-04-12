import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { User } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatCurrency } from '../utils/format';

export default function CustomersScreen() {
  const { restaurantId } = useRestaurant();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      fetchCustomers();
    } else {
      setLoading(false);
    }
  }, [restaurantId]);

  async function fetchCustomers() {
    if (!restaurantId) {
      return;
    }

    setLoading(true);
    const { data } = await api.customers.list(restaurantId);
    const formatted = (data || [])
      .map((customer: any) => ({
        ...customer,
        totalSpent: customer.orders?.reduce((acc: number, order: any) => acc + Number(order.total_amount), 0) || 0,
        ordersCount: customer.orders?.length || 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    setCustomers(formatted);
    setLoading(false);
  }

  return (
    <AppScreen padded={false}>
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={loading}
        onRefresh={fetchCustomers}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              eyebrow="Relacionamento"
              title="Clientes"
              subtitle="Acompanhe quem mais compra e tenha uma visão rápida do histórico por cliente."
            />
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.avatar}>
              <User size={22} color={colors.primary} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.full_name || 'Cliente sem nome'}</Text>
              <Text style={styles.phone}>{item.customer_phone || 'Telefone não informado'}</Text>
              <Text style={styles.stats}>{item.ordersCount} pedidos realizados</Text>
            </View>
            <View style={styles.spent}>
              <Text style={styles.spentLabel}>Total gasto</Text>
              <Text style={styles.spentValue}>{formatCurrency(item.totalSpent)}</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={User}
            title="Nenhum cliente encontrado"
            description="Os clientes aparecerão aqui conforme os pedidos forem feitos no site."
          />
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.huge,
  },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  itemCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    ...typography.subtitle,
  },
  phone: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  stats: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  spent: {
    alignItems: 'flex-end',
  },
  spentLabel: {
    ...typography.caption,
  },
  spentValue: {
    ...typography.body,
    color: colors.success,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
