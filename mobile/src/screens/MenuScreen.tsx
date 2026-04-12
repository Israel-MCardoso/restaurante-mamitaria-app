import React, { useEffect, useState } from 'react';
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

export default function MenuScreen({ navigation }: any) {
  const { restaurantId, loading: loadingRestaurant } = useRestaurant();
  const [products, setProducts] = useState<any[]>([]);
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

    const { data } = await api.products.list(restaurantId);
    setProducts(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  async function toggleAvailability(id: string, current: boolean) {
    const { error } = await api.products.upsert({ id, is_available: !current });
    if (!error) {
      fetchMenu(false);
    }
  }

  function handleDelete(id: string) {
    Alert.alert('Excluir produto', 'Deseja realmente excluir este item do cardápio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await api.products.delete(id);
          if (!error) {
            fetchMenu(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  const shortcuts = [
    { label: 'Categorias', icon: Shapes, onPress: () => navigation.navigate('MenuCategories') },
    { label: 'Adicionais', icon: Plus, onPress: () => navigation.navigate('MenuAddons') },
    { label: 'Cupons', icon: Ticket, onPress: () => navigation.navigate('MenuCoupons') },
  ];

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
              title="Cardápio"
              subtitle="Gerencie disponibilidade, preços e atalhos de manutenção do seu catálogo."
            />
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
        renderItem={({ item }) => (
          <Card style={styles.productCard}>
            <Image
              source={{ uri: item.image_url || 'https://via.placeholder.com/160x160/F0E2D7/6B3E2E?text=Produto' }}
              style={styles.image}
            />

            <View style={styles.productInfo}>
              <Text style={styles.category}>{item.categories?.name || 'Sem categoria'}</Text>
              <Text style={styles.name}>{item.name}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <Text style={styles.price}>{formatCurrency(item.promo_price || item.price)}</Text>
            </View>

            <View style={styles.actions}>
              <Switch
                value={item.is_available}
                onValueChange={() => toggleAvailability(item.id, item.is_available)}
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
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Plus}
            title="Seu cardápio ainda está vazio"
            description="Cadastre o primeiro produto para começar a vender pelo aplicativo."
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('ProductForm')} activeOpacity={0.86}>
        <Plus size={24} color={colors.white} />
      </TouchableOpacity>
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
    paddingBottom: 96,
  },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  image: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  productInfo: {
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
    marginTop: spacing.xs,
  },
  price: {
    ...typography.body,
    color: colors.success,
    fontWeight: '700',
    marginTop: spacing.sm,
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
