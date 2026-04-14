import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api, AdminCategory } from '../services/api';
import { storage } from '../services/storage';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { parseCurrencyInput } from '../utils/format';

export default function ProductFormScreen({ route, navigation }: any) {
  const { restaurantId, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const editProduct = route.params?.product;

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [form, setForm] = useState({
    id: editProduct?.id,
    name: editProduct?.name || '',
    description: editProduct?.description || '',
    price: editProduct?.price?.toString() || '',
    promo_price: editProduct?.promo_price?.toString() || '',
    category_id: editProduct?.category_id || '',
    image_url: editProduct?.image_url || '',
    is_available: editProduct?.is_available ?? true,
  });

  useEffect(() => {
    if (!restaurantId) {
      setCategoriesLoading(false);
      return;
    }

    setCategoriesLoading(true);
    api.categories.list(restaurantId).then(({ data, error }) => {
      if (error) {
        Alert.alert('Erro', error.message);
      } else {
        setCategories(data || []);
      }

      setCategoriesLoading(false);
    });
  }, [restaurantId]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active !== false),
    [categories],
  );

  async function handlePickImage() {
    if (!restaurantId) {
      Alert.alert('Restaurante não encontrado', restaurantError || 'Não foi possível identificar o restaurante para o upload.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para enviar imagens.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: false,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    setUploading(true);
    try {
      const imageUrl = await storage.uploadImage(restaurantId, 'products', result.assets[0]);
      setForm((current) => ({ ...current, image_url: imageUrl }));
    } catch (error: any) {
      Alert.alert('Erro no upload', error?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!restaurantId) {
      Alert.alert('Restaurante não encontrado', restaurantError || 'Não foi possível identificar o restaurante para salvar.');
      return;
    }

    if (!form.name.trim() || !form.price || !form.category_id) {
      Alert.alert('Campos obrigatórios', 'Preencha nome, preço e categoria.');
      return;
    }

    const parsedPrice = Number.parseFloat(parseCurrencyInput(form.price));
    const parsedPromoPrice = form.promo_price ? Number.parseFloat(parseCurrencyInput(form.promo_price)) : null;

    if (Number.isNaN(parsedPrice)) {
      Alert.alert('Preço inválido', 'Informe um valor válido para o preço do produto.');
      return;
    }

    if (parsedPromoPrice !== null && Number.isNaN(parsedPromoPrice)) {
      Alert.alert('Preço promocional inválido', 'Informe um valor válido ou deixe o campo em branco.');
      return;
    }

    setLoading(true);
    const { error } = await api.products.upsert({
      id: form.id,
      restaurant_id: restaurantId,
      category_id: form.category_id,
      name: form.name.trim(),
      description: form.description.trim(),
      price: parsedPrice,
      promo_price: parsedPromoPrice,
      image_url: form.image_url || null,
      is_available: form.is_available,
    });

    if (error) {
      Alert.alert('Erro', error.message || 'Falha ao salvar o produto.');
      setLoading(false);
      return;
    }

    setLoading(false);
    Alert.alert('Produto salvo', editProduct ? 'Produto atualizado com sucesso.' : 'Produto criado com sucesso.');
    navigation.goBack();
  }

  return (
    <AppScreen scrollable keyboardAware contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="Catálogo"
        title={editProduct ? 'Editar produto' : 'Novo produto'}
        subtitle="Cadastre pratos, ajuste o preço e decida se o item já deve entrar na vitrine pública."
      />

      <TouchableOpacity style={styles.imageCard} onPress={handlePickImage} activeOpacity={0.88}>
        {form.image_url ? (
          <Image source={{ uri: form.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ImagePlus size={28} color={colors.primary} />
            <Text style={styles.imageTitle}>Selecionar imagem</Text>
            <Text style={styles.imageDescription}>A foto será enviada ao Supabase Storage e vinculada ao produto.</Text>
          </View>
        )}

        <View style={styles.cameraBadge}>
          {uploading ? <ActivityIndicator color={colors.white} /> : <Camera size={16} color={colors.white} />}
        </View>
      </TouchableOpacity>

      <Card>
        <Input
          label="Nome do produto"
          placeholder="Ex: Parmegiana da casa"
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
        />

        <Input
          label="Descrição"
          placeholder="Descreva ingredientes, acompanhamentos e observações."
          multiline
          value={form.description}
          onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
          inputStyle={styles.multilineInput}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Preço"
              placeholder="0,00"
              keyboardType="decimal-pad"
              value={form.price}
              onChangeText={(value) => setForm((current) => ({ ...current, price: parseCurrencyInput(value) }))}
              containerStyle={styles.priceField}
            />
          </View>
          <View style={styles.rowSpacer} />
          <View style={styles.flex}>
            <Input
              label="Preço promocional"
              placeholder="Opcional"
              keyboardType="decimal-pad"
              value={form.promo_price}
              onChangeText={(value) => setForm((current) => ({ ...current, promo_price: parseCurrencyInput(value) }))}
              containerStyle={styles.priceField}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Categoria ativa</Text>
        {categoriesLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.categoriesLoading} />
        ) : activeCategories.length === 0 ? (
          <Text style={styles.helperText}>Crie ou ative uma categoria antes de cadastrar um produto.</Text>
        ) : (
          <View style={styles.chipWrap}>
            {activeCategories.map((category) => {
              const selected = form.category_id === category.id;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setForm((current) => ({ ...current, category_id: category.id }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.fieldLabel}>Disponível no site</Text>
            <Text style={styles.switchDescription}>Quando ativo, o prato pode aparecer imediatamente no storefront.</Text>
          </View>
          <Switch
            value={form.is_available}
            onValueChange={(value) => setForm((current) => ({ ...current, is_available: value }))}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor={colors.white}
          />
        </View>

        <Button
          title={loading ? 'Salvando...' : 'Salvar produto'}
          onPress={handleSave}
          loading={loading}
          disabled={restaurantLoading || uploading || categoriesLoading || activeCategories.length === 0}
        />
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.huge * 2,
  },
  imageCard: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  imageTitle: {
    ...typography.subtitle,
    marginTop: spacing.md,
  },
  imageDescription: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multilineInput: {
    minHeight: 120,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowSpacer: {
    width: spacing.md,
  },
  priceField: {
    marginBottom: 0,
  },
  flex: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.darkText,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  categoriesLoading: {
    marginBottom: spacing.lg,
  },
  helperText: {
    ...typography.caption,
    marginBottom: spacing.lg,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.darkText,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  switchDescription: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
