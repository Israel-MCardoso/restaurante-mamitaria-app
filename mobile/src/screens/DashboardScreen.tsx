import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DollarSign, Package, ShoppingBag, Store, Tags, TrendingUp } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatCurrency } from '../utils/format';

export default function DashboardScreen({ navigation }: any) {
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();
  const [stats, setStats] = useState({
    revenue: 0,
    count: 0,
    ticket: 0,
    activeProducts: 0,
    activeCategories: 0,
  });
  const [restaurantName, setRestaurantName] = useState('Restaurante');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      fetchStats();
    } else if (!loadingRestaurant) {
      setLoading(false);
    }
  }, [restaurantId, loadingRestaurant]);

  async function fetchStats() {
    if (!restaurantId) {
      return;
    }

    setLoading(true);

    const [summary, products, categories, restaurant] = await Promise.all([
      api.stats.summary(restaurantId),
      api.products.list(restaurantId),
      api.categories.list(restaurantId),
      api.restaurants.get(restaurantId),
    ]);

    setStats({
      revenue: summary.revenue,
      count: summary.count,
      ticket: summary.ticket,
      activeProducts: (products.data || []).filter((product) => product.is_available !== false).length,
      activeCategories: (categories.data || []).filter((category) => category.is_active !== false).length,
    });
    setRestaurantName(restaurant.data?.name || 'Restaurante');
    setRestaurantSlug(restaurant.data?.slug || '');
    setLoading(false);
  }

  const statCards = [
    { label: 'Faturamento hoje', value: formatCurrency(stats.revenue), icon: DollarSign, color: colors.success },
    { label: 'Pedidos hoje', value: String(stats.count), icon: ShoppingBag, color: colors.primary },
    { label: 'Produtos ativos', value: String(stats.activeProducts), icon: Package, color: colors.accent },
    { label: 'Categorias ativas', value: String(stats.activeCategories), icon: Tags, color: '#9C5C2B' },
    { label: 'Ticket médio', value: formatCurrency(stats.ticket), icon: TrendingUp, color: '#8A5642' },
  ];

  const shortcuts = [
    { label: 'Produtos', icon: Package, onPress: () => navigation.navigate('Catálogo') },
    { label: 'Categorias', icon: Tags, onPress: () => navigation.navigate('Categorias') },
    { label: 'Ajustes', icon: Store, onPress: () => navigation.navigate('Ajustes') },
  ];

  return (
    <AppScreen scrollable>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        subtitle="Painel operacional do restaurante para manter o catálogo atualizado e a loja pública consistente."
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <Card style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Store size={22} color={colors.primary} />
            </View>
            <Text style={styles.heroEyebrow}>Operação conectada</Text>
            <Text style={styles.heroTitle}>{restaurantName}</Text>
            <Text style={styles.heroCopy}>
              {restaurantSlug
                ? `Tudo o que você ativar aqui reflete na vitrine pública em /${restaurantSlug}.`
                : 'Ative categorias e produtos aqui para manter a vitrine pública alinhada com a operação.'}
            </Text>
          </Card>

          <View style={styles.grid}>
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} style={styles.statCard}>
                <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
                  <Icon size={22} color={color} />
                </View>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </Card>
            ))}
          </View>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Atalhos</Text>
            <View style={styles.shortcutRow}>
              {shortcuts.map(({ label, icon: Icon, onPress }) => (
                <TouchableOpacity key={label} style={styles.shortcut} onPress={onPress} activeOpacity={0.85}>
                  <View style={styles.shortcutIcon}>
                    <Icon size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.shortcutLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Resumo rápido</Text>
            <Text style={styles.summaryText}>
              Use o catálogo para publicar ou ocultar itens, organize as categorias da casa e mantenha as informações da
              loja prontas para o cliente final sem sair do app.
            </Text>
          </Card>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.huge * 2,
  },
  heroCard: {
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.md,
  },
  heroEyebrow: {
    ...typography.overline,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typography.title,
  },
  heroCopy: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '47%',
    minWidth: 150,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statLabel: {
    ...typography.caption,
  },
  statValue: {
    ...typography.subtitle,
    marginTop: spacing.xs,
  },
  sectionCard: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.md,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shortcut: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.none,
  },
  shortcutLabel: {
    ...typography.body,
    color: colors.darkText,
    fontWeight: '600',
  },
  summaryText: {
    ...typography.body,
  },
});
