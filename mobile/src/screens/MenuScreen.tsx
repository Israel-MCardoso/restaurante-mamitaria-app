import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Edit2, Plus, Shapes, Ticket, Trash2 } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api, AdminProduct } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatCurrency } from '../utils/format';

export default function MenuScreen({ navigation }: any) {
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      fetchMenu();
    } else if (!loadingRestaurant) {
      setLoading(false);
    }
  }, [restaurantId, loadingRestaurant]);

  async function fetchMenu(showLoader = true) {
    if (!restaurantId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    const { data, error } = await api.products.list(restaurantId);

    if (error) {
      Alert.alert('Erro ao carregar produtos', error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  async function toggleAvailability(product: AdminProduct) {
    const { error } = await api.products.upsert({
      id: product.id,
      restaurant_id: product.restaurant_id,
      category_id: product.category_id,
      name: product.name,
      description: product.description,
      price: product.price,
      promo_price: product.promo_price,
      image_url: product.image_url,
      is_available: product.is_available === false,
    });

    if (error) {
      Alert.alert('Não foi possível atualizar', error.message);
      return;
    }

    fetchMenu(false);
  }

  function handleDelete(productId: string) {
    Alert.alert('Excluir produto', 'Deseja realmente excluir este item do catálogo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await api.products.delete(productId);
          if (error) {
            Alert.alert('Não foi possível excluir', error.message);
            return;
          }

          fetchMenu(false);
        },
      },
    ]);
  }

  const shortcuts = [
    { label: 'Categorias', icon: Shapes, onPress: () => navigation.navigate('MenuCategories') },
    { label: 'Adicionais', icon: Plus, onPress: () => navigation.navigate('MenuAddons') },
    { label: 'Cupons', icon: Ticket, onPress: () => navigation.navigate('MenuCoupons') },
  ];

  const summary = useMemo(() => {
    const activeProducts = products.filter((product) => product.is_available !== false).length;
    const hiddenProducts = products.length - activeProducts;

    return {
      total: products.length,
      activeProducts,
      hiddenProducts,
    };
  }, [products]);

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen padded={false}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMenu(false); }} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              eyebrow="Catálogo"
              title="Produtos"
              subtitle="Cadastre pratos, ajuste preço e controle o que fica disponível para o cliente final."
            />

            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>No catálogo</Text>
                <Text style={styles.summaryValue}>{summary.total}</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Ativos no site</Text>
                <Text style={styles.summaryValue}>{summary.activeProducts}</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Ocultos</Text>
                <Text style={styles.summaryValue}>{summary.hiddenProducts}</Text>
              </Card>
            </View>

            <View style={styles.shortcutRow}>
              {shortcuts.map(({ label, icon: Icon, onPress }) => (
                <TouchableOpacity key={label} style={styles.shortcut} onPress={onPress} activeOpacity={0.86}>
                  <Icon size={18} color={colors.primary} />
                  <Text style={styles.shortcutLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const category = item.category;
          const categoryName = productCategoryName(item);
          const isCategoryInactive = category?.is_active === false;
          const displayPrice = item.promo_price || item.price;

          return (
            <Card style={[styles.productCard, item.is_available === false && styles.productCardMuted]}>
              <Image
                source={{ uri: item.image_url || 'https://via.placeholder.com/160x160/F0E2D7/6B3E2E?text=Produto' }}
                style={styles.image}
              />

              <View style={styles.productInfo}>
                <View style={styles.productHeader}>
                  <View style={styles.productCopy}>
                    <Text style={styles.category}>{categoryName}</Text>
                    <Text style={styles.name}>{item.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, item.is_available === false ? styles.statusOff : styles.statusOn]}>
                    <Text style={[styles.statusText, item.is_available === false ? styles.statusTextOff : styles.statusTextOn]}>
                      {item.is_available === false ? 'Oculto' : 'Ativo'}
                    </Text>
                  </View>
                </View>

                {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

                <View style={styles.metaRow}>
                  <Text style={styles.price}>{formatCurrency(displayPrice)}</Text>
                  {isCategoryInactive ? <Text style={styles.metaWarning}>Categoria oculta no site</Text> : null}
                </View>
              </View>

              <View style={styles.actions}>
                <Switch
                  value={item.is_available !== false}
                  onValueChange={() => toggleAvailability(item)}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.white}
                />
                <View style={styles.iconRow}>
                  <TouchableOpacity onPress={() => navigation.navigate('ProductForm', { product: item })}>
                    <Edit2 size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Trash2 size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={Plus}
            title="Seu catálogo ainda está vazio"
            description="Cadastre o primeiro produto para começar a operar o cardápio pelo app."
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('ProductForm')} activeOpacity={0.86}>
        <Plus size={24} color={colors.white} />
      </TouchableOpacity>
    </AppScreen>
  );
}

function productCategoryName(product: AdminProduct) {
  return product.category?.name ?? 'SEM CATEGORIA';
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 96,
  },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    minHeight: 92,
  },
  summaryLabel: {
    ...typography.caption,
  },
  summaryValue: {
    ...typography.title,
    marginTop: spacing.xs,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  shortcut: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  shortcutLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  productCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  productCardMuted: {
    opacity: 0.76,
  },
  image: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  productInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productCopy: {
    flex: 1,
  },
  category: {
    ...typography.overline,
    color: colors.primary,
  },
  name: {
    ...typography.subtitle,
    marginTop: spacing.xs,
  },
  description: {
    ...typography.caption,
  },
  metaRow: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  price: {
    ...typography.body,
    color: colors.success,
    fontWeight: '700',
  },
  metaWarning: {
    ...typography.caption,
    color: colors.accent,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusOn: {
    backgroundColor: '#E7F4E8',
  },
  statusOff: {
    backgroundColor: colors.surfaceMuted,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
  },
  statusTextOn: {
    color: colors.success,
  },
  statusTextOff: {
    color: colors.textMuted,
  },
  actions: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  iconRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
