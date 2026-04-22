import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus } from 'lucide-react-native';
import { useRestaurant } from '../hooks/useRestaurant';
import { api, AdminAddon, AdminCategory } from '../services/api';
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
import { formatCurrency, parseCurrencyInput } from '../utils/format';

type ProductFormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  promo_price: string;
  category_id: string;
  image_url: string;
  is_available: boolean;
};

function buildInitialForm(editProduct?: any): ProductFormState {
  return {
    id: editProduct?.id,
    name: editProduct?.name || '',
    description: editProduct?.description || '',
    price: editProduct?.price?.toString() || '',
    promo_price: editProduct?.promo_price?.toString() || '',
    category_id: editProduct?.category_id || '',
    image_url: editProduct?.image_url || '',
    is_available: editProduct?.is_available ?? true,
  };
}

async function launchProductImagePicker() {
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
    base64: false,
  };

  if (Platform.OS === 'android') {
    console.info('[product-form] launching Android image picker without pre-request');
    return ImagePicker.launchImageLibraryAsync(pickerOptions);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  console.info('[product-form] iOS media permission result', {
    granted: permission.granted,
    status: permission.status,
    canAskAgain: permission.canAskAgain,
  });

  if (!permission.granted) {
    return null;
  }

  return ImagePicker.launchImageLibraryAsync(pickerOptions);
}

