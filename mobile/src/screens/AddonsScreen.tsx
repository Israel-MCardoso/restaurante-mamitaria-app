import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlusCircle, Trash2 } from 'lucide-react-native';
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
import { formatCurrency, parseCurrencyInput } from '../utils/format';

export default function AddonsScreen() {
  const { restaurantId, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [addons, setAddons] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', price: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAddons();
  }, [restaurantId]);

  async function fetchAddons() {
    if (!restaurantId) {
      return;
    }

    const { data } = await api.addons.list(restaurantId);
    setAddons(data || []);
  }

  async function handleSave() {
    if (!restaurantId || !form.name || !form.price) {
      Alert.alert('Adicional não salvo', restaurantError || 'Preencha nome e preço para continuar.');
      return;
    }

    setSaving(true);
    const { error } = await api.addons.upsert({
      ...form,
      price: parseFloat(parseCurrencyInput(form.price)),
      restaurant_id: restaurantId,
    });

    if (!error) {
      setForm({ name: '', price: '' });
      Alert.alert('Tudo certo', 'Adicional criado com sucesso.');
      fetchAddons();
    } else {
      Alert.alert('Erro', error.message);
    }
    setSaving(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Excluir adicional', 'Confirmar exclusão deste adicional?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await api.addons.delete(id);
          if (!error) {
            fetchAddons();
          }
        },
      },
    ]);
  }

  return (
    <AppScreen padded={false}>
      <FlatList
        data={addons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              eyebrow="Complementos"
              title="Adicionais"
              subtitle="Cadastre extras para que os pratos do site e do app possam evoluir com flexibilidade."
            />
            <Card style={styles.formCard}>
              <Input
                label="Nome do adicional"
                placeholder="Ex: Ovo, bacon extra, queijo"
                value={form.name}
                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
              />
              <Input
                label="Preço"
                placeholder="0,00"
                keyboardType="decimal-pad"
                value={form.price}
                onChangeText={(value) => setForm((current) => ({ ...current, price: parseCurrencyInput(value) }))}
              />
              <Button title="Adicionar adicional" onPress={handleSave} loading={saving} disabled={restaurantLoading} />
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Trash2 size={18} color={colors.error} />
            </TouchableOpacity>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={PlusCircle}
            title="Nenhum adicional cadastrado"
            description="Cadastre complementos para montar pratos personalizados."
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
  itemPrice: {
    ...typography.body,
    color: colors.success,
    marginTop: spacing.xs,
  },
});
