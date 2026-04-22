import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { AppScreen } from '../components/layout/AppScreen';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface ResetPasswordScreenProps {
  mode: 'recovery' | 'change';
  errorMessage?: string | null;
  onComplete: () => void;
  onCancel?: () => void;
}

function validatePassword(password: string) {
  return password.trim().length >= 8;
}

export default function ResetPasswordScreen({
  mode,
  errorMessage,
  onComplete,
  onCancel,
}: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const screenCopy = useMemo(() => {
    if (mode === 'recovery') {
      return {
        eyebrow: 'Nova senha',
        title: 'Defina uma nova senha para voltar ao painel.',
        subtitle: 'Escolha uma senha com pelo menos 8 caracteres. Depois disso, o acesso volta ao normal.',
        successTitle: 'Senha redefinida',
        successMessage: 'Sua nova senha foi salva com sucesso. Agora voce ja pode entrar normalmente.',
      };
    }

    return {
      eyebrow: 'Seguranca',
      title: 'Atualize sua senha administrativa.',
      subtitle: 'Troque a senha da conta atual sem sair do painel.',
      successTitle: 'Senha atualizada',
      successMessage: 'Sua senha foi alterada com sucesso.',
    };
  }, [mode]);

  async function handleSavePassword() {
    if (!password || !confirmPassword) {
      Alert.alert('Campos obrigatorios', 'Preencha e confirme a nova senha.');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Senha invalida', 'Use pelo menos 8 caracteres para proteger sua conta.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Confirmacao diferente', 'A confirmacao da senha precisa ser igual ao valor digitado.');
      return;
    }

    setSaving(true);

    try {
      console.info('[auth-password] updating password', { mode });

      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        console.error('[auth-password] failed to update password', {
          mode,
          message: error.message,
        });

        const safeMessage = mode === 'recovery'
          ? 'Nao foi possivel redefinir sua senha. Solicite um novo link e tente novamente.'
          : 'Nao foi possivel atualizar sua senha agora. Tente novamente em instantes.';

        Alert.alert('Erro ao salvar senha', safeMessage);
        return;
      }

      setPassword('');
      setConfirmPassword('');
      Alert.alert(screenCopy.successTitle, screenCopy.successMessage, [{ text: 'Continuar', onPress: onComplete }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen scrollable keyboardAware contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <KeyRound size={34} color={colors.white} />
        </View>
        <Text style={styles.eyebrow}>{screenCopy.eyebrow}</Text>
        <Text style={styles.title}>{screenCopy.title}</Text>
        <Text style={styles.subtitle}>{screenCopy.subtitle}</Text>
      </View>

      <Card style={styles.card}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Input
          label="Nova senha"
          placeholder="Digite a nova senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="Confirmar nova senha"
          placeholder="Repita a nova senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title="Salvar nova senha" onPress={handleSavePassword} loading={saving} />
        {onCancel ? <Button title="Cancelar" variant="outline" onPress={onCancel} style={styles.secondaryAction} /> : null}
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
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.md,
  },
  secondaryAction: {
    marginTop: spacing.md,
  },
});