export default function ProductFormScreen({ route, navigation }: any) {
  const { restaurantId, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const editProduct = route.params?.product;
  const draftToken = route.params?.draftToken;

  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [availableAddons, setAvailableAddons] = useState<AdminAddon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [form, setForm] = useState<ProductFormState>(() => buildInitialForm(editProduct));
  const lastRouteStateKeyRef = useRef<string | null>(null);

  const resetFormState = useCallback(
    (reason: string) => {
      const nextForm = buildInitialForm(editProduct);
      setForm(nextForm);
      setLoading(false);
      setUploading(false);
      setIsPickingImage(false);
      setSelectedAddonIds([]);

      console.info('[product-form] form state reset', {
        reason,
        isEdit: Boolean(editProduct?.id),
        productId: editProduct?.id ?? null,
        draftToken: draftToken ?? null,
      });
    },
    [draftToken, editProduct],
  );

  useEffect(() => {
    const routeStateKey = `${editProduct?.id ?? 'new'}:${draftToken ?? 'default'}`;

    if (lastRouteStateKeyRef.current === routeStateKey) {
      console.info('[product-form] route state preserved', {
        routeStateKey,
      });
      return;
    }

    lastRouteStateKeyRef.current = routeStateKey;
    resetFormState('route-params-change');
  }, [draftToken, editProduct?.id, resetFormState]);

  useEffect(() => {
    console.info('[product-form] screen mounted', {
      isEdit: Boolean(editProduct?.id),
      productId: editProduct?.id ?? null,
      draftToken: draftToken ?? null,
    });

    return () => {
      console.info('[product-form] screen unmounted', {
        isEdit: Boolean(editProduct?.id),
        productId: editProduct?.id ?? null,
        draftToken: draftToken ?? null,
      });
    };
  }, [draftToken, editProduct?.id]);

  useEffect(() => {
    if (!restaurantId) {
      setCategoriesLoading(false);
      setAddonsLoading(false);
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

    setAddonsLoading(true);
    api.addons.list(restaurantId).then(({ data, error }) => {
      if (error) {
        Alert.alert('Erro', error.message);
      } else {
        setAvailableAddons((data || []).filter((addon) => addon.is_available !== false));
      }

      setAddonsLoading(false);
    });
  }, [restaurantId]);

  useEffect(() => {
    if (!editProduct?.id) {
      setSelectedAddonIds([]);
      return;
    }

    api.productAddons.list(editProduct.id).then(({ data, error }) => {
      if (error) {
        console.error('[product-form] failed to load product addons', {
          productId: editProduct.id,
          message: error.message ?? 'unknown error',
        });
        return;
      }

      setSelectedAddonIds(data || []);
    });
  }, [editProduct?.id]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active !== false),
    [categories],
  );

  const toggleAddon = useCallback((addonId: string) => {
    setSelectedAddonIds((current) =>
      current.includes(addonId) ? current.filter((id) => id !== addonId) : [...current, addonId],
    );
  }, []);

  async function handlePickImage() {
    if (restaurantLoading || uploading || isPickingImage) {
      console.info('[product-form] image picker blocked', {
        restaurantLoading,
        uploading,
        isPickingImage,
      });

      if (restaurantLoading) {
        Alert.alert('Aguarde', 'Estamos carregando o contexto do restaurante antes do upload.');
      }

      return;
    }

    setIsPickingImage(true);
    console.info('[product-form] image picker opening', {
      isEdit: Boolean(editProduct?.id),
      productId: editProduct?.id ?? null,
      draftToken: draftToken ?? null,
    });

    try {
      const permissionSnapshot = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.info('[product-form] media permission snapshot before picker', {
        granted: permissionSnapshot.granted,
        status: permissionSnapshot.status,
        canAskAgain: permissionSnapshot.canAskAgain,
      });

      const result = await launchProductImagePicker();
      if (!result) {
        console.warn('[product-form] image picker permission denied');
        Alert.alert('Permissao necessaria', 'Autorize o acesso a galeria para enviar imagens.');
        return;
      }

      if (result.canceled || !result.assets.length) {
        console.info('[product-form] image picker cancelled');
        return;
      }

      const selectedAsset = result.assets[0];
      const assetMimeType =
        typeof (selectedAsset as { mimeType?: unknown }).mimeType === 'string'
          ? ((selectedAsset as { mimeType?: string }).mimeType ?? null)
          : null;

      console.info('[product-form] image picker returned asset', {
        fileName: selectedAsset.fileName ?? null,
        mimeType: assetMimeType,
      });

      setUploading(true);
      try {
        const resolvedRestaurantId = await storage.ensureRestaurantId(restaurantId);
        console.info('[product-form] upload requested', {
          restaurantId: resolvedRestaurantId,
          categoryId: form.category_id || null,
        });
        const imageUrl = await storage.uploadImage(resolvedRestaurantId, 'products', selectedAsset);
        console.info('[product-form] upload finished', {
          restaurantId: resolvedRestaurantId,
          imageUrl,
        });
        setForm((current) => ({ ...current, image_url: imageUrl }));
      } catch (error: any) {
        console.error('[product-form] upload failed', {
          restaurantId: restaurantId ?? null,
          categoryId: form.category_id || null,
          message: error?.message ?? 'unknown error',
        });
        Alert.alert('Erro no upload', error?.message || 'Nao foi possivel enviar a imagem.');
      } finally {
        setUploading(false);
      }
    } catch (error: any) {
      console.error('[product-form] image picker failed', {
        message: error?.message ?? 'unknown error',
      });
      Alert.alert('Erro ao abrir galeria', error?.message || 'Nao foi possivel abrir a galeria agora.');
    } finally {
      console.info('[product-form] image picker flow finalized');
      setIsPickingImage(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price || !form.category_id) {
      Alert.alert('Campos obrigatorios', 'Preencha nome, preco e categoria.');
      return;
    }

    if (!activeCategories.some((category) => category.id === form.category_id)) {
      Alert.alert('Categoria invalida', 'Selecione uma categoria ativa do restaurante antes de salvar.');
      return;
    }

    const parsedPrice = Number.parseFloat(parseCurrencyInput(form.price));
    const parsedPromoPrice = form.promo_price ? Number.parseFloat(parseCurrencyInput(form.promo_price)) : null;

    if (Number.isNaN(parsedPrice)) {
      Alert.alert('Preco invalido', 'Informe um valor valido para o preco do produto.');
      return;
    }

    if (parsedPromoPrice !== null && Number.isNaN(parsedPromoPrice)) {
      Alert.alert('Preco promocional invalido', 'Informe um valor valido ou deixe o campo em branco.');
      return;
    }

    setLoading(true);

    try {
      const resolvedRestaurantId = await storage.ensureRestaurantId(restaurantId).catch((error: any) => {
        Alert.alert(
          'Restaurante nao encontrado',
          error?.message || restaurantError || 'Nao foi possivel identificar o restaurante para salvar.',
        );
        return null;
      });

      if (!resolvedRestaurantId) {
        return;
      }

      const { data: ownedCategory, error: categoryError } = await api.categories.validateOwnership(
        resolvedRestaurantId,
        form.category_id,
      );

      if (categoryError || !ownedCategory) {
        console.error('[product-form] category ownership validation failed', {
          restaurantId: resolvedRestaurantId,
          categoryId: form.category_id,
          message: categoryError?.message ?? 'category not found',
        });
        Alert.alert('Categoria invalida', 'A categoria selecionada nao pertence ao restaurante autenticado.');
        return;
      }

      console.info('[product-form] saving product', {
        restaurantId: resolvedRestaurantId,
        categoryId: form.category_id,
        hasImage: Boolean(form.image_url),
        isEdit: Boolean(form.id),
      });

      const { data: savedProduct, error } = await api.products.upsert({
        id: form.id,
        restaurant_id: resolvedRestaurantId,
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description.trim(),
        price: parsedPrice,
        promo_price: parsedPromoPrice,
        image_url: form.image_url || null,
        is_available: form.is_available,
      });

      if (error) {
        console.error('[product-form] product save failed', {
          restaurantId: resolvedRestaurantId,
          categoryId: form.category_id,
          message: error.message || 'unknown error',
        });
        Alert.alert('Erro', error.message || 'Falha ao salvar o produto.');
        return;
      }

      const savedProductId = savedProduct?.id ?? form.id;

      if (!savedProductId) {
        console.error('[product-form] product saved without id', {
          restaurantId: resolvedRestaurantId,
          categoryId: form.category_id,
        });
        Alert.alert('Erro', 'O produto foi salvo, mas nao foi possivel sincronizar os adicionais.');
        return;
      }

      const { error: addonSyncError } = await api.productAddons.replace(savedProductId, selectedAddonIds);

      if (addonSyncError) {
        console.error('[product-form] product addons sync failed', {
          productId: savedProductId,
          selectedAddonIds,
          message: addonSyncError.message ?? 'unknown error',
        });
        Alert.alert('Produto salvo parcialmente', 'O produto foi salvo, mas os adicionais nao puderam ser sincronizados agora.');
        return;
      }

      console.info('[product-form] product save succeeded', {
        restaurantId: resolvedRestaurantId,
        categoryId: form.category_id,
        productId: savedProductId,
        selectedAddonIds,
      });

      if (editProduct?.image_url && editProduct.image_url !== form.image_url) {
        await storage.removeImageByPublicUrl(editProduct.image_url);
      }

      resetFormState('save-success');
      Alert.alert('Produto salvo', editProduct ? 'Produto atualizado com sucesso.' : 'Produto criado com sucesso.');
      navigation.goBack();
    } catch (error: any) {
      console.error('[product-form] unexpected save error', {
        message: error?.message ?? 'unknown error',
      });
      Alert.alert('Erro', error?.message || 'Falha inesperada ao salvar o produto.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen scrollable keyboardAware contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="Catalogo"
        title={editProduct ? 'Editar produto' : 'Novo produto'}
        subtitle="Cadastre pratos, ajuste o preco e decida se o item ja deve entrar na vitrine publica."
      />

      <TouchableOpacity
        style={[styles.imageCard, (restaurantLoading || uploading || isPickingImage) && styles.imageCardDisabled]}
        onPress={handlePickImage}
        activeOpacity={0.88}
        disabled={restaurantLoading || uploading || isPickingImage}
      >
        {form.image_url ? (
          <Image source={{ uri: form.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ImagePlus size={28} color={colors.primary} />
            <Text style={styles.imageTitle}>Selecionar imagem</Text>
            <Text style={styles.imageDescription}>A foto sera enviada ao Supabase Storage e vinculada ao produto.</Text>
          </View>
        )}

        <View style={styles.cameraBadge}>
          {uploading || isPickingImage ? <ActivityIndicator color={colors.white} /> : <Camera size={16} color={colors.white} />}
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
          label="Descricao"
          placeholder="Descreva ingredientes, acompanhamentos e observacoes."
          multiline
          value={form.description}
          onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
          inputStyle={styles.multilineInput}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Preco"
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
              label="Preco promocional"
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
            <Text style={styles.fieldLabel}>Disponivel no site</Text>
            <Text style={styles.switchDescription}>Quando ativo, o prato pode aparecer imediatamente no storefront.</Text>
          </View>
          <Switch
            value={form.is_available}
            onValueChange={(value) => setForm((current) => ({ ...current, is_available: value }))}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor={colors.white}
          />
        </View>

        <Text style={styles.fieldLabel}>Adicionais disponiveis</Text>
        {addonsLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.categoriesLoading} />
        ) : availableAddons.length === 0 ? (
          <Text style={styles.helperText}>Cadastre adicionais no painel para vincula-los a este prato.</Text>
        ) : (
          <>
            <Text style={styles.helperText}>Selecione os complementos que podem aparecer para este produto no site.</Text>
            <View style={styles.chipWrap}>
              {availableAddons.map((addon) => {
                const selected = selectedAddonIds.includes(addon.id);

                return (
                  <TouchableOpacity
                    key={addon.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleAddon(addon.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {addon.name} {addon.price > 0 ? ` - ${formatCurrency(addon.price)}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Button
          title={loading ? 'Salvando...' : 'Salvar produto'}
          onPress={handleSave}
          loading={loading}
          disabled={
            restaurantLoading ||
            uploading ||
            isPickingImage ||
            categoriesLoading ||
            addonsLoading ||
            activeCategories.length === 0
          }
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
  imageCardDisabled: {
    opacity: 0.72,
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
