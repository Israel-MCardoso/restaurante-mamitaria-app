import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, LogOut } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useRestaurant } from '../hooks/useRestaurant';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

export default function SettingsScreen() {
  const { restaurantId, loading: restaurantLoading, error: restaurantError, debug } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'logo_url' | 'banner_url' | null>(null);
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    if (!restaurantLoading) {
      fetchRestaurantData();
    }
  }, [restaurantId, restaurantLoading]);

  async function fetchRestaurantData() {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const { data, error } = await api.restaurants.get(restaurantId);
    if (error) {
      Alert.alert('Erro ao carregar ajustes', error.message);
      setRestaurant(null);
      setLoading(false);
      return;
    }

    setRestaurant(data || null);
    setLoading(false);
  }

  async function handleUpload(field: 'logo_url' | 'banner_url') {
    if (!restaurantId) {
      Alert.alert('Restaurante não encontrado', restaurantError || 'Não foi possível identificar o restaurante para envio da imagem.');
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
      quality: 0.85,
      base64: false,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    setUploadingField(field);
    try {
      const publicUrl = await storage.uploadImage(restaurantId, 'settings', result.assets[0]);
      setRestaurant((current: any) => ({ ...current, [field]: publicUrl }));
    } catch (error: any) {
      Alert.alert('Erro no upload', error?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSave() {
    if (!restaurant) {
      Alert.alert('Restaurante não encontrado', restaurantError || 'Não há dados do restaurante para salvar.');
      return;
    }

    setSaving(true);
    const { error } = await api.restaurants.update(restaurant.id, {
      name: restaurant.name,
      phone: restaurant.phone,
      address: restaurant.address,
      logo_url: restaurant.logo_url,
      banner_url: restaurant.banner_url,
    });

    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } else {
      Alert.alert('Tudo certo', 'Dados do restaurante atualizados com sucesso.');
    }
    setSaving(false);
  }

  if (restaurantLoading || loading) {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  if (!restaurantId || !restaurant) {
    return (
      <AppScreen scrollable>
        <PageHeader
          eyebrow="Operação"
          title="Ajustes"
          subtitle="Use esta área para manter os dados do restaurante alinhados com o site."
          rightAction={{ icon: LogOut, onPress: () => supabase.auth.signOut(), color: colors.error }}
        />
        <Card>
          <EmptyState
            icon={Camera}
            title="Restaurante não carregado"
            description={restaurantError || 'Não foi possível encontrar um restaurante vinculado ao usuário atual.'}
          />
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>Diagnostico</Text>
            <Text style={styles.debugText}>user_id: {debug.userId || '-'}</Text>
            <Text style={styles.debugText}>email: {debug.email || '-'}</Text>
            <Text style={styles.debugText}>profile.restaurant_id: {debug.profileRestaurantId || '-'}</Text>
            <Text style={styles.debugText}>metadata.restaurant_id: {debug.metadataRestaurantId || '-'}</Text>
            <Text style={styles.debugText}>resolvedRestaurantId: {debug.resolvedRestaurantId || '-'}</Text>
          </View>
        </Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable keyboardAware>
      <PageHeader
        eyebrow="Operação"
        title="Ajustes"
        subtitle="Mantenha os dados do restaurante alinhados com o site e com o painel administrativo."
        rightAction={{ icon: LogOut, onPress: () => supabase.auth.signOut(), color: colors.error }}
      />

      <Card style={styles.mediaCard} noPadding>
        <TouchableOpacity style={styles.bannerWrap} onPress={() => handleUpload('banner_url')} activeOpacity={0.88}>
          {restaurant.banner_url ? (
            <Image source={{ uri: restaurant.banner_url }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder]} />
          )}
          <View style={styles.mediaBadge}>
            {uploadingField === 'banner_url' ? <ActivityIndicator color={colors.white} /> : <Camera size={16} color={colors.white} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoWrap} onPress={() => handleUpload('logo_url')} activeOpacity={0.88}>
          {restaurant.logo_url ? (
            <Image source={{ uri: restaurant.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]} />
          )}
          <View style={styles.logoBadge}>
            {uploadingField === 'logo_url' ? <ActivityIndicator color={colors.white} /> : <Camera size={14} color={colors.white} />}
          </View>
        </TouchableOpacity>
      </Card>

      <Card>
        <Input
          label="Nome da loja"
          value={restaurant.name || ''}
          onChangeText={(value) => setRestaurant((current: any) => ({ ...current, name: value }))}
        />
        <Input
          label="Telefone"
          value={restaurant.phone || ''}
          keyboardType="phone-pad"
          onChangeText={(value) => setRestaurant((current: any) => ({ ...current, phone: value }))}
        />
        <Input
          label="Rua"
          value={restaurant.address?.street || ''}
          onChangeText={(value) =>
            setRestaurant((current: any) => ({
              ...current,
              address: { ...(current.address || {}), street: value },
            }))
          }
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Número"
              value={restaurant.address?.number || ''}
              onChangeText={(value) =>
                setRestaurant((current: any) => ({
                  ...current,
                  address: { ...(current.address || {}), number: value },
                }))
              }
            />
          </View>
          <View style={styles.rowSpacer} />
          <View style={styles.flex}>
            <Input
              label="Cidade"
              value={restaurant.address?.city || ''}
              onChangeText={(value) =>
                setRestaurant((current: any) => ({
                  ...current,
                  address: { ...(current.address || {}), city: value },
                }))
              }
            />
          </View>
        </View>
        <Button title="Salvar alterações" onPress={handleSave} loading={saving} />
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
    paddingBottom: spacing.xl,
  },
  bannerWrap: {
    height: 180,
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    backgroundColor: colors.primarySoft,
  },
  mediaBadge: {
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
  logoWrap: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  logoPlaceholder: {
    backgroundColor: colors.surfaceMuted,
  },
  logoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  flex: {
    flex: 1,
  },
  rowSpacer: {
    width: spacing.md,
  },
  debugBox: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  debugTitle: {
    color: colors.darkText,
    fontWeight: '700',
  },
  debugText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
