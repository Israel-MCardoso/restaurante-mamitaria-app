import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DollarSign, Package, Store, Tags, TrendingUp } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api, type DashboardMetrics, type SalesPeriod } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatCurrency } from '../utils/format';

type OverviewStats = {
  metrics: DashboardMetrics;
  activeProducts: number;
  activeCategories: number;
};

const emptyMetrics: DashboardMetrics = {
  timezone: 'America/Sao_Paulo',
  validStatuses: [],
  paidPendingPaymentStatuses: [],
  periods: {
    day: { revenue: 0, ordersCount: 0, itemsSold: 0, ticketAverage: 0 },
    month: { revenue: 0, ordersCount: 0, itemsSold: 0, ticketAverage: 0 },
    year: { revenue: 0, ordersCount: 0, itemsSold: 0, ticketAverage: 0 },
  },
};

const periodLabels: Record<SalesPeriod, string> = {
  day: 'Hoje',
  month: 'Mês',
  year: 'Ano',
};

const periodOrder: SalesPeriod[] = ['day', 'month', 'year'];

export default function DashboardScreen({ navigation }: any) {
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();
  const [stats, setStats] = useState<OverviewStats>({
    metrics: emptyMetrics,
    activeProducts: 0,
    activeCategories: 0,
  });
  const [restaurantName, setRestaurantName] = useState('Restaurante');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (restaurantId) {
      fetchStats();
    } else if (!loadingRestaurant) {
      setLoading(false);
    }
  }, [restaurantId, loadingRestaurant]);

  async function fetchStats(showLoader = true) {
    if (!restaurantId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const [metrics, products, categories, restaurant] = await Promise.all([
        api.stats.dashboardMetrics(restaurantId),
        api.products.list(restaurantId),
        api.categories.list(restaurantId),
        api.restaurants.get(restaurantId),
      ]);

      setStats({
        metrics,
        activeProducts: (products.data || []).filter((product) => product.is_available !== false).length,
        activeCategories: (categories.data || []).filter((category) => category.is_active !== false).length,
      });
      setRestaurantName(restaurant.data?.name || 'Restaurante');
      setRestaurantSlug(restaurant.data?.slug || '');
    } catch (error) {
      console.error('[DashboardScreen] failed to load dashboard metrics', error);
      setErrorMessage('Nao foi possivel carregar os indicadores agora.');
      setStats({
        metrics: emptyMetrics,
        activeProducts: 0,
        activeCategories: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    if (!restaurantId) {
      return;
    }

    setRefreshing(true);
    await fetchStats(false);
  }

  const operationalCards = [
    { label: 'Produtos ativos', value: String(stats.activeProducts), icon: Package, color: colors.accent },
    { label: 'Categorias ativas', value: String(stats.activeCategories), icon: Tags, color: '#9C5C2B' },
  ];

  const shortcuts = [
    { label: 'Produtos', icon: Package, onPress: () => navigation.navigate('Catálogo') },
    { label: 'Categorias', icon: Tags, onPress: () => navigation.navigate('Categorias') },
    { label: 'Ajustes', icon: Store, onPress: () => navigation.navigate('Ajustes') },
  ];

  const validStatusesLabel = [
    ...stats.metrics.validStatuses,
    ...stats.metrics.paidPendingPaymentStatuses.map((status) => `pending:${status}`),
  ].join(', ');

  return (
    <AppScreen scrollable refreshing={refreshing} onRefresh={handleRefresh}>
      <PageHeader
        eyebrow="Visao geral"
        title="Dashboard"
        subtitle="Painel operacional do restaurante para acompanhar vendas e manter o catalogo atualizado com seguranca."
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
            <Text style={styles.heroEyebrow}>Operacao conectada</Text>
            <Text style={styles.heroTitle}>{restaurantName}</Text>
            <Text style={styles.heroCopy}>
              {restaurantSlug
                ? `Tudo o que voce ativar aqui reflete na vitrine publica em /${restaurantSlug}.`
                : 'Ative categorias e produtos aqui para manter a vitrine publica alinhada com a operacao.'}
            </Text>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Indicadores por periodo</Text>
            <Text style={styles.sectionCopy}>
              Faturamento, pedidos validos e ticket medio calculados no fuso {stats.metrics.timezone}.
            </Text>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.periodGrid}>
              {periodOrder.map((period) => {
                const metrics = stats.metrics.periods[period];
                const hasSales = metrics.ordersCount > 0;

                return (
                  <Card key={period} style={styles.periodCard}>
                    <Text style={styles.periodLabel}>{periodLabels[period]}</Text>
                    <View style={styles.metricRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: `${colors.success}18` }]}>
                        <DollarSign size={18} color={colors.success} />
                      </View>
                      <View style={styles.metricCopy}>
                        <Text style={styles.metricTitle}>Faturamento</Text>
                        <Text style={styles.metricValue}>{formatCurrency(metrics.revenue)}</Text>
                      </View>
                    </View>
                    <View style={styles.metricRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: `${colors.primary}18` }]}>
                        <Package size={18} color={colors.primary} />
                      </View>
                      <View style={styles.metricCopy}>
                        <Text style={styles.metricTitle}>Pedidos validos</Text>
                        <Text style={styles.metricValue}>{String(metrics.ordersCount)}</Text>
                      </View>
                    </View>
                    <View style={styles.metricRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#8A564218' }]}>
                        <TrendingUp size={18} color="#8A5642" />
                      </View>
                      <View style={styles.metricCopy}>
                        <Text style={styles.metricTitle}>Ticket medio</Text>
                        <Text style={styles.metricValue}>{formatCurrency(metrics.ticketAverage)}</Text>
                      </View>
                    </View>
                    <Text style={styles.periodMeta}>
                      {hasSales
                        ? `${metrics.itemsSold} itens vendidos no periodo. Ticket medio = faturamento / pedidos validos.`
                        : 'Ainda nao houve vendas validas neste periodo.'}
                    </Text>
                  </Card>
                );
              })}
            </View>
          </Card>

          <View style={styles.grid}>
            {operationalCards.map(({ label, value, icon: Icon, color }) => (
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
            <Text style={styles.sectionTitle}>Regra de apuracao</Text>
            <Text style={styles.summaryText}>
              Entram no faturamento os pedidos com status {validStatusesLabel || 'configurados na operacao atual'}.
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
  sectionCard: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  sectionCopy: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  periodGrid: {
    gap: spacing.md,
  },
  periodCard: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodLabel: {
    ...typography.overline,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricCopy: {
    flex: 1,
  },
  metricTitle: {
    ...typography.caption,
  },
  metricValue: {
    ...typography.subtitle,
    marginTop: spacing.xs,
  },
  periodMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
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
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.md,
  },
});
