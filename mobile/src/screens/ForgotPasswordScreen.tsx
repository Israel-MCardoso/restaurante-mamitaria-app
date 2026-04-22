import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { MailSearch } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { getPasswordRecoveryRedirectUrl } from '../services/authRecovery';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface ForgotPasswordScreenProps {
  initialEmail?: string;
  onBack: () => void;
}

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function ForgotPasswordScreen({ initialEmail = '', onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleSendRecovery() {
    if (!normalizedEmail) {
      Alert.alert('E-mail obrigatorio', 'Informe o e-mail usado para acessar o painel.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('E-mail invalido', 'Confira o e-mail informado antes de continuar.');
      return;
    }

    setSending(true);

    try {
      console.info('[auth-recovery] requesting password reset email', {
        emailDomain: normalizedEmail.split('@')[1] ?? null,
      });

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordRecoveryRedirectUrl(),
      });

      if (error) {
        console.error('[auth-recovery] failed to request password reset email', {
          message: error.message,
        });
        Alert.alert('Nao foi possivel enviar', 'Verifique sua conexao e tente novamente em instantes.');
        return;
      }

      Alert.alert(
        'Instrucoes enviadas',
        'Se existir uma conta para esse e-mail, voce recebera um link para redefinir a senha no app.',
      );
      onBack();
    } finally {
      setSending(false);
    }
  }

  return (
    <AppScreen scrollable keyboardAware contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <MailSearch size={34} color={colors.white} />
        </View>
        <Text style={styles.eyebrow}>Recuperar acesso</Text>
        <Text style={styles.title}>Receba um link seguro para redefinir sua senha.</Text>
        <Text style={styles.subtitle}>
          Informe o mesmo e-mail usado no painel. O link recebido abrira o app para voce cadastrar uma nova senha.
        </Text>
      </View>

      <Card style={styles.card}>
        <Input
          label="E-mail"
          placeholder="voce@restaurante.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Button title="Enviar link de recuperacao" onPress={handleSendRecovery} loading={sending} />
        <Button title="Voltar ao login" variant="outline" onPress={onBack} style={styles.secondaryAction} />
      </Card>
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
  secondaryAction: {
    marginTop: spacing.md,
  },
});
