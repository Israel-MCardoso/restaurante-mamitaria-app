import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Edit2, Plus, Shapes, Trash2 } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api } from '../services/api';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function CategoriesScreen() {
  const { restaurantId, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [restaurantId]);

  async function fetchCategories() {
    if (!restaurantId) {
      return;
    }

    const { data } = await api.categories.list(restaurantId);
    setCategories(data || []);
  }

  async function handleSave() {
    if (!name || !restaurantId) {
      Alert.alert('Categoria não salva', restaurantError || 'Informe o nome e confirme o restaurante vinculado.');
      return;
    }

    setSaving(true);
    const { error } = await api.categories.upsert({
      id: editId || undefined,
      name,
      restaurant_id: restaurantId,
      position: editId ? undefined : categories.length,
    });

    if (!error) {
      setName('');
      setEditId(null);
      Alert.alert('Tudo certo', editId ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
      fetchCategories();
    } else {
      Alert.alert('Erro', error.message);
    }
    setSaving(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Excluir categoria', 'Isso impacta o agrupamento dos produtos no site e no app. Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await api.categories.delete(id);
          if (!error) {
            fetchCategories();
          }
        },
      },
    ]);
  }

  return (
    <AppScreen padded={false}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              eyebrow="Estrutura"
              title="Categorias"
              subtitle="Organize o cardápio em grupos para o gestor atualizar rapidamente os pratos do dia."
            />
            <Card style={styles.formCard}>
              <Input label="Nome da categoria" placeholder="Ex: Pratos executivos" value={name} onChangeText={setName} />
              <Button
                title={editId ? 'Atualizar categoria' : 'Criar categoria'}
                onPress={handleSave}
                loading={saving}
                disabled={restaurantLoading}
              />
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>Posição {item.position ?? 0}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => { setName(item.name); setEditId(item.id); }}>
                <Edit2 size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Trash2 size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Shapes}
            title="Nenhuma categoria cadastrada"
            description="Crie as categorias para separar o cardápio por tipo de prato."
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
  formCard: {
    marginBottom: spacing.lg,
  },
  itemCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    ...typography.subtitle,
  },
  itemMeta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
