import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface LoginScreenProps {
  accessError?: string | null;
  bootstrapError?: string | null;
  onRetryBootstrap?: () => void;
  onForceLogout?: () => void;
  onClearAccessError?: () => void;
}

export default function LoginScreen({
  accessError,
  bootstrapError,
  onRetryBootstrap,
  onForceLogout,
  onClearAccessError,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const hasOperationalError = !!accessError || !!bootstrapError;

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Campos obrigatórios', 'Informe e-mail e senha para entrar.');
      return;
    }

    setLoading(true);
    onClearAccessError?.();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      Alert.alert('Erro ao entrar', error.message);
    }

    setLoading(false);
  }

  return (
    <AppScreen scrollable keyboardAware contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <ShieldCheck size={36} color={colors.white} />
        </View>
        <Text style={styles.eyebrow}>Painel do restaurante</Text>
        <Text style={styles.title}>Controle pedidos, cardápio e operação em um só lugar.</Text>
        <Text style={styles.subtitle}>
          Entre com sua conta para acompanhar o dia, ajustar produtos e responder rápido aos pedidos.
        </Text>
      </View>

      <Card style={styles.card}>
        {accessError ? <Text style={styles.accessError}>{accessError}</Text> : null}
        {bootstrapError ? <Text style={styles.bootstrapError}>{bootstrapError}</Text> : null}
        <Input
          label="E-mail"
          placeholder="voce@restaurante.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Senha"
          placeholder="Digite sua senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button title="Entrar no painel" onPress={handleLogin} loading={loading} />
        {hasOperationalError && onRetryBootstrap ? (
          <Button title="Tentar novamente" variant="outline" onPress={onRetryBootstrap} style={styles.secondaryAction} />
        ) : null}
        {hasOperationalError && onForceLogout ? (
          <Button title="Sair desta conta" variant="secondary" onPress={onForceLogout} style={styles.secondaryAction} />
        ) : null}
      </Card>

      <Text style={styles.footer}>Ambiente administrativo conectado ao Supabase.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  hero: {
    marginBottom: spacing.huge,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.hero,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.md,
  },
  card: {
    padding: spacing.xl,
  },
  accessError: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.md,
  },
  bootstrapError: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  secondaryAction: {
    marginTop: spacing.md,
  },
  footer: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.huge,
  },
});
