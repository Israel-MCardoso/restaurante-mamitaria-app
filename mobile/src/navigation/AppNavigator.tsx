import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Tag,
  Users,
  Utensils,
} from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import MenuScreen from '../screens/MenuScreen';
import ProductFormScreen from '../screens/ProductFormScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import AddonsScreen from '../screens/AddonsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import CouponsScreen from '../screens/CouponsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.darkText,
  headerTitleStyle: { fontWeight: '700' as const },
  cardStyle: { backgroundColor: colors.background },
};

function MenuStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="MenuList" component={MenuScreen} options={{ title: 'Cardápio' }} />
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
      <Tab.Screen name="Cardápio" component={MenuStack} options={{ tabBarIcon: ({ color }) => <Utensils color={color} /> }} />
      <Tab.Screen name="Categorias" component={CategoriesScreen} options={{ tabBarIcon: ({ color }) => <Tag color={color} size={20} /> }} />
      <Tab.Screen name="Clientes" component={CustomersScreen} options={{ tabBarIcon: ({ color }) => <Users color={color} /> }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <Settings color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => setSession(activeSession));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
