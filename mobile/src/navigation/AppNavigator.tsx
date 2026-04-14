import React, { useEffect, useState } from 'react';
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
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const ALLOWED_ROLES = ['admin', 'manager'];

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.darkText,
  headerTitleStyle: { fontWeight: '700' as const },
  cardStyle: { backgroundColor: colors.background },
};

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
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function validateSession(activeSession: any) {
      if (!mounted) {
        return;
      }

      if (!activeSession?.user) {
        setSession(null);
        setAccessError(null);
        setIsBootstrapping(false);
        return;
      }

      setIsBootstrapping(true);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, restaurant_id')
        .eq('id', activeSession.user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      const isAllowed = !!profile?.restaurant_id && ALLOWED_ROLES.includes(profile.role);

      if (error || !isAllowed) {
        setSession(null);
        setAccessError('Esta conta não tem permissão para operar este painel administrativo.');
        await supabase.auth.signOut();
        setIsBootstrapping(false);
        return;
      }

      setSession(activeSession);
      setAccessError(null);
      setIsBootstrapping(false);
    }

    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      validateSession(activeSession);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      validateSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (isBootstrapping) {
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
      {session && !accessError ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login">
          {() => <LoginScreen accessError={accessError} onClearAccessError={() => setAccessError(null)} />}
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
