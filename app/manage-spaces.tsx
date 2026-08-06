import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomNavBar } from '@/components/BottomNavBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ManageSpacesScreen() {
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
        <Text style={styles.headerTitle}>Quản lý mặt bằng</Text>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/my-contracts')}>
          <View style={styles.menuIconWrap}>
            <Feather name="file-text" size={20} color="#00A67E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuCardTitle}>Hợp đồng của tôi</Text>
            <Text style={styles.menuCardSubtitle}>Xem, theo dõi trạng thái và ký hợp đồng</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#D1D5DB" />
        </TouchableOpacity>

        <View style={styles.emptyState}>
          <Feather name="briefcase" size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Sắp ra mắt</Text>
          <Text style={styles.emptyText}>
            Quản lý mặt bằng, tin đăng, người thuê và lịch cho thuê lại đang được phát triển cho ứng dụng di động.
          </Text>
        </View>
      </View>

      <BottomNavBar active="manage" style={{ paddingBottom: insets.bottom, height: 60 + insets.bottom }} />
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
  menuSection: { flex: 1, padding: 16 },
  menuCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center'
  },
  menuCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  menuCardSubtitle: { fontSize: 12, color: '#6B7280' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151' },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
