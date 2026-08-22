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

// --- TRICK LỎ: Auto relogin on 401 ---
const originalFetch = global.fetch;
let isRefreshing = false;

(global as any).reloginTrick = async () => {
  if (isRefreshing) return false;
  isRefreshing = true;
  try {
    const email = await AsyncStorage.getItem('portal_email');
    const pwd = await AsyncStorage.getItem('portal_password');
    if (email && pwd) {
      console.log("Trick lỏ: Auto relogin for", email);
      const loginRes = await originalFetch("https://flexi-space-capstone-project.onrender.com/api/Auth/login", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pwd, turnstileToken: "bypass" })
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        if (data.accessToken) {
          await AsyncStorage.setItem('portal_token', data.accessToken);
          isRefreshing = false;
          return data.accessToken;
        }
      }
    }
  } catch (err) {
    console.log("Trick lỏ failed:", err);
  }
  isRefreshing = false;
  return null;
};

global.fetch = async (input, init) => {
  let response = await originalFetch(input, init);
  
  if (response.status === 401) {
    console.log("Detected 401, triggering auto-relogin trick...");
    const newToken = await (global as any).reloginTrick();
    
    if (newToken) {
      console.log("Auto relogin success, retrying original request...");
      const newInit = { ...init };
      if (newInit.headers instanceof Headers) {
        newInit.headers.set('Authorization', `Bearer ${newToken}`);
      } else if (newInit.headers) {
        (newInit.headers as any)['Authorization'] = `Bearer ${newToken}`;
      } else {
        newInit.headers = { 'Authorization': `Bearer ${newToken}` };
      }
      return originalFetch(input, newInit);
    } else {
      // Relogin failed, let's clear tokens so the app forces manual login next time
      AsyncStorage.multiRemove(['portal_token', 'portal_email', 'portal_password']);
    }
  }
  return response;
};
// -------------------------------------

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