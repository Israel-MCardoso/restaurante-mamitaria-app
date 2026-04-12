import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ticket, Trash2 } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api } from '../services/api';
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
import { parseCurrencyInput } from '../utils/format';

export default function CouponsScreen() {
  const { restaurantId, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', discount_value: '', discount_type: 'fixed' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, [restaurantId]);

  async function fetchCoupons() {
    if (!restaurantId) {
      return;
    }

    const { data } = await api.coupons.list(restaurantId);
    setCoupons(data || []);
  }

  async function handleSave() {
    if (!restaurantId || !form.code || !form.discount_value) {
      Alert.alert('Cupom não salvo', restaurantError || 'Preencha código e valor do desconto.');
      return;
    }

    setSaving(true);
    const { error } = await api.coupons.upsert({
      ...form,
      code: form.code.toUpperCase(),
      discount_value: parseFloat(parseCurrencyInput(form.discount_value)),
      restaurant_id: restaurantId,
      is_active: true,
    });

    if (!error) {
      setForm({ code: '', discount_value: '', discount_type: 'fixed' });
      Alert.alert('Tudo certo', 'Cupom criado com sucesso.');
      fetchCoupons();
    } else {
      Alert.alert('Erro', error.message);
    }
    setSaving(false);
  }

  async function toggleStatus(item: any) {
    const { error } = await api.coupons.upsert({ ...item, is_active: !item.is_active });
    if (!error) {
      fetchCoupons();
    }
  }

  function handleDelete(id: string) {
    Alert.alert('Excluir cupom', 'Confirmar exclusão deste cupom?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await api.coupons.delete(id);
          if (!error) {
            fetchCoupons();
          }
        },
      },
    ]);
  }

  return (
    <AppScreen padded={false}>
      <FlatList
        data={coupons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <PageHeader
              eyebrow="Campanhas"
              title="Cupons"
              subtitle="Gerencie descontos sem sair do painel para refletir imediatamente na base de dados."
            />
            <Card style={styles.formCard}>
              <Input
                label="Código"
                placeholder="Ex: HOJE10"
                autoCapitalize="characters"
                value={form.code}
                onChangeText={(value) => setForm((current) => ({ ...current, code: value }))}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Input
                    label="Valor do desconto"
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    value={form.discount_value}
                    onChangeText={(value) => setForm((current) => ({ ...current, discount_value: parseCurrencyInput(value) }))}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.typeButton, form.discount_type === 'percentage' && styles.typeButtonActive]}
                  onPress={() =>
                    setForm((current) => ({
                      ...current,
                      discount_type: current.discount_type === 'fixed' ? 'percentage' : 'fixed',
                    }))
                  }
                >
                  <Text style={[styles.typeButtonText, form.discount_type === 'percentage' && styles.typeButtonTextActive]}>
                    {form.discount_type === 'fixed' ? 'R$' : '%'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Button title="Criar cupom" onPress={handleSave} loading={saving} disabled={restaurantLoading} />
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.flex}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.description}>
                Desconto de {item.discount_type === 'fixed' ? `R$ ${item.discount_value}` : `${item.discount_value}%`}
              </Text>
            </View>
            <Switch
              value={item.is_active}
              onValueChange={() => toggleStatus(item)}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={colors.white}
            />
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
              <Trash2 size={18} color={colors.error} />
            </TouchableOpacity>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Ticket}
            title="Nenhum cupom criado"
            description="Crie cupons para campanhas e ações comerciais do restaurante."
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  typeButton: {
    height: 52,
    minWidth: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    ...typography.button,
    color: colors.primary,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  itemCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  code: {
    ...typography.subtitle,
  },
  description: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  deleteButton: {
    marginLeft: spacing.md,
  },
});
