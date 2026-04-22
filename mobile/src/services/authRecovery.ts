import { supabase, SUPABASE_AUTH_SCHEME, SUPABASE_PASSWORD_RESET_URL } from '../lib/supabase';

export type AuthRecoveryResult = {
  handled: boolean;
  isRecovery: boolean;
  error: string | null;
};

function readUrlParam(url: URL, key: string) {
  const queryValue = url.searchParams.get(key);
  if (queryValue) {
    return queryValue;
  }

  return new URLSearchParams(url.hash.replace(/^#/, '')).get(key);
}

export function getPasswordRecoveryRedirectUrl() {
  return SUPABASE_PASSWORD_RESET_URL;
}

export function isPasswordRecoveryUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const protocol = url.protocol.replace(':', '');

    return protocol === SUPABASE_AUTH_SCHEME && url.hostname === 'auth' && url.pathname === '/reset-password';
  } catch (error) {
    console.warn('[auth-recovery] invalid callback URL received', {
      message: error instanceof Error ? error.message : 'invalid-url',
    });
    return false;
  }
}

export function getRecoveryErrorMessage(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const errorCode = readUrlParam(url, 'error_code');
    const errorDescription = readUrlParam(url, 'error_description');

    if (!errorCode && !errorDescription) {
      return null;
    }

    if (errorCode === 'otp_expired') {
      return 'O link de recuperacao expirou. Solicite um novo e-mail para redefinir sua senha.';
    }

    return 'Nao foi possivel validar este link de recuperacao. Solicite um novo e-mail e tente novamente.';
  } catch {
    return 'Nao foi possivel validar este link de recuperacao. Solicite um novo e-mail e tente novamente.';
  }
}

export async function handlePasswordRecoveryCallback(rawUrl: string): Promise<AuthRecoveryResult> {
  if (!isPasswordRecoveryUrl(rawUrl)) {
    return {
      handled: false,
      isRecovery: false,
      error: null,
    };
  }

  const callbackError = getRecoveryErrorMessage(rawUrl);
  if (callbackError) {
    return {
      handled: true,
      isRecovery: true,
      error: callbackError,
    };
  }

  try {
    const url = new URL(rawUrl);
    const type = readUrlParam(url, 'type');
    const accessToken = readUrlParam(url, 'access_token');
    const refreshToken = readUrlParam(url, 'refresh_token');

    if (type !== 'recovery') {
      return {
        handled: true,
        isRecovery: false,
        error: null,
      };
    }

    if (!accessToken || !refreshToken) {
      return {
        handled: true,
        isRecovery: true,
        error: 'O link de recuperacao esta incompleto. Solicite um novo e-mail para continuar.',
      };
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[auth-recovery] failed to hydrate recovery session', {
        message: error.message,
      });

      return {
        handled: true,
        isRecovery: true,
        error: 'Nao foi possivel abrir a sessao de recuperacao. Solicite um novo link e tente novamente.',
      };
    }

    console.info('[auth-recovery] recovery session hydrated successfully');

    return {
      handled: true,
      isRecovery: true,
      error: null,
    };
  } catch (error: any) {
    console.error('[auth-recovery] unexpected failure while processing callback', {
      message: error?.message ?? 'unknown error',
    });

    return {
      handled: true,
      isRecovery: true,
      error: 'Nao foi possivel processar o link de recuperacao. Solicite um novo e-mail e tente novamente.',
    };
  }
}
