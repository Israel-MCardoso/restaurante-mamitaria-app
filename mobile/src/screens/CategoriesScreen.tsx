import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Edit2, Plus, Shapes, Trash2 } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api, AdminCategory } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function CategoriesScreen() {
  const { restaurantId, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      fetchCategories();
    } else if (!restaurantLoading) {
      setLoading(false);
    }
  }, [restaurantId, restaurantLoading]);

  async function fetchCategories(showLoader = true) {
    if (!restaurantId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    const { data, error } = await api.categories.list(restaurantId);

    if (error) {
      Alert.alert('Erro ao carregar categorias', error.message);
    } else {
      setCategories(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  function resetForm() {
    setName('');
    setEditId(null);
  }

  async function handleSave() {
    if (!name.trim() || !restaurantId) {
      Alert.alert('Categoria não salva', restaurantError || 'Informe o nome da categoria e confirme o restaurante.');
      return;
    }

    setSaving(true);
    const { error } = await api.categories.upsert({
      id: editId || undefined,
      name: name.trim(),
      restaurant_id: restaurantId,
      position: editId ? undefined : categories.length,
      is_active: true,
    });

    if (error) {
      Alert.alert('Erro', error.message);
      setSaving(false);
      return;
    }

    Alert.alert('Tudo certo', editId ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
    resetForm();
    setSaving(false);
    fetchCategories(false);
  }

  async function toggleActive(category: AdminCategory) {
    const { error } = await api.categories.upsert({
      id: category.id,
      restaurant_id: category.restaurant_id,
      name: category.name,
      position: category.position ?? 0,
      is_active: category.is_active === false,
    });

    if (error) {
      Alert.alert('Não foi possível atualizar', error.message);
      return;
    }

    fetchCategories(false);
  }

  function handleEdit(category: AdminCategory) {
    setName(category.name);
    setEditId(category.id);
  }

  function handleDelete(id: string) {
    Alert.alert('Excluir categoria', 'Isso remove a categoria do painel e afeta o agrupamento do cardápio público. Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await api.categories.delete(id);
          if (error) {
            Alert.alert('Não foi possível excluir', error.message);
            return;
          }

          fetchCategories(false);
        },
      },
    ]);
  }

  return (
    <AppScreen padded={false}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategories(false); }} />}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <PageHeader
                eyebrow="Estrutura"
                title="Categorias"
                subtitle="Organize o catálogo por grupos e controle o que entra ou sai da vitrine pública."
              />
              <Card style={styles.formCard}>
                <Input
                  label="Nome da categoria"
                  placeholder="Ex: Pratos executivos"
                  value={name}
                  onChangeText={setName}
                />
                <View style={styles.formActions}>
                  <Button
                    title={editId ? 'Atualizar categoria' : 'Criar categoria'}
                    onPress={handleSave}
                    loading={saving}
                    disabled={restaurantLoading}
                    style={styles.formButton}
                  />
                  {editId ? (
                    <Button title="Cancelar edição" variant="outline" onPress={resetForm} style={styles.formButton} />
                  ) : null}
                </View>
              </Card>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.itemCard}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.itemMeta}>Posição {item.position ?? 0}</Text>
                  <View style={[styles.statusBadge, item.is_active === false ? styles.statusBadgeOff : styles.statusBadgeOn]}>
                    <Text style={[styles.statusText, item.is_active === false ? styles.statusTextOff : styles.statusTextOn]}>
                      {item.is_active === false ? 'Oculta' : 'Ativa'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sideActions}>
                <Switch
                  value={item.is_active !== false}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.white}
                />
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleEdit(item)}>
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
              icon={Shapes}
              title="Nenhuma categoria cadastrada"
              description="Crie as categorias para estruturar o catálogo e refletir a organização correta no site."
            />
          }
        />
      )}
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
  formCard: {
    marginBottom: spacing.lg,
  },
  formActions: {
    gap: spacing.sm,
  },
  formButton: {
    width: '100%',
  },
  itemCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemCopy: {
    flex: 1,
  },
  itemName: {
    ...typography.subtitle,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  itemMeta: {
    ...typography.caption,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusBadgeOn: {
    backgroundColor: '#E7F4E8',
  },
  statusBadgeOff: {
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
  sideActions: {
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
