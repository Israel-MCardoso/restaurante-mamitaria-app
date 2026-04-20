import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { LayoutDashboard, Settings, ShoppingBag, Tag, Utensils } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import MenuScreen from '../screens/MenuScreen';
import ProductFormScreen from '../screens/ProductFormScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import AddonsScreen from '../screens/AddonsScreen';
import CouponsScreen from '../screens/CouponsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import { supabase } from '../lib/supabase';
import { clearRestaurantContext, persistRestaurantContext } from '../services/restaurantContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const ALLOWED_ROLES = ['admin', 'manager'];
const BOOTSTRAP_TIMEOUT_MS = 12000;

type BootstrapState = {
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  hasRestaurantContext: boolean;
  accessError: string | null;
  bootstrapError: string | null;
};

const initialBootstrapState: BootstrapState = {
  isBootstrapping: true,
  isAuthenticated: false,
  isAuthorized: false,
  hasRestaurantContext: false,
  accessError: null,
  bootstrapError: null,
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.darkText,
  headerTitleStyle: { fontWeight: '700' as const },
  cardStyle: { backgroundColor: colors.background },
};

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} demorou mais do que o esperado.`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function safeClearRestaurantContext(reason: string) {
  try {
    await withTimeout(clearRestaurantContext(), 4000, 'A limpeza do contexto local');
    console.info('[bootstrap] local restaurant context cleared', { reason });
  } catch (error: any) {
    console.warn('[bootstrap] failed to clear local restaurant context', {
      reason,
      message: error?.message ?? 'unknown error',
    });
  }
}

async function safePersistRestaurantContext(params: {
  userId: string;
  email?: string | null;
  restaurantId: string;
  role?: string | null;
}) {
  try {
    await withTimeout(persistRestaurantContext(params), 4000, 'A persistencia do contexto local');
    console.info('[bootstrap] local restaurant context persisted', {
      userId: params.userId,
      restaurantId: params.restaurantId,
      role: params.role ?? null,
    });
  } catch (error: any) {
    console.warn('[bootstrap] failed to persist local restaurant context', {
      userId: params.userId,
      restaurantId: params.restaurantId,
      message: error?.message ?? 'unknown error',
    });
  }
}

function MenuStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MenuList" component={MenuScreen} options={{ title: 'Catálogo' }} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ title: 'Produto' }} />
      <Stack.Screen name="MenuCategories" component={CategoriesScreen} options={{ title: 'Categorias' }} />
      <Stack.Screen name="MenuAddons" component={AddonsScreen} options={{ title: 'Adicionais' }} />
      <Stack.Screen name="MenuCoupons" component={CouponsScreen} options={{ title: 'Cupons' }} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'Pedidos' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Detalhes do pedido' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen name="Início" component={DashboardScreen} options={{ tabBarIcon: ({ color }) => <LayoutDashboard color={color} /> }} />
      <Tab.Screen name="Pedidos" component={OrdersStack} options={{ tabBarIcon: ({ color }) => <ShoppingBag color={color} /> }} />
      <Tab.Screen name="Catálogo" component={MenuStack} options={{ tabBarIcon: ({ color }) => <Utensils color={color} /> }} />
      <Tab.Screen name="Categorias" component={CategoriesScreen} options={{ tabBarIcon: ({ color }) => <Tag color={color} size={20} /> }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <Settings color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [session, setSession] = useState<any>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>(initialBootstrapState);
  const bootstrapRunIdRef = useRef(0);
  const lastAuthSessionRef = useRef<any>(null);

  const runBootstrap = useCallback(async (activeSession: any, origin: string) => {
    const runId = ++bootstrapRunIdRef.current;
    lastAuthSessionRef.current = activeSession;

    const isCurrentRun = () => runId === bootstrapRunIdRef.current;
    const commitState = (nextState: Partial<BootstrapState>) => {
      if (!isCurrentRun()) {
        return;
      }

      setBootstrapState((current) => ({ ...current, ...nextState }));
    };

    console.info('[bootstrap] starting app bootstrap', {
      origin,
      runId,
      hasSession: !!activeSession?.user,
      userId: activeSession?.user?.id ?? null,
    });

    commitState({
      isBootstrapping: true,
      bootstrapError: null,
    });

    try {
      if (!activeSession?.user) {
        console.info('[bootstrap] no active session found', { origin, runId });
        setSession(null);
        await safeClearRestaurantContext('no-active-session');
        commitState({
          isAuthenticated: false,
          isAuthorized: false,
          hasRestaurantContext: false,
          accessError: null,
          bootstrapError: null,
        });
        return;
      }

      commitState({
        isAuthenticated: true,
        accessError: null,
      });

      console.info('[bootstrap] loading operational profile', {
        origin,
        runId,
        userId: activeSession.user.id,
      });

      const { data: profile, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('role, restaurant_id')
          .eq('id', activeSession.user.id)
          .maybeSingle(),
        BOOTSTRAP_TIMEOUT_MS,
        'A validacao do perfil operacional',
      );

      console.info('[bootstrap] profile lookup finished', {
        origin,
        runId,
        userId: activeSession.user.id,
        hasProfile: !!profile,
        role: profile?.role ?? null,
        restaurantId: profile?.restaurant_id ?? null,
        hasError: !!error,
      });

      if (error) {
        throw error;
      }

      const hasAllowedRole = !!profile?.role && ALLOWED_ROLES.includes(profile.role);
      const hasRestaurantContext = !!profile?.restaurant_id;
      const isAuthorized = hasAllowedRole && hasRestaurantContext;

      if (!isAuthorized) {
        const accessError = !profile
          ? 'Conta autenticada sem perfil operacional. Vincule este usuario a um restaurante e tente novamente.'
          : !hasAllowedRole
            ? 'Esta conta nao tem permissao para operar este painel administrativo.'
            : 'Esta conta ainda nao esta vinculada a um restaurante operacional.';

        console.warn('[bootstrap] operational access denied', {
          origin,
          runId,
          userId: activeSession.user.id,
          hasProfile: !!profile,
          role: profile?.role ?? null,
          restaurantId: profile?.restaurant_id ?? null,
        });

        setSession(activeSession);
        await safeClearRestaurantContext('unauthorized-profile');
        commitState({
          isAuthenticated: true,
          isAuthorized: false,
          hasRestaurantContext: false,
          accessError,
          bootstrapError: null,
        });

        return;
      }

      await safePersistRestaurantContext({
        userId: activeSession.user.id,
        email: activeSession.user.email ?? null,
        restaurantId: profile.restaurant_id,
        role: profile.role,
      });

      setSession(activeSession);
      commitState({
        isAuthorized: true,
        hasRestaurantContext: true,
        accessError: null,
        bootstrapError: null,
      });

      console.info('[bootstrap] bootstrap completed successfully', {
        origin,
        runId,
        userId: activeSession.user.id,
        restaurantId: profile.restaurant_id,
        role: profile.role,
      });
    } catch (error: any) {
      console.error('[bootstrap] bootstrap failed', {
        origin,
        runId,
        hasSession: !!activeSession?.user,
        userId: activeSession?.user?.id ?? null,
        message: error?.message ?? 'unknown error',
      });

      setSession(null);
      await safeClearRestaurantContext('bootstrap-failed');
      commitState({
        isAuthenticated: !!activeSession?.user,
        isAuthorized: false,
        hasRestaurantContext: false,
        accessError: activeSession?.user ? 'Nao foi possivel validar o acesso desta conta.' : null,
        bootstrapError: error?.message || 'Falha ao preparar o painel administrativo.',
      });
    } finally {
      commitState({ isBootstrapping: false });
      console.info('[bootstrap] bootstrap finalized', {
        origin,
        runId,
        stillCurrent: isCurrentRun(),
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: activeSession } }) => {
        if (!mounted) {
          return;
        }

        void runBootstrap(activeSession, 'getSession');
      })
      .catch((error: any) => {
        if (!mounted) {
          return;
        }

        console.error('[bootstrap] getSession failed', {
          message: error?.message ?? 'unknown error',
        });

        void runBootstrap(null, 'getSession-error');
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }

      console.info('[bootstrap] auth state changed', {
        event,
        hasSession: !!nextSession?.user,
        userId: nextSession?.user?.id ?? null,
      });

      void runBootstrap(nextSession, `auth:${event}`);
    });

    return () => {
      mounted = false;
      bootstrapRunIdRef.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [runBootstrap]);

  if (bootstrapState.isBootstrapping) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Preparando o painel</Text>
        <Text style={styles.loadingCopy}>
          Validando seu acesso administrativo e carregando o contexto do restaurante.
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session && bootstrapState.isAuthenticated && bootstrapState.isAuthorized && bootstrapState.hasRestaurantContext ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login">
          {() => (
            <LoginScreen
              accessError={bootstrapState.accessError}
              bootstrapError={bootstrapState.bootstrapError}
              onRetryBootstrap={() => void runBootstrap(lastAuthSessionRef.current, 'manual-retry')}
              onForceLogout={async () => {
                console.info('[bootstrap] forced logout requested by user');
                await safeClearRestaurantContext('manual-logout');
                try {
                  await withTimeout(supabase.auth.signOut(), 4000, 'O logout manual');
                } catch (error: any) {
                  console.warn('[bootstrap] manual logout failed', {
                    message: error?.message ?? 'unknown error',
                  });
                }
              }}
              onClearAccessError={() =>
                setBootstrapState((current) => ({
                  ...current,
                  accessError: null,
                  bootstrapError: null,
                }))
              }
            />
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  loadingTitle: {
    ...typography.subtitle,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingCopy: {
    ...typography.body,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
