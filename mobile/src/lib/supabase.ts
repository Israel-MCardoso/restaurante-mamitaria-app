import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

export const SUPABASE_AUTH_SCHEME = 'com.restaurante.admin';
export const SUPABASE_PASSWORD_RESET_URL = `${SUPABASE_AUTH_SCHEME}://auth/reset-password`;

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = 'https://cwekbsatoddlnojyzvus.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZWtic2F0b2RkbG5vanl6dnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODkyNDksImV4cCI6MjA5MTM2NTI0OX0.0nEMNdpmkrrAXGuIFme30lzerBvjIDgFmXN179Puq9Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
