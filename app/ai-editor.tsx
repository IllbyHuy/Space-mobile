import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNavBar } from '@/components/BottomNavBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AiEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('portal_token');
      if (!token) {
        router.replace('/login');
        return;
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [router]);

  if (checkingAuth) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: '#0D1117' }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Chỉnh ảnh</Text>
      </View>

      <View style={styles.emptyState}>
        <Feather name="image" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Sắp ra mắt</Text>
        <Text style={styles.emptyText}>
          Công cụ chỉnh sửa ảnh mặt bằng bằng AI đang được phát triển cho ứng dụng di động.
        </Text>
      </View>

      <BottomNavBar active="ai" style={{ paddingBottom: insets.bottom, height: 60 + insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D1117',
    borderBottomWidth: 1, borderBottomColor: '#0D1117'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
