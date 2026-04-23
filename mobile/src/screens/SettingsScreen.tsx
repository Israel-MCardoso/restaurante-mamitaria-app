import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CreditCard, LogOut } from 'lucide-react-native';
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
import { typography } from '../theme/typography';
import { parseCurrencyInput } from '../utils/format';

async function launchSettingsImagePicker() {
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
    base64: false,
  };

  if (Platform.OS === 'android') {
    console.info('[settings] launching Android image picker without pre-request');
    return ImagePicker.launchImageLibraryAsync(pickerOptions);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  console.info('[settings] iOS media permission result', {
    granted: permission.granted,
    status: permission.status,
    canAskAgain: permission.canAskAgain,
  });

  if (!permission.granted) {
    return null;
  }

  return ImagePicker.launchImageLibraryAsync(pickerOptions);
}

export default function SettingsScreen() {
  const { restaurantId, loading: restaurantLoading, error: restaurantError, debug } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationValidating, setIntegrationValidating] = useState(false);
  const [uploadingField, setUploadingField] = useState<'logo_url' | 'banner_url' | null>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [mercadoPagoForm, setMercadoPagoForm] = useState({
    accessToken: '',
    publicKey: '',
    webhookSecret: '',
    isEnabled: false,
  });
  const [mercadoPagoStatus, setMercadoPagoStatus] = useState({
    isConfigured: false,
    hasWebhookSecret: false,
    accessTokenMasked: null as string | null,
    publicKeyMasked: null as string | null,
    webhookUrl: null as string | null,
    updatedAt: null as string | null,
  });
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  });

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
    await fetchMercadoPagoIntegration();
  }

  async function fetchMercadoPagoIntegration() {
    setIntegrationLoading(true);

    try {
      const status = await api.paymentIntegrations.mercadoPagoStatus();
      setMercadoPagoStatus({
        isConfigured: status.isConfigured,
        hasWebhookSecret: status.hasWebhookSecret,
        accessTokenMasked: status.accessTokenMasked,
        publicKeyMasked: status.publicKeyMasked,
        webhookUrl: status.webhookUrl,
        updatedAt: status.updatedAt,
      });
      setMercadoPagoForm((current) => ({
        ...current,
        accessToken: '',
        publicKey: '',
        webhookSecret: '',
        isEnabled: status.isEnabled,
      }));
    } catch (error: any) {
      Alert.alert('Integração indisponível', error?.message || 'Não foi possível carregar o status do Mercado Pago.');
    } finally {
      setIntegrationLoading(false);
    }
  }

  async function handleUpload(field: 'logo_url' | 'banner_url') {
    if (!restaurantId) {
      Alert.alert('Restaurante não encontrado', restaurantError || 'Não foi possível identificar o restaurante para envio da imagem.');
      return;
    }

    try {
      const permissionSnapshot = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.info('[settings] media permission snapshot before picker', {
        field,
        granted: permissionSnapshot.granted,
        status: permissionSnapshot.status,
        canAskAgain: permissionSnapshot.canAskAgain,
      });

      const result = await launchSettingsImagePicker();
      if (!result) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para enviar imagens.');
        return;
      }

      if (result.canceled || !result.assets.length) {
        console.info('[settings] image picker cancelled', { field });
        return;
      }

      setUploadingField(field);
      const publicUrl = await storage.uploadImage(restaurantId, 'settings', result.assets[0]);
      setRestaurant((current: any) => ({ ...current, [field]: publicUrl }));
    } catch (error: any) {
      console.error('[settings] image picker/upload failed', {
        field,
        message: error?.message || 'unknown error',
      });
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
      settings: {
        ...(restaurant.settings || {}),
        delivery_fee: Number(parseCurrencyInput(String(restaurant.settings?.delivery_fee ?? 0))) || 0,
        min_order: Number(parseCurrencyInput(String(restaurant.settings?.min_order ?? 0))) || 0,
        estimated_time_minutes: Number(String(restaurant.settings?.estimated_time_minutes ?? 45)) || 45,
        delivery_pricing_mode: restaurant.settings?.delivery_pricing_mode === 'distance' ? 'distance' : 'fixed',
        delivery_fee_per_km: Number(parseCurrencyInput(String(restaurant.settings?.delivery_fee_per_km ?? 0))) || 0,
      },
    });

    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } else {
      Alert.alert('Tudo certo', 'Dados do restaurante atualizados com sucesso.');
    }
    setSaving(false);
  }

  async function handleChangePassword() {
    if (!passwordForm.password || !passwordForm.confirmPassword) {
      Alert.alert('Campos obrigatorios', 'Preencha e confirme a nova senha antes de salvar.');
      return;
    }

    if (passwordForm.password.trim().length < 8) {
      Alert.alert('Senha invalida', 'Use pelo menos 8 caracteres para proteger sua conta.');
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      Alert.alert('Confirmacao diferente', 'A confirmacao da senha precisa ser igual ao valor digitado.');
      return;
    }

    setPasswordSaving(true);

    try {
      console.info('[settings] updating password for authenticated admin');

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.password.trim(),
      });

      if (error) {
        console.error('[settings] failed to update password', {
          message: error.message,
        });
        Alert.alert('Erro ao alterar senha', 'Nao foi possivel atualizar sua senha agora. Tente novamente em instantes.');
        return;
      }

      setPasswordForm({
        password: '',
        confirmPassword: '',
      });
      Alert.alert('Senha atualizada', 'Sua senha administrativa foi alterada com sucesso.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleValidateMercadoPago() {
    if (!mercadoPagoForm.accessToken.trim()) {
      Alert.alert('Access Token obrigatório', 'Cole o Access Token de produção para validar a integração.');
      return;
    }

    setIntegrationValidating(true);

    try {
      const result = await api.paymentIntegrations.validateMercadoPago({
        accessToken: mercadoPagoForm.accessToken,
        publicKey: mercadoPagoForm.publicKey,
      });

      const accountLabel = result.accountName || result.accountEmail || 'Conta validada';
      const publicKeyMessage = result.publicKeyLooksValid
        ? 'A Public Key também parece válida.'
        : 'A Public Key não pôde ser confirmada pelo formato informado.';

      Alert.alert('Credenciais validadas', `${accountLabel}\n\n${publicKeyMessage}`);
    } catch (error: any) {
      Alert.alert('Validação falhou', error?.message || 'Não foi possível validar as credenciais agora.');
    } finally {
      setIntegrationValidating(false);
    }
  }

  async function handleSaveMercadoPago() {
    if (!mercadoPagoForm.accessToken.trim()) {
      Alert.alert('Access Token obrigatório', 'Cole o Access Token de produção antes de salvar.');
      return;
    }

    if (!mercadoPagoForm.publicKey.trim()) {
      Alert.alert('Public Key obrigatória', 'Cole a Public Key de produção antes de salvar.');
      return;
    }

    setIntegrationSaving(true);

    try {
      const status = await api.paymentIntegrations.saveMercadoPago({
        accessToken: mercadoPagoForm.accessToken,
        publicKey: mercadoPagoForm.publicKey,
        webhookSecret: mercadoPagoForm.webhookSecret || null,
        isEnabled: mercadoPagoForm.isEnabled,
      });

      setMercadoPagoStatus({
        isConfigured: status.isConfigured,
        hasWebhookSecret: status.hasWebhookSecret,
        accessTokenMasked: status.accessTokenMasked,
        publicKeyMasked: status.publicKeyMasked,
        webhookUrl: status.webhookUrl,
        updatedAt: status.updatedAt,
      });
      setMercadoPagoForm({
        accessToken: '',
        publicKey: '',
        webhookSecret: '',
        isEnabled: status.isEnabled,
      });
      Alert.alert('Integração salva', 'As credenciais do Mercado Pago foram atualizadas com sucesso.');
    } catch (error: any) {
      Alert.alert('Erro ao salvar', error?.message || 'Não foi possível salvar a integração do Mercado Pago.');
    } finally {
      setIntegrationSaving(false);
    }
  }

  async function handleToggleMercadoPago(value: boolean) {
    setMercadoPagoForm((current) => ({ ...current, isEnabled: value }));

    if (!mercadoPagoStatus.isConfigured) {
      return;
    }

    try {
      const status = await api.paymentIntegrations.toggleMercadoPago(value);
      setMercadoPagoStatus((current) => ({
        ...current,
        isConfigured: status.isConfigured,
        hasWebhookSecret: status.hasWebhookSecret,
        accessTokenMasked: status.accessTokenMasked,
        publicKeyMasked: status.publicKeyMasked,
        webhookUrl: status.webhookUrl,
        updatedAt: status.updatedAt,
      }));
    } catch (error: any) {
      setMercadoPagoForm((current) => ({ ...current, isEnabled: !value }));
      Alert.alert('Erro ao atualizar', error?.message || 'Não foi possível atualizar o status da integração.');
    }
  }

  async function handleCopyWebhookUrl() {
    if (!mercadoPagoStatus.webhookUrl) {
      return;
    }

    Alert.alert('URL do webhook', mercadoPagoStatus.webhookUrl);
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
            <Text style={styles.debugTitle}>Diagnóstico</Text>
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
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Taxa base de entrega"
              value={String(restaurant.settings?.delivery_fee ?? '')}
              keyboardType="decimal-pad"
              onChangeText={(value) =>
                setRestaurant((current: any) => ({
                  ...current,
                  settings: { ...(current.settings || {}), delivery_fee: parseCurrencyInput(value) },
                }))
              }
            />
          </View>
          <View style={styles.rowSpacer} />
          <View style={styles.flex}>
            <Input
              label="Pedido mínimo"
              value={String(restaurant.settings?.min_order ?? '')}
              keyboardType="decimal-pad"
              onChangeText={(value) =>
                setRestaurant((current: any) => ({
                  ...current,
                  settings: { ...(current.settings || {}), min_order: parseCurrencyInput(value) },
                }))
              }
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Prazo médio (min)"
              value={String(restaurant.settings?.estimated_time_minutes ?? 45)}
              keyboardType="number-pad"
              onChangeText={(value) =>
                setRestaurant((current: any) => ({
                  ...current,
                  settings: { ...(current.settings || {}), estimated_time_minutes: value.replace(/[^\d]/g, '') },
                }))
              }
            />
          </View>
          <View style={styles.rowSpacer} />
          <View style={styles.flex}>
            <Input
              label="Valor por km"
              value={String(restaurant.settings?.delivery_fee_per_km ?? '')}
              keyboardType="decimal-pad"
              onChangeText={(value) =>
                setRestaurant((current: any) => ({
                  ...current,
                  settings: { ...(current.settings || {}), delivery_fee_per_km: parseCurrencyInput(value) },
                }))
              }
            />
          </View>
        </View>
        <Text style={styles.sectionLabel}>Cálculo da entrega</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              (restaurant.settings?.delivery_pricing_mode ?? 'fixed') === 'fixed' && styles.modeButtonActive,
            ]}
            onPress={() =>
              setRestaurant((current: any) => ({
                ...current,
                settings: { ...(current.settings || {}), delivery_pricing_mode: 'fixed' },
              }))
            }
          >
            <Text
              style={[
                styles.modeButtonText,
                (restaurant.settings?.delivery_pricing_mode ?? 'fixed') === 'fixed' && styles.modeButtonTextActive,
              ]}
            >
              Taxa fixa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              restaurant.settings?.delivery_pricing_mode === 'distance' && styles.modeButtonActive,
            ]}
            onPress={() =>
              setRestaurant((current: any) => ({
                ...current,
                settings: { ...(current.settings || {}), delivery_pricing_mode: 'distance' },
              }))
            }
          >
            <Text
              style={[
                styles.modeButtonText,
                restaurant.settings?.delivery_pricing_mode === 'distance' && styles.modeButtonTextActive,
              ]}
            >
              Base + km
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>
          Em &quot;Base + km&quot;, o site estima a distância com base no endereço da loja e do cliente. Se a estimativa não estiver disponível, a taxa base continua valendo.
        </Text>
        <Button title="Salvar alterações" onPress={handleSave} loading={saving} />
      </Card>

      <Card style={styles.passwordCard}>
        <Text style={styles.passwordTitle}>Seguranca da conta</Text>
        <Text style={styles.passwordSubtitle}>
          Atualize sua senha administrativa sem sair do app. Use pelo menos 8 caracteres.
        </Text>
        <Input
          label="Nova senha"
          value={passwordForm.password}
          onChangeText={(value) => setPasswordForm((current) => ({ ...current, password: value }))}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Digite a nova senha"
        />
        <Input
          label="Confirmar nova senha"
          value={passwordForm.confirmPassword}
          onChangeText={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Repita a nova senha"
        />
        <Button title="Atualizar senha" onPress={handleChangePassword} loading={passwordSaving} />
      </Card>

      <Card style={styles.integrationCard}>
        <View style={styles.integrationHeader}>
          <View style={styles.integrationHeaderCopy}>
            <Text style={styles.integrationEyebrow}>Pagamentos</Text>
            <Text style={styles.integrationTitle}>Integração Mercado Pago</Text>
            <Text style={styles.integrationSubtitle}>
              Para receber Pix direto na sua conta, cole aqui as credenciais de produção da sua aplicação Mercado Pago.
            </Text>
          </View>
          <View style={styles.integrationIcon}>
            <CreditCard size={20} color={colors.primary} />
          </View>
        </View>

        <View style={styles.integrationSteps}>
          <Text style={styles.integrationStep}>1. Acesse Mercado Pago Developers.</Text>
          <Text style={styles.integrationStep}>2. Copie o Access Token e a Public Key de produção.</Text>
          <Text style={styles.integrationStep}>3. Salve abaixo para ativar o Pix deste restaurante.</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Pix ativo</Text>
            <Text style={styles.toggleDescription}>
              {mercadoPagoStatus.isConfigured
                ? 'Ative quando quiser usar as credenciais já salvas.'
                : 'Salve as credenciais primeiro para liberar o Pix em produção.'}
            </Text>
          </View>
          <Switch
            value={mercadoPagoForm.isEnabled}
            onValueChange={handleToggleMercadoPago}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={mercadoPagoForm.isEnabled ? colors.primary : colors.surface}
          />
        </View>

        {integrationLoading ? (
          <View style={styles.integrationLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.statusBox}>
            <Text style={styles.statusLine}>
              Status: {mercadoPagoStatus.isConfigured ? 'configurado' : 'ainda não configurado'}
            </Text>
            <Text style={styles.statusLine}>
              Access Token salvo: {mercadoPagoStatus.accessTokenMasked || 'nenhum'}
            </Text>
            <Text style={styles.statusLine}>
              Public Key salva: {mercadoPagoStatus.publicKeyMasked || 'nenhuma'}
            </Text>
            <Text style={styles.statusLine}>
              Assinatura de webhook: {mercadoPagoStatus.hasWebhookSecret ? 'configurada' : 'não informada'}
            </Text>
            <Text style={styles.statusLine}>Webhook: {mercadoPagoStatus.webhookUrl || '-'}</Text>
            {mercadoPagoStatus.updatedAt ? (
              <Text style={styles.statusLine}>Última atualização: {new Date(mercadoPagoStatus.updatedAt).toLocaleString('pt-BR')}</Text>
            ) : null}
          </View>
        )}

        <Input
          label="Access Token de produção"
          value={mercadoPagoForm.accessToken}
          onChangeText={(value) => setMercadoPagoForm((current) => ({ ...current, accessToken: value }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="APP_USR-..."
        />

        <Input
          label="Public Key de produção"
          value={mercadoPagoForm.publicKey}
          onChangeText={(value) => setMercadoPagoForm((current) => ({ ...current, publicKey: value }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="APP_USR-..."
        />

        <Input
          label="Webhook secret (recomendado)"
          value={mercadoPagoForm.webhookSecret}
          onChangeText={(value) => setMercadoPagoForm((current) => ({ ...current, webhookSecret: value }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Cole aqui o secret de assinatura do webhook"
        />

        <View style={styles.actionsRow}>
          <View style={styles.actionFlex}>
            <Button title="Validar credenciais" variant="outline" onPress={handleValidateMercadoPago} loading={integrationValidating} />
          </View>
          <View style={styles.rowSpacer} />
          <View style={styles.actionFlex}>
            <Button title="Salvar Mercado Pago" onPress={handleSaveMercadoPago} loading={integrationSaving} />
          </View>
        </View>

        <Button title="Copiar URL do webhook" variant="secondary" onPress={handleCopyWebhookUrl} style={styles.copyButton} />
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
  sectionLabel: {
    ...typography.body,
    color: colors.darkText,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    ...typography.button,
    color: colors.primary,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  actionFlex: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButton: {
    marginTop: spacing.md,
  },
  passwordCard: {
    marginTop: spacing.lg,
  },
  passwordTitle: {
    ...typography.title,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  passwordSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  integrationCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  integrationHeaderCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  integrationEyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  integrationTitle: {
    ...typography.title,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  integrationSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  integrationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationSteps: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  integrationStep: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleTitle: {
    ...typography.body,
    color: colors.darkText,
    fontWeight: '700',
  },
  toggleDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  integrationLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  statusLine: {
    ...typography.caption,
    color: colors.darkText,
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
