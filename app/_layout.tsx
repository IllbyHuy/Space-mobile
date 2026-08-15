import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { NotificationProvider } from '@/hooks/NotificationContext';
import { GlobalToast } from '@/components/GlobalToast';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  usePushNotifications();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('portal_token');
        if (!token) {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Lỗi kiểm tra auth:', error);
      }
    };
    checkAuth();
  }, []);

  return (
    <NotificationProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="map" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="manage-spaces" options={{ headerShown: false }} />
          <Stack.Screen name="identity-verification" options={{ headerShown: false }} />
          <Stack.Screen name="my-contracts" options={{ headerShown: false }} />
          <Stack.Screen name="wallet" options={{ headerShown: false }} />
          <Stack.Screen name="wallet-deposit" options={{ headerShown: false }} />
          <Stack.Screen name="ai-editor" options={{ headerShown: false }} />
          <Stack.Screen name="contract/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="listing/[id]" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
        <GlobalToast />
      </ThemeProvider>
    </NotificationProvider>
  );
}